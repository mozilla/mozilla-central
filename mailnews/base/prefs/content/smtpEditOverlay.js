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
 * The Original Code is Mozilla Communicator client code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
 *   Henrik Gemal <mozilla@gemal.dk>
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

// be real hacky with document.getElementById until document.controls works
// with the new XUL widgets

var gSmtpUsername;
var gSmtpDescription;
var gSmtpUsernameLabel;
var gSmtpHostname;
var gSmtpPort;
var gSmtpAuthMethod;
var gSmtpSocketType;
var gSmtpPrefBranch;
var gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
var gSmtpService = Components.classes["@mozilla.org/messengercompose/smtp;1"].getService(Components.interfaces.nsISmtpService);
var gPort;
var gDefaultPort;
const Ci = Components.interfaces;

function initSmtpSettings(server) {
    gSmtpUsername = document.getElementById("smtp.username");
    gSmtpDescription = document.getElementById("smtp.description");
    gSmtpUsernameLabel = document.getElementById("smtp.username.label");
    gSmtpHostname = document.getElementById("smtp.hostname");
    gSmtpPort = document.getElementById("smtp.port");
    gSmtpAuthMethod = document.getElementById("smtp.authMethod");
    gSmtpSocketType = document.getElementById("smtp.socketType");
    gDefaultPort = document.getElementById("smtp.defaultPort");
    gPort = document.getElementById("smtp.port");

    if (server) {
        gSmtpHostname.value = server.hostname;
        gSmtpDescription.value = server.description;
        gSmtpPort.value = server.port ? server.port : "";
        gSmtpUsername.value = server.username;
        gSmtpAuthMethod.value = server.authMethod;
        gSmtpSocketType.value = (server.socketType < 4) ? server.socketType : 1;
    } else {
        // When does that happen? TODO Get default prefs, if realistic, otherwise remove
        gSmtpAuthMethod.value = 3; // cleartext
        gSmtpSocketType.value = 0;
    }

    sslChanged(false);
    authMethodChanged(false);

    if (gSmtpService.defaultServer)
      onLockPreference();

    setLabelFromStringBundle("authMethod-no", "authNo");
    setLabelFromStringBundle("authMethod-kerberos", "authKerberos");
    setLabelFromStringBundle("authMethod-ntlm", "authNTLM");
    setLabelFromStringBundle("authMethod-anysecure", "authAnySecure");
    setLabelFromStringBundle("authMethod-any", "authAny");
    setLabelFromStringBundle("authMethod-password-encrypted",
        "authPasswordEncrypted");
    //authMethod-password-cleartext already set in sslChanged()

    // Hide deprecated/hidden auth options, unless selected
    hideUnlessSelected(document.getElementById("authMethod-anysecure"));
    hideUnlessSelected(document.getElementById("authMethod-any"));

    // "STARTTLS, if available" is vulnerable to MITM attacks so we shouldn't
    // allow users to choose it anymore. Hide the option unless the user already
    // has it set.
    hideUnlessSelected(document.getElementById("connectionSecurityType-1"));
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

// Disables xul elements that have associated preferences locked.
function onLockPreference()
{
  try {
    var finalPrefString = "mail.smtpserver." +
        gSmtpService.defaultServer.key + ".";

    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);

    var allPrefElements = {
      hostname:     gSmtpHostname,
      description:  gSmtpDescription,
      port:         gSmtpPort,
      authMethod:   gSmtpAuthMethod,
      try_ssl:      gSmtpSocketType
    };

    gSmtpPrefBranch = prefService.getBranch(finalPrefString);
    disableIfLocked( allPrefElements );
  } catch (e) { dump("error while locking prefs: " + e + "\n"); } // non-fatal
} 

// Does the work of disabling an element given the array which contains xul id/prefstring pairs.
// Also saves the id/locked state in an array so that other areas of the code can avoid
// stomping on the disabled state indiscriminately.
function disableIfLocked( prefstrArray )
{
  for (var prefstring in prefstrArray)
    if (gSmtpPrefBranch.prefIsLocked(prefstring))
      prefstrArray[prefstring].disabled = true;
}

function saveSmtpSettings(server)
{
    //dump("Saving to " + server + "\n");
    if (server) {
        server.hostname = gSmtpHostname.value;
        server.description = gSmtpDescription.value;
        server.port = gSmtpPort.value;
        server.authMethod = gSmtpAuthMethod.value;
        server.username = gSmtpUsername.value;
        server.socketType = gSmtpSocketType.value;
    }
}

function authMethodChanged(userAction)
{
  var noUsername = gSmtpAuthMethod.value == Ci.nsMsgAuthMethod.none;
  gSmtpUsername.disabled = noUsername;
  gSmtpUsernameLabel.disabled = noUsername;
}

/**
 * Resets the default port to SMTP or SMTPS, dependending on
 * the |gSmtpSocketType| value, and sets the port to use to this default,
 * if that's appropriate.
 *
 * @param userAction false for dialog initialization,
 *                   true for user action.
 */
function sslChanged(userAction)
{
  const DEFAULT_SMTP_PORT = "25";
  const DEFAULT_SMTPS_PORT = "465";
  var socketType = gSmtpSocketType.value;
  var otherDefaultPort;
  var prevDefaultPort = gDefaultPort.value;

  if (socketType == Ci.nsMsgSocketType.SSL) {
    gDefaultPort.value = DEFAULT_SMTPS_PORT;
    otherDefaultPort = DEFAULT_SMTP_PORT;
  } else {
    gDefaultPort.value = DEFAULT_SMTP_PORT;
    otherDefaultPort = DEFAULT_SMTPS_PORT;
  }

  // If the port is not set,
  // or the user is causing the default port to change,
  //   and the port is set to the default for the other protocol,
  // then set the port to the default for the new protocol.
  if ((gPort.value == "") ||
      (userAction && (gDefaultPort.value != prevDefaultPort) &&
       (gPort.value == otherDefaultPort)))
    gPort.value = gDefaultPort.value;

  // switch "insecure password" label
  setLabelFromStringBundle("authMethod-password-cleartext",
      socketType == Ci.nsMsgSocketType.SSL ||
      socketType == Ci.nsMsgSocketType.alwaysSTARTTLS ?
      "authPasswordCleartextViaSSL" : "authPasswordCleartextInsecurely");
}
