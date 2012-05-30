/*
 * -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


function initCommonRetentionSettings(retentionSettings)
{
  document.getElementById("retention.keepUnread").checked =  retentionSettings.keepUnreadMessagesOnly;
  document.getElementById("retention.keepMsg").value = retentionSettings.retainByPreference;
  if(retentionSettings.daysToKeepHdrs > 0)
    document.getElementById("retention.keepOldMsgMin").value =
    (retentionSettings.daysToKeepHdrs > 0) ? retentionSettings.daysToKeepHdrs : 30;
  document.getElementById("retention.keepNewMsgMin").value =
    (retentionSettings.numHeadersToKeep > 0) ? retentionSettings.numHeadersToKeep : 2000;

  document.getElementById("retention.applyToFlagged").checked =
    !retentionSettings.applyToFlaggedMessages;
}

function saveCommonRetentionSettings(aRetentionSettings)
{
  aRetentionSettings.retainByPreference = document.getElementById("retention.keepMsg").value;

  aRetentionSettings.daysToKeepHdrs = document.getElementById("retention.keepOldMsgMin").value;
  aRetentionSettings.numHeadersToKeep = document.getElementById("retention.keepNewMsgMin").value;
  aRetentionSettings.keepUnreadMessagesOnly = document.getElementById("retention.keepUnread").checked;

  aRetentionSettings.applyToFlaggedMessages =
    !document.getElementById("retention.applyToFlagged").checked;

  return aRetentionSettings;
}

function onCheckKeepMsg()
{
  if (gLockedPref && gLockedPref["retention.keepMsg"]) {
    // if the pref associated with the radiobutton is locked, as indicated
    // by the gLockedPref, skip this function.  All elements in this
    // radiogroup have been locked by the function onLockPreference.
    return;
  }

  var keepMsg = document.getElementById("retention.keepMsg").value;
  document.getElementById("retention.keepOldMsgMin").disabled = keepMsg != 2;
  document.getElementById("retention.keepNewMsgMin").disabled = keepMsg != 3;
}
