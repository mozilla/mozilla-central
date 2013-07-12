/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * here's how this dialog works:
 * The main dialog contains a tree on the left (accounttree) and a
 * deck on the right. Each card in the deck on the right contains an
 * IFRAME which loads a particular preference document (such as am-main.xul)
 *
 * when the user clicks on items in the tree on the right, two things have
 * to be determined before the UI can be updated:
 * - the relevant account
 * - the relevant page
 *
 * when both of these are known, this is what happens:
 * - every form element of the previous page is saved in the account value
 *   hashtable for the previous account
 * - the card containing the relevant page is brought to the front
 * - each form element in the page is filled in with an appropriate value
 *   from the current account's hashtable
 * - in the IFRAME inside the page, if there is an onInit() method,
 *   it is called. The onInit method can further update this page based
 *   on values set in the previous step.
 */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/folderUtils.jsm");
Components.utils.import("resource:///modules/hostnameUtils.jsm");

// If Local directory has changed the app needs to restart. Once this is set
// a restart will be attempted at each attempt to close the Account manager with OK.
var gRestartNeeded = false;

// This is a hash-map for every account we've touched in the pane. Each entry
// has additional maps of attribute-value pairs that we're going to want to save
// when the user hits OK.
var accountArray;
var gGenericAttributeTypes;

var currentAccount;
var currentPageId;

var pendingAccount;
var pendingPageId;

/**
 * This array contains filesystem folders that are deemed inappropriate
 * for use as the local directory pref for message storage.
 * It is global to allow extensions to add to/remove from it if needed.
 * Extentions adding new server types should first consider setting
 * nsIMsgProtocolInfo(of the server type).defaultLocalPath properly
 * so that the test will allow that directory automatically.
 * See the checkLocalDirectoryIsSafe function for description of the members.
 */
var gDangerousLocalStorageDirs = [
  // profile folder
  { dirsvc: "ProfD",    OS: null },
  // GRE install folder
  { dirsvc: "GreD",     OS: null },
  // Application install folder
  { dirsvc: "CurProcD", OS: null },
  // system temporary folder
  { dirsvc: "TmpD",     OS: null },
  // Windows system folder
  { dirsvc: "SysD",     OS: "WINNT" },
  // Windows folder
  { dirsvc: "WinD",     OS: "WINNT" },
  // Program Files folder
  { dirsvc: "ProgF",    OS: "WINNT" },
  // trash folder
  { dirsvc: "Trsh",     OS: "Darwin" },
  // Mac OS system folder
  { dir:    "/System",  OS: "Darwin" },
  // devices folder
  { dir:    "/dev",     OS: "Darwin,Linux" },
  // process info folder
  { dir:    "/proc",    OS: "Linux" },
  // system state folder
  { dir:    "/sys",     OS: "Linux" }
];

// This sets an attribute in a xul element so that we can later
// know what value to substitute in a prefstring.  Different
// preference types set different attributes.  We get the value
// in the same way as the function getAccountValue() determines it.
function updateElementWithKeys(account, element, type) {
  switch (type)
  {
    case "identity":
      element["identitykey"] = account.defaultIdentity.key;
      break;
    case "pop3":
    case "imap":
    case "nntp":
    case "server":
      element["serverkey"] = account.incomingServer.key;
      break;
    case "smtp":
      if (MailServices.smtp.defaultServer)
        element["serverkey"] = MailServices.smtp.defaultServer.key;
      break;
    default:
//      dump("unknown element type! "+type+"\n");
  }
}

function hideShowControls(serverType) {
  let controls = document.querySelectorAll("[hidefor]");
  for (let controlNo = 0; controlNo < controls.length; controlNo++) {
    let control = controls[controlNo];
    let hideFor = control.getAttribute("hidefor");

    // Hide unsupported server types using hideFor="servertype1,servertype2".
    let hide = false;
    let hideForTokens = hideFor.split(",");
    for (let tokenNo = 0; tokenNo < hideForTokens.length; tokenNo++) {
      if (hideForTokens[tokenNo] == serverType) {
        hide = true;
        break;
      }
    }

    if (hide)
      control.setAttribute("hidden", "true");
    else
      control.removeAttribute("hidden");
  }
}

// called when the whole document loads
// perform initialization here
function onLoad() {
  var selectedServer;
  var selectPage = null;

  // Arguments can have two properties: (1) "server," the nsIMsgIncomingServer
  // to select initially and (2) "selectPage," the page for that server to that
  // should be selected.
  if ("arguments" in window && window.arguments[0]) {
    selectedServer = window.arguments[0].server;
    selectPage = window.arguments[0].selectPage;
  }

  accountArray = new Object();
  gGenericAttributeTypes = new Object();

  gAccountTree.load();

  setTimeout(selectServer, 0, selectedServer, selectPage);
}

function onUnload() {
  gAccountTree.unload();
}

function selectServer(server, selectPageId)
{
  let childrenNode = document.getElementById("account-tree-children");

  // Default to showing the first account.
  let accountNode = childrenNode.firstChild;

  // Find the tree-node for the account we want to select
  if (server) {
    for (let i = 0; i < childrenNode.childNodes.length; i++) {
      let account = childrenNode.childNodes[i]._account;
      if (account && server == account.incomingServer) {
        accountNode = childrenNode.childNodes[i];
        // Make sure all the panes of the account to be selected are shown.
        accountNode.setAttribute("open", "true");
        break;
      }
    }
  }

  let pageToSelect = accountNode;

  if (selectPageId) {
    // Find the page that also corresponds to this server.
    // It either is the accountNode itself...
    let pageId = accountNode.getAttribute("PageTag");
    if (pageId != selectPageId) {
      // ... or one of its children.
      pageToSelect = accountNode.querySelector('[PageTag="' + selectPageId + '"]');
    }
  }

  let accountTree = document.getElementById("accounttree");
  let index = accountTree.contentView.getIndexOfItem(pageToSelect);
  accountTree.view.selection.select(index);
  accountTree.treeBoxObject.ensureRowIsVisible(index);

  let lastItem = accountNode.lastChild.lastChild;
  if (lastItem.localName == "treeitem")
    index = accountTree.contentView.getIndexOfItem(lastItem);

  accountTree.treeBoxObject.ensureRowIsVisible(index);
}

