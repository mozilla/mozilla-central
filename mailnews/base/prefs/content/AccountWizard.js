/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* the okCallback is used for sending a callback for the parent window */
var okCallback = null;
/* The account wizard creates new accounts */

/*
  data flow into the account wizard like this:

  For new accounts:
  * pageData -> Array -> createAccount -> finishAccount
  
  For accounts coming from the ISP setup:
  * RDF  -> Array -> pageData -> Array -> createAccount -> finishAccount
  
  for "unfinished accounts" 
  * account -> Array -> pageData -> Array -> finishAccount
  
  Where:
  pageData - the actual pages coming out of the Widget State Manager
  RDF      - the ISP datasource
  Array    - associative array of attributes, that very closely
             resembles the nsIMsgAccount/nsIMsgIncomingServer/nsIMsgIdentity
             structure
  createAccount() - creates an account from the above Array
  finishAccount() - fills an existing account with data from the above Array 

*/

/* 
   the account wizard path is something like:
   
   accounttype -> identity -> server -> login -> accname -> done
                             \-> newsserver ----/

   where the accounttype determines which path to take
   (server vs. newsserver)
*/

Components.utils.import("resource:///modules/mailServices.js");

var contentWindow;

var gPageData;

var nsIMsgIdentity = Components.interfaces.nsIMsgIdentity;
var nsIMsgIncomingServer = Components.interfaces.nsIMsgIncomingServer;
var gPrefsBundle, gMessengerBundle;

// the current nsIMsgAccount
var gCurrentAccount;

// default account
var gDefaultAccount;

// the current associative array that
// will eventually be dumped into the account
var gCurrentAccountData;

// default picker mode for copies and folders
const gDefaultSpecialFolderPickerMode = "0";

// event handlers
function onAccountWizardLoad() {
  gPrefsBundle = document.getElementById("bundle_prefs");
  gMessengerBundle = document.getElementById("bundle_messenger");

  if ("testingIspServices" in this) {
    if ("SetCustomizedWizardDimensions" in this && testingIspServices()) {
      SetCustomizedWizardDimensions();
    }
  }

  /* We are checking here for the callback argument */
  if (window.arguments && window.arguments[0]) {
    if(window.arguments[0].okCallback ) 
    {
      //dump("There is okCallback");
      top.okCallback = window.arguments[0].okCallback;
    }
  }

  checkForInvalidAccounts();

  try {
    gDefaultAccount = MailServices.accounts.defaultAccount;
  }
  catch (ex) {
    // no default account, this is expected the first time you launch mail
    // on a new profile
    gDefaultAccount = null;
  }

  // Set default value for global inbox checkbox
  var checkGlobalInbox = document.getElementById("deferStorage");
  try {
    checkGlobalInbox.checked = Services.prefs.getBoolPref("mail.accountwizard.deferstorage");
  } catch(e) {}
}

function onCancel() 
{
  if ("ActivationOnCancel" in this && ActivationOnCancel())
    return false;
  var firstInvalidAccount = getFirstInvalidAccount();
  var closeWizard = true;

  // if the user cancels the the wizard when it pops up because of 
  // an invalid account (example, a webmail account that activation started)
  // we just force create it by setting some values and calling the FinishAccount()
  // see bug #47521 for the full discussion
  if (firstInvalidAccount) {
    var pageData = GetPageData();
    // set the fullName if it doesn't exist
    if (!pageData.identity.fullName || !pageData.identity.fullName.value) {
      setPageData(pageData, "identity", "fullName", "");
    }

    // set the email if it doesn't exist
    if (!pageData.identity.email || !pageData.identity.email.value) {
      setPageData(pageData, "identity", "email", "user@domain.invalid");
    }

    // call FinishAccount() and not onFinish(), since the "finish"
    // button may be disabled
    FinishAccount();
  }
  else {
    // since this is not an invalid account
    // really cancel if the user hits the "cancel" button
    // if the length of the account list is less than 1, there are no accounts
    if (MailServices.accounts.accounts.length < 1) {
      let confirmMsg = gPrefsBundle.getString("cancelWizard");
      let confirmTitle = gPrefsBundle.getString("accountWizard");
      let result = Services.prompt.confirmEx(window, confirmTitle, confirmMsg,
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
        gPrefsBundle.getString('WizardExit'),
        gPrefsBundle.getString('WizardContinue'), 
        null, null, {value:0});

      if (result == 1)
        closeWizard = false;
    }

    if(top.okCallback && closeWizard) {
      var state = false;
      top.okCallback(state);
    }
  }
  return closeWizard;
}

