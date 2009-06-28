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
 *   timeless
 *   slucy@objectivesw.co.uk
 *   Håkan Waara <hwaara@chello.se>
 *   Jan Varga <varga@nixcorp.com>
 *   Seth Spitzer <sspitzer@netscape.com>
 *   David Bienvenu <bienvenu@nventure.com>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
 *   Christopher Thomas <cst@yecc.com>
 *   Jeremy Morton <bugzilla@game-point.net>
 *   Andrew Sutherland <asutherland@asutherland.org>
 *   Dan Mosedale <dmose@mozilla.org>
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

Components.utils.import("resource://app/modules/gloda/dbview.js");

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

Components.utils.import("resource://app/modules/MailUtils.js");
Components.utils.import("resource://app/modules/MailConsts.js");

var gMessengerBundle;
var gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefService)
                            .getBranch(null);
var gCopyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                     .getService(Components.interfaces.nsIMsgCopyService);

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
  var folders = gFolderTreeView.getSelectedFolders();
  if (folders.length != 1)
    return;

  var folder = folders[0];

  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  if (gPrefBranch.prefIsLocked("mail.disable_new_account_addition"))
    document.getElementById("newAccountMenuItem").setAttribute("disabled", "true");

  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  var isInbox = folder.isSpecialFolder(nsMsgFolderFlags.Inbox);
  var showNew = folder.canCreateSubfolders || isInbox;
  ShowMenuItem("menu_newFolder", showNew);
  ShowMenuItem("menu_newVirtualFolder", showNew);

  EnableMenuItem("menu_newFolder", folder.server.type != "imap" || MailOfflineMgr.isOnline());
  if (showNew)
    // Change "New Folder..." menu according to the context.
    SetMenuItemLabel("menu_newFolder", gMessengerBundle.getString(
      (folder.isServer || isInbox) ? "newFolderMenuItem" : "newSubfolderMenuItem"));
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
  if (!favoriteFolderMenu.disabled)
  {
    var folders = gFolderTreeView.getSelectedFolders();
    if (folders.length == 1 && !folders[0].isServer)
    {
      const kFavoriteFlag = Components.interfaces.nsMsgFolderFlags.Favorite;
      // Adjust the checked state on the menu item.
      favoriteFolderMenu.setAttribute("checked", folders[0].getFlag(kFavoriteFlag));
      favoriteFolderMenu.hidden = false;
    }
    else
    {
      favoriteFolderMenu.hidden = true;
    }
  }
}

function InitGoMessagesMenu()
{
  document.commandDispatcher.updateCommands('create-menu-go');
}

/**
 * This is called every time the view menu popup is displayed.  It is
 *  responsible for updating the menu items' state to reflect reality.
 */