function replaceWithDefaultSmtpServer(deletedSmtpServerKey)
{
  // First we replace the smtpserverkey in every identity.
  let am = MailServices.accounts;
  for each (let identity in fixIterator(am.allIdentities,
                                        Components.interfaces.nsIMsgIdentity)) {
    if (identity.smtpServerKey == deletedSmtpServerKey)
      identity.smtpServerKey = "";
  }

  // When accounts have already been loaded in the panel then the first
  // replacement will be overwritten when the accountvalues are written out
  // from the pagedata.  We get the loaded accounts and check to make sure
  // that the account exists for the accountid and that it has a default
  // identity associated with it (to exclude smtpservers and local folders)
  // Then we check only for the identity[type] and smtpServerKey[slot] and
  // replace that with the default smtpserverkey if necessary.

  for (var accountid in accountArray) {
    var account = accountArray[accountid]._account;
    if (account && account.defaultIdentity) {
      var accountValues = accountArray[accountid];
      var smtpServerKey = getAccountValue(account, accountValues, "identity",
                                          "smtpServerKey", null, false);
      if (smtpServerKey == deletedSmtpServerKey)
        setAccountValue(accountValues, "identity", "smtpServerKey", "");
    }
  }
}

/**
 * Called when OK is clicked on the dialog.
 *
 * @param aDoChecks  If true, execute checks on data, otherwise hope they
 *                   were already done elsewhere and proceed directly to saving
 *                   the data.
 */
function onAccept(aDoChecks) {
  if (aDoChecks) {
    // Check if user/host have been modified correctly.
    if (!checkUserServerChanges(true))
      return false;
  }

  if (!onSave())
    return false;

  // hack hack - save the prefs file NOW in case we crash
  Services.prefs.savePrefFile(null);

  if (gRestartNeeded) {
    gRestartNeeded = !Application.restart();
    // returns false so that Account manager is not exited when restart failed
    return !gRestartNeeded;
  }

  return true;
}

/**
 * See if the given path to a directory is usable on the current OS.
 *
 * aLocalPath  the nsIFile of a directory to check.
 */
function checkDirectoryIsValid(aLocalPath) {
  // Any directory selected in the file picker already exists.
  // Any directory specified in prefs.js will be created at start if it does
  // not exist yet.
  // If at the time of entering Account Manager the directory does not exist,
  // it must be invalid in the current OS or not creatable due to permissions.
  // Even then, the backend sometimes tries to create a new one
  // under the current profile.
  if (!aLocalPath.exists() || !aLocalPath.isDirectory())
    return false;

  if (Services.appinfo.OS == "WINNT") {
    // Do not allow some special filenames on Windows.
    // Taken from mozilla/widget/windows/nsDataObj.cpp::MangleTextToValidFilename()
    let dirLeafName = aLocalPath.leafName;
    const kForbiddenNames = [
      "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
      "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
      "CON", "PRN", "AUX", "NUL", "CLOCK$" ];
    if (kForbiddenNames.indexOf(dirLeafName) != -1)
      return false;
  }

  // The directory must be readable and writable to work as a mail store.
  if (!(aLocalPath.isReadable() && aLocalPath.isWritable()))
    return false;

  return true;
}

/**
 * Even if the local path is usable, there are some special folders we do not
 * want to allow for message storage as they cause problems (see e.g. bug 750781).
 *
 * aLocalPath  The nsIFile of a directory to check.
 */
function checkDirectoryIsAllowed(aLocalPath) {
  /**
   * Check if the local path (aLocalPath) is 'safe' i.e. NOT a parent
   * or subdirectory of the given special system/app directory (aDirToCheck).
   *
   * @param aDirToCheck  An object describing the special directory.
   *        The object has the following members:
   *        dirsvc      : A path keyword to retrieve from the Directory service.
   *        dir         : An absolute filesystem path.
   *                      Only one of 'dirsvc' or 'dir' can be specified.
   *        OS          : A string of comma separated values defining on which
   *                      Operating systems the folder is unusable:
   *                       null   = all
   *                       WINNT  = Windows
   *                       Darwin = OS X
   *                       Linux  = Linux
   *        safeSubdirs : An array of directory names that are allowed to be used
   *                      under the tested directory.
   * @param aLocalPath  An nsIFile of the directory to check, intended for message storage.
   */
  function checkLocalDirectoryIsSafe(aDirToCheck, aLocalPath) {
    if (aDirToCheck.OS) {
      if (aDirToCheck.OS.split(",").indexOf(Services.appinfo.OS) == -1)
        return true;
    }

    let testDir = null;
    if ("dirsvc" in aDirToCheck) {
      try {
        testDir = Services.dirsvc.get(aDirToCheck.dirsvc, Components.interfaces.nsIFile);
      } catch (e) {
        Components.utils.reportError("The special folder " + aDirToCheck.dirsvc +
          " cannot be retrieved on this platform: " + e);
      }

      if (!testDir)
        return true;
    }
    else if ("dir" in aDirToCheck) {
      testDir = Components.classes["@mozilla.org/file/local;1"]
                          .createInstance(Components.interfaces.nsIFile);
      testDir.initWithPath(aDirToCheck.dir);
      if (!testDir.exists())
        return true;
    } else {
      Components.utils.reportError("No directory to check?");
      return true;
    }

    testDir.normalize();

    if (testDir.equals(aLocalPath) || aLocalPath.contains(testDir, true))
      return false;

    if (testDir.contains(aLocalPath, true)) {
      if (!("safeSubdirs" in aDirToCheck))
        return false;

      // While the tested directory may not be safe,
      // a subdirectory of some safe subdirectories may be fine.
      let isInSubdir = false;
      for (let subDir of aDirToCheck.safeSubdirs) {
        let checkDir = testDir.clone();
        checkDir.append(subDir);
        if (checkDir.contains(aLocalPath, true)) {
          isInSubdir = true;
          break;
        }
      }
      return isInSubdir;
    }

    return true;
  } // end of checkDirectoryIsNotSpecial

  // If the server type has a nsIMsgProtocolInfo.defaultLocalPath set,
  // allow that directory.
  if (currentAccount.incomingServer) {
    try {
      let defaultPath = currentAccount.incomingServer.protocolInfo.defaultLocalPath;
      if (defaultPath) {
        defaultPath.normalize();
        if (defaultPath.contains(aLocalPath, true))
          return true;
      }
    } catch (e) { /* No problem if this fails. */ }
  }

  for (let tryDir of gDangerousLocalStorageDirs) {
    if (!checkLocalDirectoryIsSafe(tryDir, aLocalPath))
      return false;
  }

  return true;
}

