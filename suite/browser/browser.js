/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIWebNavigation = Components.interfaces.nsIWebNavigation;
var gPrintSettingsAreGlobal = true;
var gSavePrintSettings = true;
var gChromeState = null; // chrome state before we went into print preview
var gInPrintPreviewMode = false;
var gNavToolbox = null;

function getWebNavigation()
{
  try {
    return getBrowser().webNavigation;
  } catch (e) {
    return null;
  }
}

function BrowserReloadWithFlags(reloadFlags)
{
  /* First, we'll try to use the session history object to reload so 
   * that framesets are handled properly. If we're in a special 
   * window (such as view-source) that has no session history, fall 
   * back on using the web navigation's reload method.
   */

  var webNav = getWebNavigation();
  try {
    var sh = webNav.sessionHistory;
    if (sh)
      webNav = sh.QueryInterface(Components.interfaces.nsIWebNavigation);
  } catch (e) {
  }

  try {
    webNav.reload(reloadFlags);
  } catch (e) {
  }
}

function toggleAffectedChrome(aHide)
{
  // chrome to toggle includes:
  //   (*) menubar
  //   (*) navigation bar
  //   (*) personal toolbar
  //   (*) tab browser ``strip''
  //   (*) sidebar
  //   (*) statusbar
  //   (*) findbar

  if (!gChromeState)
    gChromeState = new Object;

  var statusbar = document.getElementById("status-bar");
  getNavToolbox().hidden = aHide; 
  var notificationBox = gBrowser.getNotificationBox();
  var findbar = document.getElementById("FindToolbar")

  // sidebar states map as follows:
  //   hidden    => hide/show nothing
  //   collapsed => hide/show only the splitter
  //   shown     => hide/show the splitter and the box
  if (aHide)
  {
    // going into print preview mode
    gChromeState.sidebar = SidebarGetState();
    SidebarSetState("hidden");

    // deal with tab browser
    gBrowser.mStrip.setAttribute("moz-collapsed", "true");

    // deal with the Status Bar
    gChromeState.statusbarWasHidden = statusbar.hidden;
    statusbar.hidden = true;

    // deal with the notification box
    gChromeState.notificationsWereHidden = notificationBox.notificationsHidden;
    notificationBox.notificationsHidden = true;

    if (findbar)
    {
      gChromeState.findbarWasHidden = findbar.hidden;
      findbar.close();
    }
    else
    {
      gChromeState.findbarWasHidden = true;
    }

    gChromeState.syncNotificationsOpen = false;
    var syncNotifications = document.getElementById("sync-notifications");
    if (syncNotifications)
    {
      gChromeState.syncNotificationsOpen = !syncNotifications.notificationsHidden;
      syncNotifications.notificationsHidden = true;
    }
  }
  else
  {
    // restoring normal mode (i.e., leaving print preview mode)
    SidebarSetState(gChromeState.sidebar);

    // restore tab browser
    gBrowser.mStrip.removeAttribute("moz-collapsed");

    // restore the Status Bar
    statusbar.hidden = gChromeState.statusbarWasHidden;

    // restore the notification box
    notificationBox.notificationsHidden = gChromeState.notificationsWereHidden;

    if (!gChromeState.findbarWasHidden)
      findbar.open();

    if (gChromeState.syncNotificationsOpen)
      document.getElementById("sync-notifications").notificationsHidden = false;
  }

  // if we are unhiding and sidebar used to be there rebuild it
  if (!aHide && gChromeState.sidebar == "visible")
    SidebarRebuild();
}

var PrintPreviewListener = {
  _printPreviewTab: null,
  _tabBeforePrintPreview: null,

  getPrintPreviewBrowser: function () {
    if (!this._printPreviewTab) {
      this._tabBeforePrintPreview = getBrowser().selectedTab;
      this._printPreviewTab = getBrowser().addTab("about:blank");
      getBrowser().selectedTab = this._printPreviewTab;
    }
    return getBrowser().getBrowserForTab(this._printPreviewTab);
  },
  getSourceBrowser: function () {
    return this._tabBeforePrintPreview ?
      getBrowser().getBrowserForTab(this._tabBeforePrintPreview) :
      getBrowser().selectedBrowser;
  },
  getNavToolbox: function () {
    return window.getNavToolbox();
  },
  onEnter: function () {
    gInPrintPreviewMode = true;
    toggleAffectedChrome(true);
  },
  onExit: function () {
    getBrowser().selectedTab = this._tabBeforePrintPreview;
    this._tabBeforePrintPreview = null;
    gInPrintPreviewMode = false;
    toggleAffectedChrome(false);
    getBrowser().removeTab(this._printPreviewTab, { disableUndo: true });
    this._printPreviewTab = null;
  }
};

function getNavToolbox()
{
  if (!gNavToolbox)
    gNavToolbox = document.getElementById("navigator-toolbox");
  return gNavToolbox;
}

function BrowserPrintPreview()
{
  PrintUtils.printPreview(PrintPreviewListener);
}

function BrowserSetDefaultCharacterSet(aCharset)
{
  // no longer needed; set when setting Force; see bug 79608
}

function BrowserSetForcedCharacterSet(aCharset)
{
  getBrowser().docShell.charset = aCharset;
  BrowserCharsetReload();
}

function BrowserCharsetReload()
{
  BrowserReloadWithFlags(nsIWebNavigation.LOAD_FLAGS_CHARSET_CHANGE);
}

var gFindInstData;
function getFindInstData()
{
  if (!gFindInstData) {
    gFindInstData = new nsFindInstData();
    gFindInstData.browser = getBrowser();
    // defaults for rootSearchWindow and currentSearchWindow are fine here
  }
  return gFindInstData;
}

function BrowserFind()
{
  findInPage(getFindInstData());
}

function BrowserFindAgain(reverse)
{
  findAgainInPage(getFindInstData(), reverse);
}

function BrowserCanFindAgain()
{
  return canFindAgainInPage();
}

function getMarkupDocumentViewer()
{
  return getBrowser().markupDocumentViewer;
}
