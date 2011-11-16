var elementslib = {}; 
Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);
var mozmill = {}; 
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);

var setupModule = function(){
  controller = mozmill.getBrowserController();
  controller.open("http://mozilla.org");
}

var setupTest = function(){
  controller.open("http://mozilla.org");
  controller.waitForPageLoad();
}

var testSetupModuleReporting = function() {
  // We should have mozilla.org page open
  var q = new elementslib.ID(controller.tabs.activeTab, "q");
  controller.type(q, "firefox");
  
  var btn = new elementslib.ID(controller.tabs.activeTab, "quick-search-btn");
  controller.click(btn);

  controller.waitForPageLoad();
}

var teardownTest = function(){
  controller.open("http://www.google.com");
  controller.waitForPageLoad();
}

var teardownModule = function(){
  controller.open("http://www.bing.com");
  controller.waitForPageLoad();
}
