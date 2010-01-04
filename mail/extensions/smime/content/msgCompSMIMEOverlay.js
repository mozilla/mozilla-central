/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   ddrinan@netscape.com
 *   Scott MacGregor <mscott@netscape.com>
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gNextSecurityButtonCommand = "";
var gBundle;
var gBrandBundle;
var gSMFields;
var gEncryptedURIService = null;

var gEncryptOptionChanged;
var gSignOptionChanged;

function onComposerClose()
{
  gSMFields = null;
  setNoEncryptionUI();
  setNoSignatureUI();

  if (!gMsgCompose || !gMsgCompose.compFields)
    return;

  gMsgCompose.compFields.securityInfo = null;
}

function onComposerReOpen()
{
  // Are we already set up ? Or are the required fields missing ?
  if (gSMFields || !gMsgCompose || !gMsgCompose.compFields)
    return;

  gMsgCompose.compFields.securityInfo = null;

  gSMFields = Components.classes["@mozilla.org/messenger-smime/composefields;1"]
                        .createInstance(Components.interfaces.nsIMsgSMIMECompFields);
  if (gSMFields)
  {
    gMsgCompose.compFields.securityInfo = gSMFields;
    // set up the intial security state....
    var encryptionPolicy = gCurrentIdentity.getIntAttribute("encryptionpolicy");
    // 0 == never, 1 == if possible, 2 == always Encrypt.
    gSMFields.requireEncryptMessage = encryptionPolicy == 2;

    gSMFields.signMessage = gCurrentIdentity.getBoolAttribute("sign_mail");

    if (gEncryptedURIService && !gSMFields.requireEncryptMessage)
    {
      if (gEncryptedURIService.isEncrypted(gMsgCompose.originalMsgURI))
      {
        // Override encryption setting if original is known as encrypted.
        gSMFields.requireEncryptMessage = true;
      }
    }

    if (gSMFields.requireEncryptMessage)
      setEncryptionUI();
    else
      setNoEncryptionUI();

    if (gSMFields.signMessage)
      setSignatureUI();
    else
      setNoSignatureUI();
  }
}

addEventListener("load", smimeComposeOnLoad, false);

// this function gets called multiple times,
// but only on first open, not on composer recycling
function smimeComposeOnLoad()
{
  removeEventListener("load", smimeComposeOnLoad, false);

  if (!gEncryptedURIService)
    gEncryptedURIService = 
      Components.classes["@mozilla.org/messenger-smime/smime-encrypted-uris-service;1"]
      .getService(Components.interfaces.nsIEncryptedSMIMEURIsService);

  onComposerReOpen();

  top.controllers.appendController(SecurityController);

  addEventListener("compose-from-changed", onComposerFromChanged, true);
  addEventListener("compose-send-message", onComposerSendMessage, true);
  addEventListener("compose-window-close", onComposerClose, true);
  addEventListener("compose-window-reopen", onComposerReOpen, true);

  addEventListener("unload", smimeComposeOnUnload, false);
}

function smimeComposeOnUnload()
{
  removeEventListener("unload", smimeComposeOnUnload, false);

  removeEventListener("compose-from-changed", onComposerFromChanged, true);
  removeEventListener("compose-send-message", onComposerSendMessage, true);
  removeEventListener("compose-window-close", onComposerClose, true);
  removeEventListener("compose-window-reopen", onComposerReOpen, true);

  top.controllers.removeController(SecurityController);
}

function setupBundles()
{
  if (gBundle)
    return;

  gBundle = document.getElementById("bundle_comp_smime");
  gBrandBundle = document.getElementById("bundle_brand");
}

// stub routine to make our call to MsgAccountManager work correctly
function GetSelectedFolderURI()
{
  return;
}

function GetServer(uri)
{
  var servers = gAccountManager.GetServersForIdentity(gCurrentIdentity);
  return servers.QueryElementAt(0, Components.interfaces.nsIMsgIncomingServer);
}

