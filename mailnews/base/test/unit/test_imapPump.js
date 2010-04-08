/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 *   Kent James <kent@caspia.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// This test is intended as a simple demonstration of the imap pump test method

// async support 
load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/mailTestUtils.js");
load("../../mailnews/resources/asyncTestUtils.js");

// IMAP pump
load("../../mailnews/resources/IMAPpump.js");

// Globals

// Messages to load must have CRLF line endings, that is Windows style
const gMessage = "bugmail10"; // message file used as the test message

setupIMAPPump();

// Definition of tests
var tests = [
  loadImapMessage,
  endTest
]

// load and update a message in the imap fake server
function loadImapMessage()
{
  gIMAPMailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          gIMAPMailbox.uidnext++, []));
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
  do_check_eq(1, gIMAPInbox.getTotalMessages(false));
  let msgHdr = firstMsgHdr(gIMAPInbox);
  do_check_true(msgHdr instanceof Ci.nsIMsgDBHdr);
  yield true;
}

// Cleanup at end
function endTest()
{
  teardownIMAPPump();
}

function run_test()
{
  async_run_tests(tests);
}

/*
 * helper functions
 */

// get the first message header found in a folder
function firstMsgHdr(folder) {
  let enumerator = folder.messages;
  if (enumerator.hasMoreElements())
    return enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
  return null;
}

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../mailnews/data/" + aFileName);
  let msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(file)
                     .QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}
