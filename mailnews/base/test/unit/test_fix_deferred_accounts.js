/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests that we cleanup the account prefs when a pop3 account has
 * been deferred to a hidden account.
 */
Components.utils.import("resource:///modules/mailServices.js");

function run_test()
{
  // Create account prefs with a pop3 account deferred to a hidden account.

  Services.prefs.setCharPref("mail.account.account1.identities", "id1");
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");
  Services.prefs.setCharPref("mail.account.account4.identities", "id2");
  Services.prefs.setCharPref("mail.account.account4.server", "server4");
  Services.prefs.setCharPref("mail.account.account5.identities", "id3");
  Services.prefs.setCharPref("mail.account.account5.server", "server5");
  Services.prefs.setCharPref("mail.server.server1.hostname",
                             "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server2.hostname",
                             "Smart Mailboxes");
  Services.prefs.setCharPref("mail.server.server2.type", "none");
  Services.prefs.setBoolPref("mail.server.server2.hidden", true);
  Services.prefs.setCharPref("mail.server.server4.hostname",
                             "mail.host4.org");
  Services.prefs.setCharPref("mail.server.server4.type", "pop3");
  Services.prefs.setCharPref("mail.server.server4.deferred_to_account",
                             "account2");
  Services.prefs.setCharPref("mail.server.server5.hostname",
                             "mail.host5.org");
  Services.prefs.setCharPref("mail.server.server5.type", "pop3");
  Services.prefs.setCharPref("mail.server.server5.deferred_to_account",
                             "account2");

  Services.prefs.setCharPref("mail.accountmanager.accounts",
                             "account1,account2,account4,account5");
  // Set the default account to one we're going to get rid of. The account manager
  // should recover relatively gracefully.
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount",
                             "account1");

  // This will force the load of the accounts setup above.
  do_check_eq(MailServices.accounts.accounts.length, 3); // hidden account not included
  let server4 = MailServices.accounts.getAccount("account4").incomingServer
                            .QueryInterface(Ci.nsIPop3IncomingServer);
  do_check_eq(server4.deferredToAccount, "account1");
  let server5 = MailServices.accounts.getAccount("account5").incomingServer
                            .QueryInterface(Ci.nsIPop3IncomingServer);
  do_check_eq(server5.deferredToAccount, "account1");
}
