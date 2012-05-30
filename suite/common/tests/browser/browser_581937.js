/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 // Tests that an about:blank tab with no history will not be saved into
 // session store and thus, it will not show up in Recently Closed Tabs.

let tab;
function test() {
  waitForExplicitFinish();

  Services.prefs.setIntPref("browser.sessionstore.max_tabs_undo", 0);
  Services.prefs.setIntPref("browser.tabs.max_tabs_undo", 0);
  Services.prefs.clearUserPref("browser.sessionstore.max_tabs_undo");

  is(ss.getClosedTabCount(window), 0, "should be no closed tabs");

  getBrowser().tabContainer.addEventListener("TabOpen", onTabOpen, true);

  tab = getBrowser().addTab();
}

function onTabOpen(aEvent) {
  getBrowser().tabContainer.removeEventListener("TabOpen", onTabOpen, true);

  // Let other listeners react to the TabOpen event before removing the tab.
  executeSoon(function() {
    is(getBrowser().browsers[1].currentURI.spec, "about:blank",
       "we will be removing an about:blank tab");

    getBrowser().removeTab(tab);

    is(ss.getClosedTabCount(window), 0, "should still be no closed tabs");

    Services.prefs.clearUserPref("browser.tabs.max_tabs_undo");
    executeSoon(finish);
  });
}
