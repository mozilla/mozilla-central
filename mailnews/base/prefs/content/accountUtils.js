/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gAnyValidIdentity = false; //If there are no valid identities for any account
// returns the first account with an invalid server or identity

var gNewAccountToLoad = null;   // used to load new messages if we come from the mail3pane

function getInvalidAccounts(accounts)
{
    let numAccounts = accounts.length;
    let invalidAccounts = new Array;
    let numIdentities = 0;
    for (let i = 0; i < numAccounts; i++) {
        let account = accounts.queryElementAt(i, Components.interfaces.nsIMsgAccount);
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
        numIdentities = identities.length;

        for (var j = 0; j < numIdentities; j++) {
            let identity = identities.queryElementAt(j, Components.interfaces.nsIMsgIdentity);
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
        // migrate quoting preferences from global to per account. This function returns
        // true if it had to migrate, which we will use to mean this is a just migrated
        // or new profile
        var newProfile = migrateGlobalQuotingPrefs(MailServices.accounts.allIdentities);

        var accounts = MailServices.accounts.accounts;

        // as long as we have some accounts, we're fine.
        var accountCount = accounts.length;
        var invalidAccounts = getInvalidAccounts(accounts);
        if (invalidAccounts.length > 0 && invalidAccounts.length == accountCount) {
            prefillAccount = invalidAccounts[0];
        }

        // if there are no accounts, or all accounts are "invalid"
        // then kick off the account migration. Or if this is a new (to Mozilla) profile.
        // MCD can set up accounts without the profile being used yet
        if (newProfile) {
          // check if MCD is configured. If not, say this is not a new profile
          // so that we don't accidentally remigrate non MCD profiles.
          var adminUrl;
          try {
            adminUrl = Services.prefs.getCharPref("autoadmin.global_config_url");
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
            localFoldersExists = MailServices.accounts.localFoldersServer;
          }
          catch (ex)
          {
            localFoldersExists = false;
          }

          // we didn't create the MsgAccountWizard - we need to verify that local folders exists.
          if (!localFoldersExists)
            MailServices.accounts.createLocalMailAccount();
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

/**
 * Open the Old Mail Account Wizard, or focus it if it's already open.
 *
 * @param wizardCallback if the wizard is run, callback when it is done.
 * @param type - optional account type token, for Tb.
 * @see msgNewMailAccount below for the new implementation.
 */
function msgOpenAccountWizard(wizardCallback, type)
{
  gNewAccountToLoad = null;

  window.openDialog("chrome://messenger/content/AccountWizard.xul", "AccountWizard",
                    "chrome,modal,titlebar,centerscreen",
                    {okCallback: wizardCallback, acctType: type});

  loadInboxForNewAccount();

  // If we started with no servers at all and "smtp servers" list selected,
  // refresh display somehow. Bug 58506.
  // TODO Better fix: select newly created account (in all cases)
  if (typeof(getCurrentAccount) == "function" && // in AccountManager, not menu
      !getCurrentAccount())
    selectServer(null, null);
}

function initAccountWizardTB(args) {
  let type = args[0] && args[0].acctType;
  let selType = type == "newsgroups" ? "newsaccount" :
                type == "movemail" ? "Movemail" : null;
  let accountwizard = document.getElementById("AccountWizard");
  let acctyperadio = document.getElementById("acctyperadio");
  let feedRadio = acctyperadio.querySelector("radio[value='Feeds']");
  if (feedRadio)
    feedRadio.parentNode.removeChild(feedRadio);
  if (selType) {
    acctyperadio.selectedItem = acctyperadio.querySelector("radio[value='"+selType+"']");
    accountwizard.advance("identitypage");
  }
  else
    acctyperadio.selectedItem = acctyperadio.getItemAtIndex(0);
}

function AddFeedAccount() {
  window.openDialog("chrome://messenger-newsblog/content/feedAccountWizard.xul",
                    "", "chrome,modal,titlebar,centerscreen");
}

// selectPage: the xul file name for the viewing page,
// null for the account main page, other pages are
// 'am-server.xul', 'am-copies.xul', 'am-offline.xul',
// 'am-addressing.xul', 'am-smtp.xul'
function MsgAccountManager(selectPage)
{
    var existingAccountManager = Services.wm.getMostRecentWindow("mailnews:accountmanager");

    if (existingAccountManager)
        existingAccountManager.focus();
    else {
        try {
            var server = GetSelectedMsgFolders()[0] || GetDefaultAccountRootFolder();
            server = server.server;
        } catch (ex) { /* functions might not be defined */}

        window.openDialog("chrome://messenger/content/AccountManager.xul",
                          "AccountManager",
                          "chrome,centerscreen,modal,titlebar,resizable",
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
    quotingPrefs = Services.prefs.getIntPref("mailnews.quotingPrefs.version");
  } catch (ex) {}

  // If the quotingPrefs version is 0 then we need to migrate our preferences
  if (quotingPrefs == 0) {
    migrated = true;
    try {
      reply_on_top = Services.prefs.getIntPref("mailnews.reply_on_top");
      auto_quote = Services.prefs.getBoolPref("mail.auto_quote");
    } catch (ex) {}

    if (!auto_quote || reply_on_top) {
      let numIdentities = allIdentities.length;
      var identity = null;
      for (var j = 0; j < numIdentities; j++) {
        identity = allIdentities.queryElementAt(j, Components.interfaces.nsIMsgIdentity);
        if (identity.valid) {
          identity.autoQuote = auto_quote;
          identity.replyOnTop = reply_on_top;
        }
      }
    }
    Services.prefs.setIntPref("mailnews.quotingPrefs.version", 1);
  }
  return migrated;
}

// we do this from a timer because if this is called from the onload=
// handler, then the parent window doesn't appear until after the wizard
// has closed, and this is confusing to the user
function NewMailAccount(msgWindow, okCallback, extraData)
{
  if (!msgWindow)
    throw new Error("NewMailAccount must be given a msgWindow.");

  // Populate the extra data.
  if (!extraData)
    extraData = {};
  extraData.msgWindow = msgWindow;

  let mail3Pane = Services.wm.getMostRecentWindow("mail:3pane");

  if (!extraData.NewMailAccount)
    extraData.NewMailAccount = NewMailAccount;

  if (!extraData.msgNewMailAccount)
    extraData.msgNewMailAccount = msgNewMailAccount;

  if (!extraData.NewComposeMessage)
    extraData.NewComposeMessage = mail3Pane.ComposeMessage;

  if (!extraData.openAddonsMgr)
    extraData.openAddonsMgr = mail3Pane.openAddonsMgr;

  if (!extraData.okCallback)
    extraData.okCallback = null;

  if (!extraData.success)
    extraData.success = false;

  setTimeout(extraData.msgNewMailAccount, 0, msgWindow, okCallback, extraData);
}

function NewMailAccountProvisioner(aMsgWindow, args) {
  if (!args)
    args = {};
  if (!aMsgWindow)
    aMsgWindow = MailServices.mailSession.topmostMsgWindow;

  args.msgWindow = aMsgWindow;

  let mail3Pane = Services.wm.getMostRecentWindow("mail:3pane");

  // If we couldn't find a 3pane, bail out.
  if (!mail3Pane) {
    Components.utils.reportError("Could not find a 3pane to connect to.");
    return;
  }

  let tabmail = mail3Pane.document.getElementById("tabmail");

  if (!tabmail) {
    Components.utils.reportError("Could not find a tabmail in the 3pane!");
    return;
  }

  // If there's already an accountProvisionerTab open, just focus it instead
  // of opening a new dialog.
  let apTab = tabmail.getTabInfoForCurrentOrFirstModeInstance(
    tabmail.tabModes["accountProvisionerTab"]);

  if (apTab) {
    tabmail.switchToTab(apTab);
    return;
  }

  // XXX make sure these are all defined in all contexts... to be on the safe
  // side, just get a mail:3pane and borrow the functions from it?
  if (!args.NewMailAccount)
    args.NewMailAccount = NewMailAccount;

  if (!args.msgNewMailAccount)
    args.msgNewMailAccount = msgNewMailAccount;

  if (!args.NewComposeMessage)
    args.NewComposeMessage = mail3Pane.ComposeMessage;

  if (!args.openAddonsMgr)
    args.openAddonsMgr = mail3Pane.openAddonsMgr;

  if (!args.okCallback)
    args.okCallback = null;

  let windowParams = "chrome,titlebar,centerscreen,width=640,height=480";

  if (!args.success) {
    args.success = false;
    // If we're not opening up the success dialog, then our window should be
    // modal.
    windowParams = "modal," + windowParams;
  }

  // NOTE: If you're a developer, and you notice that the jQuery code in
  // accountProvisioner.xhtml isn't throwing errors or warnings, that's due
  // to bug 688273.  Just make the window non-modal to get those errors and
  // warnings back, and then clear this comment when bug 688273 is closed.
  window.openDialog(
    "chrome://messenger/content/newmailaccount/accountProvisioner.xhtml",
    "AccountCreation",
    windowParams,
    args);
}

/**
 * Open the New Mail Account Wizard, or focus it if it's already open.
 *
 * @param msgWindow a msgWindow for us to use to verify the accounts.
 * @param okCallback an optional callback for us to call back to if
 *                   everything's okay.
 * @param extraData an optional param that allows us to pass data in and
 *                  out.  Used in the upcoming AccountProvisioner add-on.
 * @see msgOpenAccountWizard below for the previous implementation.
 */
function msgNewMailAccount(msgWindow, okCallback, extraData)
{
  if (!msgWindow)
    throw new Error("msgNewMailAccount must be given a msgWindow.");

  let existingWindow = Services.wm.getMostRecentWindow("mail:autoconfig");
  if (existingWindow)
    existingWindow.focus();
  else
    // disabling modal for the time being, see 688273 REMOVEME
    window.openDialog("chrome://messenger/content/accountcreation/emailWizard.xul",
                      "AccountSetup", "chrome,titlebar,centerscreen",
                      {msgWindow:msgWindow,
                       okCallback:okCallback,
                       extraData:extraData});

  // If we started with no servers at all and "smtp servers" list selected,
  // refresh display somehow. Bug 58506.
  // TODO Better fix: select newly created account (in all cases)
  if (typeof(getCurrentAccount) == "function" && // in AccountManager, not menu
      !getCurrentAccount())
    selectServer(null, null);
}
