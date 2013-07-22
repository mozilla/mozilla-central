/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Command-specific code. This stuff should be called by the widgets
 */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function UpdateMailToolbar(caller)
{
  // If we have a transient selection, we shouldn't update the toolbar. We'll
  // update it once we've restored the original selection.
  if ("gRightMouseButtonSavedSelection" in window &&
      gRightMouseButtonSavedSelection)
    return;

  //dump("XXX update mail-toolbar " + caller + "\n");
  document.commandDispatcher.updateCommands('mail-toolbar');

  // hook for extra toolbar items
  Services.obs.notifyObservers(window, "mail:updateToolbarItems", null);
}

function isNewsURI(uri)
{
    if (!uri || !uri.startsWith('n')) {
        return false;
    }
    else {
        return ((uri.startsWith("news:/")) || (uri.startsWith("news-message:/")));
    }
}

function SwitchView(command)
{
  // when switching thread views, we might be coming out of quick search
  // or a message view.
  // first set view picker to all
  if (gFolderDisplay.view.mailViewIndex != kViewItemAll)
    gFolderDisplay.view.setMailView(kViewItemAll);

  switch(command)
  {
    // "All" threads and "Unread" threads don't change threading state
    case "cmd_viewAllMsgs":
      gFolderDisplay.view.showUnreadOnly = false;
      break;
    case "cmd_viewUnreadMsgs":
      gFolderDisplay.view.showUnreadOnly = true;
      break;
    // "Threads with Unread" and "Watched Threads with Unread" force threading
    case "cmd_viewWatchedThreadsWithUnread":
      gFolderDisplay.view.specialViewWatchedThreadsWithUnread = true;
      break;
    case "cmd_viewThreadsWithUnread":
      gFolderDisplay.view.specialViewThreadsWithUnread = true;
      break;
    // "Ignored Threads" toggles 'ignored' inclusion --
    //   but it also resets 'With Unread' views to 'All'
    case "cmd_viewIgnoredThreads":
      gFolderDisplay.view.showIgnored = !gFolderDisplay.view.showIgnored;
      break;
  }
}

function SetNewsFolderColumns()
{
  var sizeColumn = document.getElementById("sizeCol");
  var bundle = document.getElementById("bundle_messenger");

  if (gDBView.usingLines) {
     sizeColumn.setAttribute("label", bundle.getString("linesColumnHeader"));
     sizeColumn.setAttribute("tooltiptext",
                             bundle.getString("linesColumnTooltip"));
  }
  else {
     sizeColumn.setAttribute("label", bundle.getString("sizeColumnHeader"));
     sizeColumn.setAttribute("tooltiptext",
                             bundle.getString("sizeColumnTooltip"));
  }
}

/**
 * For non-folder based tabs, message counts don't apply.
 * Therefore hide the counts for those folders. For folder based tabs
 * let the tab decide whether or not to show it in UpdateStatusMessageCounts().
 */
var statusMessageCountsMonitor = {
  onTabTitleChanged: function() {},
  onTabSwitched: function statusMessageCountsMonitor_onTabSwitched(aTab, aOldTab) {
    if (aTab.mode.name != "folder" && aTab.mode.name != "glodaSearch") {
      document.getElementById("unreadMessageCount").hidden = true;
      document.getElementById("totalMessageCount").hidden = true;
    }
  }
}

function UpdateStatusMessageCounts(folder)
{
  var unreadElement = document.getElementById("unreadMessageCount");
  var totalElement = document.getElementById("totalMessageCount");
  if (folder && !folder.isServer && unreadElement && totalElement)
  {
    var numSelected = GetNumSelectedMessages();
    var bundle = document.getElementById("bundle_messenger");

    var numUnread = (numSelected > 1) ?
            bundle.getFormattedString("selectedMsgStatus", [numSelected]) :
            bundle.getFormattedString("unreadMsgStatus",
                                      [folder.getNumUnread(false)]);
    var numTotal = bundle.getFormattedString("totalMsgStatus",
                                             [folder.getTotalMessages(false)]);

    unreadElement.setAttribute("label", numUnread);
    totalElement.setAttribute("label", numTotal);
    unreadElement.hidden = false;
    totalElement.hidden = false;
  }
}