function FinishAccount() 
{
  try {
    var pageData = GetPageData();

    var accountData= gCurrentAccountData;
    
    if (!accountData)
    {
      accountData = new Object;
      // Time to set the smtpRequiresUsername attribute
      if (!serverIsNntp(pageData))
        accountData.smtpRequiresUsername = true;
    }
    
    // we may need local folders before account is "Finished"
    // if it's a pop3 account which defers to Local Folders.
    verifyLocalFoldersAccount();

    PageDataToAccountData(pageData, accountData);

    FixupAccountDataForIsp(accountData);
    
    // we might be simply finishing another account
    if (!gCurrentAccount)
      gCurrentAccount = createAccount(accountData);

    // transfer all attributes from the accountdata
    finishAccount(gCurrentAccount, accountData);
    
    setupCopiesAndFoldersServer(gCurrentAccount, getCurrentServerIsDeferred(pageData), accountData);

    if (gCurrentAccount.incomingServer.canBeDefaultServer)
      EnableCheckMailAtStartUpIfNeeded(gCurrentAccount);

    if (!document.getElementById("downloadMsgs").hidden) {
      // skip the default biff, we will load messages manually if needed
      window.opener.gLoadStartFolder = false;
      if (document.getElementById("downloadMsgs").checked) {
        window.opener.gNewAccountToLoad = gCurrentAccount; // load messages for new POP account
      }
    }

    // in case we crash, force us a save of the prefs file NOW
    try {
      MailServices.accounts.saveAccountInfo();
    } 
    catch (ex) {
      dump("Error saving account info: " + ex + "\n");
    }
    window.close();
    if(top.okCallback)
    {
      var state = true;
      //dump("finish callback");
      top.okCallback(state);
    }
  }
  catch(ex) {
    dump("FinishAccount failed, " + ex +"\n");
  }
}

// prepopulate pageData with stuff from accountData
// use: to prepopulate the wizard with account information
function AccountDataToPageData(accountData, pageData)
{
  if (!accountData) {
    dump("null account data! clearing..\n");
    // handle null accountData as if it were an empty object
    // so that we clear-out any old pagedata from a
    // previous accountdata. The trick is that
    // with an empty object, accountData.identity.slot is undefined,
    // so this will clear out the prefill data in setPageData
    
    accountData = new Object;
    accountData.incomingServer = new Object;
    accountData.identity = new Object;
    accountData.smtp = new Object;
  }
  
  var server = accountData.incomingServer;

  if (server.type == undefined) {
    // clear out the old server data
    //setPageData(pageData, "accounttype", "mailaccount", undefined);
    //        setPageData(pageData, "accounttype", "newsaccount", undefined);
    setPageData(pageData, "server", "servertype", undefined);
    setPageData(pageData, "server", "hostname", undefined);

  }
  else {

    if (server.type == "nntp") {
      setPageData(pageData, "accounttype", "newsaccount", true);
      setPageData(pageData, "accounttype", "mailaccount", false);
      setPageData(pageData, "newsserver", "hostname", server.hostName);
    }

    else {
      setPageData(pageData, "accounttype", "mailaccount", true);
      setPageData(pageData, "accounttype", "newsaccount", false);
      setPageData(pageData, "server", "servertype", server.type);
      setPageData(pageData, "server", "hostname", server.hostName);
    }
    setPageData(pageData, "accounttype", "otheraccount", false);
  }
  
  setPageData(pageData, "login", "username", server.username);
  setPageData(pageData, "login", "password", server.password);
  setPageData(pageData, "accname", "prettyName", server.prettyName);
  setPageData(pageData, "accname", "userset", false);
  setPageData(pageData, "ispdata", "supplied", false);
  
  var identity;
  
  if (accountData.identity) {
      dump("This is an accountdata\n");
      identity = accountData.identity;
  }
  else if (accountData.identities) {
      identity = accountData.identities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
      dump("this is an account, id= " + identity + "\n");
  }

  setPageData(pageData, "identity", "email", identity.email);
  setPageData(pageData, "identity", "fullName", identity.fullName);

  var smtp;
  
  if (accountData.smtp) {
      smtp = accountData.smtp;
      setPageData(pageData, "server", "smtphostname", smtp.hostname);
      setPageData(pageData, "login", "smtpusername", smtp.username);
  }
}

