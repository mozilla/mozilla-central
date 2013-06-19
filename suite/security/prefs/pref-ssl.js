/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  // array associating XUL element IDs with preference values [0,1,2,3]
  gSslPrefElementIds = ["allowSSL30", "allowTLS10", "allowTLS11", "allowTLS12"];

  // initial setting of checkboxes based on preference values
  UpdateSslBoxes();
}

function UpdateSslBoxes()
{
  // get minimum and maximum allowed protocol and locked status
  let minVersion = document.getElementById("security.tls.version.min").value;
  let maxVersion = document.getElementById("security.tls.version.max").value;
  let minLocked  = document.getElementById("security.tls.version.min").locked;
  let maxLocked  = document.getElementById("security.tls.version.max").locked;

  // set checked, disabled, and locked status for each protocol checkbox
  for (index = 0; index < gSslPrefElementIds.length; index++)
  {
    let currentBox = document.getElementById(gSslPrefElementIds[index]);
    currentBox.checked = index >= minVersion && index <= maxVersion;

    if ((minLocked && maxLocked) || (minLocked && index <= minVersion) ||
                                    (maxLocked && index >= maxVersion))
    {
      // boxes subject to a preference's locked status are disabled and grayed
      currentBox.removeAttribute("nogray");
      currentBox.disabled = true;
    }
    else
    {
      // boxes which the user can't uncheck are disabled but not grayed
      currentBox.setAttribute("nogray", "true");
      currentBox.disabled = (index > minVersion && index < maxVersion) ||
                            (index == minVersion && index == maxVersion);
    }
  }
}

function UpdateSslPrefs()
{
  // this is called whenever a checkbox changes
  let minVersion = -1;
  let maxVersion = -1;

  // find the first and last checkboxes which are now checked
  for (index = 0; index < gSslPrefElementIds.length; index++)
  {
    if (document.getElementById(gSslPrefElementIds[index]).checked)
    {
      if (minVersion < 0)  // first box checked
        minVersion = index;
      maxVersion = index;  // last box checked so far
    }
  }

  // if minVersion is valid, then maxVersion is as well -> update prefs
  if (minVersion >= 0)
  {
    document.getElementById("security.tls.version.min").value = minVersion;
    document.getElementById("security.tls.version.max").value = maxVersion;
  }

  // update checkbox values and visibility based on prefs again
  UpdateSslBoxes();
}
