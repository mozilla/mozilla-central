function test() {
  waitForExplicitFinish();

  var pageInfo;
  var gTestPage = gBrowser.addTab();
  gBrowser.selectedTab = gTestPage;
  gTestPage.linkedBrowser.addEventListener("load", handleLoad, true);
  content.location =
    "http://localhost:8888/browser/suite/browser/test/feed_tab.html";
  gTestPage.focus();
  var obs = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

  var observer = {
    observe: function(win, topic, data) {
      if (topic != "page-info-dialog-loaded")
        return;

      obs.removeObserver(observer, "page-info-dialog-loaded");
      handlePageInfo();
    }
  };

  function handleLoad() {
    gTestPage.linkedBrowser.removeEventListener("load", handleLoad, true);
    obs.addObserver(observer, "page-info-dialog-loaded", false);
    pageInfo = BrowserPageInfo();
  }

  function handlePageInfo() {
    function $(aId) { return pageInfo.document.getElementById(aId) };
    var feedTab = $("feedPanel");
    var feedListbox = $("feedListbox");

    ok(feedListbox, "Feed list is null (feeds tab is broken)");

    var feedRowsNum = feedListbox.getRowCount();

    ok(feedRowsNum == 3, "Number of feeds listed: " +
                         feedRowsNum + ", should be 3");


    for (var i = 0; i < feedRowsNum; i++) {
      let feedItem = feedListbox.getItemAtIndex(i);
      ok(feedItem.getAttribute("name") == (i+1), 
         "Name given: " + feedItem.getAttribute("name") + ", should be " + (i+1));
    }

    pageInfo.close();
    gTestPage.focus();
    gBrowser.removeCurrentTab();
    finish();
  }
}
