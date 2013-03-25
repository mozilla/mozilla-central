/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests that we recover from having a local folders server
 * without having an account that points at it.
 */

Components.utils.import("resource:///modules/mailServices.js");

function run_test()
{
  // Create account prefs with both kinds of duplication.

  Services.prefs.setCharPref("mail.account.account2.identities", "id2");
  Services.prefs.setCharPref("mail.account.account2.server", "server1");
  Services.prefs.setCharPref("mail.account.account6.identities", "id3");
  Services.prefs.setCharPref("mail.account.account6.server", "server5");
  Services.prefs.setCharPref("mail.server.server1.hostname",
                             "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server1.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server1.directory-rel",
                             "[ProfD]Mail/Local Folders");
  Services.prefs.setCharPref("mail.server.server5.hostname",
                             "pop3.host.org");
  Services.prefs.setCharPref("mail.server.server5.type", "pop3");
  Services.prefs.setCharPref("mail.server.server5.deferred_to_account",
                             "account2");

  Services.prefs.setCharPref("mail.accountmanager.accounts", "account6");
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount",
                             "account6");
  Services.prefs.setCharPref("mail.accountmanager.localfoldersserver",
                             "server1");
  // This will force the load of the accounts setup above.
  // We should have created an account for the local folders.
  do_check_eq(MailServices.accounts.accounts.length, 2);
  do_check_eq(Services.prefs.getCharPref("mail.accountmanager.accounts"),
              "account6,account7");
  do_check_eq(Services.prefs.getCharPref("mail.account.account7.server"),
              "server1");
  let server5 = MailServices.accounts.getIncomingServer("server5").QueryInterface(Ci.nsIPop3IncomingServer);
  do_check_eq(server5.deferredToAccount, "account7");
}