function view_init()
{
  var isFeed = gFolderDisplay.selectedMessageIsFeed;

  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  let accountCentralDisplayed = gFolderDisplay.isAccountCentralDisplayed;
  var messagePaneMenuItem = document.getElementById("menu_showMessage");
  if (!messagePaneMenuItem.hidden) { // Hidden in the standalone msg window.
    messagePaneMenuItem.setAttribute("checked",
      accountCentralDisplayed ? false : gMessageDisplay.visible);
    messagePaneMenuItem.disabled = accountCentralDisplayed;
  }

  // Disable some menus if account manager is showing
  document.getElementById("viewSortMenu").disabled = accountCentralDisplayed;
  document.getElementById("viewMessageViewMenu").disabled = accountCentralDisplayed;
  document.getElementById("viewMessagesMenu").disabled = accountCentralDisplayed;

  // Hide the views menu item if the user doesn't have the views toolbar button
  // visible.
  var viewsToolbarButton = document.getElementById("mailviews-container");
  document.getElementById('viewMessageViewMenu').hidden = !viewsToolbarButton;

  // ... and also the separator.
  document.getElementById("viewMenuAfterTaskbarSeparator").hidden = !viewsToolbarButton;

  // Initialize the Message Body menuitem
  document.getElementById('viewBodyMenu').hidden = isFeed;

  // Initialize the Show Feed Summary menu
  var viewFeedSummary = document.getElementById('viewFeedSummary');
  var winType = document.documentElement.getAttribute('windowtype');
  if (winType != "mail:3pane")
    viewFeedSummary.hidden = !gShowFeedSummary;
  else
    viewFeedSummary.hidden = !isFeed;

  var viewRssMenuItemIds = ["bodyFeedGlobalWebPage",
                            "bodyFeedGlobalSummary",
                            "bodyFeedPerFolderPref"];
  var checked = gPrefBranch.getIntPref("rss.show.summary");
  document.getElementById(viewRssMenuItemIds[checked])
          .setAttribute("checked", true);

  if (winType != "mail:3pane") {
    document.getElementById("viewFeedSummarySeparator").hidden = true;
    document.getElementById("bodyFeedGlobalWebPage").hidden = true;
    document.getElementById("bodyFeedGlobalSummary").hidden = true;
    document.getElementById("bodyFeedPerFolderPref").hidden = true;
  }

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

/**
 * Called when showing the menu_viewSortPopup menupopup, so it should always
 * be up-to-date.
 */
function InitViewSortByMenu()
{
  var sortType = gFolderDisplay.view.primarySortType;

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

  var sortOrder = gFolderDisplay.view.primarySortOrder;
  var sortTypeSupportsGrouping = (sortType == nsMsgViewSortType.byAuthor ||
      sortType == nsMsgViewSortType.byDate || sortType == nsMsgViewSortType.byReceived ||
      sortType == nsMsgViewSortType.byPriority ||
      sortType == nsMsgViewSortType.bySubject || sortType == nsMsgViewSortType.byTags ||
      sortType == nsMsgViewSortType.byRecipient || sortType == nsMsgViewSortType.byAccount ||
      sortType == nsMsgViewSortType.byStatus || sortType == nsMsgViewSortType.byFlagged ||
      sortType == nsMsgViewSortType.byAttachments);

  setSortByMenuItemCheckState("sortAscending", (sortOrder == nsMsgViewSortOrder.ascending));
  setSortByMenuItemCheckState("sortDescending", (sortOrder == nsMsgViewSortOrder.descending));

  var grouped = gFolderDisplay.view.showGroupedBySort;
  var threaded = gFolderDisplay.view.showThreaded;
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
  document.getElementById("viewAllMessagesMenuItem").setAttribute("checked",
    !gFolderDisplay.view.showUnreadOnly &&
    !gFolderDisplay.view.specialView);

  document.getElementById("viewUnreadMessagesMenuItem").setAttribute("checked",
    gFolderDisplay.view.showUnreadOnly);

  document.getElementById("viewThreadsWithUnreadMenuItem").setAttribute("checked",
    gFolderDisplay.view.specialViewThreadsWithUnread);

  document.getElementById("viewWatchedThreadsWithUnreadMenuItem").setAttribute("checked",
    gFolderDisplay.view.specialViewWatchedThreadsWithUnread);

  document.getElementById("viewIgnoredThreadsMenuItem").setAttribute("checked",
    gFolderDisplay.view.showIgnored);
}

function InitMessageMenu()
{
  var selectedMsg = gFolderDisplay.selectedMessage;
  var isNews = gFolderDisplay.selectedMessageIsNews;
  var isFeed = gFolderDisplay.selectedMessageIsFeed;

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
  var msgFolder = gFolderDisplay.displayedFolder;
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

  // Initialize the Open Message menuitem
  var winType = document.documentElement.getAttribute('windowtype');
  if (winType == "mail:3pane")
    document.getElementById('openMessageWindowMenuitem').hidden = isFeed;

  // Initialize the Open Feed Message handler menu
  var index = GetFeedOpenHandler();
  document.getElementById("menu_openFeedMessage")
          .childNodes[index].setAttribute("checked", true);
  var openRssMenu = document.getElementById("openFeedMessage");
  openRssMenu.hidden = !isFeed;
  if (winType != "mail:3pane")
    openRssMenu.hidden = true;

  // Disable mark menu when we're not in a folder.
  document.getElementById("markMenu").disabled = !msgFolder;

  document.commandDispatcher.updateCommands('create-menu-message');
}

/**
 * Initializes the menu item aMenuItem to show either "Move" or "Copy" to
 * folder again, based on the value of mail.last_msg_movecopy_target_uri.
 * The menu item label and accesskey are adjusted to include the folder name.
 *
 * @param aMenuItem the menu item to adjust
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
  var isFeed = gFolderDisplay.selectedMessageIsFeed;
  const defaultIDs = ["bodyAllowHTML",
                      "bodySanitized",
                      "bodyAsPlaintext"];
  const rssIDs = ["bodyFeedSummaryAllowHTML",
                  "bodyFeedSummarySanitized",
                  "bodyFeedSummaryAsPlaintext"];
  var menuIDs = isFeed ? rssIDs : defaultIDs;
  try
  {
    // Get prefs
    if (isFeed) {
      prefer_plaintext = pref.getBoolPref("rss.display.prefer_plaintext");
      html_as = pref.getIntPref("rss.display.html_as");
      disallow_classes = pref.getIntPref("rss.display.disallow_mime_handlers");
    }
    else {
      prefer_plaintext = pref.getBoolPref("mailnews.display.prefer_plaintext");
      html_as = pref.getIntPref("mailnews.display.html_as");
      disallow_classes = pref.getIntPref("mailnews.display.disallow_mime_handlers");
    }

    if (disallow_classes > 0)
      gDisallow_classes_no_html = disallow_classes;
    // else gDisallow_classes_no_html keeps its inital value (see top)
  }
  catch (ex)
  {
    dump("failed to get the body plaintext vs. HTML prefs\n");
  }

  var AllowHTML_menuitem = document.getElementById(menuIDs[0]);
  var Sanitized_menuitem = document.getElementById(menuIDs[1]);
  var AsPlaintext_menuitem = document.getElementById(menuIDs[2]);

  if (!prefer_plaintext && !html_as && !disallow_classes &&
      AllowHTML_menuitem)
    AllowHTML_menuitem.setAttribute("checked", true);
  else if (!prefer_plaintext && html_as == 3 && disallow_classes > 0 &&
      Sanitized_menuitem)
    Sanitized_menuitem.setAttribute("checked", true);
  else if (prefer_plaintext && html_as == 1 && disallow_classes > 0 &&
      AsPlaintext_menuitem)
    AsPlaintext_menuitem.setAttribute("checked", true);
  // else (the user edited prefs/user.js) check none of the radio menu items

  if (isFeed) {
    AllowHTML_menuitem.hidden = !gShowFeedSummary;
    Sanitized_menuitem.hidden = !gShowFeedSummary;
    AsPlaintext_menuitem.hidden = !gShowFeedSummary;
    document.getElementById("viewFeedSummarySeparator").hidden = !gShowFeedSummary;
  }
}

function SetMenuItemLabel(menuItemId, customLabel)
{
  var menuItem = document.getElementById(menuItemId);
  if (menuItem)
    menuItem.setAttribute('label', customLabel);
}

function RemoveAllMessageTags()
{
  var selectedMessages = gFolderDisplay.selectedMessages;
  if (!selectedMessages.length)
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

  for (var i = 0; i < selectedMessages.length; ++i)
  {
    var msgHdr = selectedMessages[i];
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
  var msgHdr = gFolderDisplay.selectedMessage;
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
  var selectedMessages = gFolderDisplay.selectedMessages;
  var toggler = addKey ? "addKeywordsToMessages" : "removeKeywordsFromMessages";
  var prevHdrFolder = null;
  // this crudely handles cross-folder virtual folders with selected messages
  // that spans folders, by coalescing consecutive msgs in the selection
  // that happen to be in the same folder. nsMsgSearchDBView does this
  // better, but nsIMsgDBView doesn't handle commands with arguments,
  // and (un)tag takes a key argument.
  for (var i = 0; i < selectedMessages.length; ++i)
  {
    var msgHdr = selectedMessages[i];
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
  var msgHdr = gFolderDisplay.selectedMessage;
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
  if (gFolderDisplay.selectedMessage)
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
    folder = GetMsgFolderFromUri(historyArray[i + 1]);
    navDebug("folder URI = " + folder.URI + "pretty name " + folder.prettyName + "\n");
    var menuText = "";

    // If the message was not being displayed via the current folder, prepend
    //  the folder name.  We do not need to check underlying folders for
    //  virtual folders because 'folder' is the display folder, not the
    //  underlying one.
    if (folder != gFolderDisplay.displayedFolder)
      menuText = folder.prettyName + " - ";

    var msgHdr = messenger.msgHdrFromURI(historyArray[i]);

    var subject = "";
    if (msgHdr.flags & Components.interfaces.nsMsgMessageFlags.HasRe)
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

/**
 * This is triggered by the history navigation menu options, as created by
 *  populateHistoryMenu above.
 */
function NavigateToUri(target)
{
  var historyIndex = target.getAttribute('value');
  var msgUri = messenger.getMsgUriAtNavigatePos(historyIndex);
  var folder = target.folder;
  var msgHdr = messenger.msgHdrFromURI(msgUri);
  navDebug("navigating from " + messenger.navigatePos + " by " + historyIndex + " to " + msgUri + "\n");

  // this "- 0" seems to ensure that historyIndex is treated as an int, not a string.
  messenger.navigatePos += (historyIndex - 0);

  if (gFolderDisplay.displayedFolder != folder) {
    if (gFolderTreeView)
      gFolderTreeView.selectFolder(folder);
    else
      gFolderDisplay.show(folder);
  }
  gFolderDisplay.selectMessage(msgHdr);
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

/**
 * Should the reply command/button be enabled?
 *
 * @return whether the reply command/button should be enabled.
 */
function IsReplyEnabled()
{
  // If we're in an rss item, we never want to Reply, because there's
  // usually no-one useful to reply to.
  return !gFolderDisplay.selectedMessageIsFeed;
}

/**
 * Should the reply-all command/button be enabled?
 *
 * @return whether the reply-all command/button should be enabled.
 */
function IsReplyAllEnabled()
{
  if (gFolderDisplay.selectedMessageIsNews)
    // If we're in a news item, we always want ReplyAll, because we can
    // reply to the sender and the newsgroup.
    return true;
  if (gFolderDisplay.selectedMessageIsFeed)
    // If we're in an rss item, we never want to ReplyAll, because there's
    // usually no-one useful to reply to.
    return false;

  let msgHdr = gFolderDisplay.selectedMessage;

  let myEmail = getIdentityForHeader(msgHdr).email;
  let addresses = msgHdr.author + "," + msgHdr.recipients + "," + msgHdr.ccList;

  // If we've got any BCCed addresses (because we sent the message), add
  // them as well.
  if ("bcc" in currentHeaderData)
    addresses += currentHeaderData.bcc.headerValue;

  // Check to see if my email address is in the list of addresses.
  let imInAddresses = addresses.indexOf(myEmail) != -1;

  // Now, let's get the number of unique addresses.
  let hdrParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                            .getService(Components.interfaces.nsIMsgHeaderParser);
  let uniqueAddresses = hdrParser.removeDuplicateAddresses(addresses, "");
  let emailAddresses = {};
  let numAddresses = hdrParser.parseHeadersWithArray(uniqueAddresses,
                                                     emailAddresses, {}, {});

  // XXX: This should be handled by the nsIMsgHeaderParser.  See Bug 498480.
  // Remove addresses that look like email groups, because we don't support
  // those yet.  (Any address with a : in it will be an empty email group,
  // or the colon and the groupname would be set as the first name, and not
  // show up in the address at all.)
  for (var i in emailAddresses.value)
  {
    if (/:/.test(emailAddresses.value[i]))
      numAddresses--;
  }

  // I don't want to count my address in the number of addresses to reply
  // to, since I won't be emailing myself.
  if (imInAddresses)
    numAddresses--;

  // ReplyAll is enabled if there is more than 1 person to reply to.
  return numAddresses > 1;
}

/**
 * Should the reply-list command/button be enabled?
 *
 * @return whether the reply-list command/button should be enabled.
 */
function IsReplyListEnabled()
{
  // ReplyToList is enabled if there is a List-Post header.
  return currentHeaderData["list-post"] != null;
}

/**
 * Update the enabled/disabled states of the Reply, Reply-All, and
 * Reply-List buttons.  (After this function runs, one of the buttons
 * should be shown, and the others should be hidden.)
 */
function UpdateReplyButtons()
{
  let showReplyAll = IsReplyAllEnabled();
  let showReplyList = IsReplyListEnabled();

  // If we're in a news item, we should default to Reply.
  if (gFolderDisplay.selectedMessageIsNews)
  {
    showReplyAll = false;
    showReplyList = false;
  }

  let buttonToShow = "reply";
  if (showReplyList)
    buttonToShow = "replyList";
  else if (showReplyAll)
    buttonToShow = "replyAll";

  let buttonBox = getCurrentMsgHdrButtonBox();

  let replyButton = buttonBox.getButton("hdrReplyButton");
  let replyAllButton = buttonBox.getButton("hdrReplyAllButton");
  let replyAllSubButton = buttonBox.getButton("hdrReplyAllSubButton");
  let replyAllSubButtonSep = buttonBox.getButton("hdrReplyAllSubButtonSep");
  let replyListButton = buttonBox.getButton("hdrReplyListButton");

  replyButton.hidden = (buttonToShow != "reply");
  replyAllButton.hidden = (buttonToShow != "replyAll");
  replyListButton.hidden = (buttonToShow != "replyList");

  if (gFolderDisplay.selectedMessageIsNews)
  {
    // If it's a news item, show the ReplyAll sub-button and separator.
    replyAllSubButton.hidden = false;
    replyAllSubButtonSep.hidden = false;
  }
  else if (gFolderDisplay.selectedMessageIsFeed)
  {
    // otherwise, if it's an rss item, hide all the Reply buttons.
    replyButton.hidden = true;
    replyAllButton.hidden = true;
    replyListButton.hidden = true;
    replyAllSubButton.hidden = true;
    replyAllSubButtonSep.hidden = true;
  }
  else
  {
    // otherwise, hide the ReplyAll sub-buttons.
    replyAllSubButton.hidden = true;
    replyAllSubButtonSep.hidden = true;
  }

  goUpdateCommand("button_reply");
  goUpdateCommand("button_replyall");
  goUpdateCommand("button_replylist");
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
  if (gFolderDisplay.selectedMessageIsNews)
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
  let firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage &&
         (firstSelectedMessage.flags &
          Components.interfaces.nsMsgMessageFlags.IMAPDeleted);
}

function SelectedMessagesAreJunk()
{
  try {
    var junkScore = gFolderDisplay.selectedMessage.getStringProperty("junkscore");
    return (junkScore != "") && (junkScore != "0");
  }
  catch (ex) {
    return false;
  }
}

function SelectedMessagesAreRead()
{
  let firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage && firstSelectedMessage.isRead;
}

function SelectedMessagesAreFlagged()
{
  let firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage && firstSelectedMessage.isFlagged;
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

  GetNewMsgs(server, inboxFolder);
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
  if (fromToolbar && gFolderDisplay.view.isNewsFolder)
    return;

  gFolderDisplay.hintAboutToDeleteMessages();
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
    gFolderDisplay.hintAboutToDeleteMessages();
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
                   GetFirstSelectedMsgFolder(),
                   gFolderDisplay.selectedMessageUris);
  }
  else {
    ComposeMessage(aCompType, Components.interfaces.nsIMsgCompFormat.Default,
                   GetFirstSelectedMsgFolder(),
                   gFolderDisplay.selectedMessageUris);
  }
}

