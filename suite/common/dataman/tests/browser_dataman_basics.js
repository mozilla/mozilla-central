/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Test basic functionality of the data manager.

// Happens to match what's used in Data Manager itself.
var gLocSvc = {
  fhist: Components.classes["@mozilla.org/satchel/form-history;1"]
                   .getService(Components.interfaces.nsIFormHistory2),
  idn: Components.classes["@mozilla.org/network/idn-service;1"]
                 .getService(Components.interfaces.nsIIDNService),
};

const DATAMAN_LOADED = "dataman-loaded";
const TEST_DONE = "dataman-test-done";

const kPreexistingDomains = 13;

function test() {
  // Preload data.
  // Note that before this test starts, what is already set are permissions for
  // addons.mozilla.org to install addons as well as
  // permissions for a number of sites used in mochitest to load XUL/XBL.
  // For the latter, those 13 domains are used/listed: 127.0.0.1, bank1.com,
  // bank2.com, example.com, example.org, mochi.test, mozilla.com, test,
  // w3.org, w3c-test.org, xn--exaple-kqf.test, xn--exmple-cua.test,
  // xn--hxajbheg2az3al.xn--jxalpdlp
  // We should not touch those permissions so other tests can run, which means
  // we should avoid using those domains altogether as we can't remove them.

  let now_epoch = parseInt(Date.now() / 1000);

  // Add dummy permission for getpersonas.com, less work (compared to rewriting
  // the test to work without getpersonas.com)
  Services.perms.add(Services.io.newURI("http://getpersonas.com/", null, null),
                     "install", Services.perms.ALLOW_ACTION);

  // Add cookie: not secure, non-HTTPOnly, session
  Services.cookies.add("bar.geckoisgecko.org", "", "name0", "value0",
                       false, false, true, now_epoch + 600);
  // Add cookie: not secure, HTTPOnly, session
  Services.cookies.add("foo.geckoisgecko.org", "", "name1", "value1",
                       false, true, true, now_epoch + 600);
  // Add cookie: secure, HTTPOnly, session
  Services.cookies.add("secure.geckoisgecko.org", "", "name2", "value2",
                       true, true, true, now_epoch + 600);
  // Add cookie: secure, non-HTTPOnly, expiry in an hour
  Services.cookies.add("drumbeat.org", "", "name3", "value3",
                       true, false, false, now_epoch + 3600);

  // Add a cookie for a pure IPv6 address.
  Services.cookies.add("::1", "", "name4", "value4",
                       false, false, true, now_epoch + 600);

  // Add a few form history entries
  gLocSvc.fhist.addEntry("akey", "value0");
  gLocSvc.fhist.addEntry("ekey", "value1");
  gLocSvc.fhist.addEntry("ekey", "value2");
  gLocSvc.fhist.addEntry("bkey", "value3");
  gLocSvc.fhist.addEntry("bkey", "value4");
  gLocSvc.fhist.addEntry("ckey", "value5");

  // Add a few passwords
  let loginInfo1 = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                             .createInstance(Components.interfaces.nsILoginInfo);
  loginInfo1.init("http://www.geckoisgecko.org", "http://www.geckoisgecko.org", null,
                  "dataman", "mysecret", "user", "pwd");
  Services.logins.addLogin(loginInfo1);
  let loginInfo2 = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                             .createInstance(Components.interfaces.nsILoginInfo);
  loginInfo2.init("gopher://geckoisgecko.org:4711", null, "foo",
                  "dataman", "mysecret", "", "");
  Services.logins.addLogin(loginInfo2);
  let loginInfo3 = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                             .createInstance(Components.interfaces.nsILoginInfo);
  loginInfo3.init("https://[::1]", null, "foo",
                  "dataman", "mysecret", "", "");
  Services.logins.addLogin(loginInfo3);

  //Services.prefs.setBoolPref("data_manager.debug", true);

  gBrowser.addTab();
  // Open the Data Manager, testing the menu item.
  document.getElementById("tasksDataman").click();

  var testIndex = 0;
  var win;

  let testObs = {
    observe: function(aSubject, aTopic, aData) {
      if (aTopic == DATAMAN_LOADED) {
        Services.obs.removeObserver(testObs, DATAMAN_LOADED);
        ok(true, "Data Manager is loaded");

        win = content.wrappedJSObject;
        Services.obs.addObserver(testObs, TEST_DONE, false);
        // Trigger the first test now!
        Services.obs.notifyObservers(window, TEST_DONE, null);
      }
      else {
        // TEST_DONE triggered, run next test
        info("run test #" + (testIndex + 1) + " of " + testFuncs.length +
             " (" + testFuncs[testIndex].name + ")");
        setTimeout(testFuncs[testIndex++], 0, win);

        if (testIndex >= testFuncs.length) {
          // Finish this up!
          Services.obs.removeObserver(testObs, TEST_DONE);
          Services.cookies.removeAll();
          gLocSvc.fhist.removeAllEntries();
          setTimeout(finish, 0);
        }
      }
    }
  };
  waitForExplicitFinish();
  Services.obs.addObserver(testObs, DATAMAN_LOADED, false);
}

