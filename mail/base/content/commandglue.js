/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jan Varga <varga@nixcorp.com>
 *   Håkan Waara (hwaara@chello.se)
 *   David Bienvenu (bienvenu@nventure.com)
 *   Jeremy Morton (bugzilla@game-point.net)
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Command-specific code. This stuff should be called by the widgets
 */

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

//NOTE: gMessengerBundle and gBrandBundle must be defined and set
//      for this Overlay to work properly

function UpdateMailToolbar(caller)
{
  //dump("XXX update mail-toolbar " + caller + "\n");
  document.commandDispatcher.updateCommands('mail-toolbar');

  // hook for extra toolbar items
  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(window, "mail:updateToolbarItems", null);
}

function isNewsURI(uri)
{
    if (!uri || uri[0] != 'n') {
        return false;
    }
    else {
        return ((uri.substring(0,6) == "news:/") || (uri.substring(0,14) == "news-message:/"));
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

  if (gDBView.usingLines) {
     sizeColumn.setAttribute("label",gMessengerBundle.getString("linesColumnHeader"));
  }
  else {
     sizeColumn.setAttribute("label", gMessengerBundle.getString("sizeColumnHeader"));
  }
}

function UpdateStatusMessageCounts(folder)
{
  var unreadElement = GetUnreadCountElement();
  var totalElement = GetTotalCountElement();
  if(folder && unreadElement && totalElement)
  {
    var numSelected = GetNumSelectedMessages();

    var numUnread = (numSelected > 1) ?
            gMessengerBundle.getFormattedString("selectedMsgStatus",
                                                [numSelected]) :
            gMessengerBundle.getFormattedString("unreadMsgStatus",
                                                [ folder.getNumUnread(false)]);
    var numTotal =
            gMessengerBundle.getFormattedString("totalMsgStatus",
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
    gQuotaUICache.showTreshold = gPrefBranch.getIntPref(kBranch + "show");
    gQuotaUICache.warningTreshold = gPrefBranch.getIntPref(kBranch + "warning");
    gQuotaUICache.criticalTreshold = gPrefBranch.getIntPref(kBranch + "critical");
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
      var label = gMessengerBundle.getFormattedString("percent", [percent]);
      var tooltip = gMessengerBundle.getFormattedString("quotaTooltip",
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
  // we also have to hide the File/Attachments menuitem
  var node = document.getElementById("fileAttachmentMenu");
  if (node)
    node.hidden = now_hidden;

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

  let folders = GetSelectedMsgFolders();
  gFolderDisplay.show(folders.length ? folders[0] : null);
}

function IsSpecialFolder(msgFolder, flags, checkAncestors)
{
    if (!msgFolder)
        return false;
    else if ((msgFolder.flags & flags) == 0)
    {
      var parentMsgFolder = msgFolder.parentMsgFolder;

      return (parentMsgFolder && checkAncestors) ? IsSpecialFolder(parentMsgFolder, flags, true) : false;
    }
    else {
        // the user can set their INBOX to be their SENT folder.
        // in that case, we want this folder to act like an INBOX,
        // and not a SENT folder
        const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
        return !((flags & nsMsgFolderFlags.SentMail) &&
                 (msgFolder.flags & nsMsgFolderFlags.Inbox));
    }
}

function Undo()
{
    messenger.undo(msgWindow);
}

function Redo()
{
    messenger.redo(msgWindow);
}

var gMessengerBundle = null;

