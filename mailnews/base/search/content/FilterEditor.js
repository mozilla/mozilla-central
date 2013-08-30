/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/MailUtils.js");

// The actual filter that we're editing if it is a _saved_ filter or prefill;
// void otherwise.
var gFilter;
// cache the key elements we need
var gFilterList;
// The filter name as it appears in the "Filter Name" field of dialog.
var gFilterNameElement;
var gFilterTypeSelector;
var gFilterBundle;
var gPreFillName;
var gSessionFolderListenerAdded = false;
var gFilterActionList;
var gCustomActions = null;
var gFilterType;
var gFilterPosition = 0;

var gFilterActionStrings = ["none", "movemessage", "setpriorityto", "deletemessage",
                            "markasread", "ignorethread", "watchthread", "markasflagged",
                            "label", "replytomessage", "forwardmessage", "stopexecution",
                            "deletefrompopserver",  "leaveonpopserver", "setjunkscore",
                            "fetchfrompopserver", "copymessage", "addtagtomessage",
                            "ignoresubthread", "markasunread"];

// A temporary filter with the current state of actions in the UI.
let gTempFilter = null;
// A nsIArray of the currently defined actions in the order they will be run.
let gActionListOrdered = null;

var gFilterEditorMsgWindow = null;

const nsMsgFilterAction = Components.interfaces.nsMsgFilterAction;
const nsMsgFilterType   = Components.interfaces.nsMsgFilterType;
const nsIMsgRuleAction  = Components.interfaces.nsIMsgRuleAction;
const nsMsgSearchScope  = Components.interfaces.nsMsgSearchScope;

function filterEditorOnLoad()
{
  getCustomActions();
  initializeSearchWidgets();
  initializeFilterWidgets();

  gFilterBundle = document.getElementById("bundle_filter");

  if ("arguments" in window && window.arguments[0])
  {
    var args = window.arguments[0];

    if ("filterList" in args)
    {
      gFilterList = args.filterList;
      // the postPlugin filters cannot be applied to servers that are
      // deferred, (you must define them on the deferredTo server instead).
      let server = gFilterList.folder.server;
      if (server.rootFolder != server.rootMsgFolder)
        gFilterTypeSelector.disableAfterPlugins();
    }

    if ("filterPosition" in args)
    {
      gFilterPosition = args.filterPosition;
    }

    if ("filter" in args)
    {
      // editing a filter
      gFilter = window.arguments[0].filter;
      initializeDialog(gFilter);
    }
    else
    {
      if (gFilterList)
          setSearchScope(getScopeFromFilterList(gFilterList));
      // if doing prefill filter create a new filter and populate it.
      if ("filterName" in args)
      {
        gPreFillName = args.filterName;

        // Passing null as the parameter to createFilter to keep the name empty
        // until later where we assign the name.
        gFilter = gFilterList.createFilter(null);

        var term = gFilter.createTerm();

        term.attrib = Components.interfaces.nsMsgSearchAttrib.Sender;
        term.op = Components.interfaces.nsMsgSearchOp.Is;
        term.booleanAnd = gSearchBooleanRadiogroup.value == "and";

        var termValue = term.value;
        termValue.attrib = term.attrib;
        termValue.str = gPreFillName;

        term.value = termValue;

        gFilter.appendTerm(term);

        // the default action for news filters is Delete
        // for everything else, it's MoveToFolder
        var filterAction = gFilter.createAction();
        filterAction.type = (getScopeFromFilterList(gFilterList) ==
            nsMsgSearchScope.newsFilter) ?
            nsMsgFilterAction.Delete : nsMsgFilterAction.MoveToFolder;
        gFilter.appendAction(filterAction);
        initializeDialog(gFilter);
      }
      else
      {
        // fake the first more button press
        onMore(null);
      }
    }
  }

  if (!gFilter)
  {
    // This is a new filter. Set to both Incoming and Manual contexts.
    gFilterTypeSelector.setType(nsMsgFilterType.Incoming | nsMsgFilterType.Manual);
  }

  // in the case of a new filter, we may not have an action row yet.
  ensureActionRow();
  gFilterType = gFilterTypeSelector.getType();

  gFilterNameElement.select();
  // This call is required on mac and linux.  It has no effect under win32.  See bug 94800.
  gFilterNameElement.focus();
}

