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
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource:///modules/StringBundle.js");

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
    // onLocationChange is called for both the top-level content
    // and the subframes.
    if (aWebProgress.DOMWindow == this.mBrowser.contentWindow) {
      // Don't clear the favicon if this onLocationChange was triggered
      // by a pushState or a replaceState. See bug 550565.
      if (aWebProgress.isLoadingDocument &&
          !(this.mBrowser.docShell.loadType &
            Components.interfaces.nsIDocShell.LOAD_CMD_PUSHSTATE))
        this.mBrowser.mIconURL = null;

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

      // Set our unit testing variables accordingly
      this.mTab.pageLoading = true;
      this.mTab.pageLoaded = false;
    }
    else if (aStateFlags & nsIWebProgressListener.STATE_STOP &&
             aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
      this.mBlank = false;
      tabmail.setTabBusy(this.mTab, false);
      tabmail.setTabTitle(this.mTab);

      // Set our unit testing variables accordingly
      this.mTab.pageLoading = false;
      this.mTab.pageLoaded = true;

      // If we've finished loading, and we've not had an icon loaded from a
      // link element, then we try using the default icon for the site.
      if (aWebProgress.DOMWindow == this.mBrowser.contentWindow &&
        !this.mBrowser.mIconURL)
        specialTabs.useDefaultIcon(this.mTab);
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

const DOMLinkHandler = {
  handleEvent: function (event) {
    switch (event.type) {
    case "DOMLinkAdded":
      this.onLinkAdded(event);
      break;
    }
  },
  onLinkAdded: function (event) {
    let link = event.originalTarget;
    let rel = link.rel && link.rel.toLowerCase();
    if (!link || !link.ownerDocument || !rel || !link.href)
      return;

    if (rel.split(/\s+/).indexOf("icon") != -1) {
      if (!Services.prefs.getBoolPref("browser.chrome.site_icons"))
        return;

      let targetDoc = link.ownerDocument;
      let uri = makeURI(link.href, targetDoc.characterSet);

      // Is this a failed icon?
      if (specialTabs.mFaviconService.isFailedFavicon(uri))
        return;

      // Verify that the load of this icon is legal.
      // Some error or special pages can load their favicon.
      // To be on the safe side, only allow chrome:// favicons.
      let isAllowedPage = [
        /^about:neterror\?/,
        /^about:blocked\?/,
        /^about:certerror\?/,
        /^about:home$/
      ].some(function (re) { re.test(targetDoc.documentURI); });

      if (!isAllowedPage || !uri.schemeIs("chrome")) {
        // Be extra paraniod and just make sure we're not going to load
        // something we shouldn't. Firefox does this, so we're doing the same.
        let ssm = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
          .getService(Components.interfaces.nsIScriptSecurityManager);

          try {
            ssm.checkLoadURIWithPrincipal(targetDoc.nodePrincipal, uri,
                                          Components.interfaces.nsIScriptSecurityManager.DISALLOW_SCRIPT);
          }
          catch (ex) {
            return;
          }
      }

      const nsIContentPolicy = Components.interfaces.nsIContentPolicy;

      try {
        var contentPolicy = Components.classes["@mozilla.org/layout/content-policy;1"]
          .getService(nsIContentPolicy);
      }
      catch (e) {
        // Refuse to load if we can't do a security check.
        return;
      }

      // Security says okay, now ask content policy. This is probably trying to
      // ensure that the image loaded always obeys the content policy. There
      // may have been a chance that it was cached and we're trying to load it
      // direct from the cache and not the normal route.
      if (contentPolicy.shouldLoad(nsIContentPolicy.TYPE_IMAGE,
                                   uri, targetDoc.documentURIObject,
                                   link, link.type, null) !=
                                   nsIContentPolicy.ACCEPT)
        return;

      let tab = document.getElementById("tabmail")
                        .getBrowserForDocument(targetDoc.defaultView);

      // If we don't have a browser/tab, then don't load the icon.
      if (!tab)
        return;

      // Just set the url on the browser and we'll display the actual icon
      // when we finish loading the page.
      specialTabs.setTabIcon(tab, link.href);
    }
  }
};

const kTelemetryPrompted    = "toolkit.telemetry.prompted";
const kTelemetryEnabled     = "toolkit.telemetry.enabled";
const kTelemetryServerOwner = "toolkit.telemetry.server_owner";

var specialTabs = {
  _kAboutRightsVersion: 1,
  get _protocolSvc() {
    delete this._protocolSvc;
    return this._protocolSvc =
      Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                .getService(Components.interfaces.nsIExternalProtocolService);
  },

  get mFaviconService() {
    delete this.mFaviconService;
    return this.mFaviconService =
      Components.classes["@mozilla.org/browser/favicon-service;1"]
                .getService(Components.interfaces.nsIFaviconService);
  },

  // This will open any special tabs if necessary on startup.
  openSpecialTabsOnStartup: function() {
    window.addEventListener("unload", specialTabs.onunload, false);

    let browser = document.getElementById("dummycontentbrowser");

    // Manually hook up session and global history for the first browser
    // so that we don't have to load global history before bringing up a
    // window.
    // Wire up session and global history before any possible
    // progress notifications for back/forward button updating
    browser.webNavigation.sessionHistory =
      Components.classes["@mozilla.org/browser/shistory;1"]
                .createInstance(Components.interfaces.nsISHistory);
    Services.obs.addObserver(browser, "browser:purge-session-history", false);

    // remove the disablehistory attribute so the browser cleans up, as
    // though it had done this work itself
    browser.removeAttribute("disablehistory");

    // enable global history
    try {
      browser.docShell.QueryInterface(Components.interfaces.nsIDocShellHistory)
             .useGlobalHistory = true;
    } catch(ex) {
      Components.utils.reportError("Places database may be locked: " + ex);
    }

    Services.obs.addObserver(specialTabs, "mail-startup-done", false);

    let tabmail = document.getElementById('tabmail');

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);

    tabmail.registerTabType(this.contentTabType);
    tabmail.registerTabType(this.chromeTabType);

    // If we've upgraded:
    let [fromVer, toVer] = this.getApplicationUpgradeVersions(prefs);

    // Only show what's new tab if this is actually an upgraded version,
    // not just a new installation/profile.
    if (fromVer && ((fromVer[0] != toVer[0]) || (fromVer[1] != toVer[1])))
      this.showWhatsNewPage();

    // Show the about rights notification if we need to.
    if (this.shouldShowAboutRightsNotification(prefs))
      this.showAboutRightsNotification(prefs);
    else if (this.shouldShowTelemetryNotification(prefs))
      this.showTelemetryNotification(prefs);
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
    /**
     * This is the internal function used by content tabs to open a new tab. To
     * open a contentTab, use specialTabs.openTab("contentTab", aArgs)
     *
     * @param aArgs The options that content tabs accept.
     * @param aArgs.contentPage A string that holds the URL that is to be opened
     * @param aArgs.clickHandler The click handler for that content tab. See the
     *  "Content Tabs" article on MDC.
     * @param aArgs.onLoad A function that takes an Event and a DOMNode. It is
     *  called when the content page is done loading. The first argument is the
     *  load event, and the second argument is the xul:browser that holds the
     *  contentPage. You can access the inner tab's window object by accessing
     *  the second parameter's contentWindow property.
     */
    openTab: function contentTab_onTabOpened(aTab, aArgs) {
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

      aTab.clickHandler = "clickHandler" in aArgs && aArgs.clickHandler ?
                          aArgs.clickHandler :
                          "specialTabs.defaultClickHandler(event);";
      aTab.browser.setAttribute("onclick", aTab.clickHandler);

      // Set this attribute so that when favicons fail to load, we remove the
      // image attribute and just show the default tab icon.
      aTab.tabNode.setAttribute("onerror", "this.removeAttribute('image');");

      aTab.browser.addEventListener("DOMLinkAdded", DOMLinkHandler, false);
      gPluginHandler.addEventListeners(aTab.browser);

      // Now initialise the find bar.
      aTab.findbar = aTab.panel.getElementsByTagName("findbar")[0];
      aTab.findbar.setAttribute("browserid",
                                "contentTabBrowser" + this.lastBrowserId);

      // Default to reload being disabled.
      aTab.reloadEnabled = false;

      // Now set up the listeners.
      this._setUpTitleListener(aTab);
      this._setUpCloseWindowListener(aTab);
      if ("onLoad" in aArgs) {
        aTab.browser.addEventListener("load", function _contentTab_onLoad (event) {
          aArgs.onLoad(event, aTab.browser);
        }, true);
      }

      // Create a filter and hook it up to our browser
      let filter = Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"]
                             .createInstance(Components.interfaces.nsIWebProgress);
      aTab.filter = filter;
      aTab.browser.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

      // Wire up a progress listener to the filter for this browser
      aTab.progressListener = new tabProgressListener(aTab, false);

      filter.addProgressListener(aTab.progressListener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

      // Initialize our unit testing variables.
      aTab.pageLoading = false;
      aTab.pageLoaded = false;

      // Now start loading the content.
      aTab.title = this.loadingTabString;

      aTab.browser.loadURI(aArgs.contentPage);

      this.lastBrowserId++;
    },
    tryCloseTab: function onTryCloseTab(aTab) {
      let docShell = aTab.browser.docShell;
      // If we have a docshell, a contentViewer, and it forbids us from closing
      // the tab, then we return false, which means, we can't close the tab. All
      // other cases return true.
      return !(docShell && docShell.contentViewer
        && !docShell.contentViewer.permitUnload());
    },
    closeTab: function onTabClosed(aTab) {
      aTab.browser.removeEventListener("DOMTitleChanged",
                                       aTab.titleListener, true);
      aTab.browser.removeEventListener("DOMWindowClose",
                                       aTab.closeListener, true);
      aTab.browser.removeEventListener("DOMLinkAdded", DOMLinkHandler, false);
      gPluginHandler.removeEventListeners(aTab.browser);
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

      let onClick = aTab.clickHandler;

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
   * Split a version number into a triple (major, minor, extension)
   * For example, 7.0.1 => [7, 0, 1]
   *             10.1a3 => [10, 1, a3]
   *             10.0 => [10, 0, ""]
   * This could be a static function, but no current reason for it to
   * be available outside this object's scope; as a method, it doesn't
   * pollute anyone else's namespace
   */
  splitVersion: function(version) {
    let re = /^(\d+)\.(\d+)\.?(.*)$/;
    let fields = re.exec(version);
    /* First element of the array from regex match is the entire string; drop that */
    fields.shift();
    return fields;
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
      return [null, this.splitVersion(currentApplicationVersion)];

    if (savedAppVersion != currentApplicationVersion)
      prefs.setCharPref(prefstring, currentApplicationVersion);

    return [this.splitVersion(savedAppVersion), this.splitVersion(currentApplicationVersion)];
  },

  /**
   * Shows the what's new page in a content tab.
   */
  showWhatsNewPage: function onShowWhatsNewPage() {
    openWhatsNew();
  },

  /**
   * Looks at the existing prefs and determines if we should suggest the user
   * enables telemetry or not.
   *
   * This is controlled by the pref toolkit.telemetry.prompted
   */
  shouldShowTelemetryNotification: function(prefs) {
    // toolkit has decided that the pref should have no default value
    try {
      if (prefs.getBoolPref(kTelemetryPrompted) || prefs.getBoolPref(kTelemetryEnabled))
        return false;
    } catch (e) { }
    return true;
  },

  showTelemetryNotification: function(prefs) {
    var notifyBox = document.getElementById("mail-notification-box");

    var brandBundle =
      new StringBundle("chrome://branding/locale/brand.properties");
    var telemetryBundle =
      new StringBundle("chrome://messenger/locale/telemetry.properties");

    var productName = brandBundle.get("brandFullName");
    var serverOwner = prefs.getCharPref(kTelemetryServerOwner);
    var telemetryText = telemetryBundle.get("telemetryText", [productName, serverOwner]);

    var buttons = [
      {
        label:     telemetryBundle.get("telemetryYesButtonLabel"),
        accessKey: telemetryBundle.get("telemetryYesButtonAccessKey"),
        popup:     null,
        callback:  function(aNotificationBar, aButton) {
          prefs.setBoolPref(kTelemetryEnabled, true);
        }
      },
      {
        label:     telemetryBundle.get("telemetryNoButtonLabel"),
        accessKey: telemetryBundle.get("telemetryNoButtonAccessKey"),
        popup:     null,
        callback:  function(aNotificationBar, aButton) {}
      }
    ];

    // Set pref to indicate we've shown the notification.
    prefs.setBoolPref(kTelemetryPrompted, true);

    var notification = notifyBox.appendNotification(telemetryText, "telemetry", null, notifyBox.PRIORITY_INFO_LOW, buttons);
    notification.persistence = 3; // arbitrary number, just so bar sticks around for a bit

    let XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let link = notification.ownerDocument.createElementNS(XULNS, "label");
    link.className = "text-link telemetry-text-link";
    link.setAttribute("value", telemetryBundle.get("telemetryLinkLabel"));
    link.addEventListener('click', function() {
      openPrivacyPolicy('tab');
      // Remove the notification on which the user clicked
      notification.parentNode.removeNotification(notification, true);
      // Add a new notification to that tab, with no "Learn more" link
      notifyBox.appendNotification(telemetryText, "telemetry", null, notifyBox.PRIORITY_INFO_LOW, buttons);
    }, false);

    let description = notification.ownerDocument.getAnonymousElementByAttribute(notification, "anonid", "messageText");
    description.appendChild(link);
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
    /**
     * This is the internal function used by chrome tabs to open a new tab. To
     * open a chromeTab, use specialTabs.openTab("chromeTab", aArgs)
     *
     * @param aArgs The options that chrome tabs accept.
     * @param aArgs.chromePage A string that holds the URL that is to be opened
     * @param aArgs.clickHandler The click handler for that chrome tab. See the
     *  "Content Tabs" article on MDC.
     * @param aArgs.onLoad A function that takes an Event and a DOMNode. It is
     *  called when the chrome page is done loading. The first argument is the
     *  load event, and the second argument is the xul:browser that holds the
     *  chromePage. You can access the inner tab's window object by accessing
     *  the second parameter's chromeWindow property.
     */
    openTab: function chromeTab_onTabOpened(aTab, aArgs) {
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

      // Set this attribute so that when favicons fail to load, we remove the
      // image attribute and just show the default tab icon.
      aTab.tabNode.setAttribute("onerror", "this.removeAttribute('image');");

      aTab.browser.addEventListener("DOMLinkAdded", DOMLinkHandler, false);


      aTab.browser.setAttribute("id", "chromeTabBrowser" + this.lastBrowserId);

      // Now set up the listeners.
      this._setUpTitleListener(aTab);
      this._setUpCloseWindowListener(aTab);
      if ("onLoad" in aArgs) {
        aTab.browser.addEventListener("load", function _chromeTab_onLoad (event) {
          aArgs.onLoad(event, aTab.browser);
        }, true);
      }

      // Now start loading the content.
      aTab.title = this.loadingTabString;
      aTab.browser.loadURI(aArgs.chromePage);

      this.lastBrowserId++;
    },
    tryCloseTab: function onTryCloseTab(aTab) {
      let docShell = aTab.browser.docShell;
      // If we have a docshell, a contentViewer, and it forbids us from closing
      // the tab, then we return false, which means, we can't close the tab. All
      // other cases return true.
      return !(docShell && docShell.contentViewer
        && !docShell.contentViewer.permitUnload());
    },
    closeTab: function onTabClosed(aTab) {
      aTab.browser.removeEventListener("DOMTitleChanged",
                                       aTab.titleListener, true);
      aTab.browser.removeEventListener("DOMWindowClose",
                                       aTab.closeListener, true);
      aTab.browser.removeEventListener("DOMLinkAdded", DOMLinkHandler, false);
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

    Services.obs.removeObserver(specialTabs, "mail-startup-done");
    Services.obs.addObserver(this.xpInstallObserver, "addon-install-disabled",
                             false);
    Services.obs.addObserver(this.xpInstallObserver, "addon-install-blocked",
                             false);
    Services.obs.addObserver(this.xpInstallObserver, "addon-install-failed",
                             false);
    Services.obs.addObserver(this.xpInstallObserver, "addon-install-complete",
                             false);
  },

  onunload: function () {
    window.removeEventListener("unload", specialTabs.onunload, false);

    Services.obs.removeObserver(specialTabs.xpInstallObserver,
                                "addon-install-disabled");
    Services.obs.removeObserver(specialTabs.xpInstallObserver,
                                "addon-install-blocked");
    Services.obs.removeObserver(specialTabs.xpInstallObserver,
                                "addon-install-failed");
    Services.obs.removeObserver(specialTabs.xpInstallObserver,
                                "addon-install-complete");
  },

  xpInstallObserver: {
    observe: function (aSubject, aTopic, aData) {
      const Ci = Components.interfaces;
      let brandBundle = document.getElementById("bundle_brand");
      let messengerBundle = document.getElementById("bundle_messenger");

      let installInfo = aSubject.QueryInterface(Ci.amIWebInstallInfo);
      let win = installInfo.originatingWindow;
      let notificationBox = getNotificationBox(win.top);
      let notificationID = aTopic;
      let brandShortName = brandBundle.getString("brandShortName");
      let notificationName, messageString, buttons;
      const iconURL = "chrome://messenger/skin/icons/update.png";

      switch (aTopic) {
      case "addon-install-disabled":
        notificationID = "xpinstall-disabled";

        if (Services.prefs.prefIsLocked("xpinstall.enabled")) {
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
              Services.prefs.setBoolPref("xpinstall.enabled", true);
              return false;
            }
          }];
        }
        if (notificationBox && !notificationBox.getNotificationWithValue(notificationID)) {
          notificationBox.appendNotification(messageString, notificationID,
                                             iconURL,
                                             notificationBox.PRIORITY_CRITICAL_HIGH,
                                             buttons);
        }
        break;
      case "addon-install-blocked":
        messageString =
          messengerBundle.getFormattedString("xpinstallPromptWarning",
                                             [brandShortName, installInfo.originatingURI.host]);

        buttons = [{
          label: messengerBundle.getString("xpinstallPromptAllowButton"),
          accessKey: messengerBundle.getString("xpinstallPromptAllowButton.accesskey"),
          popup: null,
          callback: function() {
            installInfo.install();
          }
        }];

        if (notificationBox && !notificationBox.getNotificationWithValue(notificationName)) {
            notificationBox.appendNotification(messageString, notificationName,
                                               iconURL,
                                               notificationBox.PRIORITY_MEDIUM_HIGH,
                                               buttons);
          }
        break;
      case "addon-install-failed":
        // XXX TODO This isn't terribly ideal for the multiple failure case
        for (let [, install] in Iterator(installInfo.installs)) {
          let host = (installInfo.originatingURI instanceof Ci.nsIStandardURL) &&
                      installInfo.originatingURI.host;
          if (!host)
            host = (install.sourceURI instanceof Ci.nsIStandardURL) &&
                    install.sourceURI.host;

          let error = (host || install.error == 0) ?
                       "addonError" : "addonLocalError";
          if (install.error != 0)
            error += install.error;
          else if (install.addon.blocklistState == Ci.nsIBlocklistService.STATE_BLOCKED)
            error += "Blocklisted";
          else
            error += "Incompatible";

          messageString = messengerBundle.getString(error);
          messageString = messageString.replace("#1", install.name);
          if (host)
            messageString = messageString.replace("#2", host);
          messageString = messageString.replace("#3", brandShortName);
          messageString = messageString.replace("#4", Services.appinfo.version);

          if (notificationBox && !notificationBox.getNotificationWithValue(notificationID)) {
            notificationBox.appendNotification(messageString,
                                               notificationID,
                                               iconURL,
                                               notificationBox.PRIORITY_CRITICAL_HIGH,
                                               []);
          }
        }
        break;
      case "addon-install-complete":
        let needsRestart = installInfo.installs.some(function(i) {
            return i.addon.pendingOperations != AddonManager.PENDING_NONE;
        });

        if (needsRestart) {
          messageString = messengerBundle.getString("addonsInstalledNeedsRestart");
          buttons = [{
            label: messengerBundle.getString("addonInstallRestartButton"),
            accessKey: messengerBundle.getString("addonInstallRestartButton.accesskey"),
            popup: null,
            callback: function() {
              Application.restart();
            }
          }];
        }
        else {
          messageString = messengerBundle.getString("addonsInstalled");
          buttons = [{
            label: messengerBundle.getString("addonInstallManage"),
            accessKey: messengerBundle.getString("addonInstallManage.accesskey"),
            popup: null,
            callback: function() {
              // Calculate the add-on type that is most popular in the list of
              // installs.
              let types = {};
              let bestType = null;
              for (let [, install] in Iterator(installInfo.installs)) {
                if (install.type in types)
                  types[install.type]++;
                else
                  types[install.type] = 1;

                if (!bestType || types[install.type] > types[bestType])
                  bestType = install.type;

                openAddonsMgr("addons://list/" + bestType);
              }
            }
          }];
        }

        messageString = PluralForm.get(installInfo.installs.length, messageString);
        messageString = messageString.replace("#1", installInfo.installs[0].name);
        messageString = messageString.replace("#2", installInfo.installs.length);
        messageString = messageString.replace("#3", brandShortName);

        if (notificationBox)
          notificationBox.appendNotification(messageString,
                                             notificationID,
                                             iconURL,
                                             notificationBox.PRIORITY_INFO_MEDIUM,
                                             buttons);
        break;
      }
    }
  },

  /**
   * Determine if we should load fav icons or not.
   *
   * @param aURI  An nsIURI containing the current url.
   */
  _shouldLoadFavIcon: function shouldLoadFavIcon(aURI) {
    return (aURI &&
            Application.prefs.getValue("browser.chrome.site_icons", false) &&
            Application.prefs.getValue("browser.chrome.favicons", false) &&
            ("schemeIs" in aURI) &&
            (aURI.schemeIs("http") || aURI.schemeIs("https")));
  },

  /**
   * Tries to use the default favicon for a webpage for the specified tab.
   * If the web page is just an image, then we'll use the image itself it it
   * isn't too big.
   * Otherwise we'll use the site's favicon.ico if prefs allow us to.
   */
  useDefaultIcon: function useDefaultIcon(aTab) {
    let tabmail = document.getElementById('tabmail');
    var docURIObject = aTab.browser.contentDocument.documentURIObject;
    var icon = null;
    if (aTab.browser.contentDocument instanceof ImageDocument) {
      if (Services.prefs.getBoolPref("browser.chrome.site_icons")) {
        let sz = Services.prefs.getIntPref("browser.chrome.image_icons.max_size");
        try {
          let req = aTab.browser.contentDocument.imageRequest;
          if (req && req.image && req.image.width <= sz &&
              req.image.height <= sz)
            icon = aTab.browser.currentURI.spec;
        }
        catch (e) { }
      }
    }
    // Use documentURIObject in the check for shouldLoadFavIcon so that we do
    // the right thing with about:-style error pages.
    else if (this._shouldLoadFavIcon(docURIObject)) {
      let url = docURIObject.prePath + "/favicon.ico";

      if (!specialTabs.mFaviconService.isFailedFavicon(makeURI(url)))
        icon = url;
    }

    specialTabs.setTabIcon(aTab, icon);
  },

  /**
   * This sets the specified tab to load and display the given icon for the
   * page shown in the browser. It is assumed that the preferences have already
   * been checked before calling this function apprioriately.
   *
   * @param aTab  The tab to set the icon for.
   * @param aIcon A string based URL of the icon to try and load.
   */
  setTabIcon: function(aTab, aIcon) {
    if (aIcon && this.mFaviconService)
      this.mFaviconService.setAndLoadFaviconForPage(aTab.browser.currentURI,
                                                    makeURI(aIcon), false);

    // Save this off so we know about it later,
    aTab.browser.mIconURL = aIcon;
    // and display the new icon.
    document.getElementById("tabmail").setTabIcon(aTab, aIcon);
  }
};
