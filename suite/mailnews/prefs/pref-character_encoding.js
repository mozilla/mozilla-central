/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The contents of this file will be loaded into the scope of the object
// <prefpane id="character_encoding_pane">!

function Startup ()
{
  Services.obs.notifyObservers(null, "charsetmenu-selected", "other");
  Services.obs.notifyObservers(null, "charsetmenu-selected", "mailedit");

  var viewCharsetList = document.getElementById("viewDefaultCharsetList");
  // Need to set ref attribute once overlay has loaded.
  viewCharsetList.setAttribute("ref", "NC:DecodersRoot");
  // Since the menulist starts off empty it has no selected item
  // so try and set it to the preference value.
  viewCharsetList.value = document.getElementById("mailnews.view_default_charset").value;

  var sendCharsetList = document.getElementById("sendDefaultCharsetList");
  // Need to set ref attribute once overlay has loaded.
  sendCharsetList.setAttribute("ref", "NC:MaileditCharsetMenuRoot");
  // Since the menulist starts off empty it has no selected item
  // so try and set it to the preference value.
  sendCharsetList.value = document.getElementById("mailnews.send_default_charset").value;
}
