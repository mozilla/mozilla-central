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
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
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

/*
 * Testing of junk whitelisting
 */
 
// add address book setup
load("../../mailnews/resources/abSetup.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
const prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);

/*
 * The address available in the test address book is "PrimaryEmail1@test.invalid"
 * Test emails may also include the address "invalid@example.com"
 *
 * Map of test email contents: (P is "Prim...", I is "inva.." address)
 *
 *  Index  Bugmail#      From
 *    0        1          P
 *    1        3          I
 *
 */
 
 // indices into hdrs[] of email by domain
 const kDomainTest = 0;
 const kDomainExample = 1;

var Files = 
[
  "../../mailnews/data/bugmail1",
  "../../mailnews/data/bugmail3"
]

let hdrs = [];

function run_test()
{
  loadLocalMailAccount();

  // Test setup - copy the data file into place
  var testAB = do_get_file("../../test_addbook/unit/data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB (this is the personal address book)
  testAB.copyTo(gProfileDir, kPABData.fileName);

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) { hdrs.push(gLocalInboxFolder.GetMessageHeader(aKey));},
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus)
    {
      var fileName = Files.shift();
      if (fileName)
      { 
        var file = do_get_file(fileName);
        copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                                    "", copyListener, null);
      }
      else
        continueTest();
    }
  };

  do_test_pending();
  
  // kick off copying
  copyListener.OnStopCopy(null);
}

function continueTest()
{
  let server = gLocalInboxFolder.server;
  let spamSettings = server.spamSettings;

  // default is to use the whitelist
  do_check_true(spamSettings.useWhiteList);

  // check email with the address PrimaryEmail1@test.invalid
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // check email without the address
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainExample]));

  //
  // check changes in server-level settings. Although the spamSettings object
  // has methods to set these, those methods are not persistent (which seems
  // strange). You need to set the actual preference, and call initialize on
  // spam settings, to get the settings to be saved persistently and stick, then
  // be recalled into the program. So that's the way that I will test it.
  //

  // disable whitelisting
  server.setBoolValue("useWhiteList", false);
  spamSettings.initialize(server);

  // check that the change was propogated to spamSettings
  do_check_false(spamSettings.useWhiteList);

  // and affects whitelisting calculationss
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // reenable whitelisting
  server.setBoolValue("useWhiteList", true);
  spamSettings.initialize(server);
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // Set an empty white list.
  // To really empty this, I have to change the default value as well
  prefs.setCharPref("mail.server.default.whiteListAbURI", "");
  server.setCharValue("whiteListAbURI", "");
  spamSettings.initialize(server);
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // add a trusted domain. This is a global preference
  prefs.setCharPref("mail.trusteddomains", "example.com");
  spamSettings.initialize(server);

  // check email with the address invalid@example.com, a trusted domain
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainExample]));

  // check email without the address
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // disable the trusted domain
  prefs.setCharPref("mail.trusteddomains", "");
  spamSettings.initialize(server);
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainExample]));

  // add back the Personal Address Book
  server.setCharValue("whiteListAbURI", kPABData.URI);
  spamSettings.initialize(server);
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  do_test_finished();
}

