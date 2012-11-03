/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

let gFilterListMsgWindow = null;
let gCurrentFilterList;
let gCurrentFolder;

let gFilterListbox = null;
let gEditButton = null;
let gDeleteButton = null;
let gTopButton = null;
let gUpButton = null;
let gDownButton = null;
let gBottomButton = null;
let gSearchBox = null;
let gRunFiltersFolder = null;
let gRunFiltersButton = null;

let gFilterBundle = null;

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
    gRunFiltersButton.setAttribute("label", gRunFiltersButton.getAttribute("stoplabel"));
    gRunFiltersButton.setAttribute("accesskey", gRunFiltersButton.getAttribute("stopaccesskey"));

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
      gRunFiltersButton.setAttribute("label", gRunFiltersButton.getAttribute("runlabel"));
      gRunFiltersButton.setAttribute("accesskey", gRunFiltersButton.getAttribute("runaccesskey"));

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
    gFilterListMsgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                                     .createInstance(Components.interfaces.nsIMsgWindow);
    gFilterListMsgWindow.domWindow = window;
    gFilterListMsgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;
    gFilterListMsgWindow.statusFeedback = gStatusFeedback;

    gFilterListbox    = document.getElementById("filterList");
    gEditButton       = document.getElementById("editButton");
    gDeleteButton     = document.getElementById("deleteButton");
    gTopButton        = document.getElementById("reorderTopButton");
    gUpButton         = document.getElementById("reorderUpButton");
    gDownButton       = document.getElementById("reorderDownButton");
    gBottomButton     = document.getElementById("reorderBottomButton");
    gSearchBox        = document.getElementById("searchBox");
    gRunFiltersFolder = document.getElementById("runFiltersFolder");
    gRunFiltersButton = document.getElementById("runFiltersButton");
    gFilterBundle     = document.getElementById("bundle_filter");

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
 * This is called from OpenOrFocusWindow() if the dialog is already open.
 * New filters could have been created by operations outside the dialog.
 */
function refresh()
{
  // As we really don't know what has changed, clear the search box
  // undonditionally so that the changed/added filters are surely visible.
  resetSearchBox();

  // And just redraw the list.
  rebuildFilterList();
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

   // Calling getFilterList will detect any errors in rules.dat,
   // backup the file, and alert the user.
   gCurrentFilterList = msgFolder.getEditableFilterList(gFilterListMsgWindow);
   rebuildFilterList();

   // Select the first item in the list, if there is one.
   if (gFilterListbox.itemCount > 0)
     gFilterListbox.selectItem(gFilterListbox.getItemAtIndex(0));

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

   let canFilterAfterTheFact = CanRunFiltersAfterTheFact(msgFolder.server);
   gRunFiltersFolder.hidden = !canFilterAfterTheFact;
   gRunFiltersButton.hidden = !canFilterAfterTheFact;
   document.getElementById("folderPickerPrefix").hidden = !canFilterAfterTheFact;

   if (canFilterAfterTheFact) {
     // Get the first folder for this server. INBOX for
     // IMAP and POP3 accounts and 1st news group for news.
     gRunFiltersFolder.selectedIndex = 0;
     runMenu.selectFolder(getFirstFolder(msgFolder));
   }
}

/**
 * Toggle enabled state of a filter, in both the filter properties and the UI.
 *
 * @param aFilterItem  an item (row) of the filter list to be toggled
 */
function toggleFilter(aFilterItem)
{
  let filter = aFilterItem._filter;
  if (filter.unparseable && !filter.enabled)
  {
    Services.prompt.alert(window, null, gFilterBundle.getString("cannotEnableFilter"));
    return;
  }
  filter.enabled = !filter.enabled;

  // Now update the checkbox
  aFilterItem.childNodes[1].setAttribute("enabled", filter.enabled);
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
  let currentItem = gFilterListbox.selectedItem;
  return currentItem ? currentItem._filter : null;
}

