/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Test loading views in data manager.

Components.utils.import("resource://gre/modules/Services.jsm");

// Happens to match what's used in Data Manager itself.
var gLocSvc = {
  cookie: Components.classes["@mozilla.org/cookiemanager;1"]
                    .getService(Components.interfaces.nsICookieManager2),
}

const DATAMAN_LOADED = "dataman-loaded";
var testIndex = 0;

function test() {
  // Add cookie.
  gLocSvc.cookie.add("getpersonas.com", "", "name0", "value0",
                     false, false, true, parseInt(Date.now() / 1000) + 600);

  //Services.prefs.setBoolPref("data_manager.debug", true);

  var win;

  gBrowser.addTab();
  toDataManager("example.org");

  let testObs = {
    observe: function(aSubject, aTopic, aData) {
      if (aTopic == DATAMAN_LOADED) {
        // Run next test
        info("run test #" + (testIndex + 1) + " of " + testFuncs.length +
             " (" + testFuncs[testIndex].name + ")");

        ok(true, "Step " + (testIndex + 1) + ": Data Manager is loaded");
        win = content.wrappedJSObject;

        testFuncs[testIndex++](win);

        if (testIndex >= testFuncs.length) {
          // Finish this up!
          Services.obs.removeObserver(testObs, DATAMAN_LOADED);
          gLocSvc.cookie.remove("getpersonas.com", "name0", "value0", false);
          finish();
        }
      }
    }
  };
  waitForExplicitFinish();
  Services.obs.addObserver(testObs, DATAMAN_LOADED, false);
}

var testFuncs = [
function test_load_basic(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "example.org",
    "Step " + testIndex + ": The correct domain is selected");
  toDataManager("getpersonas.com|cookies");
},

function test_switch_panel(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
    "Step " + testIndex + ": Cookies panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("www.getpersonas.com:443|permissions");
},

function test_load_with_panel(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("getpersonas.com|preferences");
},

function test_load_disabled_panel(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
    "Step " + testIndex + ": Cookies panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("getpersonas.com|unknown");
},

function test_load_inexistent_panel(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
    "Step " + testIndex + ": Cookies panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("unknowndomainexample.com");
},

function test_load_unknown_domain(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "*",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "formdataPanel",
    "Step " + testIndex + ": Form data panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("|cookies");
},

function test_load_datatype(aWin) {
  is(aWin.gDomains.selectfield.value, "Cookies",
    "Step " + testIndex + ": The correct menulist item is selected");
  is(aWin.gDomains.tree.view.rowCount, 1,
    "Step " + testIndex + ": The correct number of domains is listed");
  aWin.gDomains.tree.view.selection.select(0);
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The listed domain is correct");
  toDataManager("www.getpersonas.com");
},

function test_escape_datatype(aWin) {
  is(aWin.gDomains.selectfield.value, "all",
    "Step " + testIndex + ": The correct menulist item is selected");
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  aWin.close();
}
];
