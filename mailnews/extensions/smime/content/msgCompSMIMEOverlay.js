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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   ddrinan@netscape.com
 *   Scott MacGreogr <mscott@netscape.com>
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

// Account encryption policy values:
// const kEncryptionPolicy_Never = 0;
// 'IfPossible' was used by ns4.
// const kEncryptionPolicy_IfPossible = 1;
const kEncryptionPolicy_Always = 2;

var gEncryptedURIService =
        Components.classes["@mozilla.org/messenger-smime/smime-encrypted-uris-service;1"]
                  .getService(Components.interfaces.nsIEncryptedSMIMEURIsService);

var gNextSecurityButtonCommand = "";
var gSMFields = null;

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
  if (!gSMFields)
    return;

  gMsgCompose.compFields.securityInfo = gSMFields;

  // Set up the intial security state.
  gSMFields.requireEncryptMessage =
    gCurrentIdentity.getIntAttribute("encryptionpolicy") == kEncryptionPolicy_Always;
  if (!gSMFields.requireEncryptMessage &&
      gEncryptedURIService &&
      gEncryptedURIService.isEncrypted(gMsgCompose.originalMsgURI))
  {
    // Override encryption setting if original is known as encrypted.
    gSMFields.requireEncryptMessage = true;
  }
  if (gSMFields.requireEncryptMessage)
    setEncryptionUI();
  else
    setNoEncryptionUI();

  gSMFields.signMessage = gCurrentIdentity.getBoolAttribute("sign_mail");
  if (gSMFields.signMessage)
    setSignatureUI();
  else
    setNoSignatureUI();
}

addEventListener("load", smimeComposeOnLoad, false);

// this function gets called multiple times,
// but only on first open, not on composer recycling
function smimeComposeOnLoad()
{
  removeEventListener("load", smimeComposeOnLoad, false);

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

function showNeedSetupInfo()
{
  let compSmimeBundle = document.getElementById("bundle_comp_smime");
  let brandBundle = document.getElementById("bundle_brand");
  if (!compSmimeBundle || !brandBundle)
    return;

  var ifps = Components.interfaces.nsIPromptService;
  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(ifps);

  let buttonPressed =
    promptService.confirmEx(window,
                            brandBundle.getString("brandShortName"),
                            compSmimeBundle.getString("NeedSetup"),
                            ifps.STD_YES_NO_BUTTONS, 0, 0, 0, null, {});
  if (buttonPressed == 0)
    openHelp("sign-encrypt", "chrome://communicator/locale/help/suitehelp.rdf");
}

function noEncryption()
{
  if (!gSMFields)
    return;

  gSMFields.requireEncryptMessage = false;
  setNoEncryptionUI();
}

function encryptMessage()
{
  if (!gSMFields)
    return;

  if (!gCurrentIdentity.getUnicharAttribute("encryption_cert_name"))
  {
    gSMFields.requireEncryptMessage = false;
    setNoEncryptionUI();
    showNeedSetupInfo();
    return;
  }

  gSMFields.requireEncryptMessage = true;
  setEncryptionUI();
}

function signMessage()
{
  if (!gSMFields)
    return;

  // toggle
  gSMFields.signMessage = !gSMFields.signMessage;

  if (gSMFields.signMessage) // make sure we have a cert name...
  {
    if (!gCurrentIdentity.getUnicharAttribute("signing_cert_name"))
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
}

function setSecuritySettings(menu_id)
{
  if (!gSMFields)
    return;

  document.getElementById("menu_securityEncryptRequire" + menu_id)
          .setAttribute("checked", gSMFields.requireEncryptMessage);
  document.getElementById("menu_securityNoEncryption" + menu_id)
          .setAttribute("checked", !gSMFields.requireEncryptMessage);
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
    case "noEncryption":
      noEncryption();
      break;

    case "encryptMessage":
      encryptMessage();
      break;

    case "signMessage":
      signMessage();
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

  window.openDialog(
    "chrome://messenger-smime/content/msgCompSecurityInfo.xul",
    "",
    "chrome,resizable=1,modal=1,dialog=1",
    {
      compFields : gMsgCompose.compFields,
      subject : GetMsgSubjectElement().value,
      smFields : gSMFields,
      isSigningCertAvailable :
        gCurrentIdentity.getUnicharAttribute("signing_cert_name") != "",
      isEncryptionCertAvailable :
        gCurrentIdentity.getUnicharAttribute("encryption_cert_name") != "",
      currentIdentity : gCurrentIdentity
    }
  );
}

var SecurityController =
{
  supportsCommand: function(command)
  {
    switch (command)
    {
      case "cmd_viewSecurityStatus":
        return true;

      default:
        return false;
    }
  },

  isCommandEnabled: function(command)
  {
    switch (command)
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

  try
  {
    if (!gMsgCompose.compFields.securityInfo.requireEncryptMessage)
      return;

    Components.classes["@mozilla.org/messenger-smime/smimejshelper;1"]
              .createInstance(Components.interfaces.nsISMimeJSHelper)
              .getNoCertAddresses(gMsgCompose.compFields,
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

    let autocompleteDirectory;

    // Does the current identity override the global preference?
    if (gCurrentIdentity.overrideGlobalPref)
    {
      autocompleteDirectory = gCurrentIdentity.directoryServer;
    }
    else
    {
      // Try the global one
      if (Application.prefs.getValue("ldap_2.autoComplete.useDirectory", false))
        autocompleteDirectory =
          Application.prefs.getValue("ldap_2.autoComplete.directoryServer", null);
    }

    if (autocompleteDirectory)
      window.openDialog("chrome://messenger-smime/content/certFetchingStatus.xul",
                        "",
                        "chrome,resizable=1,modal=1,dialog=1",
                        autocompleteDirectory,
                        emailAddresses.value);
  }
}

function onComposerFromChanged()
{
  if (!gSMFields)
    return;

  // In order to provide maximum protection to the user:

  // - If encryption is already enabled, we will not turn it off automatically.
  // - If encryption is not enabled, but the new account defaults to encryption, we will turn it on.
  if (!gSMFields.requireEncryptMessage &&
      gCurrentIdentity.getIntAttribute("encryptionpolicy") == kEncryptionPolicy_Always)
  {
    gSMFields.requireEncryptMessage = true;
    setEncryptionUI();
  }

  // - If signing is disabled, we will not turn it on automatically.
  // - If signing is enabled, but the new account defaults to not sign, we will turn signing off.
  if (gSMFields.signMessage && !gCurrentIdentity.getBoolAttribute("sign_mail"))
  {
    gSMFields.signMessage = false;
    setNoSignatureUI();
  }
}
