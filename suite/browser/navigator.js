/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com>
 *   Peter Annema <disttsc@bart.nl>
 *   Dean Tessman <dean_tessman@hotmail.com>
 *   Nils Maier <maierman@web.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

__defineGetter__("PluralForm", function() {
  Components.utils.import("resource://gre/modules/PluralForm.jsm");
  return this.PluralForm;
});
__defineSetter__("PluralForm", function (val) {
  delete this.PluralForm;
  return this.PluralForm = val;
});

const REMOTESERVICE_CONTRACTID = "@mozilla.org/toolkit/remote-service;1";
const XUL_NAMESPACE = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var gURLBar = null;
var gProxyButton = null;
var gProxyFavIcon = null;
var gProxyDeck = null;
var gNavigatorBundle;
var gBrandBundle;
var gNavigatorRegionBundle;
var gLastValidURLStr = "";
var gLastValidURL = null;
var gClickSelectsAll = false;
var gClickAtEndSelects = false;
var gIgnoreFocus = false;
var gIgnoreClick = false;
var gURIFixup = null;
var gThemes = [];

var gInitialPages = [
  "about:blank",
  "about:sessionrestore"
];

//cached elements
var gBrowser = null;

function ReloadThemes()
{
  AddonManager.getAddonsByTypes(["theme"], function(themes) {
    gThemes = themes.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });
  });
}

const gAddonListener = {
  onEnabling: function(val) {},
  onEnabled: function(val) {},
  onDisabling: function(val) {},
  onDisabled: function(val) {},
  onInstalling: function(val) {},
  onInstalled: ReloadThemes,
  onUninstalling: function(val) {},
  onUninstalled: ReloadThemes,
  onOperationCancelled: ReloadThemes
};

const gTabStripPrefListener =
{
  domain: "browser.tabs.autoHide",
  observe: function(subject, topic, prefName)
  {
    // verify that we're changing the tab browser strip auto hide pref
    if (topic != "nsPref:changed")
      return;

    if (gBrowser.tabContainer.childNodes.length == 1 && window.toolbar.visible) {
      var stripVisibility = !Services.prefs.getBoolPref(prefName);
      gBrowser.setStripVisibilityTo(stripVisibility);
      Services.prefs.setBoolPref("browser.tabs.forceHide", false);
    }
  }
};

const gHomepagePrefListener =
{
  domain: "browser.startup.homepage",
  observe: function(subject, topic, prefName)
  {
    // verify that we're changing the home page pref
    if (topic != "nsPref:changed")
      return;

    updateHomeButtonTooltip();
  }
};

const gStatusBarPopupIconPrefListener =
{
  domain: "privacy.popups.statusbar_icon_enabled",
  observe: function(subject, topic, prefName)
  {
    if (topic != "nsPref:changed" || prefName != this.domain)
      return;

    var popupIcon = document.getElementById("popupIcon");
    if (!Services.prefs.getBoolPref(prefName))
      popupIcon.hidden = true;

    else if (gBrowser.getNotificationBox().popupCount)
      popupIcon.hidden = false;
  }
};

// popup window permission change listener
const gPopupPermListener = {

  observe: function(subject, topic, data) {
    if (topic == "popup-perm-close") {
      // close the window if we're a popup and our opener's URI matches
      // the URI in the notification
      var popupOpenerURI = maybeInitPopupContext();
      if (popupOpenerURI) {
        closeURI = Services.io.newURI(data, null, null);
        if (closeURI.host == popupOpenerURI.host)
          window.close();
      }
    }
  }
};

const gFormSubmitObserver = {
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIFormSubmitObserver,
                                         Components.interfaces.nsIObserver]),

  panel: null,

  init: function()
  {
    this.panel = document.getElementById("invalid-form-popup");
  },

  panelIsOpen: function()
  {
    return this.panel && this.panel.state != "hiding" &&
           this.panel.state != "closed";
  },

  notifyInvalidSubmit: function (aFormElement, aInvalidElements)
  {
    // We are going to handle invalid form submission attempt by focusing the
    // first invalid element and show the corresponding validation message in a
    // panel attached to the element.
    if (!aInvalidElements.length) {
      return;
    }

    // Don't show the popup if the current tab doesn't contain the invalid form.
    if (aFormElement.ownerDocument.defaultView.top != content) {
      return;
    }

    let element = aInvalidElements.queryElementAt(0, Components.interfaces.nsISupports);

    if (!(element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLButtonElement)) {
      return;
    }

    this.panel.firstChild.textContent = element.validationMessage;

    element.focus();

    // If the user type something or blurs the element, we want to remove the popup.
    // We could check for clicks but a click already removes the popup.
    function eventHandler() {
      gFormSubmitObserver.panel.hidePopup();
    };
    element.addEventListener("input", eventHandler, false);
    element.addEventListener("blur", eventHandler, false);

    // One event to bring them all and in the darkness bind them.
    this.panel.addEventListener("popuphiding", function popupHidingHandler(aEvent) {
      aEvent.target.removeEventListener("popuphiding", popupHidingHandler, false);
      element.removeEventListener("input", eventHandler, false);
      element.removeEventListener("blur", eventHandler, false);
    }, false);

    this.panel.hidden = false;
    this.panel.openPopup(element, "after_start", 0, 0);
  }
};

/**
* Pref listener handler functions.
* Both functions assume that observer.domain is set to 
* the pref domain we want to start/stop listening to.
*/
function addPrefListener(observer)
{
  try {
    Services.prefs.addObserver(observer.domain, observer, false);
  } catch(ex) {
    dump("Failed to observe prefs: " + ex + "\n");
  }
}

function removePrefListener(observer)
{
  try {
    Services.prefs.removeObserver(observer.domain, observer);
  } catch(ex) {
    dump("Failed to remove pref observer: " + ex + "\n");
  }
}

function addPopupPermListener(observer)
{
  Services.obs.addObserver(observer, "popup-perm-close", false);
}

function removePopupPermListener(observer)
{
  Services.obs.removeObserver(observer, "popup-perm-close");
}

function addFormSubmitObserver(observer)
{
  observer.init();
  Services.obs.addObserver(observer, "invalidformsubmit", false);
}

function removeFormSubmitObserver(observer)
{
  Services.obs.removeObserver(observer, "invalidformsubmit", false);
}

/**
* We can avoid adding multiple load event listeners and save some time by adding
* one listener that calls all real handlers.
*/

function pageShowEventHandlers(event)
{
  // Filter out events that are not about the document load we are interested in
  if (event.originalTarget == content.document) {
    checkForDirectoryListing();
    postURLToNativeWidget();
  }
}

/**
 * Determine whether or not the content area is displaying a page with frames,
 * and if so, toggle the display of the 'save frame as' menu item.
 **/
function getContentAreaFrameCount()
{
  var saveFrameItem = document.getElementById("saveframe");
  if (!content || !content.frames.length || !isContentFrame(document.commandDispatcher.focusedWindow))
    saveFrameItem.setAttribute("hidden", "true");
  else {
    var autoDownload = Services.prefs.getBoolPref("browser.download.useDownloadDir");
    goSetMenuValue("saveframe", autoDownload ? "valueSave" : "valueSaveAs");
    saveFrameItem.removeAttribute("hidden");
  }
}

function saveFrameDocument()
{
  var focusedWindow = document.commandDispatcher.focusedWindow;
  if (isContentFrame(focusedWindow))
    saveDocument(focusedWindow.document, true);
}

function updateHomeButtonTooltip()
{
  var homePage = getHomePage();
  var tooltip = document.getElementById("home-button-tooltip-inner");

  while (tooltip.firstChild)
    tooltip.removeChild(tooltip.firstChild);

  for (var i in homePage) {
    var label = document.createElementNS(XUL_NAMESPACE, "label");
    label.setAttribute("value", homePage[i]);
    tooltip.appendChild(label);
  }
}

function getBrowser()
{
  if (!gBrowser)
    gBrowser = document.getElementById("content");
  return gBrowser;
}

function getHomePage()
{
  var URIs = [];
  try {
    URIs[0] = Services.prefs.getComplexValue("browser.startup.homepage",
                                             nsIPrefLocalizedString).data;
    var count = Services.prefs.getIntPref("browser.startup.homepage.count");
    for (var i = 1; i < count; ++i) {
      URIs[i] = Services.prefs.getComplexValue("browser.startup.homepage." + i,
                                               nsIPrefLocalizedString).data;
    }
  } catch(e) {
  }

  return URIs;
}

