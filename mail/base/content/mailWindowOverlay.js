# -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998-1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   timeless
#   slucy@objectivesw.co.uk
#   Håkan Waara <hwaara@chello.se>
#   Jan Varga <varga@nixcorp.com>
#   Seth Spitzer <sspitzer@netscape.com>
#   David Bienvenu <bienvenu@nventure.com>
#   Karsten Düsterloh <mnyromyr@tprac.de>
#   Christopher Thomas <cst@yecc.com>
#   Jeremy Morton <bugzilla@game-point.net>
#   Andrew Sutherland <asutherland@asutherland.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

const MSG_FLAG_READ              = 0x000001;
const MSG_FLAG_HAS_RE            = 0x000010;
const MSG_FLAG_IMAP_DELETED      = 0x200000;
const ADDR_DB_LARGE_COMMIT       = 1;

const kClassicMailLayout = 0;
const kWideMailLayout = 1;
const kVerticalMailLayout = 2;

// Per message header flags to keep track of whether the user is allowing remote
// content for a particular message.
// if you change or add more values to these constants, be sure to modify
// the corresponding definitions in nsMsgContentPolicy.cpp
const kNoRemoteContentPolicy = 0;
const kBlockRemoteContent = 1;
const kAllowRemoteContent = 2;

const kMsgNotificationPhishingBar = 1;
const kMsgNotificationJunkBar = 2;
const kMsgNotificationRemoteImages = 3;

var gMessengerBundle;
var gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService)
                            .getBranch(null);
// Timer to mark read, if the user has configured the app to mark a message as
// read if it is viewed for more than n seconds.
var gMarkViewedMessageAsReadTimer = null;

// the user preference,
// if HTML is not allowed. I assume, that the user could have set this to a
// value > 1 in his prefs.js or user.js, but that the value will not
// change during runtime other than through the MsgBody*() functions below.
var gDisallow_classes_no_html = 1;

// Disable the new account menu item if the account preference is locked.
// Two other affected areas are the account central and the account manager
// dialog.
function menu_new_init()
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var newAccountItem = document.getElementById('newAccountMenuItem');
  if (gPrefBranch.prefIsLocked("mail.disable_new_account_addition"))
    newAccountItem.setAttribute("disabled","true");

  // Change "New Folder..." menu according to the context
  var folderArray = GetSelectedMsgFolders();
  if (folderArray.length == 0)
    return;
  var msgFolder = folderArray[0];
  var isServer = msgFolder.isServer;
  var serverType = msgFolder.server.type;
  var canCreateNew = msgFolder.canCreateSubfolders;
  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  var isInbox = IsSpecialFolder(msgFolder, nsMsgFolderFlags.Inbox, false);
  var isIMAPFolder = serverType == "imap";
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
  var showNew = ((serverType != 'nntp') && canCreateNew) || isInbox;
  ShowMenuItem("menu_newFolder", showNew);
  ShowMenuItem("menu_newVirtualFolder", showNew);

  EnableMenuItem("menu_newFolder", !isIMAPFolder || MailOfflineMgr.isOnline());
  EnableMenuItem("menu_newVirtualFolder", true);
  if (showNew)
    SetMenuItemLabel("menu_newFolder", gMessengerBundle.getString(
      (isServer || isInbox) ? "newFolderMenuItem" : "newSubfolderMenuItem"));
}

function goUpdateMailMenuItems(commandset)
{
  for (var i = 0; i < commandset.childNodes.length; i++)
  {
    var commandID = commandset.childNodes[i].getAttribute("id");
    if (commandID)
      goUpdateCommand(commandID);
  }
}

function file_init()
{
  document.commandDispatcher.updateCommands('create-menu-file');
}

function InitEditMessagesMenu()
{
  goSetMenuValue('cmd_delete', 'valueDefault');
  goSetAccessKey('cmd_delete', 'valueDefaultAccessKey');
  document.commandDispatcher.updateCommands('create-menu-edit');

  // initialize the favorite Folder checkbox in the edit menu
  var favoriteFolderMenu = document.getElementById('menu_favoriteFolder');
  if (favoriteFolderMenu && !favoriteFolderMenu.disabled)
  {
    var folders = GetSelectedMsgFolders();
    if (folders.length)
      SetupFavoritesMenuItem(folders[0], folders.length, folders[0].isServer, 'menu_favoriteFolder');
  }
}

function InitGoMessagesMenu()
{
  document.commandDispatcher.updateCommands('create-menu-go');
}

function view_init()
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var messagePaneMenuItem = document.getElementById("menu_showMessage");
  if (!messagePaneMenuItem.hidden) { // Hidden in the standalone msg window.
    messagePaneMenuItem.setAttribute("checked", !IsMessagePaneCollapsed());
    messagePaneMenuItem.disabled = gAccountCentralLoaded;
  }

  // Disable some menus if account manager is showing
  document.getElementById("viewSortMenu").disabled = gAccountCentralLoaded;
  document.getElementById("viewMessageViewMenu").disabled = gAccountCentralLoaded;
  document.getElementById("viewMessagesMenu").disabled = gAccountCentralLoaded;

  // Hide the views menu item if the user doesn't have the views toolbar button
  // visible.
  var viewsToolbarButton = document.getElementById("mailviews-container");
  document.getElementById('viewMessageViewMenu').hidden = !viewsToolbarButton;

  // ... and also the separator.
  document.getElementById("viewMenuAfterTaskbarSeparator").hidden = !viewsToolbarButton;

  // Initialize the View Attachment Inline menu
  var viewAttachmentInline = pref.getBoolPref("mail.inline_attachments");
  document.getElementById("viewAttachmentsInlineMenuitem")
          .setAttribute("checked", viewAttachmentInline);

  document.commandDispatcher.updateCommands('create-menu-view');
}

function InitViewLayoutStyleMenu(event)
{
  var paneConfig = pref.getIntPref("mail.pane_config.dynamic");
  var layoutStyleMenuitem = event.target.childNodes[paneConfig];
  if (layoutStyleMenuitem)
    layoutStyleMenuitem.setAttribute("checked", "true");
}

function InitViewFolderViewsMenu(event)
{
  var layoutStyleMenuitem = event.target.childNodes[gCurrentFolderView];
  if (layoutStyleMenuitem)
    layoutStyleMenuitem.setAttribute("checked", "true");
}

function setSortByMenuItemCheckState(id, value)
{
  var menuitem = document.getElementById(id);
  if (menuitem)
    menuitem.setAttribute("checked", value);
}

function InitViewSortByMenu()
{
  var sortType = gDBView.sortType;

  setSortByMenuItemCheckState("sortByDateMenuitem", (sortType == nsMsgViewSortType.byDate));
  setSortByMenuItemCheckState("sortByReceivedMenuitem", (sortType == nsMsgViewSortType.byReceived));
  setSortByMenuItemCheckState("sortByFlagMenuitem", (sortType == nsMsgViewSortType.byFlagged));
  setSortByMenuItemCheckState("sortByOrderReceivedMenuitem", (sortType == nsMsgViewSortType.byId));
  setSortByMenuItemCheckState("sortByPriorityMenuitem", (sortType == nsMsgViewSortType.byPriority));
  setSortByMenuItemCheckState("sortBySizeMenuitem", (sortType == nsMsgViewSortType.bySize));
  setSortByMenuItemCheckState("sortByStatusMenuitem", (sortType == nsMsgViewSortType.byStatus));
  setSortByMenuItemCheckState("sortBySubjectMenuitem", (sortType == nsMsgViewSortType.bySubject));
  setSortByMenuItemCheckState("sortByUnreadMenuitem", (sortType == nsMsgViewSortType.byUnread));
  setSortByMenuItemCheckState("sortByTagsMenuitem", (sortType == nsMsgViewSortType.byTags));
  setSortByMenuItemCheckState("sortByJunkStatusMenuitem", (sortType == nsMsgViewSortType.byJunkStatus));
  setSortByMenuItemCheckState("sortByFromMenuitem", (sortType == nsMsgViewSortType.byAuthor));
  setSortByMenuItemCheckState("sortByRecipientMenuitem", (sortType == nsMsgViewSortType.byRecipient));
  setSortByMenuItemCheckState("sortByAttachmentsMenuitem", (sortType == nsMsgViewSortType.byAttachments));

  var sortOrder = gDBView.sortOrder;
  var sortTypeSupportsGrouping = (sortType == nsMsgViewSortType.byAuthor ||
      sortType == nsMsgViewSortType.byDate || sortType == nsMsgViewSortType.byReceived ||
      sortType == nsMsgViewSortType.byPriority ||
      sortType == nsMsgViewSortType.bySubject || sortType == nsMsgViewSortType.byTags ||
      sortType == nsMsgViewSortType.byRecipient || sortType == nsMsgViewSortType.byAccount ||
      sortType == nsMsgViewSortType.byStatus || sortType == nsMsgViewSortType.byFlagged ||
      sortType == nsMsgViewSortType.byAttachments);

  setSortByMenuItemCheckState("sortAscending", (sortOrder == nsMsgViewSortOrder.ascending));
  setSortByMenuItemCheckState("sortDescending", (sortOrder == nsMsgViewSortOrder.descending));

  var grouped = ((gDBView.viewFlags & nsMsgViewFlagsType.kGroupBySort) != 0);
  var threaded = ((gDBView.viewFlags & nsMsgViewFlagsType.kThreadedDisplay) != 0 && !grouped);
  var sortThreadedMenuItem = document.getElementById("sortThreaded");
  var sortUnthreadedMenuItem = document.getElementById("sortUnthreaded");

  sortThreadedMenuItem.setAttribute("checked", threaded);
  sortUnthreadedMenuItem.setAttribute("checked", !threaded && !grouped);

  var groupBySortOrderMenuItem = document.getElementById("groupBySort");

  groupBySortOrderMenuItem.setAttribute("disabled", !sortTypeSupportsGrouping);
  groupBySortOrderMenuItem.setAttribute("checked", grouped);
}

function InitViewMessagesMenu()
{
  var viewFlags = (gDBView) ? gDBView.viewFlags : 0;
  var viewType = (gDBView) ? gDBView.viewType : 0;

  document.getElementById("viewAllMessagesMenuItem").setAttribute("checked",
    (viewFlags & nsMsgViewFlagsType.kUnreadOnly) == 0 &&
    (viewType == nsMsgViewType.eShowAllThreads));

  document.getElementById("viewUnreadMessagesMenuItem").setAttribute("checked",
    (viewFlags & nsMsgViewFlagsType.kUnreadOnly) != 0);

  document.getElementById("viewThreadsWithUnreadMenuItem").setAttribute("checked",
    viewType == nsMsgViewType.eShowThreadsWithUnread);

  document.getElementById("viewWatchedThreadsWithUnreadMenuItem").setAttribute("checked",
    viewType == nsMsgViewType.eShowWatchedThreadsWithUnread);

  document.getElementById("viewIgnoredThreadsMenuItem").setAttribute("checked",
    (viewFlags & nsMsgViewFlagsType.kShowIgnored) != 0);
}