var gQuotaUICache;
function UpdateStatusQuota(folder)
{
  if (!(folder && // no folder selected
        folder instanceof Components.interfaces.nsIMsgImapMailFolder)) // POP etc.
  {
    if (typeof(gQuotaUICache) == "object") // ever shown quota
      gQuotaUICache.panel.hidden = true;
    return;
  }
  folder = folder.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);

  // get element references and prefs
  if (typeof(gQuotaUICache) != "object")
  {
    gQuotaUICache = new Object();
    gQuotaUICache.meter = document.getElementById("quotaMeter");
    gQuotaUICache.panel = document.getElementById("quotaPanel");
    gQuotaUICache.label = document.getElementById("quotaLabel");
    const kBranch = "mail.quota.mainwindow_threshold.";
    gQuotaUICache.showTreshold = Services.prefs.getIntPref(kBranch + "show");
    gQuotaUICache.warningTreshold = Services.prefs.getIntPref(kBranch + "warning");
    gQuotaUICache.criticalTreshold = Services.prefs.getIntPref(kBranch + "critical");
  }

  var valid = {value: null};
  var used = {value: null};
  var max = {value: null};
  try {
    // get data from backend
    folder.getQuota(valid, used, max);
  } catch (e) { dump(e + "\n"); }
  if (valid.value && max.value > 0)
  {
    var percent = Math.round(used.value / max.value * 100);

    // show in UI
    if (percent < gQuotaUICache.showTreshold)
      gQuotaUICache.panel.hidden = true;
    else
    {
      gQuotaUICache.panel.hidden = false;
      gQuotaUICache.meter.setAttribute("value", percent);
           // do not use value property, because that is imprecise (3%)
           // for optimization that we don't need here
      var bundle = document.getElementById("bundle_messenger");
      var label = bundle.getFormattedString("percent", [percent]);
      var tooltip = bundle.getFormattedString("quotaTooltip",
                                              [used.value, max.value]);
      gQuotaUICache.label.value = label;
      gQuotaUICache.label.tooltipText = tooltip;
      if (percent < gQuotaUICache.warningTreshold)
        gQuotaUICache.panel.removeAttribute("alert");
      else if (percent < gQuotaUICache.criticalTreshold)
        gQuotaUICache.panel.setAttribute("alert", "warning");
      else
        gQuotaUICache.panel.setAttribute("alert", "critical");
    }
  }
  else
    gQuotaUICache.panel.hidden = true;
}

function ConvertSortTypeToColumnID(sortKey)
{
  var columnID;

  // Hack to turn this into an integer, if it was a string.
  // It would be a string if it came from localStore.rdf
  sortKey = sortKey - 0;

  switch (sortKey) {
    case nsMsgViewSortType.byDate:
      columnID = "dateCol";
      break;
    case nsMsgViewSortType.byReceived:
      columnID = "receivedCol";
      break;
    case nsMsgViewSortType.byAuthor:
      columnID = "senderCol";
      break;
    case nsMsgViewSortType.byRecipient:
      columnID = "recipientCol";
      break;
    case nsMsgViewSortType.byTo:
      columnID = "toCol";
      break;
    case nsMsgViewSortType.bySubject:
      columnID = "subjectCol";
      break;
    case nsMsgViewSortType.byLocation:
      columnID = "locationCol";
      break;
    case nsMsgViewSortType.byAccount:
      columnID = "accountCol";
      break;
    case nsMsgViewSortType.byUnread:
      columnID = "unreadButtonColHeader";
      break;
    case nsMsgViewSortType.byStatus:
      columnID = "statusCol";
      break;
    case nsMsgViewSortType.byTags:
      columnID = "tagsCol";
      break;
    case nsMsgViewSortType.bySize:
      columnID = "sizeCol";
      break;
    case nsMsgViewSortType.byPriority:
      columnID = "priorityCol";
      break;
    case nsMsgViewSortType.byFlagged:
      columnID = "flaggedCol";
      break;
    case nsMsgViewSortType.byThread:
      columnID = "threadCol";
      break;
    case nsMsgViewSortType.byId:
      columnID = "idCol";
      break;
    case nsMsgViewSortType.byJunkStatus:
      columnID = "junkStatusCol";
      break;
    case nsMsgViewSortType.byAttachments:
      columnID = "attachmentCol";
      break;
    case nsMsgViewSortType.byCustom:

      //TODO: either change try() catch to if (property exists) or restore the getColumnHandler() check
      try //getColumnHandler throws an errror when the ID is not handled
      {
        columnID = gDBView.curCustomColumn;
      }
      catch (err) { //error - means no handler
        dump("ConvertSortTypeToColumnID: custom sort key but no handler for column '" + columnID + "'\n");
        columnID = "dateCol";
      }

      break;
    default:
      dump("unsupported sort key: " + sortKey + "\n");
      columnID = "dateCol";
      break;
  }
  return columnID;
}

