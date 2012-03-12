/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests the get an account workflow.
 */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

let MODULE_NAME = 'test-cloudfile-notifications';

let RELATIVE_ROOT = '../shared-modules';
let MODULE_REQUIRES = ['folder-display-helpers',
                       'compose-helpers'];

let controller = {};
let mozmill = {};
let elib = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
Cu.import('resource://mozmill/modules/elementslib.js', elib);
Cu.import('resource://gre/modules/Services.jsm');

let maxSize;

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  let ch = collector.getModule('compose-helpers');
  ch.installInto(module);

  maxSize = Services.prefs
                    .getIntPref("mail.compose.big_attachments.threshold_kb",
                                0) * 1024;
};

function assert_cloudfile_notification_displayed(aController, aDisplayed) {
  let nb = aController.window
                      .document
                      .getElementById("attachmentNotificationBox");
  let hasNotification = false;

  if (nb.getNotificationWithValue("bigAttachment"))
    hasNotification = true;

  assert_equals(hasNotification, aDisplayed,
                "Expected the notification to be " +
                (aDisplayed ? "shown" : "not shown"));
}

function test_no_notification_for_small_file() {
  let cwc = open_compose_new_mail(mc);
  add_attachments(cwc, "http://www.example.com/1", 0);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/2", 1);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/3", 100);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/4", 500);
  assert_cloudfile_notification_displayed(cwc, false);
}

function test_notification_for_big_files() {
  let cwc = open_compose_new_mail(mc);
  add_attachments(cwc, "http://www.example.com/1", maxSize);
  assert_cloudfile_notification_displayed(cwc, true);

  add_attachments(cwc, "http://www.example.com/2", maxSize + 1000);
  assert_cloudfile_notification_displayed(cwc, true);

  add_attachments(cwc, "http://www.example.com/3", maxSize + 10000);
  assert_cloudfile_notification_displayed(cwc, true);

  add_attachments(cwc, "http://www.example.com/4", maxSize + 100000);
  assert_cloudfile_notification_displayed(cwc, true);
}

function test_graduate_to_notification() {
  let cwc = open_compose_new_mail(mc);
  add_attachments(cwc, "http://www.example.com/1", maxSize - 100);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/2", maxSize - 25);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/3", maxSize);
  assert_cloudfile_notification_displayed(cwc, true);
}

function test_no_notification_if_disabled() {
  let cwc = open_compose_new_mail(mc);

  Services.prefs.setBoolPref("mail.cloud_files.enabled", false);
  add_attachments(cwc, "http://www.example.com/1", maxSize);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/2", maxSize + 1000);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/3", maxSize + 10000);
  assert_cloudfile_notification_displayed(cwc, false);

  add_attachments(cwc, "http://www.example.com/4", maxSize + 100000);
  assert_cloudfile_notification_displayed(cwc, false);

  Services.prefs.setBoolPref("mail.cloud_files.enabled", true);
}
