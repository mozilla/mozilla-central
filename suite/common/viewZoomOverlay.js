/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-

 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// One of the possible values for the mousewheel.* preferences.
// From nsEventStateManager.cpp.
const MOUSE_SCROLL_ZOOM = 3;

/**
 * Controls the "full zoom" setting and its site-specific preferences.
 */
var FullZoom = {
  // Identifies the setting in the content prefs database.
  name: "browser.content.full-zoom",

  // The global value (if any) for the setting.  Lazily loaded from the service
  // when first requested, then updated by the pref change listener as it changes.
  // If there is no global value, then this should be undefined.
  get globalValue() {
    var globalValue = Services.contentPrefs.getPref(null, this.name, null);
    if (typeof globalValue != "undefined")
      globalValue = this._ensureValid(globalValue);
    delete this.globalValue;
    return this.globalValue = globalValue;
  },

  // browser.zoom.siteSpecific preference cache
  _siteSpecificPref: undefined,

  // browser.zoom.updateBackgroundTabs preference cache
  updateBackgroundTabs: undefined,

  get siteSpecific() {
    return this._siteSpecificPref;
  },

  //**************************************************************************//
  // nsISupports

  QueryInterface:
  XPCOMUtils.generateQI([Components.interfaces.nsIDOMEventListener,
                         Components.interfaces.nsIObserver,
                         Components.interfaces.nsIContentPrefObserver,
                         Components.interfaces.nsISupportsWeakReference,
                         Components.interfaces.nsISupports]),

  //**************************************************************************//
  // Initialization & Destruction

  init: function FullZoom_init() {
    // Listen for scrollwheel events so we can save scrollwheel-based changes.
    window.addEventListener("wheel", this, false);

    // Register ourselves with the service so we know when our pref changes.
    Services.contentPrefs.addObserver(this.name, this);

    this._siteSpecificPref =
      Services.prefs.getBoolPref("browser.zoom.siteSpecific");
    this.updateBackgroundTabs =
      Services.prefs.getBoolPref("browser.zoom.updateBackgroundTabs");
    // Listen for changes to the browser.zoom branch so we can enable/disable
    // updating background tabs and per-site saving and restoring of zoom levels.
    Services.prefs.addObserver("browser.zoom.", this, true);
  },

  destroy: function FullZoom_destroy() {
    Services.prefs.removeObserver("browser.zoom.", this);
    Services.contentPrefs.removeObserver(this.name, this);
    window.removeEventListener("wheel", this, false);
  },


  //**************************************************************************//
  // Event Handlers

  // nsIDOMEventListener

  handleEvent: function FullZoom_handleEvent(event) {
    switch (event.type) {
      case "wheel":
        this._handleMouseScrolled(event);
        break;
    }
  },

  _handleMouseScrolled: function FullZoom_handleMouseScrolled(event) {
    // Construct the "mousewheel action" pref key corresponding to this event.
    // Based on nsEventStateManager::WheelPrefs::GetIndexFor.
    var modifiers = {
      Alt: "mousewheel.with_alt.action",
      Control: "mousewheel.with_control.action",
      Meta: "mousewheel.with_meta.action",
      Shift: "mousewheel.with_shift.action",
      OS: "mousewheel.with_win.action"
    };
    var pref = [];
    for (var key in modifiers)
      if (event.getModifierState(key))
        pref.push(modifiers[key]);
    if (pref.length == 1)
      pref = pref[0];
    else // Multiple or no modifiers, use default action
      pref = "mousewheel.default.action";

    // Don't do anything if this isn't a "zoom" scroll event.
    if (GetIntPref(pref, 0) != MOUSE_SCROLL_ZOOM)
      return;

    // XXX Lazily cache all the possible action prefs so we don't have to get
    // them anew from the pref service for every scroll event?  We'd have to
    // make sure to observe them so we can update the cache when they change.

    // We have to call _applySettingToPref in a timeout because we handle
    // the event before the event state manager has a chance to apply the zoom
    // during nsEventStateManager::PostHandleEvent.
    window.setTimeout(function (self) { self._applySettingToPref() }, 0, this);
  },

  // nsIObserver

  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        switch (aData) {
          case "browser.zoom.siteSpecific":
            this._siteSpecificPref =
              Services.prefs.getBoolPref("browser.zoom.siteSpecific");
            break;
          case "browser.zoom.updateBackgroundTabs":
            this.updateBackgroundTabs =
              Services.prefs.getBoolPref("browser.zoom.updateBackgroundTabs");
            break;
        }
        break;
    }
  },

  // nsIContentPrefObserver

  onContentPrefSet: function FullZoom_onContentPrefSet(aGroup, aName, aValue) {
    if (aGroup == Services.contentPrefs.grouper.group(getBrowser().currentURI))
      this._applyPrefToSetting(aValue);
    else if (aGroup == null) {
      this.globalValue = this._ensureValid(aValue);

      // If the current page doesn't have a site-specific preference,
      // then its zoom should be set to the new global preference now that
      // the global preference has changed.
      if (!Services.contentPrefs.hasPref(getBrowser().currentURI, this.name, getBrowser().docShell))
        this._applyPrefToSetting();
    }
  },

  onContentPrefRemoved: function FullZoom_onContentPrefRemoved(aGroup, aName) {
    if (aGroup == Services.contentPrefs.grouper.group(getBrowser().currentURI))
      this._applyPrefToSetting();
    else if (aGroup == null) {
      this.globalValue = undefined;

      // If the current page doesn't have a site-specific preference,
      // then its zoom should be set to the default preference now that
      // the global preference has changed.
      if (!Services.contentPrefs.hasPref(getBrowser().currentURI, this.name, getBrowser().docShell))
        this._applyPrefToSetting();
    }
  },

  // location change observer

  /**
   * Called when the location of a tab changes.
   * When that happens, we need to update the current zoom level if appropriate.
   *
   * @param aURI
   *        A URI object representing the new location.
   * @param aIsTabSwitch
   *        Whether this location change has happened because of a tab switch.
   * @param aBrowser
   *        (optional) browser object displaying the document
   */
  onLocationChange: function FullZoom_onLocationChange(aURI, aIsTabSwitch, aBrowser) {
    if (!aURI || !this.siteSpecific)
      return;

    // Avoid the cps roundtrip and apply the default/global pref.
    if (aURI.spec == "about:blank") {
      this._applyPrefToSetting(undefined, aBrowser);
      return;
    }

    // Image documents should always start at 1, and are not affected by prefs.
    if (!aIsTabSwitch && aBrowser.contentDocument.mozSyntheticDocument) {
      ZoomManager.setZoomForBrowser(aBrowser, this._ensureValid(1));
      return;
    }

    var loadContext = aBrowser.docShell;
    if (Services.contentPrefs.hasCachedPref(aURI, this.name, loadContext)) {
      let zoomValue = Services.contentPrefs.getPref(aURI, this.name, loadContext);
      this._applyPrefToSetting(zoomValue, aBrowser);
    } else {
      var self = this;
      Services.contentPrefs.getPref(aURI, this.name, loadContext, function (aResult) {
        // Check that we're still where we expect to be in case this took a while.
        // Null check currentURI, since the window may have been destroyed before
        // we were called.
        if (aBrowser.currentURI && aURI.equals(aBrowser.currentURI))
          self._applyPrefToSetting(aResult, aBrowser);
      });
    }
  },

  // update state of zoom type menu item

  updateMenu: function FullZoom_updateMenu() {
    var menuItem = document.getElementById("toggle_zoom");

    menuItem.setAttribute("checked", !ZoomManager.useFullZoom);
  },

  //**************************************************************************//
  // Setting & Pref Manipulation

  reduce: function FullZoom_reduce() {
    ZoomManager.reduce();
    this._applySettingToPref();
  },

  enlarge: function FullZoom_enlarge() {
    ZoomManager.enlarge();
    this._applySettingToPref();
  },

  zoom: function FullZoom_zoom(aZoomValue) {
    ZoomManager.zoom = aZoomValue;
    this._applySettingToPref();
  },

  reset: function FullZoom_reset() {
    if (typeof this.globalValue != "undefined")
      ZoomManager.zoom = this.globalValue;
    else
      ZoomManager.zoom = this._ensureValid(1);

    this._removePref();
  },

  setOther: function setZoomOther() {
    var zoomOther = document.getElementById("menu_zoomOther");
    // open dialog and ask for new value
    var o = {value: zoomOther.getAttribute("value"),
             zoomMin: ZoomManager.MIN * 100,
             zoomMax: ZoomManager.MAX * 100};
    window.openDialog("chrome://communicator/content/askViewZoom.xul",
                      "", "chrome,modal,centerscreen", o);
    if (o.zoomOK) {
      zoomOther.setAttribute("value", o.value);
      ZoomManager.zoom = o.value / 100;
      this._applySettingToPref();
    }
  },

  /**
   * Set the zoom level for the current tab.
   *
   * Per nsPresContext::setFullZoom, we can set the zoom to its current value
   * without significant impact on performance, as the setting is only applied
   * if it differs from the current setting.  In fact getting the zoom and then
   * checking ourselves if it differs costs more.
   *
   * And perhaps we should always set the zoom even if it was more expensive,
   * since DocumentViewerImpl::SetTextZoom claims that child documents can have
   * a different text zoom (although it would be unusual), and it implies that
   * those child text zooms should get updated when the parent zoom gets set,
   * and perhaps the same is true for full zoom
   * (although DocumentViewerImpl::SetFullZoom doesn't mention it).
   *
   * So when we apply new zoom values to the browser, we simply set the zoom.
   * We don't check first to see if the new value is the same as the current
   * one.
   **/
  _applyPrefToSetting: function FullZoom_applyPrefToSetting(aValue, aBrowser) {
    var browser = aBrowser || (getBrowser() && getBrowser().selectedBrowser);

    if (!this.siteSpecific || window.gInPrintPreviewMode ||
        browser.contentDocument.mozSyntheticDocument)
      return;

    try {
      if (typeof aValue != "undefined")
        ZoomManager.setZoomForBrowser(browser, this._ensureValid(aValue));
      else if (typeof this.globalValue != "undefined")
        ZoomManager.setZoomForBrowser(browser, this.globalValue);
      else
        ZoomManager.setZoomForBrowser(browser, this._ensureValid(1));
    }
    catch(ex) {}
  },

  _applySettingToPref: function FullZoom_applySettingToPref() {
    if (!this.siteSpecific || window.gInPrintPreviewMode ||
        content.document.mozSyntheticDocument)
      return;

    var zoomLevel = ZoomManager.zoom;
    Services.contentPrefs.setPref(getBrowser().currentURI, this.name, zoomLevel, getBrowser().docShell);
  },

  _removePref: function FullZoom_removePref() {
    if (!content.document.mozSyntheticDocument)
      Services.contentPrefs.removePref(getBrowser().currentURI, this.name, getBrowser().docShell);
  },


  //**************************************************************************//
  // Utilities

  _ensureValid: function FullZoom_ensureValid(aValue) {
    if (isNaN(aValue))
      aValue = 1;

    if (aValue < ZoomManager.MIN)
      return ZoomManager.MIN;

    if (aValue > ZoomManager.MAX)
      return ZoomManager.MAX;

    return aValue;
  }
};

