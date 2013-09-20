/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 sw=2 sts=2 et :*/
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/folderUtils.jsm");

const kClassicMailLayout  = 0;
const kWideMailLayout     = 1;
const kVerticalMailLayout = 2;

const kMouseButtonLeft   = 0;
const kMouseButtonMiddle = 1;
const kMouseButtonRight  = 2;

// Per message header flags to keep track of whether the user is allowing remote
// content for a particular message.
// if you change or add more values to these constants, be sure to modify
// the corresponding definitions in nsMsgContentPolicy.cpp
const kNoRemoteContentPolicy = 0;
const kBlockRemoteContent = 1;
const kAllowRemoteContent = 2;

const kIsAPhishMessage = 0;
const kNotAPhishMessage = 1;

const kMsgForwardAsAttachment = 0;
const kMsgForwardInline = 2;

var gMessengerBundle;
var gOfflineManager;
var gCopyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                             .getService(Components.interfaces.nsIMsgCopyService);
var gMarkViewedMessageAsReadTimer = null; // if the user has configured the app to mark a message as read if it is viewed for more than n seconds

var gTimelineService = null;
var gTimelineEnabled = ("@mozilla.org;timeline-service;1" in Components.classes);
if (gTimelineEnabled) {
  try {
    gTimelineEnabled = Services.prefs.getBoolPref("mailnews.timeline_is_enabled");
    if (gTimelineEnabled) {
      gTimelineService = 
        Components.classes["@mozilla.org;timeline-service;1"].getService(Components.interfaces.nsITimelineService);
    }
  }
  catch (ex)
  {
    gTimelineEnabled = false;
  }
}

var disallow_classes_no_html = 1; /* the user preference,
     if HTML is not allowed. I assume, that the user could have set this to a
     value > 1 in his prefs.js or user.js, but that the value will not
     change during runtime other than through the MsgBody*() functions below.*/

// Disable the File | New | Account... menu item if the account preference is locked.
// Two other affected areas are the account central and the account manager dialogs.
function menu_new_init()
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var newAccountItem = document.getElementById('newAccountMenuItem');
  if (Services.prefs.prefIsLocked("mail.disable_new_account_addition"))
    newAccountItem.setAttribute("disabled","true");

  // Change New Folder... menu according to the context
  var folderArray = GetSelectedMsgFolders();
  if (folderArray.length == 0)
    return;
  var msgFolder = folderArray[0];
  var isServer = msgFolder.isServer;
  var serverType = msgFolder.server.type;
  var canCreateNew = msgFolder.canCreateSubfolders;
  var isInbox = msgFolder.isSpecialFolder(
                  Components.interfaces.nsMsgFolderFlags.Inbox, false);
  var isIMAPFolder = serverType == "imap";
  var showNew = ((serverType != 'nntp') && canCreateNew) || isInbox;
  ShowMenuItem("menu_newFolder", showNew);
  ShowMenuItem("menu_newVirtualFolder", showNew);
  EnableMenuItem("menu_newFolder", !isIMAPFolder || !Services.io.offline);
  EnableMenuItem("menu_newVirtualFolder", true);
  if (showNew)
    SetMenuItemLabel("menu_newFolder", gMessengerBundle.getString((isServer || isInbox) ? "newFolderMenuItem" : "newSubfolderMenuItem"));
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
}

function InitGoMessagesMenu()
{
  // deactivate the folders in the go menu if we don't have a folderpane
  document.getElementById("mailFolderPane")
          .setAttribute("disabled", IsFolderPaneCollapsed());
  document.commandDispatcher.updateCommands('create-menu-go');
}

function view_init()
{
  if (!gMessengerBundle)
    gMessengerBundle = document.getElementById("bundle_messenger");

  var message_menuitem = document.getElementById("menu_showMessagePane");
  if (message_menuitem && !message_menuitem.hidden)
  {
    message_menuitem.setAttribute("checked", !IsMessagePaneCollapsed());
    message_menuitem.setAttribute("disabled", gAccountCentralLoaded);
  }

  var threadpane_menuitem = document.getElementById("menu_showThreadPane");
  if (threadpane_menuitem && !threadpane_menuitem.hidden)
  {
    threadpane_menuitem.setAttribute("checked", !IsDisplayDeckCollapsed());
    threadpane_menuitem.setAttribute("disabled", gAccountCentralLoaded);
  }

  var folderPane_menuitem = document.getElementById("menu_showFolderPane");
  if (folderPane_menuitem && !folderPane_menuitem.hidden)
    folderPane_menuitem.setAttribute("checked", !IsFolderPaneCollapsed());

  var sort_menuitem = document.getElementById("viewSortMenu");
  if (sort_menuitem)
    sort_menuitem.setAttribute("disabled", gAccountCentralLoaded);

  var view_menuitem = document.getElementById("viewMessageViewMenu");
  if (view_menuitem)
    view_menuitem.setAttribute("disabled", gAccountCentralLoaded);

  var threads_menuitem = document.getElementById("viewMessagesMenu");
  if (threads_menuitem)
    threads_menuitem.setAttribute("disabled", gAccountCentralLoaded);

  // Initialize the Message Body menuitem
  var isFeed = gFolderDisplay.selectedMessageIsFeed;
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
  var checked = Services.prefs.getIntPref("rss.show.summary");
  document.getElementById(viewRssMenuItemIds[checked])
          .setAttribute("checked", true);

  if (winType != "mail:3pane") {
    document.getElementById("viewFeedSummarySeparator").hidden = true;
    document.getElementById("bodyFeedGlobalWebPage").hidden = true;
    document.getElementById("bodyFeedGlobalSummary").hidden = true;
    document.getElementById("bodyFeedPerFolderPref").hidden = true;
  }

  // Initialize the Display Attachments Inline menu.
  var viewAttachmentInline = Services.prefs.getBoolPref("mail.inline_attachments");
  document.getElementById("viewAttachmentsInlineMenuitem").setAttribute("checked", viewAttachmentInline ? "true" : "false");

  document.commandDispatcher.updateCommands('create-menu-view');
}

function InitViewLayoutStyleMenu(event)
{
  var paneConfig = Services.prefs.getIntPref("mail.pane_config.dynamic");
  var layoutStyleMenuitem = event.target.childNodes[paneConfig];
  if (layoutStyleMenuitem)
    layoutStyleMenuitem.setAttribute("checked", "true");
}

function setSortByMenuItemCheckState(id, value)
{
    var menuitem = document.getElementById(id);
    if (menuitem) {
      menuitem.setAttribute("checked", value);
    }
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
    var sortTypeSupportsGrouping = (sortType == nsMsgViewSortType.byAuthor 
        || sortType == nsMsgViewSortType.byDate || sortType == nsMsgViewSortType.byReceived || sortType == nsMsgViewSortType.byPriority
        || sortType == nsMsgViewSortType.bySubject || sortType == nsMsgViewSortType.byTags
        || sortType == nsMsgViewSortType.byRecipient|| sortType == nsMsgViewSortType.byFlagged
        || sortType == nsMsgViewSortType.byAttachments);

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
  var viewFlags = gDBView ? gDBView.viewFlags : 0;
  var viewType = gDBView ? gDBView.viewType : 0;

  var allMenuItem = document.getElementById("viewAllMessagesMenuItem");
  if (allMenuItem)
    allMenuItem.setAttribute("checked",  (viewFlags & nsMsgViewFlagsType.kUnreadOnly) == 0 && (viewType == nsMsgViewType.eShowAllThreads));

  var unreadMenuItem = document.getElementById("viewUnreadMessagesMenuItem");
  if (unreadMenuItem)
    unreadMenuItem.setAttribute("checked", (viewFlags & nsMsgViewFlagsType.kUnreadOnly) != 0);

  var theadsWithUnreadMenuItem = document.getElementById("viewThreadsWithUnreadMenuItem");
  if (theadsWithUnreadMenuItem)
    theadsWithUnreadMenuItem.setAttribute("checked", viewType == nsMsgViewType.eShowThreadsWithUnread);

  var watchedTheadsWithUnreadMenuItem = document.getElementById("viewWatchedThreadsWithUnreadMenuItem");
  if (watchedTheadsWithUnreadMenuItem)
    watchedTheadsWithUnreadMenuItem.setAttribute("checked", viewType == nsMsgViewType.eShowWatchedThreadsWithUnread);
  
  var ignoredTheadsMenuItem = document.getElementById("viewIgnoredThreadsMenuItem");
  if (ignoredTheadsMenuItem)
    ignoredTheadsMenuItem.setAttribute("checked", (viewFlags & nsMsgViewFlagsType.kShowIgnored) != 0);
}