function InitMessageMenu()
{
  var selectedMsg = GetFirstSelectedMessage();
  var isNews = IsNewsMessage(selectedMsg);

  // We show reply to Newsgroups only for news messages.
  document.getElementById("replyNewsgroupMainMenu").hidden = !isNews;

  // For mail messages we say reply. For news we say ReplyToSender.
  document.getElementById("replyMainMenu").hidden = isNews;
  document.getElementById("replySenderMainMenu").hidden = !isNews;

  // We only kill and watch threads for news.
  document.getElementById("threadItemsSeparator").hidden = !isNews;
  document.getElementById("killThread").hidden = !isNews;
  document.getElementById("killSubthread").hidden = !isNews;
  document.getElementById("watchThread").hidden = !isNews;

  // Disable the move and copy menus if there are no messages selected.
  // Disable the move menu if we can't delete msgs from the folder.
  var msgFolder = GetLoadedMsgFolder();
  var enableMenuItem = selectedMsg && msgFolder && msgFolder.canDeleteMessages;
  document.getElementById("moveMenu").disabled = !enableMenuItem;

  // Also disable copy when no folder is loaded (like for .eml files).
  document.getElementById("copyMenu").disabled = !(selectedMsg && msgFolder);

  initMoveToFolderAgainMenu(document.getElementById("moveToFolderAgain"));

  // Disable the Forward As menu item if no message is selected.
  document.getElementById("forwardAsMenu").disabled = !selectedMsg;

  // Disable the Tag menu item if no message is selected or when we're
  // not in a folder.
  document.getElementById("tagMenu").disabled = !(selectedMsg && msgFolder);

  // Disable mark menu when we're not in a folder.
  document.getElementById("markMenu").disabled = !msgFolder;

  document.commandDispatcher.updateCommands('create-menu-message');
}

/**
 * Enables / disables aMenuItem based on the value of
 * mail.last_msg_movecopy_target_uri and  adjusts the label and accesskey
 * for aMenuItem to include the folder name.
 */
function initMoveToFolderAgainMenu(aMenuItem)
{
  var lastFolderURI = pref.getCharPref("mail.last_msg_movecopy_target_uri");
  var isMove = pref.getBoolPref("mail.last_msg_movecopy_was_move");
  if (lastFolderURI)
  {
    var destMsgFolder = GetMsgFolderFromUri(lastFolderURI);
    aMenuItem.label = gMessengerBundle.getFormattedString(isMove ?
      "moveToFolderAgain" : "copyToFolderAgain", [destMsgFolder.prettyName], 1);
    aMenuItem.accesskey = gMessengerBundle.getString(isMove ?
      "moveToFolderAgainAccessKey" : "copyToFolderAgainAccessKey");
  }
}

function InitViewHeadersMenu()
{
  var headerchoice = 1;
  try
  {
    headerchoice = pref.getIntPref("mail.show_headers");
  }
  catch (ex)
  {
    dump("failed to get the header pref\n");
  }

  var id = null;
  switch (headerchoice)
  {
    case 2:
      id = "viewallheaders";
      break;
    case 1:
    default:
      id = "viewnormalheaders";
      break;
  }

  var menuitem = document.getElementById(id);
  if (menuitem)
    menuitem.setAttribute("checked", "true");
}

function InitViewBodyMenu()
{
  var html_as = 0;
  var prefer_plaintext = false;
  var disallow_classes = 0;
  try
  {
    prefer_plaintext = pref.getBoolPref("mailnews.display.prefer_plaintext");
    html_as = pref.getIntPref("mailnews.display.html_as");
    disallow_classes = pref.getIntPref("mailnews.display.disallow_mime_handlers");
    if (disallow_classes > 0)
      gDisallow_classes_no_html = disallow_classes;
    // else gDisallow_classes_no_html keeps its inital value (see top)
  }
  catch (ex)
  {
    dump("failed to get the body plaintext vs. HTML prefs\n");
  }

  var AllowHTML_checked = false;
  var Sanitized_checked = false;
  var AsPlaintext_checked = false;
  if (!prefer_plaintext && !html_as && !disallow_classes)
    AllowHTML_checked = true;
  else if (!prefer_plaintext && html_as == 3 && disallow_classes > 0)
    Sanitized_checked = true;
  else if (prefer_plaintext && html_as == 1 && disallow_classes > 0)
    AsPlaintext_checked = true;
  // else (the user edited prefs/user.js) check none of the radio menu items

  var AllowHTML_menuitem = document.getElementById("bodyAllowHTML");
  var Sanitized_menuitem = document.getElementById("bodySanitized");
  var AsPlaintext_menuitem = document.getElementById("bodyAsPlaintext");
  if (AllowHTML_menuitem && Sanitized_menuitem && AsPlaintext_menuitem)
  {
    AllowHTML_menuitem.setAttribute("checked", AllowHTML_checked ? "true" : "false");
    Sanitized_menuitem.setAttribute("checked", Sanitized_checked ? "true" : "false");
    AsPlaintext_menuitem.setAttribute("checked", AsPlaintext_checked ? "true" : "false");
  }
  else
    dump("Where is my View|Body menu?\n");
}

function IsNewsMessage(messageUri)
{
  return (/^news-message:/.test(messageUri));
}

function IsImapMessage(messageUri)
{
  return (/^imap-message:/.test(messageUri));
}

function SetMenuItemLabel(menuItemId, customLabel)
{
  var menuItem = document.getElementById(menuItemId);
  if (menuItem)
    menuItem.setAttribute('label', customLabel);
}

function RemoveAllMessageTags()
{
  var selectedMsgUris = GetSelectedMessages();
  if (!selectedMsgUris.length)
    return;

  var messages = Components.classes["@mozilla.org/array;1"]
                           .createInstance(Components.interfaces.nsIMutableArray);
  var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                             .getService(Components.interfaces.nsIMsgTagService);
  var tagArray = tagService.getAllTags({});

  var allKeys = "";
  for (var j = 0; j < tagArray.length; ++j)
  {
    if (j)
      allKeys += " ";
    allKeys += tagArray[j].key;
  }

  var prevHdrFolder = null;
  // this crudely handles cross-folder virtual folders with selected messages
  // that spans folders, by coalescing consecutive messages in the selection
  // that happen to be in the same folder. nsMsgSearchDBView does this better,
  // but nsIMsgDBView doesn't handle commands with arguments, and untag takes a
  // key argument. Furthermore, we only delete legacy labels and known tags,
  // keeping other keywords like (non)junk intact.

  for (var i = 0; i < selectedMsgUris.length; ++i)
  {
    var msgHdr = messenger.msgHdrFromURI(selectedMsgUris[i]);
    msgHdr.label = 0; // remove legacy label
    if (prevHdrFolder != msgHdr.folder)
    {
      if (prevHdrFolder)
        prevHdrFolder.removeKeywordsFromMessages(messages, allKeys);
      messages.clear();
      prevHdrFolder = msgHdr.folder;
    }
    messages.appendElement(msgHdr, false);
  }
  if (prevHdrFolder)
    prevHdrFolder.removeKeywordsFromMessages(messages, allKeys);
  OnTagsChange();
}

function ToggleMessageTagKey(index)
{
  if (GetNumSelectedMessages() < 1)
    return;
  // set the tag state based upon that of the first selected message,
  // just like we do for markAsRead etc.
  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                             .getService(Components.interfaces.nsIMsgTagService);
  var tagArray = tagService.getAllTags({});
  for (var i = 0; i < tagArray.length; ++i)
  {
    var key = tagArray[i].key;
    if (!--index)
    {
      // found the key, now toggle its state
      var curKeys = msgHdr.getStringProperty("keywords");
      if (msgHdr.label)
        curKeys += " $label" + msgHdr.label;
      var addKey  = (" " + curKeys + " ").indexOf(" " + key + " ") < 0;
      ToggleMessageTag(key, addKey);
      return;
    }
  }
}

function ToggleMessageTagMenu(target)
{
  var key    = target.getAttribute("value");
  var addKey = target.getAttribute("checked") == "true";
  ToggleMessageTag(key, addKey);
}

function ToggleMessageTag(key, addKey)
{
  var messages = Components.classes["@mozilla.org/array;1"]
                           .createInstance(Components.interfaces.nsIMutableArray);
  var msg = Components.classes["@mozilla.org/array;1"]
                      .createInstance(Components.interfaces.nsIMutableArray);
  var selectedMsgUris = GetSelectedMessages();
  var toggler = addKey ? "addKeywordsToMessages" : "removeKeywordsFromMessages";
  var prevHdrFolder = null;
  // this crudely handles cross-folder virtual folders with selected messages
  // that spans folders, by coalescing consecutive msgs in the selection
  // that happen to be in the same folder. nsMsgSearchDBView does this
  // better, but nsIMsgDBView doesn't handle commands with arguments,
  // and (un)tag takes a key argument.
  for (var i = 0; i < selectedMsgUris.length; ++i)
  {
    var msgHdr = messenger.msgHdrFromURI(selectedMsgUris[i]);
    if (msgHdr.label)
    {
      // Since we touch all these messages anyway, migrate the label now.
      // If we don't, the thread tree won't always show the correct tag state,
      // because resetting a label doesn't update the tree anymore...
      msg.clear();
      msg.appendElement(msgHdr, false);
      msgHdr.folder.addKeywordsToMessages(msg, "$label" + msgHdr.label);
      msgHdr.label = 0; // remove legacy label
    }
    if (prevHdrFolder != msgHdr.folder)
    {
      if (prevHdrFolder)
        prevHdrFolder[toggler](messages, key);
      messages.clear();
      prevHdrFolder = msgHdr.folder;
    }
    messages.appendElement(msgHdr, false);
  }
  if (prevHdrFolder)
    prevHdrFolder[toggler](messages, key);
  OnTagsChange();
}

function AddTag()
{
  var args = {result: "", okCallback: AddTagCallback};
  var dialog = window.openDialog("chrome://messenger/content/newTagDialog.xul",
                                 "",
                                 "chrome,titlebar,modal",
                                 args);
}

function AddTagCallback(name, color)
{
  var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                             .getService(Components.interfaces.nsIMsgTagService);
  tagService.addTag(name, color, '');
  try
  {
    ToggleMessageTag(tagService.getKeyForTag(name), true);
  }
  catch(ex)
  {
    return false;
  }
  return true;
}

function SetMessageTagLabel(menuitem, index, name)
{
  // if a <key> is defined for this tag, use its key as the accesskey
  // (the key for the tag at index n needs to have the id key_tag<n>)
  var shortcutkey = document.getElementById("key_tag" + index);
  var accesskey = shortcutkey ? shortcutkey.getAttribute("key") : "";
  if (accesskey)
    menuitem.setAttribute("accesskey", accesskey);
  var label = gMessengerBundle.getFormattedString("mailnews.tags.format", 
                                                  [accesskey, name]);
  menuitem.setAttribute("label", label);
}

function InitMessageTags(menuPopup)
{
  var tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                             .getService(Components.interfaces.nsIMsgTagService);
  var tagArray = tagService.getAllTags({});
  var tagCount = tagArray.length;

  // remove any existing non-static entries...
  var menuseparator = menuPopup.lastChild.previousSibling;
  for (var i = menuPopup.childNodes.length; i > 4; --i)
    menuPopup.removeChild(menuseparator.previousSibling);

  // hide double menuseparator
  menuseparator.previousSibling.hidden = !tagCount;

  // create label and accesskey for the static remove item
  var tagRemoveLabel = gMessengerBundle.getString("mailnews.tags.remove");
  SetMessageTagLabel(menuPopup.firstChild, 0, tagRemoveLabel);

  // now rebuild the list
  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var curKeys = msgHdr.getStringProperty("keywords");
  if (msgHdr.label)
    curKeys += " $label" + msgHdr.label;

  for (var i = 0; i < tagCount; ++i)
  {
    var taginfo = tagArray[i];
    // TODO we want to either remove or "check" the tags that already exist
    var newMenuItem = document.createElement("menuitem");
    SetMessageTagLabel(newMenuItem, i + 1, taginfo.tag);
    newMenuItem.setAttribute("value", taginfo.key);
    newMenuItem.setAttribute("type", "checkbox");
    var removeKey = (" " + curKeys + " ").indexOf(" " + taginfo.key + " ") > -1;
    newMenuItem.setAttribute('checked', removeKey);
    newMenuItem.setAttribute('oncommand', 'ToggleMessageTagMenu(event.target);');
    var color = taginfo.color;
    if (color)
      newMenuItem.setAttribute("class", "lc-" + color.substr(1));    
    menuPopup.insertBefore(newMenuItem, menuseparator);
  }
}

