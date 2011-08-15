var setupModule = function() {
  controller = mozmill.getBrowserController();
}

var testErrorConsole = function() {
  controller.open("http://www.mozilla.org");
  controller.waitForPageLoad();

  var syntaxError =
}
