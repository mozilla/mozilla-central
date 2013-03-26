/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-notifications';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/mailServices.js");
Cu.import("resource://gre/modules/Services.jsm");

// Our global folder variables...
var gFolder = null;
var gFolder2 = null;

// An object to keep track of the boolean preferences we change, so that
// we can put them back.
var gOrigBoolPrefs = {};
var gTotalOpenTime;

// Used by make_gradually_newer_sets_in_folders
var gMsgMinutes = 9000;

// We'll use this mock alerts service to capture notification events
var gMockAlertsService = {
  _doFail: false,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAlertsService]),

  showAlertNotification: function(imageUrl, title, text, textClickable, cookie,
                                  alertListener, name) {
    // Setting the _doFail flag allows us to revert to the newmailalert.xul
    // notification
    if (this._doFail) {
      throw Components.results.NS_ERROR_FAILURE;
    }
    this._didNotify = true;
    this._imageUrl = imageUrl;
    this._title = title;
    this._text = text;
    this._textClickable = textClickable;
    this._cookie = cookie;
    this._alertListener = alertListener;
    this._name = name;

    this._alertListener.observe(null, "alertfinished", this._cookie);
  },

  _didNotify: false,
  _imageUrl: null,
  _title: null,
  _text: null,
  _textClickable: null,
  _cookie: null,
  _alertListener: null,
  _name: null,

  _reset: function() {
    // Tell any listeners that we're through
    if (this._alertListener)
      this._alertListener.observe(null, "alertfinished", this._cookie);

    this._didNotify = false;
    this._imageUrl = null;
    this._title = null;
    this._text = null;
    this._textClickable = null;
    this._cookie = null;
    this._alertListener = null;
    this._name = null;
  }
};

var gMockAlertsServiceFactory = {
  createInstance: function(aOuter, aIID) {
    if (aOuter != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    if (!aIID.equals(Ci.nsIAlertsService))
      throw Cr.NS_ERROR_NO_INTERFACE;

    return gMockAlertsService;
  }
};

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let wh = collector.getModule('window-helpers');
  wh.installInto(module);

  // Register the mock alerts service
  Components.manager.QueryInterface(Ci.nsIComponentRegistrar)
            .registerFactory(Components
                             .ID("{1bda6c33-b089-43df-a8fd-111907d6385a}"),
                             "Mock Alerts Service",
                             "@mozilla.org/system-alerts-service;1",
                             gMockAlertsServiceFactory);

  // Ensure we have enabled new mail notifications
  remember_and_set_bool_pref("mail.biff.show_alert", true);

  MailServices.accounts.localFoldersServer.performingBiff = true;

  // Create a second identity to check cross-account
  // notifications.
  var identity2 = MailServices.accounts.createIdentity();
  identity2.email = "new-account@foo.invalid";

  var server = MailServices.accounts
                           .createIncomingServer("nobody",
                                                 "Test Local Folders", "pop3");

  server.performingBiff = true;

  // Create the target folders
  gFolder = create_folder("My Folder");
  let localRoot = server.rootFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  gFolder2 = localRoot.createLocalSubfolder("Another Folder");

  var account = MailServices.accounts.createAccount();
  account.incomingServer = server;
  account.addIdentity(identity2);
}

function teardownModule(module) {
  put_bool_prefs_back();
  Services.prefs.setIntPref("alerts.totalOpenTime", gTotalOpenTime);
}

function setupTest(test) {

  gFolder.markAllMessagesRead(null);
  gMockAlertsService._reset();
  gMockAlertsService._doFail = false;
  gFolder.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;
  gFolder2.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;

  remember_and_set_bool_pref("mail.biff.alert.show_subject", true);
  remember_and_set_bool_pref("mail.biff.alert.show_sender", true);
  remember_and_set_bool_pref("mail.biff.alert.show_preview", true);
  gTotalOpenTime = Services.prefs.getIntPref("alerts.totalOpenTime");
  Services.prefs.setIntPref("alerts.totalOpenTime", 3000);
}

function put_bool_prefs_back() {
  for (let prefString in gOrigBoolPrefs) {
    Services.prefs.setBoolPref(prefString, gOrigBoolPrefs[prefString]);
  }
}

function remember_and_set_bool_pref(aPrefString, aBoolValue) {
  if (!gOrigBoolPrefs[aPrefString])
    gOrigBoolPrefs[aPrefString] = Services.prefs.getBoolPref(aPrefString);

  Services.prefs.setBoolPref(aPrefString, aBoolValue);
}

/* This function wraps up make_new_sets_in_folder, and takes the
 * same arguments.  The point of this function is to ensure that
 * each sent message is slightly newer than the last.  In this
 * case, each new message set will be sent one minute further
 * into the future than the last message set.
 */