function backToolbarMenu_init(menuPopup)
{
  populateHistoryMenu(menuPopup, true);
}

function getMsgToolbarMenu_init()
{
  document.commandDispatcher.updateCommands('create-menu-getMsgToolbar');
}

var gNavDebug = false;
function navDebug(str)
{
  if (gNavDebug)
    dump(str);
}

function populateHistoryMenu(menuPopup, isBackMenu)
{
  // remove existing entries
  while (menuPopup.firstChild)
    menuPopup.removeChild(menuPopup.firstChild);
  var curPos = new Object;
  var numEntries = new Object;
  var historyEntries = new Object;
  messenger.getNavigateHistory(curPos, numEntries, historyEntries);
  curPos.value = curPos.value * 2;
  navDebug("curPos = " + curPos.value + " numEntries = " + numEntries.value + "\n");
  var historyArray = historyEntries.value;
  var folder;
  var newMenuItem;
  if (GetLoadedMessage())
  {
    if (!isBackMenu)
      curPos.value += 2;
    else
      curPos.value -= 2;
  }
  // For populating the back menu, we want the most recently visited
  // messages first in the menu. So we go backward from curPos to 0.
  // For the forward menu, we want to go forward from curPos to the end.
  var relPos = 0;
  for (var i = curPos.value; (isBackMenu) ? i >= 0 : i < historyArray.length; i += ((isBackMenu) ? -2 : 2))
  {
    navDebug("history[" + i + "] = " + historyArray[i] + "\n");
    navDebug("history[" + i + "] = " + historyArray[i + 1] + "\n");
    folder = GetMsgFolderFromUri(historyArray[i + 1])
    navDebug("folder URI = " + folder.URI + "pretty name " + folder.prettyName + "\n");
    var menuText = "";

    var msgHdr = messenger.msgHdrFromURI(historyArray[i]);
    if (!IsCurrentLoadedFolder(folder))
      menuText = folder.prettyName + " - ";

    var subject = "";
    if(msgHdr.flags & MSG_FLAG_HAS_RE)
      subject = "Re: ";
    if (msgHdr.mime2DecodedSubject)
      subject += msgHdr.mime2DecodedSubject;
    if (subject)
      menuText += subject + " - ";

    menuText += msgHdr.mime2DecodedAuthor;
    newMenuItem = document.createElement('menuitem');
    newMenuItem.setAttribute('label', menuText);
    relPos += isBackMenu ? -1 : 1;
    newMenuItem.setAttribute('value',  relPos);
    newMenuItem.folder = folder;
    newMenuItem.setAttribute('oncommand', 'NavigateToUri(event.target); event.stopPropagation();');
    menuPopup.appendChild(newMenuItem);
    if (! (relPos % 20))
      break;
  }
}

function NavigateToUri(target)
{
  var historyIndex = target.getAttribute('value');
  var msgUri = messenger.getMsgUriAtNavigatePos(historyIndex);
  var folder = target.folder;
  var msgHdr = messenger.msgHdrFromURI(msgUri);
  navDebug("navigating from " + messenger.navigatePos + " by " + historyIndex + " to " + msgUri + "\n");

  // this "- 0" seems to ensure that historyIndex is treated as an int, not a string.
  messenger.navigatePos += (historyIndex - 0);
  LoadNavigatedToMessage(msgHdr, folder, folder.URI);
}

function forwardToolbarMenu_init(menuPopup)
{
  populateHistoryMenu(menuPopup, false);
}

function InitMessageMark()
{
  document.getElementById("cmd_markAsRead")
          .setAttribute("checked", SelectedMessagesAreRead());

  document.getElementById("cmd_markAsFlagged")
          .setAttribute("checked", SelectedMessagesAreFlagged());

  document.commandDispatcher.updateCommands('create-menu-mark');
}

function UpdateJunkToolbarButton()
{
  var junkButtonDeck = document.getElementById("junk-deck");
  if (junkButtonDeck)
    junkButtonDeck.selectedIndex = SelectedMessagesAreJunk() ? 1 : 0;
}

function UpdateDeleteToolbarButton()
{
  var deleteButtonDeck = document.getElementById("delete-deck");
  if (!deleteButtonDeck)
    return;

  // Never show "Undelete" in the 3-pane for folders, when delete would
  // apply to the selected folder.
  if (this.WhichPaneHasFocus &&
      WhichPaneHasFocus() == document.getElementById("folderTree") &&
      GetNumSelectedMessages() == 0)
    deleteButtonDeck.selectedIndex = 0;
  else
    deleteButtonDeck.selectedIndex = SelectedMessagesAreDeleted() ? 1 : 0;
}
function UpdateDeleteCommand()
{
  var value = "value";
  var uri = GetFirstSelectedMessage();
  if (IsNewsMessage(uri))
    value += "News";
  else if (SelectedMessagesAreDeleted())
    value += "IMAPDeleted";
  if (GetNumSelectedMessages() < 2)
    value += "Message";
  else
    value += "Messages";
  goSetMenuValue("cmd_delete", value);
  goSetAccessKey("cmd_delete", value + "AccessKey");
}

function SelectedMessagesAreDeleted()
{
  return gDBView && gDBView.numSelected &&
         (gDBView.hdrForFirstSelectedMessage.flags & MSG_FLAG_IMAP_DELETED);
}

function SelectedMessagesAreJunk()
{
  try {
    var junkScore = gDBView.hdrForFirstSelectedMessage.getStringProperty("junkscore");
    return (junkScore != "") && (junkScore != "0");
  }
  catch (ex) {
    return false;
  }
}

function SelectedMessagesAreRead()
{
  return gDBView && gDBView.numSelected &&
         gDBView.hdrForFirstSelectedMessage.isRead;
}

function SelectedMessagesAreFlagged()
{
  return gDBView && gDBView.numSelected &&
         gDBView.hdrForFirstSelectedMessage.isFlagged;
}

function GetFirstSelectedMsgFolder()
{
  var selectedFolders = GetSelectedMsgFolders();
  return (selectedFolders.length > 0) ? selectedFolders[0] : null;
}

function GetInboxFolder(server)
{
  try {
    var rootMsgFolder = server.rootMsgFolder;

    // Now find the Inbox.
    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    return rootMsgFolder.getFolderWithFlags(nsMsgFolderFlags.Inbox);
  }
  catch (ex) {
    dump(ex + "\n");
  }
  return null;
}

function GetMessagesForInboxOnServer(server)
{
  var inboxFolder = GetInboxFolder(server);

  // If the server doesn't support an inbox it could be an RSS server or some
  // other server type. Just use the root folder and the server implementation
  // can figure out what to do.
  if (!inboxFolder)
    inboxFolder = server.rootFolder;

  GetNewMessages([inboxFolder], server);
}

function MsgGetMessage()
{
  // if offline, prompt for getting messages
  if (MailOfflineMgr.isOnline() || MailOfflineMgr.getNewMail())
    GetFolderMessages();
}

function MsgGetMessagesForAllServers(defaultServer)
{
  // now log into any server
  try
  {
    var allServers = accountManager.allServers;
    // Array of isupportsarrays of servers for a particular folder.
    var pop3DownloadServersArray = new Array();
    // Parallel isupports array of folders to download to...
    var localFoldersToDownloadTo = Components.classes["@mozilla.org/supports-array;1"]
                                             .createInstance(Components.interfaces.nsISupportsArray);
    var pop3Server;
    for (var i = 0; i < allServers.Count(); ++i)
    {
      var currentServer = allServers.QueryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
      var protocolinfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + currentServer.type]
                                   .getService(Components.interfaces.nsIMsgProtocolInfo);
      if (protocolinfo.canLoginAtStartUp && currentServer.loginAtStartUp)
      {
        if (defaultServer && defaultServer.equals(currentServer) &&
            !defaultServer.isDeferredTo &&
            defaultServer.rootFolder == defaultServer.rootMsgFolder)
        {
          // skip, already opened
        }
        else if (currentServer.type == "pop3" && currentServer.downloadOnBiff)
        {
          CoalesceGetMsgsForPop3ServersByDestFolder(currentServer,
            pop3DownloadServersArray, localFoldersToDownloadTo);
          pop3Server = currentServer.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
        }
        else
        {
          // Check to see if there are new messages on the server
          currentServer.performBiff(msgWindow);
        }
      }
    }
    for (var i = 0; i < pop3DownloadServersArray.length; ++i)
    {
      // Any ol' pop3Server will do - the serversArray specifies which servers
      // to download from.
      pop3Server.downloadMailFromServers(pop3DownloadServersArray[i], msgWindow,
                                         localFoldersToDownloadTo.GetElementAt(i), null);
    }
  }
  catch(ex)
  {
    dump(ex + "\n");
  }
}

/**
  * Get messages for all those accounts which have the capability
  * of getting messages and have session password available i.e.,
  * curretnly logged in accounts.
  * if offline, prompt for getting messages.
  */
function MsgGetMessagesForAllAuthenticatedAccounts()
{
  if (MailOfflineMgr.isOnline() || MailOfflineMgr.getNewMail())
    GetMessagesForAllAuthenticatedAccounts();
}

/**
  * Get messages for the account selected from Menu dropdowns.
  * if offline, prompt for getting messages.
  *
  * @param aFolder (optional) a folder in the account for which messages should
  *                           be retrieved.  If null, all accounts will be used.
  */
function MsgGetMessagesForAccount(aFolder)
{
  if (!aFolder) {
    goDoCommand('cmd_getNewMessages');
    return;
  }

  if (MailOfflineMgr.isOnline() || MailOfflineMgr.getNewMail()) {
    var server = aFolder.server;
    GetMessagesForInboxOnServer(server);
  }
}

// if offline, prompt for getNextNMessages
function MsgGetNextNMessages()
{
  if (MailOfflineMgr.isOnline() || MailOfflineMgr.getNewMail())
    GetNextNMessages(GetFirstSelectedMsgFolder());
}

function MsgDeleteMessage(reallyDelete, fromToolbar)
{
  // If from the toolbar, return right away if this is a news message
  // only allow cancel from the menu:  "Edit | Cancel / Delete Message".
  if (fromToolbar && isNewsURI(GetLoadedMsgFolder().URI))
    return;

  SetNextMessageAfterDelete();
  if (reallyDelete)
    gDBView.doCommand(nsMsgViewCommandType.deleteNoTrash);
  else
    gDBView.doCommand(nsMsgViewCommandType.deleteMsg);
}

/**
 * Copies the selected messages to the destination folder
 * @param aDestFolder  the destination folder
 */
function MsgCopyMessage(aDestFolder)
{
  gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages, aDestFolder);
  pref.setCharPref("mail.last_msg_movecopy_target_uri", aDestFolder.URI);
  pref.setBoolPref("mail.last_msg_movecopy_was_move", false);
}

/**
 * Moves the selected messages to the destination folder
 * @param aDestFolder  the destination folder
 */
function MsgMoveMessage(aDestFolder)
{
  // We don't move news messages, we copy them.
  if (isNewsURI(gDBView.msgFolder.URI))
    gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages, aDestFolder);
  else
  {
    SetNextMessageAfterDelete();
    gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, aDestFolder);
  }
  pref.setCharPref("mail.last_msg_movecopy_target_uri", aDestFolder.URI);
  pref.setBoolPref("mail.last_msg_movecopy_was_move", true);
}

/**
 * Calls the ComposeMessage function with the desired type, and proper default
 * based on the event that fired it.
 *
 * @param aCompType  the nsIMsgCompType to pass to the function
 * @param aEvent (optional) the event that triggered the call
 */
