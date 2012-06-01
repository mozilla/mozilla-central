/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 466937 **/
  
  waitForExplicitFinish();
  
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
             .getService(Components.interfaces.nsIProperties)
             .get("TmpD", Components.interfaces.nsILocalFile);
  file.append("466937_test.file");
  let testPath = file.path;
  
  let testURL = "http://mochi.test:8888/browser/" +
    "suite/common/tests/browser/browser_466937_sample.html";
  
  let tab = getBrowser().addTab(testURL);
  let window = tab.ownerDocument.defaultView;
  tab.linkedBrowser.addEventListener("load", function testTabLBLoad(aEvent) {
    tab.linkedBrowser.removeEventListener("load", testTabLBLoad, true);
    let doc = tab.linkedBrowser.contentDocument;
    doc.getElementById("reverse_thief").value = "/home/user/secret2";
    doc.getElementById("bystander").value = testPath;
    
    let tab2 = ss.duplicateTab(window,tab);
    tab2.linkedBrowser.addEventListener("load", function testTab2LBLoad(aEvent) {
      tab2.linkedBrowser.removeEventListener("load", testTab2LBLoad, true);
      doc = tab2.linkedBrowser.contentDocument;
      is(doc.getElementById("thief").value, "",
         "file path wasn't set to text field value");
      is(doc.getElementById("reverse_thief").value, "",
         "text field value wasn't set to full file path");
      is(doc.getElementById("bystander").value, testPath,
         "normal case: file path was correctly preserved");
      
      // clean up
      gBrowser.removeTab(tab2);
      gBrowser.removeTab(tab);
      
      finish();
    }, true);
  }, true);
}
