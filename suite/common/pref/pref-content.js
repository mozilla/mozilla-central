/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * When the user toggles the layers.acceleration.disabled pref,
 * sync its new value to the gfx.direct2d.disabled pref too.
 */
function updateHardwareAcceleration(aVal)
{
  if (/^Win/.test(navigator.platform)) {
    document.getElementById("gfx.direct2d.disabled").value = aVal;
  }
}
