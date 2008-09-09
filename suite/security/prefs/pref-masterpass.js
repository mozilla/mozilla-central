/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Javier Delgadillo <javi@netscape.com>
 *   Manuel Reimer <Manuel.Reimer@gmx.de>
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

const nsIPK11Token = Components.interfaces.nsIPK11Token;
var gInternalToken;

function Startup() {
  var tokendb = Components.classes["@mozilla.org/security/pk11tokendb;1"]
                          .getService(Components.interfaces.nsIPK11TokenDB);
  gInternalToken = tokendb.getInternalKeyToken();
}

function ReadAskForPassword() {
  var value;
  switch (gInternalToken.getAskPasswordTimes()) {
  case nsIPK11Token.ASK_FIRST_TIME:
    value = 0;
    break;
  case nsIPK11Token.ASK_EVERY_TIME:
    value = 1;
    break;
  case nsIPK11Token.ASK_EXPIRE_TIME:
    value = 2;
    break;
  }

  EnableLifetimeTextbox(value);
  return value;
}

function WriteAskForPassword(field) {
  var askTimes;
  switch (field.value) {
  case "0":
    askTimes = nsIPK11Token.ASK_FIRST_TIME;
    break;
  case "1":
    askTimes = nsIPK11Token.ASK_EVERY_TIME;
    break;
  case "2":
    askTimes = nsIPK11Token.ASK_EXPIRE_TIME;
    break;
  }
  var timeout = gInternalToken.getAskPasswordTimeout();
  gInternalToken.setAskPasswordDefaults(askTimes, timeout);

  var prefExpire = document.getElementById("signon.expireMasterPassword");
  prefExpire.value = (field.value == 1);

  return field.value;
}

function ReadPasswordLifetime() {
  return gInternalToken.getAskPasswordTimeout();
}

function WritePasswordLifetime(field) {
  var askTimes = gInternalToken.getAskPasswordTimes();
  gInternalToken.setAskPasswordDefaults(askTimes, field.value);
  return field.value;
}

function EnableLifetimeTextbox(aPrefValue) {
  EnableElementById("passwordTimeout", aPrefValue == 2, false);
}

function ChangePW()
{
  var p = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                    .createInstance(Components.interfaces.nsIDialogParamBlock);
  p.SetString(1, "");
  window.openDialog("chrome://pippki/content/changepassword.xul", "",
                    "chrome,centerscreen,modal", p);
}

function ResetPW()
{
  var p = Components.classes["@mozilla.org/embedcomp/dialogparam;1"]
                    .createInstance(Components.interfaces.nsIDialogParamBlock);
  p.SetString(1, gInternalToken.tokenName);
  window.openDialog("chrome://pippki/content/resetpassword.xul", "",
                    "chrome,centerscreen,modal", p);
}