/**
 * Check if the specified directory does meet all the requirements
 * for safe mail storage.
 *
 * aLocalPath  the nsIFile of a directory to check.
 */
function checkDirectoryIsUsable(aLocalPath) {
  const kAlertTitle = document.getElementById("bundle_prefs")
                              .getString("prefPanel-server");
  const originalPath = aLocalPath;

  let invalidPath = false;
  try{
    aLocalPath.normalize();
  } catch (e) { invalidPath = true; }

  if (invalidPath || !checkDirectoryIsValid(aLocalPath)) {
    let alertString = document.getElementById("bundle_prefs")
                              .getFormattedString("localDirectoryInvalid",
                                                  [originalPath.path]);
    Services.prompt.alert(window, kAlertTitle, alertString);
    return false;
  }

  if (!checkDirectoryIsAllowed(aLocalPath)) {
    let alertNotAllowed = document.getElementById("bundle_prefs")
                                  .getFormattedString("localDirectoryNotAllowed",
                                                      [originalPath.path]);
    Services.prompt.alert(window, kAlertTitle, alertNotAllowed);
    return false;
  }

  // Check that no other account has this same or dependent local directory.
  let allServers = MailServices.accounts.allServers;

  for (let server in fixIterator(allServers,
                                 Components.interfaces.nsIMsgIncomingServer))
  {
    if (server.key == currentAccount.incomingServer.key)
      continue;

    let serverPath = server.localPath;
    try {
      serverPath.normalize();
      let alertStringID = null;
      if (serverPath.equals(aLocalPath))
        alertStringID = "directoryAlreadyUsedByOtherAccount";
      else if (serverPath.contains(aLocalPath, true))
        alertStringID = "directoryParentUsedByOtherAccount";
      else if (aLocalPath.contains(serverPath, true))
        alertStringID = "directoryChildUsedByOtherAccount";

      if (alertStringID) {
        let alertString = document.getElementById("bundle_prefs")
                                  .getFormattedString(alertStringID,
                                                      [server.prettyName]);

        Services.prompt.alert(window, kAlertTitle, alertString);
        return false;
      }
    } catch (e) {
      // The other account's path is seriously broken, so we can't compare it.
      Components.utils.reportError("The Local Directory path of the account " +
        server.prettyName + " seems invalid.");
    }
  }

  return true;
}

/**
 * Check if the user and/or host names have been changed and if so check
 * if the new names already exists for an account or are empty.
 * Also check if the Local Directory path was changed.
 *
 * @param showAlert  show and alert if a problem with the host / user name is found
 */
function checkUserServerChanges(showAlert) {
  const prefBundle = document.getElementById("bundle_prefs");
  const alertTitle = prefBundle.getString("prefPanel-server");
  var alertText = null;

  var accountValues = getValueArrayFor(currentAccount);
  if (!accountValues)
    return true;

  var pageElements = getPageFormElements();
  if (!pageElements)
    return true;

  let currentServer = currentAccount ? currentAccount.incomingServer : null;

  // Get the new username, hostname and type from the page
  var newUser, newHost, newType, oldUser, oldHost;
  var uIndx, hIndx;
  for (let i = 0; i < pageElements.length; i++) {
    if (pageElements[i].id) {
      let vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        let type = vals[0];
        let slot = pageElements[i].id.slice(type.length + 1);

        // if this type doesn't exist (just removed) then return.
        if (!(type in accountValues) || !accountValues[type]) return true;

        if (slot == "realHostName") {
          oldHost = accountValues[type][slot];
          newHost = getFormElementValue(pageElements[i]);
          hIndx = i;
        }
        else if (slot == "realUsername") {
          oldUser = accountValues[type][slot];
          newUser = getFormElementValue(pageElements[i]);
          uIndx = i;
        }
        else if (slot == "type")
          newType = getFormElementValue(pageElements[i]);
      }
    }
  }

  var checkUser = true;
  // There is no username needed for e.g. news so reset it.
  if (currentServer && !currentServer.protocolInfo.requiresUsername) {
    oldUser = newUser = "";
    checkUser = false;
  }
  alertText = null;
  // If something is changed then check if the new user/host already exists.
  if ((oldUser != newUser) || (oldHost != newHost)) {
    newUser = newUser.trim();
    newHost = cleanUpHostName(newHost);
    if (checkUser && (newUser == "")) {
      alertText = prefBundle.getString("userNameEmpty");
    }
    else if (!isLegalHostNameOrIP(newHost)) {
      alertText = prefBundle.getString("enterValidServerName");
    }
    else {
      let sameServer = MailServices.accounts
                                   .findRealServer(newUser, newHost, newType, 0);
      if (sameServer && (sameServer != currentServer)) {
        alertText = prefBundle.getString("modifiedAccountExists");
      } else {
        // New hostname passed all checks. We may have cleaned it up so set
        // the new value back into the input element.
        setFormElementValue(pageElements[hIndx], newHost);
      }
    }

    if (alertText) {
      if (showAlert)
        Services.prompt.alert(window, alertTitle, alertText);
      // Restore the old values before return
      if (checkUser)
        setFormElementValue(pageElements[uIndx], oldUser);
      setFormElementValue(pageElements[hIndx], oldHost);
      // If no message is shown to the user, silently revert the values
      // and consider the check a success.
      return !showAlert;
    }

    // If username is changed remind users to change Your Name and Email Address.
    // If server name is changed and has defined filters then remind users
    // to edit rules.
    if (showAlert) {
      let filterList;
      if (currentServer && checkUser) {
        filterList = currentServer.getEditableFilterList(null);
      }
      let changeText = "";
      if ((oldHost != newHost) &&
          (filterList != undefined) && filterList.filterCount)
        changeText = prefBundle.getString("serverNameChanged");
      // In the event that oldHost == newHost or oldUser == newUser,
      // the \n\n will be trimmed off before the message is shown.
      if (oldUser != newUser)
        changeText = changeText + "\n\n" + prefBundle.getString("userNameChanged");

      if (changeText != "")
        Services.prompt.alert(window, alertTitle, changeText.trim());
    }
  }

  // Check the new value of the server.localPath field for validity.
  for (let i = 0; i < pageElements.length; i++) {
    if (pageElements[i].id) {
      if (pageElements[i].id == "server.localPath") {
        if (!checkDirectoryIsUsable(getFormElementValue(pageElements[i])))
          return false;
        break;
      }
    }
  }

  // Warn if the Local directory path was changed.
  // This can be removed once bug 2654 is fixed.
  let oldLocalDir = null;
  let newLocalDir = null;
  let pIndx;
  for (let i = 0; i < pageElements.length; i++) {
    if (pageElements[i].id) {
      if (pageElements[i].id == "server.localPath") {
        oldLocalDir = accountValues["server"]["localPath"]; // both return nsILocalFile
        newLocalDir = getFormElementValue(pageElements[i]);
        pIndx = i;
        break;
      }
    }
  }
  if (oldLocalDir && newLocalDir && (oldLocalDir.path != newLocalDir.path)) {
    let brandName = document.getElementById("bundle_brand").getString("brandShortName");
    alertText = prefBundle.getFormattedString("localDirectoryChanged", [brandName]);

    let cancel = Services.prompt.confirmEx(window, alertTitle, alertText,
      (Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING) +
      (Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_CANCEL),
      prefBundle.getString("localDirectoryRestart"), null, null, null, {});
    if (cancel) {
      setFormElementValue(pageElements[pIndx], oldLocalDir);
      return false;
    }
    gRestartNeeded = true;
  }

  return true;
}