function MsgNewMessage(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.New, event);
}

function MsgReplyMessage(event)
{
  var loadedFolder = gFolderDisplay.displayedFolder;
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

function MsgReplyToListMessage(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.ReplyToList, event);
}

// Message Archive function

function BatchMessageMover()
{
  this._batches = {};
  this._currentKey = null;
}

BatchMessageMover.prototype = {

  archiveSelectedMessages: function()
  {
    gFolderDisplay.hintMassMoveStarting();

    let selectedMessages = gFolderDisplay.selectedMessages;
    if (!selectedMessages.length)
      return;

    let messages = Components.classes["@mozilla.org/array;1"]
                             .createInstance(Components.interfaces.nsIMutableArray);

    for (let i = 0; i < selectedMessages.length; ++i)
    {
      let msgHdr = selectedMessages[i];

      let rootFolder = msgHdr.folder.server.rootFolder;

      let msgDate = new Date(msgHdr.date / 1000);  // convert date to JS date object
      let msgYear = msgDate.getFullYear().toString();
      let monthFolderName = msgDate.toLocaleFormat("%Y-%m")
      let dstFolderName = monthFolderName;

      let copyBatchKey = msgHdr.folder.URI + '\000' + dstFolderName;
      if (! (copyBatchKey in this._batches)) {
        this._batches[copyBatchKey] = [msgHdr.folder, msgYear, dstFolderName];
      }
      this._batches[copyBatchKey].push(msgHdr);
    }
    // Now we launch the code that will iterate over all of the message copies
    // one in turn
    this.processNextBatch();
  },

  processNextBatch: function()
  {
    for (let key in this._batches)
    {
      this._currentKey = key;
      let batch = this._batches[key];
      let srcFolder = batch[0];
      let msgYear = batch[1];
      let msgMonth = batch[2];
      let msgs = batch.slice(3,batch.length);
      let subFolder, dstFolder;
      let Ci = Components.interfaces;
      // rss servers don't have an identity so we special case the archives URI
      let archiveFolderUri = (srcFolder.server.type == 'rss')
        ? srcFolder.server.serverURI + "/Archives"
        : getIdentityForHeader(msgs[0], Ci.nsIMsgCompType
                                        .ReplyAll).archiveFolder;

      let archiveFolder = GetMsgFolderFromUri(archiveFolderUri, false);
      let granularity = archiveFolder.server.archiveGranularity;
      // for imap folders, we need to create the sub-folders asynchronously,
      // so we chain the urls using the listener called back from
      // createStorageIfMissing. For local, creatStorageIfMissing is
      // synchronous.
      let isImap = archiveFolder.server.type == "imap";
      if (!archiveFolder.parent) {
        archiveFolder.createStorageIfMissing(this);
        if (isImap)
          return;
      }
      let forceSingle = !archiveFolder.canCreateSubfolders;
      if (!forceSingle && isImap)
        forceSingle = archiveFolder.server
                       .QueryInterface(Ci.nsIImapIncomingServer).isGMailServer;
      if (forceSingle)
        granularity = Ci.nsIMsgIncomingServer.singleArchiveFolder;

      if (granularity >= Ci.nsIMsgIncomingServer.perYearArchiveFolders) {
        archiveFolderUri += "/" + msgYear;
        subFolder = GetMsgFolderFromUri(archiveFolderUri, false);
        if (!subFolder.parent) {
          subFolder.createStorageIfMissing(this);
          if (isImap)
            return;
        }
        if (granularity >=  Ci.nsIMsgIncomingServer.perMonthArchiveFolders) {
          archiveFolderUri += "/" + msgMonth;
          dstFolder = GetMsgFolderFromUri(archiveFolderUri, false);
          if (!dstFolder.parent) {
            dstFolder.createStorageIfMissing(this);
            if (isImap)
              return;
          }
        }
        else {
          dstFolder = subFolder;
        }
      }
      else {
        dstFolder = archiveFolder;
      }
      if (dstFolder != srcFolder) {
        var mutablearray = Components.classes["@mozilla.org/array;1"]
                            .createInstance(Components.interfaces.nsIMutableArray);
        msgs.forEach(function (item) {
          mutablearray.appendElement(item, false);
        });
        gCopyService.CopyMessages(srcFolder, mutablearray,
                                  dstFolder, true, this, msgWindow, true);
        this._currentKey = key;
        break; // only do one.
      }
      else {
       delete this._batches[key];
      }
    }
  },

  OnStartRunningUrl: function(url) {
  },

  OnStopRunningUrl: function(url, exitCode)
  {
    // this will always be a create folder url, afaik.
    if (Components.isSuccessCode(exitCode))
      this.processNextBatch();
    else
      this._batches = null;
  },

  // also implements nsIMsgCopyServiceListener, but we only care
  // about the OnStopCopy
  OnStartCopy: function() {
  },
  OnProgress: function(aProgress, aProgressMax) {
  },
  SetMessageKey: function(aKey) {
  },
  GetMessageId: function() {
  },
  OnStopCopy: function(aStatus)
  {
    if (aStatus == Components.results.NS_OK) {
      // remove batch we just finished
      delete this._batches[this._currentKey];
      this._currentKey = null;

      // is there a safe way to test whether this._batches is empty?
      let empty = true;
      for (let key in this._batches) {
        empty = false;
      }

      if (!empty)
        this.processNextBatch();
      else // this will select the appropriate next message
        gFolderDisplay.hintMassMoveCompleted();
    }
  },
  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsIUrlListener) &&
      !iid.equals(Components.interfaces.nsIMsgCopyServiceListener) &&
      !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
}

function MsgArchiveSelectedMessages(event)
{
  let batchMover = new BatchMessageMover();
  batchMover.archiveSelectedMessages();
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
  ComposeMessage(Components.interfaces.nsIMsgCompType.Draft,
                 Components.interfaces.nsIMsgCompFormat.Default,
                 gFolderDisplay.displayedFolder,
                 gFolderDisplay.selectedMessageUris);
}

