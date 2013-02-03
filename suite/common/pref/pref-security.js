/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Enable the DNT ".value" radiogroup only if the ".enabled" box is checked
 */

function Startup()
{
  var prefAutostart = document.getElementById("privacy.donottrackheader.enabled");
  SetDntValueEnabled(prefAutostart.value);
}

function SetDntValueEnabled(aEnable)
{
  EnableElementById("dntSelection", aEnable, false);
}