function onSave() {
  if (pendingPageId) {
    dump("ERROR: " + pendingPageId + " hasn't loaded yet! Not saving.\n");
    return false;
  }

  // make sure the current visible page is saved
  savePage(currentAccount);

  for (var accountid in accountArray) {
    var accountValues = accountArray[accountid];
    var account = accountArray[accountid]._account;
    if (!saveAccount(accountValues, account))
      return false;
  }

 return true;
}

function onAddAccount() {
  MsgAccountWizard();
}

function AddMailAccount()
{
  NewMailAccount(MailServices.mailSession.topmostMsgWindow);
}

function AddIMAccount()
{
  window.openDialog("chrome://messenger/content/chat/imAccountWizard.xul",
                    "", "chrome,modal,titlebar,centerscreen");
}

/**
 * Highlight the default server in the account tree,
 * optionally un-highlight the previous one.
 */
function markDefaultServer(newDefault, oldDefault) {
  let accountTreeNodes = document.getElementById("account-tree-children")
                                 .childNodes;
  for (let i = 0; i < accountTreeNodes.length; i++) {
    let accountNode = accountTreeNodes[i];
    if (newDefault == accountNode._account) {
      accountNode.firstChild
                 .firstChild
                 .setAttribute("properties", "isDefaultServer-true");
    }
    if (oldDefault && oldDefault == accountNode._account) {
      accountNode.firstChild
                 .firstChild
                 .removeAttribute("properties");
    }
  }
}

/**
 * Make currentAccount (currently selected in the account tree) the default one.
 */
function onSetDefault(event) {
  // Make sure this function was not called while the control item is disabled
  if (event.target.getAttribute("disabled") == "true")
    return;

  let previousDefault = MailServices.accounts.defaultAccount;
  MailServices.accounts.defaultAccount = currentAccount;
  markDefaultServer(currentAccount, previousDefault);

  // This is only needed on Seamonkey which has this button.
  setEnabled(document.getElementById("setDefaultButton"), false);
}

function onRemoveAccount(event) {
  if (event.target.getAttribute("disabled") == "true" || !currentAccount)
    return;

  let server = currentAccount.incomingServer;
  let prettyName = server.prettyName;

  let canDelete = server.protocolInfo.canDelete || server.canDelete;

  if (!canDelete)
    return;

  let bundle = document.getElementById("bundle_prefs");
  let confirmRemoveAccount = bundle.getFormattedString("confirmRemoveAccount",
                                                       [prettyName]);

  let confirmTitle = bundle.getString("confirmRemoveAccountTitle");

  if (!Services.prompt.confirm(window, confirmTitle, confirmRemoveAccount))
    return;

  let serverList = [];
  let accountTreeNode = document.getElementById("account-tree-children");
  // build the list of servers in the account tree (order is important)
  for (let i = 0; i < accountTreeNode.childNodes.length; i++) {
    if ("_account" in accountTreeNode.childNodes[i]) {
      let curServer = accountTreeNode.childNodes[i]._account.incomingServer;
      if (serverList.indexOf(curServer) == -1)
        serverList.push(curServer);
    }
  }

  // get position of the current server in the server list
  let serverIndex = serverList.indexOf(server);

  // After the current server is deleted, choose the next server/account,
  // or the previous one if the last one was deleted.
  if (serverIndex == serverList.length - 1)
    serverIndex--;
  else
    serverIndex++;

  try {
    let serverId = server.serverURI;
    MailServices.accounts.removeAccount(currentAccount);

    // clear cached data out of the account array
    currentAccount = currentPageId = null;
    if (serverId in accountArray) {
      delete accountArray[serverId];
    }

    if ((serverIndex >= 0) && (serverIndex < serverList.length))
      selectServer(serverList[serverIndex], null);
  }
  catch (ex) {
    Components.utils.reportError("Failure to remove account: " + ex);
    let alertText = bundle.getString("failedRemoveAccount");
    Services.prompt.alert(window, null, alertText);
  }

  // Either the default account was deleted so there is a new one
  // or the default account was not changed. Either way, there is
  // no need to unmark the old one.
  markDefaultServer(MailServices.accounts.defaultAccount, null);
}

