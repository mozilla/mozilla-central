const localTestFolder = collector.addHttpResource('./files/');

var setupTest = function() {
  controller = mozmill.getBrowserController();
}

var testReload = function() {
  var testPage = localTestFolder + "singlediv.html";
  controller.open(testPage);
  controller.waitForPageLoad();

  var elem = new elementslib.Selector(controller.tabs.activeTab, "#test-div");
  controller.assertNode(elem);
  
  controller.open(testPage);
  controller.waitForPageLoad();
  
  controller.assertNode(elem);
}

