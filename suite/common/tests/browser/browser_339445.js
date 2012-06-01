/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 339445 **/

  waitForExplicitFinish();

  let testURL = "http://mochi.test:8888/browser/" +
    "suite/common/tests/browser/browser_339445_sample.html";

  let tab = getBrowser().addTab(testURL);
  tab.linkedBrowser.addEventListener("load", function testTabLBLoad(aEvent) {
    tab.linkedBrowser.removeEventListener("load", testTabLBLoad, true);
    let doc = tab.linkedBrowser.contentDocument;
    is(doc.getElementById("storageTestItem").textContent, "PENDING",
       "sessionStorage value has been set");

    let tab2 = ss.duplicateTab(window,tab);
    tab2.linkedBrowser.addEventListener("load", function testTab2LBLoad(aEvent) {
      this.removeEventListener("load", testTab2LBLoad, true);
      let doc2 = tab2.linkedBrowser.contentDocument;
      is(doc2.getElementById("storageTestItem").textContent, "SUCCESS",
         "sessionStorage value has been duplicated");

      // clean up
      getBrowser().removeTab(tab2);
      getBrowser().removeTab(tab);

      finish();
    }, true);
  }, true);
}
