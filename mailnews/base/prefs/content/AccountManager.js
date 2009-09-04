/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joey Minta <jminta@gmail.com>
 *   Joshua Cranmer <Pidgeot18@gmail.com>
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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

var gSmtpHostNameIsIllegal = false;

// This is a hash-map for every account we've touched in the pane. Each entry
// has additional maps of attribute-value pairs that we're going to want to save
// when the user hits OK.
var accountArray;
var gGenericAttributeTypes;

var currentAccount;
var currentPageId;

var pendingAccount;
var pendingPageId;

// services used
var smtpService;
var nsPrefBranch;

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
      if (smtpService.defaultServer)
        element["serverkey"] = smtpService.defaultServer.key;
      break;
    default:
//      dump("unknown element type! "+type+"\n");
  }
}

function hideShowControls(serverType) {
  var controls = document.getElementsByAttribute("hidefor", "*");
  for (var controlNo = 0; controlNo < controls.length; controlNo++) {
    var control = controls[controlNo];
    var hideFor = control.getAttribute("hidefor");

    // Hide unsupported server types using hideFor="servertype1,servertype2".
    var hide = false;
    var hideForTokens = hideFor.split(",");
    for (var tokenNo = 0; tokenNo < hideForTokens.length; tokenNo++) {
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

  smtpService =
    Components.classes["@mozilla.org/messengercompose/smtp;1"].getService(Components.interfaces.nsISmtpService);

  gAccountTree.load();

  setTimeout(selectServer, 0, selectedServer, selectPage);
}

function onUnload() {
  gAccountTree.unload();
}

function selectServer(server, selectPage)
{
  var accountNode;

  // Find the tree-node for the account we want to select
  if (!server) {
    // Just get the first account
    accountNode = document.getElementById("account-tree-children").firstChild;
  } else {
    var childrenNode = document.getElementById("account-tree-children");
    for (var i = 0; i < childrenNode.childNodes.length; i++) {
      if (server == childrenNode.childNodes[i]._account.incomingServer) {
        accountNode = childrenNode.childNodes[i];
        break;
      }
    }
  }

  var pageToSelect = accountNode;
  if (selectPage) {
    // Find the page that also corresponds to this server
    var pages = accountNode.getElementsByAttribute("PageTag", selectPage);
    pageToSelect = pages[0];
  }

  var accountTree = document.getElementById("accounttree");
  var index = accountTree.contentView.getIndexOfItem(pageToSelect);
  accountTree.view.selection.select(index);
  accountTree.treeBoxObject.ensureRowIsVisible(index);

  var lastItem = accountNode.lastChild.lastChild;
  if (lastItem.localName == "treeitem")
    index = accountTree.contentView.getIndexOfItem(lastItem);

  accountTree.treeBoxObject.ensureRowIsVisible(index);
}

function replaceWithDefaultSmtpServer(deletedSmtpServerKey)
{
  //First we replace the smtpserverkey in every identity
  const Ci = Components.interfaces;
  var am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                     .getService(Ci.nsIMsgAccountManager);
  for each (var identity in fixIterator(am.allIdentities, Ci.nsIMsgIdentity)) {
    if (identity.smtpServerKey == deletedSmtpServerKey)
      identity.smtpServerKey = smtpService.defaultServer.key;
  }

  //When accounts have already been loaded in the panel then the first replacement will be 
  //overwritten when the accountvalues are written out from the pagedata.
  //we get the loaded accounts and check to make sure that the account exists for the accountid
  //and that it has a default identity associated with it (to exclude smtpservers and local folders)
  //Then we check only for the identity[type] and smtpServerKey[slot]
  //and replace that with the default smtpserverkey if necessary.

  for (var accountid in accountArray) {
    var account = accountArray[accountid]._account;
    if(account && account.defaultIdentity) {
      var accountValues = accountArray[accountid];
      if (accountValues['identity']['smtpServerKey'] == deletedSmtpServerKey)
        setAccountValue(accountValues,'identity', 'smtpServerKey', smtpService.defaultServer.key);
    }
  }
}

function onAccept() {
  // Check if user/host have been modified.
  if (!checkUserServerChanges(true))
    return false;

  if (gSmtpHostNameIsIllegal) {
    gSmtpHostNameIsIllegal = false;
    return false;
  }

  onSave();
  // hack hack - save the prefs file NOW in case we crash
  Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .savePrefFile(null);
  return true;
}

// Check if the user and/or host names have been changed and
// if so check if the new names already exists for an account.
function checkUserServerChanges(showAlert) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  if (smtpService.defaultServer) {
    try {
      var smtpHostName = top.frames["contentFrame"].document.getElementById("smtp.hostname");
      if (smtpHostName && hostnameIsIllegal(smtpHostName.value)) {
        var alertTitle = document.getElementById("bundle_brand")
                                 .getString("brandShortName");
        var alertMsg = document.getElementById("bundle_prefs")
                               .getString("enterValidHostname");

        Cc["@mozilla.org/embedcomp/prompt-service;1"]
          .getService(Ci.nsIPromptService).alert(window, alertTitle, alertMsg);
        gSmtpHostNameIsIllegal = true;
      }
    }
    catch (ex) {}
  }

  var accountValues = getValueArrayFor(currentAccount);
  if (!accountValues) 
    return true;
  var pageElements = getPageFormElements();

  if (pageElements == null) return true;

  // Get the new username, hostname and type from the page
  var newUser, newHost, newType, oldUser, oldHost;
  var uIndx, hIndx;
  for (var i=0; i<pageElements.length; i++) {
    if (pageElements[i].id) {
      var vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        var type = vals[0];
        var slot = vals[1];

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

  // There is no username defined for news so reset it.
  if (newType == "nntp")
    oldUser = newUser = "";


  // If something is changed then check if the new user/host already exists.
  if ( (oldUser != newUser) || (oldHost != newHost) ) {
    var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    var newServer = accountManager.findRealServer(newUser, newHost, newType, 0);
    if (newServer) {
      if (showAlert) {
        var alertText = document.getElementById("bundle_prefs")
                                .getString("modifiedAccountExists");
        Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService)
                  .alert(window, null, alertText);

      }
      // Restore the old values before return
      if (newType != "nntp")
        setFormElementValue(pageElements[uIndx], oldUser);
      setFormElementValue(pageElements[hIndx], oldHost);
      return false;
    }

    // If username is changed remind users to change Your Name and Email Address.
    // If serve name is changed and has defined filters then remind users to edit rules.
    if (showAlert) {
      var account = currentAccount
      var filterList;
      if (account && (newType != "nntp")) {
        var server = account.incomingServer;
        filterList = server.getEditableFilterList(null);
      }
      var userChangeText, serverChangeText;
      var bundle = document.getElementById("bundle_prefs");
      if ( (oldHost != newHost) && (filterList != undefined) && filterList.filterCount )
        serverChangeText = bundle.getString("serverNameChanged");
      if (oldUser != newUser)
        userChangeText = bundle.getString("userNameChanged");

      if ( (serverChangeText != undefined) && (userChangeText != undefined) )
        serverChangeText = serverChangeText + "\n\n" + userChangeText;
      else
        if (userChangeText != undefined)
          serverChangeText = userChangeText;

      if (serverChangeText != undefined) {
        var promptService =
          Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Components.interfaces.nsIPromptService);
        promptService.alert(window, null, serverChangeText);
      }
    }
  }
  return true;
}

function onSave() {
  if (pendingPageId) {
    dump("ERROR: " + pendingPageId + " hasn't loaded yet! Not saving.\n");
    return;
  }

  // make sure the current visible page is saved
  savePage(currentAccount);

  for (var accountid in accountArray) {
    var accountValues = accountArray[accountid];
    var account = accountArray[accountid]._account;
    saveAccount(accountValues, account);
  }
}

function onAddAccount() {
  MsgAccountWizard();
}

function ReloadSmtpPanel()
{
  var smtpUsername = top.frames["contentFrame"].document.getElementById("smtp.username");
  var smtpHostname = top.frames["contentFrame"].document.getElementById("smtp.hostname");
  var smtpPort = top.frames["contentFrame"].document.getElementById("smtp.port");
  var smtpUseUsername = top.frames["contentFrame"].document.getElementById("smtp.useUsername");
  var smtpAuthMethod = top.frames["contentFrame"].document.getElementById("smtp.authMethod");
  var smtpTrySSL = top.frames["contentFrame"].document.getElementById("smtp.trySSL");

  var defaultServer = smtpService.defaultServer;

  smtpUsername.value = defaultServer.username;
  smtpHostname.value = defaultServer.hostname;
  smtpPort.value = defaultServer.port ? defaultServer.port : "";
  smtpAuthMethod.setAttribute("value", defaultServer.authMethod);
  if (smtpAuthMethod.getAttribute("value") == "1")
    smtpUseUsername.checked = true;
  var elements = smtpTrySSL.getElementsByAttribute("value", defaultServer.trySSL);
  if (!elements.item(0))
    elements = smtpTrySSL.getElementsByAttribute("value", "1");
  smtpTrySSL.selectedItem = elements[0];
}

function onSetDefault(event) {
  if (event.target.getAttribute("disabled") == "true") return;

  Components.classes["@mozilla.org/messenger/account-manager;1"]
            .getService(Components.interfaces.nsIMsgAccountManager)
            .defaultAccount = currentAccount;
  setEnabled(document.getElementById("setDefaultButton"), false);
}

function onRemoveAccount(event) {
  if (event.target.getAttribute("disabled") == "true") return;

  var account = currentAccount;

  var server = account.incomingServer;
  var type = server.type;
  var prettyName = server.prettyName;

  var protocolinfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + type].getService(Components.interfaces.nsIMsgProtocolInfo);
  var canDelete = protocolinfo.canDelete;
  if (!canDelete) {
    canDelete = server.canDelete;
  }
  if (!canDelete) 
    return;

  var bundle = document.getElementById("bundle_prefs");
  var confirmRemoveAccount =
    bundle.getFormattedString("confirmRemoveAccount", [prettyName]);

  var confirmTitle = bundle.getString("confirmRemoveAccountTitle");

  var promptService =
    Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Components.interfaces.nsIPromptService);
  if (!promptService.confirm(window, confirmTitle, confirmRemoveAccount))
    return;

  try {
    // clear cached data out of the account array
    currentAccount = currentPageId = null;

    var serverId = server.serverURI;
    Components.classes["@mozilla.org/messenger/account-manager;1"]
              .getService(Components.interfaces.nsIMsgAccountManager)
              .removeAccount(account);

    if (serverId in accountArray) {
      delete accountArray[serverId];
    }
    selectServer(null, null);
  }
  catch (ex) {
    dump("failure to remove account: " + ex + "\n");
    var alertText = bundle.getString("failedRemoveAccount");
    Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Components.interfaces.nsIPromptService)
              .alert(window, null, alertText);;
  }
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
        dest = smtpService.defaultServer;

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
      else {
      if (slot in dest && typeArray[slot] != undefined && dest[slot] != typeArray[slot]) {
        try {
          dest[slot] = typeArray[slot];
          } 
          catch (ex) {
          // hrm... need to handle special types here
        }
      }
    }
  }
 }
 
 // if we made account changes to the spam settings, we'll need to re-initialize
 // our settings object
 if (server && server.spamSettings)
   server.spamSettings.initialize(server);
}

