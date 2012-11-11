/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/hostnameUtils.jsm");

var gOnMailServersPage;
var gOnNewsServerPage;
var gHideIncoming;
var gProtocolInfo = null;

function incomingPageValidate()
{
  var canAdvance = true;

  if (gOnMailServersPage) {
    let incomingServerName = document.getElementById("incomingServer").value;
    if (!gHideIncoming && !isLegalHostNameOrIP(cleanUpHostname(incomingServerName)))
      canAdvance = false;
  }
  if (gOnNewsServerPage) {
    let newsServerName = document.getElementById("newsServer").value;
    if (!isLegalHostNameOrIP(cleanUpHostname(newsServerName)))
      canAdvance = false;
  }

  if (canAdvance) {
    var pageData = parent.GetPageData();
    var serverType = parent.getCurrentServerType(pageData);
    var hostName;
    if (gOnMailServersPage)
      hostName = incomingServerName;
    else if (gOnNewsServerPage)
      hostName = newsServerName;

    var username = document.getElementById("username").value;
    if (gProtocolInfo && gProtocolInfo.requiresUsername && !username ||
        parent.AccountExists(username, hostName, serverType))
      canAdvance = false;
  }

  document.documentElement.canAdvance = canAdvance;
}

function incomingPageUnload()
{
  var pageData = parent.GetPageData();

  if (gOnMailServersPage) {
    // If we have hidden the incoming server dialogs, we don't want
    // to set the server to an empty value here
    if (!gHideIncoming) {
      var incomingServerName = document.getElementById("incomingServer");
      setPageData(pageData, "server", "hostname", cleanUpHostname(incomingServerName.value));
    }
    var serverport = document.getElementById("serverPort").value;
    setPageData(pageData, "server", "port", serverport);
    var username = document.getElementById("username").value;
    setPageData(pageData, "login", "username", username);
  }
  else if (gOnNewsServerPage) {
    var newsServerName = document.getElementById("newsServer");
    setPageData(pageData, "newsserver", "hostname", cleanUpHostname(newsServerName.value));
  }

  return true;
}

function incomingPageInit() {
  gOnMailServersPage = (document.documentElement.currentPage.id == "incomingpage");
  gOnNewsServerPage = (document.documentElement.currentPage.id == "newsserver");
  if (gOnNewsServerPage)
  {
    var newsServer = document.getElementById("newsServer");
    var pageData = parent.GetPageData();
    try
    {
      newsServer.value = pageData.newsserver.hostname.value;
    }
    catch (ex){}
  }
    
  gHideIncoming = false;
  if (gCurrentAccountData && gCurrentAccountData.wizardHideIncoming)
    gHideIncoming = true;
  
  var incomingServerbox = document.getElementById("incomingServerbox");
  var serverTypeBox = document.getElementById("serverTypeBox");
  if (incomingServerbox && serverTypeBox) {
    if (gHideIncoming) {
      incomingServerbox.setAttribute("hidden", "true");
      serverTypeBox.setAttribute("hidden", "true");
    }
    else {
      incomingServerbox.removeAttribute("hidden");
      serverTypeBox.removeAttribute("hidden");
    }
  }
  
  // Server type selection (pop3 or imap) is for mail accounts only
  var pageData = parent.GetPageData();
  var isMailAccount = pageData.accounttype.mailaccount.value;
  var isOtherAccount = pageData.accounttype.otheraccount.value;
  if (isMailAccount && !gHideIncoming) {
    var serverTypeRadioGroup = document.getElementById("servertype");
    /* 
     * Check to see if the radiogroup has any value. If there is no
     * value, this must be the first time user visting this page in the
     * account setup process. So, the default is set to pop3. If there 
     * is a value (it's used automatically), user has already visited 
     * page and server type selection is done. Once user visits the page, 
     * the server type value from then on will persist (whether the selection 
     * came from the default or the user action).
     */
    if (!serverTypeRadioGroup.value) {
      /*
       * if server type was set to imap in isp data, then
       * we preset the server type radio group accordingly,
       * otherwise, use pop3 as the default.
       */
      var serverTypeRadioItem = document.getElementById(pageData.server &&
           pageData.server.servertype && pageData.server.servertype.value == "imap" ?
               "imap" : "pop3");
      serverTypeRadioGroup.selectedItem = serverTypeRadioItem;      // Set pop3 server type as default selection
    }
    var leaveMessages = document.getElementById("leaveMessagesOnServer");
    var deferStorage = document.getElementById("deferStorage");
    setServerType();
    setServerPrefs(leaveMessages);
    setServerPrefs(deferStorage);
  }
  else if (isOtherAccount) {
    document.getElementById("deferStorageBox").hidden = true;
  }

  if (pageData.server && pageData.server.hostname) {
    var incomingServerTextBox = document.getElementById("incomingServer");
    if (incomingServerTextBox && incomingServerTextBox.value == "")
      incomingServerTextBox.value = pageData.server.hostname.value;
  }

  var type = parent.getCurrentServerType(pageData);
  gProtocolInfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + type]
                            .getService(Components.interfaces.nsIMsgProtocolInfo);
  var loginNameInput = document.getElementById("username");

  if (loginNameInput.value == "") {
    // retrieve data from previously entered pages
    var type = parent.getCurrentServerType(pageData);

    gProtocolInfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + type]
                              .getService(Components.interfaces.nsIMsgProtocolInfo);

    if (gProtocolInfo.requiresUsername) {
      // since we require a username, use the uid from the email address
      loginNameInput.value = parent.getUsernameFromEmail(pageData.identity.email.value, gCurrentAccountData &&
                                                         gCurrentAccountData.incomingServerUserNameRequiresDomain);
    }
  }
  incomingPageValidate();
}
 
function setServerType()
{
  var pageData = parent.GetPageData();
  var serverType = document.getElementById("servertype").value;
  var deferStorageBox = document.getElementById("deferStorageBox");
  var leaveMessages = document.getElementById("leaveMsgsOnSrvrBox");
  var port = serverType == "pop3" ? 110 : 143;

  document.getElementById("serverPort").value = port;
  document.getElementById("defaultPortValue").value = port;

  deferStorageBox.hidden = serverType == "imap";
  leaveMessages.hidden = serverType == "imap";
  setPageData(pageData, "server", "servertype", serverType);
  setPageData(pageData, "server", "port", port);
  incomingPageValidate();
}

function setServerPrefs(aThis)
{
  setPageData(parent.GetPageData(), "server", aThis.id, aThis.checked);
}