function UpdateBackForwardButtons()
{
  var backBroadcaster = document.getElementById("canGoBack");
  var forwardBroadcaster = document.getElementById("canGoForward");
  var upBroadcaster = document.getElementById("canGoUp");
  var browser = getBrowser();

  // Avoid setting attributes on broadcasters if the value hasn't changed!
  // Remember, guys, setting attributes on elements is expensive!  They
  // get inherited into anonymous content, broadcast to other widgets, etc.!
  // Don't do it if the value hasn't changed! - dwh

  var backDisabled = backBroadcaster.hasAttribute("disabled");
  var forwardDisabled = forwardBroadcaster.hasAttribute("disabled");
  var upDisabled = upBroadcaster.hasAttribute("disabled");
  if (backDisabled == browser.canGoBack) {
    if (backDisabled)
      backBroadcaster.removeAttribute("disabled");
    else
      backBroadcaster.setAttribute("disabled", true);
  }
  if (forwardDisabled == browser.canGoForward) {
    if (forwardDisabled)
      forwardBroadcaster.removeAttribute("disabled");
    else
      forwardBroadcaster.setAttribute("disabled", true);
  }
  if (upDisabled != !browser.currentURI.spec.replace(/[#?].*$/, "").match(/\/[^\/]+\/./)) {
    if (upDisabled)
      upBroadcaster.removeAttribute("disabled");
    else
      upBroadcaster.setAttribute("disabled", true);
  }
}

const nsIBrowserDOMWindow = Components.interfaces.nsIBrowserDOMWindow;
const nsIInterfaceRequestor = Components.interfaces.nsIInterfaceRequestor;

function nsBrowserAccess() {
}

nsBrowserAccess.prototype = {
  openURI: function openURI(aURI, aOpener, aWhere, aContext) {
    var isExternal = aContext == nsIBrowserDOMWindow.OPEN_EXTERNAL;
    if (aWhere == nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW)
      if (isExternal)
        aWhere = Services.prefs.getIntPref("browser.link.open_external");
      else
        aWhere = Services.prefs.getIntPref("browser.link.open_newwindow");
    var referrer = aOpener ? aOpener.QueryInterface(nsIInterfaceRequestor)
                                    .getInterface(nsIWebNavigation)
                                    .currentURI : null;
    var uri = aURI ? aURI.spec : "about:blank";
    switch (aWhere) {
      case nsIBrowserDOMWindow.OPEN_NEWWINDOW:
        return window.openDialog(getBrowserURL(), "_blank", "all,dialog=no",
                                 uri, null, referrer);
      case nsIBrowserDOMWindow.OPEN_NEWTAB:
        var bgLoad = Services.prefs.getBoolPref("browser.tabs.loadDivertedInBackground");
        var isRelated = referrer ? true : false;
        var newTab = gBrowser.loadOneTab(uri, {inBackground: bgLoad,
                                               fromExternal: isExternal,
                                               relatedToCurrent: isRelated,
                                               referrerURI: referrer});
        return gBrowser.getBrowserForTab(newTab).contentWindow;
      default:
        var loadflags = isExternal ?
                        nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL :
                        nsIWebNavigation.LOAD_FLAGS_NONE;

        if (!aOpener) {
          if (aURI)
            gBrowser.loadURIWithFlags(aURI.spec, loadflags);
          return content;
        }
        aOpener = aOpener.top;
        if (aURI) {
          try {
            aOpener.QueryInterface(nsIInterfaceRequestor)
                   .getInterface(nsIWebNavigation)
                   .loadURI(uri, loadflags, referrer, null, null);
          } catch (e) {}
        }
        return aOpener;
    }
  },
  isTabContentWindow: function isTabContentWindow(aWindow) {
    return gBrowser.browsers.some(function (browser) browser.contentWindow == aWindow);
  }
}

function HandleAppCommandEvent(aEvent)
{
  aEvent.stopPropagation();
  switch (aEvent.command) {
    case "Back":
      BrowserBack();
      break;
    case "Forward":
      BrowserForward();
      break;
    case "Reload":
      BrowserReloadSkipCache();
      break;
    case "Stop":
      BrowserStop();
      break;
    case "Search":
      BrowserSearch.webSearch();
      break;
    case "Bookmarks":
      toBookmarksManager();
      break;
    case "Home":
      BrowserHome(null);
      break;
    default:
      break;
  }
}

function Startup()
{
  AddonManager.addAddonListener(gAddonListener);
  ReloadThemes();

  // init globals
  gNavigatorBundle = document.getElementById("bundle_navigator");
  gBrandBundle = document.getElementById("bundle_brand");
  gNavigatorRegionBundle = document.getElementById("bundle_navigator_region");

  gBrowser = document.getElementById("content");
  gURLBar = document.getElementById("urlbar");
  
  SetPageProxyState("invalid", null);

  var webNavigation;
  try {
    webNavigation = getWebNavigation();
    if (!webNavigation)
      throw "no XBL binding for browser";
  } catch (e) {
    alert("Error launching browser window:" + e);
    window.close(); // Give up.
    return;
  }

  // Do all UI building here:
  UpdateNavBar();

  // set home button tooltip text
  updateHomeButtonTooltip();

  // initialize observers and listeners
  var xw = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                 .getInterface(Components.interfaces.nsIWebNavigation)
                 .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                 .treeOwner
                 .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                 .getInterface(Components.interfaces.nsIXULWindow);
  xw.XULBrowserWindow = window.XULBrowserWindow = new nsBrowserStatusHandler();

  if (Services.prefs.getBoolPref("browser.doorhanger.enabled")) {
    XPCOMUtils.defineLazyGetter(window, "PopupNotifications", function() {
      var tmp = {};
      Components.utils.import("resource://gre/modules/PopupNotifications.jsm", tmp);
      return XULBrowserWindow.popupNotifications = new tmp.PopupNotifications(
          getBrowser(),
          document.getElementById("notification-popup"),
          document.getElementById("notification-popup-box"));
    });
    gBrowser.setAttribute("popupnotification", "true");
    // This resets popup window scrollbar visibility, so override it.
    if (!(xw.chromeFlags & Components.interfaces.nsIWebBrowserChrome.CHROME_SCROLLBARS))
      gBrowser.selectedBrowser.style.overflow = "hidden";
  }

  addPrefListener(gTabStripPrefListener);
  addPrefListener(gHomepagePrefListener);
  addPrefListener(gStatusBarPopupIconPrefListener);
  addPopupPermListener(gPopupPermListener);
  addFormSubmitObserver(gFormSubmitObserver);

  window.browserContentListener =
    new nsBrowserContentListener(window, getBrowser());
  
  // Add a capturing event listener to the content area
  // (rjc note: not the entire window, otherwise we'll get sidebar pane loads too!)
  //  so we'll be notified when onloads complete.
  var contentArea = document.getElementById("appcontent");
  contentArea.addEventListener("pageshow", pageShowEventHandlers, true);

  // set default character set if provided
  if ("arguments" in window && window.arguments.length > 1 && window.arguments[1]) {
    if (window.arguments[1].indexOf("charset=") != -1) {
      var arrayArgComponents = window.arguments[1].split("=");
      if (arrayArgComponents) {
        //we should "inherit" the charset menu setting in a new window
        getMarkupDocumentViewer().defaultCharacterSet = arrayArgComponents[1];
      }
    }
  }

  //initConsoleListener();

  // Set a sane starting width/height for all resolutions on new profiles.
  if (!document.documentElement.hasAttribute("width")) {
    var defaultHeight = screen.availHeight;
    var defaultWidth= screen.availWidth;

    // Create a narrower window for large or wide-aspect displays, to suggest
    // side-by-side page view.
    if (screen.availWidth >= 1440)
      defaultWidth /= 2;

    // Tweak sizes to be sure we don't grow outside the screen
    defaultWidth = defaultWidth - 20;
    defaultHeight = defaultHeight - 10;

    // On X, we're not currently able to account for the size of the window
    // border.  Use 28px as a guess (titlebar + bottom window border)
    if (navigator.appVersion.indexOf("X11") != -1)
      defaultHeight -= 28;

    // On small screens, default to maximized state
    if (defaultHeight <= 600)
      document.documentElement.setAttribute("sizemode", "maximized");

    document.documentElement.setAttribute("width", defaultWidth);
    document.documentElement.setAttribute("height", defaultHeight);
    // Make sure we're safe at the left/top edge of screen
    document.documentElement.setAttribute("screenX", screen.availLeft);
    document.documentElement.setAttribute("screenY", screen.availTop);
  }

  // hook up UI through progress listener
  getBrowser().addProgressListener(window.XULBrowserWindow, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

  var uriToLoad = "";

  // Check window.arguments[0]. If not null then use it for uriArray
  // otherwise the new window is being called when another browser
  // window already exists so use the New Window pref for uriArray
  if ("arguments" in window && window.arguments.length >= 1) {
    var uriArray;
    if (window.arguments[0]) {
      uriArray = window.arguments[0].toString().split('\n'); // stringify and split
    } else {
      try {
        switch (Services.prefs.getIntPref("browser.windows.loadOnNewWindow"))
        {
          default:
            uriArray = ["about:blank"];
            break;
          case 1:
            uriArray = getHomePage();
            break;
          case 2:
            var history = Components.classes["@mozilla.org/browser/global-history;2"]
                                    .getService(Components.interfaces.nsIBrowserHistory);
            uriArray = [history.lastPageVisited];
            break;
        }
      } catch(e) {
        uriArray = ["about:blank"];
      }
    }
    uriToLoad = uriArray.splice(0, 1)[0];

    if (uriArray.length > 0)
      window.setTimeout(function(arg) { for (var i in arg) gBrowser.addTab(arg[i]); }, 0, uriArray);
  }
    
  if (/^\s*$/.test(uriToLoad))
    uriToLoad = "about:blank";

  var browser = getBrowser();

  if (uriToLoad != "about:blank") {
    gURLBar.value = uriToLoad;
    browser.userTypedValue = uriToLoad;
    if ("arguments" in window && window.arguments.length >= 4) {
      loadURI(uriToLoad, window.arguments[2], window.arguments[3]);
    } else if ("arguments" in window && window.arguments.length == 3) {
      loadURI(uriToLoad, window.arguments[2]);
    } else {
      loadURI(uriToLoad);
    }
  }

  // Focus the content area unless we're loading a blank page, or if
  // we weren't passed any arguments. This "breaks" the
  // javascript:window.open(); case where we don't get any arguments
  // either, but we're loading about:blank, but focusing the content
  // are is arguably correct in that case as well since the opener
  // is very likely to put some content in the new window, and then
  // the focus should be in the content area.
  var navBar = document.getElementById("nav-bar");
  if ("arguments" in window && uriToLoad == "about:blank" && isElementVisible(gURLBar))
    setTimeout(WindowFocusTimerCallback, 0, gURLBar);
  else
    setTimeout(WindowFocusTimerCallback, 0, content);

  // Perform default browser checking (after window opens).
  setTimeout(checkForDefaultBrowser, 0);

  // hook up browser access support
  window.browserDOMWindow = new nsBrowserAccess();

  // hook up remote support
  if (REMOTESERVICE_CONTRACTID in Components.classes) {
    var remoteService =
      Components.classes[REMOTESERVICE_CONTRACTID]
                .getService(Components.interfaces.nsIRemoteService);
    remoteService.registerWindow(window);
  }

  // ensure login manager is loaded
  Components.classes["@mozilla.org/login-manager;1"].getService();
  
  // called when we go into full screen, even if it is 
  // initiated by a web page script
  addEventListener("fullscreen", onFullScreen, true);

  addEventListener("PopupCountChanged", UpdateStatusBarPopupIcon, true);

  addEventListener("AppCommand", HandleAppCommandEvent, true);

  // does clicking on the urlbar select its contents?
  gClickSelectsAll = Services.prefs.getBoolPref("browser.urlbar.clickSelectsAll");
  gClickAtEndSelects = Services.prefs.getBoolPref("browser.urlbar.clickAtEndSelects");

  // BiDi UI
  gShowBiDi = isBidiEnabled();
  if (gShowBiDi) {
    document.getElementById("documentDirection-swap").hidden = false;
    document.getElementById("textfieldDirection-separator").hidden = false;
    document.getElementById("textfieldDirection-swap").hidden = false;
  }

  // Before and after callbacks for the customizeToolbar code
  getNavToolbox().customizeInit = BrowserToolboxCustomizeInit;
  getNavToolbox().customizeDone = BrowserToolboxCustomizeDone;
  getNavToolbox().customizeChange = BrowserToolboxCustomizeChange;

  PlacesStarButton.init();

  PlacesToolbarHelper.init();

  // bookmark-all-tabs command
  gBookmarkAllTabsHandler.init();

  gBrowser.mPanelContainer.addEventListener("InstallBrowserTheme", LightWeightThemeWebInstaller, false, true);
  gBrowser.mPanelContainer.addEventListener("PreviewBrowserTheme", LightWeightThemeWebInstaller, false, true);
  gBrowser.mPanelContainer.addEventListener("ResetBrowserThemePreview", LightWeightThemeWebInstaller, false, true);

  // initialize the session-restore service
  setTimeout(InitSessionStoreCallback, 0);
}

function UpdateNavBar()
{
  var elements = getNavToolbox().getElementsByClassName("nav-bar-class");
  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    element.classList.remove("nav-bar-last");
    element.classList.remove("nav-bar-first");
    var next = element.nextSibling;
    if (!next || !next.classList.contains("nav-bar-class"))
      element.classList.add("nav-bar-last");
    var previous = element.previousSibling;
    if (!previous || !previous.classList.contains("nav-bar-class"))
      element.classList.add("nav-bar-first");
  }
}

function InitSessionStoreCallback()
{
  try {
    var ss = Components.classes["@mozilla.org/suite/sessionstore;1"]
                       .getService(Components.interfaces.nsISessionStore);
    ss.init(window);
  } catch(ex) {
    dump("nsSessionStore could not be initialized: " + ex + "\n");
  }
}

function WindowFocusTimerCallback(element)
{
  // This function is a redo of the fix for jag bug 91884.
  // See Bug 97067 and Bug 89214 for details.
  if (window == Services.ww.activeWindow) {
    element.focus();
  } else {
    // set the element in command dispatcher so focus will restore properly
    // when the window does become active

    if (element instanceof Components.interfaces.nsIDOMWindow) {
      document.commandDispatcher.focusedWindow = element;
      document.commandDispatcher.focusedElement = null;
    } else if (element instanceof Components.interfaces.nsIDOMElement) {
      document.commandDispatcher.focusedWindow = element.ownerDocument.defaultView;
      document.commandDispatcher.focusedElement = element;
    }
  }
}

function Shutdown()
{
  AddonManager.removeAddonListener(gAddonListener);

  PlacesStarButton.uninit();

  // shut down browser access support
  window.browserDOMWindow = null;

  try {
    getBrowser().removeProgressListener(window.XULBrowserWindow);
  } catch (ex) {
    // Perhaps we didn't get around to adding the progress listener
  }

  window.XULBrowserWindow.destroy();
  window.XULBrowserWindow = null;
  window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem).treeOwner
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIXULWindow)
        .XULBrowserWindow = null;

  // unregister us as a pref listener
  removePrefListener(gTabStripPrefListener);
  removePrefListener(gHomepagePrefListener);
  removePrefListener(gStatusBarPopupIconPrefListener);
  removePopupPermListener(gPopupPermListener);
  removeFormSubmitObserver(gFormSubmitObserver);

  window.browserContentListener.close();
}

