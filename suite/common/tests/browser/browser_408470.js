/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 408470 **/
  
  waitForExplicitFinish();
  
  let pendingCount = 1;
  let rootDir = getRootDirectory(gTestPath);
  let testURL = rootDir + "browser_408470_sample.html";
  let tab = getBrowser().addTab(testURL);
  let window = tab.ownerDocument.defaultView;
  
  tab.linkedBrowser.addEventListener("load", function loadListener1(aEvent) {
    tab.linkedBrowser.removeEventListener("load", loadListener1, true);
    // enable all stylesheets and verify that they're correctly persisted
    Array.forEach(tab.linkedBrowser.contentDocument.styleSheets, function(aSS, aIx) {
      pendingCount++;
      let ssTitle = aSS.title;
      stylesheetSwitchAll(tab.linkedBrowser.contentWindow, ssTitle);
      
      let newTab = ss.duplicateTab(window,tab);
      newTab.linkedBrowser.addEventListener("load", function loadListener2(aEvent) {
        newTab.linkedBrowser.removeEventListener("load", loadListener2, true);
        let states = Array.map(newTab.linkedBrowser.contentDocument.styleSheets,
                               function(aSS) !aSS.disabled);
        let correct = states.indexOf(true) == aIx && states.indexOf(true, aIx + 1) == -1;
        
        if (/^fail_/.test(ssTitle))
          ok(!correct, "didn't restore stylesheet " + ssTitle);
        else
          ok(correct, "restored stylesheet " + ssTitle);
        
        getBrowser().removeTab(newTab);
        if (--pendingCount == 0)
          finish();
      }, true);
    });
    
    // disable all styles and verify that this is correctly persisted
    tab.linkedBrowser.markupDocumentViewer.authorStyleDisabled = true;
    let newTab = ss.duplicateTab(window,tab);
    newTab.linkedBrowser.addEventListener("load", function loadListener3(aEvent) {
      newTab.linkedBrowser.removeEventListener("load", loadListener3, true);
      is(newTab.linkedBrowser.markupDocumentViewer.authorStyleDisabled, true,
         "disabled all stylesheets");
      
      getBrowser().removeTab(newTab);
      if (--pendingCount == 0)
        finish();
    }, true);
    
    getBrowser().removeTab(tab);
  }, true);
}
