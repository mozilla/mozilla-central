/** ***** BEGIN LICENSE BLOCK *****
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/activity/activityModules.js");
Components.utils.import("resource:///modules/errUtils.js");
Components.utils.import("resource:///modules/folderUtils.jsm");
Components.utils.import("resource:///modules/IOUtils.js");
Components.utils.import("resource:///modules/jsTreeSelection.js");
Components.utils.import("resource:///modules/MailConsts.js");
Components.utils.import("resource:///modules/mailInstrumentation.js");
Components.utils.import("resource:///modules/mailnewsMigrator.js");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/msgDBCacheManager.js");
Components.utils.import("resource:///modules/sessionStoreManager.js");
Components.utils.import("resource:///modules/summaryFrameManager.js");
Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");

/* This is where functions related to the 3 pane window are kept */

// from MailNewsTypes.h
const nsMsgKey_None = 0xFFFFFFFF;
const nsMsgViewIndex_None = 0xFFFFFFFF;
const kMailCheckOncePrefName = "mail.startup.enabledMailCheckOnce";

const kStandardPaneConfig = 0;
const kWidePaneConfig = 1;
const kVerticalPaneConfig = 2;

const kNumFolderViews = 4; // total number of folder views

/** widget with id=messagepanebox, initialized by GetMessagePane() */
var gMessagePane;

/** widget with id=messagepaneboxwrapper, initialized by GetMessagePaneWrapper() */
var gMessagePaneWrapper;

var gThreadAndMessagePaneSplitter = null;
/**
 * Tracks whether the right mouse button changed the selection or not.  If the
 * user right clicks on the selection, it stays the same.  If they click outside
 * of it, we alter the selection (but not the current index) to be the row they
 * clicked on.
 *
 * The value of this variable is an object with "view" and "selection" keys
 * and values.  The view value is the view whose selection we saved off, and
 * the selection value is the selection object we saved off.
 */
var gRightMouseButtonSavedSelection = null;
var gNewAccountToLoad = null;

var gDisplayStartupPage = false;

// The object in charge of managing the mail summary pane
var gSummaryFrameManager;

// the folderListener object
var folderListener = {
    OnItemAdded: function(parentItem, item) { },

    OnItemRemoved: function(parentItem, item) { },

    OnItemPropertyChanged: function(item, property, oldValue, newValue) { },

    OnItemIntPropertyChanged: function(item, property, oldValue, newValue) {
      if (item == gFolderDisplay.displayedFolder) {
        if(property.toString() == "TotalMessages" || property.toString() == "TotalUnreadMessages") {
          UpdateStatusMessageCounts(gFolderDisplay.displayedFolder);
        }
      }
    },

    OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) { },

    OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue) { },
    OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) { },

    OnItemEvent: function(folder, event) {
      var eventType = event.toString();
      if (eventType == "ImapHdrDownloaded") {
        if (folder) {
          var imapFolder = folder.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
          if (imapFolder) {
            var hdrParser = imapFolder.hdrParser;
            if (hdrParser) {
              var msgHdr = hdrParser.GetNewMsgHdr();
              if (msgHdr)
              {
                var hdrs = hdrParser.headers;
                if (hdrs && hdrs.indexOf("X-attachment-size:") > 0) {
                  msgHdr.OrFlags(Components.interfaces.nsMsgMessageFlags
                                           .Attachment);
                }
                if (hdrs && hdrs.indexOf("X-image-size:") > 0) {
                  msgHdr.setStringProperty("imageSize", "1");
                }
              }
            }
          }
        }
      }
      else if (eventType == "JunkStatusChanged") {
        HandleJunkStatusChanged(folder);
      }
    }
}

function ServerContainsFolder(server, folder)
{
  if (!folder || !server)
    return false;

  return server.equals(folder.server);
}

function SelectServer(server)
{
  gFolderTreeView.selectFolder(server.rootFolder);
}

// we have this incoming server listener in case we need to
// alter the folder pane selection when a server is removed
// or changed (currently, when the real username or real hostname change)
var gThreePaneIncomingServerListener = {
    onServerLoaded: function(server) {},
    onServerUnloaded: function(server) {
      var selectedFolders = GetSelectedMsgFolders();
      for (var i = 0; i < selectedFolders.length; i++) {
        if (ServerContainsFolder(server, selectedFolders[i])) {
          SelectServer(accountManager.defaultAccount.incomingServer);
          // we've made a new selection, we're done
          return;
        }
      }

      // if nothing is selected at this point, better go select the default
      // this could happen if nothing was selected when the server was removed
      selectedFolders = GetSelectedMsgFolders();
      if (selectedFolders.length == 0) {
        SelectServer(accountManager.defaultAccount.incomingServer);
      }
    },
    onServerChanged: function(server) {
      // if the current selected folder is on the server that changed
      // and that server is an imap or news server,
      // we need to update the selection.
      // on those server types, we'll be reconnecting to the server
      // and our currently selected folder will need to be reloaded
      // or worse, be invalid.
      if (server.type != "imap" && server.type !="nntp")
        return;

      var selectedFolders = GetSelectedMsgFolders();
      for (var i = 0; i < selectedFolders.length; i++) {
        // if the selected item is a server, we don't have to update
        // the selection
        if (!(selectedFolders[i].isServer) && ServerContainsFolder(server, selectedFolders[i])) {
          SelectServer(server);
          // we've made a new selection, we're done
          return;
        }
      }
    }
}

