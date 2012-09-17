/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function populateAccessibilitySection() {
  var active;
  try {
    active = Components.manager.QueryInterface(Ci.nsIServiceManager)
      .isServiceInstantiatedByContractID(
        "@mozilla.org/accessibilityService;1",
        Ci.nsISupports);
  } catch (ex) {
    active = false;
  }

  document.getElementById("a11y-activated").textContent = active ? "1" : "0";

  var forceDisabled = 0;
  forceDisabled = Application.prefs.get("accessibility.force_disabled").value;

  document.getElementById("a11y-force-disabled").textContent
    = (forceDisabled == -1) ? "never" :
  ((forceDisabled == 1) ? "1" : "0");
}