function Translate()
{
  var service = Services.prefs.getComplexValue("browser.translation.service",
                                               nsIPrefLocalizedString).data;
  var serviceDomain = Services.prefs.getComplexValue("browser.translation.serviceDomain",
                                                     nsIPrefLocalizedString).data;
  var targetURI = getWebNavigation().currentURI.spec;

  // if we're already viewing a translated page, then just reload
  if (targetURI.indexOf(serviceDomain) >= 0)
    BrowserReload();
  else {
    loadURI(encodeURI(service + targetURI));
  }
}

function OpenSessionHistoryIn(aWhere, aDelta, aTab)
{
  var win = aWhere == "window" ? null : window;
  aTab = aTab || getBrowser().selectedTab;
  var tab = Components.classes["@mozilla.org/suite/sessionstore;1"]
                      .getService(Components.interfaces.nsISessionStore)
                      .duplicateTab(win, aTab, aDelta, true);

  var loadInBackground = getBoolPref("browser.tabs.loadInBackground", false);

  switch (aWhere) {
  case "tabfocused":
    // forces tab to be focused
    loadInBackground = true;
    // fall through
  case "tabshifted":
    loadInBackground = !loadInBackground;
    // fall through
  case "tab":
    if (!loadInBackground) {
      getBrowser().selectedTab = tab;
      window.content.focus();
    }
  }
}

/* Firefox compatibility shim *
 * duplicateTabIn duplicates tab in a place specified by the parameter |where|.
 *
 * |where| can be:
 *  "tab"         new tab
 *  "tabshifted"  same as "tab" but in background if default is to select new
 *                tabs, and vice versa
 *  "tabfocused"  same as "tab" but override any background preferences and
 *                focus the new tab
 *  "window"      new window
 *
 * historyIndex is a history index to set the page to when the new tab is
 * created and loaded, it can for example be used to go back one page for the
 * duplicated tab.
 */
function duplicateTabIn(aTab, aWhere, aHistoryIndex)
{
  aTab = aTab || getBrowser().selectedTab;
  var currentIndex = aTab.linkedBrowser.sessionHistory.index;
  var delta = aHistoryIndex == null ? 0 : aHistoryIndex - currentIndex;
  OpenSessionHistoryIn(aWhere, delta, aTab)
}

function gotoHistoryIndex(aEvent)
{
  var index = aEvent.target.getAttribute("index");
  if (!index)
    return false;

  var where = whereToOpenLink(aEvent);
  if (where == "current") {
    // Normal click. Go there in the current tab and update session history.
    try {
      getWebNavigation().gotoIndex(index);
    }
    catch(ex) {
      return false;
    }
  }
  else {
    // Modified click. Go there in a new tab/window. Include session history.
    var delta = index - getWebNavigation().sessionHistory.index;
    OpenSessionHistoryIn(where, delta);
  }
  return true;
}

function BrowserBack(aEvent)
{
  var where = whereToOpenLink(aEvent, false, true);

  if (where == "current") {
    try {
      getBrowser().goBack();
    }
    catch(ex) {}
  }
  else {
    OpenSessionHistoryIn(where, -1);
  }
}

function BrowserHandleBackspace()
{
  switch (Services.prefs.getIntPref("browser.backspace_action")) {
    case 0:
      BrowserBack();
      break;
    case 1:
      goDoCommand("cmd_scrollPageUp");
      break;
  }
}

function BrowserForward(aEvent)
{
  var where = whereToOpenLink(aEvent, false, true);

  if (where == "current") {
    try {
      getBrowser().goForward();
    }
    catch(ex) {
    }
  }
  else {
    OpenSessionHistoryIn(where, 1);
  }
}

