/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function doEnabling(aElement)
{
  var preference = document.getElementById(aElement.getAttribute("preference"));
  var prefix = aElement.id.replace(/action$/, "");
  var vertical = document.getElementById(prefix + "delta_multiplier_y");
  EnableElement(vertical, preference.value);
  updateCheckbox(vertical);
  var actionX = document.getElementById(prefix + "action_x");
  if (actionX.value < 0)
    doEnablingX(actionX);
}

function doEnablingX(aElement)
{
  var preference = document.getElementById(aElement.getAttribute("preference"));
  var prefix = aElement.id.replace(/action_x$/, "");
  var value = preference.value;
  if (value < 0) {
    var action = document.getElementById(prefix + "action");
    preference = document.getElementById(action.getAttribute("preference"));
    value = preference.value;
  }
  var horizontal = document.getElementById(prefix + "delta_multiplier_x");
  EnableElement(horizontal, value);
  updateCheckbox(horizontal);
}

function updateCheckbox(aTextbox)
{
  var preference = document.getElementById(aTextbox.getAttribute("preference"));
  var checkbox = aTextbox.parentNode.lastChild;
  checkbox.checked = preference.value < 0;
  checkbox.disabled = !preference.value || aTextbox.disabled
}

function updateTextbox(aCheckbox)
{
  var textbox = aCheckbox.previousSibling.previousSibling;
  var preference = document.getElementById(textbox.getAttribute("preference"));
  preference.value = -preference.value;
}
