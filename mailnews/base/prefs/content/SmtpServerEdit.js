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
  if (hostnameIsIllegal(gSmtpHostname.value)) {
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
      gSmtpServer = MailServices.smtp.createSmtpServer();
      window.arguments[0].addSmtpServer = gSmtpServer.key;
    }

    saveSmtpSettings(gSmtpServer);
  } catch (ex) {
    Components.utils.reportError("Error saving smtp server: " + ex);
  }

  window.arguments[0].result = true;
  return true;
}