function BrowserUp()
{
  loadURI(getBrowser().currentURI.spec.replace(/[#?].*$/, "").replace(/\/[^\/]*.$/, "/"));
}

function BrowserHandleShiftBackspace()
{
  switch (Services.prefs.getIntPref("browser.backspace_action")) {
    case 0:
      BrowserForward();
      break;
    case 1:
      goDoCommand("cmd_scrollPageDown");
      break;
  } 
}

function SetGroupHistory(popupMenu, direction)
{
  while (popupMenu.firstChild)
    popupMenu.removeChild(popupMenu.firstChild);

  var menuItem = document.createElementNS(XUL_NAMESPACE, "menuitem");
  var label = gNavigatorBundle.getString("tabs.historyItem");
  menuItem.setAttribute("label", label);
  menuItem.setAttribute("index", direction);
  popupMenu.appendChild(menuItem);
}

function BrowserBackMenu(event)
{
  if (gBrowser.backBrowserGroup.length != 0) {
    SetGroupHistory(event.target, "back");
    return true;
  }

  return FillHistoryMenu(event.target, "back");
}

function BrowserForwardMenu(event)
{
  if (gBrowser.forwardBrowserGroup.length != 0) {
    SetGroupHistory(event.target, "forward");
    return true;
  }

  return FillHistoryMenu(event.target, "forward");
}

function BrowserStop()
{
  try {
    const stopFlags = nsIWebNavigation.STOP_ALL;
    getWebNavigation().stop(stopFlags);
  }
  catch(ex) {
  }
}

function BrowserReload(aEvent)
{
  var where = whereToOpenLink(aEvent, false, true);
  if (where == "current")
    BrowserReloadWithFlags(nsIWebNavigation.LOAD_FLAGS_NONE);
  else if (where == null && aEvent.shiftKey)
    BrowserReloadSkipCache();
  else
    OpenSessionHistoryIn(where, 0);
}

function BrowserReloadSkipCache()
{
  // Bypass proxy and cache.
  const reloadFlags = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
  BrowserReloadWithFlags(reloadFlags);
}

function BrowserHome(aEvent)
{
  var homePage = getHomePage();
  var where = whereToOpenLink(aEvent, false, true);
  openUILinkArrayIn(homePage, where);
}

/**
 * This also takes care of updating the command enabled-state when tabs are
 * created or removed.
 */
var gBookmarkAllTabsHandler = {
  init: function () {
    this._command = document.getElementById("Browser:BookmarkAllTabs");
    gBrowser.tabContainer.addEventListener("TabOpen", this, true);
    gBrowser.tabContainer.addEventListener("TabClose", this, true);
    this._updateCommandState();
  },

  _updateCommandState: function BATH__updateCommandState(aTabClose) {
    var numTabs = gBrowser.browsers.length;

    // The TabClose event is fired before the tab is removed from the DOM
    if (aTabClose)
      numTabs--;

    if (numTabs > 1)
      this._command.removeAttribute("disabled");
    else
      this._command.setAttribute("disabled", "true");
  },

  doCommand: function BATH_doCommand() {
    PlacesCommandHook.bookmarkCurrentPages();
  },

  // nsIDOMEventListener
  handleEvent: function(aEvent) {
    this._updateCommandState(aEvent.type == "TabClose");
  }
};

const BrowserSearch = {
  addEngine: function(engine, targetDoc) {
    Services.console.logStringMessage("BrowserSearch.addEngine will be implemented in bug 401417.");
  },

  /**
   * Update the browser UI to show whether or not additional engines are
   * available when a page is loaded or the user switches tabs to a page that
   * has search engines.
   */
  updateSearchButton: function() {
    Services.console.logStringMessage("BrowserSearch.updateSearchButton will be implemented in bug 401417.");
  },

  /**
   * Gives focus to the search bar, if it is present on the toolbar, or to the
   * search sidebar, if it is open, or loads the default engine's search form
   * otherwise. For Mac, opens a new window or focuses an existing window, if
   * necessary.
   */
  webSearch: function BrowserSearch_webSearch() {
    if (/Mac/.test(navigator.platform)) {
      if (window.location.href != getBrowserURL()) {
        var win = getTopWin();
        if (win) {
          // If there's an open browser window, it should handle this command
          win.focus();
          win.BrowserSearch.webSearch();
        } else {
          // If there are no open browser windows, open a new one

          // This needs to be in a timeout so that we don't end up refocused
          // in the url bar
          function webSearchCallback() {
            setTimeout(BrowserSearch.webSearch, 0);
          }

          win = window.openDialog(getBrowserURL(), "_blank",
                                  "chrome,all,dialog=no", "about:blank");
          win.addEventListener("load", webSearchCallback, false);
        }
        return;
      }
    }

    if (isElementVisible(this.searchBar)) {
      searchBar.select();
      searchBar.focus();
    } else if (isElementVisible(this.searchSidebar)) {
      searchSidebar.focus();
    } else {
      loadURI(Services.search.defaultEngine.searchForm);
      window.content.focus();
    }
  },

  /**
   * Loads a search results page, given a set of search terms. Uses the current
   * engine if the search bar is visible, or the default engine otherwise.
   *
   * @param searchText
   *        The search terms to use for the search.
   *
   * @param useNewTab
   *        Boolean indicating whether or not the search should load in a new
   *        tab.
   */
  loadSearch: function BrowserSearch_search(searchText, useNewTab) {
    var engine;

    // If the search bar is visible, use the current engine, otherwise, fall
    // back to the default engine.
    if (isElementVisible(this.searchBar) ||
        isElementVisible(this.searchSidebar))
      engine = Services.search.currentEngine;
    else
      engine = Services.search.defaultEngine;

    var submission = engine.getSubmission(searchText); // HTML response

    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.  This is unlikely (since
    // SearchService._addEngineToStore() should fail for such an engine),
    // but let's be on the safe side.
    if (!submission)
      return;

    if (useNewTab) {
      gBrowser.loadOneTab(submission.uri.spec,
                          { postData: submission.postData,
                            relatedToCurrent: true,
                            inBackground: false });
    } else {
      gBrowser.loadURIWithFlags(submission.uri.spec, nsIWebNavigation.LOAD_FLAGS_NONE,
                                null, null, submission.postData);
      window.content.focus();
    }

    // should we try and open up the sidebar to show the "Search Results" panel?
    var autoOpenSidebar = false;
    try {
      autoOpenSidebar = Services.prefs.getBoolPref("browser.search.opensidebarsearchpanel");
    } catch (e) {}
    if (autoOpenSidebar)
      this.revealSidebar();
  },

  /**
   * Returns the search bar element if it is present in the toolbar, null otherwise.
   */
  get searchBar() {
    return document.getElementById("searchbar");
  },

  /**
   * Returns the search sidebar element if it is present in the toolbar, null otherwise.
   */
  get searchSidebar() {
    return document.getElementById("urn:sidebar:panel:search");
  },

  /**
   * Reveal the search sidebar panel.
   */
  revealSidebar: function BrowserSearch_revealSidebar() {
    // first lets check if the search panel will be shown at all
    // by checking the sidebar datasource to see if there is an entry
    // for the search panel, and if it is excluded for navigator or not

    var searchPanelExists = false;

    var myPanel = document.getElementById("urn:sidebar:panel:search");
    if (myPanel) {
      var panel = sidebarObj.panels.get_panel_from_header_node(myPanel);
      searchPanelExists = !panel.is_excluded();

    } else if (sidebarObj.never_built) {
      // XXXsearch: in theory, this should work when the sidebar isn't loaded,
      //            in practice, it fails as sidebarObj.datasource_uri isn't defined
      try {
        var datasource = RDF.GetDataSourceBlocking(sidebarObj.datasource_uri);
        var aboutValue = RDF.GetResource("urn:sidebar:panel:search");

        // check if the panel is even in the list by checking for its content
        var contentProp = RDF.GetResource("http://home.netscape.com/NC-rdf#content");
        var content = datasource.GetTarget(aboutValue, contentProp, true);

        if (content instanceof Components.interfaces.nsIRDFLiteral) {
          // the search panel entry exists, now check if it is excluded
          // for navigator
          var excludeProp = RDF.GetResource("http://home.netscape.com/NC-rdf#exclude");
          var exclude = datasource.GetTarget(aboutValue, excludeProp, true);

          if (exclude instanceof Components.interfaces.nsIRDFLiteral) {
            searchPanelExists = (exclude.Value.indexOf("navigator:browser") < 0);
          } else {
            // panel exists and no exclude set
            searchPanelExists = true;
          }
        }
      } catch (e) {
        searchPanelExists = false;
      }
    }

    if (searchPanelExists) {
      // make sure the sidebar is open, else SidebarSelectPanel() will fail
      if (sidebar_is_hidden())
        SidebarShowHide();

      if (sidebar_is_collapsed())
        SidebarExpandCollapse();

      var searchPanel = document.getElementById("urn:sidebar:panel:search");
      if (searchPanel)
        SidebarSelectPanel(searchPanel, true, true); // lives in sidebarOverlay.js
    }
  }
}

function QualifySearchTerm()
{
  // If the text in the URL bar is the same as the currently loaded
  // page's URL then treat this as an empty search term.  This way
  // the user is taken to the search page where s/he can enter a term.
  if (gBrowser.userTypedValue !== null)
    return gURLBar.value;
  return "";
}

//Note: BrowserNewEditorWindow() was moved to globalOverlay.xul and renamed to NewEditorWindow()

function BrowserOpenWindow()
{
  //opens a window where users can select a web location to open
  var params = { browser: window, action: null, url: "" };
  openDialog("chrome://communicator/content/openLocation.xul", "_blank", "chrome,modal,titlebar", params);
  var postData = { };
  var url = getShortcutOrURI(params.url, postData);
  // XXX: need to actually deal with the postData, see bug 553459
  switch (params.action) {
    case "0": // current window
      loadURI(url, null, nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP);
      break;
    case "1": // new window
      openDialog(getBrowserURL(), "_blank", "all,dialog=no", url, null, null,
                 nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP);
      break;
    case "2": // edit
      editPage(url);
      break;
    case "3": // new tab
      gBrowser.selectedTab = gBrowser.addTab(url, {allowThirdPartyFixup: true});
      break;
  }
}

function BrowserOpenTab()
{
  if (!gInPrintPreviewMode) {
    var uriToLoad;
    try {
      switch ( Services.prefs.getIntPref("browser.tabs.loadOnNewTab") )
      {
        default:
          uriToLoad = "about:blank";
          break;
        case 1:
          uriToLoad = Services.prefs.getComplexValue("browser.startup.homepage",
                                                     nsIPrefLocalizedString).data;
          break;
        case 2:
          uriToLoad = gBrowser ? getWebNavigation().currentURI.spec
                               : Components.classes["@mozilla.org/browser/global-history;2"]
                                           .getService(Components.interfaces.nsIBrowserHistory)
                                           .lastPageVisited;
          break;
      }
    } catch(e) {
      uriToLoad = "about:blank";
    }

    // Open a new window if someone requests a new tab when no browser window is open
    if (!gBrowser) {
      openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", uriToLoad);
      return;
    }

    gBrowser.selectedTab = gBrowser.addTab(uriToLoad);
    if (uriToLoad == "about:blank" && isElementVisible(gURLBar))
      setTimeout(WindowFocusTimerCallback, 0, gURLBar);
    else
      setTimeout(WindowFocusTimerCallback, 0, content);
  }
}

/* Show file picker dialog configured for opening a file, and return 
 * the selected nsIFileURL instance. */
function selectFileToOpen(label, prefRoot)
{
  var fileURL = null;

  // Get filepicker component.
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, gNavigatorBundle.getString(label), nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterAll | nsIFilePicker.filterText | nsIFilePicker.filterImages |
                   nsIFilePicker.filterXML | nsIFilePicker.filterHTML);

  const filterIndexPref = prefRoot + "filterIndex";
  const lastDirPref = prefRoot + "dir";

  // use a pref to remember the filterIndex selected by the user.
  var index = 0;
  try {
    index = Services.prefs.getIntPref(filterIndexPref);
  } catch (ex) {
  }
  fp.filterIndex = index;

  // use a pref to remember the displayDirectory selected by the user.
  try {
    fp.displayDirectory = Services.prefs.getComplexValue(lastDirPref,
                              Components.interfaces.nsILocalFile);
  } catch (ex) {
  }

  if (fp.show() == nsIFilePicker.returnOK) {
    Services.prefs.setIntPref(filterIndexPref, fp.filterIndex);
    Services.prefs.setComplexValue(lastDirPref,
                                   Components.interfaces.nsILocalFile,
                                   fp.file.parent);
    fileURL = fp.fileURL;
  }

  return fileURL;
}

function BrowserOpenFileWindow()
{
  try {
    openTopWin(selectFileToOpen("openFile", "browser.open.").spec);
  } catch (e) {}
}

function updateCloseItems()
{
  var browser = getBrowser();
  var ss = Components.classes["@mozilla.org/suite/sessionstore;1"]
                     .getService(Components.interfaces.nsISessionStore);

  var hideCloseWindow = Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab") &&
                        (!browser || browser.tabContainer.childNodes.length <= 1);
  document.getElementById("menu_closeWindow").hidden = hideCloseWindow;
  var closeItem = document.getElementById("menu_close");
  if (hideCloseWindow) {
    closeItem.setAttribute("label", gNavigatorBundle.getString("tabs.close.label"));
    closeItem.setAttribute("accesskey", gNavigatorBundle.getString("tabs.close.accesskey"));
  } else {
    closeItem.setAttribute("label", gNavigatorBundle.getString("tabs.closeTab.label"));
    closeItem.setAttribute("accesskey", gNavigatorBundle.getString("tabs.closeTab.accesskey"));
  }

  var hideCloseOtherTabs = !browser || !browser.getStripVisibility();
  document.getElementById("menu_closeOtherTabs").hidden = hideCloseOtherTabs;
  if (!hideCloseOtherTabs)
    document.getElementById("cmd_closeOtherTabs").setAttribute("disabled", hideCloseWindow);

  var recentTabsItem = document.getElementById("menu_recentTabs");
  recentTabsItem.setAttribute("disabled", !browser || browser.getUndoList().length == 0);
  var recentWindowsItem = document.getElementById("menu_recentWindows");
  recentWindowsItem.setAttribute("disabled", ss.getClosedWindowCount() == 0);
}

function updateRecentTabs(menupopup)
{
  var browser = getBrowser();

  while (menupopup.hasChildNodes())
    menupopup.removeChild(menupopup.lastChild);

  var list = browser.getUndoList();
  for (var i = 0; i < list.length; i++) {
    var menuitem = document.createElement("menuitem");
    var label = list[i];
    if (i < 9) {
      label = gNavigatorBundle.getFormattedString("tabs.recentlyClosed.format", [i + 1, label]);
      menuitem.setAttribute("accesskey", i + 1);
    }

    if (i == 0)
      menuitem.setAttribute("key", "key_restoreTab");

    menuitem.setAttribute("label", label);
    menuitem.setAttribute("value", i);
    menupopup.appendChild(menuitem);
  }
}

function updateRecentWindows(menupopup)
{
  var ss = Components.classes["@mozilla.org/suite/sessionstore;1"]
                     .getService(Components.interfaces.nsISessionStore);

  while (menupopup.hasChildNodes())
    menupopup.removeChild(menupopup.lastChild);

  var undoItems = JSON.parse(ss.getClosedWindowData());
  for (var i = 0; i < undoItems.length; i++) {
    var menuitem = document.createElement("menuitem");
    var label = undoItems[i].title;
    if (i < 9) {
      label = gNavigatorBundle.getFormattedString("windows.recentlyClosed.format", [i + 1, label]);
      menuitem.setAttribute("accesskey", i + 1);
    }

    if (i == 0)
      menuitem.setAttribute("key", "key_restoreWindow");

    menuitem.setAttribute("label", label);
    menuitem.setAttribute("value", i);
    menupopup.appendChild(menuitem);
  }
}

function undoCloseWindow(aIndex)
{
  var ss = Components.classes["@mozilla.org/suite/sessionstore;1"]
                     .getService(Components.interfaces.nsISessionStore);

  return ss.undoCloseWindow(aIndex);
}

/*
 * Determines if a tab is "empty" using isBrowserEmpty from utilityOverlay.js
 */
function isTabEmpty(aTab)
{
  return isBrowserEmpty(aTab.linkedBrowser);
}

function BrowserCloseOtherTabs()
{
  var browser = getBrowser();
  browser.removeAllTabsBut(browser.mCurrentTab);
}

function BrowserCloseTabOrWindow()
{
  var browser = getBrowser();
  if (browser.tabContainer.childNodes.length > 1 ||
      !Services.prefs.getBoolPref("browser.tabs.closeWindowWithLastTab")) {
    // Just close up a tab.
    browser.removeCurrentTab();
    return;
  }

  BrowserCloseWindow();
}

function BrowserTryToCloseWindow()
{
  if (WindowIsClosing())
    BrowserCloseWindow();
}

function BrowserCloseWindow() 
{
  // This code replicates stuff in Shutdown().  It is here because
  // window.screenX and window.screenY have real values.  We need
  // to fix this eventually but by replicating the code here, we
  // provide a means of saving position (it just requires that the
  // user close the window via File->Close (vs. close box).
  
  // Get the current window position/size.
  var x = window.screenX;
  var y = window.screenY;
  var h = window.outerHeight;
  var w = window.outerWidth;

  // Store these into the window attributes (for persistence).
  var win = document.getElementById( "main-window" );
  win.setAttribute( "x", x );
  win.setAttribute( "y", y );
  win.setAttribute( "height", h );
  win.setAttribute( "width", w );

  window.close();
}

function loadURI(uri, referrer, flags)
{
  try {
    getBrowser().loadURIWithFlags(uri, flags, referrer);
  } catch (e) {
  }
}

function BrowserLoadURL(aTriggeringEvent)
{
  // Remove leading and trailing spaces first
  var url = gURLBar.value.trim();

  if (url.match(/^view-source:/)) {
    gViewSourceUtils.viewSource(url.replace(/^view-source:/, ""), null, null);
  } else {
    // Check the pressed modifiers: (also see bug 97123)
    // Modifier Mac | Modifier PC | Action
    // -------------+-------------+-----------
    // Command      | Control     | New Window/Tab
    // Shift+Cmd    | Shift+Ctrl  | New Window/Tab behind current one
    // Option       | Shift       | Save URL (show Filepicker)

    // If false, the save modifier is Alt, which is Option on Mac.
    var modifierIsShift = true;
    try {
      modifierIsShift = Services.prefs.getBoolPref("ui.key.saveLink.shift");
    }
    catch (ex) {}

    var shiftPressed = false;
    var saveModifier = false; // if the save modifier was pressed
    if (aTriggeringEvent && 'shiftKey' in aTriggeringEvent &&
        'altKey' in aTriggeringEvent) {
      saveModifier = modifierIsShift ? aTriggeringEvent.shiftKey
                     : aTriggeringEvent.altKey;
      shiftPressed = aTriggeringEvent.shiftKey;
    }

    var browser = getBrowser();
    var postData = {};
    url = getShortcutOrURI(url, postData);
    // XXX: need to actually deal with the postData, see bug 553459
    // Accept both Control and Meta (=Command) as New-Window-Modifiers
    if (aTriggeringEvent &&
        (('ctrlKey' in aTriggeringEvent && aTriggeringEvent.ctrlKey) ||
         ('metaKey' in aTriggeringEvent && aTriggeringEvent.metaKey))) {
      // Check if user requests Tabs instead of windows
      var openTab = false;
      try {
        openTab = Services.prefs.getBoolPref("browser.tabs.opentabfor.urlbar");
      }
      catch (ex) {}

      if (openTab) {
        // Open link in new tab
        var t = browser.addTab(url, {allowThirdPartyFixup: true});

        // Focus new tab unless shift is pressed
        if (!shiftPressed) {
          browser.userTypedValue = null;
          browser.selectedTab = t;
        }
      } else {
        // Open a new window with the URL
        var newWin = openDialog(getBrowserURL(), "_blank", "all,dialog=no", url,
            null, null, nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP);
        // Reset url in the urlbar
        URLBarSetURI();

        // Focus old window if shift was pressed, as there's no
        // way to open a new window in the background
        // XXX this doesn't seem to work
        if (shiftPressed) {
          //newWin.blur();
          content.focus();
        }
      }
    } else if (saveModifier) {
      try {
        // Firstly, fixup the url so that (e.g.) "www.foo.com" works
        const nsIURIFixup = Components.interfaces.nsIURIFixup;
        if (!gURIFixup)
          gURIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                                .getService(nsIURIFixup);
        url = gURIFixup.createFixupURI(url, nsIURIFixup.FIXUP_FLAGS_MAKE_ALTERNATE_URI).spec;
        // Open filepicker to save the url
        saveURL(url, null, null, false, true);
      }
      catch(ex) {
        // XXX Do nothing for now.
        // Do we want to put up an alert in the future?  Mmm, l10n...
      }
    } else {
      // No modifier was pressed, load the URL normally and
      // focus the content area
      loadURI(url, null, nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP);
      content.focus();
    }
  }
}

function getShortcutOrURI(aURL, aPostDataRef)
{
  var shortcutURL = null;
  var keyword = aURL;
  var param = "";

  var offset = aURL.indexOf(" ");
  if (offset > 0) {
    keyword = aURL.substr(0, offset);
    param = aURL.substr(offset + 1);
  }

  if (!aPostDataRef)
    aPostDataRef = {};

  // XXX: In the future, ask the search service if it knows that keyword

  [shortcutURL, aPostDataRef.value] =
    PlacesUtils.getURLAndPostDataForKeyword(keyword);

  if (!shortcutURL)
    return aURL;

  var postData = "";
  if (aPostDataRef.value)
    postData = unescape(aPostDataRef.value);

  if (/%s/i.test(shortcutURL) || /%s/i.test(postData)) {
    var charset = "";
    const re = /^(.*)\&mozcharset=([a-zA-Z][_\-a-zA-Z0-9]+)\s*$/;
    var matches = shortcutURL.match(re);
    if (matches)
      [, shortcutURL, charset] = matches;
    else {
      // Try to get the saved character-set.
      try {
        // makeURI throws if URI is invalid.
        // Will return an empty string if character-set is not found.
        charset = PlacesUtils.history.getCharsetForURI(makeURI(shortcutURL));
      } catch (e) {}
    }

    var encodedParam = "";
    if (charset)
      encodedParam = escape(convertFromUnicode(charset, param));
    else // Default charset is UTF-8
      encodedParam = encodeURIComponent(param);

    shortcutURL = shortcutURL.replace(/%s/g, encodedParam).replace(/%S/g, param);

    if (/%s/i.test(postData)) // POST keyword
      aPostDataRef.value = getPostDataStream(postData, param, encodedParam,
                                             "application/x-www-form-urlencoded");
  }
  else if (param) {
    // This keyword doesn't take a parameter, but one was provided. Just return
    // the original URL.
    aPostDataRef.value = null;

    return aURL;
  }

  return shortcutURL;
}

function readFromClipboard()
{
  var url;

  try {
    // Get clipboard.
    var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"]
                              .getService(Components.interfaces.nsIClipboard);

    // Create tranferable that will transfer the text.
    var trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);

    trans.addDataFlavor("text/unicode");
    // If available, use selection clipboard, otherwise global one
    if (clipboard.supportsSelectionClipboard())
      clipboard.getData(trans, clipboard.kSelectionClipboard);
    else
      clipboard.getData(trans, clipboard.kGlobalClipboard);

    var data = {};
    var dataLen = {};
    trans.getTransferData("text/unicode", data, dataLen);

    if (data) {
      data = data.value.QueryInterface(Components.interfaces.nsISupportsString);
      url = data.data.substring(0, dataLen.value / 2);
    }
  } catch (ex) {
  }

  return url;
}

function BrowserViewSourceOfDocument(aDocument)
{
  var pageCookie;
  var webNav;

  // Get the nsIWebNavigation associated with the document
  try {
      var win;
      var ifRequestor;

      // Get the DOMWindow for the requested document.  If the DOMWindow
      // cannot be found, then just use the content window...
      //
      // XXX:  This is a bit of a hack...
      win = aDocument.defaultView;
      if (win == window) {
        win = content;
      }
      ifRequestor = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor);

      webNav = ifRequestor.getInterface(Components.interfaces.nsIWebNavigation);
  } catch(err) {
      // If nsIWebNavigation cannot be found, just get the one for the whole
      // window...
      webNav = getWebNavigation();
  }
  //
  // Get the 'PageDescriptor' for the current document. This allows the
  // view-source to access the cached copy of the content rather than
  // refetching it from the network...
  //
  try{
    var PageLoader = webNav.QueryInterface(Components.interfaces.nsIWebPageDescriptor);

    pageCookie = PageLoader.currentDescriptor;
  } catch(err) {
    // If no page descriptor is available, just use the view-source URL...
  }

  gViewSourceUtils.viewSource(webNav.currentURI.spec, pageCookie, aDocument);
}

// doc - document to use for source, or null for the current tab
// initialTab - id of the initial tab to display, or null for the first tab
function BrowserPageInfo(doc, initialTab)
{
  if (!doc)
    doc = window.content.document;
  var relatedUrl = doc.location.toString();
  var args = {doc: doc, initialTab: initialTab};

  var enumerator = Services.wm.getEnumerator("Browser:page-info");
  // Check for windows matching the url
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext();
    if (win.document.documentElement
           .getAttribute("relatedUrl") == relatedUrl) {
      win.focus();
      win.resetPageInfo(args);
      return win;
    }
  }
  // We didn't find a matching window, so open a new one.
  return window.openDialog("chrome://navigator/content/pageinfo/pageInfo.xul",
                           "_blank",
                           "chrome,dialog=no",
                           args);
}

