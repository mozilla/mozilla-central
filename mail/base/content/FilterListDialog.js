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
    onFindFilter(false);
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
   var filterList = msgFolder.getEditableFilterList(gFilterListMsgWindow);
   rebuildFilterList(filterList);

   // Select the first item in the list, if there is one.
   var list = document.getElementById("filterList");
   if (list.getRowCount())
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
   updateCountBox();
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
    var row = document.getElementById("filterList").childNodes[aIndex + 1];
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

function currentFilter()
{
    var currentItem = document.getElementById("filterList").selectedItem;
    return currentItem ? currentItem._filter : null;
}

function onEditFilter()
{
  var selectedFilter = currentFilter();
  var args = {filter: selectedFilter, filterList: gCurrentFilterList};

  window.openDialog("chrome://messenger/content/FilterEditor.xul", "FilterEditor", "chrome,modal,titlebar,resizable,centerscreen", args);

  if ("refresh" in args && args.refresh) {
    // reset search if edit was okay (name change might lead to hidden entry!)
    document.getElementById("searchBox").value = "";
    rebuildFilterList(gCurrentFilterList);
  }
}

function onNewFilter(emailAddress)
{
  let list = document.getElementById("filterList");
  let filterNodes = list.childNodes;
  let selectedFilter = currentFilter();
  // if no filter is selected use the first position, starting at 1
  let position = 1;
  if (selectedFilter) {
    // Get the position in the unfiltered list.
    // - this is where the new filter should be inserted!
    rebuildFilterList(gCurrentFilterList);

    // The filterNodes[0] item is the list header, skip it.
    for (let i = 1; i < filterNodes.length; i++) {
      if (filterNodes[i]._filter == selectedFilter) {
        position = i;
        break;
      }
    }
  }
  // The returned position is offset by 1 (due to the list header)
  // compared to filter indexes in gCurrentFilterList.
  let args = {filterList: gCurrentFilterList, filterPosition: position - 1};

  window.openDialog("chrome://messenger/content/FilterEditor.xul", "FilterEditor", "chrome,modal,titlebar,resizable,centerscreen", args);

  if ("refresh" in args && args.refresh) {
    // On success: reset the search box!
    document.getElementById("searchBox").value = "";
    rebuildFilterList(gCurrentFilterList);

    // Select the new filter, it is at the position of previous selection.
    list.clearSelection();
    list.addItemToSelection(list.childNodes[position]);
    updateViewPosition(position);
    updateCountBox();
  }
  else {
    // If no filter created, let's search again.
    onFindFilter(false);
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
  let newSelection = items[0].previousElementSibling;
  if (newSelection == list.childNodes[0])
    newSelection = null;

  // Must reverse the loop, as the items list shrinks when we delete.
  for (let index = items.length - 1; index >= 0; --index) {
    let item = items[index];
    gCurrentFilterList.removeFilter(item._filter);
    document.getElementById("filterList").removeChild(item);
  }

  // Select filter above previously selected if one existed, otherwise the first one.
  if (!newSelection && list.itemCount)
    newSelection = list.childNodes[1];
  if (newSelection) {
    list.addItemToSelection(newSelection);
    updateViewPosition(-1);
  }
  updateCountBox();
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
        rebuildFilterList(gCurrentFilterList);
        onFindFilter(false); // re-filter list
        document.getElementById("reorderTopButton").disabled = true;
      }
      return;
    case msgMoveMotion.Bottom:
      if (activeFilter) {
        gCurrentFilterList.removeFilter(activeFilter);
        gCurrentFilterList.insertFilterAt(gCurrentFilterList.filterCount, activeFilter);
        rebuildFilterList(gCurrentFilterList);
        onFindFilter(false);
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

  var searchBox = document.getElementById("searchBox");
  if (searchBox.value) {
    if (activeFilter) {
      let nextIndex = list.selectedIndex + relativeStep;
      let nextFilter = list.getItemAtIndex(nextIndex)._filter;
      rebuildFilterList(gCurrentFilterList);

      // assumption: item stays selected even after removing the search condition
      let newIndex = list.selectedIndex + relativeStep;
      gCurrentFilterList.removeFilter(activeFilter);

      // insert after/before next visible item
      switch(motion) {
        case msgMoveMotion.Up:
          // go up from selected index until finding the correct filter name
          while (nextFilter.filterName != list.getItemAtIndex(newIndex)._filter.filterName && nextIndex < list.itemCount)
            newIndex--;
          break;
        case msgMoveMotion.Down:
          // go down from selected index until finding the correct filter name
          while (nextFilter.filterName != list.getItemAtIndex(newIndex)._filter.filterName && nextIndex < list.itemCount)
            newIndex++;
          break;
        case msgMoveMotion.Top: break; // obsolete, dealt with above
        case msgMoveMotion.Bottom: break; // obsolete, dealt with above
      }
      gCurrentFilterList.insertFilterAt(newIndex, activeFilter);
      rebuildFilterList(gCurrentFilterList);
      list.selectedIndex = newIndex;
    }
    onFindFilter(false);
  }
  else {
    // use legacy move filter code: up, down; only if searchBox is empty
    moveCurrentFilter(moveFilterNative);
  }
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
    var filter = currentFilter();
    if (!filter)
      return;

    gCurrentFilterList.moveFilter(filter, motion);
    rebuildFilterList(gCurrentFilterList);
}

function rebuildFilterList(aFilterList)
{
  gCurrentFilterList = aFilterList;
  var list = document.getElementById("filterList");

  // Make a note of which filters were previously selected
  var selectedNames = [];
  for (var i = 0; i < list.selectedItems.length; i++)
    selectedNames.push(list.selectedItems[i]._filter.filterName);

  // Save scroll position so we can try to restore it later.
  // Doesn't work when the list is rebuilt after search box condition changed.
  let firstVisibleRowIndex = list.getIndexOfFirstVisibleRow();

  // Remove any existing child nodes, but not our headers
  for (var i = list.childNodes.length - 1; i > 0; i--) {
    list.removeChild(list.childNodes[i]);
  }

  // listbox.xml seems to cache the value of the first selected item in a
  // range at _selectionStart. The old value though is now obsolete,
  // since we will recreate all of the elements. We need to clear this,
  // and one way to do this is with a call to clearSelection. This might be
  // ugly from an accessibility perspective, since it fires an onSelect event.
  list.clearSelection();

  for (i = 0; i < aFilterList.filterCount; i++) {
    var filter = aFilterList.getFilterAt(i);
    var listitem = document.createElement("listitem");
    var nameCell = document.createElement("listcell");
    nameCell.setAttribute("label", filter.filterName);
    var enabledCell = document.createElement("listcell");
    enabledCell.setAttribute("enabled", filter.enabled);
    enabledCell.setAttribute("class", "listcell-iconic");
    listitem.appendChild(nameCell);
    listitem.appendChild(enabledCell);

    // We have to attach this listener to the listitem, even though we only care
    // about clicks on the enabledCell.  However, attaching to that item doesn't
    // result in any events actually getting received
    listitem.addEventListener("click", onFilterClick, true);

    listitem.addEventListener("dblclick", onFilterDoubleClick, true);
    listitem._filter = filter;
    list.appendChild(listitem);

    if (selectedNames.indexOf(filter.filterName) != -1)
      list.addItemToSelection(listitem);
  }
  updateViewPosition(firstVisibleRowIndex);
  updateCountBox();
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
  list.focus();
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
                       list.selectedItems[0] != list.childNodes[1]);
    document.getElementById("reorderUpButton").disabled = upDisabled
    // "down" enabled only if one filter selected, and it's not the last
    var downDisabled = !(oneFilterSelected && list.currentIndex < list.getRowCount()-1);
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
 * Called when the search button is clicked, this will narrow down the amount
 * of filters displayed in the list, using the search term to filter the names
 *
 * @param focusSearchBox  if called from the button click event, return to searchbox
 */
function onFindFilter(focusSearchBox)
{
  let searchBox = document.getElementById("searchBox");
  let filterList = document.getElementById("filterList");
  let keyWord = searchBox.value.toLocaleLowerCase();

  // simplest case: if filter was added or removed and searchbox is empty
  if (!keyWord && !focusSearchBox) {
    updateCountBox();
    return;
  }
  rebuildFilterList(gCurrentFilterList); // creates the unfiltered list
  if (!keyWord) {
    if (focusSearchBox)
      searchBox.focus();
    updateCountBox();
    return;
  }

  // rematch everything in the list, remove what doesn't match the search box
  let rows = filterList.getRowCount();

  for(let i = rows - 1; i >= 0; i--) {
    let matched = true;
    let item = filterList.getItemAtIndex(i);
    let title = item.firstChild.getAttribute("label");
    if (title.toLocaleLowerCase().indexOf(keyWord) == -1)
    {
      matched = false;
      filterList.removeChild(item);
    }
  }
  updateCountBox();
  if (focusSearchBox)
    searchBox.focus();
}

/**
 * Display "1 item",  "11 items" or "4 of 10" if list is filtered via search box.
 */
function updateCountBox()
{
  let countBox = document.getElementById("countBox");
  let sum = gCurrentFilterList.filterCount;
  let filterList = document.getElementById("filterList");
  let len = filterList.getRowCount();

  let bundle = document.getElementById("bundle_filter");

  if (len == sum) // "N items"
    countBox.value = PluralForm.get(len, bundle.getString("filterCountItems"))
                               .replace("#1",[len]);
  else // "N of M"
    countBox.value = bundle.getFormattedString("filterCountVisibleOfTotal", [len, sum]);
}

