/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This tests that we don't try to reset the mail.server.server<n>.authMethod
 * preference every time we run the migration code.
 */

Components.utils.import("resource:///modules/mailnewsMigrator.js");

function run_test() {
  // Set up some basic accounts with limited prefs - enough to satisfy the
  // migrator.
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");

  // Server1 has nothing set.

  // Server2 has useSecAuth set to true, auth_login unset
  Services.prefs.setBoolPref("mail.server.server2.useSecAuth", true);

  Services.prefs.setCharPref("mail.accountmanager.accounts",
                             "account1,account2");

  // Now migrate the prefs.
  migrateMailnews();

  // Check what has been set.
  do_check_false(Services.prefs.prefHasUserValue("mail.server.server1.authMethod"));
  do_check_true(Services.prefs.prefHasUserValue("mail.server.server2.authMethod"));
  do_check_eq(Services.prefs.getIntPref("mail.server.server2.authMethod"),
              Ci.nsMsgAuthMethod.secure);

  // Now clear the authMethod for set for server2. This simulates the user
  // setting the value back to "3", i.e. Ci.nsMsgAuthMethod.passwordCleartext.
  Services.prefs.clearUserPref("mail.server.server2.authMethod");

  // Now attempt migration again, e.g. a second load of TB
  migrateMailnews();

  // This time around, both of these should not be set.
  do_check_false(Services.prefs.prefHasUserValue("mail.server.server1.authMethod"));
  do_check_false(Services.prefs.prefHasUserValue("mail.server.server2.authMethod"));


  //
  // Now check SMTP
  //

  Services.prefs.setCharPref("mail.smtpservers", "smtp1,smtp2");

  // smtp1 has nothing set.

  // smtp2 has useSecAuth set to true, auth_method unset
  Services.prefs.setBoolPref("mail.smtpserver.smtp2.useSecAuth", true);

  // Now migrate the prefs
  migrateMailnews();

  do_check_false(Services.prefs.prefHasUserValue("mail.smtpserver.smtp1.authMethod"));
  do_check_true(Services.prefs.prefHasUserValue("mail.smtpserver.smtp2.authMethod"));
  do_check_eq(Services.prefs.getIntPref("mail.smtpserver.smtp2.authMethod"),
              Ci.nsMsgAuthMethod.secure);

    // Now clear the authMethod for set for smtp2. This simulates the user
  // setting the value back to "3", i.e. Ci.nsMsgAuthMethod.passwordCleartext.
  Services.prefs.clearUserPref("mail.smtpserver.smtp2.authMethod");

  // Now attempt migration again, e.g. a second load of TB
  migrateMailnews();

  // This time around, both of these should not be set.
  do_check_false(Services.prefs.prefHasUserValue("mail.smtpserver.smtp1.authMethod"));
  do_check_false(Services.prefs.prefHasUserValue("mail.smtpserver.smtp2.authMethod"));
}
