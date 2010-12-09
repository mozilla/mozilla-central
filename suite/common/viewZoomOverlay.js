/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-

 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is this file as it was released upon January 6, 2001.
 *
 * The Initial Developer of the Original Code is
 * Peter Annema.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Peter Annema <disttsc@bart.nl> (Original Author)
 *   Jonas Sicking <sicking@bigfoot.com>
 *   Myk Melez <myk@mozilla.org>
 *   Dão Gottwald <dao@mozilla.com>
 *   Ehsan Akhgari <ehsan.akhgari@gmail.com>
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
    var globalValue = Services.contentPrefs.getPref(null, this.name);
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
    window.addEventListener("DOMMouseScroll", this, false);

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
    window.removeEventListener("DOMMouseScroll", this, false);
  },


  //**************************************************************************//
  // Event Handlers

  // nsIDOMEventListener

  handleEvent: function FullZoom_handleEvent(event) {
    switch (event.type) {
      case "DOMMouseScroll":
        this._handleMouseScrolled(event);
        break;
    }
  },

  _handleMouseScrolled: function FullZoom_handleMouseScrolled(event) {
    // Construct the "mousewheel action" pref key corresponding to this event.
    // Based on nsEventStateManager::GetBasePrefKeyForMouseWheel.
    var pref = "mousewheel";
    if (event.axis == event.HORIZONTAL_AXIS)
      pref += ".horizscroll";

    if (event.shiftKey)
      pref += ".withshiftkey";
    else if (event.ctrlKey)
      pref += ".withcontrolkey";
    else if (event.altKey)
      pref += ".withaltkey";
    else if (event.metaKey)
      pref += ".withmetakey";
    else
      pref += ".withnokey";

    pref += ".action";

    // Don't do anything if this isn't a "zoom" scroll event.
    var isZoomEvent = false;
    try {
      isZoomEvent = (Services.prefs.getIntPref(pref) == MOUSE_SCROLL_ZOOM);
    } catch (e) {}
    if (!isZoomEvent)
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
      if (!Services.contentPrefs.hasPref(getBrowser().currentURI, this.name))
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
      if (!Services.contentPrefs.hasPref(getBrowser().currentURI, this.name))
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

    var self = this;
    Services.contentPrefs.getPref(aURI, this.name, function (aResult) {
      // Check that we're still where we expect to be in case this took a while.
      if (!aBrowser || aURI.equals(aBrowser.currentURI))
        self._applyPrefToSetting(aResult, aBrowser);
    });
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
      ZoomManager.reset();

    this._removePref();
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
    if (!this.siteSpecific || window.gInPrintPreviewMode)
      return;

    var browser = aBrowser || (getBrowser() && getBrowser().selectedBrowser);
    try {
      if (browser.contentDocument instanceof Components.interfaces.nsIImageDocument)
        ZoomManager.setZoomForBrowser(browser, 1);
      else if (typeof aValue != "undefined")
        ZoomManager.setZoomForBrowser(browser, this._ensureValid(aValue));
      else if (typeof this.globalValue != "undefined")
        ZoomManager.setZoomForBrowser(browser, this.globalValue);
      else
        ZoomManager.setZoomForBrowser(browser, 1);
    }
    catch(ex) {}
  },

  _applySettingToPref: function FullZoom_applySettingToPref() {
    if (!this.siteSpecific || window.gInPrintPreviewMode ||
        content.document instanceof Components.interfaces.nsIImageDocument)
      return;

    var zoomLevel = ZoomManager.zoom;
    Services.contentPrefs.setPref(getBrowser().currentURI, this.name, zoomLevel);
  },

  _removePref: function FullZoom_removePref() {
    if (!(content.document instanceof Components.interfaces.nsIImageDocument))
      Services.contentPrefs.removePref(getBrowser().currentURI, this.name);
  },


  //**************************************************************************//
  // Utilities

  _ensureValid: function FullZoom_ensureValid(aValue) {
    if (isNaN(aValue))
      return 1;

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

  var accessKeys = zoomBundle.getString("accessKeys").split(",");
  var zoomFactors = zoomBundle.getString("values").split(",");

  // Make sure the zoom manager has the same values as us
  Services.prefs.setCharPref("toolkit.zoomManager.zoomValues",
                             zoomFactors.map(function(aVal) {return aVal/100;})
                                        .join(","));

  var insertBefore = document.getElementById("menu_zoomInsertBefore");
  var popup = insertBefore.parentNode;
  for (var i = 0; i < zoomFactors.length; ++i) {
    var menuItem = document.createElement("menuitem");
    menuItem.setAttribute("type", "radio");
    menuItem.setAttribute("name", "zoom");

    var label;
    if (zoomFactors[i] == 100) {
      label = zoomBundle.getString("labelOriginal");
      menuItem.setAttribute("key", "key_zoomReset");
    }
    else
      label = zoomBundle.getString("label");

    menuItem.setAttribute("label", label.replace(/%zoom%/, zoomFactors[i]));
    menuItem.setAttribute("accesskey", accessKeys[i]);
    menuItem.setAttribute("value", zoomFactors[i]);
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
  var menuLabel = zoomBundle.getString(zoomType)
                            .replace(/%zoom%/, Math.round(ZoomManager.zoom * 100));
  zoomMenu.setAttribute("label", menuLabel);
}

function updateZoomMenu() {
  var zoomBundle = document.getElementById("bundle_viewZoom");
  var zoomOther = document.getElementById("menu_zoomOther");
  var label = zoomBundle.getString("labelOther");
  var factorOther = zoomOther.getAttribute("value") ||
                    zoomBundle.getString("valueOther");
  zoomOther.setAttribute("label", label.replace(/%zoom%/, factorOther));
  zoomOther.setAttribute("value", factorOther);

  var popup = document.getElementById("menu_zoomPopup");
  var item = popup.firstChild;
  while (item) {
    if (item.getAttribute("name") == "zoom") {
      if (item.getAttribute("value") == Math.round(ZoomManager.zoom * 100))
        item.setAttribute("checked","true");
      else
        item.removeAttribute("checked");
    }
    item = item.nextSibling;
  }
}

function setZoomOther() {
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
  }
}
