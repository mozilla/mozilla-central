/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gSoundUrlPref;

function Startup()
{
  gSoundUrlPref = document.getElementById("privacy.popups.sound_url");

  SetLists();

  SetButtons();
}

function SetLists()
{
  const kPopupType = "popup";

  const nsIPermissionManager = Components.interfaces.nsIPermissionManager;
  const nsIPermission = Components.interfaces.nsIPermission;

  var permissionManager = Components.classes["@mozilla.org/permissionmanager;1"]
                                    .getService(nsIPermissionManager);

  var pref = document.getElementById("privacy.popups.remove_blacklist");
  if (pref.value)
  {
    var enumerator = permissionManager.enumerator;
    var hosts = [];

    while (enumerator.hasMoreElements())
    {                
      var permission = enumerator.getNext();
      if (permission instanceof nsIPermission)
      {
        if ((permission.type == kPopupType) &&
            (permission.capability == nsIPermissionManager.DENY_ACTION))
          hosts.push(permission.host);
      }
    }

    for (var i in hosts)
      permissionManager.remove(hosts[i], kPopupType);

    pref.value = false;
  }

  pref = document.getElementById("privacy.popups.prefill_whitelist");
  if (pref.value)
  {
    try
    { 
      var whitelist = document.getElementById("privacy.popups.default_whitelist").value;
      var hosts = whitelist.split(",");

      for (var i in hosts)
      {
        var host = "http://" + hosts[i];
        var uri = Services.io.newURI(host, null, null);
        permissionManager.add(uri, kPopupType, true);
      }
    } 
    catch (ex) {}

    pref.value = false;
  }  
}

function SetButtons()
{
  var prefString = document.getElementById("popupPolicy")
                           .getAttribute("preference");
  var enable = document.getElementById(prefString).value;
  EnableElementById("exceptionsButton", enable, false);
  EnableElementById("displayIcon", enable, false);
  EnableElementById("displayPopupsNotification", enable, false);

  var element = document.getElementById("playSound");
  EnableElement(element, enable, false);

  prefString = element.getAttribute("preference");
  EnableSoundRadio(enable && document.getElementById(prefString).value);
}

function EnableSoundRadio(aSoundChecked)
{
  const kCustomSound = 1;

  var element = document.getElementById("popupSoundType");
  EnableElement(element, aSoundChecked, false);
  var pref = document.getElementById(element.getAttribute("preference"));
  EnableSoundUrl(aSoundChecked && (pref.value == kCustomSound));
}

function EnableSoundUrl(aCustomSelected)
{
  EnableElementById("playSoundUrl", aCustomSelected, false);
  EnableElementById("selectSound", aCustomSelected, false);
  EnableElementById("playSoundButton", aCustomSelected, false);
}