// take data from each page of pageData and dump it into accountData
// use: to put results of wizard into a account-oriented object
function PageDataToAccountData(pageData, accountData)
{
  if (!accountData.identity)
    accountData.identity = new Object;
  if (!accountData.incomingServer)
    accountData.incomingServer = new Object;
  if (!accountData.smtp)
    accountData.smtp = new Object;
  if (!accountData.pop3)
    accountData.pop3 = new Object;
  if (!accountData.imap)
    accountData.imap = new Object;
  
  var identity = accountData.identity;
  var server = accountData.incomingServer;
  var smtp = accountData.smtp;
  var pop3 = accountData.pop3;
  var imap = accountData.imap;

  if (pageData.identity.email)
    identity.email = pageData.identity.email.value;
  if (pageData.identity.fullName)
    identity.fullName = pageData.identity.fullName.value;

  server.type = getCurrentServerType(pageData);
  server.hostName = getCurrentHostname(pageData);
  if (getCurrentServerIsDeferred(pageData))
  {
    try
    {
      let localFoldersServer = MailServices.accounts.localFoldersServer;
      let localFoldersAccount = MailServices.accounts.FindAccountForServer(localFoldersServer);
      pop3.deferredToAccount = localFoldersAccount.key;
      pop3.deferGetNewMail = true;
      server["ServerType-pop3"] = pop3;
    }
    catch (ex) {dump ("exception setting up deferred account" + ex);}
  }
  if (serverIsNntp(pageData)) {
    // this stuff probably not relevant
    dump("not setting username/password/etc\n");
  }
  else {
    if (pageData.login) {
      if (pageData.login.username)
        server.username = pageData.login.username.value;
      if (pageData.login.password)
        server.password = pageData.login.password.value;
      if (pageData.login.smtpusername)
        smtp.username = pageData.login.smtpusername.value;
    }

    dump("pageData.server = " + pageData.server + "\n");
    if (pageData.server) {
      dump("pageData.server.smtphostname.value = " + pageData.server.smtphostname + "\n");
      if (pageData.server.smtphostname &&
          pageData.server.smtphostname.value)
        smtp.hostname = pageData.server.smtphostname.value;
    }
    if (pageData.identity && pageData.identity.smtpServerKey)
      identity.smtpServerKey = pageData.identity.smtpServerKey.value;

    if (pageData.server.port &&
        pageData.server.port.value)
    {
      if (server.type == 'imap')
      {
        imap.port = pageData.server.port.value;
        server["ServerType-imap"] = imap;
      }
      else if (server.type == 'pop3')
      {
        pop3.port = pageData.server.port.value;
        server["ServerType-pop3"] = pop3;
      }
    }

    if (pageData.server.leaveMessagesOnServer &&
        pageData.server.leaveMessagesOnServer.value)
    {
      pop3.leaveMessagesOnServer = pageData.server.leaveMessagesOnServer.value;
      server["ServerType-pop3"] = pop3;
    }
  }

  if (pageData.accname) {
    if (pageData.accname.prettyName)
      server.prettyName = pageData.accname.prettyName.value;
  }

}

