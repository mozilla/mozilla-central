/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var helpExternal;

var helpContentListener = {
  onStartURIOpen: function(aURI) {
    return false;
  },
  doContent: function(aContentType, aIsContentPreferred, aRequest, aContentHandler) {
    throw Components.results.NS_ERROR_UNEXPECTED;
  },
  isPreferred: function(aContentType, aDesiredContentType) {
    return false;
  },
  canHandleContent: function(aContentType, aIsContentPreferred, aDesiredContentType) {
    return false;
  },
  loadCookie: null,
  parentContentListener: null,
  QueryInterface: function (aIID) {
    if (aIID.equals(Components.interfaces.nsIURIContentListener) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

function initOverlay() {
  helpExternal = document.getElementById("help-external");
  helpExternal.docShell.useErrorPages = false;
  helpExternal
    .docShell
    .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
    .getInterface(Components.interfaces.nsIURIContentListener)
    .parentContentListener = helpContentListener;
  helpExternal.addProgressListener(window.XULBrowserWindow, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
}

function contentClick(event) {
  // is this a left click on a link?
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.button != 0)
    return true;

  // is this a link?
  var target = event.target;
  while (!(target instanceof HTMLAnchorElement))
    if (!(target = target.parentNode))
      return true;

  // is this an internal link?
  if (target.href.lastIndexOf("chrome:", 0) == 0)
    return true;

  var uri = target.href;
  if (/^x-moz-url-link:/.test(uri))
    uri = Services.urlFormatter.formatURLPref(RegExp.rightContext);

  const loadFlags = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_IS_LINK;
  try {
    helpExternal.webNavigation.loadURI(uri, loadFlags, null, null, null);
  } catch (e) {}
  return false;
}

function showSidebar() {
  document.getElementById("help-sidebar-splitter").setAttribute("state", "open");
}

// needed by findUtils.js
var gFindInstData;
function getFindInstData()
{
  if (!gFindInstData) {
    gFindInstData = new nsFindInstData();
    gFindInstData.browser = getBrowser();
    // defaults for rootSearchWindow and currentSearchWindow are fine here
  }
  return gFindInstData;
}
