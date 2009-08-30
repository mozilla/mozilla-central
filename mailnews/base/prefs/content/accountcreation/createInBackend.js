/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Ben Bucksch <ben.bucksch beonex.com>
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@davidbienvenu.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 * Takes an AccountConfig JS object and creates that account in the
 * Thunderbird backend (which also writes it to prefs).
 *
 * @param config {AccountConfig} The account to create
 *
 * @ret - the account created.
 */
function createAccountInBackend(config)
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                       .getService(Ci.nsIMsgAccountManager);
  var smtpManager = Cc["@mozilla.org/messengercompose/smtp;1"]
                    .getService(Ci.nsISmtpService);

  // incoming server
  var inServer = accountManager.createIncomingServer(
      config.incoming.username,
      config.incoming.hostname,
      sanitize.enum(config.incoming.type, ["pop3", "imap", "nntp"]));
  inServer.port = config.incoming.port;
  if (config.rememberPassword && config.incoming.password.length)
    rememberPassword(inServer, config.incoming.password);

  // SSL
  if (config.incoming.socketType == 1) // plain
    inServer.socketType = Ci.nsIMsgIncomingServer.defaultSocket;
  else if (config.incoming.socketType == 2) // SSL / TLS
    inServer.socketType = Ci.nsIMsgIncomingServer.useSSL;
  else if (config.incoming.socketType == 3) // STARTTLS
    inServer.socketType = Ci.nsIMsgIncomingServer.alwaysUseTLS;
  // auth
  if (config.incoming.auth == 2) // "secure" auth
    inServer.useSecAuth = true;
  //inServer.prettyName = config.displayName;
  inServer.prettyName = config.identity.emailAddress;

  inServer.doBiff = true;
  inServer.biffMinutes = config.incoming.checkInterval;
  let prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefBranch);
  const loginAtStartupPrefTemplate =
    "mail.server.%serverkey%.login_at_startup";
  var loginAtStartupPref =
    loginAtStartupPrefTemplate.replace("%serverkey%", inServer.key);
  prefs.setBoolPref(loginAtStartupPref,
                    config.incoming.loginAtStartup);
  if (config.incoming.type == "pop3")
  {
    const leaveOnServerPrefTemplate =
      "mail.server.%serverkey%.leave_on_server";
    const daysToLeaveOnServerPrefTemplate =
      "mail.server.%serverkey%.num_days_to_leave_on_server";
    const deleteFromServerPrefTemplate =
      "mail.server.%serverkey%.delete_mail_left_on_server";
    const deleteByAgeFromServerPrefTemplate =
      "mail.server.%serverkey%.delete_by_age_from_server";
    var leaveOnServerPref =
      leaveOnServerPrefTemplate.replace("%serverkey%", inServer.key);
    var ageFromServerPref =
      deleteByAgeFromServerPrefTemplate.replace("%serverkey%", inServer.key);
    var daysToLeaveOnServerPref =
      daysToLeaveOnServerPrefTemplate.replace("%serverkey%", inServer.key);
    var deleteFromServerPref =
      deleteFromServerPrefTemplate.replace("%serverkey%", inServer.key);
    prefs.setBoolPref(leaveOnServerPref,
                      config.incoming.leaveMessagesOnServer);
    prefs.setIntPref(daysToLeaveOnServerPref,
                     config.incoming.daysToLeaveMessagesOnServer);
    prefs.setBoolPref(deleteFromServerPref,
                      config.incoming.deleteOnServerWhenLocalDelete);
    prefs.setBoolPref(ageFromServerPref,
                      config.incoming.deleteByAgeFromServer);
  }
  inServer.valid = true;

  // outgoing server
  var outServer = null;
  assert(config.outgoing.addThisServer ||
         config.outgoing.useGlobalPreferredServer ||
         config.outgoing.existingServerKey,
         "No SMTP server: inconsistent flags");
  if (config.outgoing.addThisServer &&
      !smtpManager.findServer(config.outgoing.username,
                              config.outgoing.hostname))
  {
    var outServer = smtpManager.createSmtpServer();
    outServer.hostname = config.outgoing.hostname;
    outServer.port = config.outgoing.port;
    if (config.outgoing.auth > 0)
    {
      outServer.authMethod = 1;
      outServer.useSecAuth = config.outgoing.auth == 2;
      outServer.username = config.incoming.username;
      outServer.password = config.incoming.password;
      if (config.rememberPassword && config.incoming.password.length)
        rememberPassword(outServer, config.incoming.password);
    }
    else
      outServer.authMethod = 0;

    if (config.outgoing.socketType == 1) // no SSL
      outServer.trySSL = 0; // nsSmtpProtocol.h, line 115
    else if (config.outgoing.socketType == 2) // SSL / TLS
      outServer.trySSL = 3;
    else if (config.outgoing.socketType == 3) // STARTTLS
      outServer.trySSL = 2;

    // API problem: <http://mxr.mozilla.org/seamonkey/source/mailnews/compose/public/nsISmtpServer.idl#93>
    outServer.description = config.displayName;
    if (config.password)
      outServer.password = config.outgoing.password;

    // If this is the first SMTP server, set it as default
    if (!smtpManager.defaultServer ||
        !smtpManager.defaultServer.hostname)
      smtpManager.defaultServer = outServer;
  }

  // identity
  // TODO accounts without identity?
  var identity = accountManager.createIdentity();
  identity.identityName = config.identity.emailAddress;
  identity.fullName = config.identity.realname;
  identity.email = config.identity.emailAddress;
  if (config.incoming.type == "nntp")
    identity.composeHtml = false;

  identity.valid = true;

  // account and hook up
  var account = accountManager.createAccount();
  account.incomingServer = inServer;
  account.addIdentity(identity);
  if (!accountManager.defaultAccount)
    accountManager.defaultAccount = account;

  if (config.outgoing.existingServerKey)
    identity.smtpServerKey = config.outgoing.existingServerKey;
  else if (!config.outgoing.useGlobalPreferredServer)
    identity.smtpServerKey = outServer.key;

  setFolders(identity, inServer);

  // save
  accountManager.saveAccountInfo();
  try {
    Cc["@mozilla.org/preferences-service;1"]
    .getService(Ci.nsIPrefService)
    .savePrefFile(null);
  } catch (ex) {
    ddump("Could not write out prefs: " + ex);
  }
  return account;
}

