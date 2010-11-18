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
 * The Original Code is KaiRo's data manager.
 *
 * The Initial Developer of the Original Code is
 * Robert Kaiser <kairo@kairo.at>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Kaiser <kairo@kairo.at> (original author)
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

// locally loaded services
var gLocSvc = {};
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "eTLD",
                                   "@mozilla.org/network/effective-tld-service;1",
                                   "nsIEffectiveTLDService");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "cookie",
                                   "@mozilla.org/cookiemanager;1",
                                   "nsICookieManager2");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "pwd",
                                   "@mozilla.org/login-manager;1",
                                   "nsILoginManager");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "date",
                                   "@mozilla.org/intl/scriptabledateformat;1",
                                   "nsIScriptableDateFormat");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "fhist",
                                   "@mozilla.org/satchel/form-history;1",
                                   "nsIFormHistory2");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "url",
                                   "@mozilla.org/network/url-parser;1?auth=maybe",
                                   "nsIURLParser");
XPCOMUtils.defineLazyServiceGetter(gLocSvc, "clipboard",
                                   "@mozilla.org/widget/clipboardhelper;1",
                                   "nsIClipboardHelper");

// :::::::::::::::::::: general functions ::::::::::::::::::::
var gDataman = {
  bundle: null,
  debug: false,

  initialize: function dataman_initialize() {
    try {
      this.debug = Services.prefs.getBoolPref("data_manager.debug");
    }
    catch (e) {}
    this.bundle = document.getElementById("datamanBundle");

    Services.obs.addObserver(this, "cookie-changed", false);
    Services.obs.addObserver(this, "perm-changed", false);
    Services.obs.addObserver(this, "passwordmgr-storage-changed", false);
    Services.contentPrefs.addObserver(null, this);
    Services.obs.addObserver(this, "satchel-storage-changed", false);

    gTabs.initialize();
    gDomains.initialize();
  },

  shutdown: function dataman_shutdown() {
    Services.obs.removeObserver(this, "cookie-changed");
    Services.obs.removeObserver(this, "perm-changed");
    Services.obs.removeObserver(this, "passwordmgr-storage-changed");
    Services.contentPrefs.removeObserver(null, this);
    Services.obs.removeObserver(this, "satchel-storage-changed");

    gDomains.shutdown();
  },

  debugMsg: function dataman_debugMsg(aLogMessage) {
    if (this.debug)
      Services.console.logStringMessage(aLogMessage);
  },

  debugError: function dataman_debugError(aLogMessage) {
    if (this.debug)
      Components.utils.reportError(aLogMessage);
  },

  // :::::::::: data change observers ::::::::::
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                         Components.interfaces.nsIContentPrefObserver]),

  observe: function co_observe(aSubject, aTopic, aData) {
    gDataman.debugMsg("Observed: " + aTopic + " - " + aData);
    switch (aTopic) {
      case "cookie-changed":
        gCookies.reactToChange(aSubject, aData);
        break;
      case "perm-changed":
        gPerms.reactToChange(aSubject, aData);
        break;
      case "passwordmgr-storage-changed":
        if (/^hostSaving/.test(aData))
          gPerms.reactToChange(aSubject, aData);
        else
          gPasswords.reactToChange(aSubject, aData);
        break;
      case "satchel-storage-changed":
        gFormdata.reactToChange(aSubject, aData);
        break;
      default:
        gDataman.debugError("Unexpected change topic observed: " + aTopic);
        break;
    }
  },

  onContentPrefSet: function co_onContentPrefSet(aGroup, aName, aValue) {
    gDataman.debugMsg("Observed: content pref set");
    gPrefs.reactToChange({host: aGroup, name: aName, value: aValue}, "prefSet");
  },

  onContentPrefRemoved: function co_onContentPrefRemoved(aGroup, aName) {
    gDataman.debugMsg("Observed: content pref removed");
    gPrefs.reactToChange({host: aGroup, name: aName}, "prefRemoved");
  },

  // :::::::::: utility functions ::::::::::
  getTreeSelections: function dataman_getTreeSelections(aTree) {
    let selections = [];
    let select = aTree.view.selection;
    if (select && aTree.view.rowCount) {
      let count = select.getRangeCount();
      let min = {};
      let max = {};
      for (let i = 0; i < count; i++) {
        select.getRangeAt(i, min, max);
        for (let k = min.value; k <= max.value; k++)
          if (k != -1)
            selections.push(k);
      }
    }
    return selections;
  },

  getSelectedIDs: function dataman_getSelectedIDs(aTree, aIDFunction) {
    // Get IDs of selected elements for later restoration.
    let selectionCache = [];
    if (aTree.view.selection.count < 1 || aTree.view.rowCount < 1)
      return selectionCache;

    // Walk all selected rows and cache their IDs.
    let start = {};
    let end = {};
    let numRanges = aTree.view.selection.getRangeCount();
    for (let rg = 0; rg < numRanges; rg++){
      aTree.view.selection.getRangeAt(rg, start, end);
      for (let row = start.value; row <= end.value; row++)
        selectionCache.push(aIDFunction(row));
    }
    return selectionCache;
  },

  restoreSelectionFromIDs: function dataman_getSelectedIDs(aTree, aIDFunction, aCachedIDs) {
    // Restore selection from cached IDs (as possible).
    if (!aCachedIDs.length)
      return;

    aTree.view.selection.clearSelection();
    // Find out which current rows match a cached selection and add them to the selection.
    for (let row = 0; row < aTree.view.rowCount; row++)
      if (aCachedIDs.indexOf(aIDFunction(row)) != -1)
        aTree.view.selection.toggleSelect(row);
  },
}

// :::::::::::::::::::: base object to use as a prototype for all others ::::::::::::::::::::
var gBaseTreeView = {
  setTree: function(aTree) {},
  getImageSrc: function(aRow, aColumn) {},
  getProgressMode: function(aRow, aColumn) {},
  getCellValue: function(aRow, aColumn) {},
  isSeparator: function(aIndex) { return false; },
  isSorted: function() { return false; },
  isContainer: function(aIndex) { return false; },
  cycleHeader: function(aCol) {},
  getRowProperties: function(aRow, aProp) {},
  getColumnProperties: function(aColumn, aProp) {},
  getCellProperties: function(aRow, aColumn, aProp) {}
};

