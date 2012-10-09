/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Test that imapd.js fakeserver correctly implements LIST-EXTENDED imap
// extension (RFC 5258 - http://tools.ietf.org/html/rfc5258)

// async support
load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");

// IMAP pump
load("../../../resources/IMAPpump.js");

Components.utils.import("resource://gre/modules/Services.jsm");

// Globals


// Dovecot is one of the servers that supports LIST-EXTENDED
setupIMAPPump("Dovecot");
// create our own hander so that we can call imapd functions directly
var handler;

// Definition of tests
var tests = [
  setupMailboxes,
  testList,
  testListSelectSubscribed,
  testListReturnChilderen,
  testListReturnSubscribed,
  testListSelectMultiple,
  endTest
]

// mbox mailboxes cannot contain both child mailboxes and messages, so this will
// be one test case.
function setupMailboxes()
{
  gIMAPMailbox.flags = ["\\Marked", "\\NoInferiors"];
  gIMAPMailbox.subscribed = true;
  gIMAPDaemon.createMailbox("Fruit", {});
  gIMAPDaemon.createMailbox("Fruit/Apple", {});
  gIMAPDaemon.createMailbox("Fruit/Banana", {subscribed : true});
  gIMAPDaemon.createMailbox("Fruit/Peach", {nonExistent : true,
                                            subscribed : true});
  gIMAPDaemon.createMailbox("Tofu", {});
  gIMAPDaemon.createMailbox("Vegetable", {subscribed : true});
  gIMAPDaemon.createMailbox("Vegetable/Broccoli", {subscribed : true});
  gIMAPDaemon.createMailbox("Vegetable/Corn", {});

  handler = gIMAPServer._readers[0]._handler;

  // wait for imap pump to do it's thing or else we get memory leaks
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

// test that 'LIST "" "*"' returns the proper responses (standard LIST usage)
function testList()
{
  let response = handler.onError('2', 'LIST "" "*"');

  do_check_true(response.indexOf('* LIST (\\Marked \\NoInferiors) "/" "INBOX"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Fruit"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Fruit/Apple"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Fruit/Banana"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Tofu"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable/Broccoli"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable/Corn"') >= 0);
  do_check_true(response.indexOf('Peach') == -1);

  yield true;
}

// test that 'LIST (SUBSCRIBED) "" "*"' returns the proper responses
function testListSelectSubscribed()
{
  let response = handler.onError('3', 'LIST (SUBSCRIBED) "" "*"');

  do_check_true(response.indexOf('* LIST (\\Marked \\NoInferiors \\Subscribed) "/" "INBOX"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Fruit/Banana"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed \\NonExistent) "/" "Fruit/Peach"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Vegetable"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Vegetable/Broccoli"') >= 0);
  do_check_true(response.indexOf('"Fruit"') == -1);
  do_check_true(response.indexOf('Apple') == -1);
  do_check_true(response.indexOf('Tofu') == -1);
  do_check_true(response.indexOf('Corn') == -1);

  yield true;
}

// test that 'LIST "" "%" RETURN (CHILDEREN)' returns the proper responses
function testListReturnChilderen()
{
  let response = handler.onError('4', 'LIST "" "%" RETURN (CHILDREN)');

  do_check_true(response.indexOf('* LIST (\\Marked \\NoInferiors) "/" "INBOX"') >= 0);
  do_check_true(response.indexOf('* LIST (\\HasChildren) "/" "Fruit"') >= 0);
  do_check_true(response.indexOf('* LIST (\\HasNoChildren) "/" "Tofu"') >= 0);
  do_check_true(response.indexOf('* LIST (\\HasChildren) "/" "Vegetable"') >= 0);
  do_check_true(response.indexOf('Apple') == -1);
  do_check_true(response.indexOf('Banana') == -1);
  do_check_true(response.indexOf('Peach') == -1);
  do_check_true(response.indexOf('Broccoli') == -1);
  do_check_true(response.indexOf('Corn') == -1);

  yield true;
}

// test that 'LIST "" "*" RETURN (SUBSCRIBED)' returns the proper responses
function testListReturnSubscribed()
{
  let response = handler.onError('5', 'LIST "" "*" RETURN (SUBSCRIBED)');

  do_check_true(response.indexOf('* LIST (\\Marked \\NoInferiors \\Subscribed) "/" "INBOX"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Fruit"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Fruit/Apple"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Fruit/Banana"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Tofu"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Vegetable"') >= 0);
  do_check_true(response.indexOf('* LIST (\\Subscribed) "/" "Vegetable/Broccoli"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable/Corn"') >= 0);
  do_check_true(response.indexOf('Peach') == -1);

  yield true;
}

// test that 'LIST "" ("INBOX" "Tofu" "Vegetable/%")' returns the proper responses
function testListSelectMultiple()
{
  let response = handler._dispatchCommand('LIST', ['', '("INBOX" "Tofu" "Vegetable/%")']);

  do_check_true(response.indexOf('* LIST (\\Marked \\NoInferiors) "/" "INBOX"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Tofu"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable/Broccoli"') >= 0);
  do_check_true(response.indexOf('* LIST () "/" "Vegetable/Corn"') >= 0);
  do_check_true(response.indexOf('"Vegetable"') == -1);
  do_check_true(response.indexOf('Fruit') == -1);
  do_check_true(response.indexOf('Peach') == -1);

  yield true;
}

// Cleanup at end
function endTest()
{
  handler = null;
  teardownIMAPPump();
}

function run_test()
{
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  async_run_tests(tests);
}

/*
 * helper functions
 */

function recursiveDeleteMailboxes(aMailbox)
{
  for each (var child in aMailbox.allChildren) {
    recursiveDeleteMailboxes(child);
  }
  gIMAPDaemon.deleteMailbox(aMailbox);
}
