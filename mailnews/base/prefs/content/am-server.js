/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var gServer;

function onInit(aPageId, aServerId) 
{
  initServerType();

  onCheckItem("server.biffMinutes", ["server.doBiff"]);
  onCheckItem("nntp.maxArticles", ["nntp.notifyOn"]);
  setupMailOnServerUI();
  setupFixedUI();
  if (document.getElementById("server.type").getAttribute("value") == "imap")
    setupImapDeleteUI(aServerId);

  // "STARTTLS, if available" is vulnerable to MITM attacks so we shouldn't
  // allow users to choose it anymore. Hide the option unless the user already
  // has it set.
  hideUnlessSelected(document.getElementById("connectionSecurityType-1"));
}

function onPreInit(account, accountValues)
{
  var type = parent.getAccountValue(account, accountValues, "server", "type", null, false);
  hideShowControls(type);

  Services.obs.notifyObservers(null, "charsetmenu-selected", "other");

  gServer = account.incomingServer;

  if(!account.incomingServer.canEmptyTrashOnExit)
  {
    document.getElementById("server.emptyTrashOnExit").setAttribute("hidden", "true");
    document.getElementById("imap.deleteModel.box").setAttribute("hidden", "true");
  }
}

function initServerType()
{
  var serverType = document.getElementById("server.type").getAttribute("value");
  var propertyName = "serverType-" + serverType;

  var messengerBundle = document.getElementById("bundle_messenger");
  var verboseName = messengerBundle.getString(propertyName);
  setDivText("servertype.verbose", verboseName);

  secureSelect(true);

  setLabelFromStringBundle("authMethod-no", "authNo");
  setLabelFromStringBundle("authMethod-old", "authOld");
  setLabelFromStringBundle("authMethod-kerberos", "authKerberos");
  setLabelFromStringBundle("authMethod-external", "authExternal");
  setLabelFromStringBundle("authMethod-ntlm", "authNTLM");
  setLabelFromStringBundle("authMethod-anysecure", "authAnySecure");
  setLabelFromStringBundle("authMethod-any", "authAny");
  setLabelFromStringBundle("authMethod-password-encrypted",
      "authPasswordEncrypted");
  //authMethod-password-cleartext already set in selectSelect()

  // Hide deprecated/hidden auth options, unless selected
  hideUnlessSelected(document.getElementById("authMethod-no"));
  hideUnlessSelected(document.getElementById("authMethod-old"));
  hideUnlessSelected(document.getElementById("authMethod-anysecure"));
  hideUnlessSelected(document.getElementById("authMethod-any"));
}

function hideUnlessSelected(element)
{
  element.hidden = !element.selected;
}

function setLabelFromStringBundle(elementID, stringName)
{
  document.getElementById(elementID).label =
      document.getElementById("bundle_messenger").getString(stringName);
}

function setDivText(divname, value) 
{
  var div = document.getElementById(divname);
  if (!div) 
    return;
  div.setAttribute("value", value);
}