// aMsgWindowInitialized: false if we are calling from the onload handler, otherwise true
function UpdateMailPaneConfig(aMsgWindowInitialized) {
  const dynamicIds = ["messagesBox", "mailContent", "threadPaneBox"];
  const layouts = ["standard", "wide", "vertical"];
  var layoutView = Services.prefs.getIntPref("mail.pane_config.dynamic");
  // Ensure valid value; hard fail if not.
  layoutView = dynamicIds[layoutView] ? layoutView : kStandardPaneConfig;
  var desiredId = dynamicIds[layoutView];
  document.getElementById("mailContent")
          .setAttribute("layout", layouts[layoutView]);
  var messagePaneBoxWrapper = GetMessagePaneWrapper();
  if (messagePaneBoxWrapper.parentNode.id != desiredId) {
    ClearAttachmentList();
    var hdrToolbox = document.getElementById("header-view-toolbox");
    var hdrToolbar = document.getElementById("header-view-toolbar");
    var firstPermanentChild = hdrToolbar.firstPermanentChild;
    var lastPermanentChild = hdrToolbar.lastPermanentChild;
    var messagePaneSplitter = GetThreadAndMessagePaneSplitter();
    var desiredParent = document.getElementById(desiredId);

    // Here the message pane including the header pane is moved to the
    // new layout by the appendChild() method below.  As described in bug
    // 519956 only elements in the DOM tree are copied to the new place
    // whereas javascript class variables of DOM tree elements get lost.
    // In this case the ToolboxPalette, Toolbarset first/lastPermanentChild
    // are removed which results in the message header pane not being
    // customizable any more.  A workaround for this problem is to clone
    // them first and add them to the DOM tree after the message pane has
    // been moved.
    var cloneToolboxPalette;
    var cloneToolbarset;
    if (hdrToolbox.palette) {
      cloneToolboxPalette = hdrToolbox.palette.cloneNode(true);
    }
    if (hdrToolbox.toolbarset) {
      cloneToolbarset = hdrToolbox.toolbarset.cloneNode(true);
    }

    // See Bug 381992. The ctor for the browser element will fire again when we
    // re-insert the messagePaneBoxWrapper back into the document.  But the dtor
    // doesn't fire when the element is removed from the document.  Manually
    // call destroy here to avoid a nasty leak.
    document.getElementById("messagepane").destroy();
    desiredParent.appendChild(messagePaneSplitter);
    desiredParent.appendChild(messagePaneBoxWrapper);
    hdrToolbox.palette  = cloneToolboxPalette;
    hdrToolbox.toolbarset = cloneToolbarset;
    hdrToolbar = document.getElementById("header-view-toolbar");
    hdrToolbar.firstPermanentChild = firstPermanentChild;
    hdrToolbar.lastPermanentChild = lastPermanentChild;
    messagePaneSplitter.orient = desiredParent.orient;
    if (aMsgWindowInitialized)
    {
      messenger.setWindow(null, null);
      messenger.setWindow(window, msgWindow);
      if (gDBView && GetNumSelectedMessages() == 1)
        gDBView.reloadMessage();
    }

    // The quick filter bar gets badly lied to due to standard XUL/XBL problems,
    //  so we need to generate synthetic notifications after a delay on those
    //  nodes that care about overflow.  The 'lie' comes in the form of being
    //  given (at startup) an overflow event with a tiny clientWidth (100), then
    //  a more tiny resize event (clientWidth = 32), then a resize event that
    //  claims the entire horizontal space is allocated to us
    //  (clientWidth = 1036).  It would appear that when the messagepane's XBL
    //  binding (or maybe the splitter's?) finally activates, the quick filter
    //  pane gets resized down without any notification.
    // Our solution tries to be generic and help out any code with an onoverflow
    //  handler.  We will also generate an onresize notification if it turns out
    //  that onoverflow is not appropriate (and such a handler is registered).
    //  This does require that XUL attributes were used to register the handlers
    //  rather than addEventListener.
    // The choice of the delay is basically a kludge because something like 10ms
    //  may be insufficient to ensure we get enqueued after whatever triggers
    //  the layout discontinuity.  (We need to wait for a paint to happen to
    //  trigger the XBL binding, and then there may be more complexities...)
    setTimeout(function UpdateMailPaneConfig_deferredFixup() {
      let threadPaneBox = document.getElementById("threadPaneBox");
      let overflowNodes =
        threadPaneBox.querySelectorAll("[onoverflow]");

      for (let iNode = 0; iNode < overflowNodes.length; iNode++) {
        let node = overflowNodes[iNode];

        if (node.scrollWidth > node.clientWidth) {
          let e = document.createEvent("HTMLEvents");
          e.initEvent("overflow", false, false);
          node.dispatchEvent(e);
        }
        else if (node.onresize) {
          let e = document.createEvent("HTMLEvents");
          e.initEvent("resize", false, false);
          node.dispatchEvent(e);
        }
      }
    }, 1500);
  }
}

const MailPrefObserver = {
  observe: function(subject, topic, prefName) {
    // verify that we're changing the mail pane config pref
    if (topic == "nsPref:changed")
    {
      if (prefName == "mail.pane_config.dynamic")
        UpdateMailPaneConfig(true);
      else if (prefName == "mail.showCondensedAddresses")
      {
        var currentDisplayNameVersion;
        var threadTree = document.getElementById("threadTree");

        currentDisplayNameVersion =
            Services.prefs.getIntPref("mail.displayname.version");

        Services.prefs.setIntPref("mail.displayname.version",
                                  ++currentDisplayNameVersion);

        //refresh the thread pane
        threadTree.treeBoxObject.invalid();
      }
    }
  }
};

/**
 * Called on startup if there are no accounts.
 */
function AutoConfigWizard(okCallback)
{
  let suppressDialogs = false;

  // Try to get the suppression pref that we stashed away in accountProvisionerTab.js.
  // If it doesn't exist, nsIPrefBranch throws, so we eat it silently and move along.
  try {
    suppressDialogs = Services.prefs.getBoolPref("mail.provider.suppress_dialog_on_startup");
  } catch(e) {};

  if (suppressDialogs) {
    // Looks like we were in the middle of filling out an account form. We
    // won't display the dialogs in that case.
    Services.prefs.clearUserPref("mail.provider.suppress_dialog_on_startup");
    okCallback();
    return;
  }

  if (Services.prefs.getBoolPref("mail.provider.enabled")) {
    Services.obs.addObserver({
      observe: function(aSubject, aTopic, aData) {
        if (aTopic == "mail-tabs-session-restored" && aSubject === window) {
          // We're done here, unregister this observer.
          Services.obs.removeObserver(this, "mail-tabs-session-restored");
          NewMailAccountProvisioner(msgWindow, { okCallback: null });
        }
      }
    }, "mail-tabs-session-restored", false);
    okCallback();
  }
  else
    NewMailAccount(msgWindow, okCallback);
}

/**
 * Called on startup to initialize various parts of the main window
 */