function InitMessageMenu()
{
  var aMessage = gFolderDisplay.selectedMessage;
  var isNews = gFolderDisplay.selectedMessageIsNews;
  var isFeed = gFolderDisplay.selectedMessageIsFeed;

  // We show Reply to Newsgroups only for news messages.
  var replyNewsgroupMenuItem = document.getElementById("replyNewsgroupMainMenu");
  if(replyNewsgroupMenuItem)
  {
      replyNewsgroupMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }

  // We show Reply to List only for list posts.
  var replyListMenuItem = document.getElementById("replyListMainMenu");
  if (replyListMenuItem)
    replyListMenuItem.hidden = isNews || !IsListPost();

  //For mail messages we say reply. For news we say ReplyToSender.
  var replyMenuItem = document.getElementById("replyMainMenu");
  if(replyMenuItem)
  {
      replyMenuItem.setAttribute("hidden", !isNews ? "" : "true");
  }

  var replySenderMenuItem = document.getElementById("replySenderMainMenu");
  if(replySenderMenuItem)
  {
      replySenderMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }

  //We show Reply to Sender and Newsgroup only for news messages.
  var replySenderAndNewsgroupMenuItem = document.getElementById("replySenderAndNewsgroupMainMenu");
  if (replySenderAndNewsgroupMenuItem)
    replySenderAndNewsgroupMenuItem.hidden = !isNews;

  // For mail messages we say reply all. For news we say ReplyToAllRecipients.
  var replyAllMenuItem = document.getElementById("replyallMainMenu");
  if (replyAllMenuItem)
    replyAllMenuItem.hidden = isNews;

  var replyAllRecipientsMenuItem = document.getElementById("replyAllRecipientsMainMenu");
  if (replyAllRecipientsMenuItem)
    replyAllRecipientsMenuItem.hidden = !isNews;

  // We only show Ignore Thread and Watch Thread menu itmes for news.
  var threadMenuSeparator = document.getElementById("threadItemsSeparator");
  if (threadMenuSeparator) {
      threadMenuSeparator.setAttribute("hidden", isNews ? "" : "true");
  }
  var killThreadMenuItem = document.getElementById("killThread");
  if (killThreadMenuItem) {
      killThreadMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }
  var killSubthreadMenuItem = document.getElementById("killSubthread");
  if (killSubthreadMenuItem) {
      killSubthreadMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }
  var watchThreadMenuItem = document.getElementById("watchThread");
  if (watchThreadMenuItem) {
      watchThreadMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }
  var cancelMenuItem = document.getElementById("menu_cancel");
  if (cancelMenuItem) {
      cancelMenuItem.setAttribute("hidden", isNews ? "" : "true");
  }

  // Disable the Move and Copy menus if there are no messages selected.
  // Disable the Move menu if we can't delete messages from the folder.
  var moveMenu = document.getElementById("moveMenu");
  var msgFolder = GetLoadedMsgFolder();
  if(moveMenu)
  {
      var enableMenuItem = aMessage && msgFolder && msgFolder.canDeleteMessages;
      moveMenu.setAttribute("disabled", !enableMenuItem);
  }

  var copyMenu = document.getElementById("copyMenu");
  var canCopy = aMessage && (!gMessageDisplay.isDummy ||
                             window.arguments[0].scheme == "file");
  if (copyMenu)
      copyMenu.setAttribute("disabled", !canCopy);

  // Disable the Forward as/Tag menu items if no message is selected.
  var forwardAsMenu = document.getElementById("forwardAsMenu");
  if(forwardAsMenu)
      forwardAsMenu.setAttribute("disabled", !aMessage);

  var tagMenu = document.getElementById("tagMenu");
  if(tagMenu)
      tagMenu.setAttribute("disabled", !aMessage);

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

  // Disable the Mark menu when we're not in a folder.
  var markMenu = document.getElementById("markMenu");
  if(markMenu)
      markMenu.setAttribute("disabled", !msgFolder);

  document.commandDispatcher.updateCommands('create-menu-message');
}

function InitViewHeadersMenu()
{
  var id = null;
  var headerchoice = 1;
  try 
  {
    headerchoice = Services.prefs.getIntPref("mail.show_headers");
  }
  catch (ex) 
  {
    dump("failed to get the header pref\n");
  }

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
                      "bodyAsPlaintext",
                      "bodyAllParts"];
  const rssIDs = ["bodyFeedSummaryAllowHTML",
                  "bodyFeedSummarySanitized",
                  "bodyFeedSummaryAsPlaintext"];
  var menuIDs = isFeed ? rssIDs : defaultIDs;
  try
  {
    // Get prefs
    if (isFeed) {
      prefer_plaintext = Services.prefs.getBoolPref("rss.display.prefer_plaintext");
      html_as = Services.prefs.getIntPref("rss.display.html_as");
      disallow_classes = Services.prefs.getIntPref("rss.display.disallow_mime_handlers");
    }
    else {
      prefer_plaintext = Services.prefs.getBoolPref("mailnews.display.prefer_plaintext");
      html_as = Services.prefs.getIntPref("mailnews.display.html_as");
      disallow_classes =
                    Services.prefs.getIntPref("mailnews.display.disallow_mime_handlers");
    }

    if (disallow_classes > 0)
      disallow_classes_no_html = disallow_classes;
    // else disallow_classes_no_html keeps its inital value (see top)
  }
  catch (ex)
  {
    dump("failed to get the body plaintext vs. HTML prefs\n");
  }

  var AllowHTML_menuitem = document.getElementById(menuIDs[0]);
  var Sanitized_menuitem = document.getElementById(menuIDs[1]);
  var AsPlaintext_menuitem = document.getElementById(menuIDs[2]);
  var AllBodyParts_menuitem;
  if (!isFeed) {
    AllBodyParts_menuitem = document.getElementById(menuIDs[3]);
    AllBodyParts_menuitem.hidden =
      !Services.prefs.getBoolPref("mailnews.display.show_all_body_parts_menu");
  }

  if (!prefer_plaintext && !html_as && !disallow_classes &&
      AllowHTML_menuitem)
    AllowHTML_menuitem.setAttribute("checked", true);
  else if (!prefer_plaintext && html_as == 3 && disallow_classes > 0 &&
      Sanitized_menuitem)
    Sanitized_menuitem.setAttribute("checked", true);
  else if (prefer_plaintext && html_as == 1 && disallow_classes > 0 &&
      AsPlaintext_menuitem)
    AsPlaintext_menuitem.setAttribute("checked", true);
  else if (!prefer_plaintext && html_as == 4 && !disallow_classes &&
      AllBodyParts_menuitem)
    AllBodyParts_menuitem.setAttribute("checked", true);
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
  for (let j = 0; j < tagArray.length; ++j)
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

  for (let i = 0; i < selectedMessages.length; ++i)
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

function InitNewMsgMenu(aPopup)
{
  var identity = null;
  var folder = GetFirstSelectedMsgFolder();
  if (folder)
    identity = getIdentityForServer(folder.server);
  if (!identity)
    identity = Components.classes["@mozilla.org/messenger/account-manager;1"]
                         .getService(Components.interfaces.nsIMsgAccountManager)
                         .defaultAccount.defaultIdentity;
  // If the identity is not found, use the mail.html_compose pref to
  // determine the message compose type (HTML or PlainText).
  var composeHTML = identity ? identity.composeHtml
                             : Services.prefs.getBoolPref("mail.html_compose");
  const kIDs = {true: "button-newMsgHTML", false: "button-newMsgPlain"};
  document.getElementById(kIDs[composeHTML]).setAttribute("default", "true");
  document.getElementById(kIDs[!composeHTML]).removeAttribute("default");
}

function InitMessageReply(aPopup)
{
  var isNews = gFolderDisplay.selectedMessageIsNews;
  //For mail messages we say reply. For news we say ReplyToSender.
  // We show Reply to Newsgroups only for news messages.
  aPopup.childNodes[0].hidden = isNews; // Reply
  aPopup.childNodes[1].hidden = isNews || !IsListPost(); // Reply to List
  aPopup.childNodes[2].hidden = !isNews; // Reply to Newsgroup
  aPopup.childNodes[3].hidden = !isNews; // Reply to Sender Only
}

function InitMessageForward(aPopup)
{
  var forwardType = Services.prefs.getIntPref("mail.forward_message_mode");

  if (forwardType != kMsgForwardAsAttachment)
  {
    // forward inline is the first menuitem
    aPopup.firstChild.setAttribute("default", "true");
    aPopup.lastChild.removeAttribute("default");
  }
  else
  {
    // attachment is the last menuitem
    aPopup.lastChild.setAttribute("default", "true");
    aPopup.firstChild.removeAttribute("default");
  }
}

