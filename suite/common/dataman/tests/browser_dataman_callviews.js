/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Test loading views in data manager.

const DATAMAN_LOADED = "dataman-loaded";

// See browser_dataman_basics.js.
const kPreexistingDomains = 12;

var testIndex = 0;

function test() {
  // Add cookies.
  Services.cookies.add("getpersonas.com", "", "name0", "value0",
                       false, false, true, parseInt(Date.now() / 1000) + 600);
  Services.cookies.add("drumbeat.org", "", "name1", "value1",
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
          Services.cookies.remove("getpersonas.com", "name0", "value0", false);
          Services.cookies.remove("drumbeat.org", "name1", "value1", false);
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
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
  aWin.close();
  gBrowser.addTab();
  toDataManager("|cookies");
},

function test_load_datatype(aWin) {
  is(aWin.gDomains.selectfield.value, "Cookies",
    "Step " + testIndex + ": The correct menulist item is selected");
  is(aWin.gDomains.tree.view.rowCount, 2,
    "Step " + testIndex + ": The correct number of domains is listed");
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "drumbeat.org",
    "Step " + testIndex + ": The selected domain is correct");
  is(aWin.gTabs.activePanel, "cookiesPanel",
    "Step " + testIndex + ": Cookies panel is selected");
  aWin.gDomains.tree.view.selection.select(1);
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The second domain is correct as well");
  toDataManager("|permissions");
},

function test_switch_datatype(aWin) {
  is(aWin.gDomains.selectfield.value, "Permissions",
    "Step " + testIndex + ": The correct menulist item is selected");
  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 3,
    "Step " + testIndex + ": The correct number of domains is listed");
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "*",
    "Step " + testIndex + ": The selected domain is correct");
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
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
  gBrowser.addTab();
  toDataManager("sub.getpersonas.com:8888|permissions|add|popup");
},

function test_load_add_perm_existdomain(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
  is(aWin.gPerms.addSelBox.hidden, false,
    "Step " + testIndex + ": The addition box is shown");
  is(aWin.gPerms.addHost.value, "sub.getpersonas.com:8888",
    "Step " + testIndex + ": The correct host and port has been entered");
  is(aWin.gPerms.addType.value, "popup",
    "Step " + testIndex + ": The correct permission type has been selected");
  toDataManager("foo.geckoisgecko.org|permissions|add|image");
},

function test_switch_add_perm_newdomain(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "*",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
  is(aWin.gPerms.addSelBox.hidden, false,
    "Step " + testIndex + ": The addition box is shown");
  is(aWin.gPerms.addHost.value, "foo.geckoisgecko.org",
    "Step " + testIndex + ": The correct host has been entered");
  is(aWin.gPerms.addType.value, "image",
    "Step " + testIndex + ": The correct permission type has been selected");
  toDataManager("drumbeat.org|permissions|add|cookie");
},

function test_switch_add_perm_nopermdomain(aWin) {
  is(aWin.gDomains.tree.view.selection.count, 1,
    "Step " + testIndex + ": One domain is selected");
  is(aWin.gDomains.selectedDomain.title, "*",
    "Step " + testIndex + ": The correct domain is selected");
  is(aWin.gTabs.activePanel, "permissionsPanel",
    "Step " + testIndex + ": Permissions panel is selected");
  is(aWin.gPerms.addSelBox.hidden, false,
    "Step " + testIndex + ": The addition box is shown");
  is(aWin.gPerms.addHost.value, "drumbeat.org",
    "Step " + testIndex + ": The correct host has been entered");
  is(aWin.gPerms.addType.value, "cookie",
    "Step " + testIndex + ": The correct permission type has been selected");
  aWin.close();
}
];
