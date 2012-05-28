/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");

/**
 * A content tab for the account provisioner.  We use Javascript-y magic to
 * "subclass" specialTabs.contentTabType, and then override the appropriate
 * members.
 */
let accountProvisionerTabType = Object.create(specialTabs.contentTabType, {
  name: {value: "accountProvisionerTab"},
  modes: {value: {
    accountProvisionerTab: {
      type: "accountProvisionerTab",
      maxTabs: 1,
    }
  }},
  _log: {value: Log4Moz.getConfiguredLogger("mail.provider")},
});

/**
 * Here, we're overriding openTab - first we call the openTab of contentTab
 * (for the context of this accountProvisionerTab "aTab") and then passing
 * special arguments "realName", "email" and "searchEngine" from the caller
 * of openTab, and passing those to our _setMonitoring function.
 */
accountProvisionerTabType.openTab = function(aTab, aArgs) {
  aArgs.clickHandler = "accountProvisionerTabType.clickHandler(event);";
  specialTabs.contentTabType.openTab.call(this, aTab, aArgs);

  this._setMonitoring(aTab.browser, aArgs.realName, aArgs.email,
                      aArgs.searchEngine);
}

/**
 * We're overriding closeTab - first, we call the closeTab of contentTab,
 * (for the context of this accountProvisionerTab "aTab"), and then we
 * unregister our observer that was registered in _setMonitoring.
 */
accountProvisionerTabType.closeTab = function(aTab) {
  specialTabs.contentTabType.closeTab.call(this, aTab);
  this._log.info("Performing account provisioner cleanup");
  this._log.info("Removing httpRequestObserver");
  Services.obs.removeObserver(this._observer, "http-on-examine-response");
  this._log.info("Account provisioner cleanup is done.");
}

/**
 * This function registers an observer to watch for HTTP requests where the
 * contentType contains text/xml.
 */
accountProvisionerTabType._setMonitoring = function(aBrowser, aRealName,
                                                    aEmail, aSearchEngine) {
  let mail3Pane = Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow("mail:3pane");

  // We'll construct our special observer (defined in urlListener.js)
  // that will watch for requests where the contentType contains
  // text/xml.
  this._observer = new mail3Pane.httpRequestObserver(aBrowser, {
    realName: aRealName,
    email: aEmail,
    searchEngine: aSearchEngine,
  });

  // Register our observer
  Services.obs.addObserver(this._observer, "http-on-examine-response",
                           false);

  this._log.info("httpRequestObserver wired up.");
}

/**
 * Click handler for the Account Provisioner tab that allows all links
 * to open within the current content tab, except for those which have
 * their targets set to _blank - these links open in the default browser.
 */
accountProvisionerTabType.clickHandler = function(aEvent) {
  // Don't handle events that: a) aren't trusted, b) have already been
  // handled or c) aren't left-click.
  if (!aEvent.isTrusted || aEvent.defaultPrevented || aEvent.button)
    return true;

  let href = hRefForClickEvent(aEvent, true);

  // Check to see if we're set to open the link externally...
  if (aEvent.target.hasAttribute("target")) {
    if (aEvent.target.target == "_blank") {
      aEvent.preventDefault();
      openLinkExternally(href);
    }
  }

  return false;
}