function ToggleMessageTagKey(index)
{
  // toggle the tag state based upon that of the first selected message
  var msgHdr = gFolderDisplay.selectedMessage;
  if (!msgHdr)
    return;

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
  for (let i = 0; i < selectedMessages.length; ++i)
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

function InitBackToolbarMenu(menuPopup)
{
  PopulateHistoryMenu(menuPopup, -1);
}

function InitForwardToolbarMenu(menuPopup)
{
  PopulateHistoryMenu(menuPopup, 1);
}

function PopulateHistoryMenu(menuPopup, navOffset)
{
  // remove existing entries
  while (menuPopup.firstChild)
    menuPopup.removeChild(menuPopup.firstChild);

  var curPos = {};
  var numEntries = {};
  var historyEntries = {};
  messenger.getNavigateHistory(curPos, numEntries, historyEntries);
  var historyArray = historyEntries.value;
  var maxPos = numEntries.value / 2; // numEntries is always even
  var startPos = curPos.value;
  if (GetLoadedMessage())
    startPos += navOffset;

  // starting from the current entry, march through history until we reach
  // the array border or our menuitem limit
  for (var i = startPos, itemCount = 0;
       (i >= 0) && (i < maxPos) && (itemCount < 25);
       i += navOffset, ++itemCount)
  {
    var menuText = "";
    let folder = GetMsgFolderFromUri(historyArray[i * 2 + 1]);
    if (!IsCurrentLoadedFolder(folder))
      menuText += folder.prettyName + ": ";

    var msgHdr = messenger.msgHdrFromURI(historyArray[i * 2]);
    var subject = "";
    if (msgHdr.flags & Components.interfaces.nsMsgMessageFlags.HasRe)
      subject = "Re: ";
    if (msgHdr.mime2DecodedSubject)
       subject += msgHdr.mime2DecodedSubject;
    if (subject)
      menuText += subject + " - ";
    menuText += msgHdr.mime2DecodedAuthor;

    var newMenuItem = document.createElement('menuitem');
    newMenuItem.setAttribute('label', menuText);
    newMenuItem.setAttribute('value', i - startPos);
    newMenuItem.folder = folder;
    menuPopup.appendChild(newMenuItem);
  }
}

function NavigateToUri(target)
{
  var historyIndex = target.getAttribute('value');
  let folderUri = target.folder.URI;
  var msgUri = messenger.getMsgUriAtNavigatePos(historyIndex);
  let msgHdrKey = messenger.msgHdrFromURI(msgUri).messageKey;
  messenger.navigatePos += Number(historyIndex);
  if (folderUri == GetThreadPaneFolder().URI)
  {
    gDBView.selectMsgByKey(msgHdrKey);
  }
  else
  {
    gStartMsgKey = msgHdrKey;
    SelectFolder(folderUri);
  }
}

function InitMessageMark()
{
  var areMessagesRead = SelectedMessagesAreRead();
  var readItem = document.getElementById("cmd_markAsRead");
  if(readItem)
     readItem.setAttribute("checked", areMessagesRead);

  var areMessagesFlagged = SelectedMessagesAreFlagged();
  var flaggedItem = document.getElementById("cmd_markAsFlagged");
  if(flaggedItem)
     flaggedItem.setAttribute("checked", areMessagesFlagged);

  document.commandDispatcher.updateCommands('create-menu-mark');
}

function UpdateJunkToolbarButton()
{
  var junkButtonDeck = document.getElementById("junk-deck");
  // Wallpaper over Bug 491676 by using the attribute instead of the property.
  junkButtonDeck.setAttribute("selectedIndex", SelectedMessagesAreJunk() ? 1 : 0);
}

function UpdateDeleteToolbarButton(aFolderPaneHasFocus)
{
  var deleteButtonDeck = document.getElementById("delete-deck");
  var selectedIndex = 0;

  // Never show "Undelete" in the 3-pane for folders, when delete would
  // apply to the selected folder.
  if (!aFolderPaneHasFocus && SelectedMessagesAreDeleted())
    selectedIndex = 1;

  // Wallpaper over Bug 491676 by using the attribute instead of the property.
  deleteButtonDeck.setAttribute("selectedIndex", selectedIndex);
}

function UpdateDeleteCommand()
{
  var value = "value";
  if (SelectedMessagesAreDeleted())
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
  var firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage &&
         (firstSelectedMessage.flags &
          Components.interfaces.nsMsgMessageFlags.IMAPDeleted);
}

function SelectedMessagesAreJunk()
{
  var firstSelectedMessage = gFolderDisplay.selectedMessage;
  if (!firstSelectedMessage)
    return false;

  var junkScore = firstSelectedMessage.getStringProperty("junkscore");
  return (junkScore != "") && (junkScore != "0");
}

function SelectedMessagesAreRead()
{
  for (let i = 0; i < gFolderDisplay.selectedMessages.length; ++i)
  {
    if (!gFolderDisplay.selectedMessages[i].isRead)
      return false;
  }
  return true;
}

function SelectedMessagesAreFlagged()
{
  var firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage && firstSelectedMessage.isFlagged;
}

function getMsgToolbarMenu_init()
{
    document.commandDispatcher.updateCommands('create-menu-getMsgToolbar');
}

function GetFirstSelectedMsgFolder()
{
    var result = null;
    var selectedFolders = GetSelectedMsgFolders();
    if (selectedFolders.length > 0) {
        result = selectedFolders[0];
    }

    return result;
}

function GetInboxFolder(server)
{
    try {
        var rootMsgFolder = server.rootMsgFolder;

        //now find Inbox
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

  // If the server doesn't support an inbox it could be an RSS server or
  // some other server type, just use the root folder and the server
  // implementation can figure out what to do.
  if (!inboxFolder)
    inboxFolder = server.rootFolder;

  GetNewMessages([inboxFolder], server);
}

function MsgGetMessage()
{
  // if offline, prompt for getting messages
  if (DoGetNewMailWhenOffline())
    GetFolderMessages();
}

function MsgGetMessagesForAllServers(defaultServer)
{
  MailTasksGetMessagesForAllServers(true, msgWindow, defaultServer);
}

/**
  * Get messages for all those accounts which have the capability
  * of getting messages and have session password available i.e.,
  * curretnly logged in accounts.
  * if offline, prompt for getting messages.
  */
function MsgGetMessagesForAllAuthenticatedAccounts()
{
  if (DoGetNewMailWhenOffline())
    MailTasksGetMessagesForAllServers(false, msgWindow, null);
}

/**
  * Get messages for the account selected from Menu dropdowns.
  * if offline, prompt for getting messages.
  */
function MsgGetMessagesForAccount(aEvent)
{
  if (!aEvent)
    return;

  if (DoGetNewMailWhenOffline())
    GetMessagesForAccount(aEvent);
}

// if offline, prompt for getNextNMessages
function MsgGetNextNMessages()
{
  if (DoGetNewMailWhenOffline()) {
    var folder = GetFirstSelectedMsgFolder();
    if(folder) 
      GetNextNMessages(folder);
  }
}

function MsgDeleteMessage(aReallyDelete)
{
  // If the user deletes a message before its mark as read timer goes off,
  // we should mark it as read (unless the user changed the pref). This
  // ensures that we clear the biff indicator from the system tray when
  // the user deletes the new message.
  if (Services.prefs.getBoolPref("mailnews.ui.deleteMarksRead"))
    MarkSelectedMessagesRead(true);
  SetNextMessageAfterDelete();

  // determine if we're using the IMAP delete model
  var server = GetFirstSelectedMsgFolder().server;
  const kIMAPDelete = Components.interfaces.nsMsgImapDeleteModels.IMAPDelete;
  var imapDeleteModelUsed = server instanceof Components.interfaces.nsIImapIncomingServer &&
                            server.deleteModel == kIMAPDelete;

  // execute deleteNoTrash only if IMAP delete model is not used
  if (aReallyDelete && !imapDeleteModelUsed)
    gDBView.doCommand(nsMsgViewCommandType.deleteNoTrash);
  else
    gDBView.doCommand(nsMsgViewCommandType.deleteMsg);
}

function MsgCopyMessage(destFolder)
{
  try {
    // get the msg folder we're copying messages into
    var destUri = destFolder.getAttribute('id');
    let destMsgFolder = GetMsgFolderFromUri(destUri);
    if (gMessageDisplay.isDummy)
    {
      let file = window.arguments[0].QueryInterface(Components.interfaces.nsIFileURL).file;
      MailServices.copy.CopyFileMessage(file, destMsgFolder, null, false,
                                        Components.interfaces.nsMsgMessageFlags.Read,
                                        "", null, msgWindow);
    }
    else
    {
      gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages, destMsgFolder);
    }
  }
  catch (ex) {
    dump("MsgCopyMessage failed: " + ex + "\n");
  }
}

function MsgMoveMessage(destFolder)
{
  try {
    // get the msg folder we're moving messages into
    var destUri = destFolder.getAttribute('id');
    let destMsgFolder = GetMsgFolderFromUri(destUri);
    SetNextMessageAfterDelete();
    gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, destMsgFolder);
  }
  catch (ex) {
    dump("MsgMoveMessage failed: " + ex + "\n");
  }
}

/**
 * Calls the ComposeMessage function with the desired type and proper default
 * based on the event that fired it.
 *
 * @param aCompType  The nsIMsgCompType to pass to the function.
 * @param aEvent (optional) The event that triggered the call.
 * @param aFormat (optional) Override the message format.
 */
function ComposeMsgByType(aCompType, aEvent, aFormat)
{
  var format = aFormat || ((aEvent && aEvent.shiftKey) ? msgComposeFormat.OppositeOfDefault : msgComposeFormat.Default);

  ComposeMessage(aCompType,
                 format,
                 GetFirstSelectedMsgFolder(),
                 gFolderDisplay ? gFolderDisplay.selectedMessageUris : null);
}

function MsgNewMessage(aEvent)
{
  var mode = aEvent && aEvent.target.getAttribute("mode");
  ComposeMsgByType(msgComposeType.New, aEvent, mode && msgComposeFormat[mode]);
}

function MsgReplyMessage(aEvent)
{
  if (gFolderDisplay.selectedMessageIsNews)
    MsgReplyGroup(aEvent);
  else if (!gFolderDisplay.selectedMessageIsFeed)
    MsgReplySender(aEvent);
}

function MsgReplyList(aEvent)
{
  ComposeMsgByType(msgComposeType.ReplyToList, aEvent);
}

function MsgReplyGroup(aEvent)
{
  ComposeMsgByType(msgComposeType.ReplyToGroup, aEvent);
}

function MsgReplySender(aEvent)
{
  ComposeMsgByType(msgComposeType.ReplyToSender, aEvent);
}

function MsgReplyToAllMessage(aEvent)
{
  var loadedFolder = GetLoadedMsgFolder();
  var server = loadedFolder.server;

  if (server && server.type == "nntp")
    MsgReplyToSenderAndGroup(aEvent);
  else
    MsgReplyToAllRecipients(aEvent);
}

function MsgReplyToAllRecipients(aEvent)
{
  ComposeMsgByType(msgComposeType.ReplyAll, aEvent);
}

function MsgReplyToSenderAndGroup(aEvent)
{
  ComposeMsgByType(msgComposeType.ReplyToSenderAndGroup, aEvent);
}


// Message Archive function

function BatchMessageMover()
{
  this._batches = {};
  this._currentKey = null;
  this._dstFolderParent = null;
  this._dstFolderName = null;
}

