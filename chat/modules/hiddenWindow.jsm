/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ["getHiddenHTMLWindow"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "hiddenWindow", function()
  Services.appShell.hiddenDOMWindow
);
#ifndef XP_MACOSX
function getHiddenHTMLWindow() hiddenWindow
#else
function getHiddenHTMLWindow() {
  let browser = hiddenWindow.document.getElementById("hiddenBrowser");
  return browser.docShell ? browser.contentWindow : hiddenWindow;
}
#endif
