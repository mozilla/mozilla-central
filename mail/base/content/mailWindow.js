/** ***** BEGIN LICENSE BLOCK *****
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/appIdleManager.js");
Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/gloda/log4moz.js");
Components.utils.import("resource:///modules/gloda/public.js");
Components.utils.import("resource:///modules/glodaWebSearch.js");

//This file stores variables common to mail windows
var messenger;
var statusFeedback;
var msgWindow;

var accountManager;

var gContextMenu;
var gMailWindowLog = Log4Moz.getConfiguredLogger("mailWindow", Log4Moz.Level.Debug, Log4Moz.Level.Debug, Log4Moz.Level.Debug);

/**
 * Called by messageWindow.xul:onunload,  the 'single message display window'.
 *
 * Also called by messenger.xul:onunload's (the 3-pane window inside of tabs
 *  window) unload function, OnUnloadMessenger.
 */
function OnMailWindowUnload()
{
  MailOfflineMgr.uninit();
  ClearPendingReadTimer();

  // all dbview closing is handled by OnUnloadMessenger for the 3-pane (it closes
  //  the tabs which close their views) and OnUnloadMessageWindow for the
  //  standalone message window.

  MailServices.mailSession.RemoveMsgWindow(msgWindow);
  // the tabs have the FolderDisplayWidget close their 'messenger' instances for us

  window.QueryInterface(Components.interfaces.nsIDOMChromeWindow)
        .browserDOMWindow = null;

  msgWindow.closeWindow();

  msgWindow.msgHeaderSink = null;
  msgWindow.notificationCallbacks = null;
  gDBView = null;
  window.MsgStatusFeedback.unload();
  Components.classes["@mozilla.org/activity-manager;1"]
            .getService(Components.interfaces.nsIActivityManager)
            .removeListener(window.MsgStatusFeedback);
}

function CreateMailWindowGlobals()
{
  // get the messenger instance
  messenger = Components.classes["@mozilla.org/messenger;1"]
                        .createInstance(Components.interfaces.nsIMessenger);

  window.addEventListener("blur", appIdleManager.onBlur, false);
  window.addEventListener("focus", appIdleManager.onFocus, false);

  //Create windows status feedback
  // set the JS implementation of status feedback before creating the c++ one..
  window.MsgStatusFeedback = new nsMsgStatusFeedback();
  // double register the status feedback object as the xul browser window implementation
  window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem).treeOwner
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIXULWindow)
        .XULBrowserWindow = window.MsgStatusFeedback;

  window.QueryInterface(Components.interfaces.nsIDOMChromeWindow)
        .browserDOMWindow = new nsBrowserAccess();

  statusFeedback = Components.classes["@mozilla.org/messenger/statusfeedback;1"]
                             .createInstance(Components.interfaces.nsIMsgStatusFeedback);
  statusFeedback.setWrappedStatusFeedback(window.MsgStatusFeedback);

  Components.classes["@mozilla.org/activity-manager;1"]
            .getService(Components.interfaces.nsIActivityManager)
            .addListener(window.MsgStatusFeedback);

  //Create message window object
  msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                        .createInstance(Components.interfaces.nsIMsgWindow);

  accountManager = MailServices.accounts;

  msgWindow.notificationCallbacks = new BadCertHandler();
}

function InitMsgWindow()
{
  msgWindow.windowCommands = new nsMsgWindowCommands();
  // set the domWindow before setting the status feedback and header sink objects
  msgWindow.domWindow = window;
  msgWindow.statusFeedback = statusFeedback;
  msgWindow.msgHeaderSink = messageHeaderSink;
  MailServices.mailSession.AddMsgWindow(msgWindow);
  let messagepane = document.getElementById("messagepane");
  messagepane.docShell.allowAuth = false;
  messagepane.docShell.allowDNSPrefetch = false;
  msgWindow.rootDocShell.allowAuth = true;
  msgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;
  // Ensure we don't load xul error pages into the main window
  msgWindow.rootDocShell.useErrorPages = false;

  GlodaWebSearch.onLoad();
}

// We're going to implement our status feedback for the mail window in JS now.
// the following contains the implementation of our status feedback object

