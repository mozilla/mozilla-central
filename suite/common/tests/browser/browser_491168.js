/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function browserWindowsCount() {
  let count = 0;
  let e = Services.wm.getEnumerator("navigator:browser");
  while (e.hasMoreElements()) {
    if (!e.getNext().closed)
      ++count;
  }
  return count;
}

function test() {
  // make sure we use sessionstore for undoClosetab
  Services.prefs.setIntPref("browser.tabs.max_tabs_undo", 0);

  /** Test for Bug 491168, ported by Bug 524369 **/
  is(browserWindowsCount(), 1, "Only one browser window should be open initially");

  waitForExplicitFinish();

  const REFERRER1 = "http://example.org/?" + Date.now();
  const REFERRER2 = "http://example.org/?" + Math.random();

  let tab = getBrowser().addTab();
  getBrowser().selectedTab = tab;

  let browser = tab.linkedBrowser;
  browser.addEventListener("load", function testBrowserLoad() {
    browser.removeEventListener("load", testBrowserLoad, true);

    let tabState = JSON.parse(ss.getTabState(tab));
    is(tabState.entries[0].referrer,  REFERRER1,
       "Referrer retrieved via getTabState matches referrer set via loadURI.");

    tabState.entries[0].referrer = REFERRER2;
    ss.setTabState(tab, JSON.stringify(tabState));

    tab.addEventListener("SSTabRestored", function testBrowserTabRestored() {
      tab.removeEventListener("SSTabRestored", testBrowserTabRestored, true);
      is(window.content.document.referrer, REFERRER2, "document.referrer matches referrer set via setTabState.");

      getBrowser().removeTab(tab);
      let newTab = ss.undoCloseTab(window, 0);
      newTab.addEventListener("SSTabRestored", function testBrowserNewTabRest() {
        newTab.removeEventListener("SSTabRestored", testBrowserNewTabRest, true);

        is(window.content.document.referrer, REFERRER2, "document.referrer is still correct after closing and reopening the tab.");
        getBrowser().removeTab(newTab);

        is(browserWindowsCount(), 1, "Only one browser window should be open eventually");
        // clean up
        if (Services.prefs.prefHasUserValue("browser.tabs.max_tabs_undo"))
          Services.prefs.clearUserPref("browser.tabs.max_tabs_undo");
        finish();
      }, true);
    }, true);
  },true);

  let referrerURI = Services.io.newURI(REFERRER1, null, null);
  browser.loadURI("http://example.org", referrerURI, null);
}
