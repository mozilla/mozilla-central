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
 * The Original Code is Netscape Communicator.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var gEncryptionStatus = -1;
var gSignatureStatus = -1;
var gSignerCert = null;
var gEncryptionCert = null;

addEventListener("load", smimeReadOnLoad, false);

function smimeReadOnLoad()
{
  removeEventListener("load", smimeReadOnLoad, false);

  top.controllers.appendController(SecurityController);

  addEventListener("unload", smimeReadOnUnload, false);
}

function smimeReadOnUnload()
{
  removeEventListener("unload", smimeReadOnUnload, false);

  top.controllers.removeController(SecurityController);
}

function showImapSignatureUnknown()
{
  let readSmimeBundle = document.getElementById("bundle_read_smime");
  let brandBundle = document.getElementById("bundle_brand");
  if (!readSmimeBundle || !brandBundle)
    return;

  let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Components.interfaces.nsIPromptService);
  if (promptService &&
      promptService.confirm(window, brandBundle.getString("brandShortName"),
                                    readSmimeBundle.getString("ImapOnDemand")))
    gDBView.reloadMessageWithAllParts();
}

function showMessageReadSecurityInfo()
{
  let gSignedUINode = document.getElementById("signedHdrIcon");
  if (gSignedUINode && gSignedUINode.getAttribute("signed") == "unknown")
  {
    showImapSignatureUnknown();
    return;
  }

  let pkiParams = Components.classes["@mozilla.org/security/pkiparamblock;1"]
                            .createInstance(Components.interfaces.nsIPKIParamBlock);

  // isupport array starts with index 1
  pkiParams.setISupportAtIndex(1, gSignerCert);
  pkiParams.setISupportAtIndex(2, gEncryptionCert);

  var params = pkiParams.QueryInterface(Components.interfaces.nsIDialogParamBlock);
  // int array starts with index 0, but that is used for window exit status
  params.SetInt(1, gSignatureStatus);
  params.SetInt(2, gEncryptionStatus);

  window.openDialog("chrome://messenger-smime/content/msgReadSecurityInfo.xul",
                    "", "chrome,resizable=1,modal=1,dialog=1", pkiParams);
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
        if (document.documentElement.getAttribute('windowtype') == "mail:messageWindow")
          return GetNumSelectedMessages() > 0;

        if (GetNumSelectedMessages() > 0 && gDBView)
        {
          let enabled = {value: false};
          let checkStatus = {};
          gDBView.getCommandStatus(nsMsgViewCommandType.cmdRequiringMsgBody,
                                   enabled, checkStatus);
          return enabled.value;
        }
        // else: fall through.

      default:
        return false;
    }
  }
};
