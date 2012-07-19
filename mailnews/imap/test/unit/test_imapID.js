/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that we handle the RFC2197 ID command.
 */

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kIDResponse = "(\"name\" \"GImap\" \"vendor\" \"Google, Inc.\" \"support-url\" \"http://mail.google.com/support\")";

const XULAPPINFO_CONTRACTID = "@mozilla.org/xre/app-info;1";
const XULAPPINFO_CID = Components.ID("{7e10a36e-1085-4302-9e3f-9571fc003ee0}");

var gAppInfo = null;

function createAppInfo(id, name, version, platformVersion) {
  gAppInfo = {
    // nsIXULAppInfo
    vendor: "Mozilla",
    name: name,
    ID: id,
    version: version,
    appBuildID: "2007010101",
    platformVersion: platformVersion,
    platformBuildID: "2007010101",

    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIXULAppInfo,
                                           Components.interfaces.nsISupports])
  };

  var XULAppInfoFactory = {
    createInstance: function (outer, iid) {
      if (outer != null)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      return gAppInfo.QueryInterface(iid);
    }
  };
  var registrar = Components.manager.QueryInterface(Components.interfaces.nsIComponentRegistrar);
  registrar.registerFactory(XULAPPINFO_CID, "XULAppInfo",
                            XULAPPINFO_CONTRACTID, XULAppInfoFactory);

}

var tests = [
  setup,
  function updateInbox() {
    let rootFolder = gIMAPIncomingServer.rootFolder;
    gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function checkIDHandling() {
    do_check_eq(gIMAPDaemon.clientID, "(\"name\" \"XPCShell\" \"version\" \"5\")");
    do_check_eq(gIMAPIncomingServer.serverIDPref, kIDResponse);
  },
  teardown
]

function setup() {
  createAppInfo("xpcshell@tests.mozilla.org", "XPCShell", "5", "2.0");

  setupIMAPPump("GMail");
  gIMAPDaemon.idResponse = kIDResponse;

  // update folder to kick start tests.
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
