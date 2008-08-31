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
* The Original Code is Mozilla Communicator client code, released
* March 31, 1998.
*
* The Initial Developer of the Original Code is
* Netscape Communications Corporation.
* Portions created by the Initial Developer are Copyright (C) 1998-1999
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Stefan Borggraefe <Stefan.Borggraefe@gmx.de>
*   Ian Neal <iann_bugzilla@blueyonder.co.uk>
*
* Alternatively, the contents of this file may be used under the terms of
* either of the GNU General Public License Version 2 or later (the "GPL"),
* or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

const kNoProxy = 0;
const kManualProxy = 1;
const kAutoConfigProxy = 2;
const kObsoleteProxy = 3;
const kAutoDiscoverProxy = 4;
const kSystemProxy = 5;

var gInstantApply;
var gHTTP;
var gHTTPPort;
var gSSL;
var gSSLPort;
var gFTP;
var gFTPPort;
var gGopher;
var gGopherPort;
var gAutoURL;
var gProxyType;
var gShareSettings;

// Only used by main prefwindow
function Startup()
{
  InitCommonGlobals();
  gAutoURL = document.getElementById("network.proxy.autoconfig_url");
  gProxyType = document.getElementById("network.proxy.type");

  // Check for system proxy settings class and unhide UI if present
  if ("@mozilla.org/system-proxy-settings;1" in Components.classes)
    document.getElementById("systemPref").hidden = false;

  // Calculate a sane default for network.proxy.share_proxy_settings.
  if (gShareSettings.value == null)
    gShareSettings.value = DefaultForShareSettingsPref();
  
  // The pref value 3 (kObsoleteProxy) for network.proxy.type is unused to
  // maintain backwards compatibility. Treat 3 (kObsoleteProxy) equally to
  // 0 (kNoProxy). See bug 115720.
  if (gProxyType.value == kObsoleteProxy)
    gProxyType.value = kNoProxy;

  DoEnabling();
}

// Only used by child prefwindow
function AdvancedInit()
{
  InitCommonGlobals();
  DoProxyCopy(gShareSettings.value);
}

function InitCommonGlobals()
{
  gInstantApply = document.documentElement.instantApply;
  gHTTP = document.getElementById("network.proxy.http");
  gHTTPPort = document.getElementById("network.proxy.http_port");
  gSSL = document.getElementById("network.proxy.ssl");
  gSSLPort = document.getElementById("network.proxy.ssl_port");
  gFTP = document.getElementById("network.proxy.ftp");
  gFTPPort = document.getElementById("network.proxy.ftp_port");
  gGopher = document.getElementById("network.proxy.gopher");
  gGopherPort = document.getElementById("network.proxy.gopher_port");
  gShareSettings = document.getElementById("network.proxy.share_proxy_settings");
}

// Returns true if all protocol specific proxies and all their
// ports are set to the same value, false otherwise.
function DefaultForShareSettingsPref()
{
  return gHTTP.value == gSSL.value &&
         gHTTP.value == gFTP.value &&
         gHTTP.value == gGopher.value &&
         gHTTPPort.value == gSSLPort.value &&
         gHTTPPort.value == gFTPPort.value &&
         gHTTPPort.value == gGopherPort.value;
}

function DoEnabling()
{
  // convenience arrays
  var manual = ["networkProxyHTTP", "networkProxyHTTP_Port",
                "networkProxyNone", "advancedButton"];
  var auto = ["networkProxyAutoconfigURL", "autoReload"];

  switch (gProxyType.value)
  {
    case kNoProxy:
    case kAutoDiscoverProxy:
    case kSystemProxy:
      Disable(manual);
      Disable(auto);
      break;
    case kManualProxy:
      Disable(auto);
      if (!gProxyType.locked)
        EnableUnlockedElements(manual, true);
      break;
    case kAutoConfigProxy:
    default:
      Disable(manual);
      if (!gProxyType.locked)
      {
        EnableElementById("networkProxyAutoconfigURL", true, false);
        EnableUnlockedButton(gAutoURL);
      }
      break;
  }
}

function Disable(aElementIds)
{
  for (var i = 0; i < aElementIds.length; i++)
    document.getElementById(aElementIds[i]).setAttribute("disabled", "true");
}

function EnableUnlockedElements(aElementIds, aEnable)
{
  for (var i = 0; i < aElementIds.length; i++)
    EnableElementById(aElementIds[i], aEnable, false);
}

function EnableUnlockedButton(aElement)
{
  var enable = gInstantApply ||
               (aElement.valueFromPreferences == aElement.value);
  EnableElementById("autoReload", enable, false);
}

function ReloadPAC() {
  // This reloads the PAC URL stored in preferences.
  // When not in instant apply mode, the button that calls this gets
  // disabled if the preference and what is showing in the UI differ.
  Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
            .getService().reloadPAC();
}

function FixProxyURL(aURL)
{
  const nsIURIFixup = Components.interfaces.nsIURIFixup;
  var URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                           .getService(nsIURIFixup);
  try
  {
    aURL.value = URIFixup.createFixupURI(aURL.value,
                                         nsIURIFixup.FIXUP_FLAG_NONE).spec;
  }
  catch (e) {}

  if (!gInstantApply)
    EnableUnlockedButton(aURL);
}

function OpenAdvancedDialog()
{
  document.documentElement.openSubDialog("chrome://communicator/content/pref/pref-proxies-advanced.xul",
                                         "AdvancedProxyPreferences", null);
}

function DoProxyCopy(aChecked)
{
  DoProxyHostCopy(gHTTP.value);
  DoProxyPortCopy(gHTTPPort.value);
  var nonshare = ["networkProxySSL", "networkProxySSL_Port",
                  "networkProxyFTP", "networkProxyFTP_Port",
                  "networkProxyGopher", "networkProxyGopher_Port"];
  EnableUnlockedElements(nonshare, !aChecked);
}

function DoProxyHostCopy(aValue)
{
  if (!gShareSettings.value)
    return;

  gSSL.value = aValue;
  gFTP.value = aValue;
  gGopher.value = aValue;
}

function DoProxyPortCopy(aValue)
{
  if (!gShareSettings.value)
    return;

  gSSLPort.value = aValue;
  gFTPPort.value = aValue;
  gGopherPort.value = aValue;
}
