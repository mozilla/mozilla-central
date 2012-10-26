/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gSmtpServerListWindow =
{
  mBundle: null,
  mServerList: null,
  mAddButton: null,
  mEditButton: null,
  mDeleteButton: null,
  mSetDefaultServerButton: null,

  onLoad: function()
  {
    parent.onPanelLoaded('am-smtp.xul');

    this.mBundle = document.getElementById("bundle_messenger");
    this.mServerList = document.getElementById("smtpList");
    this.mAddButton = document.getElementById("addButton");
    this.mEditButton = document.getElementById("editButton");
    this.mDeleteButton = document.getElementById("deleteButton");
    this.mSetDefaultServerButton = document.getElementById("setDefaultButton");

    this.refreshServerList("", false);
  },

  onSelectionChanged: function(aEvent)
  {
    if (this.mServerList.selectedItems.length <= 0)
      return;

    var server = this.getSelectedServer();
    this.updateButtons(server);
    this.updateServerInfoBox(server);
  },

  onDeleteServer: function (aEvent)
  {
    var server = this.getSelectedServer();
    if (server)
    {
      // confirm deletion
      let cancel = Services.prompt.confirmEx(window,
        this.mBundle.getString('smtpServers-confirmServerDeletionTitle'),
        this.mBundle.getFormattedString('smtpServers-confirmServerDeletion', [server.hostname], 1),
        Services.prompt.STD_YES_NO_BUTTONS, null, null, null, null, { });

      if (!cancel)
      {
        MailServices.smtp.deleteSmtpServer(server);
        parent.replaceWithDefaultSmtpServer(server.key);
        this.refreshServerList("", true);
      }
    }
  },

  onAddServer: function (aEvent)
  {
    this.openServerEditor(null);
  },

  onEditServer: function (aEvent)
  {
    if (this.mServerList.selectedItems.length <= 0)
      return;
    this.openServerEditor(this.getSelectedServer());
  },

  onSetDefaultServer: function(aEvent)
  {
    if (this.mServerList.selectedItems.length <= 0)
      return;

    MailServices.smtp.defaultServer = this.getSelectedServer();
    this.refreshServerList(MailServices.smtp.defaultServer.key, true);
  },

  updateButtons: function(aServer)
  {
    // can't delete default server
    if (MailServices.smtp.defaultServer == aServer)
    {
      this.mSetDefaultServerButton.setAttribute("disabled", "true");
      this.mDeleteButton.setAttribute("disabled", "true");
    }
    else
    {
      this.mSetDefaultServerButton.removeAttribute("disabled");
      this.mDeleteButton.removeAttribute("disabled");
    }
  },

  updateServerInfoBox: function(aServer)
  {
    var noneSelected = this.mBundle.getString("smtpServerList-NotSpecified");

    document.getElementById('nameValue').value = aServer.hostname;
    document.getElementById('descriptionValue').value = aServer.description || noneSelected;
    document.getElementById('portValue').value = aServer.port;
    document.getElementById('userNameValue').value = aServer.username || noneSelected;
    document.getElementById('useSecureConnectionValue').value =
      this.mBundle.getString("smtpServer-ConnectionSecurityType-" +
      aServer.socketType);

    const AuthMethod = Components.interfaces.nsMsgAuthMethod;
    const SocketType = Components.interfaces.nsMsgSocketType;
    var authStr = "";
    switch (aServer.authMethod)
    {
      case AuthMethod.none:
        authStr = "authNo";
        break;
      case AuthMethod.passwordEncrypted:
        authStr = "authPasswordEncrypted";
        break;
      case AuthMethod.GSSAPI:
        authStr = "authKerberos";
        break;
      case AuthMethod.NTLM:
        authStr = "authNTLM";
        break;
      case AuthMethod.secure:
        authStr = "authAnySecure";
        break;
      case AuthMethod.passwordCleartext:
        authStr = (aServer.socketType == SocketType.SSL ||
                   aServer.socketType == SocketType.alwaysSTARTTLS)
                  ? "authPasswordCleartextViaSSL"
                  : "authPasswordCleartextInsecurely";
        break;
      default:
        // leave empty
        Components.utils.reportError("Warning: unknown value for smtpserver... authMethod: " +
          aServer.authMethod);
    }
    if (authStr)
      document.getElementById("authMethodValue").value =
          this.mBundle.getString(authStr);
  },

  refreshServerList: function(aServerKeyToSelect, aFocusList)
  {
    // remove all children
    while (this.mServerList.hasChildNodes())
      this.mServerList.removeChild(this.mServerList.lastChild);

    this.fillSmtpServers(this.mServerList,
                         MailServices.smtp.smtpServers,
                         MailServices.smtp.defaultServer);

    if (aServerKeyToSelect)
      this.setSelectedServer(this.mServerList.getElementsByAttribute("key", aServerKeyToSelect)[0]);
    else // select the default server
      this.setSelectedServer(this.mServerList.getElementsByAttribute("default", "true")[0]);

    if (aFocusList)
      this.mServerList.focus();
  },

  fillSmtpServers: function(aListBox, aServers, aDefaultServer)
  {
    if (!aListBox || !aServers)
      return;

    while (aServers.hasMoreElements())
    {
      var server = aServers.getNext();

      if (server instanceof Components.interfaces.nsISmtpServer)
      {
        var isDefault = (aDefaultServer.key == server.key);

        var listitem = this.createSmtpListItem(server, isDefault);
        aListBox.appendChild(listitem);
      }
    }
  },

  createSmtpListItem: function(aServer, aIsDefault)
  {
    var listitem = document.createElement("listitem");
    var serverName = "";

    if (aServer.description)
      serverName = aServer.description + ' - ';
    else if (aServer.username)
      serverName = aServer.username + ' - ';

    serverName += aServer.hostname;

    if (aIsDefault)
    {
      serverName += " " + this.mBundle.getString("defaultServerTag");
      listitem.setAttribute("default", "true");
    }

    listitem.setAttribute("label", serverName);
    listitem.setAttribute("key", aServer.key);
    listitem.setAttribute("class", "smtpServerListItem");

    // give it some unique id
    listitem.id = "smtpServer." + aServer.key;
    return listitem;
  },

  openServerEditor: function(aServer)
  {
    var args = {server: aServer,
                result: false,
                addSmtpServer: ""};

    window.openDialog("chrome://messenger/content/SmtpServerEdit.xul",
                      "smtpEdit", "chrome,titlebar,modal,centerscreen", args);

    // now re-select the server which was just added
    if (args.result)
      this.refreshServerList(aServer ? aServer.key : args.addSmtpServer, true);

    return args.result;
  },

  setSelectedServer: function(aServer)
  {
    setTimeout(function(aServerList) {
      aServerList.ensureElementIsVisible(aServer);
      aServerList.selectItem(aServer);
    }, 0, this.mServerList);
  },

  getSelectedServer: function()
  {
    var serverKey = this.mServerList.selectedItems[0].getAttribute("key");
    return MailServices.smtp.getServerByKey(serverKey);
  }
};