/***** init and helper functions for viewZoomOverlay.xul *****/
window.addEventListener("load", registerZoomManager, false);
window.addEventListener("unload", unregisterZoomManager, false);

function registerZoomManager() {
  FullZoom.init();

  var zoomBundle = document.getElementById("bundle_viewZoom");
  var zoomMenu = document.getElementById("menu_zoom");
  var parentMenu = zoomMenu.parentNode;
  parentMenu.addEventListener("popupshowing", updateViewMenu, false);

  // initialize menu from toolkit.zoomManager.zoomValues and assign accesskeys
  var zoomFactors = ZoomManager.zoomValues;
  var freeKeys = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' ];

  var insertBefore = document.getElementById("menu_zoomInsertBefore");
  var popup = insertBefore.parentNode;
  for (var i = 0; i < zoomFactors.length; ++i) {
    var thisFactor = Math.round(zoomFactors[i] * 100);
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("type", "radio");
    menuItem.setAttribute("name", "zoom");

    var label;
    var accessKey = "";
    if (thisFactor == 100) {
      label = zoomBundle.getString("zoom.100.label");
      accessKey = zoomBundle.getString("zoom.100.accesskey");
      menuItem.setAttribute("key", "key_zoomReset");
    }
    else if (thisFactor == 200) {
      label = zoomBundle.getString("zoom.200.label");
      accessKey = zoomBundle.getString("zoom.200.accesskey");
    }
    else {
      label = zoomBundle.getString("zoom.value.label")
                        .replace(/%zoom%/, thisFactor);
      for (var j = 0; j < label.length; ++j) {
        var testKey = label[j];
        var indexKey = freeKeys.indexOf(testKey);
        if (indexKey >= 0) {
          accessKey = testKey;
          freeKeys.splice(indexKey, 1);
          break;
        }
      }
    }

    menuItem.setAttribute("label", label);
    if (accessKey)
      menuItem.setAttribute("accesskey", accessKey);
    menuItem.setAttribute("value", thisFactor);
    popup.insertBefore(menuItem, insertBefore);
  }
}

