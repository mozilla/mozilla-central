/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function doEnabling(event)
{
  var preference = event.target;
  var textbox = preference.textbox;
  textbox.disabled = preference.value || preference.locked;
}

function Startup()
{
  var textboxes = this.getElementsByAttribute("checkbox", "*");
  for (var i = 0; i < textboxes.length; i++) {
    var textbox = textboxes[i];
    var preference = document.getElementById(textbox.getAttribute("checkbox"));
    preference.textbox = textbox;
    preference.addEventListener("change", doEnabling, false);
    if (preference.value)
      textbox.disabled = true;
  }
}
