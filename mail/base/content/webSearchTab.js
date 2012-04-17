/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Mozilla Thunderbird.
 *
 * The Initial Developer of the Original Code is
 *   Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozilla.com>
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/errUtils.js");

/**
 * A tab to show search results.
 */
let webSearchTabType = {
  __proto__: contentTabBaseType,
  name: "webSearchTab",
  perTabPanel: "vbox",
  lastBrowserId: 0,
  bundle: Services.strings.createBundle(
    "chrome://messenger/locale/messenger.properties"),
  protoSvc: Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                      .getService(Components.interfaces.nsIExternalProtocolService),

  get loadingTabString() {
    delete this.loadingTabString;
    return this.loadingTabString = document.getElementById("bundle_messenger")
                                           .getString("loadingTab");
  },

  modes: {
    webSearchTab: {
      type: "webSearchTab",
      maxTabs: 10
    }
  },

  initialize: function() {
    let browser = document.getElementById("dummywebsearchbrowser");

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

    let tabmail = document.getElementById("tabmail");
    tabmail.registerTabType(this);
  },

  openTab: function onTabOpened(aTab, aArgs) {
    if (!"contentPane" in aArgs || !"engine" in aArgs || !"query" in aArgs)
      throw("contentPage, engine, and query must be specified");

    // First clone the page and set up the basics.
    let clone = document.getElementById("webSearchTab").firstChild
                        .cloneNode(true);

    clone.setAttribute("id", "webSearchTab" + this.lastBrowserId);
    clone.setAttribute("collapsed", false);

    aTab.panel.appendChild(clone);

    aTab.engines = clone.getElementsByClassName("engines")[0];
    aTab.defaultButton = clone.getElementsByClassName("defaultButton")[0];

    // Start setting up the browser.
    aTab.browser = aTab.panel.getElementsByTagName("browser")[0];

    // As we're opening this tab, showTab may not get called, so set
    // the type according to if we're opening in background or not.
    let background = ("background" in aArgs) && aArgs.background;
    aTab.browser.setAttribute("type", background ? "content-targetable" :
                                                   "content-primary");

    aTab.browser.setAttribute("id", "webSearchTabBrowser" + this.lastBrowserId);

    aTab.clickHandler = "clickHandler" in aArgs && aArgs.clickHandler ?
                        aArgs.clickHandler :
                        "specialTabs.defaultClickHandler(event);";
    aTab.browser.setAttribute("onclick", aTab.clickHandler);

    aTab.browser.addEventListener("DOMLinkAdded", DOMLinkHandler, false);
    gPluginHandler.addEventListeners(aTab.browser);

    // Now initialise the find bar.
    aTab.findbar = aTab.panel.getElementsByTagName("findbar")[0];
    aTab.findbar.setAttribute("browserid",
                              "webSearchTabBrowser" + this.lastBrowserId);

    // Default to reload being disabled.
    aTab.reloadEnabled = false;

    aTab.currentEngine = aArgs.engine;
    aTab.query = aArgs.query;

    for each (let engine in Services.search.getVisibleEngines()) {
      let button = document.createElement("toolbarbutton");
      button.setAttribute("type", "radio");
      button.setAttribute("group", "engines");
      button.setAttribute("image", engine.iconURI.spec);
      button.setAttribute("tooltiptext", engine.name);
      button.engine = engine;
      if (aArgs.engine.name == engine.name)
        button.setAttribute("checked", true);
      aTab.engines.appendChild(button);
    }

    // Now set up the listeners.
    this._setUpTitleListener(aTab);
    this._setUpCloseWindowListener(aTab);
    this._setUpBrowserListener(aTab);

    // Now start loading the content.
    aTab.title = this.loadingTabString;

    this._setDefaultButtonState(aTab, aTab.currentEngine ==
                                      Services.search.currentEngine);

    // Set up onclick/oncommand listeners.
    let self = this;
    aTab.engines.addEventListener("command", function(event) {
      if (event.target.localName != "toolbarbutton")
        return;
      self._doSearch(aTab, event.target.engine);
      self._setDefaultButtonState(aTab, aTab.currentEngine ==
                                        Services.search.currentEngine);
    }, true);
    aTab.defaultButton.addEventListener("click", function () {
      Services.search.currentEngine = aTab.currentEngine;
      self._setDefaultButtonState(aTab, true);
    }, true);

    aTab.browser.loadURIWithFlags(aArgs.contentPage, null, null, null,
                                  aArgs.postData);

    goUpdateCommand("cmd_goBackSearch");
    goUpdateCommand("cmd_goForwardSearch");

    this.lastBrowserId++;
  },

  persistTab: function onPersistTab(aTab) {
    if (aTab.browser.currentURI.spec == "about:blank")
      return null;

    let onClick = aTab.clickHandler;

    return { tabURI: aTab.browser.currentURI.spec,
             query: aTab.query,
             engine: aTab.currentEngine.name,
             clickHandler: onClick ? onClick : null,
           };
  },

  restoreTab: function onRestoreTab(aTabmail, aPersistedState) {
    let engine = Services.search.getEngineByName(aPersistedState.engine);
    aTabmail.openTab("webSearchTab",
                     { contentPage: aPersistedState.tabURI,
                       clickHandler: aPersistedState.clickHandler,
                       query: aPersistedState.query,
                       engine: engine,
                       background: true,
                     });
  },

  siteClickHandler: function(aEvent) {
    // Don't handle events that: a) aren't trusted, b) have already been
    // handled or c) aren't left-click.
    if (!aEvent.isTrusted || aEvent.defaultPrevented || aEvent.button)
      return true;

    let href = hRefForClickEvent(aEvent, true);
    if (href) {
      let tab = document.getElementById("tabmail").selectedTab;
      let preUri = tab.browser.currentURI;
      let postUri = makeURI(href);

      if (!this.protoSvc.isExposedProtocol(postUri.scheme) ||
          postUri.schemeIs("http") || postUri.schemeIs("https")) {
        if (!this._isInEngine(tab.currentEngine, preUri, postUri)) {
          aEvent.preventDefault();
          openLinkExternally(href);
        }
      }
    }
  },

  commands: {
    cmd_goBackSearch: {
      isEnabled: function(aTab) {
        return aTab.browser.canGoBack;
      },
      doCommand: function(aTab) {
        aTab.browser.goBack();
      }
    },

    cmd_goForwardSearch: {
      isEnabled: function(aTab) {
        return aTab.browser.canGoForward;
      },
      doCommand: function(aTab) {
        aTab.browser.goForward();
      }
    },
  },

  supportsCommand: function supportsCommand(aCommand, aTab) {
    return (aCommand in this.commands) ||
           this.__proto__.supportsCommand(aCommand, aTab);
  },

  isCommandEnabled: function isCommandEnabled(aCommand, aTab) {
    if (!this.supportsCommand(aCommand))
      return;

    if (aCommand in this.commands)
      return this.commands[aCommand].isEnabled(aTab);
    else
      return this.__proto__.isCommandEnabled(aCommand, aTab);
  },

  doCommand: function doCommand(aCommand, aTab) {
    if (!this.supportsCommand(aCommand))
      return;

    if (aCommand in this.commands) {
      var cmd = this.commands[aCommand];
      if (!cmd.isEnabled(aTab))
        return;
      cmd.doCommand(aTab);
    } else {
      this.__proto__.doCommand(aCommand, aTab);
    }
  },

  _doSearch: function(aTab, engine) {
    aTab.currentEngine = engine;
    let submission = aTab.currentEngine.getSubmission(aTab.query);

    aTab.browser.loadURIWithFlags(submission.uri.spec, null, null, null,
                                  submission.postData);
  },

  _isInEngine: function(aEngine, aPreUri, aPostUri) {
    switch (aEngine.name) {
      case "Google":
        return aPreUri.host == aPostUri.host &&
               /^\/search\?/.test(aPostUri.path);
      case "Yahoo":
        return /search\.yahoo\.com$/.test(aPostUri.host) &&
               !/^\/r\//.test(aPostUri.path);
    }

    return aPreUri.host == aPostUri.host;
  },

  _setDefaultButtonState: function setDefaultButtonState(aTab, isDefault) {
    aTab.defaultButton.checked = isDefault;
    let key = "websearch." + (isDefault ? "isDefault" : "setDefault");
    aTab.defaultButton.tooltipText = this.bundle.GetStringFromName(key);
  },

  _setUpBrowserListener: function setUpBrowserListener(aTab) {
    // Browser navigation (front/back) does not cause onDOMContentLoaded,
    // so we have to use nsIWebProgressListener
    this.progressListener = {
      QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsIWebProgressListener,
        Components.interfaces.nsISupportsWeakReference,
      ]),

      onLocationChange: function(aProgress, aRequest, aURI) {
        goUpdateCommand("cmd_goBackSearch");
        goUpdateCommand("cmd_goForwardSearch");
      },

      onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {},
      onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf,
                                 curTot, maxTot) {},
      onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function(aWebProgress, aRequest, aState) {},
    };

    aTab.browser.addProgressListener(this.progressListener);

    // Create a filter and hook it up to our browser
    aTab.filter = Components.classes["@mozilla.org/appshell/component/browser-status-filter;1"]
                            .createInstance(Components.interfaces.nsIWebProgress);

    // Wire up a progress listener to the filter for this browser
    aTab.progressListener = new tabProgressListener(aTab, false);

    aTab.filter.addProgressListener(aTab.progressListener,
                                    Components.interfaces.nsIWebProgress.NOTIFY_ALL);
    aTab.browser.webProgress.addProgressListener(aTab.filter,
                                                 Components.interfaces.nsIWebProgress.NOTIFY_ALL);
  },
};