function MsgCreateFilter()
{
  // retrieve Sender direct from selected message's headers
  var msgHdr = gFolderDisplay.selectedMessage;
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

/**
 * Show a confirmation dialog - check if the user really want to unsubscribe
 * from the given newsgroup/s.
 * @folders an array of newsgroup folders to unsubscribe from
 * @return true if the user said it's ok to unsubscribe
 */
function ConfirmUnsubscribe(folders)
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var titleMsg = gMessengerBundle.getString("confirmUnsubscribeTitle");
  var dialogMsg = (folders.length == 1) ?
    gMessengerBundle.getFormattedString("confirmUnsubscribeText",
                                        [folders[0].name], 1) :
    gMessengerBundle.getString("confirmUnsubscribeManyText");

  var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
  return promptService.confirm(window, titleMsg, dialogMsg);
}

/**
 * Unsubscribe from selected newsgroup/s.
 */
function MsgUnsubscribe()
{
  var folders = gFolderTreeView.getSelectedFolders();
  if (ConfirmUnsubscribe(folders))
    UnSubscribe(folders);
}

function ToggleFavoriteFolderFlag()
{
  var folder = GetFirstSelectedMsgFolder();
  folder.toggleFlag(Components.interfaces.nsMsgFolderFlags.Favorite);
}

function MsgSaveAsFile()
{
  if (GetNumSelectedMessages() == 1)
    SaveAsFile(gFolderDisplay.selectedMessageUris[0]);
}

