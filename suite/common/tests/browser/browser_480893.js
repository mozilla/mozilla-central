/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 480893 **/

  waitForExplicitFinish();

  // Test that starting a new session loads a blank page if Firefox is
  // configured to display a blank page at startup (browser.startup.page = 0)
  Services.prefs.setIntPref("browser.startup.page", 0);
  let tab = getBrowser().addTab("about:sessionrestore");
  getBrowser().selectedTab = tab;
  let browser = tab.linkedBrowser;
  browser.addEventListener("load", function testBrowserLoad(aEvent) {
    browser.removeEventListener("load", testBrowserLoad, true);
    let doc = browser.contentDocument;

    // click on the "Start New Session" button after about:sessionrestore is loaded
    doc.getElementById("errorCancel").click();
    browser.addEventListener("load", function testBrowserLoad2(aEvent) {
      browser.removeEventListener("load", testBrowserLoad2, true);
      let doc = browser.contentDocument;

      is(doc.URL, "about:blank", "loaded page is about:blank");

      // Test that starting a new session loads the homepage (set to http://mochi.test:8888)
      // if Firefox is configured to display a homepage at startup (browser.startup.page = 1)
      let homepage = "http://mochi.test:8888/";
      Services.prefs.setCharPref("browser.startup.homepage", homepage);
      Services.prefs.setIntPref("browser.startup.page", 1);
      getBrowser().loadURI("about:sessionrestore");
      browser.addEventListener("load", function testBrowserLoad3(aEvent) {
        browser.removeEventListener("load", testBrowserLoad3, true);
        let doc = browser.contentDocument;

        // click on the "Start New Session" button after about:sessionrestore is loaded
        doc.getElementById("errorCancel").click();
        browser.addEventListener("load", function testBrowserLoad4(aEvent) {
          browser.removeEventListener("load", testBrowserLoad4, true);
          let doc = browser.contentDocument;

          is(doc.URL, homepage, "loaded page is the homepage");

          // close tab, restore default values and finish the test
          getBrowser().removeTab(tab);
          // we need this if-statement because if there is no user set value, 
          // clearUserPref throws a uncatched exception and finish is not called
          if (Services.prefs.prefHasUserValue("browser.startup.page"))
            Services.prefs.clearUserPref("browser.startup.page");
          Services.prefs.clearUserPref("browser.startup.homepage");
          finish();
        }, true);
      }, true);
    }, true);
  }, true);
}
