/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIOCSPResponder = Components.interfaces.nsIOCSPResponder;

var gCacheRadio = 0;

function Startup()
{
  var securityOCSPEnabled = document.getElementById("security.OCSP.enabled");
  DoEnabling(securityOCSPEnabled.value);
}

function DoEnabling(aOCSPPrefValue)
{
  EnableElementById("requireWorkingOCSP", aOCSPPrefValue != 0, false);
}

function OpenCrlManager()
{
    document.documentElement
            .openWindow("mozilla:crlmanager", 
                        "chrome://pippki/content/crlManager.xul",
                        "", null);
}
