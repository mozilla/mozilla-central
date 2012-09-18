/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

var gFilterListMsgWindow = null;
var gCurrentFilterList;
var gCurrentFolder;

const msgMoveMotion = {
  Up     : 0,
  Down   : 1,
  Top    : 2,
  Bottom : 3
}


var gStatusFeedback = {
  progressMeterVisible : false,

  showStatusString: function(status)
  {
    document.getElementById("statusText").setAttribute("value", status);
  },
  startMeteors: function()
  {
    // change run button to be a stop button
    var runButton = document.getElementById("runFiltersButton");
    runButton.setAttribute("label", runButton.getAttribute("stoplabel"));
    runButton.setAttribute("accesskey", runButton.getAttribute("stopaccesskey"));

    if (!this.progressMeterVisible)
    {
      document.getElementById('statusbar-progresspanel').removeAttribute('collapsed');
      this.progressMeterVisible = true;
    }

    document.getElementById("statusbar-icon").setAttribute("mode", "undetermined");
  },
  stopMeteors: function()
  {
    try {
      // change run button to be a stop button
      var runButton = document.getElementById("runFiltersButton");
      runButton.setAttribute("label", runButton.getAttribute("runlabel"));
      runButton.setAttribute("accesskey", runButton.getAttribute("runaccesskey"));

      if (this.progressMeterVisible)
      {
        document.getElementById('statusbar-progresspanel').collapsed = true;
        this.progressMeterVisible = true;
      }
    }
    catch (ex) {
      // can get here if closing window when running filters
    }
  },
  showProgress: function(percentage)
  {
  },
  closeWindow: function()
  {
  }
};

var filterEditorQuitObserver = {
  observe: function(aSubject, aTopic, aData)
  {
    // Check whether or not we want to veto the quit request (unless another
    // observer already did.
    if (aTopic == "quit-application-requested" &&
        (aSubject instanceof Components.interfaces.nsISupportsPRBool) &&
        !aSubject.data)
      aSubject.data = !onFilterClose();
  }
}

function onLoad()
{
    gFilterListMsgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"].createInstance(Components.interfaces.nsIMsgWindow);
    gFilterListMsgWindow.domWindow = window;
    gFilterListMsgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;
    gFilterListMsgWindow.statusFeedback = gStatusFeedback;

    updateButtons();

    // Get the folder where filters should be defined, if that server
    // can accept filters.
    let firstItem = getFilterFolderForSelection();

    // If the selected server cannot have filters, get the default server
    // If the default server cannot have filters, check all accounts
    // and get a server that can have filters.
    if (!firstItem)
        firstItem = getServerThatCanHaveFilters().rootFolder;

    if (firstItem) {
        selectFolder(firstItem);
    }

    Services.obs.addObserver(filterEditorQuitObserver,
                             "quit-application-requested", false);
}

/**
 * Called when a user selects a folder in the list, so we can update the 
 * filters that are displayed
 * note the function name 'onFilterFolderClick' is misleading, it would be
 * better named 'onServerSelect' => file follow up bug later.
 *
 * @param aFolder  the nsIMsgFolder that was selected
 */
function onFilterFolderClick(aFolder)
{
    if (!aFolder || aFolder == gCurrentFolder)
      return;

    // Save the current filters to disk before switching because
    // the dialog may be closed and we'll lose current filters.
    gCurrentFilterList.saveToDefaultFile();

    selectFolder(aFolder);
}

function CanRunFiltersAfterTheFact(aServer)
{
  // filter after the fact is implement using search
  // so if you can't search, you can't filter after the fact
  return aServer.canSearchMessages;
}