function showNeedSetupInfo()
{
  var ifps = Components.interfaces.nsIPromptService;

  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(ifps);
  setupBundles();

  if (promptService && gBundle && gBrandBundle) {
    var dummy = new Object;
    var buttonPressed =
    promptService.confirmEx(window,
      gBrandBundle.getString("brandShortName"),
      gBundle.getString("NeedSetup"), 
      ifps.STD_YES_NO_BUTTONS,
      0,
      0,
      0,
      null,
      dummy);
    
    if (0 == buttonPressed) {
      MsgAccountManager('am-smime.xul');
    }
  }
}

function toggleEncryptMessage()
{
  if (!gSMFields)
    return;

  // toggle
  gSMFields.requireEncryptMessage = !gSMFields.requireEncryptMessage;

  if (gSMFields.requireEncryptMessage)
  {
    // Make sure we have a cert.
    var encryptionCertName = gCurrentIdentity.getUnicharAttribute("encryption_cert_name");
    if (!encryptionCertName)
    {
      gSMFields.requireEncryptMessage = false;
      showNeedSetupInfo();
      return;
    }

    setEncryptionUI();
  }
  else
  {
    setNoEncryptionUI();
  }

  gEncryptOptionChanged = true;
}

function toggleSignMessage()
{
  if (!gSMFields)
    return;

  // toggle
  gSMFields.signMessage = !gSMFields.signMessage;

  if (gSMFields.signMessage) // make sure we have a cert name...
  {
    var signingCertName = gCurrentIdentity.getUnicharAttribute("signing_cert_name");
    if (!signingCertName)
    {
      gSMFields.signMessage = false;
      showNeedSetupInfo();
      return;
    }

    setSignatureUI();
  }
  else
  {
    setNoSignatureUI();
  }

  gSignOptionChanged = true;
}

function setSecuritySettings(menu_id)
{
  if (!gSMFields)
    return;

  document.getElementById("menu_securityEncryptRequire" + menu_id)
          .setAttribute("checked", gSMFields.requireEncryptMessage);
  document.getElementById("menu_securitySign" + menu_id)
          .setAttribute("checked", gSMFields.signMessage);
}

function setNextCommand(what)
{
  gNextSecurityButtonCommand = what;
}

function doSecurityButton()
{
  var what = gNextSecurityButtonCommand;
  gNextSecurityButtonCommand = "";

  switch (what)
  {
    case "encryptMessage":
      toggleEncryptMessage();
      break;

    case "signMessage":
      toggleSignMessage();
      break;

    case "show":
    default:
      showMessageComposeSecurityStatus();
  }
}

function setNoSignatureUI()
{
  top.document.getElementById("securityStatus").removeAttribute("signing");
  top.document.getElementById("signing-status").collapsed = true;
}

function setSignatureUI()
{
  top.document.getElementById("securityStatus").setAttribute("signing", "ok");
  top.document.getElementById("signing-status").collapsed = false;
}

function setNoEncryptionUI()
{
  top.document.getElementById("securityStatus").removeAttribute("crypto");
  top.document.getElementById("encryption-status").collapsed = true;
}

function setEncryptionUI()
{
  top.document.getElementById("securityStatus").setAttribute("crypto", "ok");
  top.document.getElementById("encryption-status").collapsed = false;
}

function showMessageComposeSecurityStatus()
{
  Recipients2CompFields(gMsgCompose.compFields);

  var encryptionCertName = gCurrentIdentity.getUnicharAttribute("encryption_cert_name");
  var signingCertName = gCurrentIdentity.getUnicharAttribute("signing_cert_name");

  window.openDialog("chrome://messenger-smime/content/msgCompSecurityInfo.xul",
    "",
    "chrome,modal,resizable,centerscreen",
    {
      compFields : gMsgCompose.compFields,
      subject : GetMsgSubjectElement().value,
      smFields : gSMFields,
      isSigningCertAvailable : (signingCertName.length > 0),
      isEncryptionCertAvailable : (encryptionCertName.length > 0),
      currentIdentity : gCurrentIdentity
    }
  );
}

