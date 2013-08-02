/* -*- indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/gloda/dbview.js");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

const ADDR_DB_LARGE_COMMIT       = 1;

const kClassicMailLayout = 0;
const kWideMailLayout = 1;
const kVerticalMailLayout = 2;
const kMailLayoutCommandMap =
{
  "cmd_viewClassicMailLayout": kClassicMailLayout,
  "cmd_viewWideMailLayout": kWideMailLayout,
  "cmd_viewVerticalMailLayout": kVerticalMailLayout
};

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
const kMsgNotificationMDN = 4;

Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource:///modules/MailConsts.js");
Components.utils.import("resource://gre/modules/Services.jsm");

// Timer to mark read, if the user has configured the app to mark a message as
// read if it is viewed for more than n seconds.
var gMarkViewedMessageAsReadTimer = null;

// the user preference,
// if HTML is not allowed. I assume, that the user could have set this to a
// value > 1 in his prefs.js or user.js, but that the value will not
// change during runtime other than through the MsgBody*() functions below.
var gDisallow_classes_no_html = 1;

// Disable the new account menu item if the account preference is locked.
// The other affected areas are the account central, the account manager
// dialog, and the account provisioner window.
function menu_new_init()
{
  // If the account provisioner is pref'd off, we shouldn't display the menu
  // item.
  ShowMenuItem("newCreateEmailAccountMenuItem",
               Services.prefs.getBoolPref("mail.provider.enabled"));

  // If we don't have a gFolderDisplay, just get out of here and leave the menu
  // as it is.
  if (!gFolderDisplay)
    return;

  let folder = gFolderDisplay.displayedFolder;
  if (!folder)
    return;

  if (Services.prefs.prefIsLocked("mail.disable_new_account_addition"))
    document.getElementById("newAccountMenuItem").setAttribute("disabled", "true");

  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  var isInbox = folder.isSpecialFolder(nsMsgFolderFlags.Inbox);
  var showNew = folder.canCreateSubfolders ||
                (isInbox && !(folder.flags & nsMsgFolderFlags.Virtual));
  ShowMenuItem("menu_newFolder", showNew);
  ShowMenuItem("menu_newVirtualFolder", showNew);

  EnableMenuItem("menu_newFolder", folder.server.type != "imap" || MailOfflineMgr.isOnline());
  if (showNew)
  {
    var bundle = document.getElementById("bundle_messenger");
    // Change "New Folder..." menu according to the context.
    SetMenuItemLabel("menu_newFolder", bundle.getString(
      (folder.isServer || isInbox) ? "newFolderMenuItem" : "newSubfolderMenuItem"));
  }
}

function goUpdateMailMenuItems(commandset)
{
  for (var i = 0; i < commandset.childNodes.length; i++)
  {
    var commandID = commandset.childNodes[i].getAttribute("id");
    if (commandID)
      goUpdateCommand(commandID);
  }

  updateCheckedStateForIgnoreAndWatchThreadCmds();
}

/**
 * Update the ignore (sub)thread, and watch thread commands so the menus
 * using them get the checked state set up properly.
 */
function updateCheckedStateForIgnoreAndWatchThreadCmds() {
  document.getElementById("cmd_killThread")
          .setAttribute("checked", gFolderDisplay.selectedMessageThreadIgnored);
  document.getElementById("cmd_killSubthread")
          .setAttribute("checked", gFolderDisplay.selectedMessageSubthreadIgnored);
  document.getElementById("cmd_watchThread")
          .setAttribute("checked", gFolderDisplay.selectedMessageThreadWatched);
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
  let favoriteFolderMenu = document.getElementById('menu_favoriteFolder');
  if (!favoriteFolderMenu.hasAttribute("disabled")) {
    let folders = gFolderTreeView.getSelectedFolders();
    if (folders.length == 1 && !folders[0].isServer) {
      const kFavoriteFlag = Components.interfaces.nsMsgFolderFlags.Favorite;
      // Adjust the checked state on the menu item.
      favoriteFolderMenu.setAttribute("checked", folders[0].getFlag(kFavoriteFlag));
      favoriteFolderMenu.hidden = false;
    } else {
      favoriteFolderMenu.hidden = true;
    }
  }
}