// :::::::::::::::::::: domain list ::::::::::::::::::::
var gDomains = {
  tree: null,
  searchfield: null,

  domains: {},
  domainObjects: {},
  displayedDomains: [],
  selectedDomain: {},
  xlcache: {},

  ignoreSelect: false,
  ignoreUpdate: false,

  initialize: function domain_initialize() {
    gDataman.debugMsg("Start building domain list: " + Date.now()/1000);

    this.tree = document.getElementById("domainTree");
    this.tree.view = this;

    this.searchfield = document.getElementById("domainSearch");

    // global "domain"
    this.domainObjects["*"] = {title: "*",
                               hasPreferences: Services.contentPrefs.getPrefs(null).enumerator.hasMoreElements(),
                               hasFormData: true};
    this.search("");
    this.tree.view.selection.select(0);

    let loaderInstance;
    function nextStep() {
      loaderInstance.next();
    }
    function loader() {
      // Add domains for all cookies we find.
      gDataman.debugMsg("Add cookies to domain list: " + Date.now()/1000);
      gDomains.ignoreUpdate = true;
      gCookies.loadList();
      for (let i = 0; i < gCookies.cookies.length; i++)
        gDomains.addDomainOrFlag(gCookies.cookies[i].rawHost, "hasCookies");
      gDomains.ignoreUpdate = false;
      gDomains.search(gDomains.searchfield.value);
      yield setTimeout(nextStep, 0);

      // Add domains for permissions.
      gDataman.debugMsg("Add permissions to domain list: " + Date.now()/1000);
      gDomains.ignoreUpdate = true;
      let enumerator = Services.perms.enumerator;
      while (enumerator.hasMoreElements()) {
        let nextPermission = enumerator.getNext().QueryInterface(Components.interfaces.nsIPermission);
        gDomains.addDomainOrFlag(nextPermission.host.replace(/^\./, ""), "hasPermissions");
      }
      gDomains.ignoreUpdate = false;
      gDomains.search(gDomains.searchfield.value);
      yield setTimeout(nextStep, 0);

      // Add domains for password rejects to permissions.
      gDataman.debugMsg("Add pwd reject permissions to domain list: " + Date.now()/1000);
      gDomains.ignoreUpdate = true;
      let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
      for (let i = 0; i < rejectHosts.length; i++)
        gDomains.addDomainOrFlag(rejectHosts[i], "hasPermissions");
      gDomains.ignoreUpdate = false;
      gDomains.search(gDomains.searchfield.value);
      yield setTimeout(nextStep, 0);

      // Add domains for content prefs.
      gDataman.debugMsg("Add content prefs to domain list: " + Date.now()/1000);
      gDomains.ignoreUpdate = true;
      try {
        var statement = Services.contentPrefs.DBConnection.createStatement("SELECT groups.name AS host FROM groups");
        while (statement.executeStep())
          gDomains.addDomainOrFlag(statement.row["host"], "hasPreferences");
      }
      finally {
        statement.reset();
      }
      gDomains.ignoreUpdate = false;
      gDomains.search(gDomains.searchfield.value);
      yield setTimeout(nextStep, 0);

      // Add domains for passwords.
      gDataman.debugMsg("Add passwords to domain list: " + Date.now()/1000);
      gDomains.ignoreUpdate = true;
      gPasswords.loadList();
      for (let i = 0; i < gPasswords.allSignons.length; i++) {
        gDomains.addDomainOrFlag(gPasswords.allSignons[i].hostname, "hasPasswords");
      }
      gDomains.ignoreUpdate = false;
      gDomains.search(gDomains.searchfield.value);
      yield setTimeout(nextStep, 0);

      // Send a notification that we finished.
      gDataman.debugMsg("Domain list built: " + Date.now()/1000);
      Services.obs.notifyObservers(window, "dataman-loaded", null);
      yield;
    }
    loaderInstance = loader();
    setTimeout(nextStep, 0);
  },

  shutdown: function domain_shutdown() {
    gTabs.shutdown();
    this.tree.view = null;
  },

  _getObjID: function domain__getObjID(aIdx) {
    return gDomains.displayedDomains[aIdx].title;
  },

  getDomainFromHost: function domain_getDomainFromHost(aHostname) {
    // Find the base domain name for the given host name.
    if (!this.xlcache[aHostname]) {
      // aHostname is not always an actual host name, but potentially something
      // URI-like, e.g. gopher://example.com and newURI doesn't work there as we
      // need to display entries for schemes that are not supported (any more).
      // nsIURLParser is a fast way to generically ensure a pure host name.
      // Return vars for nsIURLParser must all be objects,
      // see bug 568997 for improvements to that interface.
      var schemePos = {}, schemeLen = {}, authPos = {}, authLen = {}, pathPos = {},
          pathLen = {}, usernamePos = {}, usernameLen = {}, passwordPos = {},
          passwordLen = {}, hostnamePos = {}, hostnameLen = {}, port = {};
      gLocSvc.url.parseURL(aHostname, -1, schemePos, schemeLen, authPos, authLen,
                          pathPos, pathLen);
      var auth = aHostname.substring(authPos.value, authPos.value + authLen.value);
      gLocSvc.url.parseAuthority(auth, authLen.value, usernamePos, usernameLen,
                                passwordPos, passwordLen, hostnamePos, hostnameLen, port);
      var hostName = auth.substring(hostnamePos.value, hostnamePos.value + hostnameLen.value);

      var domain;
      try {
        domain = gLocSvc.eTLD.getBaseDomainFromHost(hostName);
      }
      catch (e) {
        domain = hostName;
      }
      this.xlcache[aHostname] = domain;
      gDataman.debugMsg("cached: " + aHostname + " -> " + this.xlcache[aHostname]);
    }
    return this.xlcache[aHostname];
  },

  hostMatchesSelected: function domain_hostMatchesSelected(aHostname) {
    return this.getDomainFromHost(aHostname) == this.selectedDomain.title;
  },

  addDomainOrFlag: function domain_addDomainOrFlag(aHostname, aFlag) {
    // For existing domains, add flags, for others, add them to the object.
    let domain = this.getDomainFromHost(aHostname);
    if (!this.domainObjects[domain]) {
      this.domainObjects[domain] = {title: domain};
      this.domainObjects[domain][aFlag] = true;
      gDataman.debugMsg("added domain: " + domain + " (with flag " + aFlag + ")");
      if (!this.ignoreUpdate)
        this.search(this.searchfield.value);
    }
    else if (!this.domainObjects[domain][aFlag]) {
      this.domainObjects[domain][aFlag] = true;
      gDataman.debugMsg("added flag " + aFlag + " to " + domain);
      if (domain == this.selectedDomain.title) {
        // Just update the tab states.
        this.select(true);
      }
    }
  },

  removeDomainOrFlag: function domain_removeDomainOrFlag(aDomain, aFlag) {
    // Remove a flag from the given domain,
    // remove the whole domain if it doesn't have any flags left.
    if (!this.domainObjects[aDomain])
      return;

    gDataman.debugMsg("removed flag " + aFlag + " from " + aDomain);
    this.domainObjects[aDomain][aFlag] = false;
    if (!this.domainObjects[aDomain].hasCookies &&
        !this.domainObjects[aDomain].hasPermissions &&
        !this.domainObjects[aDomain].hasPreferences &&
        !this.domainObjects[aDomain].hasPasswords &&
        !this.domainObjects[aDomain].hasFormData) {
      gDataman.debugMsg("removed domain: " + aDomain);
      // Get index in display tree.
      let disp_idx = -1;
      for (let i = 0; i < this.displayedDomains.length; i++) {
        if (this.displayedDomains[i] == this.domainObjects[aDomain]) {
          disp_idx = i;
          break;
        }
      }
      this.displayedDomains.splice(disp_idx, 1);
      this.tree.treeBoxObject.rowCountChanged(disp_idx, -1);
      delete this.domainObjects[aDomain];
      // Make sure we clear the data pane when selection has been removed.
      if (!this.tree.view.selection.count)
        this.select();
    }
    else {
      // Just update the tab states.
      this.select(true);
    }
  },

  resetFlagToDomains: function domain_resetFlagToDomains(aFlag, aDomainList) {
    // Reset a flag to be only set on a specific set of domains,
    // purging then-emtpy domain in the process.
    // Needed when we need to reload a complete set of items.
    gDataman.debugMsg("resetting domains for flag: " + aFlag);
    this.ignoreSelect = true;
    var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    this.tree.view.selection.clearSelection();
    // First, clear all domains of this flag.
    for (let domain in this.domainObjects) {
      this.domainObjects[domain][aFlag] = false;
    }
    // Then, set it again on all domains in the new list.
    for (let i = 0; i < aDomainList.length; i++) {
      this.addDomainOrFlag(aDomainList[i], aFlag);
    }
    // Now, purge all empty domains.
    for (let domain in this.domainObjects) {
      if (!this.domainObjects[domain].hasCookies &&
          !this.domainObjects[domain].hasPermissions &&
          !this.domainObjects[domain].hasPreferences &&
          !this.domainObjects[domain].hasPasswords &&
          !this.domainObjects[domain].hasFormData) {
        delete this.domainObjects[domain];
      }
    }
    this.search(this.searchfield.value);
    this.ignoreSelect = false;
    gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    // Make sure we clear the data pane when selection has been removed.
    if (!this.tree.view.selection.count && selectionCache.length)
      this.select();
  },

  select: function domain_select(aNoTabSelect) {
    if (this.ignoreSelect) {
      if (this.tree.view.selection.count == 1)
        this.selectedDomain = this.displayedDomains[this.tree.currentIndex];
      return;
    }

    gDataman.debugMsg("Domain selected: " + Date.now()/1000);

    if (!this.tree.view.selection.count) {
      gTabs.cookiesTab.disabled = true;
      gTabs.permissionsTab.disabled = true;
      gTabs.preferencesTab.disabled = true;
      gTabs.passwordsTab.disabled = true;
      gTabs.formdataTab.hidden = true;
      gTabs.formdataTab.disabled = true;
      gTabs.forgetTab.hidden = true;
      gTabs.forgetTab.disabled = true;
      gTabs.shutdown();
      this.selectedDomain = {title: null};
      gDataman.debugMsg("Domain select aborted (no selection)");
      return;
    }

    if (this.tree.view.selection.count > 1) {
      gDataman.debugError("Data Manager doesn't support anything but one selected domain");
      this.tree.view.selection.clearSelection();
      this.selectedDomain = {title: null};
      return;
    }
    this.selectedDomain = this.displayedDomains[this.tree.currentIndex];
    // Disable/enable and hide/show the tabs as needed.
    gTabs.cookiesTab.disabled = !this.selectedDomain.hasCookies;
    gTabs.permissionsTab.disabled = !this.selectedDomain.hasPermissions;
    gTabs.preferencesTab.disabled = !this.selectedDomain.hasPreferences;
    gTabs.passwordsTab.disabled = !this.selectedDomain.hasPasswords;
    gTabs.formdataTab.hidden = !this.selectedDomain.hasFormData;
    gTabs.formdataTab.disabled = !this.selectedDomain.hasFormData;
    gTabs.forgetTab.disabled = true;
    gTabs.forgetTab.hidden = true;
    // Switch to the first non-disabled tab if the one that's showing is
    // disabled, otherwise, you can't use the keyboard to switch tabs.
    if (gTabs.tabbox.selectedTab.disabled) {
      for (let i = 0; i < gTabs.tabbox.tabs.childNodes.length; ++i) {
        if (!gTabs.tabbox.tabs.childNodes[i].disabled) {
          gTabs.tabbox.selectedIndex = i;
          break;
        }
      }
    }
    if (!aNoTabSelect)
      gTabs.select();

    // Ensure the focus stays on our tree.
    this.tree.focus();

    gDataman.debugMsg("Domain select finished: " + Date.now()/1000);
  },

  handleKeyPress: function domain_handleKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.forget();
    }
  },

  sort: function domain_sort() {
    // compare function for two domain items
    let compfunc = function domain_sort_compare(aOne, aTwo) {
      return aOne.title.localeCompare(aTwo.title);
    };

    // Do the actual sorting of the array.
    this.displayedDomains.sort(compfunc);
    this.tree.treeBoxObject.invalidate();
  },

  forget: function domain_forget() {
    gTabs.forgetTab.hidden = false;
    gTabs.forgetTab.disabled = false;
    gTabs.tabbox.selectedTab = gTabs.forgetTab;
  },

  search: function domain_search(aSearchString) {
    this.ignoreSelect = true;
    this.tree.treeBoxObject.beginUpdateBatch();
    var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    this.tree.view.selection.clearSelection();
    this.displayedDomains = [];
    var lcSearch = aSearchString.toLocaleLowerCase();
    for (let domain in this.domainObjects) {
      if (domain.toLocaleLowerCase().indexOf(lcSearch) != -1)
        this.displayedDomains.push(this.domainObjects[domain]);
    }
    this.sort();
    gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    this.tree.treeBoxObject.endUpdateBatch();
    this.ignoreSelect = false;
    // Make sure we clear the data pane when selection has been removed.
    if (!this.tree.view.selection.count && selectionCache.length)
      this.select();
  },

  focusSearch: function domain_focusSearch() {
    this.searchfield.focus();
  },

  updateContext: function domain_updateContext() {
    let forgetCtx = document.getElementById("domain-context-forget");
    forgetCtx.disabled = !this.selectedDomain.title;
    forgetCtx.label = this.selectedDomain.title == "*" ?
                      forgetCtx.getAttribute("label_global") :
                      forgetCtx.getAttribute("label_domain");
    forgetCtx.accesskey = this.selectedDomain.title == "*" ?
                          forgetCtx.getAttribute("accesskey_global") :
                          forgetCtx.getAttribute("accesskey_domain");
  },

  // nsITreeView
  __proto__: gBaseTreeView,
  get rowCount() {
    return this.displayedDomains.length;
  },
  getCellText: function(aRow, aColumn) {
    switch (aColumn.id) {
      case "domainCol":
        return this.displayedDomains[aRow].title;
    }
  },
};