function saveAccount(accountValues, account)
{
  var identity = null;
  var server = null;

  if (account) {
    identity = account.defaultIdentity;
    server = account.incomingServer;
  }

  for (var type in accountValues) {
    var typeArray = accountValues[type];

    for (var slot in typeArray) {
      var dest;
      try {
      if (type == "identity")
        dest = identity;
      else if (type == "server")
        dest = server;
      else if (type == "pop3")
        dest = server.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
      else if (type == "imap")
        dest = server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
      else if (type == "none")
        dest = server.QueryInterface(Components.interfaces.nsINoIncomingServer);
      else if (type == "nntp")
        dest = server.QueryInterface(Components.interfaces.nsINntpIncomingServer);
      else if (type == "smtp")
        dest = MailServices.smtp.defaultServer;

      } catch (ex) {
        // don't do anything, just means we don't support that
      }
      if (dest == undefined) continue;

      if ((type in gGenericAttributeTypes) && (slot in gGenericAttributeTypes[type])) {
        var methodName = "get";
        switch (gGenericAttributeTypes[type][slot]) {
          case "int":
            methodName += "Int";
            break;
          case "wstring":
            methodName += "Unichar";
            break;
          case "string":
            methodName += "Char";
            break;
          case "bool":
            // in some cases
            // like for radiogroups of type boolean
            // the value will be "false" instead of false
            // we need to convert it.
            if (typeArray[slot] == "false")
              typeArray[slot] = false;
            else if (typeArray[slot] == "true")
              typeArray[slot] = true;

            methodName += "Bool";
            break;
          default:
            dump("unexpected preftype: " + preftype + "\n");
            break;
        }
        methodName += ((methodName + "Value") in dest ? "Value" : "Attribute");
        if (dest[methodName](slot) != typeArray[slot]) {
          methodName = methodName.replace("get", "set");
          dest[methodName](slot, typeArray[slot]);
        }
      }
      else if (slot in dest && typeArray[slot] != undefined && dest[slot] != typeArray[slot]) {
        try {
          dest[slot] = typeArray[slot];
        } catch (ex) {
          // hrm... need to handle special types here
        }
      }
    }
  }

  // if we made account changes to the spam settings, we'll need to re-initialize
  // our settings object
  if (server && server.spamSettings) {
    try {
      server.spamSettings.initialize(server);
    } catch(e) {
      let accountName = getAccountValue(account, getValueArrayFor(account), "server",
                                        "prettyName", null, false);
      let alertText = document.getElementById("bundle_prefs")
                              .getFormattedString("junkSettingsBroken", [accountName]);
      let review = Services.prompt.confirmEx(window, null, alertText,
        (Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_YES) +
        (Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_NO),
        null, null, null, null, {});
      if (!review) {
        onAccountTreeSelect("am-junk.xul", account);
        return false;
      }
    }
  }

  return true;
}

/**
 * Set enabled/disabled state for account actions buttons.
 * Called by all apps, but if the buttons do not exist, exits early.
 */
function updateButtons(tree, account) {
  let addAccountButton = document.getElementById("addAccountButton");
  let removeButton = document.getElementById("removeButton");
  let setDefaultButton = document.getElementById("setDefaultButton");

  if (!addAccountButton && !removeButton && !setDefaultButton)
    return; // Thunderbird isn't using these.

  updateItems(tree, account, addAccountButton, setDefaultButton, removeButton);
  updateBlockedItems([addAccountButton, setDefaultButton, removeButton], false);
}

/**
 * Set enabled/disabled state for the actions in the Account Actions menu.
 * Called only by Thunderbird.
 */
function initAccountActionsButtons(menupopup) {
  if (!Services.prefs.getBoolPref("mail.chat.enabled"))
    document.getElementById("accountActionsAddIMAccount").hidden = true;

  updateItems(
    document.getElementById("accounttree"),
    getCurrentAccount(),
    document.getElementById("accountActionsAddMailAccount"),
    document.getElementById("accountActionsDropdownSetDefault"),
    document.getElementById("accountActionsDropdownRemove"));

  updateBlockedItems(menupopup.childNodes, true);
}

/**
 * Determine enabled/disabled state for the passed in elements
 * representing account actions.
 */
function updateItems(tree, account, addAccountItem, setDefaultItem, removeItem) {
  // Start with items disabled and then find out what can be enabled.
  let canSetDefault = false;
  let canDelete = false;

  if (account && (tree.view.selection.count >= 1)) {
    // Only try to check properties if there was anything selected in the tree
    // and it belongs to an account.
    // Otherwise we have either selected a SMTP server, or there is some
    // problem. Either way, we don't want the user to act on it.
    let server = account.incomingServer;

    if (account != MailServices.accounts.defaultAccount &&
        server.canBeDefaultServer && account.identities.length > 0)
      canSetDefault = true;

    canDelete = server.protocolInfo.canDelete || server.canDelete;
  }

  setEnabled(addAccountItem, true);
  setEnabled(setDefaultItem, canSetDefault);
  setEnabled(removeItem, canDelete);
}

/**
 * Disable buttons/menu items if their control preference is locked.
 * SeaMonkey: Not currently handled by WSM or the main loop yet
 * since these buttons aren't under the IFRAME.
 *
 * @param aItems  the elements to be checked
 * @param aMustBeTrue  if true then the pref must be boolean and set to true
 *                     to trigger the disabling (TB requires this, SM not)
 */