function nsMsgStatusFeedback()
{
  this._statusText = document.getElementById("statusText");
  this._progressBar = document.getElementById("statusbar-icon");
  this._progressBarContainer = document.getElementById("statusbar-progresspanel");
  this._throbber = document.getElementById("throbber-box");
  this._activeProcesses = new Array();

  // make sure the stop button is accurate from the get-go
  goUpdateCommand("cmd_stop");
}

nsMsgStatusFeedback.prototype =
{
  // Document elements.
  _statusText: null,
  _progressBar: null,
  _progressBarContainer: null,
  _throbber: null,

  // Member variables.
  _startTimeoutID: null,
  _stopTimeoutID: null,
  // How many start meteors have been requested.
  _startRequests: 0,
  _meteorsSpinning: false,
  _defaultStatusText: null,
  _progressBarVisible: false,
  _activeProcesses: null,
  _statusFeedbackProgress: -1,

  // unload - call to remove links to listeners etc.
  unload: function () {
    // Remove listeners for any active processes we have hooked ourselves into.
    this._activeProcesses.forEach(function (element) {
        element.removeListener(this);
      }, this);
  },

  // nsIXULBrowserWindow implementation.
  setJSStatus: function(status) {
    if (status.length > 0)
      this.showStatusString(status);
  },

  setOverLink: function(link, context) {
    this._statusText.label = link;
  },

  // Called before links are navigated to to allow us to retarget them if needed.
  onBeforeLinkTraversal: function(originalTarget, linkURI, linkNode, isAppTab) {
    return originalTarget;
  },

  QueryInterface: function(iid) {
    if (iid.equals(Components.interfaces.nsIMsgStatusFeedback) ||
        iid.equals(Components.interfaces.nsIXULBrowserWindow) ||
        iid.equals(Components.interfaces.nsIActivityMgrListener) ||
        iid.equals(Components.interfaces.nsIActivityListener) ||
        iid.equals(Components.interfaces.nsISupportsWeakReference) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  // nsIMsgStatusFeedback implementation.
  showStatusString: function(statusText) {
    if (!statusText)
      statusText = this._defaultStatusText;
    else
      this._defaultStatusText = "";
    this._statusText.label = statusText;
  },

  setStatusString: function(status) {
    if (status.length > 0) {
      this._defaultStatusText = status;
      this._statusText.label = status;
    }
  },

  _startMeteors: function() {
    this._meteorsSpinning = true;
    this._startTimeoutID = null;

    // Turn progress meter on.
    this.updateProgress();

    // Start the throbber.
    if (this._throbber)
      this._throbber.setAttribute("busy", true);

    // Update the stop button
    goUpdateCommand("cmd_stop");
  },

  startMeteors: function() {
    this._startRequests++;
    // If we don't already have a start meteor timeout pending
    // and the meteors aren't spinning, then kick off a start.
    if (!this._startTimeoutID && !this._meteorsSpinning &&
        "MsgStatusFeedback" in window)
      this._startTimeoutID =
        setTimeout('window.MsgStatusFeedback._startMeteors();', 500);

    // Since we are going to start up the throbber no sense in processing
    // a stop timeout...
    if (this._stopTimeoutID) {
      clearTimeout(this._stopTimeoutID);
      this._stopTimeoutID = null;
    }
  },

  _stopMeteors: function() {
    this.showStatusString(this._defaultStatusText);

    // stop the throbber
    if (this._throbber)
      this._throbber.setAttribute("busy", false);

    this._meteorsSpinning = false;
    this._stopTimeoutID = null;

    // Turn progress meter off.
    this._statusFeedbackProgress = -1;
    this.updateProgress();

    // Update the stop button
    goUpdateCommand("cmd_stop");
  },

  stopMeteors: function() {
    if (this._startRequests > 0)
      this._startRequests--;

    // If we are going to be starting the meteors, cancel the start.
    if (this._startRequests == 0 && this._startTimeoutID) {
      clearTimeout(this._startTimeoutID);
      this._startTimeoutID = null;
    }

    // If we have no more pending starts and we don't have a stop timeout
    // already in progress AND the meteors are currently running then fire a
    // stop timeout to shut them down.
    if (this._startRequests == 0 && !this._stopTimeoutID &&
        this._meteorsSpinning && "MsgStatusFeedback" in window) {
      this._stopTimeoutID =
        setTimeout('window.MsgStatusFeedback._stopMeteors();', 500);
    }
  },

  showProgress: function(percentage) {
    this._statusFeedbackProgress = percentage;
    this.updateProgress();
  },

  updateProgress: function() {
    if (this._meteorsSpinning) {
      // In this function, we expect that the maximum for each progress is 100,
      // i.e. we are dealing with percentages. Hence we can combine several
      // processes running at the same time.
      let currentProgress = 0;
      let progressCount = 0;

      // For each activity that is in progress, get its status.

      this._activeProcesses.forEach(function (element) {
          if (element.state ==
              Components.interfaces.nsIActivityProcess.STATE_INPROGRESS &&
              element.percentComplete != -1) {
            currentProgress += element.percentComplete;
            ++progressCount;
          }
        });

      // Add the generic progress that's fed to the status feedback object if
      // we've got one.
      if (this._statusFeedbackProgress != -1) {
        currentProgress += this._statusFeedbackProgress;
        ++progressCount;
      }

      let percentage = 0;
      if (progressCount) {
        percentage = currentProgress / progressCount;
      }

      if (!percentage)
        this._progressBar.setAttribute("mode", "undetermined");
      else {
        this._progressBar.setAttribute("mode", "determined");
        this._progressBar.value = percentage;
        this._progressBar.label = Math.round(percentage) + "%";
      }
      if (!this._progressBarVisible) {
        this._progressBarContainer.removeAttribute('collapsed');
        this._progressBarVisible = true;
      }
    }
    else {
      // Stop the bar spinning as we're not doing anything now.
      this._progressBar.setAttribute("mode", "determined");
      this._progressBar.value = 0;
      this._progressBar.label = "";

      if (this._progressBarVisible) {
        this._progressBarContainer.collapsed = true;
        this._progressBarVisible = false;
      }
    }
  },

  // nsIActivityMgrListener
  onAddedActivity: function(aID, aActivity) {
    // ignore Gloda activity for status bar purposes
    if (aActivity.initiator == Gloda)
      return;
    if (aActivity instanceof Components.interfaces.nsIActivityEvent) {
      this.showStatusString(aActivity.displayText);
    }
    else if (aActivity instanceof Components.interfaces.nsIActivityProcess) {
      this._activeProcesses.push(aActivity);
      aActivity.addListener(this);
      this.startMeteors();
    }
  },

  onRemovedActivity: function(aID) {
    this._activeProcesses =
      this._activeProcesses.filter(function (element) {
        if (element.id == aID) {
          element.removeListener(this);
          this.stopMeteors();
          return false;
        }
        return true;
      }, this);
  },

  // nsIActivityListener
  onStateChanged: function(aActivity, aOldState) {
  },

  onProgressChanged: function(aActivity, aStatusText, aWorkUnitsCompleted,
                              aTotalWorkUnits) {
    let index = this._activeProcesses.indexOf(aActivity);

    // Iterate through the list trying to find the first active process, but
    // only go as far as our process.
    for (var i = 0; i < index; ++i) {
      if (this._activeProcesses[i].status ==
          Components.interfaces.nsIActivityProcess.STATE_INPROGRESS)
        break;
    }

    // If the found activity was the same as our activity, update the status
    // text.
    if (i == index)
      // Use the display text if we haven't got any status text. I'm assuming
      // that the status text will be generally what we want to see on the
      // status bar.
      this.showStatusString(aStatusText ? aStatusText : aActivity.displayText);

    this.updateProgress();
  },

  onHandlerChanged: function(aActivity) {
  }
}


function nsMsgWindowCommands()
{
}

nsMsgWindowCommands.prototype =
{
  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIMsgWindowCommands) ||
        iid.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  selectFolder: function(folderUri)
  {
    gFolderTreeView.selectFolder(MailUtils.getFolderForURI(folderUri));
  },

  selectMessage: function(messageUri)
  {
    let msgHdr = messenger.msgHdrFromURI(messageUri);
    gFolderDisplay.selectMessage(msgHdr);
  },

  clearMsgPane: function()
  {
    // This call happens as part of a display decision made by the nsMsgDBView
    //  instance.  Strictly speaking, we don't want this.  I think davida's
    //  patch will change this, so we can figure it out after that lands if
    //  there are issues.
    ClearMessagePane();
  }
}

/**
 * Loads the mail start page.
 */
function loadStartPage(aForce)
{
  // If the preference isn't enabled, then don't load anything.
  if (!aForce &&
      !Application.prefs.getValue("mailnews.start_page.enabled", false))
    return;

  gMessageNotificationBar.clearMsgNotifications();
  let startpage = Services.urlFormatter.formatURLPref("mailnews.start_page.url");
  if (startpage)
  {
    try {
      let uri = Services.uriFixup.createFixupURI(startpage, 0);
      GetMessagePaneFrame().location.href = uri.spec;
    }
    catch (e) {
      Components.utils.reportError(e);
    }
  }
  else
  {
    GetMessagePaneFrame().location.href = "about:blank";
  }
}

// The zoom manager, view source and possibly some other functions still rely
// on the getBrowser function.
function getBrowser()
{
  let tabmail = document.getElementById('tabmail');
  return tabmail ? tabmail.getBrowserForSelectedTab() :
                   document.getElementById("messagepane");
}

/**
 * This function is global and expected by toolkit to get the notification box
 * for the browser for use with items like password manager.
 */
function getNotificationBox(aWindow) {
  var tabmail = document.getElementById("tabmail");
  var tabInfo = tabmail.tabInfo;

  for (var i = 0; i < tabInfo.length; ++i) {
    var browserFunc = tabInfo[i].mode.getBrowser ||
                      tabInfo[i].mode.tabType.getBrowser;
    if (browserFunc) {
      var possBrowser = browserFunc.call(tabInfo[i].mode.tabType, tabInfo[i]);
      if (possBrowser && possBrowser.contentWindow == aWindow && possBrowser.parentNode.tagName == "notificationbox")
        return possBrowser.parentNode;
    }
  }
  return null;
}

// Given the server, open the twisty and the set the selection
// on inbox of that server.
// prompt if offline.
function OpenInboxForServer(server)
{
  gFolderTreeView.selectFolder(GetInboxFolder(server));

  if (MailOfflineMgr.isOnline() || MailOfflineMgr.getNewMail()) {
    if (server.type != "imap")
      GetMessagesForInboxOnServer(server);
  }
}

/** Update state of zoom type (text vs. full) menu item. */
function UpdateFullZoomMenu() {
  var menuItem = document.getElementById("menu_fullZoomToggle");
  menuItem.setAttribute("checked", !ZoomManager.useFullZoom);
}

/**
 * This class implements nsIBadCertListener2.  Its job is to prevent "bad cert"
 * security dialogs from being shown to the user.  Currently it puts up the
 * cert override dialog, though we'd like to give the user more detailed
 * information in the future.
 */
function BadCertHandler() {
}

BadCertHandler.prototype = {
  // Suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    if (!status)
      return true;

    setTimeout(InformUserOfCertError, 0, socketInfo, targetSite);
    return true;
  },

  // nsIInterfaceRequestor
  getInterface: function(iid) {
    return this.QueryInterface(iid);
  },

  // nsISupports
  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2) &&
      !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
      !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

