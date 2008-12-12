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
* Portions created by the Initial Developer are Copyright (C) 2002
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Ian Neal <iann_bugzilla@blueyonder.co.uk>
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

const nsIFileProtocolHandler = Components.interfaces.nsIFileProtocolHandler;

var gSoundUrlPref;
var gSelectSound;

var gIOService;
var gFileHandler;

function Startup()
{
  gSoundUrlPref = document.getElementById("privacy.popups.sound_url");
  gSelectSound = document.getElementById("selectSound");

  gIOService = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService);
  gFileHandler = gIOService.getProtocolHandler("file")
                           .QueryInterface(nsIFileProtocolHandler);

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
        var uri = gIOService.newURI(host, null, null);
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
  EnableElement(gSelectSound, aCustomSelected, false);
  EnableElementById("previewSound", aCustomSelected, false);
}

function ReadSoundLocation(aElement)
{
  aElement.value = gSoundUrlPref.value;
  if (aElement.value)
    aElement.file = gFileHandler.getFileFromURLSpec(aElement.value);
}

function SelectSound()
{
  const nsILocalFile = Components.interfaces.nsILocalFile;
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var filepicker = Components.classes["@mozilla.org/filepicker;1"]
                             .createInstance(nsIFilePicker);

  filepicker.init(window,
                  gSelectSound.getAttribute("filepickertitle"),
                  nsIFilePicker.modeOpen);
  if (gSoundUrlPref.value)
    filepicker.displayDirectory = gFileHandler.getFileFromURLSpec(gSoundUrlPref.value).parent;

  filepicker.appendFilter(gSelectSound.getAttribute("filepickerfilter"),
                          "*.wav; *.wave");
  filepicker.appendFilters(nsIFilePicker.filterAll);

  if (filepicker.show() == nsIFilePicker.returnOK)
    gSoundUrlPref.value = filepicker.fileURL.spec;
}

function PreviewSound()
{
  var soundUrl = gSoundUrlPref.value;
  var sound = Components.classes["@mozilla.org/sound;1"]
                        .createInstance(Components.interfaces.nsISound);
  if (soundUrl)
    sound.play(gIOService.newURI(soundUrl, null, null));
  else
    sound.beep();
}
