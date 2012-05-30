/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This tests that a tab which is closed while loading is not lost.
// Specifically, that session store does not rely on an invalid cache when
// constructing data for a tab which is loading.

// The newly created tab which we load a URL into and try closing/undoing.
let tab;

// This test steps through the following parts:
//  1. Tab has been created is loading URI_TO_LOAD.
//  2. Before URI_TO_LOAD finishes loading, browser.currentURI has changed and
//     tab is scheduled to be removed.
//  3. After the tab has been closed, undoCloseTab() has been called and the tab
//     should fully load.
const URI_TO_LOAD = "about:logo";

function test() {
  waitForExplicitFinish();

  Services.prefs.setIntPref("browser.tabs.max_tabs_undo", 0);
  getBrowser().addTabsProgressListener(tabsListener);

  tab = getBrowser().addTab();

  tab.linkedBrowser.addEventListener("load", firstOnLoad, true);

  getBrowser().tabContainer.addEventListener("TabClose", onTabClose, true);
}

function firstOnLoad(aEvent) {
  tab.linkedBrowser.removeEventListener("load", firstOnLoad, true);

  let uri = aEvent.target.location;
  is(uri, "about:blank", "first load should be for about:blank");

  // Trigger a save state.
  ss.getBrowserState();

  is(getBrowser().tabs[1], tab, "newly created tab should exist by now");
  ok(tab.linkedBrowser.__SS_data, "newly created tab should be in save state");

  tab.linkedBrowser.loadURI(URI_TO_LOAD);
}

let tabsListener = {
  onLocationChange: function onLocationChange(aBrowser) {
    getBrowser().removeTabsProgressListener(tabsListener);

    is(aBrowser.currentURI.spec, URI_TO_LOAD,
       "should occur after about:blank load and be loading next page");

    // Since we are running in the context of tabs listeners, we do not
    // want to disrupt other tabs listeners.
    executeSoon(function() {
      getBrowser().removeTab(tab);
    });
  }
};

function onTabClose(aEvent) {
  getBrowser().tabContainer.removeEventListener("TabClose", onTabClose, true);

  is(tab.linkedBrowser.currentURI.spec, URI_TO_LOAD,
     "should only remove when loading page");

  executeSoon(function() {
    tab = ss.undoCloseTab(window, 0);
    tab.linkedBrowser.addEventListener("load", secondOnLoad, true);
  });
}

function secondOnLoad(aEvent) {
  let uri = aEvent.target.location;
  is(uri, URI_TO_LOAD, "should load page from undoCloseTab");
  done();
}

function done() {
  tab.linkedBrowser.removeEventListener("load", secondOnLoad, true);
  getBrowser().removeTab(tab);
  Services.prefs.clearUserPref("browser.tabs.max_tabs_undo");

  executeSoon(finish);
}
