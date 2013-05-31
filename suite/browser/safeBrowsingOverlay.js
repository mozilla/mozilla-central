/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gSafeBrowsing = {
  initMenuItems: function initMenuItems() {
    // A phishing page will have a specific about:blocked content documentURI.
    var docURI = content.document.documentURI;
    var isPhishingPage = docURI.startsWith("about:blocked?e=phishingBlocked");
    var isMalwarePage = docURI.startsWith("about:blocked?e=malwareBlocked");

    // Show/hide the appropriate menu item.
    document.getElementById("reportPhishing").hidden = isPhishingPage || isMalwarePage;
    document.getElementById("reportPhishingError").hidden = !isPhishingPage;

    var broadcaster = document.getElementById("safeBrowsingBroadcaster");
    var uri = getBrowser().currentURI;
    if (uri && (uri.schemeIs("http") || uri.schemeIs("https")))
      broadcaster.removeAttribute("disabled");
    else
      broadcaster.setAttribute("disabled", true);
  },

  /**
   * Used to report a phishing page or a false positive
   * @param   aName
   *          A String One of "Phish", "Error", "Malware" or "MalwareError".
   * @returns A String containing the report phishing URL.
   */
  getReportURL: function getReportURL(aName) {
    var reportUrl = SafeBrowsing.getReportURL(aName);

    var pageUri = getBrowser().currentURI.cloneIgnoringRef();

    // Remove the query to avoid including potentially sensitive data
    if (pageUri instanceof Components.interfaces.nsIURL)
      pageUri.query = "";

    reportUrl += "&url=" + encodeURIComponent(pageUri.asciiSpec);

    return reportUrl;
  },

  initOverlay: function initOverlay(aEvent) {
    var popup = document.getElementById("helpPopup");
    popup.addEventListener("popupshowing", gSafeBrowsing.initMenuItems, false);
  }
}

window.addEventListener("load", gSafeBrowsing.initOverlay, false);