function OnLoadMessenger()
{
  migrateMailnews();
  // Rig up our TabsInTitlebar early so that we can catch any resize events.
  TabsInTitlebar.init();
  // update the pane config before we exit onload otherwise the user may see a flicker if we poke the document
  // in delayedOnLoadMessenger...
  UpdateMailPaneConfig(false);
  document.loadBindingDocument('chrome://global/content/bindings/textbox.xml');
  // Set a sane starting width/height for all resolutions on new profiles.
  // Do this before the window loads.
  if (!document.documentElement.hasAttribute("width"))
  {
    // Prefer 1024xfull height.
    let defaultHeight = screen.availHeight;
    let defaultWidth = (screen.availWidth <= 1024) ? screen.availWidth : 1024;

    // On small screens, default to maximized state.
    if (defaultHeight <= 600)
      document.documentElement.setAttribute("sizemode", "maximized");

    document.documentElement.setAttribute("width", defaultWidth);
    document.documentElement.setAttribute("height", defaultHeight);
    // Make sure we're safe at the left/top edge of screen
    document.documentElement.setAttribute("screenX", screen.availLeft);
    document.documentElement.setAttribute("screenY", screen.availTop);
  }

  Services.prefs.addObserver("mail.pane_config.dynamic", MailPrefObserver, false);
  Services.prefs.addObserver("mail.showCondensedAddresses", MailPrefObserver,
                             false);

  MailOfflineMgr.init();
  CreateMailWindowGlobals();
  GetMessagePaneWrapper().collapsed = true;
  msgDBCacheManager.init();

  // This needs to be before we throw up the account wizard on first run.
  try {
    mailInstrumentationManager.init();
  } catch(ex) {logException(ex);}

  // - initialize tabmail system
  // Do this before LoadPostAccountWizard since that code selects the first
  //  folder for display, and we want gFolderDisplay setup and ready to handle
  //  that event chain.
  // Also, we definitely need to register the tab type prior to the call to
  //  specialTabs.openSpecialTabsOnStartup below.
  let tabmail = document.getElementById('tabmail');
  if (tabmail)
  {
    // mailTabType is defined in mailWindowOverlay.js
    tabmail.registerTabType(mailTabType);
    // glodaFacetTab* in glodaFacetTab.js
    tabmail.registerTabType(glodaFacetTabType);
    QuickFilterBarMuxer._init();
    tabmail.registerTabMonitor(GlodaSearchBoxTabMonitor);
    tabmail.registerTabMonitor(statusMessageCountsMonitor);
    tabmail.openFirstTab();
  }

  // Install the light-weight theme handlers
  let panelcontainer = document.getElementById("tabpanelcontainer");
  if (panelcontainer) {
    panelcontainer.addEventListener("InstallBrowserTheme",
                                    LightWeightThemeWebInstaller, false, true);
    panelcontainer.addEventListener("PreviewBrowserTheme",
                                    LightWeightThemeWebInstaller, false, true);
    panelcontainer.addEventListener("ResetBrowserThemePreview",
                                    LightWeightThemeWebInstaller, false, true);
  }

  Services.obs.addObserver(gPluginHandler.pluginCrashed, "plugin-crashed", false);

  // This also registers the contentTabType ("contentTab")
  specialTabs.openSpecialTabsOnStartup();
  webSearchTabType.initialize();
  tabmail.registerTabType(accountProvisionerTabType);

  // verifyAccounts returns true if the callback won't be called
  // We also don't want the account wizard to open if any sort of account exists
  if (verifyAccounts(LoadPostAccountWizard, false, AutoConfigWizard))
    LoadPostAccountWizard();

  // Set up the summary frame manager to handle loading pages in the
  // multi-message pane
  gSummaryFrameManager = new SummaryFrameManager(
                         document.getElementById("multimessage"));

  window.addEventListener("AppCommand", HandleAppCommandEvent, true);
}

function LoadPostAccountWizard()
{
  InitMsgWindow();
  messenger.setWindow(window, msgWindow);

  InitPanes();
  MigrateAttachmentDownloadStore();
  MigrateJunkMailSettings();
  MigrateFolderViews();
  MigrateOpenMessageBehavior();
  Components.utils.import("resource:///modules/mailMigrator.js");
  MailMigrator.migratePostAccountWizard();

  accountManager.setSpecialFolders();

  try {
    accountManager.loadVirtualFolders();
  } catch (e) {Components.utils.reportError(e);}
  accountManager.addIncomingServerListener(gThreePaneIncomingServerListener);

  gPhishingDetector.init();

  AddToSession();

  //need to add to session before trying to load start folder otherwise listeners aren't
  //set up correctly.

  let startFolderURI = null, startMsgHdr = null;
  if ("arguments" in window && window.arguments.length > 0)
  {
    let arg0 = window.arguments[0];
    // If the argument is a string, it is either a folder URI or a feed URI
    if (typeof arg0 == "string")
    {
      // filter our any feed urls that came in as arguments to the new window...
      if (arg0.toLowerCase().startsWith("feed:"))
      {
        let feedHandler = Components.classes["@mozilla.org/newsblog-feed-downloader;1"]
          .getService(Components.interfaces.nsINewsBlogFeedDownloader);
        if (feedHandler)
          feedHandler.subscribeToFeed(arg0, null, msgWindow);
      }
      else
      {
        startFolderURI = arg0;
      }
    }
    else if (arg0)
    {
      // arg0 is an object
      if (("wrappedJSObject" in arg0) && arg0.wrappedJSObject)
        arg0 = arg0.wrappedJSObject;
      startMsgHdr = ("msgHdr" in arg0) ? arg0.msgHdr : null;
    }
  }

  function completeStartup() {
    // Check whether we need to show the default client dialog
    // First, check the shell service
    var nsIShellService = Components.interfaces.nsIShellService;
    if (nsIShellService) {
      var shellService;
      var defaultAccount;
      try {
        shellService = Components.classes["@mozilla.org/mail/shell-service;1"].getService(nsIShellService);
        defaultAccount = accountManager.defaultAccount;
      } catch (ex) {}

      // Next, try loading the search integration module
      // We'll get a null SearchIntegration if we don't have one
      Components.utils.import("resource:///modules/SearchIntegration.js");

      // Show the default client dialog only if
      // EITHER: we have at least one account, and we aren't already the default
      // for mail,
      // OR: we have the search integration module, the OS version is suitable,
      // and the first run hasn't already been completed.
      // Needs to be shown outside the he normal load sequence so it doesn't appear
      // before any other displays, in the wrong place of the screen.
      if ((shellService && defaultAccount && shellService.shouldCheckDefaultClient
           && !shellService.isDefaultClient(true, nsIShellService.MAIL)) ||
        (SearchIntegration && !SearchIntegration.osVersionTooLow &&
         !SearchIntegration.osComponentsNotRunning && !SearchIntegration.firstRunDone)) {
        window.openDialog("chrome://messenger/content/systemIntegrationDialog.xul",
                          "SystemIntegration", "modal,centerscreen,chrome,resizable=no");
        // On windows, there seems to be a delay between setting TB as the
        // default client, and the isDefaultClient check succeeding.
        if (shellService.isDefaultClient(true, nsIShellService.MAIL))
          Services.obs.notifyObservers(window, "mail:setAsDefault", null);
      }
    }
    // All core modal dialogs are done, the user can now interact with the 3-pane window
    Services.obs.notifyObservers(window, "mail-startup-done", null);
  }

  setTimeout(completeStartup, 0);

  // FIX ME - later we will be able to use onload from the overlay
  OnLoadMsgHeaderPane();

  //Set focus to the Thread Pane the first time the window is opened.
  SetFocusThreadPane();

  // initialize the customizeDone method on the customizeable toolbar
  var toolbox = document.getElementById("mail-toolbox");
  toolbox.customizeDone = function(aEvent) { MailToolboxCustomizeDone(aEvent, "CustomizeMailToolbar"); };

  var toolbarset = document.getElementById('customToolbars');
  toolbox.toolbarset = toolbarset;

  // XXX Do not select the folder until the window displays or the threadpane
  //  will be at minimum size.  We used to have
  //  gFolderDisplay.ensureRowIsVisible use settimeout itself to defer that
  //  calculation, but that was ugly.  Also, in theory we will open the window
  //  faster if we let the event loop start doing things sooner.

  if (startMsgHdr)
    window.setTimeout(loadStartMsgHdr, 0, startMsgHdr);
  else
    window.setTimeout(loadStartFolder, 0, startFolderURI);
}

function HandleAppCommandEvent(evt)
{
  evt.stopPropagation();
  switch (evt.command) {
    case "Back":
      goDoCommand('cmd_goBack');
      break;
    case "Forward":
      goDoCommand('cmd_goForward');
      break;
    case "Stop":
      msgWindow.StopUrls();
      break;
    case "Search":
      goDoCommand('cmd_search');
      break;
    case "Bookmarks":
      toAddressBook();
      break;
    case "Home":
    case "Reload":
    default:
      break;
  }
}

