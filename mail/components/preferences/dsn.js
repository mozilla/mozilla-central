# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

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