function hiddenWindowStartup()
{
  AddonManager.addAddonListener(gAddonListener);
  ReloadThemes();

  // focus the hidden window
  window.focus();

  // Disable menus which are not appropriate
  var disabledItems = ['cmd_close', 'Browser:SendPage',
                       'Browser:EditPage', 'Browser:SavePage', 'cmd_printSetup',
                       'Browser:Print', 'canGoBack', 'canGoForward',
                       'Browser:AddBookmark', 'Browser:AddBookmarkAs',
                       'cmd_undo', 'cmd_redo', 'cmd_cut', 'cmd_copy',
                       'cmd_paste', 'cmd_delete', 'cmd_selectAll',
                       'cmd_findTypeText', 'cmd_findTypeLinks', 'Browser:Find',
                       'Browser:FindAgain', 'Browser:FindPrev', 'menu_Toolbars',
                       'menuitem_reload', 'menu_UseStyleSheet', 'charsetMenu',
                       'View:PageSource', 'View:PageInfo', 'menu_translate',
                       'BlockCookies', 'UseCookiesDefault',
                       'AllowSessionCookies', 'AllowCookies', 'BlockImages',
                       'UseImagesDefault', 'AllowImages', 'AllowPopups',
                       'menu_zoom', 'cmd_minimizeWindow', 'cmd_zoomWindow'];
  var broadcaster;

  for (var id in disabledItems) {
    broadcaster = document.getElementById(disabledItems[id]);
    if (broadcaster)
      broadcaster.setAttribute("disabled", "true");
  }

  // also hide the window list separator
  var separator = document.getElementById("sep-window-list");
  if (separator)
    separator.setAttribute("hidden", "true");

  // init string bundles
  gNavigatorBundle = document.getElementById("bundle_navigator");
  gNavigatorRegionBundle = document.getElementById("bundle_navigator_region");
  gBrandBundle = document.getElementById("bundle_brand");
}