function onAdvanced()
{
  // Store the server type and, if an IMAP or POP3 server,
  // the settings needed for the IMAP/POP3 tab into the array
  var serverSettings = {};
  var serverType = document.getElementById("server.type").getAttribute("value");
  serverSettings.serverType = serverType;

  serverSettings.serverPrettyName = gServer.prettyName;
  serverSettings.account = top.getCurrentAccount();

  if (serverType == "imap")
  {
    serverSettings.dualUseFolders = document.getElementById("imap.dualUseFolders").checked;
    serverSettings.usingSubscription = document.getElementById("imap.usingSubscription").checked;
    serverSettings.useIdle = document.getElementById("imap.useIdle").checked;
    serverSettings.maximumConnectionsNumber = document.getElementById("imap.maximumConnectionsNumber").getAttribute("value");
    // string prefs
    serverSettings.personalNamespace = document.getElementById("imap.personalNamespace").getAttribute("value");
    serverSettings.publicNamespace = document.getElementById("imap.publicNamespace").getAttribute("value");
    serverSettings.serverDirectory = document.getElementById("imap.serverDirectory").getAttribute("value");
    serverSettings.otherUsersNamespace = document.getElementById("imap.otherUsersNamespace").getAttribute("value");
    serverSettings.overrideNamespaces = document.getElementById("imap.overrideNamespaces").checked;
  }
  else if (serverType == "pop3")
  {
    serverSettings.deferGetNewMail = document.getElementById("pop3.deferGetNewMail").checked;
    serverSettings.deferredToAccount = document.getElementById("pop3.deferredToAccount").getAttribute("value");
  }

  window.openDialog("chrome://messenger/content/am-server-advanced.xul",
                    "_blank", "chrome,modal,titlebar", serverSettings);

  if (serverType == "imap")
  {
    document.getElementById("imap.dualUseFolders").checked = serverSettings.dualUseFolders;
    document.getElementById("imap.usingSubscription").checked = serverSettings.usingSubscription;
    document.getElementById("imap.useIdle").checked = serverSettings.useIdle;
    document.getElementById("imap.maximumConnectionsNumber").setAttribute("value", serverSettings.maximumConnectionsNumber);
    // string prefs
    document.getElementById("imap.personalNamespace").setAttribute("value", serverSettings.personalNamespace);
    document.getElementById("imap.publicNamespace").setAttribute("value", serverSettings.publicNamespace);
    document.getElementById("imap.serverDirectory").setAttribute("value", serverSettings.serverDirectory);
    document.getElementById("imap.otherUsersNamespace").setAttribute("value", serverSettings.otherUsersNamespace);
    document.getElementById("imap.overrideNamespaces").checked = serverSettings.overrideNamespaces;
  }
  else if (serverType == "pop3")
  {
    document.getElementById("pop3.deferGetNewMail").checked = serverSettings.deferGetNewMail;
    document.getElementById("pop3.deferredToAccount").setAttribute("value", serverSettings.deferredToAccount);
    let pop3Server = gServer.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
    // we're explicitly setting this so we'll go through the SetDeferredToAccount method
    pop3Server.deferredToAccount = serverSettings.deferredToAccount;
    // Setting the server to be deferred causes a rebuild of the account tree,
    // losing the current selection. Reselect the current server again as it
    // didn't really disappear.
    parent.selectServer(parent.getCurrentAccount().incomingServer, parent.currentPageId);

    // Iterate over all accounts to see if any of their junk targets are now
    // invalid (pointed to the account that is now deferred).
    // If any such target is found it is reset to a new safe folder
    // (the deferred to account or Local Folders). If junk was really moved
    // to that folder (moveOnSpam = true) then moving junk is disabled
    // (so that the user notices it and checks the settings).
    // This is the same sanitization as in am-junk.js, just applied to all POP accounts.
    let deferredURI = serverSettings.deferredToAccount &&
                      MailServices.accounts.getAccount(serverSettings.deferredToAccount)
                                           .incomingServer.serverURI;

    for each (let account in fixIterator(MailServices.accounts.accounts,
                                         Components.interfaces.nsIMsgAccount)) {
      let accountValues = parent.getValueArrayFor(account);
      let type = parent.getAccountValue(account, accountValues, "server", "type",
                                        null, false);
      // Try to keep this list of account types not having Junk settings
      // synchronized with the list in AccountManager.js.
      if (type != "nntp" && type != "rss" && type != "im") {
        let spamActionTargetAccount = parent.getAccountValue(account, accountValues,
          "server", "spamActionTargetAccount", "string", true);
        let spamActionTargetFolder =  parent.getAccountValue(account, accountValues,
          "server", "spamActionTargetFolder", "string", true);
        let moveOnSpam = parent.getAccountValue(account, accountValues,
          "server", "moveOnSpam", "bool", true);

        // Check if there are any invalid junk targets and fix them.
        [ spamActionTargetAccount, spamActionTargetFolder, moveOnSpam ] =
          sanitizeJunkTargets(spamActionTargetAccount,
                              spamActionTargetFolder,
                              deferredURI || account.incomingServer.serverURI,
                              parent.getAccountValue(account, accountValues, "server", "moveTargetMode", "int", true),
                              account.incomingServer.spamSettings,
                              moveOnSpam);

        parent.setAccountValue(accountValues, "server", "moveOnSpam", moveOnSpam);
        parent.setAccountValue(accountValues, "server", "spamActionTargetAccount",
                               spamActionTargetAccount);
        parent.setAccountValue(accountValues, "server", "spamActionTargetFolder",
                               spamActionTargetFolder);
      }
    }
  }
}

function secureSelect(aLoading)
{
    var socketType = document.getElementById("server.socketType").value;
    var serverType = document.getElementById("server.type").value;
    var defaultPort = gServer.protocolInfo.getDefaultServerPort(false);
    var defaultPortSecure = gServer.protocolInfo.getDefaultServerPort(true);
    var port = document.getElementById("server.port");
    var portDefault = document.getElementById("defaultPort");
    var prevDefaultPort = portDefault.value;

    const Ci = Components.interfaces;
    if (socketType == Ci.nsMsgSocketType.SSL) {
      portDefault.value = defaultPortSecure;
      if (port.value == "" || (!aLoading && port.value == defaultPort && prevDefaultPort != portDefault.value))
        port.value = defaultPortSecure;
    } else {
        portDefault.value = defaultPort;
        if (port.value == "" || (!aLoading && port.value == defaultPortSecure && prevDefaultPort != portDefault.value))
          port.value = defaultPort;
    }

    // switch "insecure password" label
    setLabelFromStringBundle("authMethod-password-cleartext",
        socketType == Ci.nsMsgSocketType.SSL ||
        socketType == Ci.nsMsgSocketType.alwaysSTARTTLS ?
        "authPasswordCleartextViaSSL" : "authPasswordCleartextInsecurely");
}

function setupMailOnServerUI()
{
  onCheckItem("pop3.deleteMailLeftOnServer", ["pop3.leaveMessagesOnServer"]);
  setupAgeMsgOnServerUI();
}

