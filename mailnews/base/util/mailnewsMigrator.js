/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Migrate profile (prefs and other files) from older versions of Mailnews to
 * current.
 * This should be run at startup. It migrates as needed: each migration
 * function should be written to be a no-op when the value is already migrated
 * or was never used in the old version.
 */

var EXPORTED_SYMBOLS = [ "migrateMailnews" ];

Components.utils.import("resource:///modules/errUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");
const Ci = Components.interfaces;
const kServerPrefVersion = 1;
const kSmtpPrefVersion = 1;

function migrateMailnews()
{
  try {
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
    var accounts = Services.prefs.getCharPref("mail.accountmanager.accounts")
        .split(",");
    for (let i = 0; i < accounts.length; i++)
    {
      let accountKey = accounts[i]; // e.g. "account1"
      if (!accountKey)
        continue;
      let serverKey = Services.prefs.getCharPref("mail.account." + accountKey +
         ".server");
      let server = "mail.server." + serverKey + ".";
      if (Services.prefs.prefHasUserValue(server + "authMethod"))
        continue;
      if (!Services.prefs.prefHasUserValue(server + "useSecAuth") &&
          !Services.prefs.prefHasUserValue(server + "auth_login"))
        continue;
      if (Services.prefs.prefHasUserValue(server + "migrated"))
        continue;
      // auth_login = false => old-style auth
      // else: useSecAuth = true => "secure auth"
      // else: cleartext pw
      let auth_login = true;
      let useSecAuth = false; // old default, default pref now removed
      try {
        auth_login = Services.prefs.getBoolPref(server + "auth_login");
      } catch (e) {}
      try {
        useSecAuth = Services.prefs.getBoolPref(server + "useSecAuth");
      } catch (e) {}

      Services.prefs.setIntPref(server + "authMethod",
          auth_login ? (useSecAuth ?
                           Ci.nsMsgAuthMethod.secure :
                           Ci.nsMsgAuthMethod.passwordCleartext) :
                       Ci.nsMsgAuthMethod.old);
      Services.prefs.setIntPref(server + "migrated", kServerPrefVersion);
    }

    // same again for SMTP servers
    var smtpservers = Services.prefs.getCharPref("mail.smtpservers").split(",");
    for (let i = 0; i < smtpservers.length; i++)
    {
      if (!smtpservers[i])
        continue;
      let server = "mail.smtpserver." + smtpservers[i] + ".";
      if (Services.prefs.prefHasUserValue(server + "authMethod"))
        continue;
      if (!Services.prefs.prefHasUserValue(server + "useSecAuth") &&
          !Services.prefs.prefHasUserValue(server + "auth_method"))
        continue;
      if (Services.prefs.prefHasUserValue(server + "migrated"))
        continue;
      // auth_method = 0 => no auth
      // else: useSecAuth = true => "secure auth"
      // else: cleartext pw
      let auth_method = 1;
      let useSecAuth = false;
      try {
        auth_method = Services.prefs.getIntPref(server + "auth_method");
      } catch (e) {}
      try {
        useSecAuth = Services.prefs.getBoolPref(server + "useSecAuth");
      } catch (e) {}

      Services.prefs.setIntPref(server + "authMethod",
          auth_method ? (useSecAuth ?
                            Ci.nsMsgAuthMethod.secure :
                            Ci.nsMsgAuthMethod.passwordCleartext) :
                        Ci.nsMsgAuthMethod.none);
      Services.prefs.setIntPref(server + "migrated", kSmtpPrefVersion);
    }
  } catch(e) { logException(e); }
}
