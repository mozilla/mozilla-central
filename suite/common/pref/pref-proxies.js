/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  gShareSettings = document.getElementById("network.proxy.share_proxy_settings");
}

// Returns true if all protocol specific proxies and all their
// ports are set to the same value, false otherwise.
function DefaultForShareSettingsPref()
{
  return gHTTP.value == gSSL.value &&
         gHTTP.value == gFTP.value &&
         gHTTPPort.value == gSSLPort.value &&
         gHTTPPort.value == gFTPPort.value;
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
                  "networkProxyFTP", "networkProxyFTP_Port"];
  EnableUnlockedElements(nonshare, !aChecked);
}

function DoProxyHostCopy(aValue)
{
  if (!gShareSettings.value)
    return;

  gSSL.value = aValue;
  gFTP.value = aValue;
}

function DoProxyPortCopy(aValue)
{
  if (!gShareSettings.value)
    return;

  gSSLPort.value = aValue;
  gFTPPort.value = aValue;
}

function UpdateProxies()
{
  var noProxiesPref = document.getElementById("network.proxy.no_proxies_on");

  noProxiesPref.value = noProxiesPref.value.replace(/[;, \n]+/g, ", ")
                                           .replace(/^, |, $/g, "");
}