/**
 * Look for another 3-pane window.
 */
function FindOther3PaneWindow()
{
  // XXX We'd like to use getZOrderDOMWindowEnumerator here, but it doesn't work
  // on Linux
  let enumerator = Services.wm.getEnumerator("mail:3pane");
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    if (win != window)
      return win;
  }
  return null;
}

/**
 * Called by messenger.xul:onunload, the 3-pane window inside of tabs window.
 *  It's being unloaded!  Right now!
 */
function OnUnloadMessenger()
{
  Services.obs.notifyObservers(window, "mail-unloading-messenger", null);
  accountManager.removeIncomingServerListener(gThreePaneIncomingServerListener);
  Services.prefs.removeObserver("mail.pane_config.dynamic", MailPrefObserver);
  Services.prefs.removeObserver("mail.showCondensedAddresses", MailPrefObserver);

  sessionStoreManager.unloadingWindow(window);

  TabsInTitlebar.uninit();

  let tabmail = document.getElementById("tabmail");
  tabmail._teardown();

  webSearchTabType.shutdown();

  MailServices.mailSession.RemoveFolderListener(folderListener);

  gPhishingDetector.shutdown();

  Services.obs.removeObserver(gPluginHandler.pluginCrashed, "plugin-crashed");

  // FIX ME - later we will be able to use onload from the overlay
  OnUnloadMsgHeaderPane();

  UnloadPanes();

  OnMailWindowUnload();
  try {
    mailInstrumentationManager.uninit();
  } catch (ex) {logException(ex);}
}

/**
 * Called by the session store manager periodically and at shutdown to get
 * the state of this window for persistence.
 */
function getWindowStateForSessionPersistence()
{
  let tabmail = document.getElementById('tabmail');
  let tabsState = tabmail.persistTabs();
  return { type: "3pane", tabs: tabsState };
}

/**
 * Attempt to restore our tab states.  This should only be called by
 * |loadStartFolder| or |loadStartMsgHdr|.
 *
 * @param aDontRestoreFirstTab If this is true, the first tab will not be
 *                             restored, and will continue to retain focus at
 *                             the end. This is needed if the window was opened
 *                             with a folder or a message as an argument.
 *
 * @return true if the restoration was successful, false otherwise.
 */
function atStartupRestoreTabs(aDontRestoreFirstTab) {

  let state = sessionStoreManager.loadingWindow(window);

  if (state) {
    let tabsState = state.tabs;
    let tabmail = document.getElementById("tabmail");
    tabmail.restoreTabs(tabsState, aDontRestoreFirstTab);
  }

  // it's now safe to load extra Tabs.
  setTimeout(loadExtraTabs, 0);
  Services.obs.notifyObservers(window, "mail-tabs-session-restored", null);
  return state ? true : false;
}

/**
 * Loads and restores tabs upon opening a window by evaluating window.arguments[1].
 *
 * The type of the object is specified by it's action property. It can be
 * either "restore" or "open". "restore" invokes tabmail.restoreTab() for each
 * item in the tabs array. While "open" invokes tabmail.openTab() for each item.
 *
 * In case a tab can't be restored it will fail silently
 *
 * the object need at least the following properties:
 *
 * {
 *   action = "restore" | "open"
 *   tabs = [];
 * }
 *
 */
function loadExtraTabs()
{

  if (!("arguments" in window) || window.arguments.length < 2)
    return;

  let tab = window.arguments[1];
  if ((!tab) || (typeof tab != "object"))
    return;

  let tabmail =  document.getElementById("tabmail");

  // we got no action, so suppose its "legacy" code
  if (!("action" in tab)) {

    if ("tabType" in tab)
      tabmail.openTab(tab.tabType, tab.tabParams);

    return;
  }

  if (!("tabs" in tab))
    return;

  // this is used if a tab is detached to a new window.
  if (tab.action == "restore") {

    for (let i = 0; i < tab.tabs.length; i++)
      tabmail.restoreTab(tab.tabs[i]);

    // we currently do not support opening in background or opening a
    // special position. So select the last tab opened.
    tabmail.switchToTab(tabmail.tabInfo[tabmail.tabInfo.length-1])

    return;
  }

  if (tab.action == "open") {

    for (let i = 0; i < tab.tabs.length; i++)
      if("tabType" in tabs.tab[i])
        tabmail.openTab(tabs.tab[i].tabType,tabs.tab[i].tabParams);

    return;
  }

}

/**
 * Loads the given message header at window open. Exactly one out of this and
 * |loadStartFolder| should be called.
 *
 * @param aStartMsgHdr The message header to load at window open
 */
function loadStartMsgHdr(aStartMsgHdr)
{
  // We'll just clobber the default tab
  atStartupRestoreTabs(true);

  MsgDisplayMessageInFolderTab(aStartMsgHdr);
}

function loadStartFolder(initialUri)
{
    var defaultServer = null;
    var startFolder;
    var isLoginAtStartUpEnabled = false;

    // If a URI was explicitly specified, we'll just clobber the default tab
    let loadFolder = !atStartupRestoreTabs(!!initialUri);

    if (initialUri)
      loadFolder = true;

    //First get default account
    try
    {

        if(initialUri)
            startFolder = MailUtils.getFolderForURI(initialUri);
        else
        {
            try {
                var defaultAccount = accountManager.defaultAccount;
            } catch (x) {
                return; // exception caused by no default account, ignore it.
            }

            defaultServer = defaultAccount.incomingServer;
            var rootMsgFolder = defaultServer.rootMsgFolder;

            startFolder = rootMsgFolder;

            // Enable check new mail once by turning checkmail pref 'on' to bring
            // all users to one plane. This allows all users to go to Inbox. User can
            // always go to server settings panel and turn off "Check for new mail at startup"
            if (!Services.prefs.getBoolPref(kMailCheckOncePrefName))
            {
                Services.prefs.setBoolPref(kMailCheckOncePrefName, true);
                defaultServer.loginAtStartUp = true;
            }

            // Get the user pref to see if the login at startup is enabled for default account
            isLoginAtStartUpEnabled = defaultServer.loginAtStartUp;

            // Get Inbox only if login at startup is enabled.
            if (isLoginAtStartUpEnabled)
            {
                //now find Inbox
                var outNumFolders = new Object();
                const kInboxFlag = Components.interfaces.nsMsgFolderFlags.Inbox;
                var inboxFolder = rootMsgFolder.getFolderWithFlags(kInboxFlag);
                if (!inboxFolder) return;

                startFolder = inboxFolder;
            }
        }

        // it is possible we were given an initial uri and we need to subscribe or try to add
        // the folder. i.e. the user just clicked on a news folder they aren't subscribed to from a browser
        // the news url comes in here.

        // Perform biff on the server to check for new mail, except for imap
        // or a pop3 account that is deferred or deferred to,
        // or the case where initialUri is non-null (non-startup)
        if (!initialUri && isLoginAtStartUpEnabled
            && !defaultServer.isDeferredTo &&
            defaultServer.rootFolder == defaultServer.rootMsgFolder)
          defaultServer.performBiff(msgWindow);
        if (loadFolder) {
          try {
            gFolderTreeView.selectFolder(startFolder);
          } catch(ex) {
            // This means we tried to select a folder that isn't in the current
            // view. Just select the first one in the view then.
            if (gFolderTreeView._rowMap.length)
              gFolderTreeView.selectFolder(gFolderTreeView._rowMap[0]._folder);
          }
        }
    }
    catch(ex)
    {
      // this is the case where we're trying to auto-subscribe to a folder.
      if (initialUri && !startFolder.parent)
      {
        // hack to force display of thread pane.
        ShowingThreadPane();
        messenger.loadURL(window, initialUri);
        return;
      }

      Components.utils.reportError(ex);
    }

    MsgGetMessagesForAllServers(defaultServer);

    if (MailOfflineMgr.isOnline()) {
      // Check if we shut down offline, and restarted online, in which case
      // we may have offline events to playback. Since this is not a pref
      // the user should set, it's not in mailnews.js, so we need a try catch.
      let playbackOfflineEvents = false;
      try {
        playbackOfflineEvents = Services.prefs.getBoolPref("mailnews.playback_offline");
      }
      catch(ex) {}
      if (playbackOfflineEvents)
      {
        Services.prefs.setBoolPref("mailnews.playback_offline", false);
        MailOfflineMgr.offlineManager.goOnline(false, true, msgWindow);
      }

      // If appropriate, send unsent messages. This may end up prompting the user,
      // so we need to get it out of the flow of the normal load sequence.
      setTimeout(function checkUnsent() {
        if (MailOfflineMgr.shouldSendUnsentMessages())
          SendUnsentMessages();
      }, 0);
    }
}