function InformUserOfCertError(socketInfo, targetSite)
{
  var params = { exceptionAdded : false };
  params.prefetchCert = true;
  params.location = targetSite;
  window.openDialog('chrome://pippki/content/exceptionDialog.xul',
                  '','chrome,centerscreen,modal', params);
}

/**
 * Content area tooltip.
 * XXX see bug 480356 - this must move into XBL binding/equiv!
 **/
function FillInHTMLTooltip(tipElement)
{
  const XLinkNS = "http://www.w3.org/1999/xlink";
  const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

  var retVal = false;
  if (tipElement.namespaceURI == XULNS &&
      tipElement.ownerDocument.documentElement.nameSpaceURI == XULNS)
    return retVal;

  var titleText = null;
  var XLinkTitleText = null;
  var tooltipText = null;
  var direction = tipElement.ownerDocument.dir;

  while (!titleText && !XLinkTitleText && !tooltipText && tipElement) {
    if (tipElement.nodeType == Node.ELEMENT_NODE) {
      titleText = tipElement.getAttribute("title");
      XLinkTitleText = tipElement.getAttributeNS(XLinkNS, "title");
      if (tipElement.namespaceURI == XULNS) // only XUL nodes can get tooltiptext
        tooltipText = tipElement.getAttribute("tooltiptext");
      var defView = tipElement.ownerDocument.defaultView;
      // XXX Work around bug 350679:
      // "Tooltips can be fired in documents with no view".
      if (!defView)
        return retVal;
      direction = defView.getComputedStyle(tipElement, "")
        .getPropertyValue("direction");
    }
    tipElement = tipElement.parentNode;
  }

  var tipNode = document.getElementById("aHTMLTooltip");
  tipNode.style.direction = direction;

  /* tooltiptext has the highest priority but is only non-null for XUL nodes. */
  for each (var t in [titleText, XLinkTitleText, tooltipText]) {
    if (t && /\S/.test(t)) {

      // Per HTML 4.01 6.2 (CDATA section), literal CRs and tabs should be
      // replaced with spaces, and LFs should be removed entirely.
      // XXX Bug 322270: We don't preserve the result of entities like &#13;,
      // which should result in a line break in the tooltip, because we can't
      // distinguish that from a literal character in the source by this point.
      t = t.replace(/[\r\t]/g, ' ');
      t = t.replace(/\n/g, '');

      tipNode.setAttribute("label", t);
      retVal = true;
    }
  }
  return retVal;
}