function filterEditorOnUnload()
{
  if (gSessionFolderListenerAdded)
    MailServices.mailSession.RemoveFolderListener(gFolderListener);
}

function onEnterInSearchTerm(event)
{
  if (event.ctrlKey || (Services.appinfo.OS == "Darwin" && event.metaKey)) {
    // If accel key (Ctrl on Win/Linux, Cmd on Mac) was held too, accept the dialog.
    document.getElementById("FilterEditor").acceptDialog();
  } else {
    // If only plain Enter was pressed, add a new rule line.
    onMore(event);
  }
}

function onAccept()
{
  try {
    if (!saveFilter())
      return false;
  } catch(e) {Components.utils.reportError(e); return false;}

  // parent should refresh filter list..
  // this should REALLY only happen when some criteria changes that
  // are displayed in the filter dialog, like the filter name
  window.arguments[0].refresh = true;
  return true;
}

// the folderListener object
var gFolderListener = {
  OnItemAdded: function(parentItem, item) {},

  OnItemRemoved: function(parentItem, item){},

  OnItemPropertyChanged: function(item, property, oldValue, newValue) {},

  OnItemIntPropertyChanged: function(item, property, oldValue, newValue) {},

  OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) {},

  OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue){},
  OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) {},

  OnItemEvent: function(folder, event)
  {
    var eventType = event.toString();

    if (eventType == "FolderCreateCompleted")
    {
      SetFolderPicker(folder.URI, gActionTargetElement.id);
      SetBusyCursor(window, false);
    }
    else if (eventType == "FolderCreateFailed")
      SetBusyCursor(window, false);
  }
}

function duplicateFilterNameExists(filterName)
{
  if (gFilterList)
    for (var i = 0; i < gFilterList.filterCount; i++)
      if (filterName == gFilterList.getFilterAt(i).filterName)
        return true;
  return false;
}

function getScopeFromFilterList(filterList)
{
  if (!filterList)
  {
    dump("yikes, null filterList\n");
    return nsMsgSearchScope.offlineMail;
  }
  return filterList.folder.server.filterScope;
}

function getScope(filter)
{
  return getScopeFromFilterList(filter.filterList);
}

function initializeFilterWidgets()
{
  gFilterNameElement = document.getElementById("filterName");
  gFilterActionList = document.getElementById("filterActionList");
  initializeFilterTypeSelector();
}

function initializeFilterTypeSelector()
{
  /**
   * This object controls code interaction with the widget allowing specifying
   * the filter type (event when the filter is run).
   */
  gFilterTypeSelector = {
    checkBoxManual: document.getElementById("runManual"),
    checkBoxIncoming : document.getElementById("runIncoming"),

    menulistIncoming: document.getElementById("pluginsRunOrder"),

    menuitemBeforePlugins: document.getElementById("runBeforePlugins"),
    menuitemAfterPlugins: document.getElementById("runAfterPlugins"),

    /**
     * Returns the currently set filter type (checkboxes) in terms
     * of a Components.interfaces.nsMsgFilterType value.
     */
    getType: function()
    {
      let type = nsMsgFilterType.None;

      if (this.checkBoxManual.checked)
        type |= nsMsgFilterType.Manual;

      if (this.checkBoxIncoming.checked) {
        if (this.menulistIncoming.selectedItem == this.menuitemAfterPlugins) {
          type |= nsMsgFilterType.PostPlugin;
        } else {
          // this.menuitemBeforePlugins selected
          if (getScopeFromFilterList(gFilterList) ==
              nsMsgSearchScope.newsFilter)
            type |= nsMsgFilterType.NewsRule;
          else
            type |= nsMsgFilterType.InboxRule;
        }
      }

      return type;
    },

    /**
     * Sets the checkboxes to represent the filter type passed in.
     *
     * @param aType  the filter type to set in terms
     *               of Components.interfaces.nsMsgFilterType values.
     */
    setType: function(aType)
    {
      // If there is no type (event) requested, force "when manually run"
      if (aType == nsMsgFilterType.None)
        aType = nsMsgFilterType.Manual;

      this.checkBoxManual.checked   = aType & nsMsgFilterType.Manual;

      this.checkBoxIncoming.checked = aType & (nsMsgFilterType.PostPlugin |
                                               nsMsgFilterType.Incoming);

      this.menulistIncoming.selectedItem = aType & nsMsgFilterType.PostPlugin ?
        this.menuitemAfterPlugins : this.menuitemBeforePlugins;

      this.updateClassificationMenu();
    },

    /**
     * Enable the "before/after classification" menulist depending on
     * whether "run when incoming mail" is selected.
     */
    updateClassificationMenu: function()
    {
      this.menulistIncoming.disabled = !this.checkBoxIncoming.checked;
      updateFilterType();
    },

    /**
     * Disable the "After classification" option for this filter.
     */
    disableAfterPlugins: function()
    {
      this.menuitemAfterPlugins.disabled = true;
    }
  };
}