function AddToSession()
{
  var nsIFolderListener = Components.interfaces.nsIFolderListener;
  var notifyFlags = nsIFolderListener.intPropertyChanged | nsIFolderListener.event;
  MailServices.mailSession.AddFolderListener(folderListener, notifyFlags);
}

function InitPanes()
{
  gFolderTreeView.load(document.getElementById("folderTree"),
                       "folderTree.json");
  var folderTree = document.getElementById("folderTree");
  folderTree.addEventListener("click",FolderPaneOnClick,true);
  folderTree.addEventListener("mousedown",TreeOnMouseDown,true);
  var threadTree = document.getElementById("threadTree");
  threadTree.addEventListener("click",ThreadTreeOnClick,true);

  OnLoadThreadPane();
  SetupCommandUpdateHandlers();
}

function UnloadPanes()
{
  var threadTree = document.getElementById("threadTree");
  threadTree.removeEventListener("click",ThreadTreeOnClick,true);
  var folderTree = document.getElementById("folderTree");
  folderTree.removeEventListener("click",FolderPaneOnClick,true);
  folderTree.removeEventListener("mousedown",TreeOnMouseDown,true);
  gFolderTreeView.unload("folderTree.json");
  UnloadCommandUpdateHandlers();
}

/**
 * Abuse the threadpane UI version preference to know whether we should mark all
 * IMAP folders as offline.
 *
 * Very important note!  Although I am writing this comment and renamed the
 * function, this is not my doing and by reading this function and not fixing it
 * yourself, you are just as guilty as me, which is not guilty at all, but
 * it certainly won't improve your karma.
 *
 * This used to do things related to updating the visible columns and reordering
 * them, but that is now handled by FolderDisplayWidget.
 */
function UpgradeProfileAndBeUglyAboutIt()
{
  var threadPaneUIVersion;

  try {
    threadPaneUIVersion = Services.prefs.getIntPref("mailnews.ui.threadpane.version");
    if (threadPaneUIVersion < 7)
    {
      Services.prefs.setIntPref("mailnews.ui.threadpane.version", 7);
    } // version 7 upgrades
  }
  catch (ex) {
    Components.utils.reportError(ex);
  }
}

function OnLoadThreadPane()
{
  // Use an observer to watch the columns element so that we get a notification
  // whenever attributes on the columns change.
  let observer = new MutationObserver(function handleMutations(mutations) {
    gFolderDisplay.hintColumnsChanged();
  });
  observer.observe(document.getElementById("threadCols"), {
    attributes: true,
    subtree: true,
    attributeFilter: ["hidden", "ordinal"]
  });
  UpgradeProfileAndBeUglyAboutIt();
}

/* Functions for accessing particular parts of the window*/
function GetMessagePane()
{
  if (!gMessagePane)
    gMessagePane = document.getElementById("messagepanebox");
  return gMessagePane;
}

function GetMessagePaneWrapper()
{
  if (!gMessagePaneWrapper)
    gMessagePaneWrapper = document.getElementById("messagepaneboxwrapper");
  return gMessagePaneWrapper;
}

function GetMessagePaneFrame()
{
  // We must use the message pane element directly here, as other tabs can
  // have browser elements as well (which could be set to content-primary,
  // which would confuse things with a window.content return).
  return document.getElementById("messagepane").contentWindow;
}

function getMailToolbox()
{
  return document.getElementById("mail-toolbox");
}

function FindInSidebar(currentWindow, id)
{
  var item = currentWindow.document.getElementById(id);
  if (item)
    return item;

  for (var i = 0; i < currentWindow.frames.length; ++i)
  {
    var frameItem = FindInSidebar(currentWindow.frames[i], id);
    if (frameItem)
      return frameItem;
  }

  return null;
}

function GetThreadAndMessagePaneSplitter()
{
  if (!gThreadAndMessagePaneSplitter)
    gThreadAndMessagePaneSplitter = document.getElementById('threadpane-splitter');
  return gThreadAndMessagePaneSplitter;
}

function IsMessagePaneCollapsed()
{
  return document.getElementById("threadpane-splitter")
                 .getAttribute("state") == "collapsed";
}

function ClearThreadPaneSelection()
{
  gFolderDisplay.clearSelection();
}

function ClearMessagePane()
{
  // hide the message header view AND the message pane...
  HideMessageHeaderPane();
  gMessageNotificationBar.clearMsgNotifications();
  ClearPendingReadTimer();
  try {
    // This can fail because cloning imap URI's can fail if the username
    // has been cleared by docshell/base/nsDefaultURIFixup.cpp.
    let messagePane = GetMessagePaneFrame();
    // If we don't do this check, no one else does and we do a non-trivial
    // amount of work.  So do the check.
    if (messagePane.location.href != "about:blank")
      messagePane.location.href = "about:blank";
  } catch(ex) {
      logException(ex, false, "error clearing message pane");
  }
}

/**
 * When right-clicks happen, we do not want to corrupt the underlying
 * selection.  The right-click is a transient selection.  So, unless the
 * user is right-clicking on the current selection, we create a new
 * selection object (thanks to JSTreeSelection) and set that as the
 * current/transient selection.
 *
 * It is up you to call RestoreSelectionWithoutContentLoad to clean up when we
 * are done.
 *
 * @param aSingleSelect Should the selection we create be a single selection?
 *     This is relevant if the row being clicked on is already part of the
 *     selection.  If it is part of the selection and !aSingleSelect, then we
 *     leave the selection as is.  If it is part of the selection and
 *     aSingleSelect then we create a transient single-row selection.
 */
