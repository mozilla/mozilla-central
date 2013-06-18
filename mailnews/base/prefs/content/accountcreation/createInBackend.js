/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Takes an |AccountConfig| JS object and creates that account in the
 * Thunderbird backend (which also writes it to prefs).
 *
 * @param config {AccountConfig} The account to create
 *
 * @return - the account created.
 */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

function createAccountInBackend(config)
{
  // incoming server
  let inServer = MailServices.accounts.createIncomingServer(
      config.incoming.username,
      config.incoming.hostname,
      sanitize.enum(config.incoming.type, ["pop3", "imap", "nntp"]));
  inServer.port = config.incoming.port;
  inServer.authMethod = config.incoming.auth;
  inServer.password = config.incoming.password;
  if (config.rememberPassword && config.incoming.password.length)
    rememberPassword(inServer, config.incoming.password);

  // SSL
  if (config.incoming.socketType == 1) // plain
    inServer.socketType = Ci.nsMsgSocketType.plain;
  else if (config.incoming.socketType == 2) // SSL / TLS
    inServer.socketType = Ci.nsMsgSocketType.SSL;
  else if (config.incoming.socketType == 3) // STARTTLS
    inServer.socketType = Ci.nsMsgSocketType.alwaysSTARTTLS;
  //inServer.prettyName = config.displayName;
  inServer.prettyName = config.identity.emailAddress;

  inServer.doBiff = true;
  inServer.biffMinutes = config.incoming.checkInterval;
  const loginAtStartupPrefTemplate =
    "mail.server.%serverkey%.login_at_startup";
  var loginAtStartupPref =
    loginAtStartupPrefTemplate.replace("%serverkey%", inServer.key);
  Services.prefs.setBoolPref(loginAtStartupPref,
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
    const downloadOnBiffPrefTemplate =
      "mail.server.%serverkey%.download_on_biff";
    var leaveOnServerPref =
      leaveOnServerPrefTemplate.replace("%serverkey%", inServer.key);
    var ageFromServerPref =
      deleteByAgeFromServerPrefTemplate.replace("%serverkey%", inServer.key);
    var daysToLeaveOnServerPref =
      daysToLeaveOnServerPrefTemplate.replace("%serverkey%", inServer.key);
    var deleteFromServerPref =
      deleteFromServerPrefTemplate.replace("%serverkey%", inServer.key);
    let downloadOnBiffPref =
      downloadOnBiffPrefTemplate.replace("%serverkey%", inServer.key);
    Services.prefs.setBoolPref(leaveOnServerPref,
                               config.incoming.leaveMessagesOnServer);
    Services.prefs.setIntPref(daysToLeaveOnServerPref,
                              config.incoming.daysToLeaveMessagesOnServer);
    Services.prefs.setBoolPref(deleteFromServerPref,
                               config.incoming.deleteOnServerWhenLocalDelete);
    Services.prefs.setBoolPref(ageFromServerPref,
                               config.incoming.deleteByAgeFromServer);
    Services.prefs.setBoolPref(downloadOnBiffPref,
                               config.incoming.downloadOnBiff);
  }
  inServer.valid = true;

  let username = config.outgoing.auth > 1 ? config.outgoing.username : null;
  let outServer = MailServices.smtp.findServer(username, config.outgoing.hostname);
  assert(config.outgoing.addThisServer ||
         config.outgoing.useGlobalPreferredServer ||
         config.outgoing.existingServerKey,
         "No SMTP server: inconsistent flags");

  if (config.outgoing.addThisServer && !outServer)
  {
    outServer = MailServices.smtp.createServer();
    outServer.hostname = config.outgoing.hostname;
    outServer.port = config.outgoing.port;
    outServer.authMethod = config.outgoing.auth;
    if (config.outgoing.auth > 1)
    {
      outServer.username = username;
      outServer.password = config.incoming.password;
      if (config.rememberPassword && config.incoming.password.length)
        rememberPassword(outServer, config.incoming.password);
    }

    if (config.outgoing.socketType == 1) // no SSL
      outServer.socketType = Ci.nsMsgSocketType.plain;
    else if (config.outgoing.socketType == 2) // SSL / TLS
      outServer.socketType = Ci.nsMsgSocketType.SSL;
    else if (config.outgoing.socketType == 3) // STARTTLS
      outServer.socketType = Ci.nsMsgSocketType.alwaysSTARTTLS;

    // API problem: <http://mxr.mozilla.org/seamonkey/source/mailnews/compose/public/nsISmtpServer.idl#93>
    outServer.description = config.displayName;
    if (config.password)
      outServer.password = config.outgoing.password;

    // If this is the first SMTP server, set it as default
    if (!MailServices.smtp.defaultServer ||
        !MailServices.smtp.defaultServer.hostname)
      MailServices.smtp.defaultServer = outServer;
  }

  // identity
  // TODO accounts without identity?
  let identity = MailServices.accounts.createIdentity();
  identity.fullName = config.identity.realname;
  identity.email = config.identity.emailAddress;

  // for new accounts, default to replies being positioned above the quote
  // if a default account is defined already, take its settings instead
  if (config.incoming.type == "imap" || config.incoming.type == "pop3")
  {
    identity.replyOnTop = 1;
    // identity.sigBottom = false; // don't set this until Bug 218346 is fixed

    if (MailServices.accounts.accounts.length &&
        MailServices.accounts.defaultAccount)
    {
      let defAccount = MailServices.accounts.defaultAccount;
      let defIdentity = defAccount.defaultIdentity;
      if (defAccount.incomingServer.canBeDefaultServer &&
          defIdentity && defIdentity.valid)
      {
        identity.replyOnTop = defIdentity.replyOnTop;
        identity.sigBottom = defIdentity.sigBottom;
      }
    }
  }

  // due to accepted conventions, news accounts should default to plain text
  if (config.incoming.type == "nntp")
    identity.composeHtml = false;

  identity.valid = true;

  if (config.outgoing.existingServerKey)
    identity.smtpServerKey = config.outgoing.existingServerKey;
  else if (!config.outgoing.useGlobalPreferredServer)
    identity.smtpServerKey = outServer.key;

  // account and hook up
  // Note: Setting incomingServer will cause the AccountManager to refresh
  // itself, which could be a problem if we came from it and we haven't set
  // the identity (see bug 521955), so make sure everything else on the
  // account is set up before you set the incomingServer.
  let account = MailServices.accounts.createAccount();
  account.addIdentity(identity);
  account.incomingServer = inServer;
  if (!MailServices.accounts.defaultAccount)
    MailServices.accounts.defaultAccount = account;

  verifyLocalFoldersAccount(MailServices.accounts);
  setFolders(identity, inServer);

  // save
  MailServices.accounts.saveAccountInfo();
  try {
    Services.prefs.savePrefFile(null);
  } catch (ex) {
    ddump("Could not write out prefs: " + ex);
  }
  return account;
}

