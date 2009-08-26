/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is sessionstore test code.
 *
 * The Initial Developer of the Original Code is
 * Simon Bünzli <zeniko@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Paul O’Shannessy <paul@oshannessy.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

function test() {
  /** Test for Bug 510890 **/
  
  // test setup
  let ss = Components.classes["@mozilla.org/suite/sessionstore;1"].getService(Components.interfaces.nsISessionStore);
  waitForExplicitFinish();
  
  function test_basic(callback) {
  
    let testURL = "about:config";
    let uniqueKey = "bug 510890";
    let uniqueValue = "unik" + Date.now();
    let uniqueText = "pi != " + Math.random();
  
  
    // make sure that the next closed window will increase getClosedWindowCount
    let max_windows_undo = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch)
                                     .getIntPref("browser.sessionstore.max_windows_undo");
    Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch)
              .setIntPref("browser.sessionstore.max_windows_undo", max_windows_undo + 1);
    let closedWindowCount = ss.getClosedWindowCount();
  
    let newWin = openDialog(location, "_blank", "chrome,all,dialog=no", testURL);
    newWin.addEventListener("load", function(aEvent) {
      newWin.getBrowser().addEventListener("pageshow", function(aEvent) {
        newWin.getBrowser().removeEventListener("pageshow", arguments.callee, false);

        executeSoon(function() {
          newWin.getBrowser().addTab();

          // mark the window with some unique data to be restored later on
          ss.setWindowValue(newWin, uniqueKey, uniqueValue);
          let textbox = newWin.content.document.getElementById("textbox");
          textbox.wrappedJSObject.value = uniqueText;

          newWin.close();

          is(ss.getClosedWindowCount(), closedWindowCount + 1,
             "The closed window was added to Recently Closed Windows");
          let data = JSON.parse(ss.getClosedWindowData())[0];
          ok(data.title == testURL && data.toSource().indexOf(uniqueText) > -1,
             "The closed window data was stored correctly");

          // reopen the closed window and ensure its integrity
          let newWin2 = ss.undoCloseWindow(0);

          ok(newWin2 instanceof ChromeWindow,
             "undoCloseWindow actually returned a window");
          is(ss.getClosedWindowCount(), closedWindowCount,
             "The reopened window was removed from Recently Closed Windows");

          newWin2.addEventListener("load", function(aEvent) {
            newWin2.getBrowser().addEventListener("SSTabRestored", function(aEvent) {
              newWin2.getBrowser().removeEventListener("SSTabRestored", arguments.callee, true);

              is(newWin2.getBrowser().tabContainer.childNodes.length, 2,
                 "The window correctly restored 2 tabs");
              is(newWin2.getBrowser().selectedBrowser.currentURI.spec, testURL,
                 "The window correctly restored the URL");

              let textbox = newWin2.content.document.getElementById("textbox");
              is(textbox.wrappedJSObject.value, uniqueText,
                 "The window correctly restored the form");
              is(ss.getWindowValue(newWin2, uniqueKey), uniqueValue,
                 "The window correctly restored the data associated with it");

              // clean up
              newWin2.close();
              Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch)
                        .clearUserPref("browser.sessionstore.max_windows_undo");
              executeSoon(callback);
            }, true);
          }, false);
        });
      }, false);
    }, false);
  }
  
  function test_behavior (callback) {
    // helper function that does the actual testing
    function openWindowRec(windowsToOpen, expectedResults, recCallback) {
      // do actual checking
      if (!windowsToOpen.length) {
        let closedWindowData = JSON.parse(ss.getClosedWindowData());
        let numPopups = closedWindowData.filter(function(el, i, arr) {
          return el.isPopup;
        }).length;
        let numNormal = ss.getClosedWindowCount() - numPopups;
        // #ifdef doesn't work in browser-chrome tests, so do a simple regex on platform
        let oResults = navigator.platform.match(/Mac/) ? expectedResults.mac
                                                       : expectedResults.other;
        is(numPopups, oResults.popup,
           "There were " + oResults.popup + " popup windows to repoen");
        is(numNormal, oResults.normal,
           "There were " + oResults.normal + " normal windows to repoen");

        // cleanup & return
        executeSoon(recCallback);
        return;
      }
      // hack to force window to be considered a popup (toolbar=no didn't work)
      let winData = windowsToOpen.shift();
      let settings = "chrome,dialog=no," +
                     (winData.isPopup ? "all=no" : "all");
      let url = "http://window" + windowsToOpen.length + ".example.com";
      let window = openDialog(location, "_blank", settings, url);
      window.addEventListener("load", function(aEvent) {
        window.gBrowser.addEventListener("load", function(aEvent) {
          // the window _should_ have state with a tab of url, but it doesn't
          // always happend before window.close(). addTab ensure we don't treat
          // this window as a stateless window
          window.gBrowser.addTab();
          window.gBrowser.removeEventListener("load", arguments.callee, true);
          executeSoon(function() {
            window.close();
            executeSoon(function() {
              openWindowRec(windowsToOpen, expectedResults, recCallback);
            });
          });
        }, true);
      }, true);
    }

    let windowsToOpen = [{isPopup: false},
                         {isPopup: false},
                         {isPopup: true},
                         {isPopup: true},
                         {isPopup: true}];
    let expectedResults = {mac: {popup: 3, normal: 0},
                           other: {popup: 3, normal: 1}};
    let windowsToOpen2 = [{isPopup: false},
                          {isPopup: false},
                          {isPopup: false},
                          {isPopup: false},
                          {isPopup: false}];
    let expectedResults2 = {mac: {popup: 0, normal: 3},
                            other: {popup: 0, normal: 3}};
    openWindowRec(windowsToOpen, expectedResults, function() {
      openWindowRec(windowsToOpen2, expectedResults2, callback);
    });
  }
  
  test_basic(function() {
    test_behavior(function() {
        finish();
    });
  });
}
