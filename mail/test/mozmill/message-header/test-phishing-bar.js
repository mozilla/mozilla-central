/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 *  Test that the phishing bar behaves properly
 */

var MODULE_NAME = "test-phishing-bar";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers",
                       "window-helpers"];

var elib = {};
Components.utils.import("resource://mozmill/modules/elementslib.js", elib);
var os = {};
Components.utils.import('resource://mozmill/stdlib/os.js', os);

var folder;

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);

  folder = create_folder("PhishingBarA");
  add_message_to_folder(folder, create_message({body: {
    body: '<a href="http://www.evil.com/google/">http://www.google.com</a>',
    contentType: "text/html"
  }}));
}

/**
 * Make sure that the phishing bar is currently visible.
 *
 * @param msgc the Mozmill controller for the message window
 */
function assert_phishing_bar_visible(msgc) {
  assert_true(!msgc.e("msgNotificationBar").collapsed,
              "Notification bar is collapsed!");
  assert_equals(msgc.e("msgNotificationBar").selectedPanel,
                msgc.e("phishingBar"),
                "Notification bar not showing phishing bar!");
}

/**
 * Make sure that the phishing bar gets hidden when the ignore button is
 * clicked.
 *
 * @param msgc the Mozmill controller for the message window
 */
function help_test_hide_phishing_bar(msgc) {
  let phishingButton = msgc.e("phishingBar").getElementsByTagName("button")[0];
  assert_phishing_bar_visible(msgc);

  msgc.click(new elib.Elem(phishingButton));
  wait_for_message_display_completion(msgc, true);
  assert_true(msgc.e("msgNotificationBar").collapsed);
}

function test_hide_phishing_bar_from_message() {
  be_in_folder(folder);
  select_click_row(0);

  // XXX Disabled due very frequent random failures.
  // help_test_hide_phishing_bar(mc);
}

function test_hide_phishing_bar_from_eml() {
  // XXX Disabled due very frequent random failures.
  /*
  let thisFilePath = os.getFileForPath(__file__);
  let file = os.getFileForPath(os.abspath("./evil.eml", thisFilePath));

  let msgc = open_message_from_file(file);
  help_test_hide_phishing_bar(msgc);
  */
}

function test_phishing_bar_for_eml_attachment() {
  let thisFilePath = os.getFileForPath(__file__);
  let file = os.getFileForPath(os.abspath("./evil-attached.eml", thisFilePath));

  let msgc = open_message_from_file(file);

  // Make sure the root message shows the phishing bar.
  assert_phishing_bar_visible(msgc);

  // Open the attached message.
  plan_for_new_window("mail:messageWindow");
  msgc.e("attachmentList").getItemAtIndex(0).attachment.open();
  let msg2c = wait_for_new_window("mail:messageWindow");
  wait_for_message_display_completion(msg2c, true);

  // Now make sure the attached message shows the phishing bar.
  assert_phishing_bar_visible(msg2c);

  close_window(msg2c);
  close_window(msgc);
}