// given an accountData structure, create an account
// (but don't fill in any fields, that's for finishAccount()
function createAccount(accountData)
{
  // Retrieve the server (data) from the account data.
  var server = accountData.incomingServer;
  
  // for news, username is always null
  var username = (server.type == "nntp") ? null : server.username;
  dump("MailServices.accounts.createIncomingServer(" +
       username + ", " + server.hostName + ", " + server.type + ")\n");
  // Create a (actual) server.
  server = MailServices.accounts.createIncomingServer(username, server.hostName, server.type);

  dump("MailServices.accounts.createAccount()\n");
  // Create an account.
  let account = MailServices.accounts.createAccount();
  
  // only create an identity for this account if we really have one
  // (use the email address as a check)
  if (accountData.identity && accountData.identity.email)
  {
    dump("MailServices.accounts.createIdentity()\n");
    // Create an identity.
    let identity = MailServices.accounts.createIdentity();

    // New nntp identities should use plain text by default;
    // we want that GNKSA (The Good Net-Keeping Seal of Approval).
    if (server.type == "nntp")
      identity.composeHtml = false;

    account.addIdentity(identity);
  }

  // we mark the server as invalid so that the account manager won't
  // tell RDF about the new server - it's not quite finished getting
  // set up yet, in particular, the deferred storage pref hasn't been set.
  server.valid = false;
  // Set the new account to use the new server.
  account.incomingServer = server;
  server.valid = true;
  return account;
}

// given an accountData structure, copy the data into the
// given account, incoming server, and so forth
function finishAccount(account, accountData) 
{
  if (accountData.incomingServer) {

    var destServer = account.incomingServer;
    var srcServer = accountData.incomingServer;
    copyObjectToInterface(destServer, srcServer, true);

    // see if there are any protocol-specific attributes
    // if so, we use the type to get the IID, QueryInterface
    // as appropriate, then copy the data over
    dump("srcServer.ServerType-" + srcServer.type + " = " +
         srcServer["ServerType-" + srcServer.type] + "\n");
    if (srcServer["ServerType-" + srcServer.type]) {
      // handle server-specific stuff
      var IID;
      try {
        IID = srcServer.protocolInfo.serverIID;
      } catch (ex) {
        Components.utils.reportError("Could not get IID for " + srcServer.type + ": " + ex);
      }

      if (IID) {
        destProtocolServer = destServer.QueryInterface(IID);
        srcProtocolServer = srcServer["ServerType-" + srcServer.type];

        dump("Copying over " + srcServer.type + "-specific data\n");
        copyObjectToInterface(destProtocolServer, srcProtocolServer, false);
      }
    }
      
    account.incomingServer.valid=true;
    // hack to cause an account loaded notification now the server is valid
    account.incomingServer = account.incomingServer;
  }

  // copy identity info
  var destIdentity = account.identities.length ?
                     account.identities.queryElementAt(0, nsIMsgIdentity) :
                     null;

  if (destIdentity) // does this account have an identity?
  {   
      if (accountData.identity && accountData.identity.email) {
          // fixup the email address if we have a default domain
          var emailArray = accountData.identity.email.split('@');
          if (emailArray.length < 2 && accountData.domain) {
              accountData.identity.email += '@' + accountData.domain;
          }

          copyObjectToInterface(destIdentity, accountData.identity, true);
          destIdentity.valid=true;
      }

      /**
       * If signature file need to be set, get the path to the signature file.
       * Signature files, if exist, are placed under default location. Get
       * default files location for messenger using directory service. Signature 
       * file name should be extracted from the account data to build the complete
       * path for signature file. Once the path is built, set the identity's signature pref.
       */
      if (destIdentity.attachSignature)
      {
          var sigFileName = accountData.signatureFileName;
          let sigFile = MailServices.mailSession.getDataFilesDir("messenger");
          sigFile.append(sigFileName);
          destIdentity.signature = sigFile;
      }

      if (accountData.smtp.hostname && !destIdentity.smtpServerKey)
      {
          // hostname + no key => create a new SMTP server.

          let smtpServer = MailServices.smtp.createServer();
          var isDefaultSmtpServer;
          if (!MailServices.smtp.defaultServer.hostname) {
            MailServices.smtp.defaultServer = smtpServer;
            isDefaultSmtpServer = true;
          }

          copyObjectToInterface(smtpServer, accountData.smtp, false);

          // If it's the default server we created, make the identity use
          // "Use Default" by default.
          destIdentity.smtpServerKey =
            (isDefaultSmtpServer) ? "" : smtpServer.key;
       }
   } // if the account has an identity...

   if (this.FinishAccountHook != undefined) {
       FinishAccountHook(accountData.domain);
   }
}