function setupAgeMsgOnServerUI()
{
  const kLeaveMsgsId = "pop3.leaveMessagesOnServer";
  const kDeleteByAgeId = "pop3.deleteByAgeFromServer";
  onCheckItem(kDeleteByAgeId, [kLeaveMsgsId]);
  onCheckItem("daysEnd", [kLeaveMsgsId]);
  onCheckItem("pop3.numDaysToLeaveOnServer", [kLeaveMsgsId, kDeleteByAgeId]);
}

function setupFixedUI()
{
  var controls = [document.getElementById("fixedServerName"), 
                  document.getElementById("fixedUserName"),
                  document.getElementById("fixedServerPort")];

  var len = controls.length;  
  for (var i=0; i<len; i++) {
    var fixedElement = controls[i];
    var otherElement = document.getElementById(fixedElement.getAttribute("use"));

    fixedElement.setAttribute("collapsed", "true");
    otherElement.removeAttribute("collapsed");
  }
}

function BrowseForNewsrc()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  const nsILocalFile = Components.interfaces.nsILocalFile;

  var newsrcTextBox = document.getElementById("nntp.newsrcFilePath");
  var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
  fp.init(window, 
          document.getElementById("browseForNewsrc").getAttribute("filepickertitle"),
          nsIFilePicker.modeSave);

  var currentNewsrcFile;
  try {
    currentNewsrcFile = Components.classes["@mozilla.org/file/local;1"]
                                  .createInstance(nsILocalFile);
    currentNewsrcFile.initWithPath(newsrcTextBox.value);
  } catch (e) {
    dump("Failed to create nsILocalFile instance for the current newsrc file.\n");
  }

  if (currentNewsrcFile) {
    fp.displayDirectory = currentNewsrcFile.parent;
    fp.defaultString = currentNewsrcFile.leafName;
  }

  fp.appendFilters(nsIFilePicker.filterAll);

  if (fp.show() != nsIFilePicker.returnCancel)
    newsrcTextBox.value = fp.file.path;
}

function setupImapDeleteUI(aServerId)
{
  // read delete_model preference
  var deleteModel = document.getElementById("imap.deleteModel").getAttribute("value");
  selectImapDeleteModel(deleteModel);

  // read trash_folder_name preference
  var trashFolderName = getTrashFolderName();

  // set folderPicker menulist
  var trashPopup = document.getElementById("msgTrashFolderPopup");
  trashPopup._teardown();
  trashPopup._parentFolder = MailUtils.getFolderForURI(aServerId);
  trashPopup._ensureInitialized();

  // TODO: There is something wrong here, selectFolder() fails even if the
  // folder does exist. Try to fix in bug 802609.
  let trashFolder = MailUtils.getFolderForURI(aServerId + "/" + trashFolderName, false);
  try {
    trashPopup.selectFolder(trashFolder);
  } catch(ex) {
    trashPopup.parentNode.setAttribute("label", trashFolder.prettyName);
  }
  trashPopup.parentNode.folder = trashFolder;
}

function selectImapDeleteModel(choice)
{
  // set deleteModel to selected mode
  document.getElementById("imap.deleteModel").setAttribute("value", choice);

  switch (choice)
  {
    case "0" : // markDeleted
      // disable folderPicker
      document.getElementById("msgTrashFolderPicker").setAttribute("disabled", "true");
      break;  
    case "1" : // moveToTrashFolder
      // enable folderPicker
      document.getElementById("msgTrashFolderPicker").removeAttribute("disabled");
      break;
    case "2" : // deleteImmediately
      // disable folderPicker
      document.getElementById("msgTrashFolderPicker").setAttribute("disabled", "true");
      break;
    default :
      dump("Error in enabling/disabling server.TrashFolderPicker\n");
      break;
  }
}

// Capture any menulist changes from folderPicker
function folderPickerChange(aEvent)
{
  var folder = aEvent.target._folder;
  var folderPath = getFolderPathFromRoot(folder);

  // Set the value to be persisted.
  document.getElementById("imap.trashFolderName")
          .setAttribute("value", folderPath);

  // Update the widget to show/do correct things even for subfolders.
  var trashFolderPicker = document.getElementById("msgTrashFolderPicker");
  trashFolderPicker.setAttribute("label", folder.prettyName);
}

/** Generate the relative folder path from the root. */
function getFolderPathFromRoot(folder)
{
  var path = folder.name;
  var parentFolder = folder.parent;
  while (parentFolder && parentFolder != folder.rootFolder) {
    path = parentFolder.name + "/" + path;
    parentFolder = parentFolder.parent;
  }
  // IMAP Inbox URI's start with INBOX, not Inbox.
  return path.replace(/^Inbox/, "INBOX");
}

// Get trash_folder_name from prefs
function getTrashFolderName()
{
  var trashFolderName = document.getElementById("imap.trashFolderName").getAttribute("value");
  // if the preference hasn't been set, set it to a sane default
  if (!trashFolderName) {
    trashFolderName = "Trash";
    document.getElementById("imap.trashFolderName").setAttribute("value",trashFolderName);
  }
  return trashFolderName;
}
