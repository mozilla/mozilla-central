/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

// be real hacky with document.getElementById until document.controls works
// with the new XUL widgets

var gSmtpUsername;
var gSmtpDescription;
var gSmtpUsernameLabel;
var gSmtpHostname;
var gSmtpPort;
var gSmtpAuthMethod;
var gSmtpSocketType;
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

    if (MailServices.smtp.defaultServer)
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
    let allPrefElements = {
      hostname:     gSmtpHostname,
      description:  gSmtpDescription,
      port:         gSmtpPort,
      authMethod:   gSmtpAuthMethod,
      try_ssl:      gSmtpSocketType
    };
    disableIfLocked(allPrefElements);
  } catch (e) { // non-fatal
    Components.utils.reportError("Error while getting locked prefs: " + e);
  }
}

/**
 * Does the work of disabling an element given the array which contains xul id/prefstring pairs.
 *
 * @param prefstrArray  array of XUL elements to check
 *
 * TODO: try to merge this with disableIfLocked function in am-offline.js (bug 755885)
 */
function disableIfLocked(prefstrArray)
{
  let finalPrefString = "mail.smtpserver." +
    MailServices.smtp.defaultServer.key + ".";
  let smtpPrefBranch = Services.prefs.getBranch(finalPrefString);

  for (let prefstring in prefstrArray)
    if (smtpPrefBranch.prefIsLocked(prefstring))
      prefstrArray[prefstring].disabled = true;
}

function saveSmtpSettings(server)
{
    //dump("Saving to " + server + "\n");
    if (server) {
        server.hostname = cleanUpHostName(gSmtpHostname.value);
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
 * @param userAction  false for dialog initialization,
 *                    true for user action.
 */
function sslChanged(userAction)
{
  const DEFAULT_SMTP_PORT = "587";
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