// :::::::::::::::::::: tab management ::::::::::::::::::::
var gTabs = {
  tabbox: null,
  tabs: null,
  cookiesTab: null,
  permissionsTab: null,
  preferencesTab: null,
  passwordsTab: null,
  formdataTab: null,
  forgetTab: null,

  panels: {},
  activePanel: null,

  initialize: function tabs_initialize() {
    gDataman.debugMsg("Initializing tabs");
    this.tabbox = document.getElementById("tabbox");
    this.cookiesTab = document.getElementById("cookiesTab");
    this.permissionsTab = document.getElementById("permissionsTab");
    this.preferencesTab = document.getElementById("preferencesTab");
    this.passwordsTab = document.getElementById("passwordsTab");
    this.formdataTab = document.getElementById("formdataTab");
    this.forgetTab = document.getElementById("forgetTab");

    this.panels = {
      cookiesPanel: gCookies,
      permissionsPanel: gPerms,
      preferencesPanel: gPrefs,
      passwordsPanel: gPasswords,
      formdataPanel: gFormdata,
      forgetPanel: gForget
    };
  },

  shutdown: function tabs_shutdown() {
    gDataman.debugMsg("Shutting down tabs");
    if (this.activePanel) {
      this.panels[this.activePanel].shutdown();
      this.activePanel = null;
    }
  },

  select: function tabs_select() {
    gDataman.debugMsg("Selecting tab");
    if (this.activePanel) {
      this.panels[this.activePanel].shutdown();
      this.activePanel = null;
    }

    if (!this.tabbox || this.tabbox.selectedPanel.disabled)
      return;

    this.activePanel = this.tabbox.selectedPanel.id;
    this.panels[this.activePanel].initialize();
  },

  selectAll: function tabs_selectAll() {
    try {
      this.panels[this.activePanel].selectAll();
    }
    catch (e) {
       gDataman.debugError("SelectAll didn't work for " + this.activePanel + ": " + e);
    }
  },

  focusSearch: function tabs_focusSearch() {
    try {
      this.panels[this.activePanel].focusSearch();
    }
    catch (e) {
      gDataman.debugError("focusSearch didn't work for " + this.activePanel + ": " + e);
    }
  },
};

// :::::::::::::::::::: cookies panel ::::::::::::::::::::
var gCookies = {
  tree: null,
  cookieInfoName: null,
  cookieInfoValue: null,
  cookieInfoHostLabel: null,
  cookieInfoHost: null,
  cookieInfoPath: null,
  cookieInfoSendType: null,
  cookieInfoExpires: null,
  removeButton: null,
  blockOnRemove: null,

  cookies: [],
  displayedCookies: [],

  initialize: function cookies_initialize() {
    gDataman.debugMsg("Initializing cookies panel");
    this.tree = document.getElementById("cookiesTree");
    this.tree.view = this;

    this.cookieInfoName = document.getElementById("cookieInfoName");
    this.cookieInfoValue = document.getElementById("cookieInfoValue");
    this.cookieInfoHostLabel = document.getElementById("cookieInfoHostLabel");
    this.cookieInfoHost = document.getElementById("cookieInfoHost");
    this.cookieInfoPath = document.getElementById("cookieInfoPath");
    this.cookieInfoSendType = document.getElementById("cookieInfoSendType");
    this.cookieInfoExpires = document.getElementById("cookieInfoExpires");

    this.removeButton = document.getElementById("cookieRemove");
    this.blockOnRemove = document.getElementById("cookieBlockOnRemove");

    // this.loadList() is being called in gDomains.initialize() already
    this.tree.treeBoxObject.beginUpdateBatch();
    this.displayedCookies = this.cookies.filter(
      function (aCookie) {
        return gDomains.hostMatchesSelected(aCookie.rawHost);
      });
    this.sort(null, false, false);
    this.tree.treeBoxObject.endUpdateBatch();
  },

  shutdown: function cookies_shutdown() {
    gDataman.debugMsg("Shutting down cookies panel");
    this.tree.view.selection.clearSelection();
    this.tree.view = null;
    this.displayedCookies = [];
  },

  loadList: function cookies_loadList() {
    this.cookies = [];
    let enumerator = gLocSvc.cookie.enumerator;
    while (enumerator.hasMoreElements()) {
      let nextCookie = enumerator.getNext();
      if (!nextCookie) break;
      nextCookie = nextCookie.QueryInterface(Components.interfaces.nsICookie2);
      this.cookies.push(this._makeCookieObject(nextCookie));
    }
  },

  _makeCookieObject: function cookies__makeCookieObject(aCookie) {
      return {name: aCookie.name,
              value: aCookie.value,
              isDomain: aCookie.isDomain,
              host: aCookie.host,
              rawHost: aCookie.rawHost,
              path: aCookie.path,
              isSecure: aCookie.isSecure,
              isSession: aCookie.isSession,
              isHttpOnly: aCookie.isHttpOnly,
              expires: this._getExpiresString(aCookie.expires),
              expiresSortValue: aCookie.expires};
  },

  _getObjID: function cookies__getObjID(aIdx) {
    var curCookie = gCookies.displayedCookies[aIdx];
    return curCookie.host + "|" + curCookie.path + "|" + curCookie.name;
  },

  _getExpiresString: function cookies__getExpiresString(aExpires) {
    if (aExpires) {
      let date = new Date(1000 * aExpires);

      // If a server manages to set a really long-lived cookie, the dateservice
      // can't cope with it properly, so we'll just return a blank string.
      // See bug 238045 for details.
      let expiry = "";
      try {
        expiry = gLocSvc.date.FormatDateTime("", gLocSvc.date.dateFormatLong,
                                             gLocSvc.date.timeFormatSeconds,
                                             date.getFullYear(), date.getMonth()+1,
                                             date.getDate(), date.getHours(),
                                             date.getMinutes(), date.getSeconds());
      }
      catch (e) {}
      return expiry;
    }
    return gDataman.bundle.getString("cookies.expireAtEndOfSession");
  },

  select: function cookies_select() {
    var selections = gDataman.getTreeSelections(this.tree);
    this.removeButton.disabled = !selections.length;
    if (!selections.length) {
      this._clearCookieInfo();
      return true;
    }

    if (selections.length > 1) {
      this._clearCookieInfo();
      return true;
    }

    // At this point, we have a single cookie selected.
    var showCookie = this.displayedCookies[selections[0]];

    this.cookieInfoName.value = showCookie.name;
    this.cookieInfoValue.value = showCookie.value;
    this.cookieInfoHostLabel.value = showCookie.isDomain ?
                                     this.cookieInfoHostLabel.getAttribute("value_domain") :
                                     this.cookieInfoHostLabel.getAttribute("value_host");
    this.cookieInfoHost.value = showCookie.host;
    this.cookieInfoPath.value = showCookie.path;
    var typestringID = "cookies." +
                       (showCookie.isSecure ? "secureOnly" : "anyConnection") +
                       (showCookie.isHttpOnly ? ".httponly" : ".all");
    this.cookieInfoSendType.value = gDataman.bundle.getString(typestringID);
    this.cookieInfoExpires.value = showCookie.expires;
    return true;
  },

  selectAll: function cookies_selectAll() {
    this.tree.view.selection.selectAll();
  },

  _clearCookieInfo: function cookies__clearCookieInfo() {
    var fields = ["cookieInfoName", "cookieInfoValue", "cookieInfoHost",
                  "cookieInfoPath", "cookieInfoSendType", "cookieInfoExpires"];
    for (let i = 0; i < fields.length; i++) {
      this[fields[i]].value = "";
    }
    this.cookieInfoHostLabel.value = this.cookieInfoHostLabel.getAttribute("value_host");
  },

  handleKeyPress: function cookies_handleKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.delete();
    }
  },

  sort: function cookies_sort(aColumn, aUpdateSelection, aInvertDirection) {
    // Make sure we have a valid column.
    let column = aColumn;
    if (!column) {
      let sortedCol = this.tree.columns.getSortedColumn();
      if (sortedCol)
        column = sortedCol.element;
      else
        column = document.getElementById("cookieHostCol");
    }
    else if (column.localName == "treecols" || column.localName == "splitter")
      return;

    if (!column || column.localName != "treecol") {
      Components.utils.reportError("No column found to sort cookies by");
      return;
    }

    let dirAscending = column.getAttribute("sortDirection") !=
                       (aInvertDirection ? "ascending" : "descending");
    let dirFactor = dirAscending ? 1 : -1;

    // Clear attributes on all columns, we're setting them again after sorting.
    for (let node = column.parentNode.firstChild; node; node = node.nextSibling) {
      node.removeAttribute("sortActive");
      node.removeAttribute("sortDirection");
    }

    // compare function for two formdata items
    let compfunc = function formdata_sort_compare(aOne, aTwo) {
      switch (column.id) {
        case "cookieHostCol":
          return dirFactor * aOne.rawHost.localeCompare(aTwo.rawHost);
        case "cookieNameCol":
          return dirFactor * aOne.name.localeCompare(aTwo.name);
        case "cookieExpiresCol":
          return dirFactor * (aOne.expiresSortValue - aTwo.expiresSortValue);
      }
      return 0;
    };

    if (aUpdateSelection) {
      var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    }
    this.tree.view.selection.clearSelection();

    // Do the actual sorting of the array.
    this.displayedCookies.sort(compfunc);
    this.tree.treeBoxObject.invalidate();

    if (aUpdateSelection) {
      gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    }

    // Set attributes to the sorting we did.
    column.setAttribute("sortActive", "true");
    column.setAttribute("sortDirection", dirAscending ? "ascending" : "descending");
  },

  delete: function cookies_delete() {
    var selections = gDataman.getTreeSelections(this.tree);

    if (selections.length > 1) {
      let title = gDataman.bundle.getString("cookies.deleteSelectedTitle");
      let msg = gDataman.bundle.getString("cookies.deleteSelected");
      let flags = ((Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
                   (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) +
                   Services.prompt.BUTTON_POS_1_DEFAULT)
      let yes = gDataman.bundle.getString("cookies.deleteSelectedYes");
      if (Services.prompt.confirmEx(window, title, msg, flags, yes, null, null,
                                    null, {value: 0}) == 1) // 1=="Cancel" button
        return;
    }

    this.tree.view.selection.clearSelection();
    // Loop backwards so later indexes in the list don't change.
    for (let i = selections.length - 1; i >= 0; i--) {
      let delCookie = this.displayedCookies[selections[i]];
      this.cookies.splice(this.cookies.indexOf(this.displayedCookies[selections[i]]), 1);
      this.displayedCookies.splice(selections[i], 1);
      this.tree.treeBoxObject.rowCountChanged(selections[i], -1);
      gLocSvc.cookie.remove(delCookie.host, delCookie.name, delCookie.path,
                            this.blockOnRemove.checked);
    }
    if (!this.displayedCookies.length)
      gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasCookies");
    // Select the entry after the first deleted one or the last of all entries.
    if (selections.length && this.displayedCookies.length)
      this.tree.view.selection.toggleSelect(selections[0] < this.displayedCookies.length ?
                                            selections[0] :
                                            this.displayedCookies.length - 1);
  },

  updateContext: function cookies_updateContext() {
    document.getElementById("cookies-context-remove").disabled =
      this.removeButton.disabled;
    document.getElementById("cookies-context-selectall").disabled =
      this.tree.view.selection.count >= this.tree.view.rowCount;
  },

  reactToChange: function cookies_reactToChange(aSubject, aData) {
    // aData: added, changed, deleted, batch-deleted, cleared, reload
    // see http://mxr.mozilla.org/mozilla-central/source/netwerk/cookie/nsICookieService.idl
    if (aData == "batch-deleted" || aData == "cleared" || aData == "reload") {
      // Go for re-parsing the whole thing, as cleared and reload need that anyhow
      // (batch-deleted has an nsIArray of cookies, we could in theory do better there).
      var selectionCache = [];
      if (this.displayedCookies.length) {
        selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
        this.displayedCookies = [];
      }
      this.loadList();
      var domainList = [];
      for (let i = 0; i < this.cookies.length; i++) {
        let domain = gDomains.getDomainFromHost(this.cookies[i].rawHost);
        if (domainList.indexOf(domain) == -1)
          domainList.push(domain);
      }
      gDomains.resetFlagToDomains("hasCookies", domainList);
      // Restore the local panel display if needed.
      if (gTabs.activePanel == "cookiesPanel" &&
          gDomains.selectedDomain.hasCookies) {
        this.tree.treeBoxObject.beginUpdateBatch();
        this.displayedCookies = this.cookies.filter(
          function (aCookie) {
            return gDomains.hostMatchesSelected(aCookie.rawHost);
          });
        this.sort(null, false, false);
        gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
        this.tree.treeBoxObject.endUpdateBatch();
      }
      return;
    }

    // Usual notifications for added, changed, deleted - do "surgical" updates.
    aSubject.QueryInterface(Components.interfaces.nsICookie2);
    let domain = gDomains.getDomainFromHost(aSubject.rawHost);
    // Does change affect possibly loaded Cookies pane?
    let affectsLoaded = this.displayedCookies.length &&
                        gDomains.hostMatchesSelected(aSubject.rawHost);
    if (aData == "added") {
      this.cookies.push(this._makeCookieObject(aSubject));
      if (affectsLoaded) {
        this.displayedCookies.push(this.cookies[this.cookies.length - 1]);
        this.tree.treeBoxObject.rowCountChanged(this.cookies.length - 1, 1);
        this.sort(null, true, false);
      }
      else {
        gDomains.addDomainOrFlag(aSubject.rawHost, "hasCookies");
      }
    }
    else {
      let idx = -1, disp_idx = -1, domainCookies = 0;
      if (affectsLoaded) {
        for (let i = 0; i < this.displayedCookies.length; i++) {
          let cookie = this.displayedCookies[i];
          if (cookie.host == aSubject.host && cookie.name == aSubject.name &&
              cookie.path == aSubject.path) {
            idx = this.cookies.indexOf(this.displayedCookies[i]);
            disp_idx = i;
            break;
          }
        }
        if (aData == "deleted")
          domainCookies = this.displayedCookies.length;
      }
      else {
        for (let i = 0; i < this.cookies.length; i++) {
          let cookie = this.cookies[i];
          if (cookie.host == aSubject.host && cookie.name == aSubject.name &&
              cookie.path == aSubject.path) {
            idx = i;
            if (aData != "deleted")
              break;
          }
          if (aData == "deleted" &&
              gDomains.getDomainFromHost(cookie.rawHost) == domain)
            domainCookies++;
        }
      }
      if (idx >= 0) {
        if (aData == "changed") {
          this.cookies[idx] = this._makeCookieObject(aSubject);
          if (affectsLoaded)
            this.tree.treeBoxObject.invalidateRow(disp_idx);
        }
        else if (aData == "deleted") {
          this.cookies.splice(idx, 1);
          if (affectsLoaded) {
            this.displayedCookies.splice(disp_idx, 1);
            this.tree.treeBoxObject.rowCountChanged(disp_idx, -1);
          }
          if (domainCookies == 1)
            gDomains.removeDomainOrFlag(domain, "hasCookies");
        }
      }
    }
  },

  forget: function cookies_forget() {
    for (let i = 0; i < this.cookies.length; i++) {
      if (gDomains.hostMatchesSelected(this.cookies[i].rawHost)) {
        gLocSvc.cookie.remove(this.cookies[i].host, this.cookies[i].name,
                              this.cookies[i].path, false);
        this.cookies.splice(i, 1);
      }
    }
    gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasCookies");
  },

  // nsITreeView
  __proto__: gBaseTreeView,
  get rowCount() {
    return this.displayedCookies.length;
  },
  getCellText: function(aRow, aColumn) {
    let cookie = this.displayedCookies[aRow];
    switch (aColumn.id) {
      case "cookieHostCol":
        return cookie.rawHost;
      case "cookieNameCol":
        return cookie.name;
      case "cookieExpiresCol":
        return cookie.expires;
    }
  },
};