BatchMessageMover.prototype =
{
  archiveMessages: function(aMsgHdrs)
  {
    if (!aMsgHdrs.length)
      return;

    // We need to get the index of the message to select after archiving
    // completes but reset the global variable to prevent the DBview from
    // updating the selection; we'll do it manually at the end of
    // processNextBatch.
    SetNextMessageAfterDelete();
    this.messageToSelectAfterWereDone = gNextMessageViewIndexAfterDelete;
    gNextMessageViewIndexAfterDelete = -2;

    for (let i = 0; i < aMsgHdrs.length; ++i)
    {
      let msgHdr = aMsgHdrs[i];
      let server = msgHdr.folder.server;
      let msgDate = new Date(msgHdr.date / 1000);  // convert date to JS date object
      let msgYear = msgDate.getFullYear().toString();
      let monthFolderName = msgDate.toLocaleFormat("%Y-%m");

      let archiveFolderUri;
      let archiveGranularity;
      let archiveKeepFolderStructure;
      if (server.type == "rss") {
        // RSS servers don't have an identity so we special case the archives URI.
        archiveFolderUri = server.serverURI + "/Archives";
        archiveGranularity =
          Services.prefs.getIntPref("mail.identity.default.archive_granularity");
        archiveKeepFolderStructure =
          Services.prefs.getBoolPref("mail.identity.default.archive_keep_folder_structure");
      }
      else {
        let identity = GetIdentityForHeader(msgHdr,
          Components.interfaces.nsIMsgCompType.ReplyAll);
        archiveFolderUri = identity.archiveFolder;
        archiveGranularity = identity.archiveGranularity;
        archiveKeepFolderStructure = identity.archiveKeepFolderStructure;
      }
      let archiveFolder = GetMsgFolderFromUri(archiveFolderUri, false);

      let copyBatchKey = msgHdr.folder.URI + '\000' + monthFolderName;
      if (!(copyBatchKey in this._batches))
        this._batches[copyBatchKey] = [msgHdr.folder,
                                       archiveFolderUri,
                                       archiveGranularity,
                                       archiveKeepFolderStructure,
                                       msgYear,
                                       monthFolderName];
      this._batches[copyBatchKey].push(msgHdr);
    }

    let notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                                        .getService(Components.interfaces.nsIMsgFolderNotificationService);
    notificationService.addListener(this, notificationService.folderAdded);

    // Now we launch the code iterating over all message copies, one in turn.
    this.processNextBatch();
  },

  processNextBatch: function()
  {
    for (let key in this._batches)
    {
      this._currentKey = key;
      let batch = this._batches[key];
      let [srcFolder, archiveFolderUri, granularity, keepFolderStructure, msgYear, msgMonth] = batch;
      let msgs = batch.slice(6);

      let archiveFolder = GetMsgFolderFromUri(archiveFolderUri, false);
      let dstFolder = archiveFolder;
      // For folders on some servers (e.g. IMAP), we need to create the
      // sub-folders asynchronously, so we chain the urls using the listener
      // called back from createStorageIfMissing. For local,
      // createStorageIfMissing is synchronous.
      let isAsync = archiveFolder.server.protocolInfo.foldersCreatedAsync;
      if (!archiveFolder.parent)
      {
        archiveFolder.setFlag(Components.interfaces.nsMsgFolderFlags.Archive);
        archiveFolder.createStorageIfMissing(this);
        if (isAsync)
          return;
      }
      if (!archiveFolder.canCreateSubfolders)
        granularity = Components.interfaces.nsIMsgIdentity.singleArchiveFolder;
      if (granularity >= Components.interfaces.nsIMsgIdentity.perYearArchiveFolders)
      {
        archiveFolderUri += "/" + msgYear;
        dstFolder = GetMsgFolderFromUri(archiveFolderUri, false);
        if (!dstFolder.parent)
        {
          dstFolder.createStorageIfMissing(this);
          if (isAsync)
            return;
        }
      }
      if (granularity >= Components.interfaces.nsIMsgIdentity.perMonthArchiveFolders)
      {
        archiveFolderUri += "/" + msgMonth;
        dstFolder = GetMsgFolderFromUri(archiveFolderUri, false);
        if (!dstFolder.parent)
        {
          dstFolder.createStorageIfMissing(this);
          if (isAsync)
            return;
        }
      }

      // Create the folder structure in Archives
      // For imap folders, we need to create the sub-folders asynchronously,
      // so we chain the actions using the listener called back from 
      // createSubfolder. For local, createSubfolder is synchronous.
      if (archiveFolder.canCreateSubfolders && keepFolderStructure)
      {
        // Collect in-order list of folders of source folder structure,
        // excluding top-level INBOX folder
        let folderNames = [];
        let rootFolder = srcFolder.server.rootFolder;
        let inboxFolder = GetInboxFolder(srcFolder.server);
        let folder = srcFolder;
        while (folder != rootFolder && folder != inboxFolder)
        {
          folderNames.unshift(folder.name);
          folder = folder.parent;
        }
        // Determine Archive folder structure
        for (let i = 0; i < folderNames.length; ++i)
        {
          let folderName = folderNames[i];
          if (!dstFolder.containsChildNamed(folderName))
          {
            // Create Archive sub-folder (IMAP: async)
            if (isAsync)
            {
              this._dstFolderParent = dstFolder;
              this._dstFolderName = folderName;
            }
            dstFolder.createSubfolder(folderName, msgWindow);
            if (isAsync)
              return;
          }
          dstFolder = dstFolder.getChildNamed(folderName);
        }
      }

      if (dstFolder != srcFolder)
      {
        // Make sure the target folder is visible in the folder tree.
        EnsureFolderIndex(GetFolderTree().builderView, dstFolder);

        let array = Components.classes["@mozilla.org/array;1"]
                              .createInstance(Components.interfaces.nsIMutableArray);
        msgs.forEach(function(item){array.appendElement(item, false);});
        // If the source folder doesn't support deleting messages, we
        // make archive a copy, not a move.
        gCopyService.CopyMessages(srcFolder, array, dstFolder,
                                  srcFolder.canDeleteMessages, this, msgWindow, true);
        return; // only do one.
      }
      delete this._batches[key];
    }

    Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
              .getService(Components.interfaces.nsIMsgFolderNotificationService)
              .removeListener(this);

    // We're just going to select the message now.
    let treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
    treeView.selection.select(this.messageToSelectAfterWereDone);
    treeView.selectionChanged();
  },

  // This also implements nsIUrlListener, but we only care about the
  // OnStopRunningUrl (createStorageIfMissing callback).
  OnStartRunningUrl: function(aUrl)
  {
  },
  OnStopRunningUrl: function(aUrl, aExitCode)
  {
    // This will always be a create folder url, afaik.
    if (Components.isSuccessCode(aExitCode))
      this.processNextBatch();
    else
      this._batches = null;
  },

  // This also implements nsIMsgCopyServiceListener, but we only care
  // about the OnStopCopy (CopyMessages callback).
  OnStartCopy: function()
  {
  },
  OnProgress: function(aProgress, aProgressMax)
  {
  },
  SetMessageKey: function(aKey)
  {
  },
  GetMessageId: function()
  {
  },
  OnStopCopy: function(aStatus)
  {
    if (Components.isSuccessCode(aStatus))
    {
      // remove batch we just finished and continue
      delete this._batches[this._currentKey];
      this._currentKey = null;
      this.processNextBatch();
    }
    else
    {
      this._batches = null;
    }
  },

  // This also implements nsIMsgFolderListener, but we only care about the
  // folderAdded (createSubfolder callback).
  folderAdded: function(aFolder)
  {
    // Check that this is the folder we're interested in.
    if (aFolder.parent == this._dstFolderParent &&
        aFolder.name == this._dstFolderName)
    {
      this._dstFolderParent = null;
      this._dstFolderName = null;
      this.processNextBatch();
    }
  },

  QueryInterface: function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsIUrlListener) ||
        aIID.equals(Components.interfaces.nsIMsgCopyServiceListener) ||
        aIID.equals(Components.interfaces.nsIMsgFolderListener) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}

function MsgArchiveSelectedMessages(aEvent)
{
  let batchMover = new BatchMessageMover();
  batchMover.archiveMessages(gFolderDisplay.selectedMessages);
}


function MsgForwardMessage(event)
{
  var forwardType = Services.prefs.getIntPref("mail.forward_message_mode");

  // mail.forward_message_mode could be 1, if the user migrated from 4.x
  // 1 (forward as quoted) is obsolete, so we treat is as forward inline
  // since that is more like forward as quoted then forward as attachment
  if (forwardType == kMsgForwardAsAttachment)
      MsgForwardAsAttachment(event);
  else
      MsgForwardAsInline(event);
}

function MsgForwardAsAttachment(event)
{
  ComposeMsgByType(msgComposeType.ForwardAsAttachment, event);
}

function MsgForwardAsInline(event)
{
  ComposeMsgByType(msgComposeType.ForwardInline, event);
}

function MsgEditMessageAsNew()
{
  ComposeMsgByType(msgComposeType.Template);
}

function MsgComposeDraftMessage()
{
  ComposeMsgByType(msgComposeType.Draft, null, msgComposeFormat.Default);
}

function MsgCreateFilter()
{
  // retrieve Sender direct from selected message's headers
  var msgHdr = gFolderDisplay.selectedMessage;
  var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser);
  var emailAddress = headerParser.extractHeaderAddressMailboxes(msgHdr.author);
  var accountKey = msgHdr.accountKey;
  var folder;
  if (accountKey.length > 0)
  {
    var account = accountManager.getAccount(accountKey);
    if (account)
    {
      server = account.incomingServer;
      if (server)
        folder = server.rootFolder;
    }
  }
  if (!folder)
    folder = GetFirstSelectedMsgFolder();
  
    if (emailAddress)
     top.MsgFilters(emailAddress, folder);
}

function MsgHome(url)
{
  window.open(url, "_blank", "chrome,dependent=yes,all");
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
    window.openDialog("chrome://messenger/content/newFolderDialog.xul",
                      "",
                      "chrome,modal,centerscreen",
                      {folder: destinationFolder,
                       dualUseFolders: dualUseFolders,
                       okCallback:callBackFunctionName});
}