var consoleListener = {
  observe: function (aMsgObject)
  {
    const nsIScriptError = Components.interfaces.nsIScriptError;
    var scriptError = aMsgObject.QueryInterface(nsIScriptError);
    var isWarning = scriptError.flags & nsIScriptError.warningFlag != 0;
    if (!isWarning) {
      var statusbarDisplay = document.getElementById("statusbar-display");
      statusbarDisplay.setAttribute("error", "true");
      statusbarDisplay.addEventListener("click", loadErrorConsole, true);
      statusbarDisplay.label = gNavigatorBundle.getString("jserror");
      this.isShowingError = true;
    }
  },

  // whether or not an error alert is being displayed
  isShowingError: false
};

function initConsoleListener()
{
  /**
   * XXX - console launch hookup requires some work that I'm not sure
   * how to do.
   *
   *       1) ideally, the notification would disappear when the
   *       document that had the error was flushed. how do I know when
   *       this happens? All the nsIScriptError object I get tells me
   *       is the URL. Where is it located in the content area?
   *       2) the notification service should not display chrome
   *       script errors.  web developers and users are not interested
   *       in the failings of our shitty, exception unsafe js. One
   *       could argue that this should also extend to the console by
   *       default (although toggle-able via setting for chrome
   *       authors) At any rate, no status indication should be given
   *       for chrome script errors.
   *
   *       As a result I am commenting out this for the moment.
   *

  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);

  if (consoleService)
    consoleService.registerListener(consoleListener);
  */
}

function loadErrorConsole(aEvent)
{
  if (aEvent.detail == 2)
    toJavaScriptConsole();
}

function clearErrorNotification()
{
  var statusbarDisplay = document.getElementById("statusbar-display");
  statusbarDisplay.removeAttribute("error");
  statusbarDisplay.removeEventListener("click", loadErrorConsole, true);
  consoleListener.isShowingError = false;
}

const NS_URLWIDGET_CONTRACTID = "@mozilla.org/urlwidget;1";
var urlWidgetService = null;
if (NS_URLWIDGET_CONTRACTID in Components.classes) {
  urlWidgetService = Components.classes[NS_URLWIDGET_CONTRACTID]
                               .getService(Components.interfaces.nsIUrlWidget);
}

//Posts the currently displayed url to a native widget so third-party apps can observe it.
function postURLToNativeWidget()
{
  if (urlWidgetService) {
    var url = getWebNavigation().currentURI.spec;
    try {
      urlWidgetService.SetURLToHiddenControl(url, window);
    } catch(ex) {
    }
  }
}

function checkForDirectoryListing()
{
  if ( "HTTPIndex" in content &&
       content.HTTPIndex instanceof Components.interfaces.nsIHTTPIndex ) {
    content.defaultCharacterset = getMarkupDocumentViewer().defaultCharacterSet;
  }
}

function URLBarSetURI(aURI, aValid) {
  var uri = aURI || getWebNavigation().currentURI;
  var value;

  // If the url has "wyciwyg://" as the protocol, strip it off.
  // Nobody wants to see it on the urlbar for dynamically generated pages.
  if (!gURIFixup)
    gURIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                          .getService(Components.interfaces.nsIURIFixup);
  try {
    uri = gURIFixup.createExposableURI(uri);
  } catch (ex) {}

  // Replace "about:blank" with an empty string
  // only if there's no opener (bug 370555).
  if (gInitialPages.indexOf(uri.spec) != -1)
    value = (content.opener || getWebNavigation().canGoBack) ? uri.spec : "";
  else
    value = losslessDecodeURI(uri);

  gURLBar.value = value;
  // In some cases, setting the urlBar value causes userTypedValue to
  // become set because of oninput, so reset it to null.
  getBrowser().userTypedValue = null;

  SetPageProxyState((value && (!aURI || aValid)) ? "valid" : "invalid", uri);
}