function composeMsgByType(aCompType, aEvent) {
  if (aEvent && aEvent.shiftKey) {
    ComposeMessage(aCompType,
                   Components.interfaces.nsIMsgCompFormat.OppositeOfDefault,
                   GetFirstSelectedMsgFolder(), GetSelectedMessages());
  }
  else {
    ComposeMessage(aCompType, Components.interfaces.nsIMsgCompFormat.Default,
                   GetFirstSelectedMsgFolder(), GetSelectedMessages());
  }
}

function MsgNewMessage(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.New, event);
}

function MsgReplyMessage(event)
{
  var loadedFolder = GetLoadedMsgFolder();
  if (loadedFolder)
  {
    var server = loadedFolder.server;
    if(server && server.type == "nntp")
    {
      MsgReplyGroup(event);
      return;
    }
  }
  MsgReplySender(event);
}

function MsgReplySender(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ReplyToSender, event);
}

function MsgReplyGroup(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ReplyToGroup, event);
}

function MsgReplyToAllMessage(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ReplyAll, event);
}

function MsgForwardMessage(event)
{
  var forwardType = 0;
  try {
    forwardType = gPrefBranch.getIntPref("mail.forward_message_mode");
  }
  catch (ex) {
    dump("failed to retrieve pref mail.forward_message_mode");
  }

  // mail.forward_message_mode could be 1, if the user migrated from 4.x
  // 1 (forward as quoted) is obsolete, so we treat is as forward inline
  // since that is more like forward as quoted then forward as attachment
  if (forwardType == 0)
    MsgForwardAsAttachment(event);
  else
    MsgForwardAsInline(event);
}

function MsgForwardAsAttachment(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ForwardAsAttachment, event);
}

function MsgForwardAsInline(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ForwardInline, event);
}

function MsgEditMessageAsNew()
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.Template);
}

function MsgComposeDraftMessage()
{
  var loadedFolder = GetLoadedMsgFolder();
  var messageArray = GetSelectedMessages();

  ComposeMessage(Components.interfaces.nsIMsgCompType.Draft,
                 Components.interfaces.nsIMsgCompFormat.Default,
                 loadedFolder, messageArray);
}

function MsgCreateFilter()
{
  // retrieve Sender direct from selected message's headers
  var msgHdr = gDBView.hdrForFirstSelectedMessage;
  var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                               .getService(Components.interfaces.nsIMsgHeaderParser);
  var emailAddress = headerParser.extractHeaderAddressMailboxes(msgHdr.author);
  if (emailAddress)
    top.MsgFilters(emailAddress, null);
}

function MsgNewFolder(callBackFunctionName)
{
  var preselectedFolder = GetFirstSelectedMsgFolder();
  var dualUseFolders = true;
  var server = null;
  var destinationFolder = null;

  if (preselectedFolder)
  {
    try {
      server = preselectedFolder.server;
      if (server)
      {
        destinationFolder = getDestinationFolder(preselectedFolder, server);

        var imapServer =
            server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
        if (imapServer)
          dualUseFolders = imapServer.dualUseFolders;
      }
    } catch (e) {
        dump ("Exception: dualUseFolders = true\n");
    }
  }
  window.openDialog("chrome://messenger/content/newFolderDialog.xul", "",
                    "chrome,titlebar,modal",
                    {folder: destinationFolder, dualUseFolders: dualUseFolders,
                     okCallback:callBackFunctionName});
}

function getDestinationFolder(preselectedFolder, server)
{
  var destinationFolder = null;

  if (!preselectedFolder.canCreateSubfolders)
  {
    destinationFolder = server.rootMsgFolder;

    var verifyCreateSubfolders = null;
    if (destinationFolder)
      verifyCreateSubfolders = destinationFolder.canCreateSubfolders;

    // In case the server cannot have subfolders, get default account and set
    // its incoming server as parent folder.
    if (!verifyCreateSubfolders)
    {
      try {
        var defaultFolder = GetDefaultAccountRootFolder();
        var checkCreateSubfolders = null;
        if (defaultFolder)
          checkCreateSubfolders = defaultFolder.canCreateSubfolders;

        if (checkCreateSubfolders)
          destinationFolder = defaultFolder;

      } catch (e) {
          dump ("Exception: defaultAccount Not Available\n");
      }
    }
  }
  else
    destinationFolder = preselectedFolder;

  return destinationFolder;
}

/** Open subscribe window. */
function MsgSubscribe()
{
  var preselectedFolder = GetFirstSelectedMsgFolder();

  if (preselectedFolder && preselectedFolder.server.type == "rss")
    openSubscriptionsDialog(preselectedFolder); // open feed subscription dialog
  else
    Subscribe(preselectedFolder); // open imap/nntp subscription dialog
}

function ConfirmUnsubscribe(folder)
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var titleMsg = gMessengerBundle.getString("confirmUnsubscribeTitle");
  var dialogMsg = gMessengerBundle.getFormattedString("confirmUnsubscribeText",
                                      [folder.name], 1);

  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
  return promptService.confirm(window, titleMsg, dialogMsg);
}

function MsgUnsubscribe()
{
  var folder = GetFirstSelectedMsgFolder();
  if (ConfirmUnsubscribe(folder))
    UnSubscribe(folder);
}

function ToggleFavoriteFolderFlag()
{
  var folder = GetFirstSelectedMsgFolder();
  folder.toggleFlag(Components.interfaces.nsMsgFolderFlags.Favorite);
}

function MsgSaveAsFile()
{
  if (GetNumSelectedMessages() == 1)
    SaveAsFile(GetFirstSelectedMessage());
}

function MsgSaveAsTemplate()
{
  var folder = GetLoadedMsgFolder();
  if (GetNumSelectedMessages() == 1)
    SaveAsTemplate(GetFirstSelectedMessage(), folder);
}

function MsgOpenNewWindowForFolder(uri, key)
{
  var uriToOpen = uri;
  var keyToSelect = key;

  if (!uriToOpen)
    // use GetSelectedMsgFolders() to find out which folder to open instead of
    // GetLoadedMsgFolder().URI. This is required because on a right-click, the
    // currentIndex value will be different from the actual row that is
    // highlighted. GetSelectedMsgFolders() will return the folder that is
    // highlighted.
    uriToOpen = GetSelectedMsgFolders()[0].URI;

  if (uriToOpen)
    window.openDialog("chrome://messenger/content/", "_blank", "chrome,all,dialog=no", uriToOpen, keyToSelect);
}

function CreateToolbarTooltip(document, event)
{
  event.stopPropagation();
  var tn = document.tooltipNode;
  if (tn.localName != "tab")
    return false; // Not a tab, so cancel the tooltip.
  if ("mOverCloseButton" in tn && tn.mOverCloseButton) {
     event.target.setAttribute("label", tn.getAttribute("closetabtext"));
     return true;
  }
  if (tn.hasAttribute("label")) {
    event.target.setAttribute("label", tn.getAttribute("label"));
    return true;
  }
  return false;
}

/**
 * mailTabType provides both "folder" and "message" tab modes. Under the
 * previous TabOwner framework, their logic was separated into two 'classes'
 * which called common helper methods and had similar boilerplate logic.
 */
