/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  updateClearNowButtonLabel();
}

/**
 * Sets the label of the "Clear Now..." button according to the
 * privacy.sanitize.promptOnSanitize preference. Read valueFromPreferences to
 * only change the button when the underlying pref changes, since in the case
 * of instantApply=false, the call to clearPrivateDataNow would result in the
 * dialog appearing when the user just unchecked the "Ask me" checkbox.
 */
function updateClearNowButtonLabel()
{
  var pref = document.getElementById("privacy.sanitize.promptOnSanitize");
  var clearNowButton = document.getElementById("clearDataNow");

  if (pref.valueFromPreferences)
    clearNowButton.label = clearNowButton.getAttribute("labelDialog"); // "Clear Now..."
  else
    clearNowButton.label = clearNowButton.getAttribute("labelSilent"); // "Clear Now"
}

/**
 * Either displays a dialog from which individual parts of private data may be
 * cleared, or automatically clears private data according to current
 * CPD settings.  The former happens if privacy.sanitize.promptOnSanitize is
 * true, and the latter happens otherwise.
 */
function clearPrivateDataNow()
{
  Components.classes["@mozilla.org/suite/suiteglue;1"]
            .getService(Components.interfaces.nsISuiteGlue)
            .sanitize(window);
}
