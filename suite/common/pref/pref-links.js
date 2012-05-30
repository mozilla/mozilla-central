/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  ToggleRestrictionGroup(document.getElementById("browser.link.open_newwindow").value);
}

function ToggleRestrictionGroup(value)
{
  document.getElementById("restrictionGroup").disabled =
     value == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWWINDOW ||
     document.getElementById("browser.link.open_newwindow.restriction").locked;
}
