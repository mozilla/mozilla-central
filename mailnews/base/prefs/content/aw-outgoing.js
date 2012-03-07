/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *   Seth Spitzer <sspitzer@netscape.com>
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

var gProtocolInfo = null;
var gPrefsBundle;

function outgoingPageValidate() {
  var canAdvance = true;

  var smtpserver = document.getElementById("smtphostname").value;
  var usingDefaultSMTP = document.getElementById("noSmtp").hidden;
  if (!usingDefaultSMTP && hostnameIsIllegal(smtpserver))
    canAdvance = false;

  document.documentElement.canAdvance = canAdvance;
}

function outgoingPageUnload() {
  var pageData = parent.GetPageData();
  var username = document.getElementById("username").value;
  var smtpserver = document.getElementById("smtphostname");
  setPageData(pageData, "server", "smtphostname", trim(smtpserver.value));

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
    if (parent.smtpService.defaultServer && !smtpCreateNewServer) {
      smtpServer = parent.smtpService.defaultServer;
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
    var smtpServer = parent.smtpService.defaultServer;
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
