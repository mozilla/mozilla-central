/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The contents of this file will be loaded into the scope of the object
// <prefpane id="viewing_messages_pane">!

function Startup()
{
  var autoPref = document.getElementById("mailnews.mark_message_read.auto");
  UpdateMarkAsReadOptions(autoPref.value);
}

function UpdateMarkAsReadOptions(aEnableReadDelay)
{
  EnableElementById("markAsReadAfterPreferences", aEnableReadDelay, false);
  // ... and the extras!
  var delayPref = document.getElementById("mailnews.mark_message_read.delay");
  UpdateMarkAsReadTextbox(aEnableReadDelay && delayPref.value, false);
}

function UpdateMarkAsReadTextbox(aEnable, aFocus)
{
  EnableElementById("markAsReadDelay", aEnable, aFocus);
}