function onEditFilter()
{
  if (gEditButton.disabled)
    return;

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
    gFilterListbox.selectItem(gFilterListbox.getItemAtIndex(position));
  }
}

/**
 * Delete selected filters.
 *  'Selected' is not to be confused with active (checkbox checked)
 */
function onDeleteFilter()
{
  if (gDeleteButton.disabled)
    return;

  let items = gFilterListbox.selectedItems;
  if (!items.length)
    return;

  let checkValue = {value:false};
  if ((Services.prefs.getBoolPref("mailnews.filters.confirm_delete")) &&
      (Services.prompt.confirmEx(window, null,
                                 gFilterBundle.getString("deleteFilterConfirmation"),
                                 Services.prompt.STD_YES_NO_BUTTONS,
                                 '', '', '',
                                 gFilterBundle.getString('dontWarnAboutDeleteCheckbox'),
                                 checkValue)))
    return;

  if (checkValue.value)
     Services.prefs.setBoolPref("mailnews.filters.confirm_delete", false);

  // Save filter position before the first selected one.
  let newSelectionIndex = gFilterListbox.selectedIndex - 1;

  // Must reverse the loop, as the items list shrinks when we delete.
  for (let index = items.length - 1; index >= 0; --index) {
    let item = items[index];
    gCurrentFilterList.removeFilter(item._filter);
    gFilterListbox.removeItemAt(gFilterListbox.getIndexOfItem(item));
  }
  updateCountBox();

  // Select filter above previously selected if one existed, otherwise the first one.
  if (newSelectionIndex == -1 && gFilterListbox.itemCount > 0)
    newSelectionIndex = 0;
  if (newSelectionIndex > -1) {
    gFilterListbox.selectedIndex = newSelectionIndex;
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
  let selectedFilter = currentFilter();
  if (!selectedFilter)
    return;

  var relativeStep = 0;
  var moveFilterNative = null;

  switch(motion) {
    case msgMoveMotion.Top:
      if (selectedFilter) {
        gCurrentFilterList.removeFilter(selectedFilter);
        gCurrentFilterList.insertFilterAt(0, selectedFilter);
        rebuildFilterList();
      }
      return;
    case msgMoveMotion.Bottom:
      if (selectedFilter) {
        gCurrentFilterList.removeFilter(selectedFilter);
        gCurrentFilterList.insertFilterAt(gCurrentFilterList.filterCount, selectedFilter);
        rebuildFilterList();
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

  if (!gSearchBox.value) {
    // use legacy move filter code: up, down; only if searchBox is empty
    moveCurrentFilter(moveFilterNative);
    return;
  }

  let nextIndex = gFilterListbox.selectedIndex + relativeStep;
  let nextFilter = gFilterListbox.getItemAtIndex(nextIndex)._filter;

  gCurrentFilterList.removeFilter(selectedFilter);

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

  gCurrentFilterList.insertFilterAt(newIndex, selectedFilter);

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
  if (gRunFiltersButton.getAttribute("label") ==
      gRunFiltersButton.getAttribute("stoplabel")) {
    let promptTitle = gFilterBundle.getString("promptTitle");
    let promptMsg = gFilterBundle.getString("promptMsg");
    let stopButtonLabel = gFilterBundle.getString("stopButtonLabel");
    let continueButtonLabel = gFilterBundle.getString("continueButtonLabel");

    let result = Services.prompt.confirmEx(window, promptTitle, promptMsg,
               (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
               (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
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
  if (gRunFiltersButton.getAttribute("label") ==
      gRunFiltersButton.getAttribute("stoplabel")) {
    gFilterListMsgWindow.StopUrls();
    return;
  }

  var folder = gRunFiltersFolder._folder || gRunFiltersFolder.selectedItem._folder;

  let filterList = MailServices.filters.getTempFilterList(folder);
  let folders = Components.classes["@mozilla.org/supports-array;1"]
                          .createInstance(Components.interfaces.nsISupportsArray);
  folders.AppendElement(folder);

  // make sure the tmp filter list uses the real filter list log stream
  filterList.logStream = gCurrentFilterList.logStream;
  filterList.loggingEnabled = gCurrentFilterList.loggingEnabled;

  let index = 0;
  for each (let item in gFilterListbox.selectedItems) {
    filterList.insertFilterAt(index++, item._filter);
  }

  MailServices.filters.applyFiltersToFolders(filterList, folders, gFilterListMsgWindow);
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

  let searchBoxFocus = false;
  let activeElement = document.activeElement;

  // Find if the currently focused element is a child inside the search box
  // (probably html:input). Traverse up the parents until the first element
  // with an ID is found. If it is not searchBox, return false.
  while (activeElement != null) {
    if (activeElement == gSearchBox) {
      searchBoxFocus = true;
      break;
    }
    else if (activeElement.id) {
      searchBoxFocus = false;
      break;
    }
    activeElement = activeElement.parentNode;
  }

  // Make a note of which filters were previously selected
  let selectedNames = [];
  for (let i = 0; i < gFilterListbox.selectedItems.length; i++)
    selectedNames.push(gFilterListbox.selectedItems[i]._filter.filterName);

  // Save scroll position so we can try to restore it later.
  // Doesn't work when the list is rebuilt after search box condition changed.
  let firstVisibleRowIndex = gFilterListbox.getIndexOfFirstVisibleRow();

  // listbox.xml seems to cache the value of the first selected item in a
  // range at _selectionStart. The old value though is now obsolete,
  // since we will recreate all of the elements. We need to clear this,
  // and one way to do this is with a call to clearSelection. This might be
  // ugly from an accessibility perspective, since it fires an onSelect event.
  gFilterListbox.clearSelection();

  let listitem, nameCell, enabledCell, filter;
  let filterCount = gCurrentFilterList.filterCount;
  let listitemCount = gFilterListbox.itemCount;
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
      listitem = gFilterListbox.children[listitemIndex + 1];
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
      gFilterListbox.appendChild(listitem);
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
      gFilterListbox.addItemToSelection(listitem);

    listitemIndex++;
  }
  // Remove any superfluous listitems, if the number of filters shrunk.
  for (let i = listitemCount - 1; i >= listitemIndex; i--) {
    gFilterListbox.removeChild(gFilterListbox.lastChild);
  }

  updateViewPosition(firstVisibleRowIndex);
  updateCountBox();

  // If before rebuilding the list the searchbox was focused, focus it again.
  // In any other case, focus the list.
  if (searchBoxFocus)
    gSearchBox.focus();
  else
    gFilterListbox.focus();
}

function updateViewPosition(firstVisibleRowIndex)
{
  if (firstVisibleRowIndex == -1)
    firstVisibleRowIndex = gFilterListbox.getIndexOfFirstVisibleRow();

  // Restore to the extent possible the scroll position.
  if (firstVisibleRowIndex && gFilterListbox.itemCount)
    gFilterListbox.scrollToIndex(Math.min(firstVisibleRowIndex,
                                          gFilterListbox.itemCount - 1));

  if (gFilterListbox.selectedCount) {
    // Make sure that at least the first selected item is visible.
    gFilterListbox.ensureElementIsVisible(gFilterListbox.selectedItems[0]);

    // The current item should be the first selected item, so that keyboard
    // selection extension can work.
    gFilterListbox.currentItem = gFilterListbox.selectedItems[0];
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
    var numFiltersSelected = gFilterListbox.selectedItems.length;
    var oneFilterSelected = (numFiltersSelected == 1);

    // "edit" is disabled when not exactly one filter is selected
    // or if we couldn't parse that filter
    let disabled = !oneFilterSelected || currentFilter().unparseable;
    gEditButton.disabled = disabled;

    // "delete" only disabled when no filters are selected
    gDeleteButton.disabled = !numFiltersSelected;

    // we can run multiple filters on a folder
    // so only disable this UI if no filters are selected
    document.getElementById("folderPickerPrefix").disabled = !numFiltersSelected;
    gRunFiltersFolder.disabled = !numFiltersSelected;
    gRunFiltersButton.disabled = !numFiltersSelected;
    // "up" and "top" enabled only if one filter is selected, and it's not the first
    // don't use gFilterListbox.currentIndex here, it's buggy when we've just changed the
    // children in the list (via rebuildFilterList)
    disabled = !(oneFilterSelected &&
                 gFilterListbox.getSelectedItem(0) != gFilterListbox.getItemAtIndex(0));
    gUpButton.disabled = disabled;
    gTopButton.disabled = disabled;

    // "down" and "bottom" enabled only if one filter is selected,
    // and it's not the last one
    disabled = !(oneFilterSelected && gFilterListbox.selectedIndex < gFilterListbox.itemCount - 1);
    gDownButton.disabled = disabled;
    gBottomButton.disabled = disabled;
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
    let defaultIncomingServer = MailServices.accounts.defaultAccount.incomingServer;
    // Check to see if default server can have filters.
    if (defaultIncomingServer.canHaveFilters)
      return defaultIncomingServer;

    // If it cannot, check all accounts to find a server
    // that can have filters.
    let allServers = MailServices.accounts.allServers;
    for each (currentServer in fixIterator(allServers,
                                           Components.interfaces.nsIMsgIncomingServer))
    {
      if (currentServer.canHaveFilters)
        return currentServer;
    }

    return null;
}

function onFilterClick(event)
{
    // we only care about button 0 (left click) events
    if (event.button != 0)
      return;

    // Remember, we had to attach the click-listener to the whole listitem, so
    // now we need to see if the clicked the enable-column
    let toggle = event.target.childNodes[1];
    if ((event.clientX < toggle.boxObject.x + toggle.boxObject.width) &&
        (event.clientX > toggle.boxObject.x)) {
      toggleFilter(event.target);
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

function onFilterListKeyPress(aEvent)
{
  if (aEvent.keyCode) {
    switch (aEvent.keyCode) {
      case KeyEvent.DOM_VK_INSERT:
        if (!document.getElementById("newButton").disabled)
          onNewFilter();
        break;
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
  else if (!aEvent.ctrlKey && !aEvent.altKey && !aEvent.metaKey) {
    switch (aEvent.charCode) {
      case KeyEvent.DOM_VK_SPACE:
        for each (let item in gFilterListbox.selectedItems) {
          toggleFilter(item);
        }
        break;
      default:
        gSearchBox.focus();
        gSearchBox.value = String.fromCharCode(aEvent.charCode);
    }
  }
}

function onTargetSelect(event) {
  gRunFiltersFolder._folder = event.target._folder;
  gRunFiltersFolder.setAttribute("label", event.target._folder.prettyName);
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
  let keyWord = gSearchBox.value.toLocaleLowerCase();

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
  let keyword = gSearchBox.value.toLocaleLowerCase();
  if (keyword && (!aFilter || !filterSearchMatch(aFilter, keyword)))
    gSearchBox.reset();
}

/**
 * Display "1 item",  "11 items" or "4 of 10" if list is filtered via search box.
 */
function updateCountBox()
{
  let countBox = document.getElementById("countBox");
  let sum = gCurrentFilterList.filterCount;
  let len = gFilterListbox.itemCount;

  if (len == sum) {
    // "N items"
    countBox.value = PluralForm.get(len, gFilterBundle.getString("filterCountItems"))
                               .replace("#1", len);
    countBox.removeAttribute("filterActive");
  } else {
    // "N of M"
    countBox.value = gFilterBundle.getFormattedString("filterCountVisibleOfTotal",
                                                      [len, sum]);
    if (len == 0 && sum > 0)
      countBox.setAttribute("filterActive", "nomatches");
    else
      countBox.setAttribute("filterActive", "matches");
  }
}