function InitAppFolderViewsMenu()
{
  goSetMenuValue('cmd_delete', 'valueDefault');
  goSetAccessKey('cmd_delete', 'valueDefaultAccessKey');
  document.commandDispatcher.updateCommands('create-menu-edit');

  // initialize the favorite Folder checkbox in the appmenu menu
  let favoriteAppFolderMenu = document.getElementById('appmenu_favoriteFolder');
  if (!favoriteAppFolderMenu.hasAttribute("disabled")) {
    let folders = gFolderTreeView.getSelectedFolders();
    if (folders.length == 1 && !folders[0].isServer) {
      const kFavoriteFlag = Components.interfaces.nsMsgFolderFlags.Favorite;
      // Adjust the checked state on the menu item.
      favoriteAppFolderMenu.setAttribute("checked", folders[0].getFlag(kFavoriteFlag));
      favoriteAppFolderMenu.hidden = false;
    } else {
      favoriteAppFolderMenu.hidden = true;
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
  let isFeed = gFolderDisplay &&
               ((gFolderDisplay.displayedFolder &&
                 gFolderDisplay.displayedFolder.server.type == "rss") ||
                gFolderDisplay.selectedMessageIsFeed);

  let accountCentralDisplayed = gFolderDisplay.isAccountCentralDisplayed;
  let messagePaneMenuItem = document.getElementById("menu_showMessage");
  if (!messagePaneMenuItem.hidden) { // Hidden in the standalone msg window.
    messagePaneMenuItem.setAttribute("checked",
      accountCentralDisplayed ? false : gMessageDisplay.visible);
    messagePaneMenuItem.disabled = accountCentralDisplayed;
  }

  let messagePaneAppMenuItem = document.getElementById("appmenu_showMessage");
  if (!messagePaneAppMenuItem.hidden) { // Hidden in the standalone msg window.
    messagePaneAppMenuItem.setAttribute("checked",
      accountCentralDisplayed ? false : gMessageDisplay.visible);
    messagePaneAppMenuItem.disabled = accountCentralDisplayed;
  }

  let folderPaneMenuItem = document.getElementById("menu_showFolderPane");
  if (!folderPaneMenuItem.hidden) { // Hidden in the standalone msg window.
    folderPaneMenuItem.setAttribute("checked", gFolderDisplay.folderPaneVisible);
  }

  let folderPaneAppMenuItem = document.getElementById("appmenu_showFolderPane");
  if (!folderPaneAppMenuItem.hidden) { // Hidden in the standalone msg window.
    folderPaneAppMenuItem.setAttribute("checked", gFolderDisplay.folderPaneVisible);
  }

  // Disable some menus if account manager is showing
  document.getElementById("viewSortMenu").disabled = accountCentralDisplayed;

  let appmenuViewSort = document.getElementById("appmenu_viewSortMenu");
  if (appmenuViewSort)
    appmenuViewSort.disabled = accountCentralDisplayed;

  document.getElementById("viewMessageViewMenu").disabled = accountCentralDisplayed;

  let appmenuViewMessageView = document.getElementById("appmenu_viewMessageViewMenu");
  if (appmenuViewMessageView)
    appmenuViewMessageView.disabled = accountCentralDisplayed;

  document.getElementById("viewMessagesMenu").disabled = accountCentralDisplayed;

  let appmenuViewMessagesMenu = document.getElementById("appmenu_viewMessagesMenu");
  if (appmenuViewMessagesMenu)
    appmenuViewMessagesMenu.disabled = accountCentralDisplayed;

  // Hide the views menu item if the user doesn't have the views toolbar button
  // visible.
  var viewsToolbarButton = document.getElementById("mailviews-container");
  document.getElementById('viewMessageViewMenu').hidden = !viewsToolbarButton;

  // Initialize the Message Body menuitem
  document.getElementById('viewBodyMenu').hidden = isFeed;

  let appmenuViewBodyMenu = document.getElementById('appmenu_viewBodyMenu');
  if (appmenuViewBodyMenu)
    appmenuViewBodyMenu.hidden = isFeed;

  // Initialize the Show Feed Summary menu
  let viewFeedSummary = document.getElementById('viewFeedSummary');
  viewFeedSummary.hidden = !isFeed;
  let appmenuViewFeedSummary = document.getElementById('appmenu_viewFeedSummary');
  if (appmenuViewFeedSummary)
    appmenuViewFeedSummary.hidden = !isFeed;

  let viewRssMenuItemIds = ["bodyFeedGlobalWebPage",
                            "bodyFeedGlobalSummary",
                            "bodyFeedPerFolderPref"];
  let checked = FeedMessageHandler.onSelectPref;
  for each (let [index, id] in Iterator(viewRssMenuItemIds)) {
    document.getElementById(id)
            .setAttribute("checked", index == checked);
  }

  // Initialize the View Attachment Inline menu
  var viewAttachmentInline = Services.prefs.getBoolPref("mail.inline_attachments");
  document.getElementById("viewAttachmentsInlineMenuitem")
          .setAttribute("checked", viewAttachmentInline);

  document.commandDispatcher.updateCommands('create-menu-view');
}

function InitViewLayoutStyleMenu(event)
{
  var paneConfig = Services.prefs.getIntPref("mail.pane_config.dynamic");
  var layoutStyleMenuitem = event.target.childNodes[paneConfig];
  if (layoutStyleMenuitem)
    layoutStyleMenuitem.setAttribute("checked", "true");
}

/**
 * Initialize (check) appropriate folder mode under the View | Folder menu.
 */
function InitViewFolderViewsMenu(event)
{
  let selected = event.target.querySelector("[value=" + gFolderTreeView.mode + "]");
  if (selected) {
    selected.setAttribute("checked", "true");
  }
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

function InitAppViewSortByMenu()
{
  let sortType = gFolderDisplay.view.primarySortType;

  setSortByMenuItemCheckState("appmenu_sortByDateMenuitem", (sortType == nsMsgViewSortType.byDate));
  setSortByMenuItemCheckState("appmenu_sortByReceivedMenuitem", (sortType == nsMsgViewSortType.byReceived));
  setSortByMenuItemCheckState("appmenu_sortByFlagMenuitem", (sortType == nsMsgViewSortType.byFlagged));
  setSortByMenuItemCheckState("appmenu_sortByOrderReceivedMenuitem", (sortType == nsMsgViewSortType.byId));
  setSortByMenuItemCheckState("appmenu_sortByPriorityMenuitem", (sortType == nsMsgViewSortType.byPriority));
  setSortByMenuItemCheckState("appmenu_sortBySizeMenuitem", (sortType == nsMsgViewSortType.bySize));
  setSortByMenuItemCheckState("appmenu_sortByStatusMenuitem", (sortType == nsMsgViewSortType.byStatus));
  setSortByMenuItemCheckState("appmenu_sortBySubjectMenuitem", (sortType == nsMsgViewSortType.bySubject));
  setSortByMenuItemCheckState("appmenu_sortByUnreadMenuitem", (sortType == nsMsgViewSortType.byUnread));
  setSortByMenuItemCheckState("appmenu_sortByTagsMenuitem", (sortType == nsMsgViewSortType.byTags));
  setSortByMenuItemCheckState("appmenu_sortByJunkStatusMenuitem", (sortType == nsMsgViewSortType.byJunkStatus));
  setSortByMenuItemCheckState("appmenu_sortByFromMenuitem", (sortType == nsMsgViewSortType.byAuthor));
  setSortByMenuItemCheckState("appmenu_sortByRecipientMenuitem", (sortType == nsMsgViewSortType.byRecipient));
  setSortByMenuItemCheckState("appmenu_sortByAttachmentsMenuitem", (sortType == nsMsgViewSortType.byAttachments));

  let sortOrder = gFolderDisplay.view.primarySortOrder;
  let sortTypeSupportsGrouping = (sortType == nsMsgViewSortType.byAuthor ||
                                  sortType == nsMsgViewSortType.byDate ||
                                  sortType == nsMsgViewSortType.byReceived ||
                                  sortType == nsMsgViewSortType.byPriority ||
                                  sortType == nsMsgViewSortType.bySubject ||
                                  sortType == nsMsgViewSortType.byTags ||
                                  sortType == nsMsgViewSortType.byRecipient ||
                                  sortType == nsMsgViewSortType.byAccount ||
                                  sortType == nsMsgViewSortType.byStatus ||
                                  sortType == nsMsgViewSortType.byFlagged ||
                                  sortType == nsMsgViewSortType.byAttachments);

  setSortByMenuItemCheckState("appmenu_sortAscending", (sortOrder == nsMsgViewSortOrder.ascending));
  setSortByMenuItemCheckState("appmenu_sortDescending", (sortOrder == nsMsgViewSortOrder.descending));

  let grouped = gFolderDisplay.view.showGroupedBySort;
  let threaded = gFolderDisplay.view.showThreaded;
  let sortThreadedMenuItem = document.getElementById("appmenu_sortThreaded");
  let sortUnthreadedMenuItem = document.getElementById("appmenu_sortUnthreaded");

  sortThreadedMenuItem.setAttribute("checked", threaded);
  sortUnthreadedMenuItem.setAttribute("checked", !threaded && !grouped);

  let groupBySortOrderMenuItem = document.getElementById("appmenu_groupBySort");

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

function InitAppmenuViewMessagesMenu()
{
  document.getElementById("appmenu_viewAllMessagesMenuItem").setAttribute("checked",
    !gFolderDisplay.view.showUnreadOnly &&
    !gFolderDisplay.view.specialView);

  document.getElementById("appmenu_viewUnreadMessagesMenuItem").setAttribute("checked",
    gFolderDisplay.view.showUnreadOnly);

  document.getElementById("appmenu_viewThreadsWithUnreadMenuItem").setAttribute("checked",
    gFolderDisplay.view.specialViewThreadsWithUnread);

  document.getElementById("appmenu_viewWatchedThreadsWithUnreadMenuItem").setAttribute("checked",
    gFolderDisplay.view.specialViewWatchedThreadsWithUnread);

  document.getElementById("appmenu_viewIgnoredThreadsMenuItem").setAttribute("checked",
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

  document.getElementById("menu_cancel").hidden = !isNews;

  // Disable the move and copy menus if there are no messages selected or if
  // the message is a dummy - e.g. opening a message in the standalone window.
  let messageStoredInternally = selectedMsg && !gMessageDisplay.isDummy;
  // Disable the move menu if we can't delete msgs from the folder.
  let canMove = messageStoredInternally &&
                gFolderDisplay.canDeleteSelectedMessages;
  document.getElementById("moveMenu").disabled = !canMove;

  // Also disable copy when no folder is loaded (like for .eml files).
  let canCopy = selectedMsg && (!gMessageDisplay.isDummy ||
                                window.arguments[0].scheme == "file");
  document.getElementById("copyMenu").disabled = !canCopy;

  initMoveToFolderAgainMenu(document.getElementById("moveToFolderAgain"));

  // Disable the Forward As menu item if no message is selected.
  document.getElementById("forwardAsMenu").disabled = !selectedMsg;

  // Disable the Tag menu item if no message is selected or when we're
  // not in a folder.
  document.getElementById("tagMenu").disabled = !messageStoredInternally;

  // Initialize the Open Message menuitem
  var winType = document.documentElement.getAttribute('windowtype');
  if (winType == "mail:3pane")
    document.getElementById('openMessageWindowMenuitem').hidden = isFeed;

  // Initialize the Open Feed Message handler menu
  let index = FeedMessageHandler.onOpenPref;
  document.getElementById("menu_openFeedMessage")
          .childNodes[index].setAttribute("checked", true);

  let openRssMenu = document.getElementById("openFeedMessage");
  openRssMenu.hidden = !isFeed;
  if (winType != "mail:3pane")
    openRssMenu.hidden = true;

  // Disable mark menu when we're not in a folder.
  document.getElementById("markMenu").disabled = gMessageDisplay.isDummy;

  document.commandDispatcher.updateCommands('create-menu-message');
}

function InitAppMessageMenu()
{
  let selectedMsg = gFolderDisplay.selectedMessage;
  let isNews = gFolderDisplay.selectedMessageIsNews;
  let isFeed = gFolderDisplay.selectedMessageIsFeed;

  // We show reply to Newsgroups only for news messages.
  document.getElementById("appmenu_replyNewsgroupMainMenu").hidden = !isNews;

  // For mail messages we say reply. For news we say ReplyToSender.
  document.getElementById("appmenu_replyMainMenu").hidden = isNews;
  document.getElementById("appmenu_replySenderMainMenu").hidden = !isNews;

  document.getElementById("appmenu_cancel").hidden = !isNews;

  // Disable the move and copy menus if there are no messages selected or if
  // the message is a dummy - e.g. opening a message in the standalone window.
  let messageStoredInternally = selectedMsg && !gMessageDisplay.isDummy;
  // Disable the move menu if we can't delete msgs from the folder.
  let canMove = messageStoredInternally &&
                gFolderDisplay.canDeleteSelectedMessages;
  document.getElementById("appmenu_moveMenu").disabled = !canMove;

  // Also disable copy when no folder is loaded (like for .eml files).
  let canCopy = selectedMsg && (!gMessageDisplay.isDummy ||
                                window.arguments[0].scheme == "file");
  document.getElementById("appmenu_copyMenu").disabled = !canCopy;

  initMoveToFolderAgainMenu(document.getElementById("appmenu_moveToFolderAgain"));

  // Disable the Forward As menu item if no message is selected.
  document.getElementById("appmenu_forwardAsMenu").disabled = !selectedMsg;

  // Disable the Tag menu item if no message is selected or when we're
  // not in a folder.
  document.getElementById("appmenu_tagMenu").disabled = !messageStoredInternally;

  // Initialize the Open Message menuitem
  let winType = document.documentElement.getAttribute('windowtype');
  if (winType == "mail:3pane")
    document.getElementById('appmenu_openMessageWindowMenuitem').hidden = isFeed;

  // Initialize the Open Feed Message handler menu
  let index = FeedMessageHandler.onOpenPref;
  document.getElementById("appmenu_openFeedMessagePopup")
          .childNodes[index]
          .setAttribute("checked", true);

  let openRssMenu = document.getElementById("appmenu_openFeedMessage");
  openRssMenu.hidden = !isFeed;
  if (winType != "mail:3pane")
    openRssMenu.hidden = true;

  // Disable mark menu when we're not in a folder.
  document.getElementById("appmenu_markMenu").disabled = gMessageDisplay.isDummy;
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
  var lastFolderURI = Services.prefs.getCharPref("mail.last_msg_movecopy_target_uri");
  var isMove = Services.prefs.getBoolPref("mail.last_msg_movecopy_was_move");
  if (lastFolderURI)
  {
    var destMsgFolder = GetMsgFolderFromUri(lastFolderURI);
    var bundle = document.getElementById("bundle_messenger");
    var stringName = isMove ? "moveToFolderAgain" : "copyToFolderAgain";
    aMenuItem.label = bundle.getFormattedString(stringName,
                                                [destMsgFolder.prettyName], 1);
    // This gives us moveToFolderAgainAccessKey and copyToFolderAgainAccessKey.
    aMenuItem.accesskey = bundle.getString(stringName + "AccessKey");
  }
}

function InitViewHeadersMenu()
{
  const dt = Components.interfaces.nsMimeHeaderDisplayTypes;
  var headerchoice = Services.prefs.getIntPref("mail.show_headers");
  document.getElementById("cmd_viewAllHeader")
          .setAttribute("checked", headerchoice == dt.AllHeaders);
  document.getElementById("cmd_viewNormalHeader")
          .setAttribute("checked", headerchoice == dt.NormalHeaders);
  document.commandDispatcher.updateCommands("create-menu-mark");
}

/**
 * @param headermode {Ci.nsMimeHeaderDisplayTypes}
 */
function AdjustHeaderView(headermode)
{
  const all = Components.interfaces.nsMimeHeaderDisplayTypes.AllHeaders;
  document.getElementById("expandedHeaderView")
      .setAttribute("show_header_mode", headermode == all ? "all" : "normal");
}


function InitViewBodyMenu()
{
  // Separate render prefs not implemented for feeds, bug 458606.  Show the
  // checked item for feeds as for the regular pref.
  //  let html_as = Services.prefs.getIntPref("rss.display.html_as");
  //  let prefer_plaintext = Services.prefs.getBoolPref("rss.display.prefer_plaintext");
  //  let disallow_classes = Services.prefs.getIntPref("rss.display.disallow_mime_handlers");

  let html_as = Services.prefs.getIntPref("mailnews.display.html_as");
  let prefer_plaintext = Services.prefs.getBoolPref("mailnews.display.prefer_plaintext");
  let disallow_classes = Services.prefs.getIntPref("mailnews.display.disallow_mime_handlers");
  let isFeed = gFolderDisplay.selectedMessageIsFeed;
  const defaultIDs = ["bodyAllowHTML",
                      "bodySanitized",
                      "bodyAsPlaintext",
                      "bodyAllParts"];
  const rssIDs = ["bodyFeedSummaryAllowHTML",
                  "bodyFeedSummarySanitized",
                  "bodyFeedSummaryAsPlaintext"];
  let menuIDs = isFeed ? rssIDs : defaultIDs;
  
  if (disallow_classes > 0)
    gDisallow_classes_no_html = disallow_classes;
  // else gDisallow_classes_no_html keeps its inital value (see top)

  let AllowHTML_menuitem = document.getElementById(menuIDs[0]);
  let Sanitized_menuitem = document.getElementById(menuIDs[1]);
  let AsPlaintext_menuitem = document.getElementById(menuIDs[2]);
  let AllBodyParts_menuitem = menuIDs[3] ? document.getElementById(menuIDs[3])
        : null;

  document.getElementById("bodyAllParts").hidden = 
    ! Services.prefs.getBoolPref("mailnews.display.show_all_body_parts_menu");

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
    AllowHTML_menuitem.hidden = !FeedMessageHandler.gShowSummary;
    Sanitized_menuitem.hidden = !FeedMessageHandler.gShowSummary;
    AsPlaintext_menuitem.hidden = !FeedMessageHandler.gShowSummary;
    document.getElementById("viewFeedSummarySeparator").hidden = !FeedMessageHandler.gShowSummary;
  }
}

function InitAppmenuViewBodyMenu()
{
  let html_as = Services.prefs.getIntPref("mailnews.display.html_as");
  let prefer_plaintext = Services.prefs.getBoolPref("mailnews.display.prefer_plaintext");
  let disallow_classes = Services.prefs.getIntPref("mailnews.display.disallow_mime_handlers");
  let isFeed = gFolderDisplay.selectedMessageIsFeed;
  const kDefaultIDs = ["appmenu_bodyAllowHTML",
                       "appmenu_bodySanitized",
                       "appmenu_bodyAsPlaintext",
                       "appmenu_bodyAllParts"];
  const kRssIDs = ["appmenu_bodyFeedSummaryAllowHTML",
                   "appmenu_bodyFeedSummarySanitized",
                   "appmenu_bodyFeedSummaryAsPlaintext"];
  let menuIDs = isFeed ? kRssIDs : kDefaultIDs;

  if (disallow_classes > 0)
    gDisallow_classes_no_html = disallow_classes;
  // else gDisallow_classes_no_html keeps its inital value (see top)

  let AllowHTML_menuitem = document.getElementById(menuIDs[0]);
  let Sanitized_menuitem = document.getElementById(menuIDs[1]);
  let AsPlaintext_menuitem = document.getElementById(menuIDs[2]);
  let AllBodyParts_menuitem = menuIDs[3] ? document.getElementById(menuIDs[3])
                                         : null;

  document.getElementById("appmenu_bodyAllParts").hidden =
    !Services.prefs.getBoolPref("mailnews.display.show_all_body_parts_menu");

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
    document.getElementById("appmenu_viewFeedSummarySeparator").hidden = !gShowFeedSummary;
  }
}

/**
 * Expand or collapse the folder pane.
 */
function MsgToggleFolderPane()
{
  // Bail without doing anything if we are not a folder tab.
  let currentTabInfo = document.getElementById("tabmail").currentTabInfo;
  if (currentTabInfo.mode.name != "folder")
    return;

  togglePaneSplitter("folderpane_splitter");
}

/**
 * Expand or collapse the message preview pane.
 */
function MsgToggleMessagePane()
{
  // Bail without doing anything if we are not a folder tab.
  let currentTabInfo = document.getElementById("tabmail").currentTabInfo;
  if (currentTabInfo.mode.name != "folder")
    return;

  togglePaneSplitter("threadpane-splitter");
  ChangeMessagePaneVisibility(IsMessagePaneCollapsed());
  SetFocusThreadPaneIfNotOnMessagePane();
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
  let tagArray = MailServices.tags.getAllTags({});

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

/**
 * Toggle the state of a message tag on the selected messages (based on the
 * state of the first selected message, like for starring).
 *
 * @param keyNumber the number (1 through 9) associated with the tag
 */
function ToggleMessageTagKey(keyNumber)
{
  let msgHdr = gFolderDisplay.selectedMessage;
  if (!msgHdr)
    return;

  let tagArray = MailServices.tags.getAllTags({});
  if (keyNumber > tagArray.length)
    return;

  let key = tagArray[keyNumber - 1].key;
  let curKeys = msgHdr.getStringProperty("keywords").split(" ");
  if (msgHdr.label)
    curKeys.push("$label" + msgHdr.label);
  let addKey = curKeys.indexOf(key) < 0;

  ToggleMessageTag(key, addKey);
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

function ManageTags()
{
  openOptionsDialog("paneDisplay", "tagTab");
}

function AddTagCallback(name, color)
{
  MailServices.tags.addTag(name, color, '');
  try
  {
    ToggleMessageTag(MailServices.tags.getKeyForTag(name), true);
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
  let shortcutkey = document.getElementById("key_tag" + index);
  let accesskey = shortcutkey ? shortcutkey.getAttribute("key") : "  ";
  if (accesskey != "  ") {
    menuitem.setAttribute("accesskey", accesskey);
    menuitem.setAttribute("acceltext", accesskey);
  }
  let label = document.getElementById("bundle_messenger")
                      .getFormattedString("mailnews.tags.format",
                                          [accesskey, name]);
  menuitem.setAttribute("label", label);
}

function InitMessageTags(menuPopup)
{
  let tagArray = MailServices.tags.getAllTags({});
  var tagCount = tagArray.length;

  // Remove any existing non-static entries... (clear tags list before rebuilding it)
  // "5" is the number of menu items (including separators) on the top of the menu
  // that should not be cleared.
  for (let i = menuPopup.childNodes.length; i > 5; --i)
    menuPopup.removeChild(menuPopup.lastChild);

  // create label and accesskey for the static remove item
  var tagRemoveLabel = document.getElementById("bundle_messenger")
                               .getString("mailnews.tags.remove");
  SetMessageTagLabel(menuPopup.lastChild.previousSibling, 0, tagRemoveLabel);

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
    let removeKey = (" " + curKeys + " ").contains(" " + taginfo.key + " ");
    newMenuItem.setAttribute('checked', removeKey);
    newMenuItem.setAttribute('oncommand', 'ToggleMessageTagMenu(event.target);');
    var color = taginfo.color;
    if (color)
      newMenuItem.setAttribute("class", "lc-" + color.substr(1));
    menuPopup.appendChild(newMenuItem);
  }
}

function InitRecentlyClosedTabsPopup(menuPopup)
{
  let tabs = document.getElementById("tabmail").recentlyClosedTabs;

  // show Popup only when there are restorable tabs.
  if( !tabs.length )
    return false;

  // Clear the list before rebulding it.     
  while (menuPopup.childNodes.length > 0)
    menuPopup.removeChild(menuPopup.firstChild);
    
  // Rebuild the recently closed tab list
  for (let i = 0; i < tabs.length; i++ ) {
    
    let menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label",tabs[i].title);    
    menuItem.setAttribute('oncommand',
        'document.getElementById("tabmail").undoCloseTab('+i+');');
     
    if (i==0)
      menuItem.setAttribute('key',"key_undoCloseTab");
     
    menuPopup.appendChild(menuItem);
  }
  
  // "Restore All Tabs" with only one entry does not make sense 
  if (tabs.length > 1) {
    menuPopup.appendChild(document.createElement("menuseparator"));
  
    let menuItem = document.createElement("menuitem");
    menuItem.setAttribute("label", document.getElementById("bundle_messenger")
                                           .getString("restoreAllTabs"));
    menuItem.setAttribute("oncommand","goRestoreAllTabs();");
    menuPopup.appendChild(menuItem);
  }

  return true;
}

function goRestoreAllTabs()
{
  let tabmail = document.getElementById("tabmail");
  
  let len = tabmail.recentlyClosedTabs.length;
  
  while(len--)
    document.getElementById("tabmail").undoCloseTab();
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

  let addresses = msgHdr.author + "," + msgHdr.recipients + "," + msgHdr.ccList;

  // If we've got any BCCed addresses (because we sent the message), add
  // them as well.
  if ("bcc" in currentHeaderData)
    addresses += currentHeaderData.bcc.headerValue;

  // Check to see if my email address is in the list of addresses.
  let myEmail = getIdentityForHeader(msgHdr).email;
  // We aren't guaranteed to have an email address, so guard against that.
  let imInAddresses = myEmail && (addresses.toLowerCase().contains(
                                    myEmail.toLowerCase()));

  // Now, let's get the number of unique addresses.
  let uniqueAddresses = MailServices.headerParser.removeDuplicateAddresses(addresses, "");
  let emailAddresses = {};
  let numAddresses = MailServices.headerParser.parseHeadersWithArray(uniqueAddresses,
                                                                     emailAddresses, {}, {});

  // XXX: This should be handled by the nsIMsgHeaderParser.  See Bug 498480.
  // Remove addresses that look like email groups, because we don't support
  // those yet.  (Any address with a : in it will be an empty email group,
  // or the colon and the groupname would be set as the first name, and not
  // show up in the address at all.)
  for (var i in emailAddresses.value)
  {
    if (emailAddresses.value[i].contains(":"))
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
  // ReplyToList is enabled if there is a List-Post header
  // with the correct format.
  let listPost = currentHeaderData["list-post"];
  if (!listPost)
    return false;

  // XXX: Once Bug 496914 provides a parser, we should use that instead.
  // Until then, we need to keep the following regex in sync with the
  // listPost parsing in nsMsgCompose.cpp's
  // QuotingOutputStreamListener::OnStopRequest.
  return /<mailto:.+>/.test(listPost["headerValue"]);
}

/**
 * Update the enabled/disabled states of the Reply, Reply-All, and
 * Reply-List buttons.  (After this function runs, one of the buttons
 * should be shown, and the others should be hidden.)
 */
function UpdateReplyButtons()
{
  // If we have no message, because we're being called from
  // MailToolboxCustomizeDone before someone selected a message, then just
  // return.
  if (!gFolderDisplay.selectedMessage)
    return;

  let buttonToShow;
  if (gFolderDisplay.selectedMessageIsNews)
  {
    // News messages always default to the "followup" dual-button.
    buttonToShow = "followup";
  }
  else if (gFolderDisplay.selectedMessageIsFeed)
  {
    // RSS items hide all the reply buttons.
    buttonToShow = null;
  }
  else
  {
    // Mail messages show the "reply" button (not the dual-button) and
    // possibly the "reply all" and "reply list" buttons.
    if (IsReplyListEnabled())
      buttonToShow = "replyList";
    else if (IsReplyAllEnabled())
      buttonToShow = "replyAll";
    else
      buttonToShow = "reply";
  }

  let smartReplyButton = document.getElementById("hdrSmartReplyButton");
  if (smartReplyButton)
  {
    let replyButton = document.getElementById("hdrReplyButton");
    let replyAllButton = document.getElementById("hdrReplyAllButton");
    let replyListButton = document.getElementById("hdrReplyListButton");
    let followupButton = document.getElementById("hdrFollowupButton");

    replyButton.hidden = (buttonToShow != "reply");
    replyAllButton.hidden = (buttonToShow != "replyAll");
    replyListButton.hidden = (buttonToShow != "replyList");
    followupButton.hidden = (buttonToShow != "followup");
  }

  let replyToSenderButton = document.getElementById("hdrReplyToSenderButton");
  if (replyToSenderButton)
  {
    if (gFolderDisplay.selectedMessageIsFeed)
      replyToSenderButton.hidden = true;
    else if (smartReplyButton)
      replyToSenderButton.hidden = (buttonToShow == "reply");
    else
      replyToSenderButton.hidden = false;
  }

  goUpdateCommand("button_reply");
  goUpdateCommand("button_replyall");
  goUpdateCommand("button_replylist");
  goUpdateCommand("button_followup");
}

function UpdateDeleteToolbarButton()
{
  var deleteButtonDeck = document.getElementById("delete-deck");
  if (!deleteButtonDeck)
    return;

  // Never show "Undelete" in the 3-pane for folders, when delete would
  // apply to the selected folder.
  if (gFolderDisplay.focusedPane == document.getElementById("folderTree") &&
      GetNumSelectedMessages() == 0)
    deleteButtonDeck.selectedIndex = 0;
  else
    deleteButtonDeck.selectedIndex = SelectedMessagesAreDeleted() ? 1 : 0;
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
  let messages = gFolderDisplay.selectedMessages;
  if (messages.length == 0)
    return undefined;
  if (messages.every(function(msg) { return msg.isRead; }))
    return true;
  if (messages.every(function(msg) { return !msg.isRead; }))
    return false;
  return undefined;
}

function SelectedMessagesAreFlagged()
{
  let firstSelectedMessage = gFolderDisplay.selectedMessage;
  return firstSelectedMessage && firstSelectedMessage.isFlagged;
}

function GetFirstSelectedMsgFolder()
{
  try {
    var selectedFolders = GetSelectedMsgFolders();
  } catch (e) {
    logException(e);
  }
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
    // Array of arrays of servers for a particular folder.
    var pop3DownloadServersArray = [];
    // Parallel array of folders to download to...
    var localFoldersToDownloadTo = [];
    var pop3Server;
    for (var i = 0; i < allServers.length; ++i)
    {
      var currentServer = allServers.queryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
      if (currentServer.protocolInfo.canLoginAtStartUp &&
          currentServer.loginAtStartUp)
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
      pop3Server.downloadMailFromServers(pop3DownloadServersArray[i],
                                         pop3DownloadServersArray[i].length,
                                         msgWindow,
                                         localFoldersToDownloadTo[i],
                                         null);
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
  if (gMessageDisplay.isDummy) {
    let file = window.arguments[0].QueryInterface(Components.interfaces
                                                            .nsIFileURL).file;
    MailServices.copy.CopyFileMessage(file, aDestFolder, null, false,
                                      Components.interfaces.nsMsgMessageFlags.Read,
                                      "", null, msgWindow);
  }
  else
    gDBView.doCommandWithFolder(nsMsgViewCommandType.copyMessages, aDestFolder);

  Services.prefs.setCharPref("mail.last_msg_movecopy_target_uri", aDestFolder.URI);
  Services.prefs.setBoolPref("mail.last_msg_movecopy_was_move", false);
}

/**
 * Moves the selected messages to the destination folder
 * @param aDestFolder  the destination folder
 */
function MsgMoveMessage(aDestFolder)
{
  gFolderDisplay.hintAboutToDeleteMessages();
  gDBView.doCommandWithFolder(nsMsgViewCommandType.moveMessages, aDestFolder);
  Services.prefs.setCharPref("mail.last_msg_movecopy_target_uri", aDestFolder.URI);
  Services.prefs.setBoolPref("mail.last_msg_movecopy_was_move", true);
}

/**
 * Calls the ComposeMessage function with the desired type, and proper default
 * based on the event that fired it.
 *
 * @param aCompType  the nsIMsgCompType to pass to the function
 * @param aEvent (optional) the event that triggered the call
 */
function composeMsgByType(aCompType, aEvent) {
  // If we're the hidden window, then we're not going to have a gFolderDisplay
  // to work out existing folders, so just use null.
  let msgFolder = gFolderDisplay ? GetFirstSelectedMsgFolder() : null;
  let msgUris = gFolderDisplay ? gFolderDisplay.selectedMessageUris : null;

  if (aEvent && aEvent.shiftKey) {
    ComposeMessage(aCompType,
                   Components.interfaces.nsIMsgCompFormat.OppositeOfDefault,
                   msgFolder, msgUris);
  }
  else {
    ComposeMessage(aCompType, Components.interfaces.nsIMsgCompFormat.Default,
                   msgFolder, msgUris);
  }
}

function MsgNewMessage(event)
{
  composeMsgByType(Components.interfaces.nsIMsgCompType.New, event);
}

function MsgReplyMessage(event)
{
  if (gFolderDisplay.selectedMessageIsNews)
    MsgReplyGroup(event);
  else
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

  archiveMessages: function BatchMessageMover_archiveMessages (aMsgHdrs)
  {
    gFolderDisplay.hintMassMoveStarting();

    if (!aMsgHdrs.length)
      return;

    for (let i = 0; i < aMsgHdrs.length; ++i)
    {
      let msgHdr = aMsgHdrs[i];

      let server = msgHdr.folder.server;
      let rootFolder = server.rootFolder;

      let msgDate = new Date(msgHdr.date / 1000);  // convert date to JS date object
      let msgYear = msgDate.getFullYear().toString();
      let monthFolderName = msgDate.toLocaleFormat("%Y-%m");
      let archiveFolderUri;

      let archiveGranularity;
      let archiveKeepFolderStructure;
      if (server.type == "rss") {
        // RSS servers don't have an identity so we special case the archives URI.
        archiveFolderUri = server.serverURI + "/Archives";
        archiveGranularity = Application.prefs.getValue("mail.identity.default.archive_granularity", 0);
        archiveKeepFolderStructure =
          Application.prefs.getValue("mail.identity.default.archive_keep_folder_structure", false);
      }
      else {
        let identity = getIdentityForHeader(msgHdr);
        archiveFolderUri = identity.archiveFolder;
        archiveGranularity = identity.archiveGranularity;
        archiveKeepFolderStructure = identity.archiveKeepFolderStructure;
      }
      let archiveFolder = GetMsgFolderFromUri(archiveFolderUri, false);

      let copyBatchKey = msgHdr.folder.URI + '\0' + monthFolderName;
      if (archiveGranularity >= Components.interfaces.nsIMsgIdentity
                                          .perMonthArchiveFolders)
        copyBatchKey += msgYear;

      if (archiveGranularity >=  Components.interfaces.nsIMsgIdentity
                                    .perMonthArchiveFolders)
        copyBatchKey += monthFolderName;

      if (archiveKeepFolderStructure)
        copyBatchKey += msgHdr.folder.URI;

       // Add a key to copyBatchKey
       if (! (copyBatchKey in this._batches)) {
        this._batches[copyBatchKey] = [msgHdr.folder, archiveFolderUri,
                                       archiveGranularity,
                                       archiveKeepFolderStructure,
                                       msgYear, monthFolderName];
      }
      this._batches[copyBatchKey].push(msgHdr);
    }
    MailServices.mfn.addListener(this, MailServices.mfn.folderAdded);

    // Now we launch the code iterating over all message copies, one in turn.
    this.processNextBatch();
  },

  processNextBatch: function BatchMessageMover_processNextBatch ()
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

      let forceSingle = !archiveFolder.canCreateSubfolders;
      if (!forceSingle && (archiveFolder.server instanceof
          Components.interfaces.nsIImapIncomingServer))
        forceSingle = archiveFolder.server.isGMailServer;
      if (forceSingle)
         granularity = Components.interfaces.nsIMsgIncomingServer
                                 .singleArchiveFolder;

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
        let array = Components.classes["@mozilla.org/array;1"]
                              .createInstance(Components.interfaces.nsIMutableArray);
        msgs.forEach(function(item){array.appendElement(item, false);});
        // If the source folder doesn't support deleting messages, we
        // make archive a copy, not a move.
        MailServices.copy.CopyMessages(srcFolder, array, dstFolder,
                                       srcFolder.canDeleteMessages, this, msgWindow, true);
        return; // only do one.
      }
      delete this._batches[key];
    }
    gFolderDisplay.hintMassMoveCompleted();

    MailServices.mfn.removeListener(this);

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

  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsIUrlListener) &&
      !iid.equals(Components.interfaces.nsIMsgCopyServiceListener) &&
      !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
}

/**
 * Archives the selected messages
 *
 * @param event the event that caused us to call this function
 */
function MsgArchiveSelectedMessages(event)
{
  let batchMover = new BatchMessageMover();
  batchMover.archiveMessages(gFolderDisplay.selectedMessages);
}

function MsgForwardMessage(event)
{
  var forwardType = 0;
  try {
    forwardType = Services.prefs.getIntPref("mail.forward_message_mode");
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
  let emailAddress = MailServices.headerParser.extractHeaderAddressMailboxes(msgHdr.author);
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
  var bundle = document.getElementById("bundle_messenger");
  var titleMsg = bundle.getString("confirmUnsubscribeTitle");
  var dialogMsg = (folders.length == 1) ?
    bundle.getFormattedString("confirmUnsubscribeText", [folders[0].name], 1) :
    bundle.getString("confirmUnsubscribeManyText");

  return Services.prompt.confirm(window, titleMsg, dialogMsg);
}

/**
 * Unsubscribe from selected or passed in newsgroup/s.
 * @param newsgroups (optional param) the newsgroup folders to unsubscribe from
 */
function MsgUnsubscribe(newsgroups)
{
  var folders = newsgroups || gFolderTreeView.getSelectedFolders();
  if (!ConfirmUnsubscribe(folders))
    return;

  for (let i = 0; i < folders.length; i++) {
    let subscribableServer = folders[i].server.QueryInterface(
      Components.interfaces.nsISubscribableServer);
    subscribableServer.unsubscribe(folders[i].name);
    subscribableServer.commitSubscribeChanges();
  }
}

function ToggleFavoriteFolderFlag()
{
  var folder = GetFirstSelectedMsgFolder();
  folder.toggleFlag(Components.interfaces.nsMsgFolderFlags.Favorite);
}

function MsgSaveAsFile()
{
  SaveAsFile(gFolderDisplay.selectedMessageUris);
}

function MsgSaveAsTemplate()
{
  if (GetNumSelectedMessages() == 1)
    SaveAsTemplate(gFolderDisplay.selectedMessageUris[0]);
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
  // Toggle message body (feed summary) and content-base url in message pane or
  // load in browser, per pref, otherwise open summary or web page in new window
  // or tab, per that pref.
  if (gFolderDisplay.selectedMessageIsFeed) {
    let msgHdr = gFolderDisplay.selectedMessage;
    if (FeedMessageHandler.onOpenPref == FeedMessageHandler.kOpenToggleInMessagePane) {
      let showSummary = FeedMessageHandler.shouldShowSummary(msgHdr, true);
      FeedMessageHandler.setContent(msgHdr, showSummary);
      return;
    }
    if (FeedMessageHandler.onOpenPref == FeedMessageHandler.kOpenLoadInBrowser) {
      setTimeout(FeedMessageHandler.loadWebPage, 20, msgHdr, {browser:true});
      return;
    }
  }

  // This is somewhat evil. If we're in a 3pane window, we'd have a tabmail
  // element and would pass it in here, ensuring that if we open tabs, we use
  // this tabmail to open them. If we aren't, then we wouldn't, so
  // displayMessages would look for a 3pane window and open tabs there.
  MailUtils.displayMessages(gFolderDisplay.selectedMessages,
                            gFolderDisplay.view,
                            document.getElementById("tabmail"));
}

function MsgOpenFromFile()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  var bundle = document.getElementById("bundle_messenger");
  var filterLabel = bundle.getString("EMLFiles");
  var windowTitle = bundle.getString("OpenEMLFiles");

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

/**
 * Display the given message in an existing folder tab.
 *
 * @param aMsgHdr The message header to display.
 */
function MsgDisplayMessageInFolderTab(aMsgHdr)
{
  // Look for a folder tab
  let tabmail = document.getElementById("tabmail");
  let folderTab = tabmail.getTabInfoForCurrentOrFirstModeInstance(
                      tabmail.tabModes["folder"]);
  let folderDisplay = folderTab.folderDisplay;
  let folder = gFolderTreeView.getFolderForMsgHdr(aMsgHdr);

  // XXX Yuck. We really need to have the tabmail be able to handle an extra
  // param with data to send to showTab, and to have the folder display have
  // a |selectFolderAndMessage| method that handles most of the messiness.
  folderDisplay.selectMessageComingUp();

  // Switch to the tab
  tabmail.switchToTab(folderTab);

  // We don't want to drop view filters at first
  if (folderDisplay.view.getViewIndexForMsgHdr(aMsgHdr, false) !=
      nsMsgViewIndex_None) {
    folderDisplay.selectMessage(aMsgHdr);
  }
  else {
    if (folderDisplay.displayedFolder != folder ||
        folderDisplay.view.isVirtual) {
      // Force select the folder
      folderDisplay.show(folder);
      gFolderTreeView.selectFolder(folder, true);
    }

    // Force select the message
    folderDisplay.selectMessage(aMsgHdr, true);
  }
}

function MsgJunk()
{
  MsgJunkMailInfo(true);
  JunkSelectedMessages(!SelectedMessagesAreJunk());
}

/**
 * Update the "mark as junk" button in the message header area.
 */
function UpdateJunkButton()
{
  // The junk message should slave off the selected message, as the preview pane
  //  may not be visible
  let hdr = gFolderDisplay.selectedMessage;
  // But only the message display knows if we are dealing with a dummy.
  if (!hdr || gMessageDisplay.isDummy) // .eml file
    return;
  let junkScore = hdr.getStringProperty("junkscore");
  let hideJunk = (junkScore == Components.interfaces.nsIJunkMailPlugin.IS_SPAM_SCORE);
  if (!gFolderDisplay.getCommandStatus(nsMsgViewCommandType.junk))
    hideJunk = true;
  if (document.getElementById('hdrJunkButton')) {
    document.getElementById('hdrJunkButton').disabled = hideJunk;
  }
}

/**
 * Checks if the selected messages can be marked as read or unread
 *
 * @param markingRead true if trying to mark messages as read, false otherwise
 * @return true if the chosen operation can be performed
 */
function CanMarkMsgAsRead(markingRead)
{
  return gFolderDisplay.selectedMessages.length > 0 &&
         SelectedMessagesAreRead() != markingRead;
}

/**
 * Marks the selected messages as read or unread
 *
 * @param read true if trying to mark messages as read, false if marking unread,
 *        undefined if toggling the read status
 */
function MsgMarkMsgAsRead(read)
{
  if (read == undefined)
    read = !gFolderDisplay.selectedMessage.isRead;
  MarkSelectedMessagesRead(read);
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
      /*
       * Here we face a decision. If the message has been moved to a
       *  different account, then a single filter cannot work for both
       *  manual and incoming scope. So we will create the filter based
       *  on its existing location, which will make it work properly in
       *  manual scope. This is the best solution for POP3 with global
       *  inbox (as then both manual and incoming filters work correctly),
       *  but may not be what IMAP users who filter to a local folder
       *  really want.
       */
      try
      {
        folder = gFolderDisplay.selectedMessage.folder;
        // except for news, we define the filter on the account's root
        if (!gFolderDisplay.selectedMessageIsNews)
          folder = folder.rootFolder;
      }
      catch (ex) {}
    }
    if (!folder)
      folder = GetFirstSelectedMsgFolder();
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
  let preselectedFolder = GetFirstSelectedMsgFolder();
  let selectedFolders = Components.classes["@mozilla.org/array;1"]
                                  .createInstance(Components.interfaces.nsIMutableArray);
  selectedFolders.appendElement(preselectedFolder, false);

  let curFilterList = preselectedFolder.getFilterList(msgWindow);
  // create a new filter list and copy over the enabled filters to it.
  // We do this instead of having the filter after the fact code ignore
  // disabled filters because the Filter Dialog filter after the fact
  // code would have to clone filters to allow disabled filters to run,
  // and we don't support cloning filters currently.
  let tempFilterList = MailServices.filters.getTempFilterList(preselectedFolder);
  let numFilters = curFilterList.filterCount;
  // make sure the temp filter list uses the same log stream
  tempFilterList.logStream = curFilterList.logStream;
  tempFilterList.loggingEnabled = curFilterList.loggingEnabled;
  let newFilterIndex = 0;
  for (let i = 0; i < numFilters; i++)
  {
    let curFilter = curFilterList.getFilterAt(i);
    // only add enabled, UI visibile filters that are in the manual context
    if (curFilter.enabled && !curFilter.temporary &&
        (curFilter.filterType & Components.interfaces.nsMsgFilterType.Manual))
    {
      tempFilterList.insertFilterAt(newFilterIndex, curFilter);
      newFilterIndex++;
    }
  }
  MailServices.filters.applyFiltersToFolders(tempFilterList, selectedFolders, msgWindow);
}

function MsgApplyFiltersToSelection()
{
  // bail if we're dealing with a dummy header
  if (gMessageDisplay.isDummy)
    return;

  var selectedMessages = gFolderDisplay.selectedMessages;
  if (selectedMessages.length) {
    MailServices.filters.applyFilters(Components.interfaces.nsMsgFilterType.Manual,
                                      toXPCOMArray(selectedMessages,
                                                   Components.interfaces.nsIMutableArray),
                                      gFolderDisplay.displayedFolder,
                                      msgWindow);
  }
}

function ChangeMailLayout(newLayout)
{
  Services.prefs.setIntPref("mail.pane_config.dynamic", newLayout);
}

function ChangeMailLayoutForCommand(aCommand)
{
  ChangeMailLayout(kMailLayoutCommandMap[aCommand]);
}

function MsgViewAllHeaders()
{
  const mode = Components.interfaces.nsMimeHeaderDisplayTypes.AllHeaders;
  Services.prefs.setIntPref("mail.show_headers", mode); // 2
  AdjustHeaderView(mode);
  ReloadMessage();
}

function MsgViewNormalHeaders()
{
  const mode = Components.interfaces.nsMimeHeaderDisplayTypes.NormalHeaders;
  Services.prefs.setIntPref("mail.show_headers", mode); // 1
  AdjustHeaderView(mode);
  ReloadMessage();
}

function MsgBodyAllowHTML()
{
  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
  Services.prefs.setIntPref("mailnews.display.html_as", 0);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers", 0);
  ReloadMessage();
}

function MsgBodySanitized()
{
  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
  Services.prefs.setIntPref("mailnews.display.html_as", 3);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers",
                         gDisallow_classes_no_html);
  ReloadMessage();
}

function MsgBodyAsPlaintext()
{
  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", true);
  Services.prefs.setIntPref("mailnews.display.html_as", 1);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers",
                         gDisallow_classes_no_html);
  ReloadMessage();
}

function MsgBodyAllParts()
{
  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", false);
  Services.prefs.setIntPref("mailnews.display.html_as", 4);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers", 0);
  ReloadMessage();
}

function MsgFeedBodyRenderPrefs(plaintext, html, mime)
{
  // Separate render prefs not implemented for feeds, bug 458606.
  //  Services.prefs.setBoolPref("rss.display.prefer_plaintext", plaintext);
  //  Services.prefs.setIntPref("rss.display.html_as", html);
  //  Services.prefs.setIntPref("rss.display.disallow_mime_handlers", mime);

  Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", plaintext);
  Services.prefs.setIntPref("mailnews.display.html_as", html);
  Services.prefs.setIntPref("mailnews.display.disallow_mime_handlers", mime);
  // Reload only if showing rss summary; menuitem hidden if web page..
  ReloadMessage();
}

function ToggleInlineAttachment(target)
{
  var viewAttachmentInline = !Services.prefs.getBoolPref("mail.inline_attachments");
  Services.prefs.setBoolPref("mail.inline_attachments", viewAttachmentInline)
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

function IsGetNewMessagesEnabled()
{
  let allServers = accountManager.allServers;
  for (let i = 0; i < allServers.length; ++i) {
    let server = allServers.queryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
    if (server.type == "none")
      continue;
    return true;
  }
  return false;
}

function IsGetNextNMessagesEnabled()
{
  var selectedFolders = GetSelectedMsgFolders();
  var folder = selectedFolders.length ? selectedFolders[0] : null;

  var menuItem = document.getElementById("menu_getnextnmsg");
  if (folder && !folder.isServer &&
      folder.server instanceof Components.interfaces.nsINntpIncomingServer) {
    menuItem.label = PluralForm.get(folder.server.maxArticles,
                                    document.getElementById("bundle_messenger")
                                            .getString("getNextNewsMessages"))
                               .replace("#1", folder.server.maxArticles);
    menuItem.removeAttribute("hidden");
    return true;
  }

  menuItem.setAttribute("hidden","true");
  return false;
}

function MsgSynchronizeOffline()
{
  window.openDialog("chrome://messenger/content/msgSynchronize.xul", "",
                    "centerscreen,chrome,modal,titlebar,resizable=yes",
                    {msgWindow:msgWindow});
}

function SpaceHit(event)
{
  // If focus is in chrome, we want to scroll the content window, unless
  // the focus is on an important chrome button like the otherActionsButton
  // popup; if focus is on a non-link content element like a button, bail so we
  // don't scroll when the element is going to do something else.

  var contentWindow = document.commandDispatcher.focusedWindow;
  let focusedElement = document.commandDispatcher.focusedElement;

  if (!gMessageDisplay.singleMessageDisplay) {
    contentWindow = document.getElementById("multimessage").contentWindow;
  } else if (contentWindow.top == window) {
    // These elements should always take priority over scrolling.
    const importantElements = ["otherActionsButton", "attachmentToggle"];
    contentWindow = window.content;
    if (focusedElement && importantElements.indexOf(focusedElement.id) != -1)
      return;
  }
  else if (focusedElement && !hRefForClickEvent(event))
    return;

  if (!contentWindow)
    return;

  var rssiframe = contentWindow.document.getElementById('_mailrssiframe');
  // If we are displaying an RSS article, we really want to scroll
  // the nested iframe.
  if (contentWindow == window.content && rssiframe)
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
  let msgSendlater = Components.classes["@mozilla.org/messengercompose/sendlater;1"]
                               .getService(Components.interfaces.nsIMsgSendLater);

  let allIdentities = MailServices.accounts.allIdentities;
  let identitiesCount = allIdentities.length;
  for (let i = 0; i < identitiesCount; i++) {
    let currentIdentity = allIdentities.queryElementAt(i, Components.interfaces.nsIMsgIdentity);
    let msgFolder = msgSendlater.getUnsentMessagesFolder(currentIdentity);
    if (msgFolder) {
      let numMessages = msgFolder.getTotalMessages(false /* include subfolders */);
      if (numMessages > 0) {
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
  var index = localFoldersToDownloadTo.indexOf(inboxFolder);
  if (index == -1)
  {
    if (inboxFolder)
    {
      inboxFolder.biffState =  Components.interfaces.nsIMsgFolder.nsMsgBiffState_NoMail;
      inboxFolder.clearNewMessages();
    }
    localFoldersToDownloadTo.push(inboxFolder);
    index = pop3DownloadServersArray.length;
    pop3DownloadServersArray.push([]);
  }
  pop3DownloadServersArray[index].push(currentServer);
}

function GetMessagesForAllAuthenticatedAccounts()
{
  // now log into any server
  try
  {
    var allServers = accountManager.allServers;
    // array of isupportsarrays of servers for a particular folder
    var pop3DownloadServersArray = [];
    // parallel array of folders to download to...
    var localFoldersToDownloadTo = [];
    var pop3Server;

    for (var i = 0; i < allServers.length; ++i)
    {
      var currentServer = allServers.queryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
      if (currentServer.protocolInfo.canGetMessages &&
          !currentServer.passwordPromptRequired)
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
      pop3Server.downloadMailFromServers(pop3DownloadServersArray[i],
                                         pop3DownloadServersArray[i].length,
                                         msgWindow,
                                         localFoldersToDownloadTo[i],
                                         null);
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
    var sanitizeJunkMail = Services.prefs.getBoolPref("mail.spam.display.sanitize");

    // Only bother doing this if we are modifying the html for junk mail....
    if (sanitizeJunkMail)
    {
      let junkScore = msgHdr.getStringProperty("junkscore");
      let isJunk = (junkScore == Components.interfaces.nsIJunkMailPlugin.IS_SPAM_SCORE);

      // If the current row  isn't going to change, reload to show sanitized or
      // unsanitized. Otherwise we wouldn't see the reloaded version anyway.

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
  mBarStatus: 0,
  // flag bit values for mBarStatus, indexed by kMsgNotificationXXX
  mBarFlagValues: [
                    0, // for no msgNotificationBar
                    1, // 1 << (kMsgNotificationPhishingBar - 1)
                    2, // 1 << (kMsgNotificationJunkBar - 1)
                    4, // 1 << (kMsgNotificationRemoteImages - 1)
                    8  // 1 << (kMsgNotificationMDN - 1)
                  ],

  get mMsgNotificationBar() {
    delete this.mMsgNotificationBar;
    return this.mMsgNotificationBar = document.getElementById('msgNotificationBar');
  },

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
    let emailAddress = MailServices.headerParser.extractHeaderAddressMailboxes(aMsgHdr.author);
    var desc = document.getElementById("bundle_messenger")
                       .getFormattedString("alwaysLoadRemoteContentForSender2",
                                           [emailAddress ? emailAddress : aMsgHdr.author]);
    var authorDesc = document.getElementById("allowRemoteContentForAuthorDesc");
    authorDesc.value = desc;
    authorDesc.setAttribute("tooltiptext", desc);
    this.updateMsgNotificationBar(kMsgNotificationRemoteImages, true);
  },

  setPhishingMsg: function()
  {
    this.updateMsgNotificationBar(kMsgNotificationPhishingBar, true);
  },

  setMDNMsg: function(aMdnGenerator, aMsgHeader, aMimeHdr)
  {
    this.mdnGenerator = aMdnGenerator;
    // Return receipts can be RFC 3798 or not.
    let mdnHdr = aMimeHdr.extractHeader("Disposition-Notification-To", false) ||
                 aMimeHdr.extractHeader("Return-Receipt-To", false); // not
    let fromHdr = aMimeHdr.extractHeader("From", false);

    let mdnAddr = MailServices.headerParser.extractHeaderAddressMailboxes(mdnHdr);
    let fromAddr = MailServices.headerParser.extractHeaderAddressMailboxes(fromHdr);

    let authorName = MailServices.headerParser.extractHeaderAddressName(
                       aMsgHeader.mime2DecodedAuthor) || aMsgHeader.author;

    let mdnBarMsg = document.getElementById("mdnBarMessage");
    if (mdnBarMsg.firstChild) // might have to remove old text first
     mdnBarMsg.removeChild(mdnBarMsg.firstChild);

    var bundle = document.getElementById("bundle_messenger");
    var barMsg;
    // If the return receipt doesn't go to the sender address, note that in the
    // notification.
    if (mdnAddr != fromAddr)
      barMsg = bundle.getFormattedString("mdnBarMessageAddressDiffers",
                                         [authorName, mdnAddr]);
    else
      barMsg = bundle.getFormattedString("mdnBarMessageNormal", [authorName]);
    mdnBarMsg.appendChild(document.createTextNode(barMsg));
    this.updateMsgNotificationBar(kMsgNotificationMDN, true);
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
   * @param aFlag one of the |mBarFlagValues| values
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
  window.content.focus();
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

  var names = {};
  var addresses = {};
  var fullNames = {};
  var numAddresses;

  numAddresses = MailServices.headerParser.parseHeadersWithArray(msgHdr.author, addresses, names, fullNames);
  var authorEmailAddress = addresses.value[0];
  if (!authorEmailAddress)
    return;

  // search through all of our local address books looking for a match.
  let enumerator = MailServices.ab.directories;
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

/**
 *  Allow disabling the scam feature for all messages until lists are in place.
 */
function DisablePhishingWarning()
{
  Application.prefs.setValue("mail.phishing.detection.enabled", false);
  ReloadMessage();
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
  let selectedMessageUris = gFolderDisplay.selectedMessageUris;
  let msgURI = selectedMessageUris ? selectedMessageUris[0] : null;
  Services.obs.notifyObservers(msgWindow.msgHeaderSink, "MsgMsgDisplayed", msgURI);

  // scale any overflowing images
  let doc = document.getElementById("messagepane").contentDocument;
  let imgs = doc.images;
  for (let i = 0; i < imgs.length; i++)
  {
    let img = imgs[i];
    if (img.className == "moz-attached-image" && img.naturalWidth > doc.body.clientWidth)
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
  if (!aUrl || gMessageDisplay.isDummy)
    return;

  var msgHdr = gMessageDisplay.displayedMessage;

  var wintype = document.documentElement.getAttribute('windowtype');

  gMessageNotificationBar.setJunkMsg(msgHdr);

  goUpdateCommand('button_delete');

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
  if (msgId.startsWith("md5:"))
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
  const MDN_DISPOSE_TYPE_DISPLAYED = 0;
  let askUser = mdnGenerator.process(MDN_DISPOSE_TYPE_DISPLAYED, msgWindow, msgFolder,
                                     msgHdr.messageKey, mimeHdr, false);
  if (askUser)
    gMessageNotificationBar.setMDNMsg(mdnGenerator, msgHdr, mimeHdr);
}

function SendMDNResponse()
{
  gMessageNotificationBar.mdnGenerator.userAgreed();
  gMessageNotificationBar.updateMsgNotificationBar(kMsgNotificationMDN, false);
}

function IgnoreMDNResponse()
{
  gMessageNotificationBar.mdnGenerator.userDeclined();
  gMessageNotificationBar.updateMsgNotificationBar(kMsgNotificationMDN, false);
}

function QuickSearchFocus()
{
  let tabmail = document.getElementById('tabmail');

  // If we're currently viewing a Gloda tab, drill down to find the
  // built-in search input, and select that.
  if (tabmail
      && tabmail.currentTabInfo.mode.name == "glodaFacet") {
    let searchInput = tabmail.currentTabInfo
                             .panel
                             .querySelector(".remote-gloda-search");
    if (searchInput)
      searchInput.select();

    return;
  }

  if (tabmail && tabmail.currentTabInfo.mode.name == "chat") {
    let searchInput = document.getElementById("IMSearchInput");
    if (searchInput)
      searchInput.select();
    return;
  }

  var quickSearchTextBox = document.getElementById('searchInput');
  if (quickSearchTextBox)
    quickSearchTextBox.select();
}

/**
 * Opens a search window with the given folder, or the displayed one if none is
 * chosen.
 *
 * @param [aFolder] the folder to open the search window for, if different from
 *                  the displayed one
 */
function MsgSearchMessages(aFolder)
{
  // We always open a new search dialog for each search command
  window.openDialog("chrome://messenger/content/SearchDialog.xul", "_blank",
                    "chrome,resizable,status,centerscreen,dialog=no",
                    { folder: aFolder || gFolderDisplay.displayedFolder });
}

function MsgJunkMailInfo(aCheckFirstUse)
{
  if (aCheckFirstUse) {
    if (!Services.prefs.getBoolPref("mailnews.ui.junk.firstuse"))
      return;
    Services.prefs.setBoolPref("mailnews.ui.junk.firstuse", false);

    // check to see if this is an existing profile where the user has started using
    // the junk mail feature already
    if (MailServices.junk.userHasClassified)
      return;
  }

  var desiredWindow = Services.wm.getMostRecentWindow("mailnews:junkmailinfo");

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

// This global is for SeaMonkey compatibility in newsblogOverlay.js.
let gShowFeedSummary = true;

let FeedMessageHandler = {
  gShowSummary: true,
  gToggle: false,
  kSelectOverrideWebPage:   0,
  kSelectOverrideSummary:   1,
  kSelectFeedDefault:       2,
  kOpenWebPage:             0,
  kOpenSummary:             1,
  kOpenToggleInMessagePane: 2,
  kOpenLoadInBrowser:       3,

  /**
   * How to load message on threadpane select.
   */
  get onSelectPref() {
    return Services.prefs.getIntPref("rss.show.summary");
  },

  set onSelectPref(val) {
    Services.prefs.setIntPref("rss.show.summary", val);
    ReloadMessage();
  },

  /**
   * Load web page on threadpane select.
   */
  get loadWebPageOnSelectPref() {
    return Services.prefs.getIntPref("rss.message.loadWebPageOnSelect") ? true : false;
  },

  /**
   * How to load message on open (enter/dbl click in threadpane, contextmenu).
   */
  get onOpenPref() {
    return Services.prefs.getIntPref("rss.show.content-base");
  },

  set onOpenPref(val) {
    Services.prefs.setIntPref("rss.show.content-base", val);
  },

  /**
   * Determine if a message is a feed message.  Prior to Tb15, a message had to
   * be in an rss acount type folder.  In Tb15 and later, a flag is set on the
   * message itself upon initial store; the message can be moved to any folder.
   *
   * @param nsIMsgDBHdr aMsgHdr - the message.
   *
   * @return true if message is a feed, false if not.
   */
  isFeedMessage: function (aMsgHdr) {
    return (aMsgHdr instanceof Components.interfaces.nsIMsgDBHdr) &&
           ((aMsgHdr.flags & Components.interfaces.nsMsgMessageFlags.FeedMsg) ||
            (aMsgHdr.folder && aMsgHdr.folder.server.type == "rss"));
  },

  /**
   * Determine whether to show a feed message summary or load a web page in the
   * message pane.
   *
   * @param nsIMsgDBHdr aMsgHdr - the message.
   * @param bool aToggle        - true if in toggle mode, false otherwise.
   *
   * @return true if summary is to be displayed, false if web page.
   */
  shouldShowSummary: function (aMsgHdr, aToggle) {
    // Not a feed message, always show summary (the message).
    if (!this.isFeedMessage(aMsgHdr))
      return true;

    // Notified of a summary reload when toggling, reset toggle and return.
    if (!aToggle && this.gToggle)
      return !(this.gToggle = false);

    let showSummary = true;
    this.gToggle = aToggle;

    // Thunderbird 2 rss messages with 'Show article summary' not selected,
    // ie message body constructed to show web page in an iframe, can't show
    // a summary - notify user.
    let contentDoc = getBrowser().contentDocument;
    let rssIframe = contentDoc.getElementById("_mailrssiframe");
    if (rssIframe) {
      if (this.gToggle || this.onSelectPref == this.kSelectOverrideSummary)
        this.gToggle = false;
      return false;
    }

    if (aToggle)
      // Toggle mode, flip value.
      return gShowFeedSummary = this.gShowSummary = !this.gShowSummary;

    let wintype = document.documentElement.getAttribute("windowtype");
    let tabMail = document.getElementById("tabmail");
    let messageTab = tabMail && tabMail.currentTabInfo.mode.type == "message";
    let messageWindow = wintype == "mail:messageWindow";

    switch (this.onSelectPref) {
      case this.kSelectOverrideWebPage:
        showSummary = false;
        break;
      case this.kSelectOverrideSummary:
        showSummary = true
        break;
      case this.kSelectFeedDefault:
        // Get quickmode per feed folder pref from feeds.rdf.  If the feed
        // message is not in a feed account folder (hence the folder is not in
        // the feeds database), or FZ_QUICKMODE property is not found (possible
        // in pre renovation urls), err on the side of showing the summary.
        // For the former, toggle or global override is necessary; for the
        // latter, a show summary checkbox toggle in Subscribe dialog will set
        // one on the path to bliss.
        let folder = aMsgHdr.folder, targetRes;
        try {
          targetRes = FeedUtils.getParentTargetForChildResource(
                        folder.URI, FeedUtils.FZ_QUICKMODE, folder.server);
        }
        catch (ex) {
          // Not in a feed account folder or other error.
          FeedUtils.log.info("FeedMessageHandler.shouldShowSummary: could not " +
                             "get summary pref for this folder");
        }

        showSummary = targetRes && targetRes.QueryInterface(Ci.nsIRDFLiteral).
                                             Value == "false" ? false : true;
        break;
    }

    gShowFeedSummary = this.gShowSummary = showSummary;

    if (messageWindow || messageTab) {
      // Message opened in either standalone window or tab, due to either
      // message open pref (we are here only if the pref is 0 or 1) or
      // contextmenu open.
      switch (this.onOpenPref) {
        case this.kOpenToggleInMessagePane:
          // Opened by contextmenu, use the value derived above.
          // XXX: allow a toggle via crtl?
          break;
        case this.kOpenWebPage:
          showSummary = false;
          break;
        case this.kOpenSummary:
          showSummary = true;
          break;
      }
    }

    // Auto load web page in browser on select, per pref; shouldShowSummary() is
    // always called first to 1)test if feed, 2)get summary pref, so do it here.
    if (this.loadWebPageOnSelectPref)
      setTimeout(FeedMessageHandler.loadWebPage, 20, aMsgHdr, {browser:true});

    return showSummary;
  },

  /**
   * Load a web page for feed messages.  Use MsgHdrToMimeMessage() to get
   * the content-base url from the message headers.  We cannot rely on
   * currentHeaderData; it has not yet been streamed at our entry point in
   * displayMessageChanged(), and in the case of a collapsed message pane it
   * is not streamed.
   *
   * @param nsIMsgDBHdr aMessageHdr - the message.
   * @param {obj} aWhere            - name value=true pair, where name is in:
   *                                  'messagepane', 'browser', 'tab', 'window'.
   */
  loadWebPage: function (aMessageHdr, aWhere) {
    MsgHdrToMimeMessage(aMessageHdr, null, function(aMsgHdr, aMimeMsg) {
      if (aMimeMsg && aMimeMsg.headers["content-base"] &&
          aMimeMsg.headers["content-base"][0]) {
        let url = aMimeMsg.headers["content-base"], uri;
        try {
          uri = Services.io.newURI(url, null, null);
          url = uri.spec;
        }
        catch (ex) {
          FeedUtils.log.info("FeedMessageHandler.loadWebPage: " +
                             "invalid Content-Base header url - " + url);
          return;
        }
        if (aWhere.browser)
          Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                    .getService(Components.interfaces.nsIExternalProtocolService)
                    .loadURI(uri);
        else if (aWhere.messagepane) {
          let loadFlag = getBrowser().webNavigation.LOAD_FLAGS_NONE;
          getBrowser().webNavigation.loadURI(url, loadFlag, null, null, null);
        }
        else if (aWhere.tab)
          openContentTab(url, "tab", "^");
        else if (aWhere.window)
          openContentTab(url, "window", "^");
      }
      else
        FeedUtils.log.info("FeedMessageHandler.loadWebPage: could not get " +
                           "Content-Base header url for this message");
    });
  },

  /**
   * Display summary or load web page for feed messages.  Caller should already
   * know if the message is a feed message.
   *
   * @param nsIMsgDBHdr aMsgHdr - the message.
   * @param bool aShowSummary   - true if summary is to be displayed, false if
   *                              web page.
   */
  setContent: function (aMsgHdr, aShowSummary) {
    if (aShowSummary) {
      // Only here if toggling to summary in 3pane.
      if (this.gToggle && gDBView && GetNumSelectedMessages() == 1)
        ReloadMessage();
    }
    else {
      let browser = getBrowser();
      if (browser && browser.contentDocument && browser.contentDocument.body)
        browser.contentDocument.body.hidden = true;
      // If in a non rss folder, hide possible remote content bar on a web
      // page load, as it doesn't apply.
      gMessageNotificationBar.clearMsgNotifications();

      this.loadWebPage(aMsgHdr, {messagepane:true});
      this.gToggle = false;
    }
  }
}

function initAppMenuPopup(aMenuPopup, aEvent)
{
  file_init();
  view_init();
  InitGoMessagesMenu();
  menu_new_init();
  CommandUpdate_UndoRedo();
  InitAppFolderViewsMenu();
  document.commandDispatcher.updateCommands('create-menu-tasks');

  // If the onpopupshowing event's target is on one of the splitmenu
  // menuitem popups, stash that popup in aMenuPopup (the menupopup one
  // level up) so that splitmenu knows which popup to close when it opens
  // up it's popupmenu.
  if (aEvent.target.parentNode.parentNode.parentNode.parentNode == aMenuPopup)
    aMenuPopup._currentPopup = aEvent.target;
}
