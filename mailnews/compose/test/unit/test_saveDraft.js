/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for checking correctly saved as draft with unread.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

function checkResult() {
  do_check_eq(gDraftFolder.getTotalMessages(false), 1);
  do_check_eq(gDraftFolder.getNumUnread(false), 1);
}

function actually_run_test() {
  yield async_run({ func: createMessage });
  checkResult();
  do_test_finished();
}

function run_test() {
  localAccountUtils.loadLocalMailAccount();

  do_test_pending();

  async_run({func: actually_run_test});
}

