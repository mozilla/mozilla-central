/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

window.addEventListener("load", function () {
  let prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefService);
  if (!prefs.getBoolPref("mail.chat.enabled")) {
    let prefwindow = document.getElementById("MailPreferences");
    let radio =
      document.getAnonymousElementByAttribute(prefwindow, "pane", "paneChat");
    if (radio.selected)
      prefwindow.showPane(document.getElementById("paneGeneral"));
    radio.hidden = true;
  }
});
