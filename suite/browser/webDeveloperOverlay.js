/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gWebDeveloper = {
  validateThisPage: function validateThisPage() {
    var service = GetLocalizedStringPref("browser.validate.html.service");
    var uri = getBrowser().currentURI;
    var checkURL = service + encodeURIComponent(uri.spec);
    var opentab = Services.prefs.getBoolPref("browser.tabs.opentabfor.middleclick");
    openUILinkIn(checkURL, opentab ? "tabfocused" : "window",
                 { referrerURI: uri, relatedToCurrent: true });
  },

  initMenuItem: function initMenuItem() {
    var menuitem = document.getElementById("validatePage");
    var uri = getBrowser().currentURI;
    if (uri && (uri.schemeIs("http") || uri.schemeIs("https")))
      menuitem.removeAttribute("disabled");
    else
      menuitem.setAttribute("disabled", true);
  },

  initOverlay: function initOverlay(aEvent) {
    window.removeEventListener("load", gWebDeveloper.initOverlay, false);
    var popup = document.getElementById("toolsPopup");
    popup.addEventListener("popupshowing", gWebDeveloper.initMenuItem, false);
  }
}

window.addEventListener("load", gWebDeveloper.initOverlay, false);
