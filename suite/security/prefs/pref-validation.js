/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Drinan <ddrinan@netscape.com>
 *   Philip Chee <philip.chee@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