// :::::::::::::::::::: permissions panel ::::::::::::::::::::
var gPerms = {
  list: null,

  initialize: function permissions_initialize() {
    gDataman.debugMsg("Initializing permissions panel");
    this.list = document.getElementById("permList");

    let enumerator = Services.perms.enumerator;
    while (enumerator.hasMoreElements()) {
      let nextPermission = enumerator.getNext();
      nextPermission = nextPermission.QueryInterface(Components.interfaces.nsIPermission);
      let rawHost = nextPermission.host.replace(/^\./, "");
      if (gDomains.hostMatchesSelected(rawHost)) {
        let permElem = document.createElement("richlistitem");
        permElem.setAttribute("type", nextPermission.type);
        permElem.setAttribute("host", nextPermission.host);
        permElem.setAttribute("rawHost", rawHost);
        permElem.setAttribute("capability", nextPermission.capability);
        permElem.setAttribute("class", "permission");
        this.list.appendChild(permElem);
      }
    }
    // Visually treat password rejects like permissions.
    let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
    for (let i = 0; i < rejectHosts.length; i++) {
      if (gDomains.hostMatchesSelected(rejectHosts[i])) {
        let permElem = document.createElement("richlistitem");
        permElem.setAttribute("type", "password");
        permElem.setAttribute("host", rejectHosts[i]);
        permElem.setAttribute("rawHost", gDomains.getDomainFromHost(rejectHosts[i]));
        permElem.setAttribute("capability", Services.perms.DENY_ACTION);
        permElem.setAttribute("class", "permission");
        this.list.appendChild(permElem);
      }
    }
  },

  shutdown: function permissions_shutdown() {
    gDataman.debugMsg("Shutting down permissions panel");
    // XXX: Here we could detect if we still hold any non-default settings and
    //      trigger the removeDomainOrFlag if not.
    while (this.list.hasChildNodes())
      this.list.removeChild(this.list.lastChild);
  },

  // Most functions of permissions are in the XBL items!

  getDefault: function permissions_getDefault(aType) {
    switch (aType) {
      case "allowXULXBL":
        return Services.perms.DENY_ACTION;
      case "cookie":
        if (Services.prefs.getIntPref("network.cookie.cookieBehavior") == 2)
          return Services.perms.DENY_ACTION;
        if (Services.prefs.getIntPref("network.cookie.lifetimePolicy") == 2)
          return Components.interfaces.nsICookiePermission.ACCESS_SESSION;
        return Services.perms.ALLOW_ACTION;
      case "geo":
        return Services.perms.DENY_ACTION;
      case "image":
        if (Services.prefs.getIntPref("permissions.default.image") == 2)
          return Services.perms.DENY_ACTION;
        return Services.perms.ALLOW_ACTION;
      case "install":
        if (Services.prefs.getBoolPref("xpinstall.whitelist.required"))
          return Services.perms.DENY_ACTION;
        return Services.perms.ALLOW_ACTION;
      case "password":
        return Services.perms.ALLOW_ACTION;
      case "popup":
        if (Services.prefs.getBoolPref("dom.disable_open_during_load"))
          return Services.perms.DENY_ACTION;
        return Services.perms.ALLOW_ACTION;
    }
    return Services.perms.UNKNOWN_ACTION;
  },

  reactToChange: function permissions_reactToChange(aSubject, aData) {
    if (/^hostSaving/.test(aData)) {
      // aData: hostSavingEnabled, hostSavingDisabled
      aSubject.QueryInterface(Components.interfaces.nsISupportsString);
      let domain = gDomains.getDomainFromHost(aSubject.data);
      // Does change affect possibly loaded Preferences pane?
      let affectsLoaded = this.list && this.list.childElementCount &&
                          gDomains.hostMatchesSelected(aSubject.data);
      let permElem = null;
      if (affectsLoaded) {
        for (let i = 0; i < this.list.children.length; i++) {
          let elem = this.list.children[i];
          if (elem.getAttribute("host") == aSubject.data &&
              elem.getAttribute("type") == "password")
            permElem = elem;
        }
      }
      if (aData == "hostSavingEnabled") {
        if (affectsLoaded) {
          permElem.setCapability(Services.perms.ALLOW_ACTION, true);
        }
        else {
          // Only remove if domain is not shown, note that this may leave an empty domain.
          let haveDomainPerms = false;
          let enumerator = Services.perms.enumerator;
          while (enumerator.hasMoreElements()) {
            let nextPermission = enumerator.getNext();
            nextPermission = nextPermission.QueryInterface(Components.interfaces.nsIPermission);
            if (domain == gDomains.getDomainFromHost(nextPermission.host.replace(/^\./, "")))
              haveDomainPerms = true;
          }
          let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
          for (let i = 0; i < rejectHosts.length; i++) {
            if (domain == gDomains.getDomainFromHost(rejectHosts[i]))
              haveDomainPerms = true;
          }
          if (!haveDomainPerms)
            gDomains.removeDomainOrFlag(domain, "hasPermissions");
        }
      }
      else if (aData == "hostSavingDisabled") {
        if (affectsLoaded) {
          if (permElem) {
            permElem.setCapability(Services.perms.DENY_ACTION, true);
          }
          else {
            permElem = document.createElement("richlistitem");
            permElem.setAttribute("type", "password");
            permElem.setAttribute("host", aSubject.data);
            permElem.setAttribute("rawHost", domain);
            permElem.setAttribute("capability", 2);
            permElem.setAttribute("class", "permission");
            permElem.setAttribute("orient", "vertical");
            this.list.appendChild(permElem);
          }
        }
        gDomains.addDomainOrFlag(aSubject.data, "hasPermissions");
      }
    }
    else {
      // aData: added, changed, deleted, cleared
      // See http://mxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsIPermissionManager.idl
      if (aData == "cleared") {
        let domainList = [];
        // Blocked passwords still belong in the list.
        let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
        for (let i = 0; i < rejectHosts.length; i++) {
          let dom = gDomains.getDomainFromHost(rejectHosts[i]);
          if (domainList.indexOf(dom) == -1)
            domainList.push(dom);
        }
        gDomains.resetFlagToDomains("hasPermissions", domainList);
        return;
      }
      aSubject.QueryInterface(Components.interfaces.nsIPermission);
      let rawHost = aSubject.host.replace(/^\./, "");
      let domain = gDomains.getDomainFromHost(rawHost);
      // Does change affect possibly loaded Preferences pane?
      let affectsLoaded = this.list && this.list.childElementCount &&
                          gDomains.hostMatchesSelected(rawHost);
      let permElem = null;
      if (affectsLoaded) {
        for (let i = 0; i < this.list.children.length; i++) {
          let elem = this.list.children[i];
          if (elem.getAttribute("host") == aSubject.host &&
              elem.getAttribute("type") == aSubject.type)
            permElem = elem;
        }
      }
      if (aData == "deleted") {
        if (affectsLoaded) {
          permElem.useDefault(true, true);
        }
        else {
          // Only remove if domain is not shown, note that this may leave an empty domain.
          let haveDomainPerms = false;
          let enumerator = Services.perms.enumerator;
          while (enumerator.hasMoreElements()) {
            let nextPermission = enumerator.getNext();
            nextPermission = nextPermission.QueryInterface(Components.interfaces.nsIPermission);
            if (domain == gDomains.getDomainFromHost(nextPermission.host.replace(/^\./, "")))
              haveDomainPerms = true;
          }
          let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
          for (let i = 0; i < rejectHosts.length; i++) {
            if (domain == gDomains.getDomainFromHost(rejectHosts[i]))
              haveDomainPerms = true;
          }
          if (!haveDomainPerms)
            gDomains.removeDomainOrFlag(domain, "hasPermissions");
        }
      }
      else if (aData == "changed" && affectsLoaded) {
        permElem.setCapability(aSubject.capability, true);
      }
      else if (aData == "added") {
        if (affectsLoaded) {
          if (permElem) {
            permElem.useDefault(false, true);
            permElem.setCapability(aSubject.capability, true);
          }
          else {
            permElem = document.createElement("richlistitem");
            permElem.setAttribute("type", aSubject.type);
            permElem.setAttribute("host", aSubject.host);
            permElem.setAttribute("rawHost", rawHost);
            permElem.setAttribute("capability", aSubject.capability);
            permElem.setAttribute("class", "permission");
            permElem.setAttribute("orient", "vertical");
            this.list.appendChild(permElem);
          }
        }
        gDomains.addDomainOrFlag(rawHost, "hasPermissions");
      }
    }
  },

  forget: function permissions_forget() {
    let delPerms = [];
    let enumerator = Services.perms.enumerator;
    while (enumerator.hasMoreElements()) {
      let nextPermission = enumerator.getNext();
      nextPermission = nextPermission.QueryInterface(Components.interfaces.nsIPermission);
      let host = nextPermission.host;
      if (gDomains.hostMatchesSelected(host.replace(/^\./, ""))) {
        delPerms.push({host: host, type: nextPermission.type});
      }
    }
    for (let i = 0; i < delPerms.length; i++) {
      Services.perms.remove(delPerms[i].host, delPerms[i].type);
    }
    // Also remove all password rejects.
    let rejectHosts = gLocSvc.pwd.getAllDisabledHosts();
    for (let i = 0; i < rejectHosts.length; i++) {
      if (gDomains.hostMatchesSelected(rejectHosts[i])) {
        gLocSvc.pwd.setLoginSavingEnabled(rejectHosts[i], true);
      }
    }
    gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasPermissions");
  },
};