function MsgSaveAsTemplate()
{
  if (GetNumSelectedMessages() == 1)
    SaveAsTemplate(gFolderDisplay.selectedMessageUris[0],
                   gFolderDisplay.displayedFolder);
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
 * Displays message "folder"s, mail "message"s, and "glodaSearch" results.  The
 *  commonality is that they all use the "mailContent" panel's folder tree,
 *  thread tree, and message pane objects.  This happens for historical reasons,
 *  likely involving the fact that prior to the introduction of this
 *  abstraction, everything was always stored in global objects.  For the 3.0
 *  release cycle we considered avoiding this 'multiplexed' style of operation
 *  but decided against moving to making each tab be indepdendent because of
 *  presumed complexity.
 *
 * The tab info objects (as tabmail's currentTabInfo/tabInfo fields contain)
 *  have the following attributes specific to our implementation:
 *
 *
 * @property {string} uriToOpen
 * @property {nsIMsgFolder} msgSelectedFolder Preserves gMsgFolderSelected
 *     global.
 * @property {nsIMsgDBView} dbView The database view to use with the thread tree
 *     when this tab is displayed.  The value will be assigned to the global
 *     gDBView in the process.
 * @property {nsIMessenger} messenger Used to preserve "messenger" global value.
 *     The messenger object is the keeper of the 'undo' state and navigation
 *     history, which is why we do this.
 *
 * @property {nsIMsgDBHdr} hdr In "message" mode, the header of the message
 *     being displayed.
 * @property {nsIMsgSearchSession} searchSession Used to preserve gSearchSession
 *     global value.
 *
 */
let mailTabType = {
  name: "mail",
  panelId: "mailContent",
  modes: {
    /**
     * The folder view displays the contents of an nsIMsgDBFolder, with the
     *  folder pane (potentially), thread pane (always), and message pane
     *  (potentially) displayed.
     *
     * The actual nsMsgDBView can be any of the following types of things:
     *  - A single folder.
     *    - A quicksearch on a single folder.
     *  - A virtual folder potentially containing messages from multiple
     *    folders. (eShowVirtualFolderResults)
     */
    folder: {
      isDefault: true,
      type: "folder",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: true,
        thread: true,
        message: true
      },
      /// The set of panes that are legal when we are showing account central
      accountCentralLegalPanes: {
        folder: true,
        accountCentral: true,
        message: false
      },
      openFirstTab: function(aTab) {
        this.openTab(aTab, true, new MessagePaneDisplayWidget());
        // persistence and restoreTab wants to know if we are the magic first tab
        aTab.firstTab = true;
        aTab.folderDisplay.makeActive();
      },
      /**
       * @param aFolder The nsIMsgFolder to display.
       * @param aMsgHdr Optional message header to display.
       */
      openTab: function(aTab, aArgs) {
        // persistence and restoreTab wants to know if we are the magic first tab
        aTab.firstTab = false;

        // Get a tab that we can initialize our user preferences from.
        // (We don't want to assume that our immediate predecessor was a
        //  "folder" tab.)
        let modelTab = document.getElementById("tabmail")
                         .getTabInfoForCurrentOrFirstModeInstance(aTab.mode);

        if (modelTab)
          aTab.folderPaneCollapsed = modelTab.folderPaneCollapsed;

        // - figure out whether to show the message pane
        let messagePaneShouldBeVisible;
        // explicitly told to us?
        if ("messagePaneVisible" in aArgs)
          messagePaneShouldBeVisible = aArgs.messagePaneVisible;
        // inherit from the previous tab (if we've got one)
        else if (modelTab)
          messagePaneShouldBeVisible = modelTab.messageDisplay.visible;
        // who does't love a message pane?
        else
          messagePaneShouldBeVisible = true;

        this.openTab(aTab, false,
                     new MessagePaneDisplayWidget(messagePaneShouldBeVisible));

        let background = ("background" in aArgs) && aArgs.background;
        let msgHdr = ("msgHdr" in aArgs) && aArgs.msgHdr;

        if (!background) {
          // Clear selection, because context clicking on a folder and opening in a
          // new tab needs to have SelectFolder think the selection has changed.
          // We also need to clear these globals to subvert the code that prevents
          // folder loads when things haven't changed.
          let folderTree = document.getElementById("folderTree");
          folderTree.view.selection.clearSelection();
          folderTree.view.selection.currentIndex = -1;

          aTab.folderDisplay.makeActive();
          // This will call aTab.folderDisplay.show(aArgs.folder), which takes
          // care of the tab title and other stuff
          gFolderTreeView.selectFolder(aArgs.folder);
          if (msgHdr)
            aTab.folderDisplay.selectMessage(msgHdr);
        }
        else {
          // Since we can't call gFolderTreeView.selectFolder, we need to make the folder
          // display believe it's showing this folder
          aTab.folderDisplay.show(aArgs.folder);
        }

        aTab.mode.onTitleChanged.call(this, aTab, aTab.tabNode);
      },
      persistTab: function(aTab) {
        if (!aTab.folderDisplay.displayedFolder)
          return null;
        return {
          folderURI: aTab.folderDisplay.displayedFolder.URI,
          messagePaneVisible: aTab.messageDisplay.visible,
          firstTab: aTab.firstTab
        };
      },
      restoreTab: function(aTabmail, aPersistedState) {
        let rdfService = Components.classes['@mozilla.org/rdf/rdf-service;1']
                           .getService(Components.interfaces.nsIRDFService);
        let folder = rdfService.GetResource(aPersistedState.folderURI)
                       .QueryInterface(Components.interfaces.nsIMsgFolder);
        // if the folder no longer exists, we can't restore the tab
        if (folder) {
          // If we are talking about the first tab, it already exists and we
          //  should poke it.  We are assuming it is the currently displayed
          //  tab because we are privvy to the implementation details and know
          //  it to be true.
          if (aPersistedState.firstTab) {
            if (gMessageDisplay.visible != aPersistedState.messagePaneVisible) {
              MsgToggleMessagePane();
              // For reasons that are not immediately obvious, sometimes the
              //  message display is not active at this time.  In that case, we
              //  need to explicitly set the _visible value because otherwise it
              //  misses out on the toggle event.
              if (!gMessageDisplay._active)
                gMessageDisplay._visible = aPersistedState.messagePaneVisible;
            }
            gFolderTreeView.selectFolder(folder);
          }
          else {
            aTabmail.openTab("folder", {folder: folder,
                messagePaneVisible: aPersistedState.messagePaneVisible,
                background: true});
          }
        }
      },
      onTitleChanged: function(aTab, aTabNode) {
        if (!aTab.folderDisplay || !aTab.folderDisplay.displayedFolder) {
          // Don't show "undefined" as title when there is no account.
          aTab.title = " ";
          return;
        }
        // The user may have changed folders, triggering our onTitleChanged
        // callback.
        let folder = aTab.folderDisplay.displayedFolder;
        aTab.title = folder.prettyName;
        if (!folder.isServer && this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + folder.server.prettyName;

        // Update the appropriate attributes on the tab
        aTabNode.setAttribute('SpecialFolder',
                              getSpecialFolderString(folder));
        aTabNode.setAttribute('ServerType', folder.server.type);
        aTabNode.setAttribute('IsServer', folder.isServer);
        aTabNode.setAttribute('IsSecure', folder.server.isSecure);
      }
    },
    /**
     * The message view displays a single message.  In this view, the folder
     *  pane and thread pane are forced hidden and only the message pane is
     *  displayed.
     */
    message: {
      type: "message",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: false,
        thread: false,
        message: true
      },
      openTab: function(aTab, aArgs) {
        this.openTab(aTab, false, new MessageTabDisplayWidget());

        let viewWrapperToClone = ("viewWrapperToClone" in aArgs) &&
                                 aArgs.viewWrapperToClone;
        let background = ("background" in aArgs) && aArgs.background;

        if (viewWrapperToClone)
          aTab.folderDisplay.cloneView(viewWrapperToClone);
        else
          aTab.folderDisplay.show(aArgs.msgHdr.folder);

        // folderDisplay.show is going to try to set the title itself, but we
        // wouldn't have selected a message at that point, so set the title
        // here
        aTab.mode.onTitleChanged.call(this, aTab, null, aArgs.msgHdr);

        aTab.folderDisplay.selectMessage(aArgs.msgHdr);

        // we only want to make it active after setting up the view and the message
        //  to avoid generating bogus summarization events.
        if (!background)
          aTab.folderDisplay.makeActive();
        else
          // We don't want to null out the real tree box view, as that
          // corresponds to the _current_ tab, not the new one
          aTab.folderDisplay.hookUpFakeTreeBox(false);
      },
      persistTab: function(aTab) {
        let msgHdr = aTab.folderDisplay.selectedMessage;
        return {
          messageURI: msgHdr.folder.getUriForMsg(msgHdr)
        };
      },
      restoreTab: function(aTabmail, aPersistedState) {
        let msgHdr = messenger.msgHdrFromURI(aPersistedState.messageURI);
        // if the message no longer exists, we can't restore the tab
        if (msgHdr)
          aTabmail.openTab("message", {msgHdr: msgHdr, background: true});
      },
      onTitleChanged: function(aTab, aTabNode, aMsgHdr) {
        // Try and figure out the selected message if one was not provided.
        // It is possible that the folder has yet to load, so it may still be
        //  null.
        if (aMsgHdr == null)
          aMsgHdr = aTab.folderDisplay.selectedMessage;
        aTab.title = "";
        if (aMsgHdr == null)
          return;
        if (aMsgHdr.flags & Components.interfaces.nsMsgMessageFlags.HasRe)
          aTab.title = "Re: ";
        if (aMsgHdr.mime2DecodedSubject)
          aTab.title += aMsgHdr.mime2DecodedSubject;

        aTab.title += " - " + aMsgHdr.folder.prettyName;
        if (this._getNumberOfRealAccounts() > 1)
          aTab.title += " - " + aMsgHdr.folder.server.prettyName;
      }
    },
    /**
     * The glodaSearch view displays a gloda-backed nsMsgDBView with only the
     *  thread pane and (potentially) the message pane displayed; the folder
     *  pane is forced hidden.
     */
    glodaSearch: {
      type: "glodaSearch",
      /// The set of panes that are legal to be displayed in this mode
      legalPanes: {
        folder: false,
        thread: true,
        message: true,
        glodaFacets: false,
      },
      desiredColumns: {
        flaggedCol: true,
        subjectCol: true,
        senderCol: true,
        dateCol: true,
      },
      /**
       * Open a new tab whose view is backed by a gloda search.
       *
       * @param searchString
       * @param facetString
       *     - everything:
       *     - subject:
       *     - involves:
       *     - to:
       *     - from:
       *     - body:
       * @param location Either a GlodaFolder or the string "everywhere".
       * 
       * XXX This needs to handle opening in the background
       */
      openTab: function(aTab, aArgs) {
        // make sure the search string bundle is loaded
        getDocumentElements();
        aTab.title = gSearchBundle.getFormattedString("glodaSearchTabTitle",
                                                      [aArgs.searchString]);
        aTab.glodaSearchInputValue = aArgs.searchString;
        aTab.searchString = aArgs.searchString;
        aTab.facetString = aArgs.facetString;

        aTab.glodaSynView = new GlodaSyntheticSearchView(aArgs.searchString,
                                                         aArgs.facetString,
                                                         aArgs.location);

        this.openTab(aTab, false, new MessagePaneDisplayWidget());
        aTab.folderDisplay.show(aTab.glodaSynView);
        aTab.folderDisplay.setVisibleColumns(aTab.mode.desiredColumns);
        aTab.folderDisplay.makeActive();
      },
    },
  },

  _getNumberOfRealAccounts : function() {
    let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
    let accountCount = mgr.accounts.Count();
    // If we have an account, we also always have a "Local Folders" account.
    return accountCount > 0 ? (accountCount - 1) : 0;
  },

  /**
   * Common tab opening code shared by the various tab modes.
   */
  openTab: function(aTab, aIsFirstTab, aMessageDisplay) {
    // Set the messagepane as the primary browser for content.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-primary");

    aTab.messageDisplay = aMessageDisplay;
    aTab.folderDisplay = new FolderDisplayWidget(aTab, aTab.messageDisplay);
    aTab.folderDisplay.msgWindow = msgWindow;
    aTab.folderDisplay.tree = document.getElementById("threadTree");
    aTab.folderDisplay.treeBox = aTab.folderDisplay.tree.boxObject.QueryInterface(
                                   Components.interfaces.nsITreeBoxObject);

    if (aIsFirstTab) {
      aTab.folderDisplay.messenger = messenger;
    }
    else {
      // Each tab gets its own messenger instance; this provides each tab with
      // its own undo/redo stack and back/forward navigation history.
      // If this is a foreground tab, folderDisplay.makeActive() is going to
      // set it as the global messenger, so there's no need to do it here
      let tabMessenger = Components.classes["@mozilla.org/messenger;1"]
                                   .createInstance(Components.interfaces.nsIMessenger);
      tabMessenger.setWindow(window, msgWindow);
      aTab.folderDisplay.messenger = tabMessenger;
    }
  },

  closeTab: function(aTab) {
    aTab.folderDisplay.close();
  },

  saveTabState: function(aTab) {
    // Now let other tabs have a primary browser if they want.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-targetable");

    aTab.folderDisplay.makeInactive();
  },

  /**
   * Some panes simply are illegal in certain views, and some panes are legal
   *  but the user may have collapsed/hidden them.  If that was not enough, we
   *  have three different layouts that are possible, each of which requires a
   *  slightly different DOM configuration, and accordingly for us to poke at
   *  different DOM nodes.  Things are made somewhat simpler by our decision
   *  that all tabs share the same layout.
   * This method takes the legal states and current display states and attempts
   *  to apply the appropriate logic to make it all work out.  This method is
   *  not in charge of figuring out or preserving display states.
   *
   * A brief primer on splitters and friends:
   * - A collapsed splitter is not visible (and otherwise it is visible).
   * - A collapsed node is not visible (and otherwise it is visible).
   * - A splitter whose "state" is "collapsed" collapses the widget implied by
   *    the value of the "collapse" attribute.  The splitter itself will be
   *    visible unless "collapsed".
   *
   * @param aLegalStates A dictionary where each key and value indicates whether
   *     the pane in question (key) is legal to be displayed in this mode.  If
   *     the value is true, then the pane is legal.  Omitted pane keys imply
   *     that the pane is illegal.  Keys are:
   *     - folder: The folder (tree) pane.
   *     - thread: The thread pane.
   *     - accountCentral: While it's in a deck with the thread pane, this
   *        is distinct from the thread pane because some other things depend
   *        on whether it's actually the thread pane we are showing.
   *     - message: The message pane.  Required/assumed to be true for now.
   *     - glodaFacets: The gloda search facets pane.
   * @param aVisibleStates A dictionary where each value indicates whether the
   *     pane should be 'visible' (not collapsed).  Only panes that are governed
   *     by splitters are options here.  Keys are:
   *     - folder: The folder (tree) pane.
   *     - message: The message pane.
   */
  _setPaneStates: function mailTabType_setPaneStates(aLegalStates,
                                                     aVisibleStates) {
    // The display deck hosts both the thread pane and account central.
    let displayDeckLegal = aLegalStates.thread ||
                           aLegalStates.accountCentral;

    let layout = pref.getIntPref("mail.pane_config.dynamic");
    if (layout == kWidePaneConfig)
    {
      // in the "wide" configuration, the #messengerBox is left holding the
      //  folder pane and thread pane, and the message pane has migrated to be
      //  its sibling (under #mailContent).
      // Accordingly, if both the folder and thread panes are illegal, we
      //  want to collapse the #messengerBox and make sure the #messagepanebox
      //  fills up the screen.  (For example, when in "message" mode.)
      let collapseMessengerBox = !aLegalStates.folder && !displayDeckLegal;
      document.getElementById("messengerBox").collapsed = collapseMessengerBox;
      if (collapseMessengerBox)
        document.getElementById("messagepanebox").flex = 1;
    }

    // -- folder pane
    // collapse the splitter when not legal
    document.getElementById("folderpane_splitter").collapsed =
      !aLegalStates.folder;
    // collapse the folder pane when not visible
    document.getElementById("folderPaneBox").collapsed =
      !aLegalStates.folder || !aVisibleStates.folder;

    // -- display deck (thread pane / account central)
    // in a vertical view, the threadContentArea sits in the #threadPaneBox
    //  next to the message pane and its splitter.
    if (layout == kVerticalMailLayout)
      document.getElementById("threadContentArea").collapsed =
        !displayDeckLegal;
    // whereas in the default view, the displayDeck is the one next to the
    //  message pane and its splitter
    else
      document.getElementById("displayDeck").collapsed =
        !displayDeckLegal;

    // -- thread pane
    // the threadpane-splitter collapses the message pane (arguably a misnomer),
    //  but it only needs to exist when the thread-pane is legal
    document.getElementById("threadpane-splitter").collapsed =
      !aLegalStates.thread;
    if (aLegalStates.thread && aLegalStates.message)
      document.getElementById("threadpane-splitter").setAttribute("state",
        aVisibleStates.message ? "open" : "collapsed");

    // Some things do not make sense if the thread pane is not legal.
    // (This is likely an example of something that should be using the command
    //  mechanism to update the UI elements as to the state of what the user
    //  is looking at, rather than home-brewing it in here.)
    try {
      // you can't quick-search if you don't have a collection of messages
      document.getElementById("search-container").collapsed =
        !aLegalStates.thread;
    } catch (ex) {}
    try {
      // views only work on the thread pane; no thread pane, no views
      document.getElementById("mailviews-container").collapsed =
        !aLegalStates.thread;
    } catch (ex) {}

    // -- thread pane status bar helpers
    GetUnreadCountElement().hidden = !aLegalStates.thread;
    GetTotalCountElement().hidden = !aLegalStates.thread;

    // -- message pane
    document.getElementById("messagepanebox").collapsed =
      !aLegalStates.message || !aVisibleStates.message;

    // we are responsible for updating the keybinding; view_init takes care of
    //  updating the menu item (on demand)
    let messagePaneToggleKey = document.getElementById("key_toggleMessagePane");
    if (aLegalStates.thread)
      messagePaneToggleKey.removeAttribute("disabled");
    else
      messagePaneToggleKey.setAttribute("disabled", "true");

    // -- gloda facets
    document.getElementById("glodaSearchFacets").hidden =
      !aLegalStates.glodaFacets;
  },

  showTab: function(aTab) {
    // Set the messagepane as the primary browser for content.
    document.getElementById("messagepane").setAttribute("type",
                                                        "content-primary");

    aTab.folderDisplay.makeActive();

    // - restore folder pane/tree selection
    if (aTab.folderDisplay.displayedFolder) {
      // but don't generate any events while doing so!
      gFolderTreeView.selection.selectEventsSuppressed = true;
      try {
        gFolderTreeView.selectFolder(aTab.folderDisplay.displayedFolder);
      }
      finally {
        gIgnoreSyntheticFolderPaneSelectionChange = true;
        gFolderTreeView.selection.selectEventsSuppressed = false;
      }
    }
  },

  supportsCommand: function(aTab, aCommand) {
    return DefaultController.supportsCommand(aCommand);
  },

  isCommandEnabled: function(aTab, aCommand) {
    return DefaultController.isCommandEnabled(aCommand);
  },

  doCommand: function(aTab, aCommand) {
    DefaultController.doCommand(aCommand);
  },

  onEvent: function(aTab, aEvent) {
    DefaultController.onEvent(aEvent);
  },

  getBrowser: function(aTab) {
    // We currently use the messagepane element for all tab types.
    return document.getElementById("messagepane");
  }
};
/**
 * The glodaSearch tab mode has a UI widget outside of the mailTabType's
 *  display panel, the #glodaSearchInput textbox.  This means we need to use a
 *  tab monitor so that we can appropriately update the contents of the textbox.
 * Every time a tab is changed, we save the state of the text box and restore
 *  its previous value for the tab we are switching to, as well as whether this
 *  value is a change to the currently-used value (if it is a glodaSearch) tab.
 *  The behaviour rationale for this is that the glodaSearchInput is like the
 *  URL bar.  When you are on a glodaSearch tab, we need to show you your
 *  current value, including any "uncommitted" (you haven't hit enter yet)
 *  changes.  It's not entirely clear that imitating this behaviour on
 *  non-glodaSearch tabs makes a lot of sense, but it is consistent, so we do
 *  so.  The counter-example to this choice is the search box in firefox, but
 *  it never updates when you switch tabs, so it is arguably less of a fit.
 */
var glodaSearchTabMonitor = {
  onTabTitleChanged: function() {},
  onTabSwitched: function glodaSearchTabMonitor_onTabSwitch(aTab, aOldTab) {
    let inputNode = document.getElementById("glodaSearchInput");
    if (!inputNode)
      return;

    // save the current search field value
    if (aOldTab)
      aOldTab.glodaSearchInputValue = inputNode.value;
    // load (or clear if there is none) the persisted search field value
    inputNode.value = aTab.glodaSearchInputValue || "";

    // If the mode is glodaSearch and the search is unchanged, then we want to
    //  set the icon state of the input box to be the 'clear' icon.
    if (aTab.mode.name == "glodaSearch") {
      if (aTab.searchString == aTab.glodaSearchInputValue)
        inputNode._searchIcons.selectedIndex = 1;
    }
  }
};


function MsgOpenNewWindowForFolder(folderURI, msgKeyToSelect)
{
  if (folderURI) {
    window.openDialog("chrome://messenger/content/", "_blank",
                      "chrome,all,dialog=no", folderURI, msgKeyToSelect);
    return;
  }

  // If there is a right-click happening, gFolderTreeView.getSelectedFolders()
  // will tell us about it (while the selection's currentIndex would reflect
  // the node that was selected/displayed before the right-click.)
  let selectedFolders = gFolderTreeView.getSelectedFolders();
  for (let i = 0; i < selectedFolders.length; i++) {
    window.openDialog("chrome://messenger/content/", "_blank",
                      "chrome,all,dialog=no",
                      selectedFolders[i].URI, msgKeyToSelect);
  }
}

/**
 * UI-triggered command to open the currently selected folder(s) in new tabs.
 * @param aBackground [optional] if true, then the folder tab is opened in the
 *                    background. If false or not given, then the folder tab is
 *                    opened in the foreground.
 */
function MsgOpenNewTabForFolder(aBackground)
{
  // If there is a right-click happening, gFolderTreeView.getSelectedFolders()
  // will tell us about it (while the selection's currentIndex would reflect
  // the node that was selected/displayed before the right-click.)
  let selectedFolders = gFolderTreeView.getSelectedFolders();
  for (let i = 0; i < selectedFolders.length; i++) {
    document.getElementById("tabmail").openTab("folder",
      {folder: selectedFolders[i], background: aBackground});
  }
}

function MsgOpenSelectedMessages()
{
  // Toggle message body (rss summary) and content-base url in message
  // pane per pref, otherwise open summary or web page in new window.
  if (gFolderDisplay.selectedMessageIsFeed && GetFeedOpenHandler() == 2) {
    FeedSetContentViewToggle();
    return;
  }

  let selectedMessages = gFolderDisplay.selectedMessages;
  let numMessages = selectedMessages.length;

  let openMessageBehavior = gPrefBranch.getIntPref("mail.openMessageBehavior");
  if (openMessageBehavior == MailConsts.OpenMessageBehavior.NEW_TAB) {
    // Open all the tabs in the background, except for the last one
    let tabmail = document.getElementById("tabmail");
    for (let i = 0; i < numMessages; i++)
      tabmail.openTab("message", {msgHdr: selectedMessages[i],
          viewWrapperToClone: gFolderDisplay.view,
          background: (i < (numMessages - 1))});
    return;
  }

  if (openMessageBehavior == MailConsts.OpenMessageBehavior.EXISTING_WINDOW &&
      numMessages == 1 && MailUtils.openMessageInExistingWindow(
          gFolderDisplay.selectedMessage, gFolderDisplay.view))
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
    MsgOpenNewWindowForMessage(selectedMessages[i]);
  }
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
                    "all,chrome,dialog=no,status,toolbar", uri);
}