// roots the tree at the specified folder
function setFolder(msgFolder)
{
   if (msgFolder == gCurrentFolder)
     return;
   gCurrentFolder = msgFolder;

   //Calling getFilterList will detect any errors in rules.dat, backup the file, and alert the user
   gCurrentFilterList = msgFolder.getEditableFilterList(gFilterListMsgWindow);
   rebuildFilterList();

   // Select the first item in the list, if there is one.
   var list = document.getElementById("filterList");
   if (list.itemCount > 0)
     list.selectItem(list.getItemAtIndex(0));

   // This will get the deferred to account root folder, if server is deferred.
   // We intentionally do this after setting gCurrentFolder, as we want
   // that to refer to the rootFolder for the actual server, not the
   // deferred-to server, as gCurrentFolder is really a proxy for the
   // server whose filters we are editing. But below here we are managing
   // where the filters will get applied, which is on the deferred-to server.
   msgFolder = msgFolder.server.rootMsgFolder;

   // root the folder picker to this server
   var runMenu = document.getElementById("runFiltersPopup");
   runMenu._teardown();
   runMenu._parentFolder = msgFolder;
   runMenu._ensureInitialized();

   // run filters after the fact not supported by news
   if (CanRunFiltersAfterTheFact(msgFolder.server)) {
     document.getElementById("runFiltersFolder").removeAttribute("hidden");
     document.getElementById("runFiltersButton").removeAttribute("hidden");
     document.getElementById("folderPickerPrefix").removeAttribute("hidden");

     // for POP3 and IMAP, select the first folder, which is the INBOX
     document.getElementById("runFiltersFolder").selectedIndex = 0;
     runMenu.selectFolder(getFirstFolder(msgFolder));
   }
   else {
     document.getElementById("runFiltersFolder").setAttribute("hidden", "true");
     document.getElementById("runFiltersButton").setAttribute("hidden", "true");
     document.getElementById("folderPickerPrefix").setAttribute("hidden", "true");
   }

   // Get the first folder for this server. INBOX for
   // imap and pop accts and 1st news group for news.
   updateButtons();
}

function toggleFilter(aFilter, aIndex)
{
    if (aFilter.unparseable)
    {
      var bundle = document.getElementById("bundle_filter");
      var promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
      promptSvc.alert(window, null, bundle.getString("cannotEnableFilter"));
      return;
    }
    aFilter.enabled = !aFilter.enabled;

    // Now update the appropriate row
    let row = document.getElementById("filterList").getItemAtIndex(aIndex);
    row.childNodes[1].setAttribute("enabled", aFilter.enabled);
}

// sets up the menulist and the filter list
function selectFolder(aFolder)
{
    // update the server menu
    var serverMenu = document.getElementById("serverMenuPopup");
    serverMenu.selectFolder(aFolder);

    setFolder(aFolder);
}

/**
 * Returns the currently selected filter. If multiple filters are selected,
 * returns the first one. If none are selected, returns null.
 */
function currentFilter()
{
    let currentItem = document.getElementById("filterList").selectedItem;
    return currentItem ? currentItem._filter : null;
}

function onEditFilter()
{
  let selectedFilter = currentFilter();
  if (!selectedFilter)
    return;

  let args = {filter: selectedFilter, filterList: gCurrentFilterList};

  window.openDialog("chrome://messenger/content/FilterEditor.xul", "FilterEditor", "chrome,modal,titlebar,resizable,centerscreen", args);

  if ("refresh" in args && args.refresh) {
    // reset search if edit was okay (name change might lead to hidden entry!)
    resetSearchBox(selectedFilter);
    rebuildFilterList();
  }
}

function onNewFilter(emailAddress)
{
  let list = document.getElementById("filterList");
  let selectedFilter = currentFilter();
  // If no filter is selected use the first position.
  let position = 0;
  if (selectedFilter) {
    // Get the position in the unfiltered list.
    // - this is where the new filter should be inserted!
    let filterCount = gCurrentFilterList.filterCount;
    for (let i = 0; i < filterCount; i++) {
      if (gCurrentFilterList.getFilterAt(i) == selectedFilter) {
        position = i;
        break;
      }
    }
  }

  let args = {filterList: gCurrentFilterList, filterPosition: position};

  window.openDialog("chrome://messenger/content/FilterEditor.xul", "FilterEditor", "chrome,modal,titlebar,resizable,centerscreen", args);

  if ("refresh" in args && args.refresh) {
    // On success: reset the search box if necessary!
    resetSearchBox(gCurrentFilterList.getFilterAt(position));
    rebuildFilterList();

    // Select the new filter, it is at the position of previous selection.
    list.selectItem(list.getItemAtIndex(position));
  }
}

/**
 * Delete selected filters.
 *  'Selected' is not to be confused with active (checkbox checked)
 */