function updateBlockedItems(aItems, aMustBeTrue) {
  for each (let [, item] in Iterator(aItems)) {
    let prefstring = item.getAttribute("prefstring");
    if (!prefstring)
      continue;

    if (Services.prefs.prefIsLocked(prefstring) &&
        (!aMustBeTrue || Services.prefs.getBoolPref(prefstring)))
      item.setAttribute("disabled", true);
  }
}

/**
 * Set enabled/disabled state for the control.
 */
function setEnabled(control, enabled)
{
  if (!control)
    return;

  if (enabled)
    control.removeAttribute("disabled");
  else
    control.setAttribute("disabled", true);
}

// Called when someone clicks on an account. Figure out context by what they
// clicked on. This is also called when an account is removed. In this case,
// nothing is selected.
function onAccountTreeSelect(pageId, account)
{
  let tree = document.getElementById("accounttree");

  let changeView = pageId && account;
  if (!changeView) {
    if (tree.view.selection.count < 1)
      return false;

    let node = tree.contentView.getItemAtIndex(tree.currentIndex);
    account = ("_account" in node) ? node._account : null;

    pageId = node.getAttribute("PageTag")
  }

  if (pageId == currentPageId && account == currentAccount)
    return true;

  if (document.getElementById("contentFrame").contentDocument.getElementById("server.localPath")) {
    // Check if user/host names have been changed or the Local Directory is invalid.
    if (!checkUserServerChanges(false)) {
      changeView = true;
      account = currentAccount;
      pageId = currentPageId;
    }

    if (gRestartNeeded)
      onAccept(false);
  }

  if (currentPageId) {
    // Change focus to the account tree first so that any 'onchange' handlers
    // on elements in the current page have a chance to run before the page
    // is saved and replaced by the new one.
    tree.focus();
  }

  // save the previous page
  savePage(currentAccount);

  let changeAccount = (account != currentAccount);

  if (changeView)
    selectServer(account.incomingServer, pageId);

  if (pageId != currentPageId) {
    // loading a complete different page

    // prevent overwriting with bad stuff
    currentAccount = currentPageId = null;

    pendingAccount = account;
    pendingPageId = pageId;
    loadPage(pageId);
  } else if (changeAccount) {
    // same page, different server
    restorePage(pageId, account);
  }

  if (changeAccount)
    updateButtons(tree, account);

  return true;
}

// page has loaded
function onPanelLoaded(pageId) {
  if (pageId != pendingPageId) {

    // if we're reloading the current page, we'll assume the
    // page has asked itself to be completely reloaded from
    // the prefs. to do this, clear out the the old entry in
    // the account data, and then restore theh page
    if (pageId == currentPageId) {
      var serverId = currentAccount ?
                     currentAccount.incomingServer.serverURI : "global"
      delete accountArray[serverId];
      restorePage(currentPageId, currentAccount);
    }
  } else {

    restorePage(pendingPageId, pendingAccount);
  }

  // probably unnecessary, but useful for debugging
  pendingAccount = null;
  pendingPageId = null;
}

function pageURL(pageId)
{
  let chromePackageName;
  try {
    // we could compare against "main","server","copies","offline","addressing",
    // "smtp" and "advanced" first to save the work, but don't,
    // as some of these might be turned into extensions (for thunderbird)
    let packageName = pageId.split("am-")[1].split(".xul")[0];
    chromePackageName = MailServices.accounts.getChromePackageName(packageName);
  }
  catch (ex) {
    chromePackageName = "messenger";
  }
  return "chrome://" + chromePackageName + "/content/" + pageId;
}

function loadPage(pageId)
{
  const LOAD_FLAGS_NONE = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE;
  document.getElementById("contentFrame").webNavigation.loadURI(pageURL(pageId),
    LOAD_FLAGS_NONE, null, null, null);
}

// save the values of the widgets to the given server
function savePage(account)
{
  if (!account)
    return;

  // tell the page that it's about to save
  if ("onSave" in top.frames["contentFrame"])
    top.frames["contentFrame"].onSave();

  var accountValues = getValueArrayFor(account);
  if (!accountValues)
    return;

  var pageElements = getPageFormElements();
  if (!pageElements)
    return;

  // store the value in the account
  for (let i = 0; i < pageElements.length; i++) {
    if (pageElements[i].id) {
      let vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        let type = vals[0];
        let slot = pageElements[i].id.slice(type.length + 1);

        setAccountValue(accountValues,
                        type, slot,
                        getFormElementValue(pageElements[i]));
      }
    }
  }
}

function setAccountValue(accountValues, type, slot, value) {
  if (!(type in accountValues))
    accountValues[type] = new Object();

  accountValues[type][slot] = value;
}

function getAccountValue(account, accountValues, type, slot, preftype, isGeneric) {
  if (!(type in accountValues))
    accountValues[type] = new Object();

  // fill in the slot from the account if necessary
  if (!(slot in accountValues[type]) || accountValues[type][slot] == undefined) {
    var server;
    if (account)
      server= account.incomingServer;
    var source = null;
    try {
    if (type == "identity")
      source = account.defaultIdentity;
    else if (type == "server")
      source = account.incomingServer;
    else if (type == "pop3")
      source = server.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
    else if (type == "imap")
      source = server.QueryInterface(Components.interfaces.nsIImapIncomingServer);
    else if (type == "none")
      source = server.QueryInterface(Components.interfaces.nsINoIncomingServer);
    else if (type == "nntp")
      source = server.QueryInterface(Components.interfaces.nsINntpIncomingServer);
    else if (type == "smtp")
      source = MailServices.smtp.defaultServer;
    } catch (ex) {
    }

    if (source) {
      if (isGeneric) {
        if (!(type in gGenericAttributeTypes))
          gGenericAttributeTypes[type] = new Object();

        // we need the preftype later, for setting when we save.
        gGenericAttributeTypes[type][slot] = preftype;
        var methodName = "get";
        switch (preftype) {
          case "int":
            methodName += "Int";
            break;
          case "wstring":
            methodName += "Unichar";
            break;
          case "string":
            methodName += "Char";
            break;
          case "bool":
            methodName += "Bool";
            break;
          default:
            dump("unexpected preftype: " + preftype + "\n");
            break;
        }
        methodName += ((methodName + "Value") in source ? "Value" : "Attribute");
        accountValues[type][slot] = source[methodName](slot);
      }
      else if (slot in source) {
        accountValues[type][slot] = source[slot];
      } else {
        accountValues[type][slot] = null;
      }
    }
    else {
      accountValues[type][slot] = null;
    }
  }
  return accountValues[type][slot];
}

