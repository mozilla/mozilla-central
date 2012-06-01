/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  /** Test for Bug 456342 **/
  
  waitForExplicitFinish();
  
  // make sure we do save form data
  Services.prefs.setIntPref("browser.sessionstore.privacy_level", 0);
  
  let rootDir = getRootDirectory(gTestPath);
  let testURL = rootDir + "browser_456342_sample.xhtml";
  let tab = getBrowser().addTab(testURL);
  tab.linkedBrowser.addEventListener("load", function testTabLBLoad(aEvent) {
    this.removeEventListener("load", testTabLBLoad, true);

    let expectedValue = "try to save me";
    // Since bug 537289 we only save non-default values, so we need to set each
    // form field's value after load.
    let formEls = aEvent.originalTarget.forms[0].elements;
    for (let i = 0; i < formEls.length; i++)
      formEls[i].value = expectedValue;

    getBrowser().removeTab(tab);
    
    let undoItems = JSON.parse(ss.getClosedTabData(window));
    let savedFormData = undoItems[0].state.entries[0].formdata;
    
    let countGood = 0, countBad = 0;
    for each (let value in savedFormData) {
      if (value == expectedValue)
        countGood++;
      else
        countBad++;
    }
    
    is(countGood, 4, "Saved text for non-standard input fields");
    is(countBad,  0, "Didn't save text for ignored field types");
    
    // clean up
    if (Services.prefs.prefHasUserValue("browser.sessionstore.privacy_level"))
      Services.prefs.clearUserPref("browser.sessionstore.privacy_level");
    finish();
  }, true);
}
