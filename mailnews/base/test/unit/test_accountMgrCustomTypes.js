/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests that accounts with invalid types, such as could be created
 *  from an extension, do not disappear immediately when the extension
 *  is unloaded.
 *
 * Adapted from test_AccountMgr.js by Kent James <kent@caspia.com>
 */

function run_test()
{
  Services.prefs.setCharPref("mail.account.account1.identities", "id1");
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.identities", "id2");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");
  Services.prefs.setCharPref("mail.server.server1.hostname", "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server1.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server1.directory-rel",
                             "[ProfD]Mail/Local Folders");

  // Here we are simulating a server and account that is added by an
  //  extension, but that extension is currently unloaded. The extension
  //  added "secondsToLeaveUnavailable" (though a typical value would be
  //  one month, not 2 seconds!) to tell the core code to leave this alone
  //  for awhile if the extension is unloaded.
  Services.prefs.setCharPref("mail.server.server2.hostname", "pop3.host.org");
  Services.prefs.setCharPref("mail.server.server2.type", "invalid");
  Services.prefs.setIntPref("mail.server.server2.secondsToLeaveUnavailable", 2);

  Services.prefs.setCharPref("mail.accountmanager.accounts",
                             "account1,account2");
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount", "account1");

  // This will force the load of the accounts setup above.
  // We don't see the invalid account
  do_check_eq(MailServices.accounts.accounts.length, 1);

  // but it is really there
  do_check_eq(Services.prefs.getCharPref("mail.accountmanager.accounts"),
              "account1,account2");

  // add a new account (so that we can check if this clobbers the existing
  //  inactive account or its server)
  let newAccount = MailServices.accounts.createAccount();
  let newIdentity = MailServices.accounts.createIdentity();
  newAccount.addIdentity(newIdentity);
  newAccount.defaultIdentity = newIdentity;
  newAccount.incomingServer =
    MailServices.accounts.createIncomingServer("somename", "somehost.example.com", "pop3");

  // no collisions with the inactive account
  do_check_neq(newIdentity.key, "id2");
  do_check_neq(newAccount.incomingServer.key, "server2");
  do_check_neq(newAccount.key, "account2");
  do_check_eq(MailServices.accounts.accounts.length, 2);

  MailServices.accounts.UnloadAccounts();

  // set the unavailable account to a valid type, and watch it appear.
  Services.prefs.setCharPref("mail.server.server2.type", "pop3");
  do_check_eq(MailServices.accounts.accounts.length, 3);

  // make it bad again, and reload it to restart the timeout before delete
  MailServices.accounts.UnloadAccounts();
  Services.prefs.setCharPref("mail.server.server2.type", "invalid");
  do_check_eq(MailServices.accounts.accounts.length, 2);
  MailServices.accounts.UnloadAccounts();

  // now let the bad type timeout, and watch it magically disappear!
  do_test_pending();
  do_timeout(3000, function () {
    do_check_eq(MailServices.accounts.accounts.length, 2);

    // it is now gone
    do_check_eq(Services.prefs.getCharPref("mail.accountmanager.accounts"),
                "account1," + newAccount.key);

    do_test_finished();
  });
}