function ChangeSelectionWithoutContentLoad(event, tree, aSingleSelect)
{
  var treeBoxObj = tree.treeBoxObject;
  if (!treeBoxObj) {
    event.stopPropagation();
    return;
  }

  var treeSelection = treeBoxObj.view.selection;

  var row = treeBoxObj.getRowAt(event.clientX, event.clientY);
  // Only do something if:
  // - the row is valid
  // - it's not already selected (or we want a single selection)
  if (row >= 0 &&
      (aSingleSelect || !treeSelection.isSelected(row))) {
    // Check if the row is exactly the existing selection.  In that case
    //  there is no need to create a bogus selection.
    if (treeSelection.count == 1) {
      let minObj = {};
      treeSelection.getRangeAt(0, minObj, {});
      if (minObj.value == row) {
        event.stopPropagation();
        return;
      }
    }

    let transientSelection = new JSTreeSelection(treeBoxObj);
    transientSelection.logAdjustSelectionForReplay();

    gRightMouseButtonSavedSelection = {
      view: treeBoxObj.view,
      realSelection: treeSelection,
      transientSelection: transientSelection
    };

    var saveCurrentIndex = treeSelection.currentIndex;

    // tell it to log calls to adjustSelection
    // attach it to the view
    treeBoxObj.view.selection = transientSelection;
    // Don't generate any selection events! (we never set this to false, because
    //  that would generate an event, and we never need one of those from this
    //  selection object.
    transientSelection.selectEventsSuppressed = true;
    transientSelection.select(row);
    transientSelection.currentIndex = saveCurrentIndex;
    treeBoxObj.ensureRowIsVisible(row);
  }
  event.stopPropagation();
}

function TreeOnMouseDown(event)
{
    // Detect right mouse click and change the highlight to the row
    // where the click happened without loading the message headers in
    // the Folder or Thread Pane.
    // Same for middle click, which will open the folder/message in a tab.
    if (event.button == 2 || event.button == 1)
    {
      // We want a single selection if this is a middle-click (button 1)
      ChangeSelectionWithoutContentLoad(event, event.target.parentNode,
                                        event.button == 1);
    }
}

function FolderPaneContextMenuNewTab(event)
{
  var bgLoad = Services.prefs.getBoolPref("mail.tabs.loadInBackground");
  if (event.shiftKey)
    bgLoad = !bgLoad;
  MsgOpenNewTabForFolder(bgLoad);
}

function FolderPaneOnClick(event)
{
  var folderTree = document.getElementById("folderTree");

  // Middle click on a folder opens the folder in a tab
  if (event.button == 1 && event.originalTarget.localName != "slider" &&
      event.originalTarget.localName != "scrollbarbutton")
  {
    FolderPaneContextMenuNewTab(event);
    RestoreSelectionWithoutContentLoad(folderTree);
  }
  else if (event.button == 0)
  {
    var row = {};
    var col = {};
    var elt = {};
    folderTree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, elt);
    if (row.value == -1) {
      if (event.originalTarget.localName == "treecol")
      {
        // clicking on the name column in the folder pane should not sort
        event.stopPropagation();
      }
    }
    else if ((event.originalTarget.localName == "slider") ||
             (event.originalTarget.localName == "scrollbarbutton")) {
      event.stopPropagation();
    }
  }
}

function OpenMessageInNewTab(event)
{
  if (!gFolderDisplay.selectedMessage)
    return;
  var bgLoad = Services.prefs.getBoolPref("mail.tabs.loadInBackground");
  if (event.shiftKey)
    bgLoad = !bgLoad;

  document.getElementById("tabmail").openTab("message",
      {msgHdr: gFolderDisplay.selectedMessage,
       viewWrapperToClone: gFolderDisplay.view,
       background: bgLoad});
}

function ThreadTreeOnClick(event)
{
  var threadTree = document.getElementById("threadTree");

  // Middle click on a message opens the message in a tab
  if (event.button == 1 && event.originalTarget.localName != "slider" &&
      event.originalTarget.localName != "scrollbarbutton")
  {
    OpenMessageInNewTab(event);
    RestoreSelectionWithoutContentLoad(threadTree);
  }
}

function GetSelectedMsgFolders()
{
  return gFolderTreeView.getSelectedFolders();
}

function SelectFolder(folderUri)
{
  gFolderTreeView.selectFolder(MailUtils.getFolderForURI(folderUri));
}

function ReloadMessage()
{
  gFolderDisplay.view.dbView.reloadMessage();
}

// Some of the per account junk mail settings have been
// converted to global prefs. Let's try to migrate some
// of those settings from the default account.
function MigrateJunkMailSettings()
{
  var junkMailSettingsVersion = Services.prefs.getIntPref("mail.spam.version");
  if (!junkMailSettingsVersion)
  {
    // Get the default account, check to see if we have values for our
    // globally migrated prefs.
    var defaultAccount;
    try {
      defaultAccount = accountManager.defaultAccount;
    } catch (ex) {}
    if (defaultAccount && defaultAccount.incomingServer)
    {
      // we only care about
      var prefix = "mail.server." + defaultAccount.incomingServer.key + ".";
      if (Services.prefs.prefHasUserValue(prefix + "manualMark"))
      {
        Services.prefs.setBoolPref("mail.spam.manualMark",
          Services.prefs.getBoolPref(prefix + "manualMark"));
      }
      if (Services.prefs.prefHasUserValue(prefix + "manualMarkMode"))
      {
        Services.prefs.setIntPref("mail.spam.manualMarkMode",
          Services.prefs.getIntPref(prefix + "manualMarkMode"));
      }
      if (Services.prefs.prefHasUserValue(prefix + "spamLoggingEnabled"))
      {
        Services.prefs.setBoolPref("mail.spam.logging.enabled",
          Services.prefs.getBoolPref(prefix + "spamLoggingEnabled"));
      }
      if (Services.prefs.prefHasUserValue(prefix + "markAsReadOnSpam"))
      {
        Services.prefs.setBoolPref("mail.spam.markAsReadOnSpam",
          Services.prefs.getBoolPref(prefix + "markAsReadOnSpam"));
      }
    }
    // bump the version so we don't bother doing this again.
    Services.prefs.setIntPref("mail.spam.version", 1);
  }
}

// The first time a user runs a build that supports folder views, pre-populate the favorite folders list
// with the existing INBOX folders.
function MigrateFolderViews()
{
  var folderViewsVersion = Services.prefs.getIntPref("mail.folder.views.version");
  if (!folderViewsVersion)
  {
     var servers = accountManager.allServers;
     var server;
     var inbox;
     for (var index = 0; index < servers.length; index++)
     {
       server = servers.queryElementAt(index, Components.interfaces.nsIMsgIncomingServer);
       if (server)
       {
         inbox = GetInboxFolder(server);
         if (inbox)
           inbox.setFlag(Components.interfaces.nsMsgFolderFlags.Favorite);
       }
     }
    Services.prefs.setIntPref("mail.folder.views.version", 1);
  }
}