function losslessDecodeURI(aURI) {
  var value = aURI.spec;
  // Try to decode as UTF-8 if there's no encoding sequence that we would break.
  if (!/%25(?:3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/i.test(value))
    try {
      value = decodeURI(value)
                // decodeURI decodes %25 to %, which creates unintended
                // encoding sequences. Re-encode it, unless it's part of
                // a sequence that survived decodeURI, i.e. one for:
                // ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#'
                // (RFC 3987 section 3.2)
                .replace(/%(?!3B|2F|3F|3A|40|26|3D|2B|24|2C|23)/ig,
                         encodeURIComponent);
    } catch (e) {}

  // Encode invisible characters (soft hyphen, zero-width space, BOM,
  // line and paragraph separator, word joiner, invisible times,
  // invisible separator, object replacement character) (bug 452979)
  // Encode bidirectional formatting characters.
  // (RFC 3987 sections 3.2 and 4.1 paragraph 6)
  // Re-encode whitespace so that it doesn't get eaten away
  // by the location bar (bug 410726).
  return value.replace(/[\x09-\x0d\x1c-\x1f\u00ad\u200b\u200e\u200f\u2028-\u202e\u2060\u2062\u2063\ufeff\ufffc]/g,
                        encodeURIComponent);
}

/**
 * Use Stylesheet functions.
 *     Written by Tim Hill (bug 6782)
 *     Frameset handling by Neil Rashbrook <neil@parkwaycc.co.uk>
 **/
/**
 * Adds this frame's stylesheet sets to the View > Use Style submenu
 *
 * If the frame has no preferred stylesheet set then the "Default style"
 * menuitem should be shown. Note that it defaults to checked, hidden.
 *
 * If this frame has a selected stylesheet set then its menuitem should
 * be checked (unless the "None" style is currently selected), and the
 * "Default style" menuitem should to be unchecked.
 *
 * The stylesheet sets may match those of other frames. In that case, the
 * checkmark should be removed from sets that are not selected in this frame.
 *
 * @param menuPopup          The submenu's popup child
 * @param frame              The frame whose sets are to be added
 * @param styleDisabled      True if the "None" style is currently selected
 * @param itemPersistentOnly The "Default style" menuitem element
 */
function stylesheetFillFrame(menuPopup, frame, styleDisabled, itemPersistentOnly)
{
  if (!frame.document.preferredStyleSheetSet)
    itemPersistentOnly.hidden = false;

  var title = frame.document.selectedStyleSheetSet;
  if (title)
    itemPersistentOnly.removeAttribute("checked");

  var styleSheetSets = frame.document.styleSheetSets;
  for (var i = 0; i < styleSheetSets.length; i++) {
    var styleSheetSet = styleSheetSets[i];
    var menuitem = menuPopup.getElementsByAttribute("data", styleSheetSet).item(0);
    if (menuitem) {
      if (styleSheetSet != title)
        menuitem.removeAttribute("checked");
    } else {
      var menuItem = document.createElement("menuitem");
      menuItem.setAttribute("type", "radio");
      menuItem.setAttribute("label", styleSheetSet);
      menuItem.setAttribute("data", styleSheetSet);
      menuItem.setAttribute("checked", styleSheetSet == title && !styleDisabled);
      menuPopup.appendChild(menuItem);
    }
  }
}
/**
 * Adds all available stylesheet sets to the View > Use Style submenu
 *
 * If all frames have preferred stylesheet sets then the "Default style"
 * menuitem should remain hidden, otherwise it should be shown, and
 * if some frames have a selected stylesheet then the "Default style"
 * menuitem should be unchecked, otherwise it should remain checked.
 *
 * A stylesheet set's menuitem should not be checked if the "None" style
 * is currently selected. Otherwise a stylesheet set may be available in
 * more than one frame. In such a case the menuitem should only be checked
 * if it is selected in all frames in which it is available.
 *
 * @param menuPopup          The submenu's popup child
 * @param frameset           The frameset whose sets are to be added
 * @param styleDisabled      True if the "None" style is currently selected
 * @param itemPersistentOnly The "Default style" menuitem element
 */
function stylesheetFillAll(menuPopup, frameset, styleDisabled, itemPersistentOnly)
{
  stylesheetFillFrame(menuPopup, frameset, styleDisabled, itemPersistentOnly);
  for (var i = 0; i < frameset.frames.length; i++) {
    stylesheetFillAll(menuPopup, frameset.frames[i], styleDisabled, itemPersistentOnly);
  }
}
/**
 * Populates the View > Use Style submenu with all available stylesheet sets
 * @param menuPopup The submenu's popup child
 */
function stylesheetFillPopup(menuPopup)
{
  /* Clear menu */
  var itemPersistentOnly = menuPopup.firstChild.nextSibling;
  while (itemPersistentOnly.nextSibling)
    menuPopup.removeChild(itemPersistentOnly.nextSibling);

  /* Reset permanent items */
  var styleDisabled = getMarkupDocumentViewer().authorStyleDisabled;
  menuPopup.firstChild.setAttribute("checked", styleDisabled);
  itemPersistentOnly.setAttribute("checked", !styleDisabled);
  itemPersistentOnly.hidden = true;

  stylesheetFillAll(menuPopup, window.content, styleDisabled, itemPersistentOnly);
}
/**
 * Switches all frames in a frameset to the same stylesheet set
 *
 * Only frames that support the given title will be switched
 *
 * @param frameset The frameset whose frames are to be switched
 * @param title    The name of the stylesheet set to switch to
 */
function stylesheetSwitchAll(frameset, title) {
  if (!title || frameset.document.styleSheetSets.contains(title)) {
    frameset.document.selectedStyleSheetSet = title;
  }
  for (var i = 0; i < frameset.frames.length; i++) {
    stylesheetSwitchAll(frameset.frames[i], title);
  }
}

function setStyleDisabled(disabled) {
  getMarkupDocumentViewer().authorStyleDisabled = disabled;
}

function restartApp() {
  // Notify all windows that an application quit has been requested.
  var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                             .createInstance(Components.interfaces.nsISupportsPRBool);

  Services.obs.notifyObservers(cancelQuit, "quit-application-requested", "restart");

  // Something aborted the quit process.
  if (cancelQuit.data)
    return;

  Services.prefs.setBoolPref("browser.sessionstore.resume_session_once", true);
  const nsIAppStartup = Components.interfaces.nsIAppStartup;
  Components.classes["@mozilla.org/toolkit/app-startup;1"]
            .getService(nsIAppStartup)
            .quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
 }

function applyTheme(menuitem)
{
  if (!menuitem.theme)
    return;

  menuitem.theme.userDisabled = false;
  if (!menuitem.theme.isActive) {
    var promptTitle = gNavigatorBundle.getString("switchskinstitle");
    var brandName = gBrandBundle.getString("brandShortName");
    var promptMsg = gNavigatorBundle.getFormattedString("switchskins", [brandName]);
    var promptNow = gNavigatorBundle.getString("switchskinsnow");
    var promptLater = gNavigatorBundle.getString("switchskinslater");
    var check = {value: false};
    var flags = Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING +
                Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING;
    var pressedVal = Services.prompt.confirmEx(window, promptTitle, promptMsg,
                                               flags, promptNow, promptLater,
                                               null, null, check);

    if (pressedVal == 0)
      restartApp();
  }
}

function getNewThemes()
{
  // get URL for more themes from prefs
  try {
    var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                              .getService(Components.interfaces.nsIURLFormatter);
    openTopWin(formatter.formatURLPref("extensions.getMoreThemesURL"));
  }
  catch (ex) {
    dump(ex);
  }
}

function URLBarFocusHandler(aEvent)
{
  if (gIgnoreFocus)
    gIgnoreFocus = false;
  else if (gClickSelectsAll)
    gURLBar.select();
}

function URLBarMouseDownHandler(aEvent)
{
  if (gURLBar.hasAttribute("focused")) {
    gIgnoreClick = true;
  } else {
    gIgnoreFocus = true;
    gIgnoreClick = false;
    gURLBar.setSelectionRange(0, 0);
  }
}

function URLBarClickHandler(aEvent)
{
  if (!gIgnoreClick && gClickSelectsAll && gURLBar.selectionStart == gURLBar.selectionEnd)
    if (gClickAtEndSelects || gURLBar.selectionStart < gURLBar.value.length)
      gURLBar.select();
}

// This function gets the shell service and has it check its setting
// This will do nothing on platforms without a shell service.
function checkForDefaultBrowser()
{
  const NS_SHELLSERVICE_CID = "@mozilla.org/suite/shell-service;1";
  
  if (NS_SHELLSERVICE_CID in Components.classes) {
    const nsIShellService = Components.interfaces.nsIShellService;
    var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                                 .getService(nsIShellService);
    var appTypes = shellService.shouldBeDefaultClientFor;

    // show the default client dialog only if we should check for the default
    // client and we aren't already the default for the stored app types in
    // shell.checkDefaultApps
    if (appTypes && shellService.shouldCheckDefaultClient &&
        !shellService.isDefaultClient(true, appTypes)) {
      window.openDialog("chrome://communicator/content/defaultClientDialog.xul",
                        "DefaultClient",
                        "modal,centerscreen,chrome,resizable=no"); 
      // Force the sidebar to build since the windows 
      // integration dialog has come up.
      SidebarRebuild();
    }
  }
}

function ShowAndSelectContentsOfURLBar()
{
  if (!isElementVisible(gURLBar)) {
    BrowserOpenWindow();
    return;
  }

  if (!gURLBar.readOnly) {
    if (gURLBar.value)
      gURLBar.select();
    else
      gURLBar.focus();
  }
}

// If "ESC" is pressed in the url bar, we replace the urlbar's value with the url of the page
// and highlight it, unless it is about:blank, where we reset it to "".
function handleURLBarRevert()
{
  var url = getWebNavigation().currentURI.spec;
  var throbberElement = document.getElementById("navigator-throbber");

  var isScrolling = gURLBar.userAction == "scrolling";
  
  // don't revert to last valid url unless page is NOT loading
  // and user is NOT key-scrolling through autocomplete list
  if (!throbberElement.hasAttribute("busy") && !isScrolling) {
    URLBarSetURI();

    // If the value isn't empty, select it.
    if (gURLBar.value)
      gURLBar.select();
  }

  // tell widget to revert to last typed text only if the user
  // was scrolling when they hit escape
  return isScrolling;
}

function handleURLBarCommand(aUserAction, aTriggeringEvent)
{
  try {
    addToUrlbarHistory(gURLBar.value);
  } catch (ex) {
    // Things may go wrong when adding url to session history,
    // but don't let that interfere with the loading of the url.
  }
  
  BrowserLoadURL(aTriggeringEvent); 
}

function UpdatePageProxyState()
{
  if (gURLBar.value != gLastValidURLStr)
    SetPageProxyState("invalid", null);
}

function SetPageProxyState(aState, aURI)
{
  if (!gProxyButton)
    gProxyButton = document.getElementById("page-proxy-button");
  if (!gProxyFavIcon)
    gProxyFavIcon = document.getElementById("page-proxy-favicon");
  if (!gProxyDeck)
    gProxyDeck = document.getElementById("page-proxy-deck");

  gProxyButton.setAttribute("pageproxystate", aState);

  if (aState == "valid") {
    gLastValidURLStr = gURLBar.value;
    gURLBar.addEventListener("input", UpdatePageProxyState, false);
    if (gBrowser.shouldLoadFavIcon(aURI)) {
      var favStr = gBrowser.buildFavIconString(aURI);
      if (favStr != gProxyFavIcon.src) {
        gBrowser.loadFavIcon(aURI, "src", gProxyFavIcon);
        gProxyDeck.selectedIndex = 0;
      }
      else gProxyDeck.selectedIndex = 1;
    }
    else {
      gProxyDeck.selectedIndex = 0;
      gProxyFavIcon.removeAttribute("src");
    }
  } else if (aState == "invalid") {
    gURLBar.removeEventListener("input", UpdatePageProxyState, false);
    gProxyDeck.selectedIndex = 0;
    gProxyFavIcon.removeAttribute("src");
  }
}

function PageProxyDragGesture(aEvent)
{
  if (gProxyButton.getAttribute("pageproxystate") == "valid") {
    nsDragAndDrop.startDrag(aEvent, proxyIconDNDObserver);
    return true;
  }
  return false;
}

function handlePageProxyClick(aEvent)
{
  switch (aEvent.button) {
  case 0:
    // bug 52784 - select location field contents
    gURLBar.select();
    break;
  case 1:
    // bug 111337 - load url/keyword from clipboard
    middleMousePaste(aEvent);
    break;
  }
}

function updateComponentBarBroadcaster()
{ 
  var compBarBroadcaster = document.getElementById('cmd_viewcomponentbar');
  var taskBarBroadcaster = document.getElementById('cmd_viewtaskbar');
  var compBar = document.getElementById('component-bar');
  if (taskBarBroadcaster.getAttribute('checked') == 'true') {
    compBarBroadcaster.removeAttribute('disabled');
    if (compBar.getAttribute('hidden') != 'true')
      compBarBroadcaster.setAttribute('checked', 'true');
  }
  else {
    compBarBroadcaster.setAttribute('disabled', 'true');
    compBarBroadcaster.removeAttribute('checked');
  }
}

function updateToolbarStates(toolbarMenuElt)
{
  updateComponentBarBroadcaster();

  const tabbarMenuItem = document.getElementById("menuitem_showhide_tabbar");
  // Make show/hide menu item reflect current state
  const visibility = gBrowser.getStripVisibility();
  tabbarMenuItem.setAttribute("checked", visibility);

  // Don't allow the tab bar to be shown/hidden when more than one tab is open
  // or when we have 1 tab and the autoHide pref is set
  const disabled = gBrowser.browsers.length > 1 ||
                   Services.prefs.getBoolPref("browser.tabs.autoHide");
  tabbarMenuItem.setAttribute("disabled", disabled);
}

function showHideTabbar()
{
  const visibility = gBrowser.getStripVisibility();
  Services.prefs.setBoolPref("browser.tabs.forceHide", visibility);
  gBrowser.setStripVisibilityTo(!visibility);
}

function BrowserFullScreen()
{
  window.fullScreen = !window.fullScreen;
}

function onFullScreen()
{
  FullScreen.toggle();
}

function UpdateStatusBarPopupIcon(aEvent)
{
  if (aEvent && aEvent.originalTarget != gBrowser.getNotificationBox())
    return;

  var showIcon = Services.prefs.getBoolPref("privacy.popups.statusbar_icon_enabled");
  if (showIcon) {
    var popupIcon = document.getElementById("popupIcon");
    popupIcon.hidden = !gBrowser.getNotificationBox().popupCount;
  }
}

function StatusbarViewPopupManager()
{
  var hostPort = "";
  try {
    hostPort = getBrowser().selectedBrowser.currentURI.hostPort;
  }
  catch(ex) { }
  
  // open whitelist with site prefilled to unblock
  viewPopups(hostPort);
}

function popupBlockerMenuShowing(event)
{
  var separator = document.getElementById("popupMenuSeparator");

  if (separator)
    separator.hidden = !createShowPopupsMenu(event.target, gBrowser.selectedBrowser);
}

function toHistory()
{
  toOpenWindowByType("history:manager", "chrome://communicator/content/history/history.xul");
}

function checkTheme(popup)
{
  while (popup.lastChild.localName != 'menuseparator')
    popup.removeChild(popup.lastChild);
  gThemes.forEach(function(theme) {
    var menuitem = document.createElement('menuitem');
    menuitem.setAttribute("label", theme.name);
    menuitem.setAttribute("type", "radio");
    menuitem.setAttribute("name", "themeGroup");
    if (!theme.userDisabled)
      menuitem.setAttribute("checked", "true");
    else if (!(theme.permissions & AddonManager.PERM_CAN_ENABLE))
      menuitem.setAttribute("disabled", "true");
    menuitem.theme = theme;
    popup.appendChild(menuitem);
  });
}

// opener may not have been initialized by load time (chrome windows only)
// so call this function some time later.
function maybeInitPopupContext()
{
  // it's not a popup with no opener
  if (!window.content.opener)
    return null;

  try {
    // are we a popup window?
    const CI = Components.interfaces;
    var xulwin = window
                 .QueryInterface(CI.nsIInterfaceRequestor)
                 .getInterface(CI.nsIWebNavigation)
                 .QueryInterface(CI.nsIDocShellTreeItem).treeOwner
                 .QueryInterface(CI.nsIInterfaceRequestor)
                 .getInterface(CI.nsIXULWindow);
    if (xulwin.contextFlags &
        CI.nsIWindowCreator2.PARENT_IS_LOADING_OR_RUNNING_TIMEOUT) {
      // return our opener's URI
      return Services.io.newURI(window.content.opener.location.href, null, null);
    }
  } catch(e) {
  }
  return null;
}

function WindowIsClosing()
{
  var browser = getBrowser();
  var cn = browser.tabContainer.childNodes;
  var numtabs = cn.length;
  var reallyClose = true;

  if (!/Mac/.test(navigator.platform) && isClosingLastBrowser()) {
    let closingCanceled = Components.classes["@mozilla.org/supports-PRBool;1"]
                                    .createInstance(Components.interfaces.nsISupportsPRBool);
    Services.obs.notifyObservers(closingCanceled, "browser-lastwindow-close-requested", null);
    if (closingCanceled.data)
      return false;

    Services.obs.notifyObservers(null, "browser-lastwindow-close-granted", null);

    return true;
  }

  if (numtabs > 1) {
    var shouldPrompt = Services.prefs.getBoolPref("browser.tabs.warnOnClose");
    if (shouldPrompt) {
      //default to true: if it were false, we wouldn't get this far
      var warnOnClose = {value:true};

       var buttonPressed = Services.prompt.confirmEx(window,
         gNavigatorBundle.getString('tabs.closeWarningTitle'),
         gNavigatorBundle.getFormattedString("tabs.closeWarning", [numtabs]),
         (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0)
            + (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1),
            gNavigatorBundle.getString('tabs.closeButton'),
            null, null,
            gNavigatorBundle.getString('tabs.closeWarningPromptMe'),
            warnOnClose);
      reallyClose = (buttonPressed == 0);
      //don't set the pref unless they press OK and it's false
      if (reallyClose && !warnOnClose.value) {
        Services.prefs.setBoolPref("browser.tabs.warnOnClose", false);
      }
    } //if the warn-me pref was true
  } //if multiple tabs are open

  for (var i = 0; reallyClose && i < numtabs; ++i) {
    var ds = browser.getBrowserForTab(cn[i]).docShell;
  
    if (ds.contentViewer && !ds.contentViewer.permitUnload())
      reallyClose = false;
  }

  return reallyClose;
}

/**
 * Checks whether this is the last full *browser* window around.
 * @returns true if closing last browser window, false if not.
 */
function isClosingLastBrowser() {
  // Popups aren't considered full browser windows.
  if (!toolbar.visible)
    return false;

  // Figure out if there's at least one other browser window around.
  var e = Services.wm.getEnumerator("navigator:browser");
  while (e.hasMoreElements()) {
    let win = e.getNext();
    if (win != window && win.toolbar.visible)
      return false;
  }

  return true;
}

/**
 * file upload support
 */

/* This function returns the URI of the currently focused content frame
 * or frameset.
 */
function getCurrentURI()
{
  const CI = Components.interfaces;

  var focusedWindow = document.commandDispatcher.focusedWindow;
  var contentFrame = isContentFrame(focusedWindow) ? focusedWindow : window.content;

  var nav = contentFrame.QueryInterface(CI.nsIInterfaceRequestor)
                        .getInterface(CI.nsIWebNavigation);
  return nav.currentURI;
}

function uploadFile(fileURL)
{
  const CI = Components.interfaces;

  var targetBaseURI = getCurrentURI();

  // generate the target URI.  we use fileURL.file.leafName to get the
  // unicode value of the target filename w/o any URI-escaped chars.
  // this gives the protocol handler the best chance of generating a
  // properly formatted URI spec.  we pass null for the origin charset
  // parameter since we want the URI to inherit the origin charset
  // property from targetBaseURI.

  var leafName = fileURL.QueryInterface(CI.nsIFileURL).file.leafName;

  var targetURI = Services.io.newURI(leafName, null, targetBaseURI);

  // ok, start uploading...
  openDialog("chrome://communicator/content/downloads/uploadProgress.xul", "",
             "titlebar,centerscreen,minimizable,dialog=no", fileURL, targetURI);
}

function BrowserUploadFile()
{
  try {
    uploadFile(selectFileToOpen("uploadFile", "browser.upload."));
  } catch (e) {}
}

/* This function is called whenever the file menu is about to be displayed.
 * Enable the upload menu item if appropriate. */
function updateFileUploadItem()
{
  var canUpload = false;
  try {
    canUpload = getCurrentURI().schemeIs('ftp');
  } catch (e) {}

  var item = document.getElementById('Browser:UploadFile');
  if (canUpload)
    item.removeAttribute('disabled');
  else
    item.setAttribute('disabled', 'true');
}

function isBidiEnabled()
{
  var rv = false;

  var systemLocale;
  try {
    systemLocale = Services.locale.getSystemLocale()
                                  .getCategory("NSILOCALE_CTYPE");
    rv = /^(he|ar|syr|fa|ur)-/.test(systemLocale);
  } catch (e) {}

  if (!rv) {
    // check the overriding pref
    rv = Services.prefs.getBoolPref("bidi.browser.ui");
  }

  return rv;
}

function SwitchDocumentDirection(aWindow)
{
  aWindow.document.dir = (aWindow.document.dir == "ltr" ? "rtl" : "ltr");

  for (var run = 0; run < aWindow.frames.length; run++)
    SwitchDocumentDirection(aWindow.frames[run]);
}

function updateSavePageItems()
{
  var autoDownload = Services.prefs
                             .getBoolPref("browser.download.useDownloadDir");
  goSetMenuValue("savepage", autoDownload ? "valueSave" : "valueSaveAs");
}

function convertFromUnicode(charset, str)
{
  try {
    var unicodeConverter = Components
       .classes["@mozilla.org/intl/scriptableunicodeconverter"]
       .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    unicodeConverter.charset = charset;
    str = unicodeConverter.ConvertFromUnicode(str);
    return str + unicodeConverter.Finish();
  } catch(ex) {
    return null; 
  }
}

function getNotificationBox(aWindow)
{
  return aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIWebNavigation)
                .QueryInterface(Components.interfaces.nsIDocShell)
                .chromeEventHandler.parentNode.wrappedJSObject;
}