function onDeleteFilter()
{
  let list = document.getElementById("filterList");
  let items = list.selectedItems;
  if (!items.length)
    return;

  let checkValue = {value:false};
  let prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService)
                             .getBranch(null);
  let bundle = document.getElementById("bundle_filter");
  let promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Components.interfaces.nsIPromptService);
  if ((prefBranch.getBoolPref("mailnews.filters.confirm_delete")) &&
      (promptSvc.confirmEx(window, null,
                           bundle.getString("deleteFilterConfirmation"),
                           promptSvc.STD_YES_NO_BUTTONS,
                           '', '', '',
                           bundle.getString('dontWarnAboutDeleteCheckbox'),
                           checkValue)))
    return;

  if (checkValue.value)
     prefBranch.setBoolPref("mailnews.filters.confirm_delete", false);

  // Save filter position before the first selected one.
  let newSelectionIndex = list.selectedIndex - 1;

  // Must reverse the loop, as the items list shrinks when we delete.
  for (let index = items.length - 1; index >= 0; --index) {
    let item = items[index];
    gCurrentFilterList.removeFilter(item._filter);
    document.getElementById("filterList").removeChild(item);
  }
  updateCountBox();

  // Select filter above previously selected if one existed, otherwise the first one.
  if (newSelectionIndex == -1 && list.itemCount > 0)
    newSelectionIndex = 0;
  if (newSelectionIndex > -1) {
    list.selectedIndex = newSelectionIndex;
    updateViewPosition(-1);
  }
}

/**
 * Move filter one step up in visible list.
 */
function onUp(event) {
  moveFilter(msgMoveMotion.Up);
}

/**
 * Move filter one step down in visible list.
 */
function onDown(event) {
  moveFilter(msgMoveMotion.Down);
}

/**
 * Move filter to bottom for long filter lists.
 */
 function onTop(evt) {
  moveFilter(msgMoveMotion.Top);
}

/**
 * Move filter to top for long filter lists.
 */
function onBottom(evt) {
  moveFilter(msgMoveMotion.Bottom);
}

/**
 * Moves a singular selected filter up or down either 1 increment or to the 
 * top/bottom. This acts on the visible filter list only which means that:
 *
 * - when moving up or down "1" the filter may skip one or more other
 *   filters (which are currently not visible) - this will also lead
 *   to the "related" filters (e.g search filters containing 'moz')
 *   being grouped more closely together
 * - moveTop / moveBottom
 *   this is currently moving to the top/bottom of the absolute list
 *   but it would be better if it moved "just as far as necessary"
 *   which would further "compact" related filters
 *
 * @param motion
 *   msgMoveMotion.Up, msgMoveMotion.Down, msgMoveMotion.Top, msgMoveMotion.Bottom
 */
function moveFilter(motion) {
  // At the moment, do not allow moving groups of filters.
  var list = document.getElementById("filterList");
  if (list.selectedItems.length != 1)
    return;
  var activeFilter = list.selectedItems[0]._filter;
  var relativeStep = 0;
  var moveFilterNative = null;

  switch(motion) {
    case msgMoveMotion.Top:
      if (activeFilter) {
        gCurrentFilterList.removeFilter(activeFilter);
        gCurrentFilterList.insertFilterAt(0, activeFilter);
        rebuildFilterList();
        document.getElementById("reorderTopButton").disabled = true;
      }
      return;
    case msgMoveMotion.Bottom:
      if (activeFilter) {
        gCurrentFilterList.removeFilter(activeFilter);
        gCurrentFilterList.insertFilterAt(gCurrentFilterList.filterCount, activeFilter);
        rebuildFilterList();
        document.getElementById("reorderBottomButton").disabled = true;
      }
      return;
    case msgMoveMotion.Up:
      relativeStep = -1;
      moveFilterNative = Components.interfaces.nsMsgFilterMotion.up;
      break;
    case msgMoveMotion.Down:
      relativeStep = +1;
      moveFilterNative = Components.interfaces.nsMsgFilterMotion.down;
      break;
  }

  if (!document.getElementById("searchBox").value) {
    // use legacy move filter code: up, down; only if searchBox is empty
    moveCurrentFilter(moveFilterNative);
    return;
  }

  let nextIndex = list.selectedIndex + relativeStep;
  let nextFilter = list.getItemAtIndex(nextIndex)._filter;

  gCurrentFilterList.removeFilter(activeFilter);

  // Find the index of the filter we want to insert at.
  let newIndex = -1;
  let filterCount = gCurrentFilterList.filterCount;
  for (let i = 0; i < filterCount; i++) {
    if (gCurrentFilterList.getFilterAt(i) == nextFilter) {
      newIndex = i;
      break;
    }
  }

  if (motion == msgMoveMotion.Down)
    newIndex += relativeStep;

  gCurrentFilterList.insertFilterAt(newIndex, activeFilter);

  rebuildFilterList();
}

