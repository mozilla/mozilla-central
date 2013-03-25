/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests that we cleanup the account prefs when the account manager is
 * loaded. This entails removing duplicate accounts from
 * mail.accountmanager.accounts list, and removing duplicate accounts with
 * the same server.
 */
Components.utils.import("resource:///modules/mailServices.js");

function run_test()
{
  // Create account prefs with both kinds of duplication.

  Services.prefs.setCharPref("mail.account.account1.identities", "id1");
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.identities", "id2");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");
  Services.prefs.setCharPref("mail.account.account4.identities", "id2");
  Services.prefs.setCharPref("mail.account.account4.server", "server4");
  Services.prefs.setCharPref("mail.account.account5.identities", "id3");
  Services.prefs.setCharPref("mail.account.account5.server", "server5");
  Services.prefs.setCharPref("mail.account.account6.identities", "id3");
  Services.prefs.setCharPref("mail.account.account6.server", "server5");
  Services.prefs.setCharPref("mail.server.server1.hostname",
                             "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server1.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server1.directory-rel",
                             "[ProfD]Mail/Local Folders");
  Services.prefs.setCharPref("mail.server.server2.hostname",
                             "Local Folders");
  Services.prefs.setCharPref("mail.server.server2.type", "none");
  Services.prefs.setCharPref("mail.server.server2.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server2.directory-rel",
                             "[ProfD]Mail/Local Folders-1");
  Services.prefs.setCharPref("mail.server.server4.hostname",
                             "mail.host4.org");
  Services.prefs.setCharPref("mail.server.server4.type", "pop3");
  Services.prefs.setCharPref("mail.server.server5.hostname",
                             "pop3.host.org");
  Services.prefs.setCharPref("mail.server.server5.type", "pop3");
  Services.prefs.setCharPref("mail.server.server5.deferred_to_account",
                             "account2");

  Services.prefs.setCharPref("mail.accountmanager.accounts",
                             "account1,account2,account4,account5,account5,account6");
  // Set the default account to one we're going to get rid of. The account
  //  manager should recover relatively gracefully.
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount",
                             "account6");

  // This will force the load of the accounts setup above.
  do_check_eq(MailServices.accounts.accounts.length, 3);
  do_check_eq(Services.prefs.getCharPref("mail.accountmanager.accounts"),
              "account1,account4,account5");
  let server5 = MailServices.accounts.getIncomingServer("server5")
                  .QueryInterface(Ci.nsIPop3IncomingServer);
  do_check_eq(server5.deferredToAccount, "account1");

  // Just make sure this doesn't throw an exception, because we did remove the
  // default account.
  let defaultAccount = MailServices.accounts.defaultAccount;
  // GetDefaultAccount should have thrown an exception for null account.
  do_check_neq(defaultAccount, null);

  // Remove an account, and verify that the account list pref looks OK:
  let server = MailServices.accounts.getIncomingServer("server4");

  // We need to get the root folder to read from the folder cache
  // before it gets removed or else we'll assert, because we're
  // not completely initialized...
  let flags = server.rootFolder.flags;

  MailServices.accounts.removeAccount(MailServices.accounts.FindAccountForServer(server));
  do_check_eq(MailServices.accounts.accounts.length, 2);
  do_check_eq(Services.prefs.getCharPref("mail.accountmanager.accounts"),
              "account1,account5");
  // make sure cleaning up duplicate accounts didn't hork accounts
  do_check_eq(Services.prefs.getCharPref("mail.account.account1.server"),
              "server1");
  do_check_eq(Services.prefs.getCharPref("mail.account.account5.server"),
              "server5");
}
