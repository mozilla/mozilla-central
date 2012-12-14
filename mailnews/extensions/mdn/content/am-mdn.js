/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var useCustomPrefs;
var requestReceipt;
var leaveInInbox;
var moveToSent;
var receiptSend;
var neverReturn;
var returnSome;
var notInToCcPref;
var notInToCcLabel;
var outsideDomainPref;
var outsideDomainLabel;
var otherCasesPref;
var otherCasesLabel;
var receiptArriveLabel;
var receiptRequestLabel;
var gIdentity;
var gIncomingServer;
var gMdnPrefBranch;

function onInit() 
{
  useCustomPrefs = document.getElementById("identity.use_custom_prefs");
  requestReceipt = document.getElementById("identity.request_return_receipt_on");
  leaveInInbox = document.getElementById("leave_in_inbox");
  moveToSent = document.getElementById("move_to_sent");
  receiptSend = document.getElementById("server.mdn_report_enabled");
  neverReturn = document.getElementById("never_return");
  returnSome = document.getElementById("return_some");
  notInToCcPref = document.getElementById("server.mdn_not_in_to_cc");
  notInToCcLabel = document.getElementById("notInToCcLabel");
  outsideDomainPref = document.getElementById("server.mdn_outside_domain");
  outsideDomainLabel = document.getElementById("outsideDomainLabel");
  otherCasesPref = document.getElementById("server.mdn_other");
  otherCasesLabel = document.getElementById("otherCasesLabel");
  receiptArriveLabel = document.getElementById("receiptArriveLabel");
  receiptRequestLabel = document.getElementById("receiptRequestLabel");
  
  EnableDisableCustomSettings();
        
  return true;
}

function onSave()
{

}

function EnableDisableCustomSettings() {
  if (useCustomPrefs && (useCustomPrefs.getAttribute("value") == "false")) {
    requestReceipt.setAttribute("disabled", "true");
    leaveInInbox.setAttribute("disabled", "true");
    moveToSent.setAttribute("disabled", "true");
    neverReturn.setAttribute("disabled", "true");
    returnSome.setAttribute("disabled", "true");
    receiptArriveLabel.setAttribute("disabled", "true");
    receiptRequestLabel.setAttribute("disabled", "true");
  }
  else {
    requestReceipt.removeAttribute("disabled");
    leaveInInbox.removeAttribute("disabled");
    moveToSent.removeAttribute("disabled");
    neverReturn.removeAttribute("disabled");
    returnSome.removeAttribute("disabled");
    receiptArriveLabel.removeAttribute("disabled");
    receiptRequestLabel.removeAttribute("disabled");
  }
  EnableDisableAllowedReceipts();
  // Lock id based prefs
  onLockPreference("mail.identity", gIdentity.key);
  // Lock server based prefs
  onLockPreference("mail.server", gIncomingServer.key);
  return true;
}

function EnableDisableAllowedReceipts() {
  if (receiptSend) {
    if (!neverReturn.getAttribute("disabled") && (receiptSend.getAttribute("value") != "false")) {
      notInToCcPref.removeAttribute("disabled");
      notInToCcLabel.removeAttribute("disabled");
      outsideDomainPref.removeAttribute("disabled");
      outsideDomainLabel.removeAttribute("disabled");
      otherCasesPref.removeAttribute("disabled");
      otherCasesLabel.removeAttribute("disabled");
    }
    else {
      notInToCcPref.setAttribute("disabled", "true");
      notInToCcLabel.setAttribute("disabled", "true");
      outsideDomainPref.setAttribute("disabled", "true");
      outsideDomainLabel.setAttribute("disabled", "true");
      otherCasesPref.setAttribute("disabled", "true");
      otherCasesLabel.setAttribute("disabled", "true");
    }
  }
  return true;
}

function onPreInit(account, accountValues)
{
  gIdentity = account.defaultIdentity;
  gIncomingServer = account.incomingServer;
}

// Disables xul elements that have associated preferences locked.
function onLockPreference(initPrefString, keyString)
{
    var finalPrefString; 

    var allPrefElements = [
      { prefstring:"request_return_receipt_on", id:"identity.request_return_receipt_on"},
      { prefstring:"select_custom_prefs", id:"identity.select_custom_prefs"},
      { prefstring:"select_global_prefs", id:"identity.select_global_prefs"},
      { prefstring:"incorporate_return_receipt", id:"server.incorporate_return_receipt"},
      { prefstring:"never_return", id:"never_return"},
      { prefstring:"return_some", id:"return_some"},
      { prefstring:"mdn_not_in_to_cc", id:"server.mdn_not_in_to_cc"},
      { prefstring:"mdn_outside_domain", id:"server.mdn_outside_domain"},
      { prefstring:"mdn_other", id:"server.mdn_other"},
    ];

    finalPrefString = initPrefString + "." + keyString + ".";
    gMdnPrefBranch = Services.prefs.getBranch(finalPrefString);

    disableIfLocked( allPrefElements );
} 

function disableIfLocked( prefstrArray )
{
  for (var i=0; i<prefstrArray.length; i++) {
    var id = prefstrArray[i].id;
    var element = document.getElementById(id);
    if (gMdnPrefBranch.prefIsLocked(prefstrArray[i].prefstring)) {
      if (id == "server.incorporate_return_receipt")
      {
        document.getElementById("leave_in_inbox").setAttribute("disabled", "true");
        document.getElementById("move_to_sent").setAttribute("disabled", "true");
      }
      else
        element.setAttribute("disabled", "true");
    }
  }
}

/**
 * Opens Preferences (Options) dialog on the pane and tab where
 * the global receipts settings can be found.
 */
function showGlobalReceipts() {
  openPrefsFromAccountManager("paneAdvanced", "generalTab",
                              {subdialog: "showReturnReceipts"}, "receipts_pane");
}