function make_gradually_newer_sets_in_folder(aFolder, aArgs)
{
  gMsgMinutes -= 1;
  if (!aArgs.age) {
    for each (let arg in aArgs)
      arg.age = {minutes: gMsgMinutes};
  }
  make_new_sets_in_folder(aFolder, aArgs);
}

/**
 * Test that we revert to newmailalert.xul if there is no system
 * notification service present.
 */
function test_revert_to_newmailalert() {
  // Set up the gMockAlertsService so that it fails
  // to send a notification.
  gMockAlertsService._doFail = true;

  // We expect the newmailalert.xul window...
  plan_for_new_window("alert:alert");
  make_gradually_newer_sets_in_folder(gFolder, [{count: 2}]);
  let controller = wait_for_new_window("alert:alert");
  plan_for_window_close(controller);
  wait_for_window_close();
}
test_revert_to_newmailalert.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that receiving new mail causes a notification to appear
 */
function test_new_mail_received_causes_notification() {
  make_gradually_newer_sets_in_folder(gFolder, [{count: 1}]);
  assert_true(gMockAlertsService._didNotify,
              "Did not show alert notification.");
}
test_new_mail_received_causes_notification.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that if notification shows, we don't show newmailalert.xul
 */
function test_dont_show_newmailalert() {
  make_gradually_newer_sets_in_folder(gFolder, [{count: 1}]);

  // Wait for newmailalert.xul to show
  plan_for_new_window("alert:alert");
  try {
    let controller = wait_for_new_window("alert:alert");
    throw Error("Opened newmailalert.xul when we shouldn't have.");
  } catch(e) {
    // Correct behaviour - the window didn't show.
  }
}
test_new_mail_received_causes_notification.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we notify, showing the oldest new, unread message received
 * since the last notification.
 */
function test_show_oldest_new_unread_since_last_notification() {
  let notifyFirst = "This should notify first";
  assert_false(gMockAlertsService._didNotify, "Should not have notified yet.");
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        body: {body: notifyFirst}}])
  assert_true(gMockAlertsService._didNotify, "Should have notified.");
  assert_true(gMockAlertsService._text.contains(notifyFirst, 1),
              "Should have notified for the first message");

  be_in_folder(gFolder);
  gFolder.biffState = Ci.nsIMsgFolder.nsMsgBiffState_NoMail;
  gMockAlertsService._reset();

  let notifySecond = "This should notify second";
  assert_false(gMockAlertsService._didNotify, "Should not have notified yet.");
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        body: {body: notifySecond}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified.");
  assert_true(gMockAlertsService._text.contains(notifySecond, 1),
              "Should have notified for the second message");
}
test_show_oldest_new_unread_since_last_notification.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that notifications work across different accounts.
 */
function test_notification_works_across_accounts() {
  // Cause a notification in the first folder
  make_gradually_newer_sets_in_folder(gFolder, [{count: 1}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified.");

  gMockAlertsService._reset();
  // We'll set the time for these messages to be slightly furthur
  // into the past.  That way, test_notification_independent_across_accounts
  // has an opportunity to send slightly newer messages that are older than
  // the messages sent to gFolder.
  make_gradually_newer_sets_in_folder(gFolder2,
                                      [{count: 2,
                                        age: {minutes: gMsgMinutes + 20}
                                       }]);
  assert_true(gMockAlertsService._didNotify, "Should have notified.");
}
test_notification_works_across_accounts.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/* Test that notification timestamps are independent from account
 * to account.  This is for the scenario where we have two accounts, and
 * one has notified while the other is still updating.  When the second
 * account completes, if it has new mail, it should notify, even if second
 * account's newest mail is older than the first account's newest mail.
 */
function test_notifications_independent_across_accounts() {
  make_gradually_newer_sets_in_folder(gFolder, [{count: 1}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified.");

  gMockAlertsService._reset();
  // Next, let's make some mail arrive in the second folder, but
  // let's have that mail be slightly older than the mail that
  // landed in the first folder.  We should still notify.
  make_gradually_newer_sets_in_folder(gFolder2,
                                      [{count: 2,
                                        age: {minutes: gMsgMinutes + 10}
                                       }]);
  assert_true(gMockAlertsService._didNotify, "Should have notified.");
}
test_notifications_independent_across_accounts.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can show the message subject in the notification.
 */
function test_show_subject() {
  let subject = "This should be displayed";
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        subject: subject
                                       }]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(subject),
              "Should have displayed the subject");
}
test_show_subject.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can hide the message subject in the notification.
 */
function test_hide_subject() {
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);
  let subject = "This should not be displayed";
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        subject: subject
                                       }]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(!gMockAlertsService._text.contains(subject),
                "Should not have displayed the subject");
}
test_hide_subject.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can show just the message sender in the notification.
 */
function test_show_only_subject() {
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", true);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";

  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        from: sender,
                                        subject: subject,
                                        body: {body: messageBody}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(subject),
              "Should have displayed the subject");
  assert_true(!gMockAlertsService._text.contains(messageBody),
                "Should not have displayed the preview");
  assert_true(!gMockAlertsService._text.contains(sender[0]),
                "Should not have displayed the sender");

}
test_show_only_subject.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];


