/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that we handle the RFC2197 ID command.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const kIDResponse = "(\"name\" \"GImap\" \"vendor\" \"Google, Inc.\" \"support-url\" \"http://mail.google.com/support\")";

var tests = [
  setup,
  function updateInbox() {
    let rootFolder = IMAPPump.incomingServer.rootFolder;
    IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function checkIDHandling() {
    do_check_eq(IMAPPump.daemon.clientID, "(\"name\" \"xpcshell\" \"version\" \"1\")");
    do_check_eq(IMAPPump.incomingServer.serverIDPref, kIDResponse);
  },
  teardown
]

function setup() {
  setupIMAPPump("GMail");
  IMAPPump.daemon.idResponse = kIDResponse;

  // update folder to kick start tests.
  IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
