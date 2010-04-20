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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function tabProgressListener(aTab, aStartsBlank) {
  this.mTab = aTab;
  this.mBrowser = aTab.browser;
  this.mBlank = aStartsBlank;
}

tabProgressListener.prototype =
{
  mTab: null,
  mBrowser: null,
  mBlank: null,

  // cache flags for correct status bar update after tab switching
  mStateFlags: 0,
  mStatus: 0,
  mMessage: "",

  // count of open requests (should always be 0 or 1)
  mRequestCount: 0,

  onProgressChange: function tPL_onProgressChange(aWebProgress, aRequest,
                                                  aCurSelfProgress,
                                                  aMaxSelfProgress,
                                                  aCurTotalProgress,
                                                  aMaxTotalProgress) {
  },
  onProgressChange64: function tPL_onProgressChange64(aWebProgress, aRequest,
                                                      aCurSelfProgress,
                                                      aMaxSelfProgress,
                                                      aCurTotalProgress,
                                                      aMaxTotalProgress) {
  },
  onLocationChange: function tPL_onLocationChange(aWebProgress, aRequest,
                                                  aLocationURI) {
    var location = aLocationURI ? aLocationURI.spec : "";

    // Set the reload command only if this is a report that is coming in about
    // the top-level content location change.
    if (aWebProgress.DOMWindow == this.mBrowser.contentWindow) {
      // Although we're unlikely to be loading about:blank, we'll check it
      // anyway just in case. The second condition is for new tabs, otherwise
      // the reload function is enabled until tab is refreshed.
      this.mTab.reloadEnabled =
        !((location == "about:blank" && !this.mBrowser.contentWindow.opener) ||
          location == "");
    }
  },
  onStateChange: function tPL_onStateChange(aWebProgress, aRequest, aStateFlags,
                                            aStatus) {
    if (!aRequest)
      return;

    var oldBlank = this.mBlank;

    const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;
    const nsIChannel = Components.interfaces.nsIChannel;
    let tabmail = document.getElementById("tabmail");

    if (aStateFlags & nsIWebProgressListener.STATE_START) {
      this.mRequestCount++;
    }
    else if (aStateFlags & nsIWebProgressListener.STATE_STOP) {
      // Since we (try to) only handle STATE_STOP of the last request,
      // the count of open requests should now be 0.
      this.mRequestCount = 0;
    }

    if (aStateFlags & nsIWebProgressListener.STATE_START &&
        aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
      if (!this.mBlank) {
        this.mTab.title = specialTabs.contentTabType.loadingTabString;
        tabmail.setTabBusy(this.mTab, true);
        tabmail.setTabTitle(this.mTab);
      }
    }
    else if (aStateFlags & nsIWebProgressListener.STATE_STOP &&
             aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
      this.mBlank = false;

      tabmail.setTabBusy(this.mTab, false);
      tabmail.setTabTitle(this.mTab);
    }
  },
  onStatusChange: function tPL_onStatusChange(aWebProgress, aRequest, aStatus,
                                              aMessage) {
  },
  onSecurityChange: function tPL_onSecurityChange(aWebProgress, aRequest,
                                                  aState) {
  },
  onRefreshAttempted: function tPL_OnRefreshAttempted(aWebProgress, aURI,
                                                      aDelay, aSameURI) {
  },
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIWebProgressListener,
                                         Components.interfaces.nsIWebProgressListener2,
                                         Components.interfaces.nsISupportsWeakReference])
};