function MsgOpenNewWindowForMessage(aMsgHdr)
{
  // no message header provided?  get the selected message (this will give us
  //  the right-click selected message if that's what is going down.)
  if (!aMsgHdr)
    aMsgHdr = gFolderDisplay.selectedMessage;

  // (there might not have been a selected message, so check...)
  if (aMsgHdr)
    // we also need to tell the window about our current view so that it can
    //  clone it.  This enables advancing through the messages, etc.
    window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank",
                      "all,chrome,dialog=no,status,toolbar",
                      aMsgHdr, gFolderDisplay.view);
}

function MsgJunk()
{
  MsgJunkMailInfo(true);
  JunkSelectedMessages(!SelectedMessagesAreJunk());
}


function UpdateJunkButton()
{
  // The junk message should slave off the selected message, as the preview pane
  //  may not be visible
  let hdr = gFolderDisplay.selectedMessage;
  // But only the message display knows if we are dealing with a dummy.
  if (!hdr || gMessageDisplay.isDummy) // .eml file
    return;
  let junkScore = hdr.getStringProperty("junkscore");
  let hideJunk = (junkScore != "") && (junkScore != "0");
  if (gFolderDisplay.selectedMessageIsNews)
    hideJunk = true;

  getCurrentMsgHdrButtonBox().getButton('hdrJunkButton').disabled = hideJunk;
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
                    gFolderDisplay.displayedFolder);
}