function initializeDialog(filter)
{
  gFilterNameElement.value = filter.filterName;
  let filterType = filter.filterType;
  gFilterTypeSelector.setType(filter.filterType);

  let numActions = filter.actionCount;
  for (let actionIndex = 0; actionIndex < numActions; actionIndex++)
  {
    let filterAction = filter.getActionAt(actionIndex);

    var newActionRow = document.createElement('listitem');
    newActionRow.setAttribute('initialActionIndex', actionIndex);
    newActionRow.className = 'ruleaction';
    gFilterActionList.appendChild(newActionRow);
    newActionRow.setAttribute('value',
        filterAction.type == nsMsgFilterAction.Custom ?
        filterAction.customId : gFilterActionStrings[filterAction.type]);
    newActionRow.setAttribute('onfocus', 'this.storeFocus();');
  }

  var gSearchScope = getFilterScope(getScope(filter), filter.filterType, filter.filterList);
  initializeSearchRows(gSearchScope, filter.searchTerms);
  setFilterScope(filter.filterType, filter.filterList);
}

function ensureActionRow()
{
  // make sure we have at least one action row visible to the user
  if (!gFilterActionList.getRowCount())
  {
    var newActionRow = document.createElement('listitem');
    newActionRow.className = 'ruleaction';
    gFilterActionList.appendChild(newActionRow);
    newActionRow.mRemoveButton.disabled = true;
  }
}