// Helper method used by copyObjectToInterface which attempts to set dest[attribute] as a generic
// attribute on the xpconnect object, src.
// This routine skips any attribute that begins with ServerType- 
function setGenericAttribute(dest, src, attribute)
{
  if (!(attribute.toLowerCase().startsWith("servertype-")) && src[attribute])
  {
    switch (typeof src[attribute])
    {
      case "string":
        dest.setUnicharAttribute(attribute, src[attribute]);
        break;
      case "boolean":
        dest.setBoolAttribute(attribute, src[attribute]);
        break;
      case "number":
        dest.setIntAttribute(attribute, src[attribute]);
        break;
      default:
        dump("Error: No Generic attribute " + attribute + " found for: " + dest + "\n");
        break;
    }
  }
}

// copy over all attributes from dest into src that already exist in src
// the assumption is that src is an XPConnect interface full of attributes
// @param useGenericFallback if we can't set an attribute directly on src, then fall back
//        and try setting it generically. This assumes that src supports setIntAttribute, setUnicharAttribute
//        and setBoolAttribute. 
function copyObjectToInterface(dest, src, useGenericFallback) 
{
  if (!dest) return;
  if (!src) return;

  var attribute;
  for (attribute in src) 
  {
    if (dest.__lookupSetter__(attribute))
    {
      if (dest[attribute] != src[attribute])
        dest[attribute] = src[attribute];
    } 
    else if (useGenericFallback) // fall back to setting the attribute generically
      setGenericAttribute(dest, src, attribute);
  } // for each attribute in src we want to copy
}

// check if there already is a "Local Folders"
// if not, create it.
function verifyLocalFoldersAccount() 
{
  var localMailServer = null;
  try {
    localMailServer = MailServices.accounts.localFoldersServer;
  }
  catch (ex) {
         // dump("exception in findserver: " + ex + "\n");
    localMailServer = null;
  }

  try {
    if (!localMailServer) 
    {
      // dump("Creating local mail account\n");
      // creates a copy of the identity you pass in
      MailServices.accounts.createLocalMailAccount();
      try {
        localMailServer = MailServices.accounts.localFoldersServer;
      }
      catch (ex) {
        dump("error!  we should have found the local mail server after we created it.\n");
        localMailServer = null;
      }
    }
  }
  catch (ex) {dump("Error in verifyLocalFoldersAccount" + ex + "\n");  }

}

function setupCopiesAndFoldersServer(account, accountIsDeferred, accountData)
{
  try {
    var server = account.incomingServer;

    // This function sets up the default send preferences. The send preferences
    // go on identities, so there is no need to continue without any identities.
    if (server.type == "rss" || account.identities.length == 0)
      return false;
    let identity = account.identities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
    // For this server, do we default the folder prefs to this server, or to the "Local Folders" server
    // If it's deferred, we use the local folders account.
    var defaultCopiesAndFoldersPrefsToServer = !accountIsDeferred && server.defaultCopiesAndFoldersPrefsToServer;

    var copiesAndFoldersServer = null;
    if (defaultCopiesAndFoldersPrefsToServer) 
    {
      copiesAndFoldersServer = server;
    }
    else 
    {
      if (!MailServices.accounts.localFoldersServer)
      {
        dump("error!  we should have a local mail server at this point\n");
        return false;
      }
      copiesAndFoldersServer = MailServices.accounts.localFoldersServer;
    }

    setDefaultCopiesAndFoldersPrefs(identity, copiesAndFoldersServer, accountData);

  } catch (ex) {
    // return false (meaning we did not setupCopiesAndFoldersServer)
    // on any error
    dump("Error in setupCopiesAndFoldersServer: " + ex + "\n");
    return false;
  }
  return true;
}

