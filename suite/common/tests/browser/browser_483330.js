function test() {
  /** Test for Bug 483330 **/

  waitForExplicitFinish();

  let tab = getBrowser().addTab();
  getBrowser().selectedTab = tab;

  let browser = tab.linkedBrowser;
  browser.addEventListener("load", function loadListener(e) {
    browser.removeEventListener("load", loadListener, true);

    // Scroll the content document
    browser.contentWindow.scrollTo(1100, 1200);
    is(browser.contentWindow.scrollX, 1100, "scrolled horizontally");
    is(browser.contentWindow.scrollY, 1200, "scrolled vertically");

    getBrowser().removeTab(tab);

    let newTab = ss.undoCloseTab(window, 0);
    newTab.addEventListener("SSTabRestored", function tabRestored(e) {
      newTab.removeEventListener("SSTabRestored", tabRestored, true);

      let newBrowser = newTab.linkedBrowser;

      // check that the scroll position was restored
      is(newBrowser.contentWindow.scrollX, 1100, "still scrolled horizontally");
      is(newBrowser.contentWindow.scrollY, 1200, "still scrolled vertically");

      getBrowser().removeTab(newTab);

      finish();
    }, true);
  }, true);

  browser.loadURI("data:text/html,<body style='width: 100000px; height: 100000px;'><p>top</p></body>");
}
