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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

/**
 * This tests that we don't try to reset the mail.server.server<n>.authMethod
 * preference every time we run the migration code.
 */

Components.utils.import("resource:///modules/mailnewsMigrator.js");

function run_test() {
  let prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch);

  // Set up some basic accounts with limited prefs - enough to satisfy the
  // migrator.
  prefs.setCharPref("mail.account.account1.server", "server1");
  prefs.setCharPref("mail.account.account2.server", "server2");

  // Server1 has nothing set.

  // Server2 has useSecAuth set to true, auth_login unset
  prefs.setBoolPref("mail.server.server2.useSecAuth", true);

  prefs.setCharPref("mail.accountmanager.accounts",
                    "account1,account2");

  // Now migrate the prefs.
  migrateMailnews();

  // Check what has been set.
  do_check_false(prefs.prefHasUserValue("mail.server.server1.authMethod"));
  do_check_true(prefs.prefHasUserValue("mail.server.server2.authMethod"));
  do_check_eq(prefs.getIntPref("mail.server.server2.authMethod"), Ci.nsMsgAuthMethod.secure);

  // Now clear the authMethod for set for server2. This simulates the user
  // setting the value back to "3", i.e. Ci.nsMsgAuthMethod.passwordCleartext.
  prefs.clearUserPref("mail.server.server2.authMethod");

  // Now attempt migration again, e.g. a second load of TB
  migrateMailnews();

  // This time around, both of these should not be set.
  do_check_false(prefs.prefHasUserValue("mail.server.server1.authMethod"));
  do_check_false(prefs.prefHasUserValue("mail.server.server2.authMethod"));


  //
  // Now check SMTP
  //

  prefs.setCharPref("mail.smtpservers", "smtp1,smtp2");

  // smtp1 has nothing set.

  // smtp2 has useSecAuth set to true, auth_method unset
  prefs.setBoolPref("mail.smtpserver.smtp2.useSecAuth", true);

  // Now migrate the prefs
  migrateMailnews();

  do_check_false(prefs.prefHasUserValue("mail.smtpserver.smtp1.authMethod"));
  do_check_true(prefs.prefHasUserValue("mail.smtpserver.smtp2.authMethod"));
  do_check_eq(prefs.getIntPref("mail.smtpserver.smtp2.authMethod"), Ci.nsMsgAuthMethod.secure);

    // Now clear the authMethod for set for smtp2. This simulates the user
  // setting the value back to "3", i.e. Ci.nsMsgAuthMethod.passwordCleartext.
  prefs.clearUserPref("mail.smtpserver.smtp2.authMethod");

  // Now attempt migration again, e.g. a second load of TB
  migrateMailnews();

  // This time around, both of these should not be set.
  do_check_false(prefs.prefHasUserValue("mail.smtpserver.smtp1.authMethod"));
  do_check_false(prefs.prefHasUserValue("mail.smtpserver.smtp2.authMethod"));
}
