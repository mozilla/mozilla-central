/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
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

var accountManagerContractID   = "@mozilla.org/messenger/account-manager;1";
var gAnyValidIdentity = false; //If there are no valid identities for any account
// returns the first account with an invalid server or identity

var gNewAccountToLoad = null;   // used to load new messages if we come from the mail3pane

function getInvalidAccounts(accounts)
{
    var numAccounts = accounts.Count();
    var invalidAccounts = new Array;
    var numIdentities = 0;
    for (var i=0; i<numAccounts; i++) {
        var account = accounts.QueryElementAt(i, Components.interfaces.nsIMsgAccount);
        try {
            if (!account.incomingServer.valid) {
                invalidAccounts[invalidAccounts.length] = account;
                // skip to the next account
                continue;
            }
        } catch (ex) {
            // this account is busted, just keep going
            continue;
        }

        var identities = account.identities;
        numIdentities = identities.Count();

        for (var j=0; j<numIdentities; j++) {
            var identity = identities.QueryElementAt(j, Components.interfaces.nsIMsgIdentity);
            if (identity.valid) {
              gAnyValidIdentity = true;
            }
            else {
              invalidAccounts[invalidAccounts.length] = account;
            }
        }
    }
    return invalidAccounts;
}

function showMailIntegrationDialog() {
  const nsIShellService = Components.interfaces.nsIShellService;

  try {
    var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                                 .getService(nsIShellService);
    var accountManager = Components.classes[accountManagerContractID].getService(Components.interfaces.nsIMsgAccountManager);
    var defaultAccount = accountManager.defaultAccount;
    var appTypesCheck = shellService.shouldBeDefaultClientFor &
                        (nsIShellService.MAIL | nsIShellService.NEWS);

    // show the default client dialog only if we have at least one account,
    // if we should check for the default client, and we want to check if we are 
    // the default for mail/news and are not the default client for mail/news
    if (appTypesCheck && shellService.shouldCheckDefaultClient &&
        !shellService.isDefaultClient(true, appTypesCheck))
        window.openDialog("chrome://communicator/content/defaultClientDialog.xul",
                        "DefaultClient", "modal,centerscreen,chrome,resizable=no");
  } catch (ex) {}
}

/**
 * Verify that there is at least one account. If not, open a new account wizard.
 *
 * @param wizardCallback if the wizard is run, callback when it is done.
 * @param needsIdentity True only when verifyAccounts is called from the
 *                      compose window. This last condition is so that we open
 *                      the account wizard if the user does not have any
 *                      identities defined and tries to compose mail.
 * @param wizardOpen optional param that allows the caller to specify a
 *                   different method to open a wizard. The wizardOpen method
 *                   takes wizardCallback as an argument. The wizardCallback
 *                   doesn't take any arguments.
 */
function verifyAccounts(wizardCallback, needsIdentity, wizardOpen)
{
  var openWizard = false;
  var prefillAccount;
  var state=true;
  var ret = true;

    try {
        var am = Components.classes[accountManagerContractID].getService(Components.interfaces.nsIMsgAccountManager);

        // migrate quoting preferences from global to per account. This function returns
        // true if it had to migrate, which we will use to mean this is a just migrated
        // or new profile
        var newProfile = migrateGlobalQuotingPrefs(am.allIdentities);

        var accounts = am.accounts;

        // as long as we have some accounts, we're fine.
        var accountCount = accounts.Count();
        var invalidAccounts = getInvalidAccounts(accounts);
        if (invalidAccounts.length > 0 && invalidAccounts.length == accountCount) {
            prefillAccount = invalidAccounts[0];
        } else {
        }

        // if there are no accounts, or all accounts are "invalid"
        // then kick off the account migration. Or if this is a new (to Mozilla) profile.
        // MCD can set up accounts without the profile being used yet
        if (newProfile) {
          // check if MCD is configured. If not, say this is not a new profile
          // so that we don't accidentally remigrate non MCD profiles.
          var adminUrl;
          var pref = Components.classes["@mozilla.org/preferences-service;1"]
                                 .getService(Components.interfaces.nsIPrefBranch);
          try {
            adminUrl = pref.getCharPref("autoadmin.global_config_url");
          }
          catch (ex) {}
          if (!adminUrl)
            newProfile = false;
        }
        if ((newProfile  && !accountCount) || accountCount == invalidAccounts.length)
          openWizard = true;

        // openWizard is true if messenger migration returns some kind of
        // error (including those cases where there is nothing to migrate).
        // prefillAccount is non-null if there is at least one invalid account.
        // gAnyValidIdentity is true when you've got at least one *valid*
        // identity. Since local and RSS folders are identity-less accounts, if you
        // only have one of those, it will be false.
        // needsIdentity is true only when verifyAccounts is called from the
        // compose window. This last condition is so that we open the account
        // wizard if the user does not have any identities defined and tries to
        // compose mail.

        if (openWizard || prefillAccount || ((!gAnyValidIdentity) && needsIdentity))
        {
          if (wizardOpen != undefined)
            wizardOpen(wizardCallback)
          else
            MsgAccountWizard(wizardCallback);
          ret = false;
        }
        else
        {
          var localFoldersExists;
          try
          {
            localFoldersExists = am.localFoldersServer;
          }
          catch (ex)
          {
            localFoldersExists = false;
          }

          // we didn't create the MsgAccountWizard - we need to verify that local folders exists.
          if (!localFoldersExists)
            am.createLocalMailAccount();
        }

        // This will do nothing on platforms without a shell service
        const NS_SHELLSERVICE_CID = "@mozilla.org/suite/shell-service;1"
        if (NS_SHELLSERVICE_CID in Components.classes)
        {
          // hack, set a time out to do this, so that the window can load first
          setTimeout(showMailIntegrationDialog, 0);
        }
        return ret;
    }
    catch (ex) {
        dump("error verifying accounts " + ex + "\n");
        return false;
    }
}