function viewLog()
{
  var args = {filterList: gCurrentFilterList};

  window.openDialog("chrome://messenger/content/viewLog.xul", "FilterLog", "chrome,modal,titlebar,resizable,centerscreen", args);
}

function onFilterUnload()
{
  gCurrentFilterList.saveToDefaultFile();
  Services.obs.removeObserver(filterEditorQuitObserver,
                              "quit-application-requested");
}

function onFilterClose()
{
  var runButton = document.getElementById("runFiltersButton");
  if (runButton.getAttribute("label") == runButton.getAttribute("stoplabel")) {
    var bundle = document.getElementById("bundle_filter");
    var promptTitle = bundle.getString("promptTitle");
    var promptMsg = bundle.getString("promptMsg");
    var stopButtonLabel = bundle.getString("stopButtonLabel");
    var continueButtonLabel = bundle.getString("continueButtonLabel");

    var promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Components.interfaces.nsIPromptService);
    var result = promptSvc.confirmEx(window, promptTitle, promptMsg,
               (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_0) +
               (promptSvc.BUTTON_TITLE_IS_STRING * promptSvc.BUTTON_POS_1),
               continueButtonLabel, stopButtonLabel, null, null, {value:0});

    if (result)
      gFilterListMsgWindow.StopUrls();
    else
      return false;
  }

  return true;
}

function runSelectedFilters()
{
  // if run button has "stop" label, do stop.
  var runButton = document.getElementById("runFiltersButton");
  if (runButton.getAttribute("label") == runButton.getAttribute("stoplabel")) {
    gFilterListMsgWindow.StopUrls();
    return;
  }

  var menu = document.getElementById("runFiltersFolder");
  var folder = menu._folder || menu.selectedItem._folder;

  var filterService = Components.classes["@mozilla.org/messenger/services/filters;1"].getService(Components.interfaces.nsIMsgFilterService);
  var filterList = filterService.getTempFilterList(folder);
  var folders = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  folders.AppendElement(folder);

  // make sure the tmp filter list uses the real filter list log stream
  filterList.logStream = gCurrentFilterList.logStream;
  filterList.loggingEnabled = gCurrentFilterList.loggingEnabled;

  var list = document.getElementById("filterList");
  var index = 0;
  for each (var item in list.selectedItems) {
    filterList.insertFilterAt(index++, item._filter);
  }

  filterService.applyFiltersToFolders(filterList, folders, gFilterListMsgWindow);
}

function moveCurrentFilter(motion)
{
  let filter = currentFilter();
  if (!filter)
    return;

  gCurrentFilterList.moveFilter(filter, motion);
  rebuildFilterList();
}

/**
 * Redraws the list of filters. Takes the search box value into account.
 *
 * This function should perform very fast even in case of high number of filters.
 * Therefore there are some optimizations (e.g. listelement.children[] instead of
 * list.getItemAtIndex()), that favour speed vs. semantical perfection.
 */