/**
 * Test that we can show the message sender in the notification.
 */
function test_show_sender() {
  let sender = ["John Cleese", "john@cleese.invalid"];
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        from: sender}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(sender[0]),
              "Should have displayed the sender");
}
test_show_sender.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can hide the message sender in the notification.
 */
function test_hide_sender() {
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  let sender = ["John Cleese", "john@cleese.invalid"];
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        from: sender}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(!gMockAlertsService._text.contains(sender[0]),
                "Should not have displayed the sender");
}
test_hide_sender.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can show just the message sender in the notification.
 */
function test_show_only_sender() {
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", true);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";

  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        from: sender,
                                        subject: subject,
                                        body: {body: messageBody}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(sender[0]),
              "Should have displayed the sender");
  assert_true(!gMockAlertsService._text.contains(messageBody),
                "Should not have displayed the preview");
  assert_true(!gMockAlertsService._text.contains(subject),
                "Should not have displayed the subject");

}
test_show_only_sender.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can show the message preview in the notification.
 */
function test_show_preview() {
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", true);
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        body: {body: messageBody}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(messageBody),
              "Should have displayed the preview");
}
test_show_preview.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can hide the message preview in the notification.
 */
function test_hide_preview() {
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        body: {body: messageBody}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(!gMockAlertsService._text.contains(messageBody),
                "Should not have displayed the preview");
}
test_hide_preview.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can show justthe message preview in the notification.
 */
function test_show_only_preview() {
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", true);
  Services.prefs.setBoolPref("mail.biff.alert.show_sender", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_subject", false);

  let sender = ["John Cleese", "john@cleese.invalid"];
  let subject = "This should not be displayed";
  let messageBody = "My message preview";
  make_gradually_newer_sets_in_folder(gFolder,
                                      [{count: 1,
                                        from: sender,
                                        subject: subject,
                                        body: {body: messageBody}}]);
  assert_true(gMockAlertsService._didNotify, "Should have notified");
  assert_true(gMockAlertsService._text.contains(messageBody),
              "Should have displayed the preview: " + gMockAlertsService._text);
  assert_true(!gMockAlertsService._text.contains(sender[0]),
                "Should not have displayed the sender");
  assert_true(!gMockAlertsService._text.contains(subject),
                "Should not have displayed the subject");
}
test_show_only_preview.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we can receive notifications even when the biff state of
 * the folder has not been changed.
 */
function test_still_notify_with_unchanged_biff() {

  // For now, we'll make sure that if we receive 10 pieces
  // of email, one after the other, we'll be notified for all
  // (assuming of course that the notifications have a chance
  // to close in between arrivals - we don't want a queue of
  // notifications to go through).
  const HOW_MUCH_MAIL = 10;

  assert_false(gMockAlertsService._didNotify, "Should have notified.");

  for (let i = 0; i < HOW_MUCH_MAIL; i++) {
    make_gradually_newer_sets_in_folder(gFolder, [{count: 1}]);
    assert_true(gMockAlertsService._didNotify, "Should have notified.");
    gMockAlertsService._reset();
  }
}
test_still_notify_with_unchanged_biff.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];

/**
 * Test that we don't receive notifications for Draft, Queue, SentMail,
 * Templates or Junk folders.
 */
function test_no_notification_for_uninteresting_folders() {
  var someFolder = create_folder("Uninteresting Folder");
  var uninterestingFlags = [Ci.nsMsgFolderFlags.Drafts,
                            Ci.nsMsgFolderFlags.Queue,
                            Ci.nsMsgFolderFlags.SentMail,
                            Ci.nsMsgFolderFlags.Templates,
                            Ci.nsMsgFolderFlags.Junk,
                            Ci.nsMsgFolderFlags.Archive];

  for (var i = 0; i < uninterestingFlags.length; i++) {
    someFolder.flags = uninterestingFlags[i];
    make_gradually_newer_sets_in_folder(someFolder, [{count: 1}]);
    assert_false(gMockAlertsService._didNotify,
                "Showed alert notification.");
  }

  // However, we want to ensure that Inboxes *always* notify, even
  // if they possess the flags we consider uninteresting.
  someFolder.flags = Ci.nsMsgFolderFlags.Inbox;

  for (var i = 0; i < uninterestingFlags.length; i++) {
    someFolder.flags |= uninterestingFlags[i];
    make_gradually_newer_sets_in_folder(someFolder, [{count: 1}]);
    assert_true(gMockAlertsService._didNotify,
                "Did not show alert notification.");
    someFolder.flags = someFolder.flags & ~uninterestingFlags[i];
  }
}
test_no_notification_for_uninteresting_folders.EXCLUDED_PLATFORMS = ['winnt', 'darwin'];
