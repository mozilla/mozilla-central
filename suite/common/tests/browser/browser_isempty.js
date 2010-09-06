/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Bug 589659 - Lots of mozapps/extensions/test/ failures
// This introduced isTabEmpty() and isBrowserEmpty() functions, the latter
// being used in openUILinkIn() which in turn is used by switchToTabHavingURI()

var gWindowObject;
var gTabCount;

function test() {
  waitForExplicitFinish();
  gTabCount = gBrowser.tabs.length;

  gBrowser.selectedTab = gBrowser.addTab();
  is(isTabEmpty(gBrowser.selectedTab), true, "Added tab is empty");
  switchToTabHavingURI("about:", true, function(aBrowser) {
    gWindowObject = aBrowser.contentWindow.wrappedJSObject;
    end_test();
  });
}

function end_test() {
  gWindowObject.close();
  is(gBrowser.tabs.length, gTabCount, "We're still at the same number of tabs");
  finish();
}