// move to overlay
function saveFilter()
{
  // See if at least one filter type (activation event) is selected.
  if (gFilterType == nsMsgFilterType.None) {
    Services.prompt.alert(window,
                          gFilterBundle.getString("mustHaveFilterTypeTitle"),
                          gFilterBundle.getString("mustHaveFilterTypeMessage"));
    return false;
  }

  let filterName = gFilterNameElement.value;
  // If we think have a duplicate, then we need to check that if we
  // have an original filter name (i.e. we are editing a filter), then
  // we must check that the original is not the current as that is what
  // the duplicateFilterNameExists function will have picked up.
  if ((!gFilter || gFilter.filterName != filterName) && duplicateFilterNameExists(filterName))
  {
    Services.prompt.alert(window,
                          gFilterBundle.getString("cannotHaveDuplicateFilterTitle"),
                          gFilterBundle.getString("cannotHaveDuplicateFilterMessage"));
    return false;
  }

  // Check that all of the search attributes and operators are valid.
  function rule_desc(index, obj) {
    return (index + 1) + " (" + obj.searchattribute.label + ", " + obj.searchoperator.label + ")";
  }

  let invalidRule = false;
  for (let index = 0; index < gSearchTerms.length; index++)
  {
    let obj = gSearchTerms[index].obj;
    // We don't need to check validity of matchAll terms
    if (obj.matchAll)
      continue;

    // the term might be an offscreen one that we haven't initialized yet
    let searchTerm = obj.searchTerm;
    if (!searchTerm && !gSearchTerms[index].initialized)
      continue;

    if (isNaN(obj.searchattribute.value)) // is this a custom term?
    {
      let customTerm = MailServices.filters.getCustomTerm(obj.searchattribute.value);
      if (!customTerm)
      {
        invalidRule = true;
        Components.utils.reportError("Filter not saved because custom search term '" +
                                     obj.searchattribute.value + "' in rule " + rule_desc(index, obj) + " not found");
      }
      else
      {
        if (!customTerm.getAvailable(obj.searchScope, obj.searchattribute.value))
        {
          invalidRule = true;
          Components.utils.reportError("Filter not saved because custom search term '" +
                                       customTerm.name + "' in rule " + rule_desc(index, obj) + " not available");
        }
      }
    }
    else
    {
      let otherHeader = Components.interfaces.nsMsgSearchAttrib.OtherHeader;
      let attribValue = (obj.searchattribute.value > otherHeader) ?
        otherHeader : obj.searchattribute.value;
      if (!obj.searchattribute
            .validityTable
            .getAvailable(attribValue, obj.searchoperator.value))
      {
        invalidRule = true;
        Components.utils.reportError("Filter not saved because standard search term '" +
                                     attribValue + "' in rule " + rule_desc(index, obj) + " not available in this context");
      }
    }

    if (invalidRule) {
      Services.prompt.alert(window,
                            gFilterBundle.getString("searchTermsInvalidTitle"),
                            gFilterBundle.getFormattedString("searchTermsInvalidRule",
                                                             [obj.searchattribute.label,
                                                              obj.searchoperator.label]));
      return false;
    }

  }

  // before we go any further, validate each specified filter action, abort the save
  // if any of the actions is invalid...
  for (let index = 0; index < gFilterActionList.itemCount; index++)
  {
    var listItem = gFilterActionList.getItemAtIndex(index);
    if (!listItem.validateAction())
      return false;
  }

  // if we made it here, all of the actions are valid, so go ahead and save the filter
  let isNewFilter;
  if (!gFilter)
  {
    // This is a new filter
    gFilter = gFilterList.createFilter(filterName);
    isNewFilter = true;
    gFilter.enabled = true;
  }
  else
  {
    // We are working with an existing filter object,
    // either editing or using prefill
    gFilter.filterName = filterName;
    //Prefilter is treated as a new filter.
    if (gPreFillName)
    {
      isNewFilter = true;
      gFilter.enabled = true;
    }
    else
      isNewFilter = false;

    gFilter.clearActionList();
  }

  // add each filteraction to the filter
  for (let index = 0; index < gFilterActionList.itemCount; index++)
    gFilterActionList.getItemAtIndex(index).saveToFilter(gFilter);

  // If we do not have a filter name at this point, generate one.
  if (!gFilter.filterName)
    AssignMeaningfulName();

  gFilter.filterType = gFilterType;
  saveSearchTerms(gFilter.searchTerms, gFilter);

  if (isNewFilter)
  {
    // new filter - insert into gFilterList
    gFilterList.insertFilterAt(gFilterPosition, gFilter);
  }

  // success!
  return true;
}

/**
 * Check if the list of actions the user created will be executed in a different order.
 * Exposes a note to the user if that is the case.
 */
function checkActionsReorder()
{
  setTimeout(_checkActionsReorder, 0);
}

/**
 * This should be called from setTimeout otherwise some of the elements calling
 * may not be fully initialized yet (e.g. we get ".saveToFilter is not a function").
 * It is OK to schedule multiple timeouts with this function.
 */
function _checkActionsReorder() {
  // Create a temporary disposable filter and add current actions to it.
  if (!gTempFilter)
    gTempFilter = gFilterList.createFilter("");
  else
    gTempFilter.clearActionList();

  for (let index = 0; index < gFilterActionList.itemCount; index++)
    gFilterActionList.getItemAtIndex(index).saveToFilter(gTempFilter);

  // Now get the actions out of the filter in the order they will be executed in.
  gActionListOrdered = gTempFilter.sortedActionList;

  // Compare the two lists.
  let statusBar = document.getElementById("statusbar");
  for (let index = 0; index < gActionListOrdered.length; index++) {
    if (index != gTempFilter.getActionIndex(
        gActionListOrdered.queryElementAt(index, nsIMsgRuleAction)))
    {
      // If the lists are not the same unhide the status bar and show warning.
      statusBar.style.visibility = "visible";
      return;
    }
  }

  statusBar.style.visibility = "hidden";
}

