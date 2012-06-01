/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function browserWindowsCount() {
  let count = 0;
  let e = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator)
                    .getEnumerator("navigator:browser");
  while (e.hasMoreElements()) {
    if (!e.getNext().closed)
      ++count;
  }
  return count;
}

function test() {
  // test that cookies are stored and restored correctly by sessionstore,
  // bug 423132, ported by bug 524371.
  is(browserWindowsCount(), 1, "Only one browser window should be open initially");

  waitForExplicitFinish();

  let cs = Components.classes["@mozilla.org/cookiemanager;1"].getService(Components.interfaces.nsICookieManager2);
  cs.removeAll();

  // make sure that sessionstore.js can be forced to be created by setting
  // the interval pref to 0
  Services.prefs.setIntPref("browser.sessionstore.interval", 0);

  const testURL = "http://mochi.test:8888/browser/" +
    "suite/common/tests/browser/browser_423132_sample.html";

  // open a new window
  let newWin = openDialog(location, "_blank", "chrome,all,dialog=no", "about:blank");

  // make sure sessionstore saves the cookie data, then close the window
  newWin.addEventListener("load", function testNewWinLoad(aEvent) {
    newWin.removeEventListener("load", testNewWinLoad, false);

    newWin.getBrowser().selectedBrowser.loadURI(testURL, null, null);

    newWin.getBrowser().addEventListener("pageshow", function testNewWinPageShow(aEvent) {
      newWin.getBrowser().removeEventListener("pageshow", testNewWinPageShow, true);

      // get the sessionstore state for the window
      let state = ss.getWindowState(newWin);

      // verify our cookie got set during pageload
      let e = cs.enumerator;
      let cookie;
      let i = 0;
      while (e.hasMoreElements()) {
        cookie = e.getNext().QueryInterface(Components.interfaces.nsICookie);
       i++;
      }
      is(i, 1, "expected one cookie");

      // remove the cookie
      cs.removeAll();

      // restore the window state
      ss.setWindowState(newWin, state, true);

      // at this point, the cookie should be restored...
      e = cs.enumerator;
      let cookie2;
      while (e.hasMoreElements()) {
        cookie2 = e.getNext().QueryInterface(Components.interfaces.nsICookie);
        if (cookie.name == cookie2.name)
          break;
      }
      is(cookie.name, cookie2.name, "cookie name successfully restored");
      is(cookie.value, cookie2.value, "cookie value successfully restored");
      is(cookie.path, cookie2.path, "cookie path successfully restored");

      // clean up
      if (Services.prefs.prefHasUserValue("browser.sessionstore.interval"))
        Services.prefs.clearUserPref("browser.sessionstore.interval");
      cs.removeAll();
      newWin.close();
      is(browserWindowsCount(), 1, "Only one browser window should be open eventually");
      finish();
    }, true);
  }, false);
}