let mailTabType = {
  name: "mail",
  panelId: "mailContent",
  modes: {
    folder: {
      isDefault: true,
      type: "folder",
      openTab: function(aTab, aFolderUri) {
        aTab.uriToOpen = aFolderUri;

        this.openTab(aTab); // call superclass logic
      },
      showTab: function(aTab) {
        this.folderAndThreadPaneVisible = true;
        ClearMessagePane();

        this.showTab(aTab);
      },
      onTitleChanged: function(aTab, aTabNode) {
        if (!gMsgFolderSelected) {
          // Don't show "undefined" as title when there is no account.
          aTab.title = "";
          return;
        }
        aTab.title = gMsgFolderSelected.prettyName;
        if (!gMsgFolderSelected.isServer && this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + gMsgFolderSelected.server.prettyName;

        // The user may have changed folders, triggering our onTitleChanged callback.
        // Update the appropriate attributes on the tab.
        aTabNode.setAttribute('SpecialFolder', getSpecialFolderString(gMsgFolderSelected));
        aTabNode.setAttribute('ServerType', gMsgFolderSelected.server.type);
        aTabNode.setAttribute('IsServer', gMsgFolderSelected.isServer);
        aTabNode.setAttribute('IsSecure', gMsgFolderSelected.server.isSecure);
      }
    },
    message: {
      type: "message",
      openTab: function(aTab, aFolderUri, aMsgHdr) {
        aTab.uriToOpen = aFolderUri;
        aTab.hdr = aMsgHdr;

        aTab.title = "";
        if(aTab.hdr.flags & MSG_FLAG_HAS_RE)
          aTab.title = "Re: ";
        if (aTab.hdr.mime2DecodedSubject)
          aTab.title += aTab.hdr.mime2DecodedSubject;

        aTab.title += " - " + aTab.hdr.folder.prettyName;
        if (this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + aTab.hdr.folder.server.prettyName;

        // let's try hiding the thread pane and folder pane
        this.folderAndThreadPaneVisible = false;

        this.openTab(aTab); // call superclass logic

        gCurrentlyDisplayedMessage = nsMsgViewIndex_None;
        ClearThreadPaneSelection();
        setTimeout(gDBView.selectFolderMsgByKey, 0, aTab.hdr.folder,
                   aTab.hdr.messageKey);
      },
      showTab: function(aTab) {
        this.folderAndThreadPaneVisible = false;
        this.showTab(aTab);
      }
    }
  },

  _getNumberOfRealAccounts : function() {
    let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
    let accountCount = mgr.accounts.Count();
    // If we have an account, we also always have a "Local Folders" account.
    return accountCount > 0 ? (accountCount - 1) : 0;
  },

  /**
   * Create the new tab's state, which engenders some side effects.  Part of our
   *  contract is that we leave the tab in the selected state.
   */
  openTab: function(aTab) {
    ClearThreadPaneSelection();

    // Each tab gets its own messenger instance; I assume this is so each one
    // gets its own undo/redo stack?
    messenger = Components.classes["@mozilla.org/messenger;1"]
                          .createInstance(Components.interfaces.nsIMessenger);
    messenger.setWindow(window, msgWindow);
    aTab.messenger = messenger;

    aTab.msgSelectedFolder = gMsgFolderSelected;

    // Clear selection, because context clicking on a folder and opening in a
    // new tab needs to have SelectFolder think the selection has changed.
    // We also need to clear these globals to subvert the code that prevents
    // folder loads when things haven't changed.
    var folderTree = document.getElementById("folderTree");
    folderTree.view.selection.clearSelection();
    folderTree.view.selection.currentIndex = -1;
    gMsgFolderSelected = null;
    msgWindow.openFolder = null;

    // Clear thread pane selection - otherwise, the tree tries to impose the
    // the current selection on the new view.
    gDBView = null; // clear gDBView so we won't try to close it.
    gFolderTreeView.selectFolder(GetMsgFolderFromUri(aTab.uriToOpen));
    aTab.dbView = gDBView;
  },

  closeTab: function(aTab) {
    if (aTab.dbView)
      aTab.dbView.close();
    if (aTab.messenger)
      aTab.messenger.setWindow(null, null);
  },

  saveTabState: function(aTab) {
    aTab.messenger = messenger;
    aTab.dbView = gDBView;
    aTab.searchSession = gSearchSession;
    aTab.msgSelectedFolder = gMsgFolderSelected;
    if (!gDBView)
      return;

    if (gDBView.currentlyDisplayedMessage != nsMsgViewIndex_None)
    {
      try // there may not be a selected message.
      {
        var curMsgHdr = gDBView.hdrForFirstSelectedMessage;
        aTab.selectedMsgId = curMsgHdr.messageId;
      }
      catch (ex) {}
    }
    else
    {
      aTab.selectedMsgId = null;
      aTab.msgSelectedFolder = gDBView.msgFolder;
    }
    if (aTab.msgSelectedFolder)
      aTab.mailView = GetMailViewForFolder(aTab.msgSelectedFolder);
  },

  _lastMessagePaneCollapsed: false,

  _displayFolderAndThreadPane: function(show) {
    let collapse = !show;
    let layout = pref.getIntPref("mail.pane_config.dynamic");
    if (layout == kWidePaneConfig)
    {
      document.getElementById("messengerBox").collapsed = collapse;
      // If opening a standalone message, need to give the messagepanebox flex.
      if (collapse)
        document.getElementById("messagepanebox").flex = 1;
    }

    if (layout == kVerticalPaneConfig)
      document.getElementById("threadTree").collapsed = collapse;
    else
      document.getElementById("displayDeck").collapsed = collapse;

    document.getElementById("threadpane-splitter").collapsed = collapse;
    document.getElementById("folderpane_splitter").collapsed = collapse;
    document.getElementById("folderPaneBox").collapsed = collapse;

    // Remember the state of the message pane before going to a message-only
    // view so that we can restore that state when going back to a normal
    // 3-pane view.
    let messagePane = document.getElementById("messagepanebox");
    if (!show) {
      this._lastMessagePaneCollapsed = messagePane.collapsed;
      messagePane.collapsed = false;
    }
    else if (this._lastMessagePaneCollapsed)
      messagePane.collapsed = true;

    try {
      document.getElementById("search-container").collapsed = collapse;
    } catch (ex) {}
    try {
      document.getElementById("mailviews-container").collapsed = collapse;
    } catch (ex) {}
  },

  _folderAndThreadPaneVisible: true,
  get folderAndThreadPaneVisible() { return this._folderAndThreadPaneVisible; },
  set folderAndThreadPaneVisible(aDesiredVisible) {
    if (aDesiredVisible != this._folderAndThreadPaneVisible) {
      this._displayFolderAndThreadPane(aDesiredVisible);
      this._folderAndThreadPaneVisible = aDesiredVisible;
    }
  },

  showTab: function(aTab) {
    // restore globals
    messenger = aTab.messenger;
    gDBView = aTab.dbView;
    gSearchSession = aTab.searchSession;

    // restore selection in folder pane;
    let folderToSelect = gDBView ? gDBView.msgFolder : aTab.msgSelectedFolder;
    // restore view state if we had one
    var row = gFolderTreeView.getIndexOfFolder(folderToSelect);

    var treeBoxObj = document.getElementById("folderTree").treeBoxObject;
    var folderTreeSelection = treeBoxObj.view.selection;
    // make sure that row.value is valid so that it doesn't mess up
    // the call to ensureRowIsVisible().
    if ((row >= 0) && !folderTreeSelection.isSelected(row))
    {
      gMsgFolderSelected = folderToSelect;
      folderTreeSelection.selectEventsSuppressed = true;
      folderTreeSelection.select(row);
      treeBoxObj.ensureRowIsVisible(row);
      folderTreeSelection.selectEventsSuppressed = false;
    }
    if (gDBView)
    {
      // This sets the thread pane tree's view to the gDBView view.
      UpdateSortIndicators(gDBView.sortType, gDBView.sortOrder);
      RerootThreadPane();
      // Only refresh the view picker if the views toolbar is visible.
      if (document.getElementById("mailviews-container")) 
        UpdateViewPickerByValue(aTab.mailView);

      // We need to restore the selection to what it was when we switched away
      // from this tab. We need to remember the selected keys, instead of the
      // selected indices, since the view might have changed. But maybe the
      // selectedIndices adjust as items are added/removed from the (hidden)
      // view.
      try
      {
        if (aTab.selectedMsgId && aTab.msgSelectedFolder)
        {
          // We clear the selection in order to generate an event when we
          // re-select our message.
          ClearThreadPaneSelection();

          var msgDB = aTab.msgSelectedFolder.getMsgDatabase(msgWindow);
          var msgHdr = msgDB.getMsgHdrForMessageID(aTab.selectedMsgId);
          setTimeout(gDBView.selectFolderMsgByKey, 0, aTab.msgSelectedFolder,
                     msgHdr.messageKey);
        }
        // We do not clear the selection if there was more than one message
        // displayed.  this leaves our selection intact. there was originally
        // some claim that the selection might lose synchronization with the
        // view, but this is unsubstantiated.  said comment came from the
        // original code that stored information on the selected rows, but
        // then failed to do anything with it, probably because there is no
        // existing API call that accomplishes it.
      }
      catch (ex) {dump(ex);}
      ShowThreadPane();
    }
    else if (gMsgFolderSelected.isServer)
    {
      UpdateStatusQuota(null);
      // Load AccountCentral page here.
      ShowAccountCentral();
    }
  }
};

function MsgOpenNewTabForFolder(uri, key)
{
  var uriToOpen = uri;
  var keyToSelect = key;

  if (!uriToOpen)
    // Use GetSelectedMsgFolders() to find out which folder to open instead of
    // GetLoadedMsgFolder().URI. This is required because on a right-click, the
    // currentIndex value will be different from the actual row that is
    // highlighted. GetSelectedMsgFolders() will return the message that is
    // highlighted.
    uriToOpen = GetSelectedMsgFolders()[0].URI;
  
  // set up the first tab, which was previously invisible.
  // This assumes the first tab is always a 3-pane ui, which
  // may not be right, especially if we have the ability
  // to persist your tab setup.
  document.getElementById('tabmail').openTab("folder", uriToOpen);
}

function MsgOpenNewTabForMessage(messageKey, folderUri)
{
  var hdr;

  // messageKey can be 0 for an actual message (first message in the folder)  
  if (folderUri)
  {
    hdr = GetMsgFolderFromUri(folderUri).GetMessageHeader(messageKey);
  }
  else
  {
    hdr = gDBView.hdrForFirstSelectedMessage;
    // Use the header's folder - this will open a msg in a virtual folder view
    // in its real folder, which is needed if the msg wouldn't be in a new
    // view with the same terms - e.g., it's read and the view is unread only.
    // If we cloned the view, we wouldn't have to do this.
    folderUri = hdr.folder.URI;
  }
  
  // Fix it so we won't try to load the previously loaded message.
  hdr.folder.lastMessageLoaded = nsMsgKey_None;

  document.getElementById('tabmail').openTab("message", folderUri, hdr);
}

function MsgOpenSelectedMessages()
{
  var dbView = GetDBView();

  var indices = GetSelectedIndices(dbView);
  var numMessages = indices.length;

  var windowReuse = gPrefBranch.getBoolPref("mailnews.reuse_message_window");
  // This is a radio type button pref, currently with only 2 buttons.
  // We need to keep the pref type as 'bool' for backwards compatibility
  // with 4.x migrated prefs.  For future radio button(s), please use another
  // pref (either 'bool' or 'int' type) to describe it.
  //
  // windowReuse values: false, true
  //    false: open new standalone message window for each message
  //    true : reuse existing standalone message window for each message
  if (windowReuse && numMessages == 1 &&
      MsgOpenSelectedMessageInExistingWindow())
    return;

  var openWindowWarning = gPrefBranch.getIntPref("mailnews.open_window_warning");
  if ((openWindowWarning > 1) && (numMessages >= openWindowWarning)) {
    if (!gMessengerBundle)
        gMessengerBundle = document.getElementById("bundle_messenger");
    var title = gMessengerBundle.getString("openWindowWarningTitle");
    var text = gMessengerBundle.getFormattedString("openWindowWarningText", [numMessages]);
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    if (!promptService.confirm(window, title, text))
      return;
  }

  for (var i = 0; i < numMessages; i++) {
    MsgOpenNewWindowForMessage(dbView.getURIForViewIndex(indices[i]),
                               dbView.getFolderForViewIndex(indices[i]).URI);
  }
}

function MsgOpenSelectedMessageInExistingWindow()
{
  var windowID = GetWindowByWindowType("mail:messageWindow");
  if (!windowID)
    return false;

  try {
    var messageURI = gDBView.URIForFirstSelectedMessage;
    var msgHdr = gDBView.hdrForFirstSelectedMessage;

    // Reset the window's message uri and folder uri vars, and
    // update the command handlers to what's going to be used.
    // This has to be done before the call to CreateView().
    windowID.gCurrentMessageUri = messageURI;
    windowID.gCurrentFolderUri = msgHdr.folder.URI;
    windowID.UpdateMailToolbar('MsgOpenExistingWindowForMessage');

    // Even if the folder uri's match, we can't use the existing view
    // (msgHdr.folder.URI == windowID.gCurrentFolderUri)
    // - the reason is quick search and mail views. See bug #187673.
    //
    // For the sake of simplicity, let's always call CreateView(gDBView);
    // which will clone gDBView.
    windowID.CreateView(gDBView);
    windowID.LoadMessageByMsgKey(msgHdr.messageKey);

    // bring existing window to front
    windowID.focus();
    return true;
  }
  catch (ex) {
    dump("reusing existing standalone message window failed: " + ex + "\n");
  }
  return false;
}

function MsgOpenFromFile()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService();
  strBundleService = strBundleService.QueryInterface(Components.interfaces.nsIStringBundleService);
  var extbundle = strBundleService.createBundle("chrome://messenger/locale/messenger.properties");
  var filterLabel = extbundle.GetStringFromName("EMLFiles");
  var windowTitle = extbundle.GetStringFromName("OpenEMLFiles");

  fp.init(window, windowTitle, nsIFilePicker.modeOpen);
  fp.appendFilter(filterLabel, "*.eml");

  // Default or last filter is "All Files".
  fp.appendFilters(nsIFilePicker.filterAll);

  try {
    var ret = fp.show();
    if (ret == nsIFilePicker.returnCancel)
      return;
  }
  catch (ex) {
    dump("filePicker.chooseInputFile threw an exception\n");
    return;
  }

  var uri = fp.fileURL.QueryInterface(Components.interfaces.nsIURL);
  uri.query = "type=application/x-message-display";

  window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank",
                    "all,chrome,dialog=no,status,toolbar", uri, null, null);
}

function MsgOpenNewWindowForMessage(messageUri, folderUri)
{
  if (!messageUri)
    // Use GetFirstSelectedMessage() to find out which message to open
    // instead of gDBView.getURIForViewIndex(currentIndex). This is
    // required because on a right-click, the currentIndex value will be
    // different from the actual row that is highlighted.
    // GetFirstSelectedMessage() will return the message that is
    // highlighted.
    messageUri = GetFirstSelectedMessage();

    if (!folderUri)
      // Use GetSelectedMsgFolders() to find out which message to open
      // instead of gDBView.getURIForViewIndex(currentIndex).  This is
      // required because on a right-click, the currentIndex value will be
      // different from the actual row that is highlighted.
      // GetSelectedMsgFolders() will return the message that is
      // highlighted.
      folderUri = GetSelectedMsgFolders()[0].URI;

  // be sure to pass in the current view....
  if (messageUri && folderUri) {
    window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank",
                      "all,chrome,dialog=no,status,toolbar",
                      messageUri, folderUri, gDBView);
  }
}

function MsgJunk()
{
  MsgJunkMailInfo(true);
  JunkSelectedMessages(!SelectedMessagesAreJunk());
}


function UpdateJunkButton()
{
  let hdr = gDBView.hdrForFirstSelectedMessage;
  let junkScore = hdr.getStringProperty("junkscore");
  let hideJunk = (junkScore != "") && (junkScore != "0");
  if (isNewsURI(hdr.folder.URI))
    hideJunk = true;
  // which DOM node is the current junk button in the
  // message reader depends on whether it's the collapsed or
  // expanded header
  let buttonBox = document.getElementById(gCollapsedHeaderViewMode ?
                     "collapsedButtonBox" : "expandedButtonBox");
  buttonBox.getButton('hdrJunkButton').disabled = hideJunk;
}

