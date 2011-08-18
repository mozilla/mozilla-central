var setupTest = function() {
  controller = mozmill.getBrowserController();
}

var testSelector = function() {
  controller.open('www.google.com');
  controller.waitForPageLoad();

  var elem = new elementslib.ID(controller.tabs.activeTab, "q");
  var elemBySelector = new elementslib.Selector(controller.tabs.activeTab, "#q");

  controller.assert(function() { return elem.getNode() == elemBySelector.getNode() });
  controller.assert(function() { return elem.getNode() == elemBySelector.getNode(0) });
}