var SecurityController =
{
  supportsCommand: function(command)
  {
    switch ( command )
    {
      case "cmd_viewSecurityStatus":
        return true;

      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    switch ( command )
    {
      case "cmd_viewSecurityStatus":
        return true;

      default:
        return false;
    }
  }
};

function onComposerSendMessage()
{
  let missingCount = new Object();
  let emailAddresses = new Object();

  try {
    if (!gMsgCompose.compFields.securityInfo.requireEncryptMessage) {
      return;
    }

    var helper = Components.classes["@mozilla.org/messenger-smime/smimejshelper;1"]
                           .createInstance(Components.interfaces.nsISMimeJSHelper);
    helper.getNoCertAddresses(
      gMsgCompose.compFields,
      missingCount,
      emailAddresses);
  }
  catch (e)
  {
    return;
  }

  if (missingCount.value > 0)
  {
    // The rules here: If the current identity has a directoryServer set, then
    // use that, otherwise, try the global preference instead.

    var autocompleteDirectory = null;

    // Does the current identity override the global preference?
    if (gCurrentIdentity.overrideGlobalPref)
      autocompleteDirectory = gCurrentIdentity.directoryServer;
    else
    {
      // Try the global one
      var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);
      if (prefs.getBoolPref("ldap_2.autoComplete.useDirectory"))
        autocompleteDirectory =
          prefs.getCharPref("ldap_2.autoComplete.directoryServer");
    }

    if (autocompleteDirectory)
      window.openDialog("chrome://messenger-smime/content/certFetchingStatus.xul",
                        "",
                        "chrome,modal,resizable,centerscreen",
                        autocompleteDirectory,
                        emailAddresses.value);
  }
}

function onComposerFromChanged()
{
  if (!gSMFields)
    return;

  var encryptionPolicy = gCurrentIdentity.getIntAttribute("encryptionpolicy");
  var useEncryption = false;
  if (!gEncryptOptionChanged)
  {
    // Encryption wasn't manually checked.
    // Set up the encryption policy from the setting of the new identity.

    // 0 == never, 1 == if possible (ns4), 2 == always Encrypt.
    useEncryption = (encryptionPolicy == 2);
  }
  else
  {
    // The encryption policy was manually checked. That means we can get into
    // the situation that the new identity doesn't have a cert to encrypt with.
    // If it doesn't, don't encrypt.

    if (encryptionPolicy != 2) // Encrypted (policy unencrypted, manually changed).
    {
      // Make sure we have a cert for encryption.
      var encryptionCertName = gCurrentIdentity.getUnicharAttribute("encryption_cert_name");
      useEncryption = encryptionCertName;
    }
  }
  gSMFields.requireEncryptMessage = useEncryption;
  if (useEncryption)
    setEncryptionUI();
  else
    setNoEncryptionUI();

  var signMessage = gCurrentIdentity.getBoolAttribute("sign_mail");
  var useSigning = false;
  if (!gSignOptionChanged)
  {
    // Signing wasn't manually checked.
    // Set up the signing policy from the setting of the new identity.

    useSigning = signMessage;
  }
  else
  {
    // The signing policy was manually checked. That means we can get into
    // the situation that the new identity doesn't have a cert to sign with.
    // If it doesn't, don't sign.

    if (!signMessage) // Signed (policy unsigned, manually changed).
    {
      // Make sure we have a cert for signing.
      var signingCertName = gCurrentIdentity.getUnicharAttribute("signing_cert_name");
      useSigning = signingCertName;
    }
  }
  gSMFields.signMessage = useSigning;
  if (useSigning)
    setSignatureUI();
  else
    setNoSignatureUI();
}
