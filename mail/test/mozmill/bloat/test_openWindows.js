// These tests replicate those in mailnews/test/performance/bloat. However until
// we fix Bug 458352/Bug 500201 we can't switch bloat tests to mozmill. When
// we do, we need to also fix the sleeps to use events/waitFor, more information
// in bug 506625.

var elementslib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);

var mainController = null;

var setupModule = function(module) {
  mainController = mozmill.getMail3PaneController();
  controller.sleep(10000);
};

var test_start = function() {
  // We have to do this manually, MozMill doesn't have a function for non-browser windows.
  mainController.click(new elementslib.Elem(mainController.window.document.getElementById("button-address")));
  mainController.click(new elementslib.Elem(mainController.window.document.getElementById("button-newmsg")));

  mainController.sleep(5000);
}

var test_addressBook = function() {
  var abWindow = mozmill.getAddrbkController();
  abWindow.click(new elementslib.Elem(abWindow.window.document.getElementById("menu_close")));
}

var test_compose = function() {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);

  var composeWindow = wm.getMostRecentWindow("msgcompose");
  composeWindow.close();
}

var test_shutdown = function() {
  mainController.sleep(5000);
}
