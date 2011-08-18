var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
}

var testFoo = function(){
  controller.open('http://www.google.com');
  controller.waitForPageLoad();

  var urlbar = new elementslib.Lookup(controller.window.document, '/id("main-window")/id("tab-view-deck")/{"flex":"1"}/id("navigator-toolbox")/id("nav-bar")/id("urlbar-container")/id("urlbar")/anon({"class":"urlbar-frontcap-and-textbox"})/anon({"anonid":"stack"})/anon({"anonid":"textbox-container"})/anon({"anonid":"textbox-input-box"})/anon({"anonid":"input"})');
  var link = new elementslib.Link(controller.tabs.activeTab, "Advanced search");

  controller.dragToElement(link, urlbar, 100, 20);
    
  // should visit advanced search page
  controller.waitForPageLoad();
  var advancedSearch = new elementslib.Name(controller.tabs.activeTab, "as_q");
  controller.assertNode(advancedSearch);
}
