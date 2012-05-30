/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIOCSPResponder = Components.interfaces.nsIOCSPResponder;

var gCacheRadio = 0;

function Startup()
{
  var certdb = Components.classes["@mozilla.org/security/x509certdb;1"]
                         .getService(Components.interfaces.nsIX509CertDB);
  var ocspResponders = certdb.getOCSPResponders();

  var signersMenu = document.getElementById("signingCA");
  for (let i = 0; i < ocspResponders.length; i++)
  {
    let ocspEntry = ocspResponders.queryElementAt(i, nsIOCSPResponder);
    let responseSigner = ocspEntry.responseSigner;
    let item = signersMenu.appendItem(responseSigner, responseSigner);
    item.setAttribute("serviceurl", ocspEntry.serviceURL);
  }

  // Make it easier to access the pref pane from onsync.
  document.getElementById("enableOCSPBox").pane = this;

  var securityOCSPEnabled = document.getElementById("security.OCSP.enabled");
  DoEnabling(securityOCSPEnabled.value);
}

function DoEnabling(aOCSPPrefValue)
{
  EnableElementById("securityOCSPEnabled", aOCSPPrefValue != 0, false);
  EnableElementById("requireWorkingOCSP", aOCSPPrefValue != 0, false);
  EnableElementById("signingCA", aOCSPPrefValue == 2, false);
  EnableElementById("serviceURL", aOCSPPrefValue == 2, false);
}

function SyncToOCSPBox()
{
  // the radio button changed, or we init the stored value from prefs
  var securityOCSPEnabled = document.getElementById("security.OCSP.enabled");
  var OCSPPrefValue = securityOCSPEnabled.value;
  DoEnabling(OCSPPrefValue);
  return (OCSPPrefValue != 0);
}

function SyncFromOCSPBox(aChecked)
{
  // the user toggled the checkbox to enable/disable OCSP
  var newVal = 0;
  if (aChecked)
  {
    // now enabled. if we have a cached radio val, restore it.
    // if not, use the first setting
    newVal = gCacheRadio || 1;
  }
  else
  {
    // now disabled. remember current value
    gCacheRadio = document.getElementById("security.OCSP.enabled").value;
  }
  DoEnabling(newVal);
  return newVal;
}

function ChangeURL(aCA)
{
  var serviceURL = aCA.selectedItem.getAttribute("serviceurl");
  document.getElementById("security.OCSP.URL").value = serviceURL;
}

function OpenCrlManager()
{
    document.documentElement
            .openWindow("mozilla:crlmanager", 
                        "chrome://pippki/content/crlManager.xul",
                        "", null);
}