function rebuildFilterList()
{
  // Get filters that match the search box.
  let aTempFilterList = onFindFilter();

  let searchBox = document.getElementById("searchBox");
  let searchBoxFocus = false;
  let activeElement = document.activeElement;

  // Find if the currently focused element is a child inside the search box
  // (probably html:input). Traverse up the parents until the first element
  // with an ID is found. If it is not searchBox, return false.
  while (activeElement != null) {
    if (activeElement == searchBox) {
      searchBoxFocus = true;
      break;
    }
    else if (activeElement.id) {
      searchBoxFocus = false;
      break;
    }
    activeElement = activeElement.parentNode;
  }

  let list = document.getElementById("filterList");
  // Make a note of which filters were previously selected
  let selectedNames = [];
  for (let i = 0; i < list.selectedItems.length; i++)
    selectedNames.push(list.selectedItems[i]._filter.filterName);

  // Save scroll position so we can try to restore it later.
  // Doesn't work when the list is rebuilt after search box condition changed.
  let firstVisibleRowIndex = list.getIndexOfFirstVisibleRow();

  // listbox.xml seems to cache the value of the first selected item in a
  // range at _selectionStart. The old value though is now obsolete,
  // since we will recreate all of the elements. We need to clear this,
  // and one way to do this is with a call to clearSelection. This might be
  // ugly from an accessibility perspective, since it fires an onSelect event.
  list.clearSelection();

  let listitem, nameCell, enabledCell, filter;
  let filterCount = gCurrentFilterList.filterCount;
  let listitemCount = list.itemCount;
  let listitemIndex = 0;
  let tempFilterListLength = aTempFilterList ? aTempFilterList.length - 1 : 0;
  for (let i = 0; i < filterCount; i++) {
    if (aTempFilterList && listitemIndex > tempFilterListLength)
      break;

    filter = gCurrentFilterList.getFilterAt(i);
    if (aTempFilterList && aTempFilterList[listitemIndex] != i)
      continue;

    if (listitemCount > listitemIndex) {
      // If there is a free existing listitem, reuse it.
      // Use .children[] instead of .getItemAtIndex() as it is much faster.
      listitem = list.children[listitemIndex + 1];
      nameCell = listitem.childNodes[0];
      enabledCell = listitem.childNodes[1];
    }
    else
    {
      // If there are not enough listitems in the list, create a new one.
      listitem = document.createElement("listitem");
      nameCell = document.createElement("listcell");
      enabledCell = document.createElement("listcell");
      enabledCell.setAttribute("class", "listcell-iconic");
      listitem.appendChild(nameCell);
      listitem.appendChild(enabledCell);
      list.appendChild(listitem);
      // We have to attach this listener to the listitem, even though we only care
      // about clicks on the enabledCell. However, attaching to that item doesn't
      // result in any events actually getting received.
      listitem.addEventListener("click", onFilterClick, true);
      listitem.addEventListener("dblclick", onFilterDoubleClick, true);
    }
    // Set the listitem values to represent the current filter.
    nameCell.setAttribute("label", filter.filterName);
    enabledCell.setAttribute("enabled", filter.enabled);
    listitem._filter = filter;

    if (selectedNames.indexOf(filter.filterName) != -1)
      list.addItemToSelection(listitem);

    listitemIndex++;
  }
  // Remove any superfluous listitems, if the number of filters shrunk.
  for (let i = listitemCount - 1; i >= listitemIndex; i--) {
    list.removeChild(list.lastChild);
  }

  updateViewPosition(firstVisibleRowIndex);
  updateCountBox();

  // If before rebuilding the list the searchbox was focused, focus it again.
  // In any other case, focus the list.
  if (searchBoxFocus)
    searchBox.focus();
  else
    list.focus();
}

function updateViewPosition(firstVisibleRowIndex)
{
  let list = document.getElementById("filterList");
  if (firstVisibleRowIndex == -1)
    firstVisibleRowIndex = list.getIndexOfFirstVisibleRow();

  // Restore to the extent possible the scroll position.
  if (firstVisibleRowIndex && list.itemCount)
    list.scrollToIndex(Math.min(firstVisibleRowIndex, list.itemCount - 1));

  if (list.selectedCount) {
    // Make sure that at least the first selected item is visible.
    list.ensureElementIsVisible(list.selectedItems[0]);

    // The current item should be the first selected item, so that keyboard
    // selection extension can work.
    list.currentItem = list.selectedItems[0];
  }

  updateButtons();
}

/**
 * Try to only enable buttons that make sense
 *  - moving filters is currently only enabled for single selection
 *    also movement is restricted by searchBox and current selection position
 *  - edit only for single filters
 *  - delete / run only for one or more selected filters
 */
