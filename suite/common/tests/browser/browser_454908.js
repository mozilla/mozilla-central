/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 454908 **/
  
  waitForExplicitFinish();
  
  let fieldValues = {
    username: "User " + Math.random(),
    passwd:   "pwd" + Date.now()
  };

  // make sure we do save form data
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 0);
  
  let rootDir = getRootDirectory(gTestPath);
  let testURL = rootDir + "browser_454908_sample.html";
  let tab = getBrowser().addTab(testURL);
  tab.linkedBrowser.addEventListener("load", function testTabLBLoad(aEvent) {
    tab.linkedBrowser.removeEventListener("load", testTabLBLoad, true);
    let doc = tab.linkedBrowser.contentDocument;
    for (let id in fieldValues)
      doc.getElementById(id).value = fieldValues[id];
    
    getBrowser().removeTab(tab);
    
    tab = getBrowser().undoCloseTab();
    tab.linkedBrowser.addEventListener("load", function testTabLBLoad2(aEvent) {
      tab.linkedBrowser.removeEventListener("load", testTabLBLoad2, true);
      let doc = tab.linkedBrowser.contentDocument;
      for (let id in fieldValues) {
        let node = doc.getElementById(id);
        if (node.type == "password")
          is(node.value, "", "password wasn't saved/restored");
        else
          is(node.value, fieldValues[id], "username was saved/restored");
      }
      
      // clean up
      if (Services.prefs.prefHasUserValue("browser.sessionstore.privacy_level"))
        Services.prefs.clearUserPref("browser.sessionstore.privacy_level");
      // undoCloseTab can reuse a single blank tab, so we have to
      // make sure not to close the window when closing our last tab
      if (gBrowser.tabContainer.childNodes.length == 1)
        gBrowser.addTab();
      gBrowser.removeTab(tab);
      finish();
    }, true);
  }, true);
}