function unregisterZoomManager() {
  FullZoom.destroy();
}

function updateViewMenu() {
  var zoomBundle = document.getElementById("bundle_viewZoom");
  var zoomMenu = document.getElementById("menu_zoom");
  var zoomType = ZoomManager.useFullZoom ? "fullZoom" : "textZoom";
  var menuLabel = zoomBundle.getString(zoomType + ".label")
                            .replace(/%zoom%/, Math.round(ZoomManager.zoom * 100));
  var menuKey = zoomBundle.getString(zoomType + ".accesskey");
  zoomMenu.setAttribute("label", menuLabel);
  zoomMenu.setAttribute("accesskey", menuKey);
}

function updateZoomMenu() {
  var zoomBundle = document.getElementById("bundle_viewZoom");
  var zoomOther = document.getElementById("menu_zoomOther");
  var label = zoomBundle.getString("zoom.other.label");
  var accesskey = zoomBundle.getString("zoom.other.accesskey");
  var factorOther = zoomOther.getAttribute("value") ||
                    Math.round(ZoomManager.MAX * 100);
  zoomOther.setAttribute("label", label.replace(/%zoom%/, factorOther));
  zoomOther.setAttribute("accesskey", accesskey);
  zoomOther.setAttribute("value", factorOther);

  var popup = document.getElementById("menu_zoomPopup");
  var item = popup.lastChild;
  while (item) {
    if (item.getAttribute("name") == "zoom") {
      if (item.getAttribute("value") == Math.round(ZoomManager.zoom * 100))
        item.setAttribute("checked","true");
      else
        item.removeAttribute("checked");
    }
    item = item.previousSibling;
  }
}
