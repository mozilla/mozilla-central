/** ***** BEGIN LICENSE BLOCK *****
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
 *   Håkan Waara <hwaara@gmail.com>
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

Components.utils.import("resource://app/modules/appIdleManager.js");

//This file stores variables common to mail windows
var messenger;
var pref;
var statusFeedback;
var msgWindow;

var msgComposeService;
var accountManager;

var gMessengerBundle;
var gBrandBundle;

Components.utils.import("resource://app/modules/gloda/log4moz.js");

var gContextMenu;
var gMailWindowLog = Log4Moz.getConfiguredLogger("mailWindow", Log4Moz.Level.Debug, Log4Moz.Level.Debug, Log4Moz.Level.Debug);

/**
 * Indicate whether we are running on Mac OS X.  Our code is currently littered
 *  with #ifdef/#ifndef XP_MACOSX's that do not need to exist in js code.  Use
 *  of preprocessing makes error line numbers misleading, complicates
 *  development because preprocessed files can't be symlinked when using
 *  --enable-chrome-format=symlink, etc.
 */
var gPlatformOSX =
  (window.navigator.oscpu.substring(0, 3).toLowerCase() == "mac");

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

  var mailSession = Components.classes["@mozilla.org/messenger/services/session;1"]
                              .getService(Components.interfaces.nsIMsgMailSession);
  mailSession.RemoveMsgWindow(msgWindow);
  // the tabs have the FolderDisplayWidget close their 'messenger' instances for us

  msgWindow.closeWindow();

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

  pref = Components.classes["@mozilla.org/preferences-service;1"]
          .getService(Components.interfaces.nsIPrefBranch2);

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

  statusFeedback = Components.classes["@mozilla.org/messenger/statusfeedback;1"]
                             .createInstance(Components.interfaces.nsIMsgStatusFeedback);
  statusFeedback.setWrappedStatusFeedback(window.MsgStatusFeedback);

  Components.classes["@mozilla.org/activity-manager;1"]
            .getService(Components.interfaces.nsIActivityManager)
            .addListener(window.MsgStatusFeedback);

  //Create message window object
  msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                        .createInstance(Components.interfaces.nsIMsgWindow);

  msgComposeService = Components.classes['@mozilla.org/messengercompose;1']
                                .getService(Components.interfaces.nsIMsgComposeService);

  accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);

  gMessengerBundle = document.getElementById("bundle_messenger");
  gBrandBundle = document.getElementById("bundle_brand");

  msgWindow.notificationCallbacks = new BadCertHandler();
}

function InitMsgWindow()
{
  msgWindow.windowCommands = new nsMsgWindowCommands();
  // set the domWindow before setting the status feedback and header sink objects
  msgWindow.domWindow = window;
  msgWindow.statusFeedback = statusFeedback;
  msgWindow.msgHeaderSink = messageHeaderSink;
  Components.classes["@mozilla.org/messenger/services/session;1"]
            .getService(Components.interfaces.nsIMsgMailSession)
            .AddMsgWindow(msgWindow);
  document.getElementById("messagepane").docShell.allowAuth = false;
  msgWindow.rootDocShell.allowAuth = true;
  msgWindow.rootDocShell.appType = Components.interfaces.nsIDocShell.APP_TYPE_MAIL;
  // Ensure we don't load xul error pages into the main window
  msgWindow.rootDocShell.useErrorPages = false;
}

// We're going to implement our status feedback for the mail window in JS now.
// the following contains the implementation of our status feedback object

function nsMsgStatusFeedback()
{
  this._statusText = document.getElementById("statusText");
  this._progressBar = document.getElementById("statusbar-icon");
  this._progressBarContainer = document.getElementById("statusbar-progresspanel");
  this._throbber = document.getElementById("navigator-throbber");
  this._stopCmd = document.getElementById("cmd_stop");
  this._activeProcesses = new Array();
}

nsMsgStatusFeedback.prototype =
{
  // Document elements.
  _statusText: null,
  _progressBar: null,
  _progressBarContainer: null,
  _throbber: null,
  _stopCmd: null,

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

  setJSDefaultStatus: function(status) {
    if (status.length > 0) {
      this._defaultStatusText = status;
      this._statusText.label = status;
    }
  },

  setOverLink: function(link, context) {
    this._statusText.label = link;
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

  _startMeteors: function() {
    this._meteorsSpinning = true;
    this._startTimeoutID = null;

    // Turn progress meter on.
    this.updateProgress();

    // Start the throbber.
    if (this._throbber)
      this._throbber.setAttribute("busy", true);

    // Turn on stop button and menu.
    if (this._stopCmd)
      this._stopCmd.removeAttribute("disabled");
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
    this.showStatusString(defaultStatus);

    // stop the throbber
    if (this._throbber)
      this._throbber.setAttribute("busy", false);

    if (this._stopCmd)
      this._stopCmd.setAttribute("disabled", "true");

    this._meteorsSpinning = false;
    this._stopTimeoutID = null;

    // Turn progress meter off.
    this._statusFeedbackProgress = -1;
    this.updateProgress();
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
    gFolderTreeView.selectFolder(GetMsgFolderFromUri(folderUri));
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
 * @returns the pref name to use for fetching the start page url. Every time the application version changes,
 * return "mailnews.start_page.override_url". If this is the first time the application has been
 * launched, return "mailnews.start_page.welcome_url". Otherwise return "mailnews.start_page.url".
 */
function startPageUrlPref()
{
  var prefForStartPageUrl = "mailnews.start_page.url";
  var savedVersion = null;
  try {
    savedVersion = pref.getCharPref("mailnews.start_page_override.mstone");
  } catch (ex) {}

  if (!savedVersion && savedVersion != "ignore")
    prefForStartPageUrl = "mailnews.start_page.welcome_url";

  return prefForStartPageUrl;
}

/**
 * Loads the mail start page.
 */
function loadStartPage()
{
  gMessageNotificationBar.clearMsgNotifications();
  let startpage = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                            .getService(Components.interfaces.nsIURLFormatter)
                            .formatURLPref(startPageUrlPref());
  if (startpage)
  {
    try {
      let urifixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                               .getService(Components.interfaces.nsIURIFixup);

      let uri = urifixup.createFixupURI(startpage, 0);
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
  var retVal = false;
  if (tipElement.namespaceURI == "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul")
    return retVal;

  const XLinkNS = "http://www.w3.org/1999/xlink";

  var titleText = null;
  var XLinkTitleText = null;
  var direction = tipElement.ownerDocument.dir;

  while (!titleText && !XLinkTitleText && tipElement) {
    if (tipElement.nodeType == Node.ELEMENT_NODE) {
      titleText = tipElement.getAttribute("title");
      XLinkTitleText = tipElement.getAttributeNS(XLinkNS, "title");
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

  for each (var t in [titleText, XLinkTitleText]) {
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
