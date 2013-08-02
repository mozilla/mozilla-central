/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/IOUtils.js");

const MSG_LINEBREAK = "\r\n";

function run_test() {
  localAccountUtils.loadLocalMailAccount();

  test_parse_headers_without_crash("./data/mailformed_recipients.eml");
  test_parse_headers_without_crash("./data/mailformed_subject.eml");
  test_parse_headers_without_crash("./data/invalid_mozilla_keys.eml");
}

function test_parse_headers_without_crash(eml) {
  let file = do_get_file(eml);

  let parser = Cc["@mozilla.org/messenger/messagestateparser;1"]
                 .createInstance(Ci.nsIMsgParseMailMsgState);

  parser.SetMailDB(localAccountUtils.inboxFolder.getDatabaseWOReparse());
  parser.state = Ci.nsIMsgParseMailMsgState.ParseHeadersState;

  let mailData = IOUtils.loadFileToString(file);
  let lines = mailData.split(MSG_LINEBREAK);

  for (let line = 0; line < lines.length; line++) {
    parser.ParseAFolderLine(lines[line] + MSG_LINEBREAK, lines[line].length + 2);
  }
}