function updateButtons(tree, account) {
  var canCreate = true;
  var canDuplicate = true;
  var canDelete = true;
  var canSetDefault = true;

  if (account) {
    var server = account.incomingServer;
    var type = server.type;

    var am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                       .getService(Components.interfaces.nsIMsgAccountManager);
    if (account == am.defaultAccount || !server.canBeDefaultServer ||
        account.identities.Count() < 1)
      canSetDefault = false;

    var protocolinfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + type].getService(Components.interfaces.nsIMsgProtocolInfo);
    canDuplicate = protocolinfo.canDuplicate;
    canDelete = protocolinfo.canDelete;
    if (!canDelete) {
      canDelete = server.canDelete;
    }
  }
  else {
    // HACK
    // if account is null, we have either selected a SMTP server, or there is a problem
    // either way, we don't want the user to be able to delete it or duplicate it

    canSetDefault = false;
    canDelete = false;
    canDuplicate = false;
  }

  if (tree.view.selection.count < 1)
    canDuplicate = canSetDefault = canDelete = false;

  // check for disabled preferences on the account buttons.  
  //  Not currently handled by WSM or the main loop yet since these buttons aren't
  //  under the IFRAME
  var addAccountButton = document.getElementById("addAccountButton");
  var removeButton = document.getElementById("removeButton");
  var setDefaultButton = document.getElementById("setDefaultButton");

  var prefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefBranch);
  if (prefBranch.prefIsLocked(addAccountButton.getAttribute("prefstring")))
    canCreate = false;
  if (prefBranch.prefIsLocked(setDefaultButton.getAttribute("prefstring")))
    canSetDefault = false;
  if (prefBranch.prefIsLocked(removeButton.getAttribute("prefstring")))
    canDelete = false;

  setEnabled(addAccountButton, canCreate);
  setEnabled(document.getElementById("duplicateButton"), canDuplicate);
  setEnabled(setDefaultButton, canSetDefault);
  setEnabled(removeButton, canDelete);
}

