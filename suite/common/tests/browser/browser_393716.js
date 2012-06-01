function test() {
  /** Test for Bug 393716 **/
  
  waitForExplicitFinish();
  
  /////////////////
  // getTabState //
  /////////////////
  let key = "Unique key: " + Date.now();
  let value = "Unique value: " + Math.random();
  let testURL = "about:config";
  
  // create a new tab
  let tab = getBrowser().addTab(testURL);
  ss.setTabValue(tab, key, value);
  tab.linkedBrowser.addEventListener("load", function testTabLBLoad(aEvent) {
    this.removeEventListener("load", testTabLBLoad, true);
    // get the tab's state
    let state = ss.getTabState(tab);
    ok(state, "get the tab's state");
    
    // verify the tab state's integrity
    state = eval("(" + state + ")");
    ok(state instanceof Object && state.entries instanceof Array && state.entries.length > 0,
       "state object seems valid");
    ok(state.entries.length == 1 && state.entries[0].url == testURL,
       "Got the expected state object (test URL)");
    ok(state.extData && state.extData[key] == value,
       "Got the expected state object (test manually set tab value)");
    
    // clean up
    getBrowser().removeTab(tab);
  }, true);
  
  //////////////////////////////////
  // setTabState and duplicateTab //
  //////////////////////////////////
  let key2 = "key2";
  let value2 = "Value " + Math.random();
  let value3 = "Another value: " + Date.now();
  let state = { entries: [{ url: testURL }], extData: { key2: value2 } };
  
  // create a new tab
  let tab2 = getBrowser().addTab();
  // set the tab's state
  ss.setTabState(tab2, JSON.stringify(state));
  tab2.linkedBrowser.addEventListener("load", function testTab2LBLoad(aEvent) {
    this.removeEventListener("load", testTab2LBLoad, true);
   // verify the correctness of the restored tab
    ok(ss.getTabValue(tab2, key2) == value2 && this.currentURI.spec == testURL,
       "the tab's state was correctly restored");
    
    // add text data
    let textbox = this.contentDocument.getElementById("textbox");
    textbox.value = value3;
    
    // duplicate the tab
    let duplicateTab = ss.duplicateTab(window, tab2);
    getBrowser().removeTab(tab2);
    
    duplicateTab.linkedBrowser.addEventListener("load", function testTab2DupLBLoad(aEvent) {
      this.removeEventListener("load", testTab2DupLBLoad, true);
      // verify the correctness of the duplicated tab
      ok(ss.getTabValue(duplicateTab, key2) == value2 && this.currentURI.spec == testURL,
         "correctly duplicated the tab's state");
      let textbox = this.contentDocument.getElementById("textbox");
      is(textbox.value, value3, "also duplicated text data");
      
      // clean up
      getBrowser().removeTab(duplicateTab);
      finish();
    }, true);
  }, true);
}
