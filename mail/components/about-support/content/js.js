/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 function populateJavaScriptSection() {
  let enabled = window.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIDOMWindowUtils)
        .isIncrementalGCEnabled();
  document.getElementById("javascript-incremental-gc").textContent = enabled ? "1" : "0";
}