function setEnabled(control, enabled)
{
  if (!control) return;
  if (enabled)
    control.removeAttribute("disabled");
  else
    control.setAttribute("disabled", true);
}

// Called when someone clicks on an account. Figure out context by what they
// clicked on. This is also called when an account is removed. In this case,
// nothing is selected.
function onAccountTreeSelect()
{
  var tree = document.getElementById("accounttree");

  if (tree.view.selection.count < 1)
    return null;
  var node = tree.contentView.getItemAtIndex(tree.currentIndex);
  var account = node._account;
  var pageId = node.getAttribute('PageTag')

  if (pageId == currentPageId && account == currentAccount)
    return;

  // check if user/host names have been changed
  checkUserServerChanges(false);

  if (gSmtpHostNameIsIllegal) {
    gSmtpHostNameIsIllegal = false;
    selectServer(currentAccount, currentPageId);
    return;
  }

  // save the previous page
  savePage(currentAccount);

  var changeAccount = (account != currentAccount);
  // loading a complete different page
  if (pageId != currentPageId) {

    // prevent overwriting with bad stuff
    currentAccount = currentPageId = null;

    pendingAccount = account;
    pendingPageId=pageId;
    loadPage(pageId);
  }

  // same page, different server
  else if (changeAccount) {
    restorePage(pageId, account);
  }

  if (changeAccount)
    updateButtons(tree, account);
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

function loadPage(pageId)
{
  var chromePackageName;
  try 
  {
    // we could compare against "main","server","copies","offline","addressing",
    // "smtp" and "advanced" first to save the work, but don't,
    // as some of these might be turned into extensions (for thunderbird)
    var am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                       .getService(Components.interfaces.nsIMsgAccountManager);
    var package = pageId.split("am-")[1].split(".xul")[0];
    chromePackageName = am.getChromePackageName(package);
  }
  catch (ex) 
  {
    chromePackageName = "messenger";
  }
  const LOAD_FLAGS_NONE = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE;
  document.getElementById("contentFrame").webNavigation.loadURI("chrome://" + chromePackageName + "/content/" + pageId, LOAD_FLAGS_NONE, null, null, null);
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
  for (var i=0; i<pageElements.length; i++) {
    if (pageElements[i].id) {
      var vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        var type = vals[0];
        var slot = vals[1];

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
      source = smtpService.defaultServer;
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

  var pageElements = getPageFormElements();
  if (!pageElements) 
    return;

  if ("onPreInit" in top.frames["contentFrame"])
    top.frames["contentFrame"].onPreInit(account, accountValues);

  // restore the value from the account
  for (var i=0; i<pageElements.length; i++) {
    if (pageElements[i].id) {
      var vals = pageElements[i].id.split(".");
      if (vals.length >= 2) {
        var type = vals[0];
        var slot = vals[1];
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
            if (smtpService.defaultServer)
              element["serverkey"] = smtpService.defaultServer.key;
            break;
        }
        var isLocked = getAccountValueIsLocked(pageElements[i]);
        setEnabled(pageElements[i],!isLocked);
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
    if (type == "text") {
      var val = formElement.getAttribute("value");
      if (val) return val;
      return null;
    }
    if ("value" in formElement) {
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

  //formElement.value = formElement.defaultValue;
  //  formElement.checked = formElement.defaultChecked;
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

    var selectedItem;
    if (value == undefined) {
      if (type == "radiogroup")
        selectedItem = formElement.firstChild;
      else
        selectedItem = formElement.firstChild.firstChild;
    }
    else
      selectedItem = formElement.getElementsByAttribute("value", value)[0];

    formElement.selectedItem = selectedItem;
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

  else if (type == "text") {
    if (value == null || value == undefined)
      formElement.removeAttribute("value");
    else
      formElement.setAttribute("value",value);
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
  if("getElementsByAttribute" in top.frames["contentFrame"].document)
    return top.frames["contentFrame"].document
              .getElementsByAttribute("wsm_persist", "true");
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

    var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
    mgr.addIncomingServerListener(this);
  },
  unload: function at_unload() {
    var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
    mgr.removeIncomingServerListener(this);
  },
  onServerLoaded: function at_onServerLoaded(aServer) {
    this._build();
  },
  onServerUnloaded: function at_onServerUnloaded(aServer) {
    this._build();
  },
  onServerChanged: function at_onServerChanged(aServer) {},

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

    // Get our account list, and add the proper items
    var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);

    var accounts = [a for each (a in fixIterator(mgr.accounts, Ci.nsIMsgAccount))];
    // Stupid bug 41133 hack. Grr...
    accounts = accounts.filter(function fix(a) { return a.incomingServer; });

    function sortAccounts(a, b) {
      if (a.key == mgr.defaultAccount.key)
        return -1;
      if (b.key == mgr.defaultAccount.key)
        return 1;
      var aIsNews = a.incomingServer.type == "nntp";
      var bIsNews = b.incomingServer.type == "nntp";
      if (aIsNews && !bIsNews)
        return 1;
      if (bIsNews && !aIsNews)
        return -1;

      var aIsLocal = a.incomingServer.type == "none";
      var bIsLocal = b.incomingServer.type == "none";
      if (aIsLocal && !bIsLocal)
        return 1;
      if (bIsLocal && !aIsLocal)
        return -1;
      return 0;
    }
    accounts.sort(sortAccounts);

    var mainTree = document.getElementById("account-tree-children");
    // Clear off all children...
    while (mainTree.firstChild)
      mainTree.removeChild(mainTree.firstChild);

    for each (var account in accounts) {
      let server = account.incomingServer;
      // Create the top level tree-item
      var treeitem = document.createElement("treeitem");
      mainTree.appendChild(treeitem);
      var treerow = document.createElement("treerow");
      treeitem.appendChild(treerow);
      var treecell = document.createElement("treecell");
      treerow.appendChild(treecell);
      treecell.setAttribute("label", server.rootFolder.prettyName);

      // Now add our panels
      var treekids = document.createElement("treechildren");
      treeitem.appendChild(treekids);

      var panelsToKeep = [];
      var idents = mgr.GetIdentitiesForServer(server);
      if (idents.Count()) {
        panelsToKeep.push(panels[0]); // The server panel is valid
        panelsToKeep.push(panels[1]); // also the copies panel
        panelsToKeep.push(panels[4]); // and addresssing
      }

      // Everyone except news and RSS has a junk panel
      // XXX: unextensible!
      if (server.type != "nntp" && server.type != "rss")
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
        if (svc.showPanel(server))
{
          var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                              .getService(Ci.nsIStringBundleService);

          let bundleName = "chrome://" + svc.chromePackageName +
                           "/locale/am-" + svc.name + ".properties";
          let bundle = sbs.createBundle(bundleName);
          let title = bundle.GetStringFromName("prefPanel-" + svc.name);
          panelsToKeep.push({string: title, src: "am-" + svc.name + ".xul"});
  }
}

      for each (panel in panelsToKeep) {
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

      treeitem.setAttribute("PageTag", server ? server.accountManagerChrome
                                              : "am-main.xul");
      treeitem._account = account;
      treeitem.setAttribute("container", "true");
      treeitem.setAttribute("open", "true");
    }

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