/**
 * Show a dialog with the ordered list of actions.
 * The fetching of action label and argument is separated from checkActionsReorder
 * function to make that one more lightweight. The list is built only upon
 * user request.
 */
function showActionsOrder()
{
  // Fetch the actions and arguments as a string.
  let actionStrings = [];
  for (let index = 0; index < gFilterActionList.itemCount; index++)
    gFilterActionList.getItemAtIndex(index).getActionStrings(actionStrings);

  // Present a nicely formatted list of action names and arguments.
  let actionList = gFilterBundle.getString("filterActionOrderExplanation");
  for (let i = 0; i < gActionListOrdered.length; i++) {
    let actionIndex = gTempFilter.getActionIndex(
      gActionListOrdered.queryElementAt(i, nsIMsgRuleAction));
    let action = actionStrings[actionIndex];
    actionList += gFilterBundle.getFormattedString("filterActionItem",
      [(i + 1), action.label, action.argument]);
  }

  Services.prompt.confirmEx(window,
                            gFilterBundle.getString("filterActionOrderTitle"),
                            actionList, Services.prompt.BUTTON_TITLE_OK,
                            null, null, null, null, {value:false});
}

function AssignMeaningfulName()
{
  // termRoot points to the first search object, which is the one we care about.
  let termRoot = gSearchTerms[0].obj;
  // stub is used as the base name for a filter.
  let stub;

  // If this is a Match All Messages Filter, we already know the name to assign.
  if (termRoot.matchAll)
    stub = gFilterBundle.getString( "matchAllFilterName" );
  else
  {
    // Assign a name based on the first search term.
    let searchValue = termRoot.searchvalue;
    let selIndex = searchValue.getAttribute( "selectedIndex" );
    let children = document.getAnonymousNodes(searchValue);
    let activeItem = children[selIndex];
    let attribs = Components.interfaces.nsMsgSearchAttrib;

    // Term, Operator and Value are the three parts of a filter match
    // Term and Operator are easy to retrieve
    let term = termRoot.searchattribute.label;
    let operator = termRoot.searchoperator.label;

    // Values are either popup menu items or edit fields.
    // For popup menus use activeItem.label; for
    // edit fields, activeItem.value
    let value;
    switch (Number(termRoot.searchattribute.value))
    {
      case attribs.Priority:
      case attribs.MsgStatus:
      case attribs.Keywords:
      case attribs.HasAttachmentStatus:
      case attribs.JunkStatus:
      case attribs.JunkScoreOrigin:
        if (activeItem)
          value = activeItem.label;
        else
          value = "";
        break;

      default:
        try
        {
          value = activeItem.value;
        }
        catch (ex)
        {
          // We should never get here, but for safety's sake,
          // let's name the filter "Untitled Filter".
          stub = gFilterBundle.getString( "untitledFilterName" );
          // Do not 'Return'. Instead fall through and deal with the untitled filter below.
        }
        break;
    }
    // We are now ready to name the filter.
    // If at this point stub is empty, we know that this is not a Match All Filter
    // and is not an "untitledFilterName" Filter, so assign it a name using
    // a string format from the Filter Bundle.
    if (!stub)
      stub = gFilterBundle.getFormattedString("filterAutoNameStr", [term, operator, value]);
  }

  // Whatever name we have used, 'uniquify' it.
  let tempName = stub;
  let count = 1;
  while (duplicateFilterNameExists(tempName))
  {
    count++;
    tempName = stub + " " + count;
  }
  gFilter.filterName = tempName;
}


function GetFirstSelectedMsgFolder()
{
  var selectedFolder = gActionTargetElement.getAttribute("uri");
  if (!selectedFolder)
    return null;

  var msgFolder = MailUtils.getFolderForURI(selectedFolder, true);
  return msgFolder;
}

