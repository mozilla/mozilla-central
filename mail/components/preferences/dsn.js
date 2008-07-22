# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Thunderbird Preferences System.
#
# The Initial Developer of the Original Code is
# Olivier Parniere BT Global Services / Etat francais Ministere de la Defense
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Olivier Parniere BT Global Services / Etat francais Ministere de la Defense
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

var requestAlways;
var requestAlwaysPref;

var requestOnSuccess;
var requestOnSuccessPref;

var requestOnFailure;
var requestOnFailurePref;

var requestOnDelay;
var requestOnDelayPref;

var requestNever;
var requestNeverPref;

function onInit() 
{
  requestAlways = document.getElementById("always_request_on");
  requestAlwaysPref = document.getElementById("mail.dsn.always_request_on");
  
  requestOnSuccess = document.getElementById("request_on_success_on");
  requestOnSuccessPref = document.getElementById("mail.dsn.request_on_success_on");
  
  requestOnFailure = document.getElementById("request_on_failure_on");
  requestOnFailurePref = document.getElementById("mail.dsn.request_on_failure_on");
  
  requestOnDelay = document.getElementById("request_on_delay_on");
  requestOnDelayPref = document.getElementById("mail.dsn.request_on_delay_on");
  
  requestNever = document.getElementById("request_never_on");
  requestNeverPref = document.getElementById("mail.dsn.request_never_on");
  
  EnableDisableAllowedDSNRequests(new Object());

  return true;
}

function EnableDisableAllowedDSNRequests(target)
{
  var s = requestOnSuccess.checked;
  var f = requestOnFailure.checked;
  var d = requestOnDelay.checked;
  var n = requestNever.checked;

  // Case when the checkbox requestAlways must be enabled
  if (s || f || d || n) {
    requestAlways.disabled = false;
  
  // Case when the checkbox requestAlways must be disabled
  } else if (!d && !n && !s && !f) {
    requestAlwaysPref.value = false;
    requestAlways.disabled = true;
  }

  // Checkbox requestNever is exclusive with checkboxes requestOnSuccess, requestOnFailure, requestOnDelay
  if (target == requestNever) {
    requestOnSuccessPref.value = requestOnFailurePref.value = requestOnDelayPref.value = false;

  } else if (target == requestOnSuccess || target == requestOnFailure || target == requestOnDelay) {
    requestNeverPref.value = false;
  }
}