// :::::::::::::::::::: content prefs panel ::::::::::::::::::::
var gPrefs = {
  tree: null,
  removeButton: null,

  prefs: [],

  initialize: function prefs_initialize() {
    gDataman.debugMsg("Initializing prefs panel");
    this.tree = document.getElementById("prefsTree");
    this.tree.view = this;

    this.removeButton = document.getElementById("prefsRemove");

    this.tree.treeBoxObject.beginUpdateBatch();
    // Get all groups (hosts) that match the domain.
    let domain = gDomains.selectedDomain.title;
    if (domain == "*") {
      let enumerator = Services.contentPrefs.getPrefs(null).enumerator;
      while (enumerator.hasMoreElements()) {
        let pref = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
        this.prefs.push({host: null, name: pref.name, value: pref.value});
      }
    }
    else {
      try {
        let sql = "SELECT groups.name AS host FROM groups WHERE host = :hostName OR host LIKE :hostMatch ESCAPE '/'";
        var statement = Services.contentPrefs.DBConnection.createStatement(sql);
        statement.params.hostName = domain;
        statement.params.hostMatch = "%." + statement.escapeStringForLIKE(domain, "/");
        while (statement.executeStep()) {
          // Now, get all prefs for that host.
          let enumerator =  Services.contentPrefs.getPrefs(statement.row["host"]).enumerator;
          while (enumerator.hasMoreElements()) {
            let pref = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
            this.prefs.push({host: statement.row["host"], name: pref.name, value: pref.value});
          }
        }
      }
      finally {
        statement.reset();
      }
    }
    this.sort(null, false, false);
    this.tree.treeBoxObject.endUpdateBatch();
  },

  shutdown: function prefs_shutdown() {
    gDataman.debugMsg("Shutting down prefs panel");
    this.tree.view.selection.clearSelection();
    this.tree.view = null;
    this.prefs = [];
  },

  _getObjID: function prefs__getObjID(aIdx) {
    var curPref = gPrefs.prefs[aIdx];
    return curPref.host + "|" + curPref.name;
  },

  select: function prefs_select() {
    var selections = gDataman.getTreeSelections(this.tree);
    this.removeButton.disabled = !selections.length;
    return true;
  },

  selectAll: function prefs_selectAll() {
    this.tree.view.selection.selectAll();
  },

  handleKeyPress: function prefs_handleKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.delete();
    }
  },

  sort: function prefs_sort(aColumn, aUpdateSelection, aInvertDirection) {
    // Make sure we have a valid column.
    let column = aColumn;
    if (!column) {
      let sortedCol = this.tree.columns.getSortedColumn();
      if (sortedCol)
        column = sortedCol.element;
      else
        column = document.getElementById("prefsHostCol");
    }
    else if (column.localName == "treecols" || column.localName == "splitter")
      return;

    if (!column || column.localName != "treecol") {
      Components.utils.reportError("No column found to sort form data by");
      return;
    }

    let dirAscending = column.getAttribute("sortDirection") !=
                       (aInvertDirection ? "ascending" : "descending");
    let dirFactor = dirAscending ? 1 : -1;

    // Clear attributes on all columns, we're setting them again after sorting.
    for (let node = column.parentNode.firstChild; node; node = node.nextSibling) {
      node.removeAttribute("sortActive");
      node.removeAttribute("sortDirection");
    }

    // compare function for two content prefs
    let compfunc = function prefs_sort_compare(aOne, aTwo) {
      switch (column.id) {
        case "prefsHostCol":
          return dirFactor * aOne.host.localeCompare(aTwo.host);
        case "prefsNameCol":
          return dirFactor * aOne.name.localeCompare(aTwo.name);
        case "prefsValueCol":
          return dirFactor * aOne.value.toString().localeCompare(aTwo.value);
      }
      return 0;
    };

    if (aUpdateSelection) {
      var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    }
    this.tree.view.selection.clearSelection();

    // Do the actual sorting of the array.
    this.prefs.sort(compfunc);
    this.tree.treeBoxObject.invalidate();

    if (aUpdateSelection) {
      gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    }

    // Set attributes to the sorting we did.
    column.setAttribute("sortActive", "true");
    column.setAttribute("sortDirection", dirAscending ? "ascending" : "descending");
  },

  delete: function prefs_delete() {
    var selections = gDataman.getTreeSelections(this.tree);

    if (selections.length > 1) {
      let title = gDataman.bundle.getString("prefs.deleteSelectedTitle");
      let msg = gDataman.bundle.getString("prefs.deleteSelected");
      let flags = ((Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
                   (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) +
                   Services.prompt.BUTTON_POS_1_DEFAULT)
      let yes = gDataman.bundle.getString("prefs.deleteSelectedYes");
      if (Services.prompt.confirmEx(window, title, msg, flags, yes, null, null,
                                    null, {value: 0}) == 1) // 1=="Cancel" button
        return;
    }

    this.tree.view.selection.clearSelection();
    // Loop backwards so later indexes in the list don't change.
    for (let i = selections.length - 1; i >= 0; i--) {
      let delPref = this.prefs[selections[i]];
      this.prefs.splice(selections[i], 1);
      this.tree.treeBoxObject.rowCountChanged(selections[i], -1);
      Services.contentPrefs.removePref(delPref.host, delPref.name);
    }
    if (!this.prefs.length)
      gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasPreferences");
    // Select the entry after the first deleted one or the last of all entries.
    if (selections.length && this.prefs.length)
      this.tree.view.selection.toggleSelect(selections[0] < this.prefs.length ?
                                            selections[0] :
                                            this.prefs.length - 1);
  },

  updateContext: function prefs_updateContext() {
    document.getElementById("prefs-context-remove").disabled =
      this.removeButton.disabled;
    document.getElementById("prefs-context-selectall").disabled =
      this.tree.view.selection.count >= this.tree.view.rowCount;
  },

  reactToChange: function prefs_reactToChange(aSubject, aData) {
    // aData: prefSet, prefRemoved

    // Do "surgical" updates.
    let domain = gDomains.getDomainFromHost(aSubject.host);
    // Does change affect possibly loaded Preferences pane?
    let affectsLoaded = this.prefs.length &&
                        gDomains.hostMatchesSelected(aSubject.host);
    let idx = -1, domainPrefs = 0;
    if (affectsLoaded) {
      for (let i = 0; i < this.prefs.length; i++) {
        let cpref = this.prefs[i];
        if (cpref && cpref.host == aSubject.host && cpref.name == aSubject.name) {
          idx = this.prefs[i];
          break;
        }
      }
      if (aData == "prefRemoved")
        domainPrefs = this.prefs.length;
    }
    else if (aData == "prefRemoved") {
      // See if there are any prefs left for that domain.
      if (domain == "*") {
        let enumerator = Services.contentPrefs.getPrefs(null).enumerator;
        if (enumerator.hasMoreElements())
          domainPrefs++;
      }
      else {
        try {
          let sql = "SELECT groups.name AS host FROM groups WHERE host = :hostName OR host LIKE :hostMatch ESCAPE '/'";
          var statement = Services.contentPrefs.DBConnection.createStatement(sql);
          statement.params.hostName = domain;
          statement.params.hostMatch = "%." + statement.escapeStringForLIKE(domain, "/");
          while (statement.executeStep()) {
            // Now, get all prefs for that host.
            let enumerator = Services.contentPrefs.getPrefs(statement.row["host"]).enumerator;
            if (enumerator.hasMoreElements())
              domainPrefs++;
          }
        }
        finally {
          statement.reset();
        }
      }
      if (!domainPrefs)
        gDomains.removeDomainOrFlag(domain, "hasPreferences");
    }
    if (idx >= 0) {
      if (aData == "prefSet") {
        this.prefs[idx] = aSubject;
        if (affectsLoaded)
          this.tree.treeBoxObject.invalidateRow(disp_idx);
      }
      else if (aData == "prefRemoved") {
        this.prefs.splice(idx, 1);
        if (affectsLoaded) {
          this.tree.treeBoxObject.rowCountChanged(idx, -1);
        }
        if (domainPrefs == 1)
          gDomains.removeDomainOrFlag(domain, "hasPreferences");
      }
    }
    else if (aData == "prefSet") {
      // Pref set, no prev index known - either new or existing pref domain.
      if (affectsLoaded) {
        this.prefs.push(aSubject);
        this.tree.treeBoxObject.rowCountChanged(this.prefs.length - 1, 1);
        this.sort(null, true, false);
      }
      else {
        gDomains.addDomainOrFlag(aSubject.host, "hasPreferences");
      }
    }
  },

  forget: function prefs_forget() {
    let delPrefs = [];
    try {
      // Get all groups (hosts) that match the domain.
      let domain = gDomains.selectedDomain.title;
      if (domain == "*") {
        let enumerator =  Services.contentPrefs.getPrefs(null).enumerator;
        while (enumerator.hasMoreElements()) {
          let pref = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
          delPrefs.push({host: null, name: pref.name, value: pref.value});
        }
      }
      else {
        let sql = "SELECT groups.name AS host FROM groups WHERE host = :hostName OR host LIKE :hostMatch ESCAPE '/'";
        var statement = Services.contentPrefs.DBConnection.createStatement(sql);
        statement.params.hostName = domain;
        statement.params.hostMatch = "%." + statement.escapeStringForLIKE(domain, "/");
        while (statement.executeStep()) {
          // Now, get all prefs for that host.
          let enumerator =  Services.contentPrefs.getPrefs(statement.row["host"]).enumerator;
          while (enumerator.hasMoreElements()) {
            let pref = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
            delPrefs.push({host: statement.row["host"], name: pref.name, value: pref.value});
          }
        }
      }
    }
    finally {
      statement.reset();
    }
    for (let i = 0; i < delPrefs.length; i++) {
      Services.contentPrefs.removePref(delPrefs[i].host, delPrefs[i].name);
    }
    gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasPreferences");
  },

  // nsITreeView
  __proto__: gBaseTreeView,
  get rowCount() {
    return this.prefs.length;
  },
  getCellText: function(aRow, aColumn) {
    let cpref = this.prefs[aRow];
    switch (aColumn.id) {
      case "prefsHostCol":
        return cpref.host || "*";
      case "prefsNameCol":
        return cpref.name;
      case "prefsValueCol":
        return cpref.value;
    }
  },
};