function BrowserToolboxCustomizeInit()
{
  SetPageProxyState("invalid", null);
  toolboxCustomizeInit("main-menubar");
  PlacesToolbarHelper.customizeStart();
}

function BrowserToolboxCustomizeDone(aToolboxChanged)
{
  toolboxCustomizeDone("main-menubar", getNavToolbox(), aToolboxChanged);

  UpdateNavBar();

  // Update the urlbar
  var value = gBrowser.userTypedValue;
  if (value == null)
    URLBarSetURI();
  else
    gURLBar.value = value;

  PlacesToolbarHelper.customizeDone();
}

function BrowserToolboxCustomizeChange(event)
{
  toolboxCustomizeChange(getNavToolbox(), event);
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
      case "TabSelect":
        this._resetPreview();
        break;
    }
  },

  get _manager () {
    var temp = {};
    Components.utils.import("resource://gre/modules/LightweightThemeManager.jsm", temp);
    delete this._manager;
    return this._manager = temp.LightweightThemeManager;
  },

  _installRequest: function (event) {
    var node = event.target;
    var data = this._getThemeFromNode(node);
    if (!data)
      return;

    if (this._isAllowed(node)) {
      this._install(data);
      return;
    }

    var allowButtonText =
      gNavigatorBundle.getString("lwthemeInstallRequest.allowButton");
    var allowButtonAccesskey =
      gNavigatorBundle.getString("lwthemeInstallRequest.allowButton.accesskey");
    var message =
      gNavigatorBundle.getFormattedString("lwthemeInstallRequest.message",
                                          [node.ownerDocument.location.host]);
    var buttons = [{
      label: allowButtonText,
      accessKey: allowButtonAccesskey,
      callback: function () {
        return LightWeightThemeWebInstaller._install(data);
      }
    }];

    this._removePreviousNotifications();

    var notificationBox = gBrowser.getNotificationBox();
    var notificationBar =
      notificationBox.appendNotification(message, "lwtheme-install-request", "",
                                         notificationBox.PRIORITY_INFO_MEDIUM,
                                         buttons);
    notificationBar.persistence = 1;
  },

  _install: function (newTheme) {
    var previousTheme = this._manager.currentTheme;
    this._manager.currentTheme = newTheme;
    if (this._manager.currentTheme &&
        this._manager.currentTheme.id == newTheme.id) {
      this._postInstallNotification(newTheme, previousTheme);
      // Posting the install notification destroys the permission notification,
      // so tell the former that it's closed already.
      return true;
    }
    return false;
  },

  _postInstallNotification: function (newTheme, previousTheme) {
    function text(id) {
      return gNavigatorBundle.getString("lwthemePostInstallNotification." + id);
    }

    var buttons = [{
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
        toEM("addons://list/theme");
      }
    }];

    this._removePreviousNotifications();

    var notificationBox = gBrowser.getNotificationBox();
    var notificationBar =
      notificationBox.appendNotification(text("message"),
                                         "lwtheme-install-notification", "",
                                         notificationBox.PRIORITY_INFO_MEDIUM,
                                         buttons);
    notificationBar.persistence = 1;
    notificationBar.timeout = Date.now() + 20000; // 20 seconds
  },

  _removePreviousNotifications: function () {
    var box = gBrowser.getNotificationBox();

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

    var data = this._getThemeFromNode(event.target);
    if (!data)
      return;

    this._resetPreview();

    this._previewWindow = event.target.ownerDocument.defaultView;
    this._previewWindow.addEventListener("pagehide", this, true);
    gBrowser.tabContainer.addEventListener("TabSelect", this, false);

    this._manager.previewTheme(data);
  },

  _resetPreview: function (event) {
    if (!this._previewWindow ||
        event && !this._isAllowed(event.target))
      return;

    this._previewWindow.removeEventListener("pagehide", this, true);
    this._previewWindow = null;
    gBrowser.tabContainer.removeEventListener("TabSelect", this, false);

    this._manager.resetPreview();
  },

  _isAllowed: function (node) {
    var uri = node.ownerDocument.documentURIObject;
    return Services.perms.testPermission(uri, "install") == Services.perms.ALLOW_ACTION;
  },

  _getThemeFromNode: function (node) {
    return this._manager.parseTheme(node.getAttribute("data-browsertheme"),
                                    node.baseURI);
  }
}