function updateButtons()
{
    var list = document.getElementById("filterList");
    var numFiltersSelected = list.selectedItems.length;
    var oneFilterSelected = (numFiltersSelected == 1);

    var filter = currentFilter();
    // "edit" only enabled when one filter selected or if we couldn't parse the filter
    var disabled = !oneFilterSelected || filter.unparseable
    document.getElementById("editButton").disabled = disabled;

    // "delete" only disabled when no filters are selected
    document.getElementById("deleteButton").disabled = !numFiltersSelected;

    // we can run multiple filters on a folder
    // so only disable this UI if no filters are selected
    document.getElementById("folderPickerPrefix").disabled = !numFiltersSelected;
    document.getElementById("runFiltersFolder").disabled = !numFiltersSelected;
    document.getElementById("runFiltersButton").disabled = !numFiltersSelected;

    // "up" enabled only if one filter selected, and it's not the first
    // don't use list.currentIndex here, it's buggy when we've just changed the
    // children in the list (via rebuildFilterList)
    var upDisabled = !(oneFilterSelected &&
                       list.getSelectedItem(0) != list.getItemAtIndex(0));
    document.getElementById("reorderUpButton").disabled = upDisabled
    // "down" enabled only if one filter selected, and it's not the last
    var downDisabled = !(oneFilterSelected && list.selectedIndex < list.itemCount - 1);
    document.getElementById("reorderDownButton").disabled = downDisabled;

    // special buttons
    var buttonTop = document.getElementById("reorderTopButton");
    var buttonBottom = document.getElementById("reorderBottomButton");

    buttonTop.disabled = upDisabled;
    buttonBottom.disabled = downDisabled;
}

/**
 * Given a selected folder, returns the folder where filters should
 *  be defined (the root folder except for news) if the server can
 *  accept filters.
 *
 * @returns an nsIMsgFolder where the filter is defined
 */
function getFilterFolderForSelection()
{
    var args = window.arguments;

    if (args && args[0] && args[0].folder)
    {
        var selectedFolder = args[0].folder;
        var msgFolder = selectedFolder.QueryInterface(Components.interfaces.nsIMsgFolder);
        try
        {
            var rootFolder = msgFolder.server.rootFolder;
            if (rootFolder.isServer)
            {
                var server = rootFolder.server;
                if (server.canHaveFilters)
                    return (server.type == "nntp") ? msgFolder : rootFolder;
            }
        }
        catch (ex)
        {
        }
    }

    return null;
}

/**
 * If the selected server cannot have filters, get the default server.
 * If the default server cannot have filters, check all accounts
 * and get a server that can have filters.
 *
 * @returns an nsIMsgIncomingServer
 */
function getServerThatCanHaveFilters()
{
    var firstItem = null;

    var accountManager
        = Components.classes["@mozilla.org/messenger/account-manager;1"].
            getService(Components.interfaces.nsIMsgAccountManager);

    var defaultAccount = accountManager.defaultAccount;
    var defaultIncomingServer = defaultAccount.incomingServer;

    // check to see if default server can have filters
    if (defaultIncomingServer.canHaveFilters) {
        firstItem = defaultIncomingServer;
    }
    // if it cannot, check all accounts to find a server
    // that can have filters
    else
    {
        var allServers = accountManager.allServers;
        var numServers = allServers.Count();
        var index = 0;
        for (index = 0; index < numServers; index++)
        {
            var currentServer
            = allServers.GetElementAt(index).QueryInterface(Components.interfaces.nsIMsgIncomingServer);

            if (currentServer.canHaveFilters)
            {
                firstItem = currentServer;
                break;
            }
        }
    }

    return firstItem;
}

function onFilterClick(event)
{
    // we only care about button 0 (left click) events
    if (event.button != 0)
      return;

    // Remember, we had to attach the click-listener to the whole listitem, so
    // now we need to see if the clicked the enable-column
    var toggle = event.target.childNodes[1];
    if ((event.clientX < toggle.boxObject.x + toggle.boxObject.width) &&
        (event.clientX > toggle.boxObject.x)) {
      var list = document.getElementById("filterList");
      toggleFilter(event.target._filter, list.getIndexOfItem(event.target));
      event.stopPropagation();
    }
}

function onFilterDoubleClick(event)
{
    // we only care about button 0 (left click) events
    if (event.button != 0)
      return;

    onEditFilter();
}

