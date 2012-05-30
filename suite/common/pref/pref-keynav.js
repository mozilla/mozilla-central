/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const kTabToLinks = 4;
const kTabToForms = 2;
const kTabToTextboxes = 1;

function Startup()
{
  if (/Mac/.test(navigator.platform))
    document.getElementById("tabNavigationPrefs").setAttribute("hidden", true);

  UpdateBrowseWithCaretItems();
}

function ReadTabNav(aField)
{
  var curval = document.getElementById("accessibility.tabfocus").value;
  // Return the right bit based on the id of "aField"
  if (aField.id == "tabNavigationLinks")
    return (curval & kTabToLinks) != 0;

  return (curval & kTabToForms) != 0;
}

function WriteTabNav(aField)
{
  var curval = document.getElementById("accessibility.tabfocus").value;
  // Textboxes are always part of the tab order
  curval |= kTabToTextboxes;
  // Select the bit, we have to change, based on the id of "aField"
  var bit = kTabToForms;
  if (aField.id == "tabNavigationLinks")
    bit = kTabToLinks;

  if (aField.checked)
    return curval | bit;

  return curval & ~bit;
}

function UpdateBrowseWithCaretItems()
{
  document.getElementById("browseWithCaretWarn").disabled =
    !document.getElementById("accessibility.browsewithcaret_shortcut.enabled").value ||
    document.getElementById("accessibility.browsewithcaret").locked;
}