// we do this from a timer because if this is called from the onload=
// handler, then the parent window doesn't appear until after the wizard
// has closed, and this is confusing to the user
function MsgAccountWizard(wizardCallback)
{
  setTimeout(function() { msgOpenAccountWizard(wizardCallback); }, 0);
}

function msgOpenAccountWizard(wizardCallback)
{
  gNewAccountToLoad = null;

  window.openDialog("chrome://messenger/content/AccountWizard.xul", "AccountWizard",
                    "chrome,modal,titlebar,centerscreen", {okCallback: wizardCallback});

  loadInboxForNewAccount();

  // For the first account we need to reset the default smtp server in the
  // panel, by accessing smtpServers we are actually ensuring the smtp server
  // list is loaded.
  var smtpService = Components.classes["@mozilla.org/messengercompose/smtp;1"].getService(Components.interfaces.nsISmtpService);
  var servers = smtpService.smtpServers;
  try{ReloadSmtpPanel();}
  catch(ex){}
}

// selectPage: the xul file name for the viewing page, 
// null for the account main page, other pages are
// 'am-server.xul', 'am-copies.xul', 'am-offline.xul', 
// 'am-addressing.xul', 'am-smtp.xul'
function MsgAccountManager(selectPage)
{
    var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].
                            getService(Components.interfaces.nsIWindowMediator);

    var existingAccountManager = windowManager.getMostRecentWindow("mailnews:accountmanager");

    if (existingAccountManager)
        existingAccountManager.focus();
    else {
        try {
            var server = GetSelectedMsgFolders()[0].server;
        } catch (ex) { /* functions might not be defined */}
        
        window.openDialog("chrome://messenger/content/AccountManager.xul",
                          "AccountManager", "chrome,centerscreen,modal,titlebar",
                          { server: server, selectPage: selectPage });
    }
}

function loadInboxForNewAccount() 
{
  // gNewAccountToLoad is set in the final screen of the Account Wizard if a POP account
  // was created, the download messages box is checked, and the wizard was opened from the 3pane
  if (gNewAccountToLoad) {
    var rootMsgFolder = gNewAccountToLoad.incomingServer.rootMsgFolder;
    const kInboxFlag = Components.interfaces.nsMsgFolderFlags.Inbox;
    var inboxFolder = rootMsgFolder.getFolderWithFlags(kInboxFlag);
    SelectFolder(inboxFolder.URI);
    window.focus();
    setTimeout(MsgGetMessage, 0);
    gNewAccountToLoad = null;
  }
}

// returns true if we migrated - it knows this because 4.x did not have the
// pref mailnews.quotingPrefs.version, so if it's not set, we're either 
// migrating from 4.x, or a much older version of Mozilla.
function migrateGlobalQuotingPrefs(allIdentities)
{
  // if reply_on_top and auto_quote exist then, if non-default
  // migrate and delete, if default just delete.  
  var reply_on_top = 0;
  var auto_quote = true;
  var quotingPrefs = 0;
  var migrated = false;
  try {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);
    var pref = prefService.getBranch(null);
    quotingPrefs = pref.getIntPref("mailnews.quotingPrefs.version");
  } catch (ex) {}
  
  // If the quotingPrefs version is 0 then we need to migrate our preferences
  if (quotingPrefs == 0) {
    migrated = true;
    try {
      reply_on_top = pref.getIntPref("mailnews.reply_on_top");
      auto_quote = pref.getBoolPref("mail.auto_quote");
    } catch (ex) {}

    if (!auto_quote || reply_on_top) {
      var numIdentities = allIdentities.Count();
      var identity = null;
      for (var j = 0; j < numIdentities; j++) {
        identity = allIdentities.QueryElementAt(j, Components.interfaces.nsIMsgIdentity);
        if (identity.valid) {
          identity.autoQuote = auto_quote;
          identity.replyOnTop = reply_on_top;
        }
      }
    }
    pref.setIntPref("mailnews.quotingPrefs.version", 1);
  }
  return migrated;
}

// we do this from a timer because if this is called from the onload=
// handler, then the parent window doesn't appear until after the wizard
// has closed, and this is confusing to the user
function NewMailAccount(msgWindow, okCallback)
{
  setTimeout(msgNewMailAccount, 0, msgWindow, okCallback);
}

function msgNewMailAccount(msgWindow, okCallback)
{
  let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService()
                     .QueryInterface(Components.interfaces.nsIWindowMediator);
  let existingWindow = wm.getMostRecentWindow("mail:autoconfig");
  if (existingWindow)
    existingWindow.focus();
  else
    window.openDialog("chrome://messenger/content/accountcreation/emailWizard.xul",
                      "AccountSetup", "chrome,titlebar,centerscreen",{msgWindow:msgWindow, okCallback:okCallback});
}