function getDestinationFolder(preselectedFolder, server)
{
    var destinationFolder = null;

    var isCreateSubfolders = preselectedFolder.canCreateSubfolders;
    if (!isCreateSubfolders)
    {
        destinationFolder = server.rootMsgFolder;

        var verifyCreateSubfolders = null;
        if (destinationFolder)
            verifyCreateSubfolders = destinationFolder.canCreateSubfolders;

        // in case the server cannot have subfolders,
        // get default account and set its incoming server as parent folder
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
    return Services.prompt.confirm(window, titleMsg, dialogMsg);
}

function MsgUnsubscribe()
{
    var folder = GetFirstSelectedMsgFolder();
    if (ConfirmUnsubscribe(folder)) {
        UnSubscribe(folder);
    }
}

function MsgSaveAsFile()
{
  SaveAsFile(gFolderDisplay.selectedMessageUris);
}

function MsgSaveAsTemplate()
{
  SaveAsTemplate(gFolderDisplay.selectedMessageUris);
}

const nsIFilePicker = Components.interfaces.nsIFilePicker;

function MsgOpenFromFile()
{
   var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

  var filterLabel = gMessengerBundle.getString("EMLFiles");
  var windowTitle = gMessengerBundle.getString("OpenEMLFiles");

   fp.init(window, windowTitle, nsIFilePicker.modeOpen);
   fp.appendFilter(filterLabel, "*.eml; *.msg");

   // Default or last filter is "All Files"
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

  window.openDialog( "chrome://messenger/content/messageWindow.xul", "_blank", "all,chrome,dialog=no,status,toolbar", uri, null, null );
}

function MsgOpenNewWindowForMsgHdr(hdr)
{
  MsgOpenNewWindowForFolder(hdr.folder.URI, hdr.messageKey);
}

function MsgOpenNewWindowForFolder(uri, key)
{
  var uriToOpen = uri;
  var keyToSelect = key;

  if (!uriToOpen)
    // use GetSelectedFolderURI() to find out which message to open instead of
    // GetLoadedMsgFolder().URI.
    // This is required because on a right-click, the currentIndex value will be
    // different from the actual row that is highlighted.  GetSelectedFolderURI()
    // will return the message that is highlighted.
    uriToOpen = GetSelectedFolderURI();

  if (uriToOpen) {
   // get the messenger window open service and ask it to open a new window for us
   var mailWindowService = Components.classes["@mozilla.org/messenger/windowservice;1"].getService(Components.interfaces.nsIMessengerWindowService);
   if (mailWindowService)
     mailWindowService.openMessengerWindowWithUri("mail:3pane", uriToOpen, keyToSelect);
  }
}

function MsgOpenSelectedMessages()
{
  // Toggle message body (rss summary) and content-base url in message
  // pane per pref, otherwise open summary or web page in new window.
  if (gFolderDisplay.selectedMessageIsFeed && GetFeedOpenHandler() == 2)
  {
    FeedSetContentViewToggle();
    return;
  }

  var dbView = GetDBView();
  var indices = GetSelectedIndices(dbView);
  var numMessages = indices.length;

  // This is a radio type button pref, currently with only 2 buttons.
  // We need to keep the pref type as 'bool' for backwards compatibility
  // with 4.x migrated prefs.  For future radio button(s), please use another
  // pref (either 'bool' or 'int' type) to describe it.
  //
  // mailnews.reuse_message_window values:
  //    false: open new standalone message window for each message
  //    true : reuse existing standalone message window for each message
  if (Services.prefs.getBoolPref("mailnews.reuse_message_window") &&
      numMessages == 1 &&
      MsgOpenSelectedMessageInExistingWindow())
    return;
    
  var openWindowWarning = Services.prefs.getIntPref("mailnews.open_window_warning");
  if ((openWindowWarning > 1) && (numMessages >= openWindowWarning)) {
    InitPrompts();
    if (!gMessengerBundle)
        gMessengerBundle = document.getElementById("bundle_messenger");
    var title = gMessengerBundle.getString("openWindowWarningTitle");
    var text = PluralForm.get(numMessages,
      gMessengerBundle.getString("openWindowWarningConfirmation"))
                         .replace("#1", numMessages);
    if (!Services.prompt.confirm(window, title, text))
      return;
  }

  for (var i = 0; i < numMessages; i++) {
    MsgOpenNewWindowForMessage(dbView.getURIForViewIndex(indices[i]), dbView.getFolderForViewIndex(indices[i]).URI);
  }
}

function MsgOpenSelectedMessageInExistingWindow()
{
    var windowID = Services.wm.getMostRecentWindow("mail:messageWindow");
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

        // even if the folder uri's match, we can't use the existing view
        // (msgHdr.folder.URI == windowID.gCurrentFolderUri)
        // the reason is quick search and mail views.
        // see bug #187673
        //
        // for the sake of simplicity,
        // let's always call CreateView(gDBView)
        // which will clone gDBView
        windowID.CreateView(gDBView);
        windowID.OnLoadMessageWindowDelayed(false);

        // bring existing window to front
        windowID.focus();
        return true;
    }
    catch (ex) {
        dump("reusing existing standalone message window failed: " + ex + "\n");
    }
    return false;
}

function MsgOpenSearch(aSearchStr, aEvent)
{
  // If you change /suite/navigator/navigator.js->BrowserSearch::loadSearch()
  // make sure you make corresponding changes here.
  var submission = Services.search.defaultEngine.getSubmission(aSearchStr);
  if (!submission)
    return;

  var newTabPref = Services.prefs.getBoolPref("browser.search.opentabforcontextsearch");
  var where = newTabPref ? aEvent && aEvent.shiftKey ? "tabshifted" : "tab" : "window";
  openUILinkIn(submission.uri.spec, where, null, submission.postData);
}

function MsgOpenNewWindowForMessage(messageUri, folderUri)
{
  if (!messageUri)
    messageUri = gFolderDisplay.selectedMessageUri;

    if (!folderUri)
        // use GetSelectedFolderURI() to find out which message to open
        // instead of gDBView.getURIForViewIndex(currentIndex).  This is
        // required because on a right-click, the currentIndex value will be
        // different from the actual row that is highlighted.
        // GetSelectedFolderURI() will return the message that is
        // highlighted.
        folderUri = GetSelectedFolderURI();

    // be sure to pass in the current view....
    if (messageUri && folderUri) {
        window.openDialog( "chrome://messenger/content/messageWindow.xul", "_blank", "all,chrome,dialog=no,status,toolbar", messageUri, folderUri, gDBView );
    }
}

function CloseMailWindow()
{
    //dump("\nClose from XUL\nDo something...\n");
    window.close();
}

function MsgJunk()
{
  MsgJunkMailInfo(true);
  JunkSelectedMessages(!SelectedMessagesAreJunk());
}

function MsgMarkMsgAsRead(markRead)
{
    if (!markRead) {
        markRead = !SelectedMessagesAreRead();
    }
    MarkSelectedMessagesRead(markRead);
}

function MsgMarkAsFlagged(markFlagged)
{
    if (!markFlagged) {
        markFlagged = !SelectedMessagesAreFlagged();
    }
    MarkSelectedMessagesFlagged(markFlagged);
}

function MsgMarkReadByDate()
{
    window.openDialog( "chrome://messenger/content/markByDate.xul","",
                       "chrome,modal,titlebar,centerscreen",
                       GetLoadedMsgFolder() );
}

function MsgMarkAllRead()
{
    var folder = GetMsgFolderFromUri(GetSelectedFolderURI(), true);

    if(folder)
        folder.markAllMessagesRead(msgWindow);
}

function MsgDownloadFlagged()
{
  gDBView.doCommand(nsMsgViewCommandType.downloadFlaggedForOffline);
}

function MsgDownloadSelected()
{
  gDBView.doCommand(nsMsgViewCommandType.downloadSelectedForOffline);
}

function MsgMarkThreadAsRead()
{
  ClearPendingReadTimer();
  gDBView.doCommand(nsMsgViewCommandType.markThreadRead);
}

function MsgViewPageSource()
{
    ViewPageSource(gFolderDisplay.selectedMessageUris);
}

var gFindInstData;
function getFindInstData()
{
  if (!gFindInstData) {
    gFindInstData = new nsFindInstData();
    gFindInstData.browser = getMessageBrowser();
    gFindInstData.rootSearchWindow = window.top.content;
    gFindInstData.currentSearchWindow = window.top.content;
  }
  return gFindInstData;
}

function MsgFind()
{
  findInPage(getFindInstData());
}

function MsgFindAgain(reverse)
{
  findAgainInPage(getFindInstData(), reverse);
}

function MsgCanFindAgain()
{
  return canFindAgainInPage();
}

function MsgFilters(emailAddress, folder)
{
    if (!folder)
      folder = GetFirstSelectedMsgFolder();
    var args;
    if (emailAddress)
    {
      // Prefill the filterEditor with the emailAddress.
      args = {filterList: folder.getEditableFilterList(msgWindow), filterName: emailAddress};
      window.openDialog("chrome://messenger/content/FilterEditor.xul", "", 
                        "chrome, modal, resizable,centerscreen,dialog=yes", args);

      // args.refresh is set to true in the filterEditor, if the user hits ok.
      // We check this here in args to show the filterList dialog.
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
  var selectedFolders = Components.classes["@mozilla.org/array;1"]
                                  .createInstance(Components.interfaces.nsIMutableArray);
  selectedFolders.appendElement(preselectedFolder, false);
         
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
  Services.prefs.setIntPref("mail.pane_config.dynamic", newLayout);
}

function MsgViewAllHeaders()
{
    Services.prefs.setIntPref("mail.show_headers",2);
    ReloadMessage();
    return true;
}

function MsgViewNormalHeaders()
{
    Services.prefs.setIntPref("mail.show_headers",1);
    ReloadMessage();
    return true;
}

function MsgViewBriefHeaders()
{
    Services.prefs.setIntPref("mail.show_headers",0);
    ReloadMessage();
    return true;
}

function MsgBodyAllowHTML()
{
    Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
    Services.prefs.setIntPref("mailnews.display.html_as", 0);
    Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers", 0);
    ReloadMessage();
    return true;
}

function MsgBodySanitized()
{
    Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
    Services.prefs.setIntPref("mailnews.display.html_as", 3);
    Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers",
                           disallow_classes_no_html);
    ReloadMessage();
    return true;
}

function MsgBodyAsPlaintext()
{
    Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", true);
    Services.prefs.setIntPref("mailnews.display.html_as", 1);
    Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers",
                           disallow_classes_no_html);
    ReloadMessage();
    return true;
}

function MsgBodyAllParts()
{
  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
  Services.prefs.setIntPref("mailnews.display.html_as", 4);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers", 0);
  ReloadMessage();
  return true;
}

