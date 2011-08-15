var setupModule = function(module) {
  controller = mozmill.getBrowserController();
}

var test = function () {
  controller.open("chrome://mozmill/content/test/test.html");
  controller.waitForPageLoad();

  var bar = new elementslib.ID(controller.window.document, "item1");
  var box = new elementslib.ID(controller.window.document, "item2");

  controller.dragToElement(bar, box);

  // successful drop makes bar disappear
  controller.assertNodeNotExist(bar);
}