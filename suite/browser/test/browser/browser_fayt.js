/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

function test() {
  var tab1 = gBrowser.addTab("data:text/html;charset=utf-8,<p>this is some dummy text</p>");
  var tab2 = gBrowser.addTab("data:text/html;charset=utf-8,<p>this is some random text</p>");

  gBrowser.getBrowserForTab(tab2).addEventListener("load", runTest, true);
  waitForExplicitFinish();

  function runTest() {
    gBrowser.getBrowserForTab(tab2).removeEventListener("load", runTest, true);

    gBrowser.selectedTab = tab2;
    is(gBrowser.fastFind.find("random", false), Components.interfaces.nsITypeAheadFind.FIND_FOUND, "FAYT found the random text");
    gBrowser.selectedTab = tab1;
    is(gBrowser.fastFind.find("dummy", false), Components.interfaces.nsITypeAheadFind.FIND_FOUND, "FAYT found the dummy text");

    gBrowser.removeTab(tab2);
    gBrowser.removeTab(tab1);
    finish();
  }
}