function onFilterListKeyPress(event)
{
  if (event.charCode == KeyEvent.DOM_VK_SPACE)
  {
    let list = document.getElementById("filterList");
    for each (var item in list.selectedItems)
      toggleFilter(item._filter, list.getIndexOfItem(item));
  }
  else switch (event.keyCode)
  {
    case KeyEvent.DOM_VK_DELETE:
      if (!document.getElementById("deleteButton").disabled)
        onDeleteFilter();
      break;
    case KeyEvent.DOM_VK_ENTER:
    case KeyEvent.DOM_VK_RETURN:
      if (!document.getElementById("editButton").disabled)
        onEditFilter();
      break;
  }
}

function onTargetSelect(event) {
  var menu = document.getElementById("runFiltersFolder");
  menu._folder = event.target._folder;
  menu.setAttribute("label", event.target._folder.prettyName);
}

/**
 * For a given server folder, get the first folder. For imap and pop it's INBOX
 * and it's the very first group for news accounts.
 */
function getFirstFolder(msgFolder)
{
  // Sanity check.
  if (! msgFolder.isServer)
    return msgFolder;

  try {
    // Find Inbox for imap and pop
    if (msgFolder.server.type != "nntp")
    {
      const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
      var inboxFolder = msgFolder.getFolderWithFlags(nsMsgFolderFlags.Inbox);
      if (inboxFolder)
        return inboxFolder;
      else
        // If inbox does not exist then use the server as default.
        return msgFolder;
    }
    else
      // XXX TODO: For news, we should find the 1st group/folder off the news groups. For now use server.
      return msgFolder;
  }
  catch (ex) {
    dump(ex + "\n");
  }
  return msgFolder;
}

/**
 * Decides if the given filter matches the given keyword.
 *
 * @param  aFilter   nsIMsgFilter to check
 * @param  aKeyword  the string to find in the filter name
 *
 * @return  True if the filter name contains the searched keyword.
            Otherwise false. In the future this may be extended to match
            other filter attributes.
 */
function filterSearchMatch(aFilter, aKeyword)
{
  return (aFilter.filterName.toLocaleLowerCase().indexOf(aKeyword) != -1)
}

/**
 * Called from rebuildFilterList when the list needs to be redrawn.
 * @return  Uses the search term in search box, to produce an array of
 *          row (filter) numbers (indexes) that match the search term.
 */
function onFindFilter()
{
  let searchBox = document.getElementById("searchBox");
  let keyWord = searchBox.value.toLocaleLowerCase();

  // If searchbox is empty, just return and let rebuildFilterList
  // create an unfiltered list.
  if (!keyWord)
    return null;

  // Rematch everything in the list, remove what doesn't match the search box.
  let rows = gCurrentFilterList.filterCount;
  let matchingFilterList = [];
  // Use the full gCurrentFilterList, not the filterList listbox,
  // which may already be filtered.
  for (let i = 0; i < rows; i++) {
    if (filterSearchMatch(gCurrentFilterList.getFilterAt(i), keyWord))
      matchingFilterList.push(i);
  }

  return matchingFilterList;
}

/**
 * Clear the search term in the search box if needed.
 *
 * @param aFilter  If this nsIMsgFilter matches the search term,
 *                 do not reset the box. If this is null,
 *                 reset unconditionally.
 */
function resetSearchBox(aFilter)
{
  let searchBox = document.getElementById("searchBox");
  let keyword = searchBox.value.toLocaleLowerCase();
  if (keyword && (!aFilter || !filterSearchMatch(aFilter, keyword)))
    searchBox.reset();
}

/**
 * Display "1 item",  "11 items" or "4 of 10" if list is filtered via search box.
 */
function updateCountBox()
{
  let countBox = document.getElementById("countBox");
  let sum = gCurrentFilterList.filterCount;
  let filterList = document.getElementById("filterList");
  let len = filterList.itemCount;

  let bundle = document.getElementById("bundle_filter");

  if (len == sum) // "N items"
    countBox.value = PluralForm.get(len, bundle.getString("filterCountItems"))
                               .replace("#1",[len]);
  else // "N of M"
    countBox.value = bundle.getFormattedString("filterCountVisibleOfTotal", [len, sum]);
}
