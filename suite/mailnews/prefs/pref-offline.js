/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The contents of this file will be loaded into the scope of the object
// <prefpane id="offline_pane">!

function Startup()
{
  var value = document.getElementById("mail.prompt_purge_threshhold").value;
  EnableElementById("offlineCompactFolderMin", value, false);
}

function EnableMailPurgeThreshhold(aValue)
{
  var focus = (document.getElementById("offlineCompactFolder") == document.commandDispatcher.focusedElement);
  EnableElementById("offlineCompactFolderMin", aValue, focus);
}
