/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  ToggleCustomColorPickers(document.getElementById("browser.display.use_system_colors").value);
}

function ToggleCustomColorPickers(aChecked)
{
  TogglePickerDisability(aChecked, "browserForegroundColor");
  TogglePickerDisability(aChecked, "browserBackgroundColor");
}

function TogglePickerDisability(aDisable, aPicker)
{
  var element = document.getElementById(aPicker);
  aDisable = aDisable ||
    document.getElementById(element.getAttribute("preference")).locked;
 
  element.disabled = aDisable;
  element = document.getElementById(aPicker + "Label");
  element.disabled = aDisable;
}