function setDefaultCopiesAndFoldersPrefs(identity, server, accountData)
{
  var rootFolder = server.rootFolder;

  // we need to do this or it is possible that the server's draft,
  // stationery fcc folder will not be in rdf
  //
  // this can happen in a couple cases
  // 1) the first account we create, creates the local mail.  since
  // local mail was just created, it obviously hasn't been opened,
  // or in rdf..
  // 2) the account we created is of a type where
  // defaultCopiesAndFoldersPrefsToServer is true
  // this since we are creating the server, it obviously hasn't been
  // opened, or in rdf.
  //
  // this makes the assumption that the server's draft, stationery fcc folder
  // are at the top level (ie subfolders of the root folder.)  this works
  // because we happen to be doing things that way, and if the user changes
  // that, it will work because to change the folder, it must be in rdf,
  // coming from the folder cache, in the worst case.
  var msgFolder = rootFolder.QueryInterface(Components.interfaces.nsIMsgFolder);

  /** 
   * When a new account is created, folders 'Sent', 'Drafts'
   * and 'Templates' are not created then, but created on demand at runtime. 
   * But we do need to present them as possible choices in the Copies and Folders 
   * UI. To do that, folder URIs have to be created and stored in the prefs file. 
   * So, if there is a need to build special folders, append the special folder 
   * names and create right URIs.
   */
  var folderDelim = "/";

  /* we use internal names known to everyone like Sent, Templates and Drafts */
  /* if folder names were already given in isp rdf, we use them,
     otherwise we use internal names known to everyone like Sent, Templates and Drafts */

  // Note the capital F, D and S!
  var draftFolder = (accountData.identity && accountData.identity.DraftFolder ?
    accountData.identity.DraftFolder : "Drafts");
  var stationeryFolder = (accountData.identity && accountData.identity.StationeryFolder ?
    accountData.identity.StationeryFolder : "Templates");
  var fccFolder = (accountData.identity && accountData.identity.FccFolder ?
    accountData.identity.FccFolder : "Sent");

  identity.draftFolder = msgFolder.server.serverURI+ folderDelim + draftFolder;
  identity.stationeryFolder = msgFolder.server.serverURI+ folderDelim + stationeryFolder;
  identity.fccFolder = msgFolder.server.serverURI+ folderDelim + fccFolder;

  // Note the capital F, D and S!
  identity.fccFolderPickerMode = (accountData.identity &&
    accountData.identity.FccFolder ? 1 : gDefaultSpecialFolderPickerMode);
  identity.draftsFolderPickerMode = (accountData.identity &&
    accountData.identity.DraftFolder ? 1 : gDefaultSpecialFolderPickerMode);
  identity.tmplFolderPickerMode = (accountData.identity &&
    accountData.identity.StationeryFolder ? 1 : gDefaultSpecialFolderPickerMode);
}

function AccountExists(userName, hostName, serverType)
{
  return MailServices.accounts.findRealServer(userName, hostName, serverType, 0);
}

function getFirstInvalidAccount()
{
  let invalidAccounts = getInvalidAccounts(MailServices.accounts.accounts);

  if (invalidAccounts.length > 0)
    return invalidAccounts[0];
  else
    return null;
}

function checkForInvalidAccounts()
{
  var firstInvalidAccount = getFirstInvalidAccount();

  if (firstInvalidAccount) {
    var pageData = GetPageData();
    dump("We have an invalid account, " + firstInvalidAccount + ", let's use that!\n");
    gCurrentAccount = firstInvalidAccount;

    // there's a possibility that the invalid account has ISP defaults
    // as well.. so first pre-fill accountData with ISP info, then
    // overwrite it with the account data


    var identity =
      firstInvalidAccount.identities.queryElementAt(0, nsIMsgIdentity);

    var accountData = null;
    // If there is a email address already provided, try to get to other ISP defaults.
    // If not, get pre-configured data, if any.
    if (identity.email) {
      dump("Invalid account: trying to get ISP data for " + identity.email + "\n");
      accountData = getIspDefaultsForEmail(identity.email);
      dump("Invalid account: Got " + accountData + "\n");

      // account -> accountData -> pageData
      accountData = AccountToAccountData(firstInvalidAccount, accountData);
    }
    else {
      accountData = getPreConfigDataForAccount(firstInvalidAccount);
    }
    
    AccountDataToPageData(accountData, pageData);

    gCurrentAccountData = accountData;

    setupWizardPanels();
    // Set the page index to identity page.
    document.documentElement.pageIndex = 1;
  }
}