function nsBrowserAccess() { }

nsBrowserAccess.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIBrowserDOMWindow]),

  openURI: function (aURI, aOpener, aWhere, aContext) {
    const nsIBrowserDOMWindow = Components.interfaces.nsIBrowserDOMWindow;
    let isExternal = aContext == nsIBrowserDOMWindow.OPEN_EXTERNAL;

    if (isExternal && aURI && aURI.schemeIs("chrome")) {
      Application.console.log("use -chrome command-line option to load external chrome urls\n");
      return null;
    }

    let newWindow = null;
    let loadflags = isExternal ?
      Components.interfaces.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL :
      Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE;

    if (aWhere != nsIBrowserDOMWindow.OPEN_NEWTAB)
      Application.console.log("Opening a URI in something other than a new tab is not supported, opening in new tab instead");

    let win, needToFocusWin;

    // Try the current window. If we're in a popup, fall back on the most
    // recent browser window.
    if (!window.document.documentElement.getAttribute("chromehidden"))
      win = window;
    else {
      win = getMostRecentMailWindow();
      needToFocusWin = true;
    }

    if (!win)
      throw("Couldn't get a suitable window for openURI");

    let loadInBackground =
      Application.prefs.getValue("browser.tabs.loadDivertedInBackground", false);

    let tabmail = win.document.getElementById("tabmail");
    let clickHandler = null;
    let browser = tabmail.getBrowserForDocument(content);
    if (browser)
      clickHandler = browser.clickHandler;

    let newTab = tabmail.openTab("contentTab", {contentPage: "about:blank",
                                                background: loadInBackground,
                                                clickHandler: clickHandler});

    newWindow = newTab.browser.docShell
                      .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                      .getInterface(Components.interfaces.nsIDOMWindow);
    try {
      if (aURI) {
        if (aOpener) {
          let location = aOpener.location;
          let referrer = Services.io.newURI(location, null, null);
        }
        newWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                 .getInterface(Components.interfaces.nsIWebNavigation)
                 .loadURI(aURI.spec, loadflags, referrer, null, null);
      }
      if (needToFocusWin || (!loadInBackground && isExternal))
        newWindow.focus();
    } catch(e) {
    }
    return newWindow;
  },

  isTabContentWindow: function (aWindow) {
    return false;
  }
};