var nsMsgViewSortType = Components.interfaces.nsMsgViewSortType;
var nsMsgViewSortOrder = Components.interfaces.nsMsgViewSortOrder;
var nsMsgViewFlagsType = Components.interfaces.nsMsgViewFlagsType;
var nsMsgViewCommandType = Components.interfaces.nsMsgViewCommandType;
var nsMsgViewType = Components.interfaces.nsMsgViewType;
var nsMsgNavigationType = Components.interfaces.nsMsgNavigationType;

var gDBView = null;
var gCurViewFlags;
var gCurSortType;


function ChangeMessagePaneVisibility(now_hidden)
{
  // We also have to disable the Message/Attachments menuitem.
  // It will be enabled when loading a message with attachments
  // (see messageHeaderSink.handleAttachment).
  var node = document.getElementById("msgAttachmentMenu");
  if (node && now_hidden)
    node.setAttribute("disabled", "true");

  gMessageDisplay.visible = !now_hidden;

  var event = document.createEvent('Events');
  if (now_hidden) {
    event.initEvent('messagepane-hide', false, true);
  }
  else {
    event.initEvent('messagepane-unhide', false, true);
  }
  document.getElementById("messengerWindow").dispatchEvent(event);
}

function OnMouseUpThreadAndMessagePaneSplitter()
{
  // The collapsed state is the state after we released the mouse,
  // so we take it as it is.
  ChangeMessagePaneVisibility(IsMessagePaneCollapsed());
}

/**
 * Our multiplexed tabbing model ends up sending synthetic folder pane
 *  selection change notifications.  We want to ignore these because the
 *  user may explicitly re-select a folder intentionally, and we want to
 *  be able to know that.  So we filter out the synthetics here.
 * The tabbing logic sets this global to help us out.
 */
var gIgnoreSyntheticFolderPaneSelectionChange = false;
function FolderPaneSelectionChange()
{
  let folders = GetSelectedMsgFolders();
  if (folders.length) {
    let msgFolder = folders[0];
    let locationItem = document.getElementById("locationFolders");
    if (locationItem) {
      locationItem.setAttribute("label", msgFolder.prettyName);
      document.getElementById("folderLocationPopup")
              ._setCssSelectors(msgFolder, locationItem);
    }
  }

  if (gIgnoreSyntheticFolderPaneSelectionChange) {
    gIgnoreSyntheticFolderPaneSelectionChange = false;
    return;
  }

  let folderSelection = gFolderTreeView.selection;

  // This prevents a folder from being loaded in the case that the user
  // has right-clicked on a folder different from the one that was
  // originally highlighted.  On a right-click, the highlight (selection)
  // of a row will be different from the value of currentIndex, thus if
  // the currentIndex is not selected, it means the user right-clicked
  // and we don't want to load the contents of the folder.
  if (!folderSelection.isSelected(folderSelection.currentIndex))
    return;

  gFolderDisplay.show(folders.length ? folders[0] : null);
}

function Undo()
{
    messenger.undo(msgWindow);
}

function Redo()
{
    messenger.redo(msgWindow);
}