// restore the values of the widgets from the given server
function restorePage(pageId, account)
{
  if (!account)
    return;

  var accountValues = getValueArrayFor(account);
  if (!accountValues)
    return;

  if ("onPreInit" in top.frames["contentFrame"])
    top.frames["contentFrame"].onPreInit(account, accountValues);

  var pageElements = getPageFormElements();
  if (!pageElements)
    return;

  // restore the value from the account
  for (let i = 0; i < pageElements.length; i++) {
    if (pageElements[i].id) {
      let vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        let type = vals[0];
        let slot = pageElements[i].id.slice(type.length + 1);

        // buttons are lockable, but don't have any data so we skip that part.
        // elements that do have data, we get the values at poke them in.
        if (pageElements[i].localName != "button") {
          var value = getAccountValue(account, accountValues, type, slot, pageElements[i].getAttribute("preftype"), (pageElements[i].getAttribute("genericattr") == "true"));
          setFormElementValue(pageElements[i], value);
        }
        var element = pageElements[i];
        switch (type) {
          case "identity":
            element["identitykey"] = account.defaultIdentity.key;
            break;
          case "pop3":
          case "imap":
          case "nntp":
          case "server":
            element["serverkey"] = account.incomingServer.key;
            break;
          case "smtp":
            if (MailServices.smtp.defaultServer)
              element["serverkey"] = MailServices.smtp.defaultServer.key;
            break;
        }
        var isLocked = getAccountValueIsLocked(pageElements[i]);
        setEnabled(pageElements[i], !isLocked);
      }
    }
  }

  // tell the page that new values have been loaded
  if ("onInit" in top.frames["contentFrame"])
    top.frames["contentFrame"].onInit(pageId, account.incomingServer.serverURI);

  // everything has succeeded, vervied by setting currentPageId
  currentPageId = pageId;
  currentAccount = account;
}

// gets the value of a widget
function getFormElementValue(formElement) {
  try {
    var type = formElement.localName;
    if (type=="checkbox") {
      if (formElement.getAttribute("reversed"))
        return !formElement.checked;
      return formElement.checked;
    }
    if (type == "textbox" &&
        formElement.getAttribute("datatype") == "nsILocalFile") {
      if (formElement.value) {
        var localfile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);

        localfile.initWithPath(formElement.value);
        return localfile;
      }
      return null;
    }
    if ((type == "textbox") || ("value" in formElement)) {
      return formElement.value;
    }
    return null;
  }
  catch (ex) {
    dump("getFormElementValue failed, ex="+ex+"\n");
  }
  return null;
}

// sets the value of a widget
function setFormElementValue(formElement, value) {
  var type = formElement.localName;
  if (type == "checkbox") {
    if (value == undefined) {
      if ("defaultChecked" in formElement && formElement.defaultChecked)
        formElement.checked = formElement.defaultChecked;
      else
        formElement.checked = false;
    } else {
      if (formElement.getAttribute("reversed"))
        formElement.checked = !value;
      else
        formElement.checked = value;
    }
  }
  else if (type == "radiogroup" || type =="menulist") {
    if (value == undefined)
      formElement.selectedIndex = 0;
    else
      formElement.value = value;
  }
  // handle nsILocalFile
  else if (type == "textbox" &&
           formElement.getAttribute("datatype") == "nsILocalFile") {
    if (value) {
      var localfile = value.QueryInterface(Components.interfaces.nsILocalFile);
      try {
        formElement.value = localfile.path;
      } catch (ex) {
        dump("Still need to fix uninitialized nsIFile problem!\n");
      }

    } else {
      if ("defaultValue" in formElement)
        formElement.value = formElement.defaultValue;
      else
        formElement.value = "";
    }
  }
  else if (type == "textbox") {
    if (value == null || value == undefined) {
      formElement.value = null;
    } else {
      formElement.value = value;
    }
  }
  else if (type == "label") {
    if (value == null || value == undefined) {
      formElement.value = "";
    } else {
      formElement.value = value;
    }
  }

  // let the form figure out what to do with it
  else {
    if (value == undefined) {
      if ("defaultValue" in formElement && formElement.defaultValue)
        formElement.value = formElement.defaultValue;
    }
    else
      formElement.value = value;
  }
}

//
// conversion routines - get data associated
// with a given pageId, serverId, etc
//

// helper routine for account manager panels to get the current account for the selected server
function getCurrentAccount()
{
  return currentAccount;
}

// get the array of form elements for the given page
function getPageFormElements() {
  if ("getElementsByAttribute" in top.frames["contentFrame"].document)
    return top.frames["contentFrame"].document
              .getElementsByAttribute("wsm_persist", "true");

  return null;
}

// get the value array for the given account
function getValueArrayFor(account) {
  var serverId = account ? account.incomingServer.serverURI : "global";

  if (!(serverId in accountArray)) {
    accountArray[serverId] = new Object();
    accountArray[serverId]._account = account;
  }

  return accountArray[serverId];
}

