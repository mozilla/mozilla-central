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
 * David Bienvenu <bienvenu@mozillamessaging.com>.
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

/**
 * This tests that we cleanup the account prefs when the account manager is
 * loaded. This entails removing duplicate accounts from
 * mail.accountmanager.accounts list, and removing duplicate accounts with
 * the same server.
 */
const am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                     .getService(Components.interfaces.nsIMsgAccountManager);

const prefs = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefBranch);

function run_test()
{
  // Create account prefs with both kinds of duplication.

  prefs.setCharPref("mail.account.account1.identities", "id1");
  prefs.setCharPref("mail.account.account1.server", "server1");
  prefs.setCharPref("mail.account.account2.identities", "id2");
  prefs.setCharPref("mail.account.account2.server", "server2");
  prefs.setCharPref("mail.account.account4.identities", "id2");
  prefs.setCharPref("mail.account.account4.server", "server4");
  prefs.setCharPref("mail.account.account5.identities", "id3");
  prefs.setCharPref("mail.account.account5.server", "server5");
  prefs.setCharPref("mail.account.account6.identities", "id3");
  prefs.setCharPref("mail.account.account6.server", "server5");
  prefs.setCharPref("mail.server.server1.hostname", "Local Folders");
  prefs.setCharPref("mail.server.server1.type", "none");
  prefs.setCharPref("mail.server.server1.userName", "nobody");
  prefs.setCharPref("mail.server.server1.directory-rel",
                    "[ProfD]Mail/Local Folders");
  prefs.setCharPref("mail.server.server2.hostname", "Local Folders");
  prefs.setCharPref("mail.server.server2.type", "none");
  prefs.setCharPref("mail.server.server2.userName", "nobody");
  prefs.setCharPref("mail.server.server2.directory-rel",
                    "[ProfD]Mail/Local Folders-1");
  prefs.setCharPref("mail.server.server4.hostname", "mail.host4.org");
  prefs.setCharPref("mail.server.server4.type", "pop3");
  prefs.setCharPref("mail.server.server5.hostname", "pop3.host.org");
  prefs.setCharPref("mail.server.server5.type", "pop3");
  prefs.setCharPref("mail.server.server5.deferred_to_account", "account2");

  prefs.setCharPref("mail.accountmanager.accounts",
                    "account1,account2,account4,account5,account5,account6");
  // Set the default account to one we're going to get rid of. The account
  //  manager should recover relatively gracefully.
  prefs.setCharPref("mail.accountmanager.defaultaccount", "account6");

  // This will force the load of the accounts setup above.
  do_check_eq(am.accounts.Count(), 3);
  do_check_eq(prefs.getCharPref("mail.accountmanager.accounts"),
              "account1,account4,account5");
  let server5 = am.getIncomingServer("server5")
                  .QueryInterface(Ci.nsIPop3IncomingServer);
  do_check_eq(server5.deferredToAccount, "account1");

  // Just make sure this doesn't throw an exception, because we did remove the
  // default account.
  let defaultAccount = am.defaultAccount;
  // GetDefaultAccount should have thrown an exception for null account.
  do_check_neq(defaultAccount, null);

  // Remove an account, and verify that the account list pref looks OK:
  let server = am.getIncomingServer("server4");

  // We need to get the root folder to read from the folder cache
  // before it gets removed or else we'll assert, because we're
  // not completely initialized...
  let flags = server.rootFolder.flags;

  am.removeAccount(am.FindAccountForServer(server));
  do_check_eq(am.accounts.Count(), 2);
  do_check_eq(prefs.getCharPref("mail.accountmanager.accounts"),
              "account1,account5");
}