function MsgMarkMsgAsRead()
{
  MarkSelectedMessagesRead(!SelectedMessagesAreRead());
}

function MsgMarkAsFlagged()
{
  MarkSelectedMessagesFlagged(!SelectedMessagesAreFlagged());
}

function MsgMarkReadByDate()
{
  window.openDialog("chrome://messenger/content/markByDate.xul","",
                    "chrome,modal,titlebar,centerscreen",
                    GetLoadedMsgFolder());
}

function MsgMarkAllRead()
{
  var folder = GetSelectedMsgFolders()[0];

  if (folder)
    folder.markAllMessagesRead(msgWindow);
}

function MsgFilters(emailAddress, folder)
{
  if (!folder)
  {
    // Try to determine the folder from the selected message.
    if (gDBView)
    {
      try
      {
        var msgHdr = gDBView.hdrForFirstSelectedMessage;
        var accountKey = msgHdr.accountKey;
        if (accountKey.length > 0)
        {
          var account = accountManager.getAccount(accountKey);
          if (account)
          {
            var server = account.incomingServer;
            if (server)
              folder = server.rootFolder;
          }
        }
      }
      catch (ex) {}
    }
    if (!folder)
    {
      folder = GetFirstSelectedMsgFolder();
      // If this is the local folders account, check if the default account
      // defers to it; if so, we'll use the default account so the simple case
      // of one pop3 account with the global inbox creates filters for the right server.
      if (folder && folder.server.type == "none" && folder.server.isDeferredTo)
      {
        var defaultServer = accountManager.defaultAccount.incomingServer;
        if (defaultServer.rootMsgFolder == folder.server.rootFolder)
          folder = defaultServer.rootFolder;
      }
    }
  }
  var args;
  if (emailAddress)
  {
    // We have to do prefill filter so we are going to launch the
    // filterEditor dialog and prefill that with the emailAddress.
    args = { filterList: folder.getFilterList(msgWindow) };
    args.filterName = emailAddress;
    window.openDialog("chrome://messenger/content/FilterEditor.xul", "",
                      "chrome, modal, resizable,centerscreen,dialog=yes", args);

    // If the user hits ok in the filterEditor dialog we set args.refresh=true
    // there we check this here in args to show filterList dialog.
    if ("refresh" in args && args.refresh)
    {
      args = { refresh: true, folder: folder };
      MsgFilterList(args);
    }
  }
  else  // just launch filterList dialog
  {
    args = { refresh: false, folder: folder };
    MsgFilterList(args);
  }
}

function MsgApplyFilters()
{
  var filterService = Components.classes["@mozilla.org/messenger/services/filters;1"]
                                .getService(Components.interfaces.nsIMsgFilterService);

  var preselectedFolder = GetFirstSelectedMsgFolder();
  var selectedFolders = Components.classes["@mozilla.org/supports-array;1"]
                                  .createInstance(Components.interfaces.nsISupportsArray);
  selectedFolders.AppendElement(preselectedFolder);

  var curFilterList = preselectedFolder.getFilterList(msgWindow);
  // create a new filter list and copy over the enabled filters to it.
  // We do this instead of having the filter after the fact code ignore
  // disabled filters because the Filter Dialog filter after the fact
  // code would have to clone filters to allow disabled filters to run,
  // and we don't support cloning filters currently.
  var tempFilterList = filterService.getTempFilterList(preselectedFolder);
  var numFilters = curFilterList.filterCount;
  // make sure the temp filter list uses the same log stream
  tempFilterList.logStream = curFilterList.logStream;
  tempFilterList.loggingEnabled = curFilterList.loggingEnabled;
  var newFilterIndex = 0;
  for (var i = 0; i < numFilters; i++)
  {
    var curFilter = curFilterList.getFilterAt(i);
    // only add enabled, UI visibile filters that are in the manual context
    if (curFilter.enabled && !curFilter.temporary &&
        (curFilter.filterType & Components.interfaces.nsMsgFilterType.Manual))
    {
      tempFilterList.insertFilterAt(newFilterIndex, curFilter);
      newFilterIndex++;
    }
  }
  filterService.applyFiltersToFolders(tempFilterList, selectedFolders, msgWindow);
}

function MsgApplyFiltersToSelection()
{
  var filterService = Components.classes["@mozilla.org/messenger/services/filters;1"]
                                .getService(Components.interfaces.nsIMsgFilterService);

  var folder = gDBView.msgFolder;
  var indices = GetSelectedIndices(gDBView);
  if (indices && indices.length)
  {
    var selectedMsgs = Components.classes["@mozilla.org/array;1"]
                                 .createInstance(Components.interfaces.nsIMutableArray);
    for (var i = 0; i < indices.length; i++)
    {
      try
      {
        // Getting the URI will tell us if the item is real or a dummy header
        var uri = gDBView.getURIForViewIndex(indices[i]);
        if (uri)
        {
          var msgHdr = folder.GetMessageHeader(gDBView.getKeyAt(indices[i]));
          if (msgHdr)
            selectedMsgs.appendElement(msgHdr, false);
        }
      } catch (ex) {}
    }

    filterService.applyFilters(Components.interfaces.nsMsgFilterType.Manual,
                               selectedMsgs,
                               folder,
                               msgWindow);
  }
}

function ChangeMailLayout(newLayout)
{
  gPrefBranch.setIntPref("mail.pane_config.dynamic", newLayout);
}

function MsgViewAllHeaders()
{
  gPrefBranch.setIntPref("mail.show_headers", 2);
  ReloadMessage();
}

function MsgViewNormalHeaders()
{
  gPrefBranch.setIntPref("mail.show_headers", 1);
  ReloadMessage();
}

function MsgBodyAllowHTML()
{
  gPrefBranch.setBoolPref("mailnews.display.prefer_plaintext", false);
  gPrefBranch.setIntPref("mailnews.display.html_as", 0);
  gPrefBranch.setIntPref("mailnews.display.disallow_mime_handlers", 0);
  ReloadMessage();
}

function MsgBodySanitized()
{
  gPrefBranch.setBoolPref("mailnews.display.prefer_plaintext", false);
  gPrefBranch.setIntPref("mailnews.display.html_as", 3);
  gPrefBranch.setIntPref("mailnews.display.disallow_mime_handlers",
                         gDisallow_classes_no_html);
  ReloadMessage();
}

function MsgBodyAsPlaintext()
{
  gPrefBranch.setBoolPref("mailnews.display.prefer_plaintext", true);
  gPrefBranch.setIntPref("mailnews.display.html_as", 1);
  gPrefBranch.setIntPref("mailnews.display.disallow_mime_handlers",
                         gDisallow_classes_no_html);
  ReloadMessage();
}

function ToggleInlineAttachment(target)
{
  var viewAttachmentInline = !pref.getBoolPref("mail.inline_attachments");
  pref.setBoolPref("mail.inline_attachments", viewAttachmentInline)
  target.setAttribute("checked", viewAttachmentInline ? "true" : "false");
  ReloadMessage();
}

function PrintEnginePrintInternal(doPrintPreview, msgType)
{
  var messageList = GetSelectedMessages();
  if (messageList.length == 0) {
    dump("PrintEnginePrintInternal(): No messages selected.\n");
    return;
  }

  window.openDialog("chrome://messenger/content/msgPrintEngine.xul", "",
                    "chrome,dialog=no,all,centerscreen",
                    messageList.length, messageList, statusFeedback,
                    doPrintPreview, msgType, window);
}

function PrintEnginePrint()
{
  return PrintEnginePrintInternal(false,
    Components.interfaces.nsIMsgPrintEngine.MNAB_PRINT_MSG);
}

function PrintEnginePrintPreview()
{
  return PrintEnginePrintInternal(true,
    Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG);
}

function IsMailFolderSelected()
{
  var selectedFolders = GetSelectedMsgFolders();
  var folder = selectedFolders.length ? selectedFolders[0] : null;
  return folder && folder.server.type != "nntp";
}

function IsGetNextNMessagesEnabled()
{
  var selectedFolders = GetSelectedMsgFolders();
  var folder = selectedFolders.length ? selectedFolders[0] : null;

  var menuItem = document.getElementById("menu_getnextnmsg");
  if (folder && (folder.server.type == "nntp") && !folder.isServer) {
    var newsServer = server.QueryInterface(Components.interfaces.nsINntpIncomingServer);
    var menuLabel = gMessengerBundle.getFormattedString("getNextNMessages",
                                                        [newsServer.maxArticles]);
    menuItem.setAttribute("label", menuLabel);
    menuItem.removeAttribute("hidden");
    return true;
  }

  menuItem.setAttribute("hidden","true");
  return false;
}

function IsCompactFolderEnabled()
{
  var folder = GetSelectedMsgFolders()[0];
  if (!folder)
    return;
  let server = folder.server;
  return (server &&
      (server.type != 'nntp') && // compact news folder is not supported
      ((server.type != 'imap') || server.canCompactFoldersOnServer) &&
      isCommandEnabled("cmd_compactFolder")); // checks e.g. if IMAP is offline
}

function SetUpToolbarButtons(uri)
{
  var deleteButton = document.getElementById("button-delete");
  if (!deleteButton)
    return;

  // Eventually, we might want to set up the toolbar differently for imap,
  // pop, and news.  For now, just tweak it based on if it is news or not.
  if (isNewsURI(uri))
    deleteButton.setAttribute('hidden', true);
  else
    deleteButton.removeAttribute('hidden');
}

function MsgSynchronizeOffline()
{
  window.openDialog("chrome://messenger/content/msgSynchronize.xul", "",
                    "centerscreen,chrome,modal,titlebar,resizable=yes",
                    {msgWindow:msgWindow});
}

function SpaceHit(event)
{
  var contentWindow = window.top._content;
  var rssiframe = contentWindow.document.getElementById('_mailrssiframe');

  // if we are displaying an RSS article, we really want to scroll the nested iframe
  if (rssiframe)
    contentWindow = rssiframe.contentWindow;

  if (event && event.shiftKey) {
    // if at the start of the message, go to the previous one
    if (contentWindow.scrollY > 0)
      contentWindow.scrollByPages(-1);
    else
      goDoCommand("cmd_previousUnreadMsg");
  }
  else {
    // if at the end of the message, go to the next one
    if (contentWindow.scrollY < contentWindow.scrollMaxY)
      contentWindow.scrollByPages(1);
    else
      goDoCommand("cmd_nextUnreadMsg");
  }
}

function IsAccountOfflineEnabled()
{
  var selectedFolders = GetSelectedMsgFolders();

  if (selectedFolders && (selectedFolders.length == 1))
      return selectedFolders[0].supportsOffline;
  return false;
}

function GetDefaultAccountRootFolder()
{
  try {
    var account = accountManager.defaultAccount;
    var defaultServer = account.incomingServer;
    var defaultFolder = defaultServer.rootMsgFolder;
    return defaultFolder;
  }
  catch (ex) {
  }
  return null;
}

function GetFolderMessages()
{
  var selectedFolders = GetSelectedMsgFolders();
  var defaultAccountRootFolder = GetDefaultAccountRootFolder();

  // if no default account, get msg isn't going do anything anyways
  // so bail out
  if (!defaultAccountRootFolder)
    return;

  // if nothing selected, use the default
  var folder = selectedFolders.length ? selectedFolders[0] : defaultAccountRootFolder;

  var serverType = folder.server.type;

  if (folder.isServer && (serverType == "nntp")) {
    // if we're doing "get msgs" on a news server
    // update unread counts on this server
    folder.server.performExpand(msgWindow);
    return;
  }
  else if (serverType == "none") {
    // If "Local Folders" is selected and the user does "Get Msgs" and
    // LocalFolders is not deferred to, get new mail for the default account
    //
    // XXX TODO
    // Should shift click get mail for all (authenticated) accounts?
    // see bug #125885.
    if (!folder.server.isDeferredTo)
      folder = defaultAccountRootFolder;
  }

  var folders = new Array(1);
  folders[0] = folder;

  GetNewMessages(folders, folder.server);
}

