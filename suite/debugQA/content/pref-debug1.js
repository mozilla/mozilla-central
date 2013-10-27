/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- *
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  var val = document.getElementById("nglayout.debug.paint_flashing").value;

  enableChrome(val);
}

function enableChrome(aValue)
{
  var paintFlashingChrome = document.getElementById("nglayoutDebugPaintFlashingChrome");

  paintFlashingChrome.disabled = aValue;
}