// :::::::::::::::::::: passwords panel ::::::::::::::::::::
var gPasswords = {
  tree: null,
  removeButton: null,
  toggleButton: null,
  pwdCol: null,

  allSignons: [],
  displayedSignons: [],
  showPasswords: false,

  initialize: function passwords_initialize() {
    gDataman.debugMsg("Initializing passwords panel");
    this.tree = document.getElementById("passwordsTree");
    this.tree.view = this;

    this.removeButton = document.getElementById("pwdRemove");
    this.toggleButton = document.getElementById("pwdToggle");
    this.toggleButton.label = gDataman.bundle.getString("pwd.showPasswords");
    this.toggleButton.accessKey = gDataman.bundle.getString("pwd.showPasswords.accesskey");

    this.pwdCol = document.getElementById("pwdPasswordCol");

    this.tree.treeBoxObject.beginUpdateBatch();
    // this.loadList() is being called in gDomains.initialize() already
    this.displayedSignons = this.allSignons.filter(
      function (aSignon) {
        return gDomains.hostMatchesSelected(aSignon.hostname);
      });
    this.sort(null, false, false);
    this.tree.treeBoxObject.endUpdateBatch();
  },

  shutdown: function passwords_shutdown() {
    gDataman.debugMsg("Shutting down passwords panel");
    if (this.showPasswords)
      this.togglePasswordVisible();
    this.tree.view.selection.clearSelection();
    this.tree.view = null;
    this.displayedSignons = [];
  },

  loadList: function passwords_loadList() {
    this.allSignons = gLocSvc.pwd.getAllLogins();
  },

  _getObjID: function passwords__getObjID(aIdx) {
    var curSignon = gPasswords.displayedSignons[aIdx];
    return curSignon.hostname + "|" + curSignon.httpRealm + "|" + curSignon.username;
  },

  select: function passwords_select() {
    var selections = gDataman.getTreeSelections(this.tree);
    this.removeButton.disabled = !selections.length;
    return true;
  },

  selectAll: function passwords_selectAll() {
    this.tree.view.selection.selectAll();
  },

  handleKeyPress: function passwords_handleKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.delete();
    }
  },

  sort: function passwords_sort(aColumn, aUpdateSelection, aInvertDirection) {
    // Make sure we have a valid column.
    let column = aColumn;
    if (!column) {
      let sortedCol = this.tree.columns.getSortedColumn();
      if (sortedCol)
        column = sortedCol.element;
      else
        column = document.getElementById("pwdHostCol");
    }
    else if (column.localName == "treecols" || column.localName == "splitter")
      return;

    if (!column || column.localName != "treecol") {
      Components.utils.reportError("No column found to sort form data by");
      return;
    }

    let dirAscending = column.getAttribute("sortDirection") !=
                       (aInvertDirection ? "ascending" : "descending");
    let dirFactor = dirAscending ? 1 : -1;

    // Clear attributes on all columns, we're setting them again after sorting.
    for (let node = column.parentNode.firstChild; node; node = node.nextSibling) {
      node.removeAttribute("sortActive");
      node.removeAttribute("sortDirection");
    }

    // compare function for two signons
    let compfunc = function passwords_sort_compare(aOne, aTwo) {
      switch (column.id) {
        case "pwdHostCol":
          return dirFactor * aOne.hostname.localeCompare(aTwo.hostname);
        case "pwdUserCol":
          return dirFactor * aOne.username.localeCompare(aTwo.username);
        case "pwdPasswordCol":
          return dirFactor * aOne.password.localeCompare(aTwo.password);
      }
      return 0;
    };

    if (aUpdateSelection) {
      var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    }
    this.tree.view.selection.clearSelection();

    // Do the actual sorting of the array.
    this.displayedSignons.sort(compfunc);
    this.tree.treeBoxObject.invalidate();

    if (aUpdateSelection) {
      gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    }

    // Set attributes to the sorting we did.
    column.setAttribute("sortActive", "true");
    column.setAttribute("sortDirection", dirAscending ? "ascending" : "descending");
  },

  delete: function passwords_delete() {
    var selections = gDataman.getTreeSelections(this.tree);

    if (selections.length > 1) {
      let title = gDataman.bundle.getString("pwd.deleteSelectedTitle");
      let msg = gDataman.bundle.getString("pwd.deleteSelected");
      let flags = ((Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
                   (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) +
                   Services.prompt.BUTTON_POS_1_DEFAULT)
      let yes = gDataman.bundle.getString("pwd.deleteSelectedYes");
      if (Services.prompt.confirmEx(window, title, msg, flags, yes, null, null,
                                    null, {value: 0}) == 1) // 1=="Cancel" button
        return;
    }

    this.tree.view.selection.clearSelection();
    // Loop backwards so later indexes in the list don't change.
    for (let i = selections.length - 1; i >= 0; i--) {
      let delSignon = this.displayedSignons[selections[i]];
      this.allSignons.splice(this.allSignons.indexOf(this.displayedSignons[selections[i]]), 1);
      this.displayedSignons.splice(selections[i], 1);
      this.tree.treeBoxObject.rowCountChanged(selections[i], -1);
      gLocSvc.pwd.removeLogin(delSignon);
    }
    if (!this.displayedSignons.length)
      gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasPasswords");
    // Select the entry after the first deleted one or the last of all entries.
    if (selections.length && this.displayedSignons.length)
      this.tree.view.selection.toggleSelect(selections[0] < this.displayedSignons.length ?
                                            selections[0] :
                                            this.displayedSignons.length - 1);
  },

  togglePasswordVisible: function passwords_togglePasswordVisible() {
    if (this.showPasswords || this._confirmShowPasswords()) {
      this.showPasswords = !this.showPasswords;
      this.toggleButton.label = gDataman.bundle.getString(this.showPasswords ?
                                                         "pwd.hidePasswords" :
                                                         "pwd.showPasswords");
      this.toggleButton.accessKey = gDataman.bundle.getString(this.showPasswords ?
                                                             "pwd.hidePasswords.accesskey" :
                                                             "pwd.showPasswords.accesskey");
      this.pwdCol.hidden = !this.showPasswords;
    }
  },

  _confirmShowPasswords: function passwords__confirmShowPasswords() {
    // This doesn't harm if passwords are not encrypted.
    let tokendb = Components.classes["@mozilla.org/security/pk11tokendb;1"]
                            .createInstance(Components.interfaces.nsIPK11TokenDB);
    let token = tokendb.getInternalKeyToken();

    // If there is no master password, still give the user a chance to opt-out
    // of displaying passwords
    if (token.checkPassword(""))
      return this._askUserShowPasswords();

    // So there's a master password. But since checkPassword didn't succeed,
    // we're logged out (per nsIPK11Token.idl).
    try {
      // Relogin and ask for the master password.
      token.login(true);  // 'true' means always prompt for token password. User
                          // will be prompted until clicking 'Cancel' or
                          // entering the correct password.
    }
    catch (e) {
      // An exception will be thrown if the user cancels the login prompt dialog.
      // User is also logged out of Software Security Device.
    }

    return token.isLoggedIn();
  },

  _askUserShowPasswords: function passwords__askUserShowPasswords() {
    // Confirm the user wants to display passwords.
    return Services.prompt.confirmEx(window, null,
                                     gDataman.bundle.getString("pwd.noMasterPasswordPrompt"),
                                     Services.prompt.STD_YES_NO_BUTTONS,
                                     null, null, null, null, { value: false }) == 0; // 0=="Yes" button
  },

  updateContext: function passwords_updateContext() {
    document.getElementById("pwd-context-remove").disabled =
      this.removeButton.disabled;
    document.getElementById("pwd-context-copypassword").disabled =
      this.tree.view.selection.count != 1;
    document.getElementById("pwd-context-selectall").disabled =
      this.tree.view.selection.count >= this.tree.view.rowCount;
  },

  copyPassword: function passwords_copyPassword() {
    // Copy selected signon's password to clipboard.
    let row = this.tree.currentIndex;
    let password = gPasswords.displayedSignons[row].password;
    gLocSvc.clipboard.copyString(password);
  },

  reactToChange: function passwords_reactToChange(aSubject, aData) {
    // aData: addLogin, modifyLogin, removeLogin, removeAllLogins
    if (aData == "removeAllLogins") {
      // Go for re-parsing the whole thing.
      if (this.displayedSignons.length) {
        this.tree.treeBoxObject.beginUpdateBatch();
        this.tree.view.selection.clearSelection();
        this.displayedSignons = [];
        this.tree.treeBoxObject.endUpdateBatch();
      }
      this.loadList();
      let domainList = [];
      for (let i = 0; i < this.allSignons.length; i++) {
        let domain = gDomains.getDomainFromHost(this.allSignons[i].hostname);
        if (domainList.indexOf(domain) == -1)
          domainList.push(domain);
      }
      gDomains.resetFlagToDomains("hasPasswords", domainList);
      return;
    }

    // Usual notifications for addLogin, modifyLogin, removeLogin - do "surgical" updates.
    let curLogin = null, oldLogin = null;
    if (aData == "modifyLogin" &&
        aSubject instanceof Components.interfaces.nsIArray) {
      let enumerator = aSubject.enumerate();
      if (enumerator.hasMoreElements()) {
        oldLogin = enumerator.getNext();
        oldLogin.QueryInterface(Components.interfaces.nsILoginInfo);
      }
      if (enumerator.hasMoreElements()) {
        curLogin = enumerator.getNext();
        curLogin.QueryInterface(Components.interfaces.nsILoginInfo);
      }
    }
    else if (aSubject instanceof Components.interfaces.nsILoginInfo) {
      curLogin = aSubject; oldLogin = aSubject;
    }
    else {
      Components.utils.reportError("Observed an unrecognized signon change of type " + aData);
    }

    let domain = gDomains.getDomainFromHost(curLogin.hostname);
    // Does change affect possibly loaded Passwords pane?
    let affectsLoaded = this.displayedSignons.length &&
                        gDomains.hostMatchesSelected(curLogin.hostname);
    if (aData == "addLogin") {
      this.allSignons.push(curLogin);

      if (affectsLoaded) {
        this.displayedSignons.push(this.allSignons[this.allSignons.length - 1]);
        this.tree.treeBoxObject.rowCountChanged(this.allSignons.length - 1, 1);
        this.sort(null, true, false);
      }
      else {
        gDomains.addDomainOrFlag(curLogin.hostname, "hasPasswords");
      }
    }
    else {
      let idx = -1, disp_idx = -1, domainPasswords = 0;
      if (affectsLoaded) {
        for (let i = 0; i < this.displayedSignons.length; i++) {
          let signon = this.displayedSignons[i];
          if (signon && signon.equals(oldLogin)) {
            idx = this.allSignons.indexOf(this.displayedSignons[i]);
            disp_idx = i;
            break;
          }
        }
        if (aData == "removeLogin")
          domainPasswords = this.displayedSignons.length;
      }
      else {
        for (let i = 0; i < this.allSignons.length; i++) {
          let signon = this.allSignons[i];
          if (signon && signon.equals(oldLogin)) {
            idx = i;
            if (aData != "removeLogin")
              break;
          }
          if (aData == "removeLogin" &&
              gDomains.getDomainFromHost(signon.hostname) == domain)
            domainPasswords++;
        }
      }
      if (idx >= 0) {
        if (aData == "modifyLogin") {
          this.allSignons[idx] = curLogin;
          if (affectsLoaded)
            this.tree.treeBoxObject.invalidateRow(disp_idx);
        }
        else if (aData == "removeLogin") {
          this.allSignons.splice(idx, 1);
          if (affectsLoaded) {
            this.displayedSignons.splice(disp_idx, 1);
            this.tree.treeBoxObject.rowCountChanged(disp_idx, -1);
          }
          if (domainPasswords == 1)
            gDomains.removeDomainOrFlag(domain, "hasPasswords");
        }
      }
    }
  },

  forget: function passwords_forget() {
    for (let i = 0; i < this.allSignons.length; i++) {
      if (gDomains.hostMatchesSelected(this.allSignons[i].hostname)) {
        gLocSvc.pwd.removeLogin(this.allSignons[i]);
        this.allSignons.splice(i, 1);
      }
    }
    gDomains.removeDomainOrFlag(gDomains.selectedDomain.title, "hasPasswords");
  },

  // nsITreeView
  __proto__: gBaseTreeView,
  get rowCount() {
    return this.displayedSignons.length;
  },
  getCellText: function(aRow, aColumn) {
    let signon = this.displayedSignons[aRow];
    switch (aColumn.id) {
      case "pwdHostCol":
        return signon.httpRealm ?
               (signon.hostname + " (" + signon.httpRealm + ")") :
               signon.hostname;
      case "pwdUserCol":
        return signon.username || "";
      case "pwdPasswordCol":
        return signon.password || "";
    }
  },
};