// Thunderbird has been storing old attachment download meta data in downloads.rdf
// even though there was no way to show or clean up this data. Now that we are using
// the new download manager in toolkit, we don't want to present this old data.
// To migrate to the new download manager, remove downloads.rdf.
function MigrateAttachmentDownloadStore()
{
  var attachmentStoreVersion = Services.prefs.getIntPref("mail.attachment.store.version");
  if (!attachmentStoreVersion)
  {
    var downloadsFile = Services.dirsvc.get("DLoads", Components.interfaces.nsIFile);
    if (downloadsFile && downloadsFile.exists())
      downloadsFile.remove(false);

    // bump the version so we don't bother doing this again.
    Services.prefs.setIntPref("mail.attachment.store.version", 1);
  }
}

// Do a one-time migration of the old mailnews.reuse_message_window pref to the
// newer mail.openMessageBehavior. This does the migration only if the old pref
// is defined.
function MigrateOpenMessageBehavior()
{
  let openMessageBehaviorVersion = Services.prefs.getIntPref(
                                     "mail.openMessageBehavior.version");
  if (!openMessageBehaviorVersion)
  {
    let reuseMessageWindow;
    try {
      reuseMessageWindow = Services.prefs.getBoolPref(
                             "mailnews.reuse_message_window");
    }
    catch (e) {}

    // Don't touch this if it isn't defined
    if (reuseMessageWindow === true)
      Services.prefs.setIntPref("mail.openMessageBehavior",
          MailConsts.OpenMessageBehavior.EXISTING_WINDOW);
    else if (reuseMessageWindow === false)
      Services.prefs.setIntPref("mail.openMessageBehavior",
          MailConsts.OpenMessageBehavior.NEW_TAB);

    Services.prefs.setIntPref("mail.openMessageBehavior.version", 1);
  }
}

function ThreadPaneOnDragStart(aEvent) {
  if (aEvent.originalTarget.localName != "treechildren")
    return;

  let messages = gFolderDisplay.selectedMessageUris;
  if (!messages)
    return;

  gFolderDisplay.hintAboutToDeleteMessages();
  let fileNames = new Set();
  let msgUrls = {};

  // Dragging multiple messages to desktop does not currently work.
  // When core fixes for multiple-drop-on-desktop support
  // (e.g. bug 513464, bug 270292) are landed, generating of
  // "application/x-moz-file-promise" values for i > 0 can be enabled.
  // But first ensure suggestUniqueFileName is efficient enough on 10000+ dragged
  // messages.
  for (let i in messages) {
    messenger.messageServiceFromURI(messages[i])
             .GetUrlForUri(messages[i], msgUrls, null);
    aEvent.dataTransfer.mozSetDataAt("text/x-moz-message", messages[i], i);
    aEvent.dataTransfer.mozSetDataAt("text/x-moz-url",msgUrls.value.spec, i);

    if (i > 0)
      continue;

    // Generate file name in case the object is dropped onto the desktop.
    let subject = messenger.messageServiceFromURI(messages[i])
                           .messageURIToMsgHdr(messages[i]).mime2DecodedSubject;
    let uniqueFileName = suggestUniqueFileName(subject.substr(0, 124), ".eml",
                                               fileNames);
    fileNames.add(uniqueFileName);

    aEvent.dataTransfer.mozSetDataAt("application/x-moz-file-promise-url",
                                     msgUrls.value.spec + "?fileName=" +
                                     uniqueFileName, i);
    aEvent.dataTransfer.mozSetDataAt("application/x-moz-file-promise", null, i);
  }
  aEvent.dataTransfer.effectAllowed = "copyMove";
  aEvent.dataTransfer.addElement(aEvent.originalTarget);
}

/**
 * Returns a new filename that is guaranteed to not be in the Set
 * of existing names.
 *
 * Example use:
 *   suggestUniqueFileName("testname", ".txt", Set("testname", "testname1"))
 *   returns "testname2.txt"
 * Does not check file system for existing files.
 *
 * @param aIdentifier     proposed filename
 * @param aType           extension
 * @param aExistingNames  a Set of names already in use
 */
function suggestUniqueFileName(aIdentifier, aType, aExistingNames) {
  let suffix = 1;
  let base = validateFileName(aIdentifier);
  let suggestion = base + aType;
  while(true) {
    if (!aExistingNames.has(suggestion))
      break;

    suggestion = base + suffix + aType;
    suffix++;
  }

  return suggestion;
}

function ThreadPaneOnDragOver(aEvent) {
  let ds = Components.classes["@mozilla.org/widget/dragservice;1"]
                     .getService(Components.interfaces.nsIDragService)
                     .getCurrentSession();
  ds.canDrop = false;
  if (!gFolderDisplay.displayedFolder.canFileMessages)
    return;

  let dt = aEvent.dataTransfer;
  if (Array.indexOf(dt.mozTypesAt(0), "application/x-moz-file") != -1) {
    let extFile = dt.mozGetDataAt("application/x-moz-file", 0)
                    .QueryInterface(Components.interfaces.nsIFile);
    if (extFile.isFile()) {
      let len = extFile.leafName.length;
      if (len > 4 && extFile.leafName.toLowerCase().endsWith(".eml"))
        ds.canDrop = true;
    }
  }
}

function ThreadPaneOnDrop(aEvent) {
  let dt = aEvent.dataTransfer;
  for (let i = 0; i < dt.mozItemCount; i++) {
    let extFile = dt.mozGetDataAt("application/x-moz-file", i)
                    .QueryInterface(Components.interfaces.nsIFile);
    if (extFile.isFile()) {
      let len = extFile.leafName.length;
      if (len > 4 && extFile.leafName.toLowerCase().endsWith(".eml"))
        MailServices.copy.CopyFileMessage(extFile, gFolderDisplay.displayedFolder,
                                          null, false, 1, "", null, msgWindow);
    }
  }
}