var gAccountTree = {
  load: function at_load() {
    this._build();

    MailServices.accounts.addIncomingServerListener(this);
  },
  unload: function at_unload() {
    MailServices.accounts.removeIncomingServerListener(this);
  },
  onServerLoaded: function at_onServerLoaded(aServer) {
    this._build();
  },
  onServerUnloaded: function at_onServerUnloaded(aServer) {
    this._build();
  },
  onServerChanged: function at_onServerChanged(aServer) {},

  _rdf: Components.classes["@mozilla.org/rdf/rdf-service;1"]
                  .getService(Components.interfaces.nsIRDFService),
  _rdfDataSource: null,
  _rdfOpenAttribute: null,

  /**
   * Retrieve from localstore.rdf whether the account should be expanded (open)
   * in the account tree.
   *
   * @param aAccountKey  key of the account to check
   */
  _getAccountOpenState: function at_getAccountOpenState(aAccountKey) {
    // The code for this was ported from
    // mozilla/browser/components/nsBrowserGlue.js.
    if (!this._rdfDataSource) {
      this._rdfDataSource = this._rdf.GetDataSource("rdf:local-store");
      this._rdfOpenAttribute = this._rdf.GetResource("open");
    }

    // Retrieve the persisted value from localstore.rdf.
    // It is stored under the URI of the current document and ID of the XUL element.
    let resource = this._rdf.GetResource(document.documentURI + "#" + aAccountKey);
    let target = this._rdfDataSource.GetTarget(resource, this._rdfOpenAttribute, true);
    if (target instanceof Components.interfaces.nsIRDFLiteral)
      return target.Value;

    // If there was no value stored, use opened state.
    return "true";
  },

  _build: function at_build() {
    const Ci = Components.interfaces;
    var bundle = document.getElementById("bundle_prefs");
    function get(aString) { return bundle.getString(aString); }
    var panels = [{string: get("prefPanel-server"), src: "am-server.xul"},
                  {string: get("prefPanel-copies"), src: "am-copies.xul"},
                  {string: get("prefPanel-synchronization"), src: "am-offline.xul"},
                  {string: get("prefPanel-diskspace"), src: "am-offline.xul"},
                  {string: get("prefPanel-addressing"), src: "am-addressing.xul"},
                  {string: get("prefPanel-junk"), src: "am-junk.xul"}];

    let accounts = allAccountsSorted(false);

    let mainTree = document.getElementById("account-tree-children");
    // Clear off all children...
    while (mainTree.firstChild)
      mainTree.removeChild(mainTree.firstChild);

    for each (let account in accounts) {
      let server = account.incomingServer;

      if (server.type == "im" && !Services.prefs.getBoolPref("mail.chat.enabled"))
        continue;

      // Create the top level tree-item
      var treeitem = document.createElement("treeitem");
      mainTree.appendChild(treeitem);
      var treerow = document.createElement("treerow");
      treeitem.appendChild(treerow);
      var treecell = document.createElement("treecell");
      treerow.appendChild(treecell);
      treecell.setAttribute("label", server.rootFolder.prettyName);

      // Now add our panels
      var panelsToKeep = [];
      let idents = MailServices.accounts.getIdentitiesForServer(server);
      if (idents.length) {
        panelsToKeep.push(panels[0]); // The server panel is valid
        panelsToKeep.push(panels[1]); // also the copies panel
        panelsToKeep.push(panels[4]); // and addresssing
      }

      // Everyone except News, RSS and IM has a junk panel
      // XXX: unextensible!
      // The existence of server.spamSettings can't currently be used for this.
      if (server.type != "nntp" && server.type != "rss" && server.type != "im")
        panelsToKeep.push(panels[5]);

      // Check offline/diskspace support level
      var offline = server.offlineSupportLevel;
      var diskspace = server.supportsDiskSpace;
      if (offline >= 10 && diskspace)
        panelsToKeep.push(panels[2]);
      else if (diskspace)
        panelsToKeep.push(panels[3]);

      // extensions
      var catMan = Components.classes["@mozilla.org/categorymanager;1"]
                             .getService(Ci.nsICategoryManager);
      const CATEGORY = "mailnews-accountmanager-extensions";
      var catEnum = catMan.enumerateCategory(CATEGORY);
      while (catEnum.hasMoreElements()) {
        var string = Components.interfaces.nsISupportsCString;
        var entryName = catEnum.getNext().QueryInterface(string).data;
        var svc = Components.classes[catMan.getCategoryEntry(CATEGORY, entryName)]
                            .getService(Ci.nsIMsgAccountManagerExtension);
        if (svc.showPanel(server)) {
          let bundleName = "chrome://" + svc.chromePackageName +
                           "/locale/am-" + svc.name + ".properties";
          let bundle = Services.strings.createBundle(bundleName);
          let title = bundle.GetStringFromName("prefPanel-" + svc.name);
          panelsToKeep.push({string: title, src: "am-" + svc.name + ".xul"});
        }
      }

      if (panelsToKeep.length > 0) {
        var treekids = document.createElement("treechildren");
        treeitem.appendChild(treekids);
        for each (let panel in panelsToKeep) {
          var kidtreeitem = document.createElement("treeitem");
          treekids.appendChild(kidtreeitem);
          var kidtreerow = document.createElement("treerow");
          kidtreeitem.appendChild(kidtreerow);
          var kidtreecell = document.createElement("treecell");
          kidtreerow.appendChild(kidtreecell);
          kidtreecell.setAttribute("label", panel.string);
          kidtreeitem.setAttribute("PageTag", panel.src);
          kidtreeitem._account = account;
        }
        treeitem.setAttribute("container", "true");
        treeitem.id = account.key;
        // Load the 'open' state of the account from localstore.rdf.
        treeitem.setAttribute("open", this._getAccountOpenState(account.key));
        // Let the localstore.rdf automatically save the 'open' state of the
        // account when it is changed.
        treeitem.setAttribute("persist", "open");
      }
      treeitem.setAttribute("PageTag", server ? server.accountManagerChrome
                                              : "am-main.xul");
      treeitem._account = account;
    }

    markDefaultServer(MailServices.accounts.defaultAccount, null);

    // Now add the outgoing server node
    var treeitem = document.createElement("treeitem");
    mainTree.appendChild(treeitem);
    var treerow = document.createElement("treerow");
    treeitem.appendChild(treerow);
    var treecell = document.createElement("treecell");
    treerow.appendChild(treecell);
    treecell.setAttribute("label", bundle.getString("prefPanel-smtp"));
    treeitem.setAttribute("PageTag", "am-smtp.xul");
  }
};
