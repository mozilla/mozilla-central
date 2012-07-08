/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Tests for platform-independent code to count new and unread messages and pass the
 * information to platform-specific notification modules */

Components.utils.import("resource:///modules/mailServices.js");

const iNMNS = Ci.mozINewMailNotificationService;

/*
 * Register listener for a particular event, make sure it shows up in the right lists
 * of listeners (and not the wrong ones) and doesn't show up after being removed
 */
add_test(function testListeners() {
  let notif = MailServices.newMailNotification.wrappedJSObject;
  let listener = {a: 1};

  notif.addListener(listener, iNMNS.count);
  let list = notif._listenersForFlag(iNMNS.count);
  do_check_eq(list.length, 1);
  do_check_eq(list[0], listener);

  let newlist = notif._listenersForFlag(iNMNS.messages);
  do_check_eq(newlist.length, 0);

  notif.removeListener(listener);
  list = notif._listenersForFlag(iNMNS.count);
  do_check_eq(list.length, 0);

  run_next_test();
});

/*
 * Register a listener for two types and another for one type, make sure they show up,
 * remove one and make sure the other stays put
 */
add_test(function testMultiListeners() {
  let notif = MailServices.newMailNotification.wrappedJSObject;
  let l1 = {a: 1};
  let l2 = {b: 2};

  notif.addListener(l1, (iNMNS.count | iNMNS.messages));
  // do_check_eq(notif._listeners.length, 1);
  notif.addListener(l2, iNMNS.messages);
  // do_check_eq(notif._listeners.length, 2);
  let list = notif._listenersForFlag(iNMNS.count);
  do_check_eq(list.length, 1);
  do_check_eq(list[0], l1);

  let newlist = notif._listenersForFlag(iNMNS.messages);
  do_check_eq(newlist.length, 2);

  notif.removeListener(l1);
  list = notif._listenersForFlag(iNMNS.count);
  do_check_eq(list.length, 0);
  newlist = notif._listenersForFlag(iNMNS.messages);
  do_check_eq(newlist.length, 1);
  do_check_eq(newlist[0], l2);
  notif.removeListener(l2);

  run_next_test();
});

const countInboxesPref = "mail.notification.count.inbox_only";

/* Make sure we get a notification call when the unread count changes on an Inbox */
add_test(function testNotifyInbox() {
  let notified = false;
  let mockListener = {
    onCountChanged: function TNU_onCountChanged(count) {notified = true;}
  };
  let folder = {
    URI: "Test Inbox",
    flags: Ci.nsMsgFolderFlags.Mail | Ci.nsMsgFolderFlags.Inbox
  };

  let notif = MailServices.newMailNotification.wrappedJSObject;
  notif.addListener(mockListener, iNMNS.count);

  notif.OnItemIntPropertyChanged(folder, "TotalUnreadMessages", 0, 2);
  do_check_true(notified);

  // Special folders should never count
  let special = {
    URI: "Test Special",
    flags: Ci.nsMsgFolderFlags.Mail | Ci.nsMsgFolderFlags.Junk
  };
  notified = false;
  notif.OnItemIntPropertyChanged(special, "TotalUnreadMessages", 0, 2);
  do_check_false(notified);

  // by default, non-inbox should not count
  let nonInbox = {
    URI: "Test Non-Inbox",
    flags: Ci.nsMsgFolderFlags.Mail
  };
  notified = false;
  notif.OnItemIntPropertyChanged(nonInbox, "TotalUnreadMessages", 0, 2);
  do_check_false(notified);

  // Try setting the pref to count non-inboxes and notifying a non-inbox
  Services.prefs.setBoolPref(countInboxesPref, false);
  notified = false;
  notif.OnItemIntPropertyChanged(nonInbox, "TotalUnreadMessages", 0, 2);
  do_check_true(notified);

  run_next_test();
});

function run_test() {
  run_next_test();
}