function SearchNewFolderOkCallback(name, uri)
{
  var msgFolder = MailUtils.getFolderForURI(uri, true);
  var imapFolder = null;
  try
  {
    imapFolder = msgFolder.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
  }
  catch(ex) {}
  if (imapFolder) //imapFolder creation is asynchronous.
  {
    if (!gSessionFolderListenerAdded) {
      try
      {
        let notifyFlags = Components.interfaces.nsIFolderListener.event;
        MailServices.mailSession.AddFolderListener(gFolderListener, notifyFlags);
        gSessionFolderListenerAdded = true;
      }
      catch (ex)
      {
        Components.utils.reportError("Error adding to session: " + ex + "\n");
      }
    }
  }

  var msgWindow = GetFilterEditorMsgWindow();

  if (imapFolder)
    SetBusyCursor(window, true);

  msgFolder.createSubfolder(name, msgWindow);

  if (!imapFolder)
  {
    var curFolder = uri+"/"+encodeURIComponent(name);
    SetFolderPicker(curFolder, gActionTargetElement.id);
  }
}

function UpdateAfterCustomHeaderChange()
{
  updateSearchAttributes();
}

//if you use msgWindow, please make sure that destructor gets called when you close the "window"
function GetFilterEditorMsgWindow()
{
  if (!gFilterEditorMsgWindow)
  {
    var msgWindowContractID = "@mozilla.org/messenger/msgwindow;1";
    var nsIMsgWindow = Components.interfaces.nsIMsgWindow;
    gFilterEditorMsgWindow = Components.classes[msgWindowContractID].createInstance(nsIMsgWindow);
    gFilterEditorMsgWindow.domWindow = window;
    gFilterEditorMsgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;
  }
  return gFilterEditorMsgWindow;
}

function SetBusyCursor(window, enable)
{
  // setCursor() is only available for chrome windows.
  // However one of our frames is the start page which
  // is a non-chrome window, so check if this window has a
  // setCursor method
  if ("setCursor" in window)
  {
    if (enable)
        window.setCursor("wait");
    else
        window.setCursor("auto");
  }
}

function doHelpButton()
{
  openHelp("mail-filters");
}

function getCustomActions()
{
  if (!gCustomActions)
  {
    gCustomActions = [];
    let customActionsEnum = MailServices.filters.getCustomActions();
    while (customActionsEnum.hasMoreElements())
      gCustomActions.push(customActionsEnum.getNext().QueryInterface(
                           Components.interfaces.nsIMsgFilterCustomAction));
  }
}

function updateFilterType()
{
  gFilterType = gFilterTypeSelector.getType();
  setFilterScope(gFilterType, gFilterList);

  // set valid actions
  var ruleActions = gFilterActionList.getElementsByAttribute('class', 'ruleaction');
  for (var i = 0; i < ruleActions.length; i++)
    ruleActions[i].mRuleActionType.hideInvalidActions();
}

// Given a filter type, set the global search scope to the filter scope
function setFilterScope(aFilterType, aFilterList) 
{
  let filterScope = getFilterScope(getScopeFromFilterList(aFilterList),
                                   aFilterType, aFilterList);
  setSearchScope(filterScope);
}

//
// Given the base filter scope for a server, and the filter
// type, return the scope used for filter. This assumes a
// hierarchy of contexts, with incoming the most restrictive,
// followed by manual and post-plugin.
function getFilterScope(aServerFilterScope, aFilterType, aFilterList)
{
  if (aFilterType & nsMsgFilterType.Incoming)
    return aServerFilterScope;

  // Manual or PostPlugin
  // local mail allows body and junk types
  if (aServerFilterScope == nsMsgSearchScope.offlineMailFilter)
    return nsMsgSearchScope.offlineMail;
  // IMAP and NEWS online don't allow body
  return nsMsgSearchScope.onlineManual;
}

/**
 * Re-focus the action that was focused before focus was lost.
 */
function setLastActionFocus() {
  let lastAction = gFilterActionList.getAttribute("focusedAction");
  gFilterActionList.getItemAtIndex(lastAction).mRuleActionType.menulist.focus();
}