function MsgFeedBodyRenderPrefs(plaintext, html, mime)
{
  Services.prefs.setBoolPref("rss.display.prefer_plaintext", plaintext);
  Services.prefs.setIntPref("rss.display.html_as", html);
  Services.prefs.setIntPref("rss.display.disallow_mime_handlers", mime);
  // Reload only if showing rss summary; menuitem hidden if web page..
  ReloadMessage();
}

//How to load message with content-base url on enter in threadpane
function GetFeedOpenHandler()
{
  return Services.prefs.getIntPref("rss.show.content-base");
}

function ChangeFeedOpenHandler(val)
{
  Services.prefs.setIntPref("rss.show.content-base", val);
}

//Current state: load web page if 0, show summary if 1
var gShowFeedSummary;
var gShowFeedSummaryToggle = false;

function ChangeFeedShowSummaryPref(val)
{
  Services.prefs.setIntPref("rss.show.summary", val);
  ReloadMessage();
}

function ToggleInlineAttachment(target)
{
    var viewAttachmentInline = !Services.prefs.getBoolPref("mail.inline_attachments");
    Services.prefs.setBoolPref("mail.inline_attachments", viewAttachmentInline)
    target.setAttribute("checked", viewAttachmentInline ? "true" : "false");
    
    ReloadMessage();
}

function MsgStop()
{
    StopUrls();
}

function MsgSendUnsentMsgs()
{
  // if offline, prompt for sendUnsentMessages
  if (!Services.io.offline) {
    SendUnsentMessages();    
  }
  else {
    var option = PromptMessagesOffline("send");
    if(option == 0) {
      if (!gOfflineManager) 
        GetOfflineMgrService();
      gOfflineManager.goOnline(false /* sendUnsentMessages */, 
                               false /* playbackOfflineImapOperations */, 
                               msgWindow);
      SendUnsentMessages();
    }
  }
}

function PrintEnginePrintInternal(aDoPrintPreview, aMsgType)
{
  var messageList = gFolderDisplay.selectedMessageUris;
  if (!messageList)
  {
    dump("PrintEnginePrint(): No messages selected.\n");
    return false;
  }

  window.openDialog("chrome://messenger/content/msgPrintEngine.xul", "",
                    "chrome,dialog=no,all,centerscreen",
                    messageList.length, messageList, statusFeedback,
                    aDoPrintPreview, aMsgType);
  return true;

}

function PrintEnginePrint()
{
  return PrintEnginePrintInternal(false, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINT_MSG);
}

function PrintEnginePrintPreview()
{
  return PrintEnginePrintInternal(true, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG);
}

function IsMailFolderSelected()
{
    var selectedFolders = GetSelectedMsgFolders();
    var numFolders = selectedFolders.length;
    if(numFolders !=1)
        return false;

    var folder = selectedFolders[0];
    if (!folder)
        return false;

    var server = folder.server;
    var serverType = server.type;

    if((serverType == "nntp"))
        return false;
    else return true;
}

function IsGetNewMessagesEnabled()
{
  // users don't like it when the "Get Msgs" button is disabled
  // so let's never do that. 
  // we'll just handle it as best we can in GetFolderMessages()
  // when they click "Get Msgs" and
  // Local Folders or a news server is selected
  // see bugs #89404 and #111102
  return true;
}

function IsGetNextNMessagesEnabled()
{
    var selectedFolders = GetSelectedMsgFolders();
    var numFolders = selectedFolders.length;
    if(numFolders !=1)
        return false;

    var folder = selectedFolders[0];
    if (!folder)
        return false;

    var server = folder.server;
    var serverType = server.type;

    var menuItem = document.getElementById("menu_getnextnmsg");
    if ((serverType == "nntp") && !folder.isServer) {
        var newsServer = server.QueryInterface(Components.interfaces.nsINntpIncomingServer);
        var menuLabel = PluralForm.get(newsServer.maxArticles,
          gMessengerBundle.getString("getNextNewsMessages"))
                                  .replace("#1", newsServer.maxArticles);
        menuItem.setAttribute("label",menuLabel);
        menuItem.removeAttribute("hidden");
        return true;
    }

    menuItem.setAttribute("hidden","true");
    return false;
}

function IsEmptyTrashEnabled()
{
  var folderURI = GetSelectedFolderURI();
  var server = GetServer(folderURI);
  return (server && server.canEmptyTrashOnExit ? IsMailFolderSelected() : false);
}

function IsCompactFolderEnabled()
{
  var server = GetServer(GetSelectedFolderURI());
  return (server && 
      ((server.type != 'imap') || server.canCompactFoldersOnServer) &&
      isCommandEnabled("cmd_compactFolder"));   // checks e.g. if IMAP is offline
}

var gReplyAllButton = null;
var gDeleteButton = null;

function SetUpToolbarButtons(uri)
{
    //dump("SetUpToolbarButtons("+uri+")\n");

    // eventually, we might want to set up the toolbar differently for imap,
    // pop, and news.  for now, just tweak it based on if it is news or not.
    var forNews = isNewsURI(uri);

    if(!gDeleteButton) gDeleteButton = document.getElementById("button-delete");
    if (!gReplyAllButton) gReplyAllButton = document.getElementById("button-replyall");

    gDeleteButton.hidden = forNews;
    if (forNews) {
        gReplyAllButton.setAttribute("type", "menu-button");
        gReplyAllButton.setAttribute("tooltiptext", gReplyAllButton.getAttribute("tooltiptextnews"));
    }
    else {
        gReplyAllButton.removeAttribute("type");
        gReplyAllButton.setAttribute("tooltiptext", gReplyAllButton.getAttribute("tooltiptextmail"));
    }
}

var gMessageBrowser;

function getMessageBrowser()
{
  if (!gMessageBrowser)
    gMessageBrowser = document.getElementById("messagepane");
  return gMessageBrowser;
}

// The zoom manager, view source and possibly some other functions still rely
// on the getBrowser function.
function getBrowser()
{
  return GetTabMail() ? GetTabMail().getBrowserForSelectedTab() :
                        getMessageBrowser();
}

function getMarkupDocumentViewer()
{
  return getMessageBrowser().markupDocumentViewer;
}

function MsgSynchronizeOffline()
{
    //dump("in MsgSynchronize() \n"); 
    window.openDialog("chrome://messenger/content/msgSynchronize.xul",
          "", "centerscreen,chrome,modal,titlebar,resizable=yes",{msgWindow:msgWindow}); 		     
}


function MsgOpenAttachment() {}
function MsgUpdateMsgCount() {}
function MsgImport() {}
function MsgSynchronize() {}
function MsgGetSelectedMsg() {}
function MsgGetFlaggedMsg() {}
function MsgSelectThread() {}
function MsgShowFolders(){}
function MsgShowLocationbar() {}
function MsgViewAttachInline() {}
function MsgWrapLongLines() {}
function MsgIncreaseFont() {}
function MsgDecreaseFont() {}
function MsgShowImages() {}
function MsgRefresh() {}
function MsgViewPageInfo() {}
function MsgFirstUnreadMessage() {}
function MsgFirstFlaggedMessage() {}
function MsgAddSenderToAddressBook() {}
function MsgAddAllToAddressBook() {}