var testFuncs = [
function test_open_state(aWin) {
  is(aWin.document.documentElement.id, "dataman-page",
     "The active tab is the Data Manager");
  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 6,
     "The correct number of domains is listed");
  is(aWin.gTabs.activePanel, "formdataPanel",
     "Form data panel is selected");

  aWin.document.getElementById("domainSearch").value = "mo";
  aWin.document.getElementById("domainSearch").doCommand();
  is(aWin.gDomains.tree.view.selection.count, 0,
     "In search, non-matching selection is lost");
  is(aWin.gDomains.tree.view.rowCount, 3,
     "In search, the correct number of domains is listed");
  is(aWin.gDomains.displayedDomains.map(function(aDom) { return aDom.title; })
                                   .join(","),
     "mochi.test,mozilla.com,mozilla.org",
     "In search, the correct domains are listed");

  aWin.gDomains.tree.view.selection.select(0);
  aWin.document.getElementById("domainSearch").value = "";
  aWin.document.getElementById("domainSearch").doCommand();
  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 6,
     "After search, the correct number of domains is listed");
  is(aWin.gDomains.tree.view.selection.count, 1,
     "After search, number of selections is correct");
  is(aWin.gDomains.selectedDomain.title, "mochi.test",
     "After search, matching selection is kept correctly");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_forget_ipv6(aWin) {
  // The main purpose of IPv6 entries is that things load, delete them ASAP.
  // Better forget panel tests (more checks) are in test_prefs_panel below.
  aWin.gDomains.tree.view.selection.select(1);
  is(aWin.gDomains.selectedDomain.title, "[::1]",
     "IPv6 domain is selected");
  aWin.document.getElementById("domain-context-forget").click();
  is(aWin.gTabs.activePanel, "forgetPanel",
     "Forget panel is selected");

  aWin.document.getElementById("forgetCookies").click();
  aWin.document.getElementById("forgetPasswords").click();
  aWin.document.getElementById("forgetButton").click();
  is(aWin.document.getElementById("forgetTab").hidden, true,
     "Forget tab is hidden again");
  is(aWin.document.getElementById("forgetTab").disabled, true,
     "Forget panel is disabled again");

  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 5,
     "The IPv6 domain has been removed from the list");
  is(aWin.gDomains.tree.view.selection.count, 0,
     "No domain is selected");

  aWin.gDomains.tree.view.selection.select(0);
  is(aWin.gDomains.selectedDomain.title, "*",
     "* domain is selected again");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_fdata_panel(aWin) {
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("formdataTab");
  is(aWin.gTabs.activePanel, "formdataPanel",
     "Form data panel is selected again");
  is(aWin.gFormdata.tree.view.rowCount, 6,
     "The correct number of form data entries is listed");

  aWin.gFormdata.tree.view.selection.rangedSelect(0, 1, true); // item 0, 3
  aWin.document.getElementById("fdataSearch").value = "b"; // item 3, 4 match
  aWin.document.getElementById("fdataSearch").doCommand();
  is(aWin.gFormdata.tree.view.selection.count, 1,
     "In search, non-matching part of selection is lost");
  is(aWin.gFormdata.displayedFormdata[aWin.gFormdata.tree.currentIndex].value, "value3",
     "In search, matching part selection is kept correctly");
  is(aWin.gFormdata.tree.view.rowCount, 2,
     "In search, the correct number of form data entries is listed");
  is(aWin.gFormdata.displayedFormdata.map(function(aFd) { return aFd.value; })
                                     .join(","),
     "value3,value4",
     "In search, the correct domains are listed");

  aWin.document.getElementById("fdataSearch").value = "";
  aWin.document.getElementById("fdataSearch").doCommand();
  is(aWin.gFormdata.tree.view.rowCount, 6,
     "After search, the correct number of form data entries is listed");
  is(aWin.gFormdata.tree.view.selection.count, 1,
     "After search, number of selections is correct");
  is(aWin.gFormdata.displayedFormdata[aWin.gFormdata.tree.currentIndex].value, "value3",
     "After search, matching selection is kept correctly");

  aWin.gFormdata.tree.view.selection.clearSelection();
  is(aWin.document.getElementById("fdataRemove").disabled, true,
     "The remove button is disabled");
  aWin.gFormdata.tree.view.selection.rangedSelect(0, 1, true); // value0, value3
  aWin.gFormdata.tree.view.selection.rangedSelect(3, 3, true); // value5
  aWin.gFormdata.tree.view.selection.rangedSelect(5, 5, true); // value2
  is(aWin.gFormdata.tree.view.selection.count, 4,
     "The correct number of items is selected");
  is(aWin.document.getElementById("fdataRemove").disabled, false,
     "After selecting, the remove button is enabled");

  gLocSvc.fhist.removeEntry("ckey", "value5");
  is(aWin.gFormdata.tree.view.rowCount, 5,
     "After remove, the correct number of form data entries is listed");
  is(aWin.gFormdata.tree.view.selection.count, 3,
     "After remove, the correct number of items is selected");

  gLocSvc.fhist.addEntry("dkey", "value6");
  is(aWin.gFormdata.tree.view.rowCount, 6,
     "After add, the correct number of form data entries is listed");
  is(aWin.gFormdata.tree.view.selection.count, 3,
     "After add, the correct number of items is selected");

  aWin.document.getElementById("fdataValueCol").click();
  is(aWin.gFormdata.tree.view.selection.count, 3,
     "After sort, the correct number of items is selected");
  is(aWin.gDataman.getTreeSelections(aWin.gFormdata.tree)
                  .map(function(aSel) { return aWin.gFormdata.displayedFormdata[aSel].value; })
                  .join(","),
     "value0,value2,value3",
     "After sort, correct items are selected");

  // Select only one for testing remove button, as catching the prompt is hard.
  aWin.gFormdata.tree.view.selection.select(5);
  aWin.document.getElementById("fdataRemove").click();
  is(aWin.gFormdata.tree.view.rowCount, 5,
     "After remove button, the correct number of form data entries is listed");
  is(aWin.gFormdata.tree.view.selection.count, 1,
     "After remove button, one item is selected again");
  is(aWin.gFormdata.tree.currentIndex, 4,
     "After remove button, correct index is selected");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_cookies_panel(aWin) {
  aWin.gDomains.tree.view.selection.select(8);
  is(aWin.gDomains.selectedDomain.title, "geckoisgecko.org",
     "For cookie tests 1, correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
     "Cookies panel is selected");
  is(aWin.gCookies.tree.view.rowCount, 3,
     "The correct number of cookies is listed");

  aWin.gCookies.tree.view.selection.select(0);
  is(aWin.document.getElementById("cookieInfoSendType").value,
     "Any type of connection",
     "Correct send type for first cookie");
  is(aWin.document.getElementById("cookieInfoExpires").value,
     "At end of session",
     "Correct expiry label for first cookie");

  aWin.gCookies.tree.view.selection.select(1);
  is(aWin.document.getElementById("cookieInfoSendType").value,
     "Any type of connection, no script access",
     "Correct send type for second cookie");

  aWin.gCookies.tree.view.selection.select(2);
  is(aWin.document.getElementById("cookieInfoSendType").value,
     "Encrypted connections only and no script access",
     "Correct send type for third cookie");

  aWin.gDomains.tree.view.selection.select(4);
  is(aWin.gDomains.selectedDomain.title, "drumbeat.org",
     "For cookie tests 2, correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
     "Cookies panel is selected");
  is(aWin.gCookies.tree.view.rowCount, 1,
     "The correct number of cookies is listed");
  aWin.gCookies.updateContext(); // don't actually open it, would be async
  is(aWin.document.getElementById("cookies-context-selectall").disabled, false,
     "The select all context menu item is enabled");
  is(aWin.document.getElementById("cookies-context-remove").disabled, true,
     "The remove context menu item is disabled");

  aWin.document.getElementById("cookies-context-selectall").click();
  is(aWin.document.getElementById("cookieInfoSendType").value,
     "Encrypted connections only",
     "Correct send type for fourth cookie");
  isnot(aWin.document.getElementById("cookieInfoExpires").value,
        "At end of session",
        "Expiry label for this cookie is not session");
  aWin.gCookies.updateContext(); // don't actually open it, would be async
  is(aWin.document.getElementById("cookies-context-selectall").disabled, true,
     "After selecting, the select all context menu item is disabled");
  is(aWin.document.getElementById("cookies-context-remove").disabled, false,
     "After selecting, the remove context menu item is enabled");

  aWin.document.getElementById("cookies-context-remove").click();
  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 4,
     "The domain has been removed from the list");
  is(aWin.gTabs.activePanel, null,
     "No panel is active");
  is(aWin.gTabs.tabbox.selectedTab.disabled, true,
     "The selected panel is disabled");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_permissions_panel(aWin) {
  aWin.gDomains.tree.view.selection.select(8);
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
     "For permissions tests, correct domain is selected");
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "Permissions panel is selected");
  Services.perms.add(Services.io.newURI("http://cookie.getpersonas.com/", null, null),
                     "cookie", Components.interfaces.nsICookiePermission.ACCESS_SESSION);
  Services.perms.add(Services.io.newURI("http://cookie2.getpersonas.com/", null, null),
                     "cookie", Services.perms.DENY_ACTION);
  Services.perms.add(Services.io.newURI("http://geo.getpersonas.com/", null, null),
                     "geo", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://image.getpersonas.com/", null, null),
                     "image", Services.perms.DENY_ACTION);
  Services.perms.add(Services.io.newURI("http://indexedDB.getpersonas.com/", null, null),
                     "indexedDB", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://install.getpersonas.com/", null, null),
                     "install", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://offline.getpersonas.com/", null, null),
                     "offline-app", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://popup.getpersonas.com/", null, null),
                     "popup", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://stsuse.getpersonas.com/", null, null),
                     "sts/use", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://stssubd.getpersonas.com/", null, null),
                     "sts/subd", Services.perms.ALLOW_ACTION);
  Services.perms.add(Services.io.newURI("http://test.getpersonas.com/", null, null),
                     "test", Services.perms.DENY_ACTION);
  Services.perms.add(Services.io.newURI("http://xul.getpersonas.com/", null, null),
                     "allowXULXBL", Services.perms.ALLOW_ACTION);
  Services.logins.setLoginSavingEnabled("password.getpersonas.com", false);
  is(aWin.gPerms.list.children.length, 14,
     "The correct number of permissions is displayed in the list");
  for (let i = 1; i < aWin.gPerms.list.children.length; i++) {
    let perm = aWin.gPerms.list.children[i];
    switch (perm.type) {
      case "allowXULXBL":
        is(perm.getAttribute("label"), "Use XUL/XBL Markup",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 2,
           "Set back to correct default");
        break;
      case "cookie":
        is(perm.getAttribute("label"), "Set Cookies",
           "Correct label for type: " + perm.type);
        is(perm.capability, perm.host == "cookie.getpersonas.com" ? 8 : 2,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 1,
           "Set back to correct default");
        break;
      case "geo":
        is(perm.getAttribute("label"), "Share Location",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 2,
           "Set back to correct default");
        break;
      case "image":
        is(perm.getAttribute("label"), "Load Images",
           "Correct label for type: " + perm.type);
        is(perm.capability, 2,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 1,
           "Set back to correct default");
        break;
      case "indexedDB":
        is(perm.getAttribute("label"), "Store Local Databases",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 2,
           "Set back to correct default");
        break;
      case "install":
        is(perm.getAttribute("label"), "Install Add-ons",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 2,
           "Set back to correct default");
        break;
      case "offline-app":
        is(perm.getAttribute("label"), "Offline Web Applications",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 1,
           "Set back to correct default");
        break;
      case "password":
        is(perm.getAttribute("label"), "Save Passwords",
           "Correct label for type: " + perm.type);
        is(perm.capability, 2,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 1,
           "Set back to correct default");
        break;
      case "popup":
        is(perm.getAttribute("label"), "Open Popup Windows",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 1,
           "Set back to correct default");
        break;
      case "sts/use":
        is(perm.getAttribute("label"), "Use Strict Transport Security",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 0,
           "Set back to correct default");
        break;
      case "sts/subd":
        is(perm.getAttribute("label"), "Apply Strict Transport Security to subdomains",
           "Correct label for type: " + perm.type);
        is(perm.capability, 1,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 0,
           "Set back to correct default");
        break;
      default:
        is(perm.getAttribute("label"), perm.type,
           "Correct default label for type: " + perm.type);
        is(perm.capability, 2,
           "Correct capability for: " + perm.host);
        perm.useDefault(true);
        is(perm.capability, 0,
           "Set to correct default");
       break;
    }
  }

  aWin.gDomains.tree.view.selection.select(0); // Switch to * domain.
  aWin.gDomains.tree.view.selection.select(8); // Switch back to rebuild the perm list.
  is(aWin.gPerms.list.children.length, 1,
     "After the test, the correct number of permissions is displayed in the list");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_permissions_add(aWin) {
  aWin.gDomains.tree.view.selection.select(0);
  is(aWin.gDomains.selectedDomain.title, "*",
     "For add permissions tests, * domain is selected again");
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "Permissions panel is selected");
  is(aWin.gPerms.list.disabled, true,
     "The permissions list is disabled");
  is(aWin.gPerms.addButton.disabled, false,
     "The add permissions button is enabled");
  aWin.gPerms.addButton.click();
  is(aWin.gPerms.addSelBox.hidden, false,
     "The addition box is shown");
  is(aWin.gPerms.addHost.value, "",
     "The host is empty");
  is(aWin.gPerms.addType.value, "",
     "No type is selected");
  is(aWin.gPerms.addButton.disabled, true,
     "The add permissions button is disabled");
  aWin.gPerms.addHost.value = "foo";
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("formdataTab");
  is(aWin.gTabs.activePanel, "formdataPanel",
     "Successfully switched to form data panel");
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("permissionsTab");
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "Successfully switched back to permissions panel");
  is(aWin.gPerms.addButton.disabled, false,
     "The add permissions button is enabled again");
  is(aWin.gPerms.addSelBox.hidden, true,
     "The addition box is hidden");
  aWin.gPerms.addButton.click();
  is(aWin.gPerms.addHost.value, "",
     "The host is empty again");
  is(aWin.gPerms.addType.value, "",
     "No type is selected still");
  aWin.gPerms.addHost.value = "data.permfoobar.com";
  aWin.gPerms.addType.value = "cookie";
  aWin.gPerms.addType.click();
  is(aWin.gPerms.addButton.disabled, false,
     "With host and type set, the add permissions button is enabled");
  aWin.gPerms.addButton.click();
  is(aWin.gPerms.list.disabled, false,
     "After adding, the permissions list is enabled");
  is(aWin.gPerms.list.children.length, 1,
     "A permission is displayed in the list");
  let perm = aWin.gPerms.list.children[0];
  is(perm.type, "cookie",
     "Added permission has correct type");
  is(perm.host, "data.permfoobar.com",
     "Added permission has correct host");
  is(perm.capability, 1,
     "Added permission has correct value (default)");
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("formdataTab");
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("permissionsTab");
  is(aWin.gPerms.list.disabled, true,
     "After switching between panels, the permissions list is disabled again");
  aWin.gDomains.tree.view.selection.select(8);
  is(aWin.gDomains.selectedDomain.title, "getpersonas.com",
     "Switched to correct domain for another add test");
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "Permissions panel is selected");
  aWin.gPerms.addButton.click();
  is(aWin.gPerms.addHost.value, "getpersonas.com",
     "On add, the host is set correctly");
  is(aWin.gPerms.addType.value, "",
     "Again, no type is selected");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_prefs_panel(aWin) {
  Services.contentPrefs.setPref("my.drumbeat.org", "data_manager.test", "foo", null);
  Services.contentPrefs.setPref("drumbeat.org", "data_manager.test", "bar", null);
  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 5,
     "The domain for prefs tests has been added from the list");
  aWin.gDomains.tree.view.selection.select(4);
  is(aWin.gDomains.selectedDomain.title, "drumbeat.org",
     "For prefs tests, correct domain is selected");
  is(aWin.gTabs.activePanel, "preferencesPanel",
     "Preferences panel is selected");
  is(aWin.gPrefs.tree.view.rowCount, 2,
     "The correct number of prefs is listed");

  aWin.gDomains.updateContext(); // don't actually open it, would be async
  is(aWin.document.getElementById("domain-context-forget").disabled, false,
     "The domain's forget context menu item is enabled");

  aWin.document.getElementById("domain-context-forget").click();
  is(aWin.gTabs.activePanel, "forgetPanel",
     "Forget panel is selected");
  is(aWin.document.getElementById("forgetTab").disabled, false,
     "Forget panel is enabled");
  is(aWin.document.getElementById("forgetTab").hidden, false,
     "Forget panel is unhidden");

  aWin.gDomains.tree.view.selection.select(3);
  isnot(aWin.gDomains.selectedDomain.title, "drumbeat.org",
        "Switching away goes to a different domain: " + aWin.gDomains.selectedDomain.title);
  isnot(aWin.gTabs.activePanel, "forgetPanel",
        "Forget panel is not selected any more: " + aWin.gTabs.activePanel);
  is(aWin.document.getElementById("forgetTab").disabled, true,
     "Forget panel is disabled");
  is(aWin.document.getElementById("forgetTab").hidden, true,
     "Forget panel is disabled");

  aWin.gDomains.tree.view.selection.select(4);
  is(aWin.gDomains.selectedDomain.title, "drumbeat.org",
     "Correct domain is selected again");
  aWin.document.getElementById("domain-context-forget").click();
  is(aWin.gTabs.activePanel, "forgetPanel",
     "Forget panel is selected again");
  is(aWin.document.getElementById("forgetTab").disabled, false,
     "Forget panel is enabled again");
  is(aWin.document.getElementById("forgetTab").hidden, false,
     "Forget panel is unhidden again");

  is(aWin.document.getElementById("forgetPreferences").disabled, false,
     "Forget preferences checkbox is enabled");
  is(aWin.document.getElementById("forgetButton").disabled, true,
     "Forget button is disabled");
  aWin.document.getElementById("forgetPreferences").click();
  is(aWin.document.getElementById("forgetPreferences").checked, true,
     "Forget preferences checkbox is checked");
  is(aWin.document.getElementById("forgetButton").disabled, false,
     "Forget button is enabled");

  aWin.document.getElementById("forgetButton").click();
  is(aWin.document.getElementById("forgetButton").hidden, true,
     "Forget button is hidden");
  is(aWin.document.getElementById("forgetPreferences").hidden, true,
     "Forget preferences checkbox is hidden");
  is(aWin.document.getElementById("forgetPreferencesLabel").hidden, false,
     "Forget preferences label is shown");
  is(aWin.document.getElementById("forgetTab").hidden, true,
     "Forget tab is hidden again");
  is(aWin.document.getElementById("forgetTab").disabled, true,
     "Forget panel is disabled again");

  is(aWin.gDomains.tree.view.rowCount, kPreexistingDomains + 4,
     "The domain for prefs tests has been removed from the list");
  is(aWin.gDomains.tree.view.selection.count, 0,
     "No domain is selected");

  aWin.gDomains.updateContext(); // don't actually open it, would be async
  is(aWin.document.getElementById("domain-context-forget").disabled, true,
     "The domain's forget context menu item is disabled");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_passwords_panel(aWin) {
  aWin.gDomains.tree.view.selection.select(7);
  is(aWin.gDomains.selectedDomain.title, "geckoisgecko.org",
     "For passwords tests, correct domain is selected");
  is(aWin.gTabs.activePanel, "cookiesPanel",
     "Cookies panel is selected");

  aWin.gDomains.updateContext(); // don't actually open it, would be async
  is(aWin.document.getElementById("domain-context-forget").disabled, false,
     "The domain's forget context menu item is enabled");

  aWin.document.getElementById("domain-context-forget").click();
  is(aWin.gTabs.activePanel, "forgetPanel",
     "Forget panel is selected");
  is(aWin.document.getElementById("forgetTab").disabled, false,
     "Forget panel is enabled");
  is(aWin.document.getElementById("forgetTab").hidden, false,
     "Forget panel is unhidden");
  is(aWin.document.getElementById("forgetPreferences").hidden, false,
     "Forget preferences checkbox is shown");
  is(aWin.document.getElementById("forgetPreferences").disabled, true,
     "Forget preferences checkbox is disabled");
  is(aWin.document.getElementById("forgetPreferencesLabel").hidden, true,
     "Forget preferences label is hidden");
  is(aWin.document.getElementById("forgetCookies").hidden, false,
     "Forget cookies checkbox is shown");
  is(aWin.document.getElementById("forgetCookies").disabled, false,
     "Forget cookies checkbox is enabled");
  is(aWin.document.getElementById("forgetCookiesLabel").hidden, true,
     "Forget cookies label is hidden");
  is(aWin.document.getElementById("forgetPasswords").hidden, false,
     "Forget passwords checkbox is shown");
  is(aWin.document.getElementById("forgetPasswords").disabled, false,
     "Forget passwords checkbox is enabled");
  is(aWin.document.getElementById("forgetPasswordsLabel").hidden, true,
     "Forget passwords label is hidden");
  is(aWin.document.getElementById("forgetButton").hidden, false,
     "Forget button is shown");
  is(aWin.document.getElementById("forgetButton").disabled, true,
     "Forget button is disabled");

  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("passwordsTab");
  is(aWin.gTabs.activePanel, "passwordsPanel",
     "Passwords panel is selected");
  is(aWin.gPasswords.tree.view.rowCount, 2,
     "The correct number of passwords is listed");
  is(aWin.document.getElementById("pwdRemove").disabled, true,
     "The remove button is disabled");

  aWin.gPasswords.tree.view.selection.select(0);
  is(aWin.document.getElementById("pwdRemove").disabled, false,
     "After selecting, the remove button is enabled");

  aWin.document.getElementById("pwdRemove").click();
  is(aWin.gPasswords.tree.view.rowCount, 1,
     "After deleting, the correct number of passwords is listed");
  is(aWin.gPasswords.tree.view.selection.count, 1,
     "After deleting, one password is selected again");
  is(aWin.gPasswords.tree.currentIndex, 0,
     "After deleting, correct index is selected");
  is(aWin.document.getElementById("pwdRemove").disabled, false,
     "After deleting, the remove button is still enabled");

  aWin.gPasswords.tree.view.selection.select(0);
  aWin.document.getElementById("pwdRemove").click();
  is(aWin.document.getElementById("pwdRemove").disabled, true,
     "After deleting last password, the remove button is disabled");
  is(aWin.gTabs.activePanel, "cookiesPanel",
     "After deleting last password, cookies panel is selected again");
  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_idn(aWin) {
  // Use a domain with an existing permission.
  let testDomain = "xn--hxajbheg2az3al.xn--jxalpdlp";
  let idnDomain = gLocSvc.idn.convertToDisplayIDN(testDomain, {});
  isnot(testDomain, idnDomain, "Using a valid IDN domain");
  // Add IDN cookie.
  Services.cookies.add(testDomain, "", "name0", "value0",
                       false, false, true, parseInt(Date.now() / 1000) + 600);

  aWin.document.getElementById("domainSearch").value = "xn--";
  aWin.document.getElementById("domainSearch").doCommand();
  is(aWin.gDomains.tree.view.rowCount, 1,
     "Search for 'xn--' returns one result");
  is(aWin.gDomains.displayedDomains.map(function(aDom) { return aDom.title; })
                                   .join(","),
     "xn--exaple-kqf.test", "In xn-- search, only the non-decodable domain is listed");
  aWin.document.getElementById("domainSearch").value = idnDomain.charAt(3);
  aWin.document.getElementById("domainSearch").doCommand();
  is(aWin.gDomains.tree.view.rowCount, 1,
     "IDN search returns a result");
  is(aWin.gDomains.displayedDomains.map(function(aDom) { return aDom.title; })
                                   .join(","),
     testDomain, "In IDN search, the correct domain is listed");
  aWin.document.getElementById("domainSearch").value = "";
  aWin.document.getElementById("domainSearch").doCommand();

  aWin.gDomains.tree.view.selection.select(kPreexistingDomains + 3);
  is(aWin.gDomains.selectedDomain.title, testDomain,
     "For IDN tests, correct domain is selected");
  is(aWin.gDomains.selectedDomain.displayTitle, idnDomain,
     "The display title of that domain is correct");
  is(aWin.gTabs.activePanel, "cookiesPanel",
     "Cookies panel is selected");
  is(aWin.gCookies.tree.view.getCellText(0, aWin.gCookies.tree.columns["cookieHostCol"]),
     idnDomain,
     "Correct domain displayed for IDN cookie");
  aWin.gCookies.tree.view.selection.select(0);
  aWin.document.getElementById("cookieRemove").click();

  is(aWin.gTabs.activePanel, "permissionsPanel",
     "After deleting, correctly switched to permissions panel");
  let perm = aWin.gPerms.list.children[0];
  is(perm.host, "bug413909." + testDomain,
     "Permission has correct host");
  is(perm.getAttribute("displayHost"), "bug413909." + idnDomain,
     "Permission has correct display host");

  // Add pref with decoded IDN name.
  Services.contentPrefs.setPref(testDomain, "data_manager.test", "foo", null);
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("preferencesTab");
  is(aWin.gTabs.activePanel, "preferencesPanel",
     "Successfully switched to preferences panel for IDN tests");
  // Add pref with encoded IDN name while panel is shown (different code path).
  Services.contentPrefs.setPref(idnDomain, "data_manager.test2", "bar", null);
  is(aWin.gPrefs.tree.view.getCellText(0, aWin.gPrefs.tree.columns["prefsHostCol"]),
     idnDomain,
     "Correct domain displayed for punycode IDN preference");
  is(aWin.gPrefs.tree.view.getCellText(1, aWin.gPrefs.tree.columns["prefsHostCol"]),
     idnDomain,
     "Correct domain displayed for utf8 IDN preference");
  aWin.gPrefs.tree.view.selection.select(0);
  aWin.document.getElementById("prefsRemove").click();
  aWin.document.getElementById("prefsRemove").click();
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "After deleting, correctly switched back to permissions panel");

  // Add IDN password (usually have encoded names)
  let loginInfo1 = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                             .createInstance(Components.interfaces.nsILoginInfo);
  loginInfo1.init("http://" + idnDomain, "http://" + idnDomain, null,
                  "dataman", "mysecret", "user", "pwd");
  Services.logins.addLogin(loginInfo1);
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("passwordsTab");
  is(aWin.gTabs.activePanel, "passwordsPanel",
     "Successfully switched to passwords panel for IDN tests");
  is(aWin.gPasswords.tree.view.getCellText(0, aWin.gPasswords.tree.columns["pwdHostCol"]),
     "http://" + idnDomain,
     "Correct domain displayed for IDN password");
  aWin.gPasswords.tree.view.selection.select(0);
  aWin.document.getElementById("pwdRemove").click();
  is(aWin.gTabs.activePanel, "permissionsPanel",
     "After deleting, correctly switched back to permissions panel");

  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_storage_load(aWin) {
  // Load the page that fills in several web storage entries.
  Services.perms.add(Services.io.newURI("http://mochi.test:8888/", null, null),
                     "offline-app", Services.perms.ALLOW_ACTION);

  // Get the http address from the current chrome test path
  let rootDir = getRootDirectory(gTestPath).replace("chrome://mochitests/content/", "http://mochi.test:8888/");
  let testURL = rootDir + "dataman_storage.html";
  let storagetab = gBrowser.addTab(testURL);
  let stWin = storagetab.linkedBrowser.contentWindow.wrappedJSObject;
  let dmStorageListener = {
    handleEvent: function dmStorageHandler(aEvent) {
      let tab = aEvent.target;
      if (tab == storagetab) {
        gBrowser.tabContainer.removeEventListener("TabClose", this, false);
        // Force DOM Storage to write its data to the disk.
        Services.obs.notifyObservers(null, "domstorage-flush-timer", "");
        Services.perms.remove("mochi.test", "offline-app");
        Services.obs.notifyObservers(window, TEST_DONE, null);
      }
    },
  };
  gBrowser.tabContainer.addEventListener("TabClose", dmStorageListener, false);
},

function test_storage_wait(aWin) {
  // Wait to make sure that DOM Storage flushing has actually worked.
  setTimeout(function foo() {
      Services.obs.notifyObservers(window, TEST_DONE, null); }, 1000);
},

function test_storage(aWin) {
  aWin.gStorage.reloadList();
  info("appcache groups: " + aWin.gLocSvc.appcache.getGroups().length);
  aWin.gDomains.tree.view.selection.select(8);
  is(aWin.gDomains.selectedDomain.title, "mochi.test",
    "For storage tests, correct domain is selected");
  is(aWin.document.getElementById("storageTab").disabled, false,
    "Storage panel is enabled");
  aWin.gTabs.tabbox.selectedTab = aWin.document.getElementById("storageTab");
  is(aWin.gTabs.activePanel, "storagePanel",
    "Storage panel is selected");
  is(aWin.gStorage.tree.view.rowCount, 3,
    "The correct number of storages is listed");
  is(aWin.gStorage.displayedStorages
         .map(function(aStorage) { return aStorage.type; })
         .sort().join(","),
      "appCache,indexedDB,localStorage",
      "The correct types of storage are listed");

  for (let i = aWin.gStorage.tree.view.rowCount - 1; i >= 0; i--) {
    let remType = aWin.gStorage.displayedStorages[0].type;
    info("Removing " + remType);
    aWin.gStorage.tree.view.selection.select(0);
    aWin.document.getElementById("storageRemove").click();
    is(aWin.gStorage.tree.view.rowCount, i,
      remType + " entry removed");
  }

  isnot(aWin.gTabs.activePanel, "storagePanel",
    "Storage panel is not selected any more");

  Services.obs.notifyObservers(window, TEST_DONE, null);
},

function test_close(aWin) {
  function dmWindowClosedListener() {
    aWin.removeEventListener("unload", dmWindowClosedListener, false);
    isnot(content.document.documentElement.id, "dataman-page",
       "The active tab is not the Data Manager");
    Services.obs.notifyObservers(window, TEST_DONE, null);
  }
  aWin.addEventListener("unload", dmWindowClosedListener, false);
  aWin.close();
}
];