function MsgMarkAllRead()
{
  let folders = gFolderTreeView.getSelectedFolders();
  for (let i = 0; i < folders.length; i++)
    folders[i].markAllMessagesRead(msgWindow);
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
        var msgHdr = gFolderDisplay.selectedMessage;
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
    args = { filterList: folder.getEditableFilterList(msgWindow) };
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
  // bail if we're dealing with a dummy header
  if (gMessageDisplay.isDummy)
    return;

  var selectedMessages = gFolderDisplay.selectedMessages;
  if (selectedMessages.length) {
    var filterService =
      Components.classes["@mozilla.org/messenger/services/filters;1"]
                .getService(Components.interfaces.nsIMsgFilterService);

    filterService.applyFilters(Components.interfaces.nsMsgFilterType.Manual,
                               toXPCOMArray(selectedMessages,
                                            Components.interfaces.nsIMutableArray),
                               gFolderDisplay.displayedFolder,
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

function MsgFeedBodyRenderPrefs(plaintext, html, mime)
{
  gPrefBranch.setBoolPref("rss.display.prefer_plaintext", plaintext);
  gPrefBranch.setIntPref("rss.display.html_as", html);
  gPrefBranch.setIntPref("rss.display.disallow_mime_handlers", mime);
  // Reload only if showing rss summary; menuitem hidden if web page..
  ReloadMessage();
}

//How to load message with content-base url on enter in threadpane
function GetFeedOpenHandler()
{
  return gPrefBranch.getIntPref("rss.show.content-base");
}

function ChangeFeedOpenHandler(val)
{
  gPrefBranch.setIntPref("rss.show.content-base", val);
}

//Current state: load web page if 0, show summary if 1
var gShowFeedSummary;
var gShowFeedSummaryToggle = false;

function ChangeFeedShowSummaryPref(val)
{
  pref.setIntPref("rss.show.summary", val);
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
  var messageList = gFolderDisplay.selectedMessageUris;
  if (!messageList) {
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
  if (folder && !folder.isServer &&
      folder.server instanceof Components.interfaces.nsINntpIncomingServer) {
    var menuLabel = gMessengerBundle.getFormattedString("getNextNMessages",
                                                        [folder.server.maxArticles]);
    menuItem.setAttribute("label", menuLabel);
    menuItem.removeAttribute("hidden");
    return true;
  }

  menuItem.setAttribute("hidden","true");
  return false;
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
  var contentWindow = document.commandDispatcher.focusedWindow;
  // If focus is in chrome, we want to scroll the content window; if focus is
  // on a non-link content element like a button, bail so we don't scroll when
  // the element is going to do something else.
  if (contentWindow.top == window)
    contentWindow = content;
  else if (document.commandDispatcher.focusedElement &&
           !hRefForClickEvent(event))
    return;

  var rssiframe = contentWindow.document.getElementById('_mailrssiframe');
  // If we are displaying an RSS article, we really want to scroll
  // the nested iframe.
  if (contentWindow == content && rssiframe)
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

/**
 * Check for new messages for all selected folders, or for the default account
 * in case no folders are selected.
 */
function GetFolderMessages()
{
  var selectedFolders = GetSelectedMsgFolders();
  var defaultAccountRootFolder = GetDefaultAccountRootFolder();

  // if no default account, get msg isn't going do anything anyways
  // so bail out
  if (!defaultAccountRootFolder)
    return;

  // if nothing selected, use the default
  var folders = (selectedFolders.length) ? selectedFolders : [defaultAccountRootFolder];
  for (var i = 0; i < folders.length; i++) {
    var serverType = folders[i].server.type;
    if (folders[i].isServer && (serverType == "nntp")) {
      // If we're doing "get msgs" on a news server,
      // update unread counts on this server.
      folders[i].server.performExpand(msgWindow);
    }
    else if (serverType == "none") {
      // If "Local Folders" is selected and the user does "Get Msgs" and
      // LocalFolders is not deferred to, get new mail for the default account
      //
      // XXX TODO
      // Should shift click get mail for all (authenticated) accounts?
      // see bug #125885.
      if (!folders[i].server.isDeferredTo)
        GetNewMsgs(defaultAccountRootFolder.server, defaultAccountRootFolder);
      else
        GetNewMsgs(folders[i].server, folders[i]);
    }
    else {
      GetNewMsgs(folders[i].server, folders[i]);
    }
  }
}

/**
 * Gets new messages for the given server, for the given folder.
 * @param server which nsIMsgIncomingServer to check for new messages
 * @param folder which nsIMsgFolder folder to check for new messages
 */
function GetNewMsgs(server, folder)
{
  // Note that for Global Inbox folder.server != server when we want to get
  // messages for a specific account.

  const nsIMsgFolder = Components.interfaces.nsIMsgFolder;
  // Whenever we do get new messages, clear the old new messages.
  folder.biffState = nsIMsgFolder.nsMsgBiffState_NoMail;
  folder.clearNewMessages();
  server.getNewMessages(folder, msgWindow, null);
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
        msgSendlater.sendUnsentMessages(currentIdentity);
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
  var loadedFolder = gFolderDisplay.displayedFolder;
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

/**
 * Triggered by the global JunkStatusChanged notification, we handle updating
 *  the message display if our displayed message might have had its junk status
 *  change.  This primarily entails updating the notification bar (that thing
 *  that appears above the message and says "this message might be junk") and
 *  (potentially) reloading the message because junk status affects the form of
 *  HTML display used (sanitized vs not).
 * When our tab implementation is no longer multiplexed (reusing the same
 *  display widget), this must be moved into the MessageDisplayWidget or
 *  otherwise be scoped to the tab.
 */
function HandleJunkStatusChanged(folder)
{
  // We have nothing to do (and should bail) if:
  // - There is no currently displayed message.
  // - The displayed message is an .eml file from disk or an attachment.
  // - The folder that has had a junk change is not backing the display folder.

  // This might be the stand alone window, open to a message that was
  // and attachment (or on disk), in which case, we want to ignore it.
  if (!gMessageDisplay.displayedMessage ||
      gMessageDisplay.isDummy ||
      gFolderDisplay.displayedFolder != folder)
    return;

  // If multiple message are selected and we change the junk status
  // we don't want to show the junk bar (since the message pane is blank).
  var msgHdr = null;
  if (GetNumSelectedMessages() == 1)
    msgHdr = gMessageDisplay.displayedMessage;
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
      gMessengerBundle.getFormattedString('alwaysLoadRemoteContentForSender2',
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
 *  Reloads the message after adjusting the remote content policy for the sender.
 *  Iterate through the local address books looking for a card with the same e-mail address as the
 *  sender of the current loaded message. If we find a card, update the allow remote content field.
 *  If we can't find a card, prompt the user with a new AB card dialog, pre-selecting the remote content field.
 */
function allowRemoteContentForSender()
{
  // get the sender of the msg hdr
  var msgHdr = gMessageDisplay.displayedMessage;
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
    // Try/catch because some cardForEmailAddress functions may not be
    // implemented.
    try {
      // If its a read-only book, don't find a card as we won't be able
      // to modify the card.
      if (!addrbook.readOnly)
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
  var msgHdr = gMessageDisplay.displayedMessage;
  if (msgHdr)
  {
    msgHdr.setUint32Property(aProperty, aValue);
    ReloadMessage();
  }
}

/**
 * Mark a specified message as read.
 * @param msgHdr header (nsIMsgDBHdr) of the message to mark as read
 */
function MarkMessageAsRead(msgHdr)
{
  ClearPendingReadTimer();
  var headers = Components.classes["@mozilla.org/array;1"]
                          .createInstance(Components.interfaces.nsIMutableArray);
  headers.appendElement(msgHdr, false);
  msgHdr.folder.markMessagesRead(headers, true);
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
  // If rss feed (has 'content-base' header), show summary or load web
  // page per pref; earliest we have content DOM is here (onMsgParsed).
  FeedSetContentView();

  // browser doesn't do this, but I thought it could be a useful thing to test out...
  // If the find bar is visible and we just loaded a new message, re-run
  // the find command. This means the new message will get highlighted and
  // we'll scroll to the first word in the message that matches the find text.
  var findBar = document.getElementById("FindToolbar");
  if (!findBar.hidden)
    findBar.onFindAgainCommand(false);

  // Run the phishing detector on the message if it hasn't been marked as not
  // a scam already.
  var msgHdr = gMessageDisplay.displayedMessage;
  if (msgHdr && !msgHdr.getUint32Property("notAPhishMessage"))
    gPhishingDetector.analyzeMsgForPhishingURLs(aUrl);

  // notify anyone (e.g., extensions) who's interested in when a message is loaded.
  var msgURI = gFolderDisplay.selectedMessageUris[0];
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

  var msgHdr = gMessageDisplay.displayedMessage;
  if (!folder || !msgHdr)
    return;

  var wintype = document.documentElement.getAttribute('windowtype');

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
        MarkMessageAsRead(msgHdr);
      else
        gMarkViewedMessageAsReadTimer = setTimeout(MarkMessageAsRead,
                                                   markReadDelayTime * 1000,
                                                   msgHdr);
    }
    else // standalone msg window
    {
      MarkMessageAsRead(msgHdr);
    }
  }

  // See if MDN was requested but has not been sent.
  HandleMDNResponse(aUrl);

  if (!gFolderDisplay.selectedMessageIsImap)
    return;

  var imapServer = folder.server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
  if (imapServer.storeReadMailInPFC)
  {
    // Look in read mail PFC for msg with same msg id - if we find one,
    // don't put this message in the read mail pfc.
    var outputPFC = imapServer.GetReadMailPFC(true);

    if (msgHdr && msgHdr.messageId.length > 0)
    {
      var readMailDB = outputPFC.msgDatabase;
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
  var msgHdr = gFolderDisplay.selectedMessage;
  if (!msgFolder || !msgHdr || gFolderDisplay.selectedMessageIsNews)
    return;

  // if the message is marked as junk, do NOT attempt to process a return receipt
  // in order to better protect the user
  if (SelectedMessagesAreJunk())
    return;

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
  var msgFlags = msgHdr.flags;
  if ((msgFlags & Components.interfaces.nsMsgMessageFlags.IMAPDeleted) ||
      (msgFlags & Components.interfaces.nsMsgMessageFlags.MDNReportSent))
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
  msgHdr.flags = (msgFlags &
                  ~Components.interfaces.nsMsgMessageFlags.MDNReportNeeded);
  msgHdr.OrFlags(Components.interfaces.nsMsgMessageFlags.MDNReportSent);

  // Commit db changes.
  var msgdb = msgFolder.msgDatabase;
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
  var args = { folder: gFolderDisplay.displayedFolder };
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

// Switch between message body (feed summary) and content-base url in
// the Message Pane, called in MsgOpenSelectedMessages
function FeedSetContentViewToggle()
{
  gShowFeedSummaryToggle = true;
  FeedSetContentView(gShowFeedSummary ? 0 : 1);
}

// Check message format
function FeedCheckContentFormat()
{
  // Not an rss message
  if (!gFolderDisplay.selectedMessageIsFeed)
    return false;

  var contentWindowDoc = window.top.content.document;

  // Thunderbird 2 rss messages with 'Show article summary' not selected,
  // ie message body constructed to show web page in an iframe, can't show
  // a summary - notify user.
  var rssIframe = contentWindowDoc.getElementById('_mailrssiframe');
  if (rssIframe) {
    if (gShowFeedSummaryToggle ||
        pref.getIntPref("rss.show.summary") == 1) {
      var titleMsg = gMessengerBundle.getString("feedNoSummaryTitle");
      var dialogMsg = gMessengerBundle.getString("feedNoSummaryAlert");
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);
      promptService.alert(window, titleMsg, dialogMsg);
      gShowFeedSummaryToggle = false;
    }
    return false;
  }

  return true;
}

// View summary or load web page for feeds
function FeedSetContentView(val)
{
  // Check it..
  if (!FeedCheckContentFormat())
    return;

  var showSummary;
  var wintype = document.documentElement.getAttribute('windowtype');
  var contentBase = currentHeaderData["content-base"];
  var contentWindowDoc = window.top.content.document;
  var divHTML = new XPCNativeWrapper(contentWindowDoc,
                      "getElementsByClassName()")
                      .getElementsByClassName("moz-text-html")[0];
  var divPLAIN = new XPCNativeWrapper(contentWindowDoc,
                      "getElementsByClassName()")
                      .getElementsByClassName("moz-text-plain")[0];

  if (val == null)
    // Not passed a value, so generic select unless in toggle mode
    if (!gShowFeedSummaryToggle)
      // Not in toggle mode, get prefs
      val = pref.getIntPref("rss.show.summary");
    else {
      // Coming in again from toggle, summary already 'reloadMessage'ed,
      // just need to set display for summary on.
      gShowFeedSummaryToggle = false;
      if (divHTML)
        divHTML.parentNode.setAttribute("selected", gShowFeedSummary);
      if (divPLAIN)
        divPLAIN.parentNode.setAttribute("selected", gShowFeedSummary);
      return;
    }

  switch (val) {
    case 0:
      showSummary = false;
      break;
    case 1:
      showSummary = true
      break;
    case 2:
      if (wintype == "mail:3pane") {
        // Get quickmode per feed pref from feeds.rdf
        var quickMode, targetRes;
        var scriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Components.interfaces.mozIJSSubScriptLoader);
        if (scriptLoader && typeof FZ_NS == 'undefined')
          scriptLoader.loadSubScript("chrome://messenger-newsblog/content/utils.js");
        try
        {
          var targetRes = getParentTargetForChildResource(
                          gMsgFolderSelected.URI,
                          FZ_QUICKMODE,
                          gMsgFolderSelected.server);
        }
        catch (ex) {};

        if (targetRes)
        {
          quickMode = targetRes.QueryInterface(Components.interfaces
                               .nsIRDFLiteral);
          quickMode = quickMode.Value;
          quickMode = eval(quickMode);
        }
        else
          // Do not have this item's feed anymore in feeds.rdf though its
          // message folder remains and its items exist in feeditems.rdf
          // (Bug 309449), or the item has been moved to another folder,
          // or some error on the file. Default to show summary.
          quickMode = true;
      }
      showSummary = quickMode;
      break;
  }

  gShowFeedSummary = showSummary;

  // Message window - here only if GetFeedOpenHandler() = 0 or 1
  if (wintype == "mail:messageWindow") {
    // Set global var for message window
    gShowFeedSummary = GetFeedOpenHandler();
    // Get pref since may be reusable message window and changed in 3pane
    showSummary = gShowFeedSummary == 0 ? false : true;
  }

  if (divHTML)
    divHTML.parentNode.setAttribute("selected", showSummary);
  if (divPLAIN)
    divPLAIN.parentNode.setAttribute("selected", showSummary);

  if (showSummary) {
    if (gShowFeedSummaryToggle) {
      if (gDBView && GetNumSelectedMessages() == 1) {
        ReloadMessage();
      }
    }
  }
  else if(contentBase.headerValue) {
    document.getElementById("messagepane")
            .loadURI(contentBase.headerValue, null, null);
    gShowFeedSummaryToggle = false;
  }
}