// Transfer all invalid account information to AccountData. Also, get those special 
// preferences (not associated with any interfaces but preconfigurable via prefs or rdf files) 
// like whether not the smtp server associated with this account requires 
// a user name (mail.identity.<id_key>.smtpRequiresUsername) and the choice of skipping 
// panels (mail.identity.<id_key>.wizardSkipPanels).
function getPreConfigDataForAccount(account)
{
  var accountData = new Object;
  accountData = new Object;
  accountData.incomingServer = new Object;
  accountData.identity = new Object;
  accountData.smtp = new Object;

  accountData = AccountToAccountData(account, null);

  let identity = account.identities.queryElementAt(0, nsIMsgIdentity);

  try {
    var skipPanelsPrefStr = "mail.identity." + identity.key + ".wizardSkipPanels";
    accountData.wizardSkipPanels = Services.prefs.getCharPref(skipPanelsPrefStr);

    if (identity.smtpServerKey) {
      let smtpServer = MailServices.smtp.getServerByKey(identity.smtpServerKey);
      accountData.smtp = smtpServer;

      var smtpRequiresUsername = false;
      var smtpRequiresPrefStr = "mail.identity." + identity.key + ".smtpRequiresUsername";
      smtpRequiresUsername = Services.prefs.getBoolPref(smtpRequiresPrefStr);
      accountData.smtpRequiresUsername = smtpRequiresUsername;
    }
  }
  catch(ex) {
    // reached here as special identity pre-configuration prefs 
    // (wizardSkipPanels, smtpRequiresUsername) are not defined.
  }

  return accountData;
}

function AccountToAccountData(account, defaultAccountData)
{
  dump("AccountToAccountData(" + account + ", " +
       defaultAccountData + ")\n");
  var accountData = defaultAccountData;
  if (!accountData)
    accountData = new Object;

  accountData.incomingServer = account.incomingServer;
  accountData.identity = account.identities.queryElementAt(0, nsIMsgIdentity);
  accountData.smtp = MailServices.smtp.defaultServer;

  return accountData;
}

// sets the page data, automatically creating the arrays as necessary
function setPageData(pageData, tag, slot, value) {
  if (!pageData[tag]) pageData[tag] = [];

  if (value == undefined) {
    // clear out this slot
    if (pageData[tag][slot]) delete pageData[tag][slot];
  }
  else {
    // pre-fill this slot
    if (!pageData[tag][slot]) pageData[tag][slot] = [];
    pageData[tag][slot].id = slot;
    pageData[tag][slot].value = value;
  }
}

// value of checkbox on the first page
function serverIsNntp(pageData) {
  if (pageData.accounttype.newsaccount)
    return pageData.accounttype.newsaccount.value;
  return false;
}

function getUsernameFromEmail(aEmail, aEnsureDomain)
{
  var username = aEmail.substr(0, aEmail.indexOf("@"));  
  if (aEnsureDomain && gCurrentAccountData && gCurrentAccountData.domain)
    username += '@' + gCurrentAccountData.domain;    
  return username;
}

function getCurrentUserName(pageData)
{
  var userName = "";

  if (pageData.login) {
    if (pageData.login.username) {
      userName = pageData.login.username.value;
    }
  }
  if (userName == "") {
    var email = pageData.identity.email.value;
    userName = getUsernameFromEmail(email, false); 
  }
  return userName;
}

function getCurrentServerType(pageData) {
  var servertype = "pop3";    // hopefully don't resort to default!
  if (serverIsNntp(pageData))
    servertype = "nntp";
  else if (pageData.server && pageData.server.servertype)
    servertype = pageData.server.servertype.value;
  return servertype;
}

