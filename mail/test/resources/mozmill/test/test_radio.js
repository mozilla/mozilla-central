// Set to your local copy of shared-modules
var prefs = require("../../mozmill-tests/shared-modules/prefs");

var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
}

var testHTMLRadio = function() {
  controller.open('http://www.google.com/cse?cx=002443141534113389537%3Aysdmevkkknw&cof=FORID%3A0&q=mozmill&x=0&y=0');
  controller.waitForPageLoad();
  
  var radio = new elementslib.ID(controller.tabs.activeTab, "www");
  controller.radio(radio);
  controller.sleep(2000);
}

var testXULRadio = function() {
  prefs.openPreferencesDialog(controller, prefDialogCallback);
}

var prefDialogCallback = function(controller) {
  var prefDialog = new prefs.preferencesDialog(controller);
  
  var radio = new elementslib.ID(controller.window.document, "alwaysAsk");
  controller.radio(radio);
  controller.sleep(2000);
  
  radio = new elementslib.ID(controller.window.document, "saveTo");
  controller.radio(radio);
  controller.sleep(2000);

  prefDialog.close(true);
}
