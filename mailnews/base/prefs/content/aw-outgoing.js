/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/hostnameUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gProtocolInfo = null;
var gPrefsBundle;

function outgoingPageValidate() {
  let canAdvance = true;

  let smtpServer = document.getElementById("smtphostname").value;
  let usingDefaultSMTP = document.getElementById("noSmtp").hidden;
  if (!usingDefaultSMTP && !isLegalHostNameOrIP(cleanUpHostName(smtpServer)))
    canAdvance = false;

  document.documentElement.canAdvance = canAdvance;
}

function outgoingPageUnload() {
  var pageData = parent.GetPageData();
  var username = document.getElementById("username").value;
  let smtpserver = document.getElementById("smtphostname").value;
  setPageData(pageData, "server", "smtphostname", cleanUpHostName(smtpserver));

  // If SMTP username box is blank it is because the
  // incoming and outgoing server names were the same,
  // so set to be same as incoming username
  var smtpusername = document.getElementById("smtpusername").value || username;

  setPageData(pageData, "login", "smtpusername", smtpusername);

  return true;
}

function outgoingPageInit() {
    gPrefsBundle = document.getElementById("bundle_prefs");
    var pageData = parent.GetPageData();

    var smtpServer = null;
    var smtpCreateNewServer = gCurrentAccountData && gCurrentAccountData.smtpCreateNewServer;

    // Don't use the default smtp server if smtp server creation was explicitly
    // requested in isp rdf.
    // If we're reusing the default smtp we should not set the smtp hostname.
    if (MailServices.smtp.defaultServer && !smtpCreateNewServer) {
      smtpServer = MailServices.smtp.defaultServer;
      setPageData(pageData, "identity", "smtpServerKey", "");
    }

    var noSmtpBox = document.getElementById("noSmtp");
    var haveSmtpBox = document.getElementById("haveSmtp");

    var boxToHide;
    var boxToShow;

    if (pageData.server && pageData.server.smtphostname && smtpCreateNewServer) {
      var smtpTextBox = document.getElementById("smtphostname");
      if (smtpTextBox && smtpTextBox.value == "")
        smtpTextBox.value = pageData.server.smtphostname.value;
    }

    if (smtpServer && smtpServer.hostname) {
      // we have a hostname, so modify and show the static text and
      // store the value of the default smtp server in the textbox.
      modifyStaticText(smtpServer.hostname, "1")
      boxToShow = haveSmtpBox;
      boxToHide = noSmtpBox;
    }
    else {
      // no default hostname yet
      boxToShow = noSmtpBox;
      boxToHide = haveSmtpBox;
    }

    if (boxToHide)
      boxToHide.setAttribute("hidden", "true");

    if (boxToShow)
      boxToShow.removeAttribute("hidden");

    var smtpNameInput = document.getElementById("smtpusername");
    let smtpServer = MailServices.smtp.defaultServer;
    if (smtpServer && smtpServer.hostname && smtpServer.username) {
      // we have a default SMTP server, so modify and show the static text
      // and store the username for the default server in the textbox.
      modifyStaticText(smtpServer.username, "2")
      hideShowLoginSettings(2, 1, 3);
      smtpNameInput.value = smtpServer.username;
    }
    else {
      // no default SMTP server yet, so need to compare
      // incoming and outgoing server names
      var smtpServerName = pageData.server.smtphostname.value;
      var incomingServerName = pageData.server.hostname.value;
      if (smtpServerName == incomingServerName) {
        // incoming and outgoing server names are the same, so show
        // the static text and make sure textbox blank for later tests.
        modifyStaticText(smtpServerName, "3")
        hideShowLoginSettings(3, 1, 2);
        smtpNameInput.value = "";
      }
      else {
        // incoming and outgoing server names are different, so set smtp
        // username's textbox to be the same as incoming's one, unless already set.
        hideShowLoginSettings(1, 2, 3);
        smtpNameInput.value = smtpNameInput.value || loginNameInput.value;
      }
    }
    outgoingPageValidate();
}

function modifyStaticText(smtpMod, smtpBox)
{
  // modify the value in the smtp display if we already have a
  // smtp server so that the single string displays the hostname
  // or username for the smtp server.
  var smtpStatic = document.getElementById("smtpStaticText"+smtpBox);
  if (smtpStatic && smtpStatic.hasChildNodes())
    smtpStatic.childNodes[0].nodeValue = smtpStatic.getAttribute("prefix") +
                                         smtpMod + smtpStatic.getAttribute("suffix");
}

function hideShowLoginSettings(aEle, bEle, cEle)
{
    document.getElementById("loginSet" + aEle).hidden = false;
    document.getElementById("loginSet" + bEle).hidden = true;
    document.getElementById("loginSet" + cEle).hidden = true;
}

var savedPassword="";

function onSavePassword(target) {
    dump("savePassword changed! (" + target.checked + ")\n");
    var passwordField = document.getElementById("server.password");
    if (!passwordField) return;
    
    if (target.checked) {
        passwordField.removeAttribute("disabled");
        passwordField.value = savedPassword;
    }
    else {
        passwordField.setAttribute("disabled", "true");
        savedPassword = passwordField.value;
        passwordField.value = "";
    }
    
}