function setFolders(identity, server)
{
  // TODO: support for local folders for global inbox (or use smart search folder instead)

  var baseURI = server.serverURI + "/";

  // Names will be localized in UI, not in folder names on server/disk
  // TODO allow to override these names in the XML config file,
  // in case e.g. Google or AOL use different names?
  // Workaround: Let user fix it :)
  var fccName = "Sent";
  var draftName = "Drafts";
  var templatesName = "Templates";

  identity.draftFolder = baseURI + draftName;
  identity.stationeryFolder = baseURI + templatesName;
  identity.fccFolder = baseURI + fccName;

  identity.fccFolderPickerMode = 0;
  identity.draftsFolderPickerMode = 0;
  identity.tmplFolderPickerMode = 0;
}

function rememberPassword(server, password)
{
  if (server instanceof Components.interfaces.nsIMsgIncomingServer)
    var passwordURI = server.localStoreType + "://" + server.hostName;
  else if (server instanceof Components.interfaces.nsISmtpServer)
    var passwordURI = "smtp://" + server.hostname;
  else
    throw new NotReached("Server type not supported");

  let lm = Cc["@mozilla.org/login-manager;1"]
           .getService(Ci.nsILoginManager);
  let login = Cc["@mozilla.org/login-manager/loginInfo;1"]
              .createInstance(Ci.nsILoginInfo);
  login.init(passwordURI, null, passwordURI, server.username, password, "", "");
  try {
    lm.addLogin(login);
  } catch (e if e.message.indexOf("This login already exists") != -1) {
    // TODO modify
  }
}
