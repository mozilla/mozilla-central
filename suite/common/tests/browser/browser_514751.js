/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 509315 (Wallpaper) **/

  waitForExplicitFinish();

  let state = {
    windows: [{
      tabs: [{
        entries: [
          { url: "http://www.mozilla.org/projects/minefield/", title: "Minefield Start Page" },
          {}
        ]
      }]
    }]
  };

  let windowObserver = {
    observe: function(aSubject, aTopic, aData) {
      let theWin = aSubject.QueryInterface(Ci.nsIDOMWindow);

      switch(aTopic) {
        case "domwindowopened":
          theWin.addEventListener("load", function testTheWinLoad() {
            theWin.removeEventListener("load", testTheWinLoad, false);
            executeSoon(function() {
              var gotError = false;
              try {
                ss.setWindowState(theWin, JSON.stringify(state), true);
              } catch (e) {
                if (/NS_ERROR_MALFORMED_URI/.test(e))
                  gotError = true;
              }
              ok(!gotError, "Didn't get a malformed URI error.");
              executeSoon(function() {
                theWin.close();
              });
            });
          }, false);
          break;

        case "domwindowclosed":
          Services.ww.unregisterNotification(this);
          finish();
          break;
      }
    }
  }
  Services.ww.registerNotification(windowObserver);
  Services.ww.openWindow(null,
                         location,
                         "_blank",
                         "chrome,all,dialog=no",
                         null);

}