function setFolders(identity, server)
{
  // TODO: support for local folders for global inbox (or use smart search
  // folder instead)

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

  let login = Cc["@mozilla.org/login-manager/loginInfo;1"]
              .createInstance(Ci.nsILoginInfo);
  login.init(passwordURI, null, passwordURI, server.username, password, "", "");
  try {
    Services.logins.addLogin(login);
  } catch (e if e.message.contains("This login already exists")) {
    // TODO modify
  }
}

/**
 * Check whether the user's setup already has an incoming server
 * which matches (hostname, port, username) the primary one
 * in the config.
 * (We also check the email address as username.)
 *
 * @param config {AccountConfig} filled in (no placeholders)
 * @return {nsIMsgIncomingServer} If it already exists, the server
 *     object is returned.
 *     If it's a new server, |null| is returned.
 */
function checkIncomingServerAlreadyExists(config)
{
  assert(config instanceof AccountConfig);
  let incoming = config.incoming;
  let existing = MailServices.accounts.findRealServer(incoming.username,
        incoming.hostname,
        sanitize.enum(incoming.type, ["pop3", "imap", "nntp"]),
        incoming.port);

  // if username does not have an '@', also check the e-mail
  // address form of the name.
  if (!existing && !incoming.username.contains("@"))
    existing = MailServices.accounts.findRealServer(config.identity.emailAddress,
          incoming.hostname,
          sanitize.enum(incoming.type, ["pop3", "imap", "nntp"]),
          incoming.port);
  return existing;
};

/**
 * Check whether the user's setup already has an outgoing server
 * which matches (hostname, port, username) the primary one
 * in the config.
 *
 * @param config {AccountConfig} filled in (no placeholders)
 * @return {nsISmtpServer} If it already exists, the server
 *     object is returned.
 *     If it's a new server, |null| is returned.
 */
function checkOutgoingServerAlreadyExists(config)
{
  assert(config instanceof AccountConfig);
  let smtpServers = MailServices.smtp.servers;
  while (smtpServers.hasMoreElements())
  {
    let existingServer = smtpServers.getNext()
        .QueryInterface(Ci.nsISmtpServer);
    // TODO check username with full email address, too, like for incoming
    if (existingServer.hostname == config.outgoing.hostname &&
        existingServer.port == config.outgoing.port &&
        existingServer.username == config.outgoing.username)
      return existingServer;
  }
  return null;
};

/**
 * Check if there already is a "Local Folders". If not, create it.
 * Copied from AccountWizard.js with minor updates.
 */
function verifyLocalFoldersAccount(am) 
{
  let localMailServer;
  try {
    localMailServer = am.localFoldersServer;
  }
  catch (ex) {
    localMailServer = null;
  }

  try {
    if (!localMailServer) 
    {
      // creates a copy of the identity you pass in
      am.createLocalMailAccount();
      try {
        localMailServer = am.localFoldersServer;
      }
      catch (ex) {
        ddump("Error! we should have found the local mail server " +
              "after we created it.");
      }
    }
  }
  catch (ex) { ddump("Error in verifyLocalFoldersAccount " + ex); }
}