var specialTabs = {
  _kAboutRightsVersion: 1,
  get _protocolSvc() {
    delete this._protocolSvc;
    return this._protocolSvc =
      Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                .getService(Components.interfaces.nsIExternalProtocolService);
  },

  // This will open any special tabs if necessary on startup.
  openSpecialTabsOnStartup: function() {
    window.addEventListener("unload", specialTabs.onunload, false);

    Components.classes["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService)
              .addObserver(specialTabs, "mail-startup-done", false);

    let tabmail = document.getElementById('tabmail');

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    tabmail.registerTabType(this.contentTabType);
    tabmail.registerTabType(this.chromeTabType);

    // If we've upgraded:
    let [fromVer, toVer] = this.getApplicationUpgradeVersions(prefs);

    // Only show what's new tab if this is actually an upgraded version,
    // not just a new installation/profile.
    if (fromVer && fromVer != toVer)
      this.showWhatsNewPage();

    // Show the about rights notification if we need to.
    if (this.shouldShowAboutRightsNotification(prefs))
      this.showAboutRightsNotification(prefs);
  },

  /**
   * A tab to show content pages.
   */
  contentTabType: {
    name: "contentTab",
    perTabPanel: "vbox",
    lastBrowserId: 0,
    get loadingTabString() {
      delete this.loadingTabString;
      return this.loadingTabString = document.getElementById("bundle_messenger")
                                             .getString("loadingTab");
    },

    modes: {
      contentTab: {
        type: "contentTab",
        maxTabs: 10
      }
    },
    shouldSwitchTo: function onSwitchTo({contentPage: aContentPage}) {
      let tabmail = document.getElementById("tabmail");
      let tabInfo = tabmail.tabInfo;

      // Remove any anchors - especially for the about: pages, we just want
      // to re-use the same tab.
      let regEx = new RegExp("#.*");

      let contentUrl = aContentPage.replace(regEx, "");

      for (let selectedIndex = 0; selectedIndex < tabInfo.length;
           ++selectedIndex) {
        if (tabInfo[selectedIndex].mode.name == this.name &&
            tabInfo[selectedIndex].browser.currentURI.spec
                                  .replace(regEx, "") == contentUrl) {
          // Ensure we go to the correct location on the page.
          tabInfo[selectedIndex].browser
                                .setAttribute("src", aContentPage);
          return selectedIndex;
        }
      }
      return -1;
    },
    openTab: function onTabOpened(aTab, aArgs) {
      if (!"contentPage" in aArgs)
        throw("contentPage must be specified");

      // First clone the page and set up the basics.
      let clone = document.getElementById("contentTab").firstChild.cloneNode(true);

      clone.setAttribute("id", "contentTab" + this.lastBrowserId);
      clone.setAttribute("collapsed", false);

      aTab.panel.appendChild(clone);

      // Start setting up the browser.
      aTab.browser = aTab.panel.getElementsByTagName("browser")[0];

      // As we're opening this tab, showTab may not get called, so set
      // the type according to if we're opening in background or not.
      let background = ("background" in aArgs) && aArgs.background;
      aTab.browser.setAttribute("type", background ? "content-targetable" :
                                                     "content-primary");

      aTab.browser.setAttribute("id", "contentTabBrowser" + this.lastBrowserId);

      aTab.browser.setAttribute("onclick",
                                "clickHandler" in aArgs && aArgs.clickHandler ?
                                aArgs.clickHandler :
                                "specialTabs.defaultClickHandler(event);");

      // Now initialise the find bar.
      aTab.findbar = aTab.panel.getElementsByTagName("findbar")[0];
      aTab.findbar.setAttribute("browserid",
                                "contentTabBrowser" + this.lastBrowserId);

      // Default to reload being disabled.
      aTab.reloadEnabled = false;

      // Now set up the listeners.
      this._setUpTitleListener(aTab);
      this._setUpCloseWindowListener(aTab);

      // Create a filter and hook it up to our browser
      let filter = Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"]
                             .createInstance(Components.interfaces.nsIWebProgress);
      aTab.filter = filter;
      aTab.browser.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

      // Wire up a progress listener to the filter for this browser
      aTab.progressListener = new tabProgressListener(aTab, false);

      filter.addProgressListener(aTab.progressListener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

      // Now start loading the content.
      aTab.title = this.loadingTabString;

      aTab.browser.loadURI(aArgs.contentPage);

      this.lastBrowserId++;
    },
    closeTab: function onTabClosed(aTab) {
      aTab.browser.removeEventListener("DOMTitleChanged",
                                       aTab.titleListener, true);
      aTab.browser.removeEventListener("DOMWindowClose",
                                       aTab.closeListener, true);
      aTab.browser.webProgress.removeProgressListener(aTab.filter);
      aTab.filter.removeProgressListener(aTab.progressListener);
      aTab.browser.destroy();
    },
    saveTabState: function onSaveTabState(aTab) {
      aTab.browser.setAttribute("type", "content-targetable");
    },
    showTab: function onShowTab(aTab) {
      aTab.browser.setAttribute("type", "content-primary");
    },
    persistTab: function onPersistTab(aTab) {
      if (aTab.browser.currentURI.spec == "about:blank")
        return null;

      let onClick = aTab.browser.getAttribute("onclick");

      return {
        tabURI: aTab.browser.currentURI.spec,
        clickHandler: onClick ? onClick : null
      };
    },
    restoreTab: function onRestoreTab(aTabmail, aPersistedState) {
      aTabmail.openTab("contentTab", { contentPage: aPersistedState.tabURI,
                                       clickHandler: aPersistedState.clickHandler,
                                       background: true } );
    },
    supportsCommand: function supportsCommand(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
        case "cmd_fullZoomEnlarge":
        case "cmd_fullZoomReset":
        case "cmd_fullZoomToggle":
        case "cmd_find":
        case "cmd_findAgain":
        case "cmd_findPrevious":
        case "cmd_printSetup":
        case "cmd_print":
        case "button_print":
        case "cmd_stop":
        case "cmd_reload":
        // XXX print preview not currently supported - bug 497994 to implement.
        // case "cmd_printpreview":
          return true;
        default:
          return false;
      }
    },
    isCommandEnabled: function isCommandEnabled(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
        case "cmd_fullZoomEnlarge":
        case "cmd_fullZoomReset":
        case "cmd_fullZoomToggle":
        case "cmd_find":
        case "cmd_findAgain":
        case "cmd_findPrevious":
        case "cmd_printSetup":
        case "cmd_print":
        case "button_print":
        // XXX print preview not currently supported - bug 497994 to implement.
        // case "cmd_printpreview":
          return true;
        case "cmd_reload":
          return aTab.reloadEnabled;
        case "cmd_stop":
          return aTab.busy;
        default:
          return false;
      }
    },
    doCommand: function isCommandEnabled(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
          ZoomManager.reduce();
          break;
        case "cmd_fullZoomEnlarge":
          ZoomManager.enlarge();
          break;
        case "cmd_fullZoomReset":
          ZoomManager.reset();
          break;
        case "cmd_fullZoomToggle":
          ZoomManager.toggleZoom();
          break;
        case "cmd_find":
          aTab.findbar.onFindCommand();
          break;
        case "cmd_findAgain":
          aTab.findbar.onFindAgainCommand(false);
          break;
        case "cmd_findPrevious":
          aTab.findbar.onFindAgainCommand(true);
          break;
        case "cmd_printSetup":
          PrintUtils.showPageSetup();
          break;
        case "cmd_print":
          PrintUtils.print();
          break;
        // XXX print preview not currently supported - bug 497994 to implement.
        //case "cmd_printpreview":
        //  PrintUtils.printPreview();
        //  break;
        case "cmd_stop":
          aTab.browser.stop();
          break;
        case "cmd_reload":
          aTab.browser.reload();
          break;
      }
    },
    getBrowser: function getBrowser(aTab) {
      return aTab.browser;
    },
    // Internal function used to set up the title listener on a content tab.
    _setUpTitleListener: function setUpTitleListener(aTab) {
      function onDOMTitleChanged(aEvent) {
        aTab.title = aTab.browser.contentTitle;
        document.getElementById("tabmail").setTabTitle(aTab);
      }
      // Save the function we'll use as listener so we can remove it later.
      aTab.titleListener = onDOMTitleChanged;
      // Add the listener.
      aTab.browser.addEventListener("DOMTitleChanged",
                                    aTab.titleListener, true);
    },
    /**
     * Internal function used to set up the close window listener on a content
     * tab.
     */
    _setUpCloseWindowListener: function setUpCloseWindowListener(aTab) {
      function onDOMWindowClose(aEvent) {
        if (!aEvent.isTrusted)
          return;

        // Redirect any window.close events to closing the tab. As a 3-pane tab
        // must be open, we don't need to worry about being the last tab open.
        document.getElementById("tabmail").closeTab(aTab);
        aEvent.preventDefault();
      }
      // Save the function we'll use as listener so we can remove it later.
      aTab.closeListener = onDOMWindowClose;
      // Add the listener.
      aTab.browser.addEventListener("DOMWindowClose",
                                    aTab.closeListener, true);
    }
  },

  /**
   * In the case of an upgrade, returns the version we're upgrading
   * from, as well as the current version.  In the case of a fresh profile,
   * or the pref being set to ignore - return null and the current version.
   * In either case, updates the pref with the latest version.
   */
  getApplicationUpgradeVersions: function(prefs) {
    let savedAppVersion = null;
    let prefstring = "mailnews.start_page_override.mstone";

    try {
      savedAppVersion = prefs.getCharPref(prefstring);
    } catch (ex) {}

    let currentApplicationVersion = Application.version;

    if (savedAppVersion == "ignore")
      return [null, currentApplicationVersion];

    if (savedAppVersion != currentApplicationVersion)
      prefs.setCharPref(prefstring, currentApplicationVersion);

    return [savedAppVersion, currentApplicationVersion];
  },

  /**
   * Shows the what's new page in a content tab.
   */
  showWhatsNewPage: function onShowWhatsNewPage() {
    openWhatsNew();
  },

  /**
   * Looks at the existing prefs and determines if we should show about:rights
   * or not.
   *
   * This is controlled by two prefs:
   *
   *   mail.rights.override
   *     If this pref is set to false, always show the about:rights
   *     notification.
   *     If this pref is set to true, never show the about:rights notification.
   *     If the pref doesn't exist, then we fallback to checking
   *     mail.rights.version.
   *
   *   mail.rights.version
   *     If this pref isn't set or the value is less than the current version
   *     then we show the about:rights notification.
   */
  shouldShowAboutRightsNotification: function(prefs) {
    try {
      return !prefs.getBoolPref("mail.rights.override");
    } catch (e) { }

    return prefs.getIntPref("mail.rights.version") < this._kAboutRightsVersion;
  },

  showAboutRightsNotification: function(prefs) {
    var notifyBox = document.getElementById("mail-notification-box");

    var stringBundle =
      Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService);
    var brandBundle =
      stringBundle.createBundle("chrome://branding/locale/brand.properties");
    var rightsBundle =
      stringBundle.createBundle("chrome://messenger/locale/aboutRights.properties");

    var productName = brandBundle.GetStringFromName("brandFullName");
    var notifyRightsText = rightsBundle.formatStringFromName("notifyRightsText",
                                                             [productName], 1);

    var buttons = [
      {
        label: rightsBundle.GetStringFromName("buttonLabel"),
        accessKey: rightsBundle.GetStringFromName("buttonAccessKey"),
        popup: null,
        callback: function(aNotificationBar, aButton) {
          // Show the about:rights tab
          document.getElementById('tabmail')
                  .openTab("contentTab", { contentPage: "about:rights",
                                           clickHandler: "specialTabs.aboutClickHandler(event);" });
        }
      }
    ];

    var box = notifyBox.appendNotification(notifyRightsText, "about-rights",
                                           null, notifyBox.PRIORITY_INFO_LOW,
                                           buttons);
    // arbitrary number, just so bar sticks around for a bit
    box.persistence = 3;

    // Set the pref to say we've displayed the notification.
    prefs.setIntPref("mail.rights.version", this._kAboutRightsVersion);
  },

  /**
   * Handles links when displaying about: pages. Anything that is an about:
   * link can be loaded internally, other links are redirected to an external
   * browser.
   */
  aboutClickHandler: function aboutClickHandler(aEvent) {
    // Don't handle events that: a) aren't trusted, b) have already been
    // handled or c) aren't left-click.
    if (!aEvent.isTrusted || aEvent.getPreventDefault() || aEvent.button)
      return true;

    let href = hRefForClickEvent(aEvent, true);
    if (href) {
      let uri = makeURI(href);
      if (!this._protocolSvc.isExposedProtocol(uri.scheme) ||
          uri.schemeIs("http") || uri.schemeIs("https")) {
        aEvent.preventDefault();
        openLinkExternally(href);
      }
    }
  },

  /**
   * The default click handler for content tabs. Any clicks on links will get
   * redirected to an external browser - effectively keeping the user on one
   * page.
   */
  defaultClickHandler: function defaultClickHandler(aEvent) {
    // Don't handle events that: a) aren't trusted, b) have already been
    // handled or c) aren't left-click.
    if (!aEvent.isTrusted || aEvent.getPreventDefault() || aEvent.button)
      return true;

    let href = hRefForClickEvent(aEvent, true);

    // We've explicitly allowed http, https and about as additional exposed
    // protocols in our default prefs, so these are the ones we need to check
    // for here.
    if (href) {
      let uri = makeURI(href);
      if (!this._protocolSvc.isExposedProtocol(uri.scheme) ||
          uri.schemeIs("http") || uri.schemeIs("https") ||
          uri.schemeIs("about")) {
        aEvent.preventDefault();
        openLinkExternally(href);
      }
    }
  },

  /**
   * A site click handler for extensions to use. This does its best to limit
   * loading of links that match the regexp to within the content tab it applies
   * to within Thunderbird. Links that do not match the regexp will be loaded
   * in the external browser.
   *
   * Note: Due to the limitations of http and the possibility for redirects, if
   * sites change or use javascript, this function may not be able to ensure the
   * contentTab stays "within" a site. Extensions using this function should
   * consider this when implementing the extension.
   *
   * @param aEvent      The onclick event that is being handled.
   * @param aSiteRegexp A regexp to match against to determine if the link
   *                    clicked on should be loaded within the browser or not.
   */
  siteClickHandler: function siteClickHandler(aEvent, aSiteRegexp) {
    // Don't handle events that: a) aren't trusted, b) have already been
    // handled or c) aren't left-click.
    if (!aEvent.isTrusted || aEvent.getPreventDefault() || aEvent.button)
      return true;

    let href = hRefForClickEvent(aEvent, true);

    // We've explicitly allowed http, https and about as additional exposed
    // protocols in our default prefs, so these are the ones we need to check
    // for here.
    if (href) {
      let uri = makeURI(href);
      if (!this._protocolSvc.isExposedProtocol(uri.scheme) ||
          ((uri.schemeIs("http") || uri.schemeIs("https") ||
            uri.schemeIs("about")) && !aSiteRegexp.test(uri.spec))) {
        aEvent.preventDefault();
        openLinkExternally(href);
      }
    }
  },

  chromeTabType: {
    name: "chromeTab",
    perTabPanel: "vbox",
    lastBrowserId: 0,
    get loadingTabString() {
      delete this.loadingTabString;
      return this.loadingTabString = document.getElementById("bundle_messenger")
                                             .getString("loadingTab");
    },

    modes: {
      chromeTab: {
        type: "chromeTab",
        maxTabs: 10
      }
    },
    shouldSwitchTo: function onSwitchTo({chromePage: achromePage}) {
      let tabmail = document.getElementById("tabmail");
      let tabInfo = tabmail.tabInfo;

      // Remove any anchors - especially for the about: pages, we just want
      // to re-use the same tab.
      let regEx = new RegExp("#.*");

      let contentUrl = achromePage.replace(regEx, "");

      for (let selectedIndex = 0; selectedIndex < tabInfo.length;
           ++selectedIndex) {
        if (tabInfo[selectedIndex].mode.name == this.name &&
            tabInfo[selectedIndex].browser.currentURI.spec
                                  .replace(regEx, "") == contentUrl) {
          // Ensure we go to the correct location on the page.
          tabInfo[selectedIndex].browser
                                .setAttribute("src", achromePage);
          return selectedIndex;
        }
      }
      return -1;
    },
    openTab: function onTabOpened(aTab, aArgs) {
      if (!"chromePage" in aArgs)
        throw("chromePage must be specified");

      // First clone the page and set up the basics.
      let clone = document.getElementById("chromeTab").firstChild.cloneNode(true);

      clone.setAttribute("id", "chromeTab" + this.lastBrowserId);
      clone.setAttribute("collapsed", false);

      aTab.panel.appendChild(clone);

      // Start setting up the browser.
      aTab.browser = aTab.panel.getElementsByTagName("browser")[0];

      // As we're opening this tab, showTab may not get called, so set
      // the type according to if we're opening in background or not.
      let background = ("background" in aArgs) && aArgs.background;
      // XXX not setting type as it's chrome
      //aTab.browser.setAttribute("type", background ? "content-targetable" :
      //                                               "content-primary");

      aTab.browser.setAttribute("onclick",
                                "clickHandler" in aArgs && aArgs.clickHandler ?
                                aArgs.clickHandler :
                                "specialTabs.defaultClickHandler(event);");

      aTab.browser.setAttribute("id", "chromeTabBrowser" + this.lastBrowserId);

      // Now set up the listeners.
      this._setUpTitleListener(aTab);
      this._setUpCloseWindowListener(aTab);

      // Now start loading the content.
      aTab.title = this.loadingTabString;
      aTab.browser.loadURI(aArgs.chromePage);

      this.lastBrowserId++;
    },
    closeTab: function onTabClosed(aTab) {
      aTab.browser.removeEventListener("DOMTitleChanged",
                                       aTab.titleListener, true);
      aTab.browser.removeEventListener("DOMWindowClose",
                                       aTab.closeListener, true);
      aTab.browser.destroy();
    },
    saveTabState: function onSaveTabState(aTab) {
    },
    showTab: function onShowTab(aTab) {
    },
    persistTab: function onPersistTab(aTab) {
      if (aTab.browser.currentURI.spec == "about:blank")
        return null;

      let onClick = aTab.browser.getAttribute("onclick");

      return {
        tabURI: aTab.browser.currentURI.spec,
        clickHandler: onClick ? onClick : null
      };
    },
    restoreTab: function onRestoreTab(aTabmail, aPersistedState) {
      aTabmail.openTab("chromeTab", { chromePage: aPersistedState.tabURI,
                                      clickHandler: aPersistedState.clickHandler,
                                      background: true } );
    },
    onTitleChanged: function onTitleChanged(aTab) {
      aTab.title = aTab.browser.contentDocument.title;
    },
    supportsCommand: function supportsCommand(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
        case "cmd_fullZoomEnlarge":
        case "cmd_fullZoomReset":
        case "cmd_fullZoomToggle":
        case "cmd_printSetup":
        case "cmd_print":
        case "button_print":
        // XXX print preview not currently supported - bug 497994 to implement.
        // case "cmd_printpreview":
          return true;
        default:
          return false;
      }
    },
    isCommandEnabled: function isCommandEnabled(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
        case "cmd_fullZoomEnlarge":
        case "cmd_fullZoomReset":
        case "cmd_fullZoomToggle":
        case "cmd_printSetup":
        case "cmd_print":
        case "button_print":
        // XXX print preview not currently supported - bug 497994 to implement.
        // case "cmd_printpreview":
          return true;
        default:
          return false;
      }
    },
    doCommand: function isCommandEnabled(aCommand, aTab) {
      switch (aCommand) {
        case "cmd_fullZoomReduce":
          ZoomManager.reduce();
          break;
        case "cmd_fullZoomEnlarge":
          ZoomManager.enlarge();
          break;
        case "cmd_fullZoomReset":
          ZoomManager.reset();
          break;
        case "cmd_fullZoomToggle":
          ZoomManager.toggleZoom();
          break;
        case "cmd_printSetup":
          PrintUtils.showPageSetup();
          break;
        case "cmd_print":
          PrintUtils.print();
          break;
        // XXX print preview not currently supported - bug 497994 to implement.
        //case "cmd_printpreview":
        //  PrintUtils.printPreview();
        //  break;
      }
    },
    getBrowser: function getBrowser(aTab) {
      return aTab.browser;
    },
    // Internal function used to set up the title listener on a content tab.
    _setUpTitleListener: function setUpTitleListener(aTab) {
      function onDOMTitleChanged(aEvent) {
        document.getElementById("tabmail").setTabTitle(aTab);
      }
      // Save the function we'll use as listener so we can remove it later.
      aTab.titleListener = onDOMTitleChanged;
      // Add the listener.
      aTab.browser.addEventListener("DOMTitleChanged",
                                    aTab.titleListener, true);
    },
    /**
     * Internal function used to set up the close window listener on a content
     * tab.
     */
    _setUpCloseWindowListener: function setUpCloseWindowListener(aTab) {
      function onDOMWindowClose(aEvent) {
      try {
        if (!aEvent.isTrusted)
          return;

        // Redirect any window.close events to closing the tab. As a 3-pane tab
        // must be open, we don't need to worry about being the last tab open.
        document.getElementById("tabmail").closeTab(aTab);
        aEvent.preventDefault();
      } catch (e) {
        logException(e);
      }
      }
      // Save the function we'll use as listener so we can remove it later.
      aTab.closeListener = onDOMWindowClose;
      // Add the listener.
      aTab.browser.addEventListener("DOMWindowClose",
                                    aTab.closeListener, true);
    }
  },

  observe: function (aSubject, aTopic, aData) {
    if (aTopic != "mail-startup-done")
      return;

    let obsService =
      Components.classes["@mozilla.org/observer-service;1"]
                .getService(Components.interfaces.nsIObserverService);

    obsService.removeObserver(specialTabs, "mail-startup-done");
    obsService.addObserver(this.xpInstallObserver, "xpinstall-install-blocked", false);
  },

  onunload: function () {
    window.removeEventListener("unload", specialTabs.onunload, false);

    Components.classes["@mozilla.org/observer-service;1"]
      .getService(Components.interfaces.nsIObserverService)
      .removeObserver(specialTabs.xpInstallObserver, "xpinstall-install-blocked");
  },

  xpInstallObserver: {
    get _prefService() {
      delete this._prefService;
      return this._prefService =
        Components.classes["@mozilla.org/preferences-service;1"]
                  .getService(Components.interfaces.nsIPrefBranch2);
    },

    observe: function (aSubject, aTopic, aData) {
      let brandBundle = document.getElementById("bundle_brand");
      let messengerBundle = document.getElementById("bundle_messenger");
      switch (aTopic) {
      case "xpinstall-install-blocked":
        let installInfo =
          aSubject.QueryInterface(Components.interfaces.nsIXPIInstallInfo);
        let win = installInfo.originatingWindow;
        let notificationBox = getNotificationBox(win.top);
        if (notificationBox) {
          let host = installInfo.originatingURI.host;
          let brandShortName = brandBundle.getString("brandShortName");
          let notificationName, messageString, buttons;
          if (!this._prefService.getBoolPref("xpinstall.enabled")) {
            notificationName = "xpinstall-disabled";
            if (this._prefService.prefIsLocked("xpinstall.enabled")) {
              messageString = messengerBundle.getString("xpinstallDisabledMessageLocked");
              buttons = [];
            }
            else {
              messageString = messengerBundle.getString("xpinstallDisabledMessage");

              buttons = [{
                label: messengerBundle.getString("xpinstallDisabledButton"),
                accessKey: messengerBundle.getString("xpinstallDisabledButton.accesskey"),
                popup: null,
                callback: function editPrefs() {
                  specialTabs.xpInstallObserver
                             ._prefService.setBoolPref("xpinstall.enabled", true);
                  return false;
                }
              }];
            }
          }
          else {
            notificationName = "xpinstall";
            messageString = messengerBundle.getFormattedString("xpinstallPromptWarning",
                                                               [brandShortName, host]);

            buttons = [{
              label: messengerBundle.getString("xpinstallPromptAllowButton"),
              accessKey: messengerBundle.getString("xpinstallPromptAllowButton.accesskey"),
              popup: null,
              callback: function() {
                var mgr = Components.classes["@mozilla.org/xpinstall/install-manager;1"]
                  .createInstance(Components.interfaces.nsIXPInstallManager);
                mgr.initManagerWithInstallInfo(installInfo);
                return false;
              }
            }];
          }

          if (!notificationBox.getNotificationWithValue(notificationName)) {
            const priority = notificationBox.PRIORITY_WARNING_MEDIUM;
            const iconURL = "chrome://mozapps/skin/update/update.png";
            notificationBox.appendNotification(messageString, notificationName,
                                               iconURL, priority, buttons);
          }
        }
        break;
      }
    }
  }
};
