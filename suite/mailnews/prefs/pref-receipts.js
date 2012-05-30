/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gNotInToCcLabel;
var gOutsideDomainLabel;
var gOtherCasesLabel;

function Startup()
{
  gNotInToCcLabel = document.getElementById("notInToCcLabel");
  gOutsideDomainLabel = document.getElementById("outsideDomainLabel");
  gOtherCasesLabel = document.getElementById("otherCasesLabel");

  var value = document.getElementById("mail.mdn.report.enabled").value;
  EnableDisableAllowedReceipts(value);
}

function EnableDisableAllowedReceipts(aEnable)
{
  EnableElementById("notInToCcPref", aEnable, false);
  EnableElementById("outsideDomainPref", aEnable, false);
  EnableElementById("otherCasesPref", aEnable, false);
  gNotInToCcLabel.disabled = !aEnable;
  gOutsideDomainLabel.disabled = !aEnable;
  gOtherCasesLabel.disabled = !aEnable;
}