function getCurrentServerIsDeferred(pageData) {
  var serverDeferred = false; 
  if (getCurrentServerType(pageData) == "pop3" && pageData.server && pageData.server.deferStorage)
    serverDeferred = pageData.server.deferStorage.value;

  return serverDeferred;
}

function getCurrentHostname(pageData) {
  if (serverIsNntp(pageData))
    return pageData.newsserver.hostname.value;
  else
    return pageData.server.hostname.value;
}

function GetPageData()
{
  if (!gPageData)
    gPageData = new Object;

  return gPageData;
}

function PrefillAccountForIsp(ispName)
{
  dump("AccountWizard.prefillAccountForIsp(" + ispName + ")\n");

  var ispData = getIspDefaultsForUri(ispName);
  
  var pageData = GetPageData();

  if (!ispData) {
    SetCurrentAccountData(null);
    return;
  }

  // prefill the rest of the wizard
  dump("PrefillAccountForISP: filling with " + ispData + "\n");
  SetCurrentAccountData(ispData);
  AccountDataToPageData(ispData, pageData);

  setPageData(pageData, "ispdata", "supplied", true);
}

// does any cleanup work for the the account data
// - sets the username from the email address if it's not already set
// - anything else?
function FixupAccountDataForIsp(accountData)
{
  // no fixup for news
  // setting the username does bad things
  // see bugs #42105 and #154213
  if (accountData.incomingServer.type == "nntp")
    return;

  var email = accountData.identity.email;

  // The identity might not have an email address, which is what the rest of
  // this function is looking for.
  if (!email)
    return;

  // fix up the username
  if (!accountData.incomingServer.username)
    accountData.incomingServer.username = 
      getUsernameFromEmail(email, accountData.incomingServerUserNameRequiresDomain);

  if (!accountData.smtp.username &&
      accountData.smtpRequiresUsername) {
    // fix for bug #107953
    // if incoming hostname is same as smtp hostname
    // use the server username (instead of the email username)
    if (accountData.smtp.hostname == accountData.incomingServer.hostName &&
        accountData.smtpUserNameRequiresDomain == accountData.incomingServerUserNameRequiresDomain)
      accountData.smtp.username = accountData.incomingServer.username;
    else
      accountData.smtp.username = getUsernameFromEmail(email, accountData.smtpUserNameRequiresDomain);
  }
}

function SetCurrentAccountData(accountData)
{
  //    dump("Setting current account data (" + gCurrentAccountData + ") to " + accountData + "\n");
  gCurrentAccountData = accountData;
}

// flush the XUL cache - just for debugging purposes - not called
function onFlush() {
  Services.prefs.setBoolPref("nglayout.debug.disable_xul_cache", true);
  Services.prefs.setBoolPref("nglayout.debug.disable_xul_cache", false);
}

/** If there are no default accounts..
  * this is will be the new default, so enable
  * check for mail at startup
  */
function EnableCheckMailAtStartUpIfNeeded(newAccount)
{
  // Check if default account exists and if that account is alllowed to be
  // a default account. If no such account, make this one as the default account 
  // and turn on the new mail check at startup for the current account   
  if (!(gDefaultAccount && gDefaultAccount.incomingServer.canBeDefaultServer)) { 
    MailServices.accounts.defaultAccount = newAccount;
    newAccount.incomingServer.loginAtStartUp = true;
    newAccount.incomingServer.downloadOnBiff = true;
  }
}

function SetSmtpRequiresUsernameAttribute(accountData) 
{
  // If this is the default server, time to set the smtp user name
  // Set the generic attribute for requiring user name for smtp to true.
  // ISPs can override the pref via rdf files.
  if (!(gDefaultAccount && gDefaultAccount.incomingServer.canBeDefaultServer)) { 
    accountData.smtpRequiresUsername = true;
  }
}

function setNextPage(currentPageId, nextPageId) {
  var currentPage = document.getElementById(currentPageId);
  currentPage.next = nextPageId;
}