function SendUnsentMessages()
{
  var msgSendlater = Components.classes["@mozilla.org/messengercompose/sendlater;1"]
                               .getService(Components.interfaces.nsIMsgSendLater);

  var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                 .getService(Components.interfaces.nsIMsgAccountManager);
  var allIdentities = accountManager.allIdentities;
  var identitiesCount = allIdentities.Count();
  for (var i = 0; i < identitiesCount; i++) {
    var currentIdentity = allIdentities.QueryElementAt(i, Components.interfaces.nsIMsgIdentity);
    var msgFolder = msgSendlater.getUnsentMessagesFolder(currentIdentity);
    if (msgFolder) {
      var numMessages = msgFolder.getTotalMessages(false /* include subfolders */);
      if(numMessages > 0) {
        messenger.sendUnsentMessages(currentIdentity, msgWindow);
        // Right now, all identities point to the same unsent messages
        // folder, so to avoid sending multiple copies of the
        // unsent messages, we only call messenger.SendUnsentMessages() once.
        // See bug #89150 for details.
        break;
      }
    }
  }
}

function CoalesceGetMsgsForPop3ServersByDestFolder(currentServer,
                                                   pop3DownloadServersArray,
                                                   localFoldersToDownloadTo)
{
  var outNumFolders = new Object();
  const kInboxFlag = Components.interfaces.nsMsgFolderFlags.Inbox;
  var inboxFolder = currentServer.rootMsgFolder.getFolderWithFlags(kInboxFlag);
  // coalesce the servers that download into the same folder...
  var index = localFoldersToDownloadTo.GetIndexOf(inboxFolder);
  if (index == -1)
  {
    if (inboxFolder)
    {
      inboxFolder.biffState =  Components.interfaces.nsIMsgFolder.nsMsgBiffState_NoMail;
      inboxFolder.clearNewMessages();
    }
    localFoldersToDownloadTo.AppendElement(inboxFolder);
    index = pop3DownloadServersArray.length
    pop3DownloadServersArray[index] = Components.classes["@mozilla.org/supports-array;1"]
                                                .createInstance(Components.interfaces.nsISupportsArray);
  }
  pop3DownloadServersArray[index].AppendElement(currentServer);
}

function GetMessagesForAllAuthenticatedAccounts()
{
  // now log into any server
  try
  {
    var allServers = accountManager.allServers;
    // array of isupportsarrays of servers for a particular folder
    var pop3DownloadServersArray = new Array();
    // parallel isupports array of folders to download to...
    var localFoldersToDownloadTo = Components.classes["@mozilla.org/supports-array;1"]
                                             .createInstance(Components.interfaces.nsISupportsArray);
    var pop3Server;

    for (var i = 0; i < allServers.Count(); ++i)
    {
      var currentServer = allServers.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgIncomingServer);
      var protocolinfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + currentServer.type]
                                   .getService(Components.interfaces.nsIMsgProtocolInfo);
      if (protocolinfo.canGetMessages && !currentServer.passwordPromptRequired)
      {
        if (currentServer.type == "pop3")
        {
          CoalesceGetMsgsForPop3ServersByDestFolder(currentServer,
            pop3DownloadServersArray, localFoldersToDownloadTo);
          pop3Server = currentServer.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
        }
        else
        // get new messages on the server for imap or rss
          GetMessagesForInboxOnServer(currentServer);
      }
    }
    for (var i = 0; i < pop3DownloadServersArray.length; ++i)
    {
      // any ol' pop3Server will do - the serversArray specifies which servers to download from
      pop3Server.downloadMailFromServers(pop3DownloadServersArray[i], msgWindow,
                                         localFoldersToDownloadTo.GetElementAt(i), null);
    }
  }
  catch(ex)
  {
      dump(ex + "\n");
  }
}

function CommandUpdate_UndoRedo()
{
  EnableMenuItem("menu_undo", SetupUndoRedoCommand("cmd_undo"));
  EnableMenuItem("menu_redo", SetupUndoRedoCommand("cmd_redo"));
}

function SetupUndoRedoCommand(command)
{
  // If we have selected a server, and are viewing account central
  // there is no loaded folder.
  var loadedFolder = GetLoadedMsgFolder();
  if (!loadedFolder || !loadedFolder.server.canUndoDeleteOnServer)
    return false;

  var canUndoOrRedo;
  var txnType;
  if (command == "cmd_undo")
  {
    canUndoOrRedo = messenger.canUndo();
    txnType = messenger.getUndoTransactionType();
  }
  else
  {
    canUndoOrRedo = messenger.canRedo();
    txnType = messenger.getRedoTransactionType();
  }

  if (canUndoOrRedo)
  {
    var commands = 
      ['valueDefault', 'valueDeleteMsg', 'valueMoveMsg', 'valueCopyMsg', 'valueUnmarkAllMsgs'];
    goSetMenuValue(command, commands[txnType]);
  }
  else
  {
    goSetMenuValue(command, 'valueDefault');
  }
  return canUndoOrRedo;
}

function HandleJunkStatusChanged(folder)
{
  // This might be the stand alone window, open to a message that was
  // and attachment (or on disk), in which case, we want to ignore it.
  var loadedMessage = GetLoadedMessage();
  if (!loadedMessage || (/type=application\/x-message-display/.test(loadedMessage)) ||
      !IsCurrentLoadedFolder(folder))
    return;

  // If multiple message are selected and we change the junk status
  // we don't want to show the junk bar (since the message pane is blank).
  var msgHdr = null;
  if (GetNumSelectedMessages() == 1)
    msgHdr = messenger.msgHdrFromURI(loadedMessage);
  var junkBarWasDisplayed = gMessageNotificationBar.isFlagSet(kMsgNotificationJunkBar);
  gMessageNotificationBar.setJunkMsg(msgHdr);

  // Only reload message if junk bar display state has changed.
  if (msgHdr && junkBarWasDisplayed != gMessageNotificationBar.isFlagSet(kMsgNotificationJunkBar))
  {
    // We may be forcing junk mail to be rendered with sanitized html.
    // In that scenario, we want to reload the message if the status has just
    // changed to not junk.
    var sanitizeJunkMail = gPrefBranch.getBoolPref("mail.spam.display.sanitize");

    // Only bother doing this if we are modifying the html for junk mail....
    if (sanitizeJunkMail)
    {
      var moveJunkMail = (folder && folder.server && folder.server.spamSettings) ?
                          folder.server.spamSettings.manualMark : false;

      var junkScore = msgHdr.getStringProperty("junkscore");
      var isJunk = (junkScore == "") || (junkScore == "0");

      // We used to only reload the message if we were toggling the message
      // to NOT JUNK from junk but it can be useful to see the HTML in the
      // message get converted to sanitized form when a message is marked as
      // junk. Furthermore, if we are about to move the message that was just
      // marked as junk then don't bother reloading it.
      if (!(isJunk && moveJunkMail))
        ReloadMessage();
    }
  }
}

var gMessageNotificationBar =
{
  mBarStatus: 0,
  // flag bit values for mBarStatus, indexed by kMsgNotificationXXX
  mBarFlagValues: [
                    0, // for no msgNotificationBar
                    1, // 1 << (kMsgNotificationPhishingBar - 1)
                    2, // 1 << (kMsgNotificationJunkBar - 1)
                    4  // 1 << (kMsgNotificationRemoteImages - 1)
                  ],

  mMsgNotificationBar: document.getElementById('msgNotificationBar'),

  setJunkMsg: function(aMsgHdr)
  {
    var isJunk = false;

    if (aMsgHdr)
    {
      var junkScore = aMsgHdr.getStringProperty("junkscore"); 
      isJunk = ((junkScore != "") && (junkScore != "0"));
    }

    this.updateMsgNotificationBar(kMsgNotificationJunkBar, isJunk);

    goUpdateCommand('button_junk');
  },

  setRemoteContentMsg: function(aMsgHdr)
  {
    // update the allow remote content for sender string
    var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                 .getService(Components.interfaces.nsIMsgHeaderParser);
    var emailAddress = headerParser.extractHeaderAddressMailboxes(aMsgHdr.author);
    document.getElementById('allowRemoteContentForAuthorDesc').value =
      gMessengerBundle.getFormattedString('alwaysLoadRemoteContentForSender1',
                         [emailAddress ? emailAddress : aMsgHdr.author]);
    this.updateMsgNotificationBar(kMsgNotificationRemoteImages, true);
  },

  setPhishingMsg: function()
  {
    this.updateMsgNotificationBar(kMsgNotificationPhishingBar, true);
  },

  clearMsgNotifications: function()
  {
    this.mBarStatus = 0;
    this.mMsgNotificationBar.selectedIndex = 0;
    this.mMsgNotificationBar.collapsed = true;
  },

  updateMsgNotificationBar: function(aIndex, aSet)
  {
    var chunk = this.mBarFlagValues[aIndex];
    var status = aSet ? this.mBarStatus | chunk : this.mBarStatus & ~chunk;
    this.mBarStatus = status;

    // the phishing message takes precedence over the junk message
    // which takes precedence over the remote content message
    this.mMsgNotificationBar.selectedIndex = this.mBarFlagValues.indexOf(status & -status);
    this.mMsgNotificationBar.collapsed = !status;
  },

  /**
   * @param aFlag (kMsgNotificationPhishingBar, kMsgNotificationJunkBar, kMsgNotificationRemoteImages
   * @return true if aFlag is currently set for the loaded message
   */
  isFlagSet: function(aFlag)
  {
    var chunk = this.mBarFlagValues[aFlag];
    return this.mBarStatus & chunk;
  }
};

/**
 * LoadMsgWithRemoteContent
 *   Reload the current message, allowing remote content
 */
function LoadMsgWithRemoteContent()
{
  // we want to get the msg hdr for the currently selected message
  // change the "remoteContentBar" property on it
  // then reload the message

  setMsgHdrPropertyAndReload("remoteContentPolicy", kAllowRemoteContent);
}

/**
 * Returns the msg hdr associated with the current loaded message.
 */
function msgHdrForCurrentMessage()
{
  var msgURI = GetLoadedMessage();
  return (msgURI && !(/type=application\/x-message-display/.test(msgURI))) ? messenger.msgHdrFromURI(msgURI) : null;
}

/**
 *  Reloads the message after adjusting the remote content policy for the sender.
 *  Iterate through the local address books looking for a card with the same e-mail address as the 
 *  sender of the current loaded message. If we find a card, update the allow remote content field.
 *  If we can't find a card, prompt the user with a new AB card dialog, pre-selecting the remote content field.
 */
function allowRemoteContentForSender()
{
  // get the sender of the msg hdr
  var msgHdr = msgHdrForCurrentMessage();
  if (!msgHdr)
    return;

  var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                               .getService(Components.interfaces.nsIMsgHeaderParser);
  var names = {};
  var addresses = {};
  var fullNames = {};
  var numAddresses;

  numAddresses = headerParser.parseHeadersWithArray(msgHdr.author, addresses, names, fullNames);
  var authorEmailAddress = addresses.value[0];
  if (!authorEmailAddress)
    return;

  // search through all of our local address books looking for a match.
  var enumerator = Components.classes["@mozilla.org/abmanager;1"]
                             .getService(Components.interfaces.nsIAbManager)
                             .directories;
  var cardForEmailAddress;
  var addrbook;
  while (!cardForEmailAddress && enumerator.hasMoreElements())
  {
    addrbook = enumerator.getNext()
                         .QueryInterface(Components.interfaces.nsIAbDirectory);
    try {
      cardForEmailAddress = addrbook.cardForEmailAddress(authorEmailAddress);
    } catch (e) {}
  }

  var allowRemoteContent = false;
  if (cardForEmailAddress)
  {
    // set the property for remote content
    cardForEmailAddress.setProperty("AllowRemoteContent", true);
    addrbook.modifyCard(cardForEmailAddress);
    allowRemoteContent = true;
  }
  else
  {
    var args = {primaryEmail:authorEmailAddress, displayName:names.value[0],
                allowRemoteContent:true};
    // create a new card and set the property
    window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                      "", "chrome,resizable=no,titlebar,modal,centerscreen", args);
    allowRemoteContent = args.allowRemoteContent;
  }

  // Reload the message if we've updated the remote content policy for the sender.
  if (allowRemoteContent)
    ReloadMessage();
}

