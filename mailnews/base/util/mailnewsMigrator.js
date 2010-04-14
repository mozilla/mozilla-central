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
 * The Original Code is autoconfig code.
 *
 * The Initial Developer of the Original Code is
 *   Ben Bucksch.
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
 * Migrate profile (prefs and other files) from older versions of Mailnews to
 * current.
 * This should be run at startup. It migrates as needed: each migration
 * function should be written to be a no-op when the value is already migrated
 * or was never used in the old version.
 */

var EXPORTED_SYMBOLS = [ "migrateMailnews" ];

Components.utils.import("resource:///modules/errUtils.js");
//Components.utils.import("resource:///modules/Services.js");
const Ci = Components.interfaces;
var gPrefs;

function migrateMailnews()
{
  try {
    //gPrefs = Services.prefs; -- Gecko 1.9.3+
    gPrefs = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranch);

    MigrateServerAuthPref();
  } catch (e) { logException(e); }
}

/**
 * Migrates from pref useSecAuth to pref authMethod
 */
function MigrateServerAuthPref()
{
  try {
    // comma-separated list of all accounts.
    var accounts = gPrefs.getCharPref("mail.accountmanager.accounts")
        .split(",");
    for (let i = 0; i < accounts.length; i++)
    {
      let accountKey = accounts[i]; // e.g. "account1"
      if (!accountKey)
        continue;
      let serverKey = gPrefs.getCharPref("mail.account." + accountKey +
         ".server");
      let server = "mail.server." + serverKey + ".";
      if (gPrefs.prefHasUserValue(server + "authMethod"))
        continue;
      if (!gPrefs.prefHasUserValue(server + "useSecAuth") &&
          !gPrefs.prefHasUserValue(server + "auth_login"))
        continue;
      // auth_login = false => old-style auth
      // else: useSecAuth = true => "secure auth"
      // else: cleartext pw
      let auth_login = true;
      let useSecAuth = false; // old default, default pref now removed
      try {
        auth_login = gPrefs.getBoolPref(server + "auth_login");
      } catch (e) {}
      try {
        useSecAuth = gPrefs.getBoolPref(server + "useSecAuth");
      } catch (e) {}

      gPrefs.setIntPref(server + "authMethod",
          auth_login ? (useSecAuth ?
                           Ci.nsMsgAuthMethod.secure :
                           Ci.nsMsgAuthMethod.passwordCleartext) :
                       Ci.nsMsgAuthMethod.old);
    }

    // same again for SMTP servers
    var smtpservers = gPrefs.getCharPref("mail.smtpservers").split(",");
    for (let i = 0; i < smtpservers.length; i++)
    {
      if (!smtpservers[i])
        continue;
      let server = "mail.smtpserver." + smtpservers[i] + ".";
      if (gPrefs.prefHasUserValue(server + "authMethod"))
        continue;
      if (!gPrefs.prefHasUserValue(server + "useSecAuth") &&
          !gPrefs.prefHasUserValue(server + "auth_method"))
        continue;
      // auth_method = 0 => no auth
      // else: useSecAuth = true => "secure auth"
      // else: cleartext pw
      let auth_method = 1;
      let useSecAuth = false;
      try {
        auth_method = gPrefs.getIntPref(server + "auth_method");
      } catch (e) {}
      try {
        useSecAuth = gPrefs.getBoolPref(server + "useSecAuth");
      } catch (e) {}

      gPrefs.setIntPref(server + "authMethod",
          auth_method ? (useSecAuth ?
                            Ci.nsMsgAuthMethod.secure :
                            Ci.nsMsgAuthMethod.passwordCleartext) :
                        Ci.nsMsgAuthMethod.none);
    }
  } catch(e) { logException(e); }
}