function SpaceHit(event)
{
  var contentWindow = document.commandDispatcher.focusedWindow;
  if (contentWindow.top == window)
    contentWindow = content;
  else if (document.commandDispatcher.focusedElement &&
           !hrefAndLinkNodeForClickEvent(event))
    return;
  var rssiframe = content.document.getElementById('_mailrssiframe');

  // If we are displaying an RSS article, we really want to scroll
  // the nested iframe.
  if (contentWindow == content && rssiframe)
    contentWindow = rssiframe.contentWindow;

  if (event && event.shiftKey) {
    // if at the start of the message, go to the previous one
    if (contentWindow.scrollY > 0)
      contentWindow.scrollByPages(-1);
    else if (Services.prefs.getBoolPref("mail.advance_on_spacebar"))
      goDoCommand("cmd_previousUnreadMsg");
  }
  else {
    // if at the end of the message, go to the next one
    if (contentWindow.scrollY < contentWindow.scrollMaxY)
      contentWindow.scrollByPages(1);
    else if (Services.prefs.getBoolPref("mail.advance_on_spacebar"))
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

function DoGetNewMailWhenOffline()
{
  if (!Services.io.offline)
    return true;

  if (PromptMessagesOffline("get") == 0)
  {
    var sendUnsent = false;
    if (this.CheckForUnsentMessages != undefined && CheckForUnsentMessages())
    {
      sendUnsent =
        Services.prefs.getIntPref("offline.send.unsent_messages") == 1 ||
        Services.prompt.confirmEx(
          window,
          gOfflinePromptsBundle.getString('sendMessagesOfflineWindowTitle'),
          gOfflinePromptsBundle.getString('sendMessagesLabel2'),
          Services.prompt.BUTTON_TITLE_IS_STRING *
            (Services.prompt.BUTTON_POS_0 + Services.prompt.BUTTON_POS_1),
          gOfflinePromptsBundle.getString('sendMessagesSendButtonLabel'),
          gOfflinePromptsBundle.getString('sendMessagesNoSendButtonLabel'),
          null, null, {value: false}) == 0;
    }
    if (!gOfflineManager) 
      GetOfflineMgrService();
    gOfflineManager.goOnline(sendUnsent /* sendUnsentMessages */, 
                             false /* playbackOfflineImapOperations */, 
                             msgWindow);
    return true;
  }
  return false;
}

// prompt for getting/sending messages when offline
function PromptMessagesOffline(aPrefix)
{
  InitPrompts();
  var checkValue = {value:false};
  return Services.prompt.confirmEx(
      window,
      gOfflinePromptsBundle.getString(aPrefix + 'MessagesOfflineWindowTitle'), 
      gOfflinePromptsBundle.getString(aPrefix + 'MessagesOfflineLabel'),
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1),
      gOfflinePromptsBundle.getString(aPrefix + 'MessagesOfflineGoButtonLabel'),
      null, null, null, checkValue);
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
    // if "Local Folders" is selected
    // and the user does "Get Msgs"
    // and LocalFolders is not deferred to,
    // get new mail for the default account
    //
    // XXX TODO
    // should shift click get mail for all (authenticated) accounts?
    // see bug #125885
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
  var identitiesCount, allIdentities, currentIdentity, numMessages, msgFolder;

  if (accountManager) {
    allIdentities = accountManager.allIdentities;
    identitiesCount = allIdentities.length;
    for (var i = 0; i < identitiesCount; i++) {
      currentIdentity = allIdentities.queryElementAt(i, Components.interfaces.nsIMsgIdentity);
      msgFolder = msgSendlater.getUnsentMessagesFolder(currentIdentity);
      if(msgFolder) {
        numMessages = msgFolder.getTotalMessages(false /* include subfolders */);
        if(numMessages > 0) {
          msgSendlater.statusFeedback = statusFeedback;
          msgSendlater.sendUnsentMessages(currentIdentity);
          // right now, all identities point to the same unsent messages
          // folder, so to avoid sending multiple copies of the
          // unsent messages, we only call messenger.SendUnsentMessages() once
          // see bug #89150 for details
          break;
        }
      }
    } 
  }
}

function GetMessagesForAccount(aEvent)
{
  var uri = aEvent.target.id;
  var server = GetServer(uri);
  GetMessagesForInboxOnServer(server);
  aEvent.stopPropagation();
}


function CommandUpdate_UndoRedo()
{
    ShowMenuItem("menu_undo", true);
    EnableMenuItem("menu_undo", SetupUndoRedoCommand("cmd_undo"));
    ShowMenuItem("menu_redo", true);
    EnableMenuItem("menu_redo", SetupUndoRedoCommand("cmd_redo"));
}

function SetupUndoRedoCommand(command)
{
    var loadedFolder = GetLoadedMsgFolder();

    // if we have selected a server, and are viewing account central
    // there is no loaded folder
    if (!loadedFolder)
      return false;

    var server = loadedFolder.server;
    if (!(server.canUndoDeleteOnServer))
      return false;

    var canUndoOrRedo = false;
    var txnType = 0;

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
        const nsIMessenger = Components.interfaces.nsIMessenger;
        switch (txnType)
        {
        default:
        case nsIMessenger.eUnknown:
            goSetMenuValue(command, 'valueDefault');
            break;
        case nsIMessenger.eDeleteMsg:
            goSetMenuValue(command, 'valueDeleteMsg');
            break;
        case nsIMessenger.eMoveMsg:
            goSetMenuValue(command, 'valueMoveMsg');
            break;
        case nsIMessenger.eCopyMsg:
            goSetMenuValue(command, 'valueCopyMsg');
            break;
        case nsIMessenger.eMarkAllMsg:
            goSetMenuValue(command, 'valueUnmarkAllMsgs');
            break;
        }
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
  if (!loadedMessage || /type=application\/x-message-display/.test(loadedMessage) ||
      !IsCurrentLoadedFolder(folder))
    return;

  // If multiple message are selected and we change the junk status
  // we don't want to show the junk bar (since the message pane is blank).
  var msgHdr = null;
  if (GetNumSelectedMessages() == 1)
    msgHdr = messenger.msgHdrFromURI(loadedMessage);

  var junkBarWasDisplayed = gMessageNotificationBar.mMsgNotificationBar.getNotificationWithValue("junkContent");
  gMessageNotificationBar.setJunkMsg(msgHdr);
  var isJunk = gMessageNotificationBar.mMsgNotificationBar.getNotificationWithValue("junkContent");

  // Only reload message if junk bar display state has changed.
  if (msgHdr && junkBarWasDisplayed != isJunk)
  {
    // We may be forcing junk mail to be rendered with sanitized html.
    // In that scenario, we want to reload the message if the status has just
    // changed to not junk.
    var sanitizeJunkMail = Services.prefs.getBoolPref("mail.spam.display.sanitize");

    // Only bother doing this if we are modifying the html for junk mail...
    if (sanitizeJunkMail)
    {
      // If the current row isn't going to change, reload to show sanitized or
      // unsanitized. Otherwise we wouldn't see the reloaded version anyway.

      // XXX: need to special handle last message in view, for imap mark as deleted

      // 1) When marking as non-junk, the msg would move back to the inbox.
      // 2) When marking as junk, the msg will move or delete, if manualMark is set.
      // 3) Marking as junk in the junk folder just changes the junk status.
      if ((!isJunk && folder.isSpecialFolder(Components.interfaces.nsMsgFolderFlags.Inbox)) ||
          (isJunk && !folder.server.spamSettings.manualMark) ||
          (isJunk && folder.isSpecialFolder(Components.interfaces.nsMsgFolderFlags.Junk)))
        ReloadMessage();
    }
  }
}

var gMessageNotificationBar = 
{
  get mStringBundle()
  {
    delete this.mStringBundle;

    return this.mStringBundle = document.getElementById('bundle_messenger');
  },

  get mBrandBundle()
  {
    delete this.mBrandBundle;

    return this.mBrandBundle = document.getElementById('bundle_brand');
  },

  get mMsgNotificationBar()
  {
    delete this.mMsgNotificationBar;

    return this.mMsgNotificationBar = document.getElementById('messagepanebox');
  },

  setJunkMsg: function(aMsgHdr)
  {
    let isJunk = false;
    if (aMsgHdr)
    {
      let junkScore = aMsgHdr.getStringProperty("junkscore"); 
      isJunk = ((junkScore != "") && (junkScore != "0"));
    }

    goUpdateCommand('button_junk');

    let oldNotif = this.mMsgNotificationBar.getNotificationWithValue("junkContent");
    if (isJunk)
    {
      if (!oldNotif)
      {
        let brandName = this.mBrandBundle.getString("brandShortName");
        let junkBarMsg = this.mStringBundle.getFormattedString('junkBarMessage',
                                                            [brandName]);

        let buttons = [{
          label: this.mStringBundle.getString('junkBarInfoButton'),
          accessKey: this.mStringBundle.getString('junkBarInfoButtonKey'),
          popup: null,
          callback: function()
          {
            MsgJunkMailInfo(false);
            return true;
          }
        },
        {
          label: this.mStringBundle.getString('junkBarButton'),
          accessKey: this.mStringBundle.getString('junkBarButtonKey'),
          popup: null,
          callback: function()
          {
            JunkSelectedMessages(false);
            return true;
          }
        }];
        this.mMsgNotificationBar.appendNotification(junkBarMsg, "junkContent",
          null, this.mMsgNotificationBar.PRIORITY_WARNING_HIGH, buttons);
        this.mMsgNotificationBar.collapsed = false;
      }
    }
  },

  setRemoteContentMsg: function(aMsgHdr)
  {  
    var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                 .getService(Components.interfaces.nsIMsgHeaderParser);
    var emailAddress = headerParser.extractHeaderAddressMailboxes(aMsgHdr.author);

    var oldNotif = this.mMsgNotificationBar.getNotificationWithValue("remoteContent");
    if (!oldNotif)
    {
      let displayName = headerParser.extractHeaderAddressName(aMsgHdr.author);
      let brandName = this.mBrandBundle.getString('brandShortName');
      let remoteContentMsg = this.mStringBundle.getFormattedString('remoteContentBarMessage', 
                                                                   [brandName]);
      let buttons = [{
        label: this.mStringBundle.getString('remoteContentBarButton'),
        accessKey: this.mStringBundle.getString('remoteContentBarButtonKey'),
        popup: null,
        callback: function()
        {
          LoadMsgWithRemoteContent();
        }
      }];

      let bar =
        this.mMsgNotificationBar.appendNotification(remoteContentMsg, "remoteContent",
          null, this.mMsgNotificationBar.PRIORITY_WARNING_MEDIUM, buttons);

      if (emailAddress)
      {
        let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        let linkLabel = bar.ownerDocument.createElementNS(XULNS, "label");
        let addedLink = this.mStringBundle.getFormattedString('alwaysLoadRemoteContentForSender', 
                                                              [emailAddress]);

        linkLabel.className = "text-link";
        linkLabel.textContent = addedLink;
        linkLabel.flex = 1;
        linkLabel.onclick = function() { allowRemoteContentForSender(emailAddress, 
                                                                     displayName); };

        bar.insertBefore(linkLabel, bar.firstChild);
      }
    }
  },

  // aUrl is the nsIURI for the message currently loaded in the message pane
  setPhishingMsg: function(aUrl)
  {
    // if we've explicitly marked this message as not being an email scam, then don't
    // bother checking it with the phishing detector.
    var phishingMsg = false;

    if (!checkMsgHdrPropertyIsNot("notAPhishMessage", kIsAPhishMessage))
      phishingMsg = isMsgEmailScam(aUrl);

    var oldNotif = this.mMsgNotificationBar.getNotificationWithValue("phishingContent");
    if (phishingMsg)
    {
      if (!oldNotif)
      {
        let brandName = this.mBrandBundle.getString("brandShortName");
        let phishingMsgNote = this.mStringBundle.getFormattedString('phishingBarMessage',
                                                                    [brandName]);

        let buttons = [{
          label: this.mStringBundle.getString('phishingBarIgnoreButton'),
          accessKey: this.mStringBundle.getString('phishingBarIgnoreButtonKey'),
          popup: null,
          callback: function() {
            MsgIsNotAScam();
          }
        }];

        this.mMsgNotificationBar.appendNotification(phishingMsgNote, "phishingContent",
           null, this.mMsgNotificationBar.PRIORITY_CRITICAL_MEDIUM, buttons);
      }
    }
   },

  setMDNMsg: function(aMdnGenerator, aMsgHeader, aMimeHdr)
  {
    this.mdnGenerator = aMdnGenerator;
    // Return receipts can be RFC 3798 "Disposition-Notification-To",
    // or non-standard "Return-Receipt-To".
    var mdnHdr = aMimeHdr.extractHeader("Disposition-Notification-To", false) ||
                 aMimeHdr.extractHeader("Return-Receipt-To", false); // not
    var fromHdr = aMimeHdr.extractHeader("From", false);

    var mdnAddr = MailServices.headerParser
                              .extractHeaderAddressMailboxes(mdnHdr);
    var fromAddr = MailServices.headerParser
                               .extractHeaderAddressMailboxes(fromHdr);

    var authorName = MailServices.headerParser
                                 .extractHeaderAddressName(
                       aMsgHeader.mime2DecodedAuthor) || aMsgHeader.author;

    var barMsg;
    // If the return receipt doesn't go to the sender address, note that in the
    // notification.
    if (mdnAddr != fromAddr)
      barMsg = mStringBundle.getFormattedString("mdnBarMessageAddressDiffers",
                                         [authorName, mdnAddr]);
    else
      barMsg = mStringBundle.getFormattedString("mdnBarMessageNormal", [authorName]);

    var oldNotif = this.mMsgNotificationBar.getNotificationWithValue("mdnContent");
    if (!oldNotif)
    {
      let buttons = [{
        label: this.mStringBundle.getString('mdnBarSendReqButton'),
        accessKey: this.mStringBundle.getString('mdnBarSendReqButtonKey'),
        popup: null,
        callback: SendMDNResponse
      },
      {
        label: this.mStringBundle.getString('mdnBarIgnoreButton'),
        accessKey: this.mStringBundle.getString('mdnBarIgnoreButtonKey'),
        popup: null,
        callback: IgnoreMDNResponse
      }];

      this.mMsgNotificationBar.appendNotification(barMsg, "mdnContent",
        null, this.mMsgNotificationBar.PRIORITY_INFO_MEDIUM, buttons);
    }
  },

  clearMsgNotifications: function()
  {
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
  window.content.focus();
}

/**
 *  msgHdrForCurrentMessage
 *   Returns the msg hdr associated with the current loaded message.
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
function allowRemoteContentForSender(aAuthorEmailAddress, aAuthorDisplayName)
{
  // search through all of our local address books looking for a match.
  var enumerator = Components.classes["@mozilla.org/abmanager;1"]
                             .getService(Components.interfaces.nsIAbManager)
                             .directories;
  var cardForEmailAddress = null;
  var addrbook = null;
  while (!cardForEmailAddress && enumerator.hasMoreElements())
  {
    addrbook = enumerator.getNext()
                         .QueryInterface(Components.interfaces.nsIAbDirectory);
    // Try/catch because cardForEmailAddress will throw if not implemented.
    try
    {
      // If it's a read-only book, don't find a card as we won't be able
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
    var args = {primaryEmail:aAuthorEmailAddress, displayName:aAuthorDisplayName,
                 allowRemoteContent:true};
    // create a new card and set the property
    window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                      "", "chrome,resizable=no,titlebar,modal,centerscreen", args);
    allowRemoteContent = args.allowRemoteContent;
  } 

  // reload the message if we've updated the remote content policy for the sender  
  if (allowRemoteContent)
    ReloadMessage();
}

function MsgIsNotAScam()
{
  // we want to get the msg hdr for the currently selected message
  // change the "isPhishingMsg" property on it
  // then reload the message

  setMsgHdrPropertyAndReload("notAPhishMessage", kNotAPhishMessage);
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

function checkMsgHdrPropertyIsNot(aProperty, aValue)
{
  // we want to get the msg hdr for the currently selected message,
  // get the appropiate property on it and then test against value.

  var msgHdr = msgHdrForCurrentMessage();
  return (msgHdr && msgHdr.getUint32Property(aProperty) != aValue);
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

function OnMsgParsed(aUrl)
{
  // If rss feed (has 'content-base' header), show summary or load web
  // page per pref; earliest we have content DOM is here (onMsgParsed).
  FeedSetContentView();

  gMessageNotificationBar.setPhishingMsg(aUrl);

  // notify anyone (e.g., extensions) who's interested in when a message is loaded.
  var msgURI = GetLoadedMessage();
  Services.obs.notifyObservers(msgWindow.msgHeaderSink,
                               "MsgMsgDisplayed", msgURI);

  // scale any overflowing images
  var doc = getMessageBrowser().contentDocument;
  var imgs = doc.getElementsByTagName("img");
  for each (var img in imgs)
  {
    if (img.className == "moz-attached-image" &&
        img.naturalWidth > doc.body.clientWidth)
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
    } catch (ex) {}

    var msgURI = GetLoadedMessage();

    if (!folder || !msgURI)
      return;

    // If we are in the middle of a delete or move operation, make sure that
    // if the user clicks on another message then that message stays selected
    // and the selection does not "snap back" to the message chosen by
    // SetNextMessageAfterDelete() when the operation completes (bug 243532).
    var wintype = document.documentElement.getAttribute('windowtype');
    gNextMessageViewIndexAfterDelete = -2;

    var msgHdr = msgHdrForCurrentMessage();
    gMessageNotificationBar.setJunkMsg(msgHdr);

    var markReadAutoMode = Services.prefs.getBoolPref("mailnews.mark_message_read.auto");

    // We just finished loading a message. If messages are to be marked as read
    // automatically, set a timer to mark the message is read after n seconds
    // where n can be configured by the user.
    if (msgHdr && !msgHdr.isRead && markReadAutoMode)
    {
      let markReadOnADelay = Services.prefs.getBoolPref("mailnews.mark_message_read.delay");
      // Only use the timer if viewing using the 3-pane preview pane and the
      // user has set the pref.
      if (markReadOnADelay && wintype == "mail:3pane") // 3-pane window
      {
        ClearPendingReadTimer();
        let markReadDelayTime = Services.prefs.getIntPref("mailnews.mark_message_read.delay.interval");
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
}

/*
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
  if (msgHdr.flags & Components.interfaces.nsMsgMessageFlags.MDNReportSent)
    return;

  var DNTHeader = mimeHdr.extractHeader("Disposition-Notification-To", false);
  var oldDNTHeader = mimeHdr.extractHeader("Return-Receipt-To", false);
  if (!DNTHeader && !oldDNTHeader)
    return;

  // Everything looks good so far, let's generate the MDN response.
  var mdnGenerator = Components.classes["@mozilla.org/messenger-mdn/generator;1"]
                               .createInstance(Components.interfaces.nsIMsgMdnGenerator);
  var askUser = mdnGenerator.process(Components.interfaces.nsIMsgMdnGenerator.eDisplayed,
                                     msgWindow,
                                     msgFolder,
                                     msgHdr.messageKey,
                                     mimeHdr,
                                     false);
  if (askUser)
    gMessageNotificationBar.setMDNMsg(mdnGenerator, msgHdr, mimeHdr);
}

function SendMDNResponse()
{
  gMessageNotificationBar.mdnGenerator.userAgreed();
}

function IgnoreMDNResponse()
{
  gMessageNotificationBar.mdnGenerator.userDeclined();
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
    if (!Services.prefs.getBoolPref("mailnews.ui.junk.firstuse"))
      return;
    Services.prefs.setBoolPref("mailnews.ui.junk.firstuse", false);

    // check to see if this is an existing profile where the user has started using
    // the junk mail feature already
    var junkmailPlugin = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                   .getService(Components.interfaces.nsIJunkMailPlugin);
    if (junkmailPlugin.userHasClassified)
      return;
  }

  var desiredWindow = Services.wm.getMostRecentWindow("mailnews:junkmailinfo");

  if (desiredWindow)
    desiredWindow.focus();
  else
    window.openDialog("chrome://messenger/content/junkMailInfo.xul", "mailnews:junkmailinfo", "centerscreen,resizeable=no,titlebar,chrome,modal", null);
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

function OpenOrFocusWindow(args, windowType, chromeURL)
{
  var desiredWindow = Services.wm.getMostRecentWindow(windowType);

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
  // Not an rss message. This also rules out no 3pane to get the browser of.
  if (!gFolderDisplay.selectedMessageIsFeed)
    return false;

  var contentWindowDoc = getBrowser().contentDocument;

  // Thunderbird 2 rss messages with 'Show article summary' not selected,
  // ie message body constructed to show web page in an iframe, can't show
  // a summary - notify user.
  var rssIframe = contentWindowDoc.getElementById('_mailrssiframe');
  if (rssIframe) {
    if (gShowFeedSummaryToggle || Services.prefs.getIntPref("rss.show.summary") == 1)
      gShowFeedSummaryToggle = false;
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
  var contentWindowDoc = getBrowser().contentDocument;
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
      val = Services.prefs.getIntPref("rss.show.summary");
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
        if (!("FeedUtils" in window))
          Services.scriptloader.loadSubScript("chrome://messenger-newsblog/content/utils.js");
        try
        {
          var targetRes = FeedUtils.getParentTargetForChildResource(
                            gFolderDisplay.displayedFolder.URI,
                            FeedUtils.FZ_QUICKMODE,
                            gFolderDisplay.displayedFolder.server);
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
    getMessageBrowser().loadURI(contentBase.headerValue, null, null);
    gShowFeedSummaryToggle = false;
  }
}

function getMailToolbox()
{
  return document.getElementById("mail-toolbox");
}

function MailToolboxCustomizeInit()
{
  toolboxCustomizeInit("mail-menubar");
}

function MailToolboxCustomizeDone(aToolboxChanged)
{
  toolboxCustomizeDone("mail-menubar", getMailToolbox(), aToolboxChanged);
  SetupMoveCopyMenus('button-file', accountManagerDataSource, folderDataSource);

  // make sure the folder location picker is initialized, if it exists
  if ("OnLoadLocationTree" in window)
    OnLoadLocationTree();
}

function MailToolboxCustomizeChange(event)
{
  toolboxCustomizeChange(getMailToolbox(), event);
}