/**
 *  Set the msg hdr flag to ignore the phishing warning and reload the message.
 */
function IgnorePhishingWarning()
{
  // This property should really be called skipPhishingWarning or something
  // like that, but it's too late to change that now.
  // This property is used to supress the phishing bar for the message.
  setMsgHdrPropertyAndReload("notAPhishMessage", 1);
}

function setMsgHdrPropertyAndReload(aProperty, aValue)
{
  // we want to get the msg hdr for the currently selected message
  // change the appropiate property on it then reload the message
  var msgHdr = msgHdrForCurrentMessage();
  if (msgHdr)
  {
    msgHdr.setUint32Property(aProperty, aValue);
    ReloadMessage();
  }
}

function MarkCurrentMessageAsRead()
{
  ClearPendingReadTimer();
  gDBView.doCommand(nsMsgViewCommandType.markMessagesRead);
}

function ClearPendingReadTimer()
{
  if (gMarkViewedMessageAsReadTimer)
  {
    clearTimeout(gMarkViewedMessageAsReadTimer);
    gMarkViewedMessageAsReadTimer = null;
  }
}

// this is called when layout is actually finished rendering a 
// mail message. OnMsgLoaded is called when libmime is done parsing the message
function OnMsgParsed(aUrl)
{
  // browser doesn't do this, but I thought it could be a useful thing to test out...
  // If the find bar is visible and we just loaded a new message, re-run 
  // the find command. This means the new message will get highlighted and
  // we'll scroll to the first word in the message that matches the find text.
  var findBar = document.getElementById("FindToolbar");
  if (!findBar.hidden)
    findBar.onFindAgainCommand(false);

  // Run the phishing detector on the message if it hasn't been marked as not
  // a scam already.
  var msgHdr = msgHdrForCurrentMessage();
  if (msgHdr && !msgHdr.getUint32Property("notAPhishMessage"))
    gPhishingDetector.analyzeMsgForPhishingURLs(aUrl);

  // notify anyone (e.g., extensions) who's interested in when a message is loaded.
  var msgURI = GetLoadedMessage();
  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                  .getService(Components.interfaces.nsIObserverService);
  observerService.notifyObservers(msgWindow.msgHeaderSink, "MsgMsgDisplayed", msgURI);

  // scale any overflowing images
  var doc = document.getElementById("messagepane").contentDocument;
  var imgs = doc.getElementsByTagName("img");
  for each (var img in imgs)
  {
    if (img.className == "moz-attached-image" && img.naturalWidth > doc.width)
    {
      if (img.hasAttribute("shrinktofit"))
        img.setAttribute("isshrunk", "true");
      else
        img.setAttribute("overflowing", "true");
    }
  }
}

function OnMsgLoaded(aUrl)
{
  if (!aUrl)
    return;

  // nsIMsgMailNewsUrl.folder throws an error when opening .eml files.
  var folder;
  try {
    folder = aUrl.folder;
  }
  catch (ex) {}

  var msgURI = GetLoadedMessage();

  if (!folder || !msgURI)
    return;

  // If we are in the middle of a delete or move operation, make sure that
  // if the user clicks on another message then that message stays selected
  // and the selection does not "snap back" to the message chosen by
  // SetNextMessageAfterDelete() when the operation completes (bug 243532).
  // But the just loaded message might be getting deleted, if the user
  // deletes it before the message is loaded (bug 183394).
  var wintype = document.documentElement.getAttribute('windowtype');
  if (wintype == "mail:messageWindow" ||
      GetThreadTree().view.selection.currentIndex != gSelectedIndexWhenDeleting)
    gNextMessageViewIndexAfterDelete = -2;

  var msgHdr = msgHdrForCurrentMessage();
  gMessageNotificationBar.setJunkMsg(msgHdr);

  goUpdateCommand('button_delete');

  var markReadAutoMode = gPrefBranch.getBoolPref("mailnews.mark_message_read.auto");

  // We just finished loading a message. If messages are to be marked as read
  // automatically, set a timer to mark the message is read after n seconds
  // where n can be configured by the user.
  if (msgHdr && !msgHdr.isRead && markReadAutoMode)
  {
    let markReadOnADelay = gPrefBranch.getBoolPref("mailnews.mark_message_read.delay");

    // Only use the timer if viewing using the 3-pane preview pane and the
    // user has set the pref.
    if (markReadOnADelay && wintype == "mail:3pane") // 3-pane window
    {
      ClearPendingReadTimer();
      let markReadDelayTime = gPrefBranch.getIntPref("mailnews.mark_message_read.delay.interval");
      if (markReadDelayTime == 0)
        MarkCurrentMessageAsRead();
      else
        gMarkViewedMessageAsReadTimer = setTimeout(MarkCurrentMessageAsRead,
                                                   markReadDelayTime * 1000);
    }
    else // standalone msg window
      MarkCurrentMessageAsRead();
  }

  // See if MDN was requested but has not been sent.
  HandleMDNResponse(aUrl);

  if (!IsImapMessage(msgURI))
    return;

  var imapServer = folder.server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
  if (imapServer.storeReadMailInPFC)
  {
    // Look in read mail PFC for msg with same msg id - if we find one,
    // don't put this message in the read mail pfc.
    var outputPFC = imapServer.GetReadMailPFC(true);

    if (msgHdr && msgHdr.messageId.length > 0)
    {
      var readMailDB = outputPFC.getMsgDatabase(msgWindow);
      if (readMailDB && readMailDB.getMsgHdrForMessageID(msgHdr.messageId))
        return; // Don't copy to offline folder.
    }

    var messages = Components.classes["@mozilla.org/array;1"]
                              .createInstance(Components.interfaces.nsIMutableArray);
    messages.appendElement(msgHdr, false);
    outputPFC.copyMessages(folder, messages, false /*isMove*/,
                            msgWindow /*nsIMsgWindow*/, null /*listener*/,
                            false /*isFolder*/, false /*allowUndo*/);
  }
}

/**
 * This function handles all mdn response generation (ie, imap and pop).
 * For pop the msg uid can be 0 (ie, 1st msg in a local folder) so no
 * need to check uid here. No one seems to set mimeHeaders to null so
 * no need to check it either.
 */
function HandleMDNResponse(aUrl)
{
  if (!aUrl)
    return;

  var msgFolder = aUrl.folder;
  var msgURI = GetLoadedMessage();
  if (!msgFolder || !msgURI || IsNewsMessage(msgURI))
    return;

  // if the message is marked as junk, do NOT attempt to process a return receipt
  // in order to better protect the user
  if (SelectedMessagesAreJunk())
    return;

  var msgHdr = messenger.msgHdrFromURI(msgURI);
  var mimeHdr;

  try {
    mimeHdr = aUrl.mimeHeaders;
  } catch (ex) {
    return;
  }

  // If we didn't get the message id when we downloaded the message header,
  // we cons up an md5: message id. If we've done that, we'll try to extract
  // the message id out of the mime headers for the whole message.
  var msgId = msgHdr.messageId;
  if (msgId.split(":")[0] == "md5")
  {
    var mimeMsgId = mimeHdr.extractHeader("Message-Id", false);
    if (mimeMsgId)
      msgHdr.messageId = mimeMsgId;
  }

  // After a msg is downloaded it's already marked READ at this point so we must check if
  // the msg has a "Disposition-Notification-To" header and no MDN report has been sent yet.
  const MSG_FLAG_MDN_REPORT_SENT = 0x800000;
  var msgFlags = msgHdr.flags;
  if ((msgFlags & MSG_FLAG_IMAP_DELETED) || (msgFlags & MSG_FLAG_MDN_REPORT_SENT))
    return;

  var DNTHeader = mimeHdr.extractHeader("Disposition-Notification-To", false);
  var oldDNTHeader = mimeHdr.extractHeader("Return-Receipt-To", false);
  if (!DNTHeader && !oldDNTHeader)
    return;

  // Everything looks good so far, let's generate the MDN response.
  var mdnGenerator = Components.classes["@mozilla.org/messenger-mdn/generator;1"]
                               .createInstance(Components.interfaces.nsIMsgMdnGenerator);
  const MDN_DISPOSE_TYPE_DISPLAYED = 0;
  mdnGenerator.process(MDN_DISPOSE_TYPE_DISPLAYED, msgWindow, msgFolder,
                       msgHdr.messageKey, mimeHdr, false);

  // Reset mark msg MDN "Sent" and "Not Needed".
  const MSG_FLAG_MDN_REPORT_NEEDED = 0x400000;
  msgHdr.flags = (msgFlags & ~MSG_FLAG_MDN_REPORT_NEEDED);
  msgHdr.OrFlags(MSG_FLAG_MDN_REPORT_SENT);

  // Commit db changes.
  var msgdb = msgFolder.getMsgDatabase(msgWindow);
  if (msgdb)
    msgdb.Commit(ADDR_DB_LARGE_COMMIT);
}

function QuickSearchFocus() 
{
  var quickSearchTextBox = document.getElementById('searchInput');
  if (quickSearchTextBox)
    quickSearchTextBox.focus();
}

function MsgSearchMessages()
{
  var preselectedFolder = null;
  if ("GetFirstSelectedMsgFolder" in window)
    preselectedFolder = GetFirstSelectedMsgFolder();

  var args = { folder: preselectedFolder };
  OpenOrFocusWindow(args, "mailnews:search", "chrome://messenger/content/SearchDialog.xul");
}

function MsgJunkMailInfo(aCheckFirstUse)
{
  if (aCheckFirstUse) {
    if (!pref.getBoolPref("mailnews.ui.junk.firstuse"))
      return;
    pref.setBoolPref("mailnews.ui.junk.firstuse", false);

    // check to see if this is an existing profile where the user has started using
    // the junk mail feature already
    var junkmailPlugin = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                   .getService(Components.interfaces.nsIJunkMailPlugin);
    if (junkmailPlugin.userHasClassified)
      return;
  }

  var desiredWindow = GetWindowByWindowType("mailnews:junkmailinfo");

  if (desiredWindow)
    desiredWindow.focus();
  else
    window.openDialog("chrome://messenger/content/junkMailInfo.xul",
                      "mailnews:junkmailinfo",
                      "centerscreen,resizeable=no,titlebar,chrome,modal", null);
}

function MsgSearchAddresses()
{
  var args = { directory: null };
  OpenOrFocusWindow(args, "mailnews:absearch", "chrome://messenger/content/ABSearchDialog.xul");
}
 
function MsgFilterList(args)
{
  OpenOrFocusWindow(args, "mailnews:filterlist", "chrome://messenger/content/FilterListDialog.xul");
}

function GetWindowByWindowType(windowType)
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
                                .getService(Components.interfaces.nsIWindowMediator);
  return windowManager.getMostRecentWindow(windowType);
}

function OpenOrFocusWindow(args, windowType, chromeURL)
{
  var desiredWindow = GetWindowByWindowType(windowType);

  if (desiredWindow) {
    desiredWindow.focus();
    if ("refresh" in args && args.refresh)
      desiredWindow.refresh();
  }
  else
    window.openDialog(chromeURL, "", "chrome,resizable,status,centerscreen,dialog=no", args);
}