var LightWeightThemeWebInstaller = {
  handleEvent: function (event) {
    switch (event.type) {
      case "InstallBrowserTheme":
      case "PreviewBrowserTheme":
      case "ResetBrowserThemePreview":
        // ignore requests from background tabs
        if (event.target.ownerDocument.defaultView.top != content)
          return;
    }
    switch (event.type) {
      case "InstallBrowserTheme":
        this._installRequest(event);
        break;
      case "PreviewBrowserTheme":
        this._preview(event);
        break;
      case "ResetBrowserThemePreview":
        this._resetPreview(event);
        break;
      case "pagehide":
        this._resetPreview();
        break;
    }
  },

  onTabTitleChanged: function (aTab) {
  },

  onTabSwitched: function (aTab, aOldTab) {
    this._resetPreview();
  },

  get _manager () {
    let temp = {};
    Components.utils.import("resource://gre/modules/LightweightThemeManager.jsm", temp);
    delete this._manager;
    return this._manager = temp.LightweightThemeManager;
  },

  _installRequest: function (event) {
    let node = event.target;
    let data = this._getThemeFromNode(node);
    if (!data)
      return;

    if (this._isAllowed(node)) {
      this._install(data);
      return;
    }

    let messengerBundle = document.getElementById("bundle_messenger");

    let buttons = [{
      label: messengerBundle.getString("lwthemeInstallRequest.allowButton"),
      accessKey: messengerBundle.getString("lwthemeInstallRequest.allowButton.accesskey"),
      callback: function () {
        LightWeightThemeWebInstaller._install(data);
      }
    }];

    this._removePreviousNotifications();

    let message =
      messengerBundle.getFormattedString("lwthemeInstallRequest.message",
                                         [node.ownerDocument.location.host]);

    let notificationBox = this._getNotificationBox();
    let notificationBar =
      notificationBox.appendNotification(message, "lwtheme-install-request", "",
                                         notificationBox.PRIORITY_INFO_MEDIUM,
                                         buttons);
    notificationBar.persistence = 1;
  },

  _install: function (newTheme) {
    let previousTheme = this._manager.currentTheme;
    this._manager.currentTheme = newTheme;
    if (this._manager.currentTheme &&
        this._manager.currentTheme.id == newTheme.id)
      this._postInstallNotification(newTheme, previousTheme);
  },

  _postInstallNotification: function (newTheme, previousTheme) {
    function text(id) {
      return document.getElementById("bundle_messenger")
                     .getString("lwthemePostInstallNotification." + id);
    }

    let buttons = [{
      label: text("undoButton"),
      accessKey: text("undoButton.accesskey"),
      callback: function () {
        LightWeightThemeWebInstaller._manager.forgetUsedTheme(newTheme.id);
        LightWeightThemeWebInstaller._manager.currentTheme = previousTheme;
      }
    }, {
      label: text("manageButton"),
      accessKey: text("manageButton.accesskey"),
      callback: function () {
        openAddonsMgr("addons://list/theme");
      }
    }];

    this._removePreviousNotifications();

    let notificationBox = this._getNotificationBox();
    let notificationBar =
      notificationBox.appendNotification(text("message"),
                                         "lwtheme-install-notification", "",
                                         notificationBox.PRIORITY_INFO_MEDIUM,
                                         buttons);
    notificationBar.persistence = 1;
    notificationBar.timeout = Date.now() + 20000; // 20 seconds
  },

  _removePreviousNotifications: function () {
    let box = this._getNotificationBox();

    ["lwtheme-install-request",
     "lwtheme-install-notification"].forEach(function (value) {
        var notification = box.getNotificationWithValue(value);
        if (notification)
          box.removeNotification(notification);
      });
  },

  _previewWindow: null,
  _preview: function (event) {
    if (!this._isAllowed(event.target))
      return;

    let data = this._getThemeFromNode(event.target);
    if (!data)
      return;

    this._resetPreview();

    this._previewWindow = event.target.ownerDocument.defaultView;
    this._previewWindow.addEventListener("pagehide", this, true);
    document.getElementById('tabmail').registerTabMonitor(this);

    this._manager.previewTheme(data);
  },

  _resetPreview: function (event) {
    if (!this._previewWindow ||
        event && !this._isAllowed(event.target))
      return;

    this._previewWindow.removeEventListener("pagehide", this, true);
    this._previewWindow = null;
    document.getElementById('tabmail').unregisterTabMonitor(this);

    this._manager.resetPreview();
  },

  _isAllowed: function (node) {
    let uri = node.ownerDocument.documentURIObject;
    return Services.perms.testPermission(uri, "install") == Services.perms.ALLOW_ACTION;
  },

  _getNotificationBox: function () {
    // Try and get the notification box for the selected tab.
    let browser = document.getElementById('tabmail').getBrowserForSelectedTab();
    // The messagepane doesn't have a notification bar yet.
    if (browser && browser.parentNode.tagName == "notificationbox")
      return browser.parentNode;

    // Otherwise, default to the global notificationbox
    return document.getElementById("mail-notification-box");
  },

  _getThemeFromNode: function (node) {
    return this._manager.parseTheme(node.getAttribute("data-browsertheme"),
                                    node.baseURI);
  }
}

/**
 * Initialize and attach the HTML5 context menu to the specified menupopup
 * during the onpopupshowing event.
 *
 * @param menuPopup the menupopup element
 * @param event the event responsible for showing the popup
 */
function InitPageMenu(menuPopup, event) {
  if (event.target != menuPopup)
    return;

  PageMenu.maybeBuildAndAttachMenu(menuPopup.triggerNode, menuPopup);

  if (menuPopup.children.length == 0)
    event.preventDefault();
}

let TabsInTitlebar = {
  init: function () {
#ifdef CAN_DRAW_IN_TITLEBAR
    // Don't trust the initial value of the sizemode attribute; wait for the resize event.
    this._readPref();
    Services.prefs.addObserver(this._prefName, this, false);

    this.allowedBy("sizemode", false);
    window.addEventListener("resize", function (event) {
      if (event.target != window)
        return;
      TabsInTitlebar.allowedBy("sizemode", true);
    }, false);

    this._initialized = true;
#endif
  },

  allowedBy: function (condition, allow) {
#ifdef CAN_DRAW_IN_TITLEBAR
    if (allow) {
      if (condition in this._disallowed) {
        delete this._disallowed[condition];
        this._update();
      }
    } else {
      if (!(condition in this._disallowed)) {
        this._disallowed[condition] = null;
        this._update();
      }
    }
#endif
  },

  _initialized: false,
  _disallowed: {},
  _prefName: 'mail.tabs.drawInTitlebar',

  get enabled() {
    return document.documentElement.getAttribute('tabsintitlebar') == 'true';
  },

  _readPref: function() {
    this.allowedBy('pref', Services.prefs.getBoolPref(this._prefName));
  },

  observe: function(aSubject, aTopic, aData) {
    if (aTopic == 'nsPref:changed')
      this._readPref();
  },

  _update: function() {
#ifdef CAN_DRAW_IN_TITLEBAR
    if (!this._initialized || window.fullScreen)
      return;

    let allowed = Object.keys(this._disallowed).length == 0;
    if (allowed == this.enabled)
      return;

    function $(id) document.getElementById(id);
    let titlebar = $("titlebar");

    if (allowed) {
      document.documentElement.setAttribute('tabsintitlebar', 'true');
      document.documentElement.setAttribute('chromemargin', '0,2,2,2');
      function rect(ele) ele.getBoundingClientRect();

      let captionButtonsBox = $("titlebar-buttonbox");
      this._sizePlaceholder("caption-buttons", rect(captionButtonsBox).width);

      let titlebarRect = rect(titlebar);
      titlebar.style.marginBottom = - (titlebarRect.height - 16) + "px";
    } else {
      document.documentElement.removeAttribute('tabsintitlebar');
      document.documentElement.removeAttribute('chromemargin');
      titlebar.style.marginBottom = "";
    }
#endif
  },

  _sizePlaceholder: function (type, width) {
#ifdef CAN_DRAW_IN_TITLEBAR
    Array.forEach(document.querySelectorAll(".titlebar-placeholder[type='"+ type +"']"),
                  function (node) { node.width = width; });
#endif
  },

  uninit: function () {
#ifdef CAN_DRAW_IN_TITLEBAR
    this._initialized = false;
    Services.prefs.removeObserver(this._prefName, this);
#endif
  }
};

/* Draw */
function onTitlebarMaxClick() {
  if (window.windowState == window.STATE_MAXIMIZED)
    window.restore();
  else
    window.maximize();
}
