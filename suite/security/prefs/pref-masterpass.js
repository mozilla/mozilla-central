/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