// :::::::::::::::::::: form data panel ::::::::::::::::::::
var gFormdata = {
  tree: null,
  removeButton: null,
  searchfield: null,

  formdata: [],
  displayedFormdata: [],

  initialize: function formdata_initialize() {
    gDataman.debugMsg("Initializing form data panel");
    this.tree = document.getElementById("formdataTree");
    this.tree.view = this;

    this.searchfield = document.getElementById("fdataSearch");
    this.removeButton = document.getElementById("fdataRemove");

    // Always load fresh list, no need to react to changes when pane not open.
    this.loadList();
    this.search("");
  },

  shutdown: function formdata_shutdown() {
    gDataman.debugMsg("Shutting down form data panel");
    this.tree.view.selection.clearSelection();
    this.tree.view = null;
    this.displayedFormdata = [];
  },

  loadList: function formdata_loadList() {
    this.formdata = [];
    try {
      let sql = "SELECT fieldname, value, timesUsed, firstUsed, lastUsed, guid FROM moz_formhistory";
      var statement = gLocSvc.fhist.DBConnection.createStatement(sql);
      while (statement.executeStep()) {
        this.formdata.push({fieldname: statement.row["fieldname"],
                            value: statement.row["value"],
                            timesUsed: statement.row["timesUsed"],
                            firstUsed: this._getTimeString(statement.row["firstUsed"]),
                            firstUsedSortValue: statement.row["firstUsed"],
                            lastUsed: this._getTimeString(statement.row["lastUsed"]),
                            lastUsedSortValue: statement.row["lastUsed"],
                            guid: statement.row["guid"]}
                          );
      }
    }
    finally {
      statement.reset();
    }
  },

  _getTimeString: function formdata__getTimeString(aTimestamp) {
    if (aTimestamp) {
      let date = new Date(aTimestamp / 1000);

      // If a date has an extreme value, the dateservice can't cope with it
      // properly, so we'll just return a blank string.
      // See bug 238045 for details.
      let dtString = "";
      try {
        dtString = gLocSvc.date.FormatDateTime("", gLocSvc.date.dateFormatLong,
                                               gLocSvc.date.timeFormatSeconds,
                                               date.getFullYear(), date.getMonth()+1,
                                               date.getDate(), date.getHours(),
                                               date.getMinutes(), date.getSeconds());
      }
      catch (e) {}
      return dtString;
    }
    return "";
  },

  _getObjID: function formdata__getObjID(aIdx) {
    return gFormdata.displayedFormdata[aIdx].guid;
  },

  select: function formdata_select() {
    var selections = gDataman.getTreeSelections(this.tree);
    this.removeButton.disabled = !selections.length;
    return true;
  },

  selectAll: function formdata_selectAll() {
    this.tree.view.selection.selectAll();
  },

  handleKeyPress: function formdata_handleKeyPress(aEvent) {
    if (aEvent.keyCode == KeyEvent.DOM_VK_DELETE) {
      this.delete();
    }
  },

  sort: function formdata_sort(aColumn, aUpdateSelection, aInvertDirection) {
    // Make sure we have a valid column.
    let column = aColumn;
    if (!column) {
      let sortedCol = this.tree.columns.getSortedColumn();
      if (sortedCol)
        column = sortedCol.element;
      else
        column = document.getElementById("fdataFieldCol");
    }
    else if (column.localName == "treecols" || column.localName == "splitter")
      return;

    if (!column || column.localName != "treecol") {
      Components.utils.reportError("No column found to sort form data by");
      return;
    }

    let dirAscending = column.getAttribute("sortDirection") !=
                       (aInvertDirection ? "ascending" : "descending");
    let dirFactor = dirAscending ? 1 : -1;

    // Clear attributes on all columns, we're setting them again after sorting.
    for (let node = column.parentNode.firstChild; node; node = node.nextSibling) {
      node.removeAttribute("sortActive");
      node.removeAttribute("sortDirection");
    }

    // compare function for two formdata items
    let compfunc = function formdata_sort_compare(aOne, aTwo) {
      switch (column.id) {
        case "fdataFieldCol":
          return dirFactor * aOne.fieldname.localeCompare(aTwo.fieldname);
        case "fdataValueCol":
          return dirFactor * aOne.value.localeCompare(aTwo.value);
        case "fdataCountCol":
          return dirFactor * (aOne.timesUsed - aTwo.timesUsed);
        case "fdataFirstCol":
          return dirFactor * (aOne.firstUsedSortValue - aTwo.firstUsedSortValue);
        case "fdataLastCol":
          return dirFactor * (aOne.lastUsedSortValue - aTwo.lastUsedSortValue);
      }
      return 0;
    };

    if (aUpdateSelection) {
      var selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    }
    this.tree.view.selection.clearSelection();

    // Do the actual sorting of the array.
    this.displayedFormdata.sort(compfunc);
    this.tree.treeBoxObject.invalidate();

    if (aUpdateSelection) {
      gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    }

    // Set attributes to the sorting we did.
    column.setAttribute("sortActive", "true");
    column.setAttribute("sortDirection", dirAscending ? "ascending" : "descending");
  },

  delete: function formdata_delete() {
    var selections = gDataman.getTreeSelections(this.tree);

    if (selections.length > 1) {
      let title = gDataman.bundle.getString("fdata.deleteSelectedTitle");
      let msg = gDataman.bundle.getString("fdata.deleteSelected");
      let flags = ((Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
                   (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) +
                   Services.prompt.BUTTON_POS_1_DEFAULT)
      let yes = gDataman.bundle.getString("fdata.deleteSelectedYes");
      if (Services.prompt.confirmEx(window, title, msg, flags, yes, null, null,
                                    null, {value: 0}) == 1) // 1=="Cancel" button
        return;
    }

    this.tree.view.selection.clearSelection();
    // Loop backwards so later indexes in the list don't change.
    for (let i = selections.length - 1; i >= 0; i--) {
      let delFData = this.displayedFormdata[selections[i]];
      this.formdata.splice(this.formdata.indexOf(this.displayedFormdata[selections[i]]), 1);
      this.displayedFormdata.splice(selections[i], 1);
      this.tree.treeBoxObject.rowCountChanged(selections[i], -1);
      gLocSvc.fhist.removeEntry(delFData.fieldname, delFData.value);
    }
    // Select the entry after the first deleted one or the last of all entries.
    if (selections.length && this.displayedFormdata.length)
      this.tree.view.selection.toggleSelect(selections[0] < this.displayedFormdata.length ?
                                            selections[0] :
                                            this.displayedFormdata.length - 1);
  },

  search: function formdata_search(aSearchString) {
    let selectionCache = gDataman.getSelectedIDs(this.tree, this._getObjID);
    this.tree.treeBoxObject.beginUpdateBatch();
    this.tree.view.selection.clearSelection();
    var lcSearch = aSearchString.toLocaleLowerCase();
    this.displayedFormdata = this.formdata.filter(
      function(aFd) {
        return aFd.fieldname.toLocaleLowerCase().indexOf(lcSearch) != -1 ||
               aFd.value.toLocaleLowerCase().indexOf(lcSearch) != -1;
      });
    this.sort(null, false, false);
    gDataman.restoreSelectionFromIDs(this.tree, this._getObjID, selectionCache);
    this.tree.treeBoxObject.endUpdateBatch();
  },

  focusSearch: function formdata_focusSearch() {
    this.searchfield.focus();
  },

  updateContext: function formdata_updateContext() {
    document.getElementById("fdata-context-remove").disabled =
      this.removeButton.disabled;
    document.getElementById("fdata-context-selectall").disabled =
      this.tree.view.selection.count >= this.tree.view.rowCount;
  },

  reactToChange: function formdata_reactToChange(aSubject, aData) {
    // aData: addEntry, modifyEntry, removeEntry, removeAllEntries,
    // removeEntriesForName, removeEntriesByTimeframe, expireOldEntries,
    // before-removeEntry, before-removeAllEntries, before-removeEntriesForName,
    // before-removeEntriesByTimeframe, before-expireOldEntries

    // Ignore changes when no form data pane is loaded
    // or if we caught a before-* notification.
    if (!this.displayedFormdata.length || /^before-/.test(aData))
      return;

    if (aData == "removeAllEntries" || aData == "removeEntriesForName" ||
        aData == "removeEntriesByTimeframe" || aData == "expireOldEntries") {
      // Go for re-parsing the whole thing.
      this.tree.treeBoxObject.beginUpdateBatch();
      this.tree.view.selection.clearSelection();
      this.displayedFormdata = [];
      this.tree.treeBoxObject.endUpdateBatch();

      this.loadList();
      this.search("");
      return;
    }

    // Usual notifications for addEntry, modifyEntry, removeEntry - do "surgical" updates.
    let subjectData = []; // Those notifications all have: name, value, guid.
    if (aSubject instanceof Components.interfaces.nsIArray) {
      let enumerator = aSubject.enumerate();
      while (enumerator.hasMoreElements()) {
        let nextElem = enumerator.getNext();
        if (nextElem instanceof Components.interfaces.nsISupportsString ||
            nextElem instanceof Components.interfaces.nsISupportsPRInt64) {
          subjectData.push(nextElem.data);
        }
      }
    }
    else {
      Components.utils.reportError("Observed an unrecognized formdata change of type " + aData);
      return;
    }

    let entryData = null;
    if (aData == "addEntry" || aData == "modifyEntry") {
      try {
        let sql = "SELECT fieldname, value, timesUsed, firstUsed, lastUsed, guid FROM moz_formhistory WHERE guid = :guid";
        var statement = gLocSvc.fhist.DBConnection.createStatement(sql);
        statement.params.guid = subjectData[2];
        while (statement.executeStep()) {
          entryData = {fieldname: statement.row["fieldname"],
                       value: statement.row["value"],
                       timesUsed: statement.row["timesUsed"],
                       firstUsed: this._getTimeString(statement.row["firstUsed"]),
                       firstUsedSortValue: statement.row["firstUsed"],
                       lastUsed: this._getTimeString(statement.row["lastUsed"]),
                       lastUsedSortValue: statement.row["lastUsed"],
                       guid: statement.row["guid"]};
        }
      }
      finally {
        statement.reset();
      }

      if (!entryData) {
        Components.utils.reportError("Could not find added/modifed formdata entry");
        return;
      }
    }

    if (aData == "addEntry") {
      this.formdata.push(entryData);

      this.displayedFormdata.push(this.formdata[this.formdata.length - 1]);
      this.tree.treeBoxObject.rowCountChanged(this.formdata.length - 1, 1);
      this.search("");
    }
    else {
      let idx = -1, disp_idx = -1;
      for (let i = 0; i < this.displayedFormdata.length; i++) {
        let fdata = this.displayedFormdata[i];
        if (fdata && fdata.guid == subjectData[2]) {
          idx = this.formdata.indexOf(this.displayedFormdata[i]);
          disp_idx = i;
          break;
        }
      }
      if (idx >= 0) {
        if (aData == "modifyEntry") {
          this.formdata[idx] = entryData;
          this.tree.treeBoxObject.invalidateRow(disp_idx);
        }
        else if (aData == "removeEntry") {
          this.formdata.splice(idx, 1);
          this.displayedFormdata.splice(disp_idx, 1);
          this.tree.treeBoxObject.rowCountChanged(disp_idx, -1);
        }
      }
    }
  },

  forget: function formdata_forget() {
    gLocSvc.fhist.removeAllEntries();
  },

  // nsITreeView
  __proto__: gBaseTreeView,
  get rowCount() {
    return this.displayedFormdata.length;
  },
  getCellText: function(aRow, aColumn) {
    let fdata = this.displayedFormdata[aRow];
    switch (aColumn.id) {
      case "fdataFieldCol":
        return fdata.fieldname;
      case "fdataValueCol":
        return fdata.value;
      case "fdataCountCol":
        return fdata.timesUsed;
      case "fdataFirstCol":
        return fdata.firstUsed;
      case "fdataLastCol":
        return fdata.lastUsed;
    }
  },
};

// :::::::::::::::::::: forget panel ::::::::::::::::::::
var gForget = {
  forgetDesc: null,
  forgetCookies: null,
  forgetPermissions: null,
  forgetPreferences: null,
  forgetPasswords: null,
  forgetFormdata: null,
  forgetCookiesLabel: null,
  forgetPermissionsLabel: null,
  forgetPreferencesLabel: null,
  forgetPasswordsLabel: null,
  forgetFormdataLabel: null,
  forgetButton: null,

  initialize: function forget_initialize() {
    gDataman.debugMsg("Initializing forget panel");

    this.forgetDesc = document.getElementById("forgetDesc");
    ["forgetCookies", "forgetPermissions", "forgetPreferences",
     "forgetPasswords", "forgetFormdata"].forEach(function(elemID) {
      gForget[elemID] = document.getElementById(elemID);
      gForget[elemID].hidden = false;
      gForget[elemID].checked = false;
      let labelID = elemID + "Label";
      gForget[labelID] = document.getElementById(labelID);
      gForget[labelID].hidden = true;
    });
    this.forgetButton = document.getElementById("forgetButton");
    this.forgetButton.hidden = false;

    if (gDomains.selectedDomain.title == "*")
      this.forgetDesc.value = gDataman.bundle.getString("forget.desc.global.pre");
    else
      this.forgetDesc.value = gDataman.bundle.getFormattedString("forget.desc.domain.pre",
                                                                 [gDomains.selectedDomain.title]);

    this.forgetCookies.disabled = !gDomains.selectedDomain.hasCookies;
    this.forgetPermissions.disabled = !gDomains.selectedDomain.hasPermissions;
    this.forgetPreferences.disabled = !gDomains.selectedDomain.hasPreferences;
    this.forgetPasswords.disabled = !gDomains.selectedDomain.hasPasswords;
    this.forgetFormdata.disabled = !gDomains.selectedDomain.hasFormData;
    this.forgetFormdata.hidden = !gDomains.selectedDomain.hasFormData;
    this.updateOptions();
  },

  shutdown: function forget_shutdown() {
    gDataman.debugMsg("Shutting down forget panel");
  },

  updateOptions: function forget_updateOptions() {
    this.forgetButton.disabled = !(this.forgetCookies.checked ||
                                   this.forgetPermissions.checked ||
                                   this.forgetPreferences.checked ||
                                   this.forgetPasswords.checked ||
                                   this.forgetFormdata.checked);
  },

  forget: function forget_forget() {
    // Domain might get removed and selected domain changed!
    let delDomainTitle = gDomains.selectedDomain.title;

    if (this.forgetCookies.checked) {
      gCookies.forget();
      this.forgetCookiesLabel.hidden = false;
    }
    this.forgetCookies.hidden = true;

    if (this.forgetPermissions.checked) {
      gPerms.forget();
      this.forgetPermissionsLabel.hidden = false;
    }
    this.forgetPermissions.hidden = true;

    if (this.forgetPreferences.checked) {
      gPrefs.forget();
      this.forgetPreferencesLabel.hidden = false;
    }
    this.forgetPreferences.hidden = true;

    if (this.forgetPasswords.checked) {
      gPasswords.forget();
      this.forgetPasswordsLabel.hidden = false;
    }
    this.forgetPasswords.hidden = true;

    if (this.forgetFormdata.checked) {
      gFormdata.forget();
      this.forgetFormdataLabel.hidden = false;
    }
    this.forgetFormdata.hidden = true;

    if (delDomainTitle == "*")
      this.forgetDesc.value = gDataman.bundle.getString("forget.desc.global.post");
    else
      this.forgetDesc.value = gDataman.bundle.getFormattedString("forget.desc.domain.post",
                                                                 [delDomainTitle]);
    this.forgetButton.hidden = true;
  },
};
