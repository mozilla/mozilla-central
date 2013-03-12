/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/hostnameUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

let gSmtpServer;

function onLoad(event)
{
  gSmtpServer = window.arguments[0].server;
  initSmtpSettings(gSmtpServer);
}

function onAccept()
{
  if (!isLegalHostNameOrIP(cleanUpHostName(gSmtpHostname.value))) {
    let prefsBundle = document.getElementById("bundle_prefs");
    let brandBundle = document.getElementById("bundle_brand");
    let alertTitle = brandBundle.getString("brandShortName");
    let alertMsg = prefsBundle.getString("enterValidServerName");
    Services.prompt.alert(window, alertTitle, alertMsg);

    window.arguments[0].result = false;
    return false;
  }

  // If we didn't have an SMTP server to initialize with,
  // we must be creating one.
  try {
    if (!gSmtpServer) {
      gSmtpServer = MailServices.smtp.createServer();
      window.arguments[0].addSmtpServer = gSmtpServer.key;
    }

    saveSmtpSettings(gSmtpServer);
  } catch (ex) {
    Components.utils.reportError("Error saving smtp server: " + ex);
  }

  window.arguments[0].result = true;
  return true;
}
