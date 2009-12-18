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

// add fake POP3 server driver
load("../../mailnews/resources/POP3pump.js");

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

  // Test setup - copy the data file into place
  var testAB = do_get_file("../../test_addbook/unit/data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB (this is the personal address book)
  testAB.copyTo(gProfileDir, kPABData.fileName);

  do_test_pending();

  // kick off copying
  gPOP3Pump.files = Files;
  gPOP3Pump.onDone = continueTest;
  gPOP3Pump.run();
}

function continueTest()
{
  // get the message headers
  let headerEnum = gLocalInboxFolder.messages;
  while (headerEnum.hasMoreElements())
    hdrs.push(headerEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  // check with spam properties set on the local server
  doChecks(gLocalIncomingServer);

  // Free our globals
  hdrs = null;
  gPOP3Pump = null;
  do_test_finished();
}

function doChecks(server)
{
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

  // check that the change was propagated to spamSettings
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

  /*
   * tests of whitelist suppression by identity
   */

  // setup
  let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                         .getService(Ci.nsIMsgAccountManager);
  let account = accountManager.FindAccountForServer(server);
  let identity = accountManager.createIdentity();
  // start with an email that does not match
  identity.email = "iAmNotTheSender@test.invalid";
  account.addIdentity(identity);

  // setup account and identify for the deferred-from fake server
  let fakeAccount = accountManager.createAccount();
  fakeAccount.incomingServer = gPOP3Pump.fakeServer;
  let fakeIdentity = accountManager.createIdentity();
  // start with an email that does not match
  fakeIdentity.email = "iAmNotTheSender@wrong.domain";
  fakeAccount.addIdentity(fakeIdentity);

  // gPOP3Pump delivers messages to the local inbox regardless of other
  // settings. But because we are testing here one of those other settings,
  // let's just pretend that it works like the real POP3 stuff, and set
  // the correct setting for deferring.
  gPOP3Pump.fakeServer.setCharValue("deferred_to_account", "account1");

  // suppress whitelisting for sender
  server.setBoolValue("inhibitWhiteListingIdentityUser", true);
  spamSettings.initialize(server);
  // (email does not match yet though)
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // add a matching email (mixing case)
  identity.email = "PrimaryEMAIL1@test.INVALID";
  spamSettings.initialize(server);
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // remove the matching email
  identity.email = "iAmNotTheSender@test.invalid";
  spamSettings.initialize(server);
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // add the email to the deferred-from server
  fakeIdentity.email = "PrimaryEMAIL1@test.INVALID";
  spamSettings.initialize(server);
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // stop suppressing identity users
  server.setBoolValue("inhibitWhiteListingIdentityUser", false);
  spamSettings.initialize(server);
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // remove the matching email from the fake identity
  fakeIdentity.email = "iAmNotTheSender@wrong.domain";

  // add a fully non-matching domain to the identity
  identity.email = "PrimaryEmail1@wrong.domain";

  // suppress whitelist by matching domain
  server.setBoolValue("inhibitWhiteListingIdentityDomain", true);
  spamSettings.initialize(server);
  // but domain still does not match
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // add a matching email to the identity, in the domain (mixing case)
  identity.email = "iAmNotTheSender@TEST.invalid";
  spamSettings.initialize(server);
  do_check_false(spamSettings.checkWhiteList(hdrs[kDomainTest]));

  // stop suppressing whitelist by domain
  server.setBoolValue("inhibitWhiteListingIdentityDomain", false);
  spamSettings.initialize(server);
  do_check_true(spamSettings.checkWhiteList(hdrs[kDomainTest]));
}

