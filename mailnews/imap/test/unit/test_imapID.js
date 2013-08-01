/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that we handle the RFC2197 ID command.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kIDResponse = "(\"name\" \"GImap\" \"vendor\" \"Google, Inc.\" \"support-url\" \"http://mail.google.com/support\")";

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
