/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  waitForExplicitFinish();

  // avoid prompting about phishing
  Services.prefs.setIntPref(phishyUserPassPref, 32);
  registerCleanupFunction(function () {
    Services.prefs.clearUserPref(phishyUserPassPref);
  });

  nextTest();
}

const phishyUserPassPref = "network.http.phishy-userpass-length";

function nextTest() {
  let test = tests.shift();
  if (test) {
    test(function () {
      executeSoon(nextTest);
    });
  } else {
    executeSoon(finish);
  }
}

let tests = [
  function revert(next) {
    loadTabInWindow(window, function (tab) {
      gURLBar.handleRevert();
      is(gURLBar.value, "example.com", "URL bar had user/pass stripped after reverting");
      gBrowser.removeTab(tab);
      next();
    });
  }
];

function loadTabInWindow(win, callback) {
  info("Loading tab");
  let url = "http://user:pass@example.com/";
  let tab = win.gBrowser.selectedTab = win.gBrowser.addTab(url);
  tab.linkedBrowser.addEventListener("load", function listener() {
    info("Tab loaded");
    if (tab.linkedBrowser.currentURI.spec != url)
      return;
    tab.linkedBrowser.removeEventListener("load", listener, true);

    is(win.gURLBar.value, "example.com", "URL bar had user/pass stripped initially");
    callback(tab);
  }, true);
}
