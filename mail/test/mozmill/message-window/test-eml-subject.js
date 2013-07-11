/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Tests that opening an .eml file with emtpy subject works.
 */

var MODULE_NAME = "test-eml-subject";

var RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var os = {};
Cu.import('resource://mozmill/stdlib/os.js', os);
Cu.import("resource:///modules/StringBundle.js");

var setupModule = function(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
};

function check_eml_window_title(subject, eml) {
  let file = os.getFileForPath(os.abspath(eml, os.getFileForPath(__file__)));
  let msgc = open_message_from_file(file);

  let brandBundle = new StringBundle("chrome://branding/locale/brand.properties");
  let productName = brandBundle.get("brandFullName");
  let expectedTitle = subject;
  if (expectedTitle && !Application.platformIsMac)
    expectedTitle += " - ";

  if (!expectedTitle || !Application.platformIsMac)
    expectedTitle += productName;

  assert_equals(msgc.window.document.title, expectedTitle);
  close_window(msgc);
}

function test_eml_empty_subject() {
  check_eml_window_title("", "./emptySubject.eml");
}

function test_eml_normal_subject() {
  check_eml_window_title("An email", "./evil.eml");
}
