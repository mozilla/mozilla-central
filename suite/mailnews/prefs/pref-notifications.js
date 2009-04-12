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
 * The Original Code is SeaMonkey project code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bruno Escherl <aqualon@aquachan.de>
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

// The contents of this file will be loaded into the scope of the object
// <prefpane id="notifications_pane">!

const nsIFileProtocolHandler = Components.interfaces.nsIFileProtocolHandler;

var gSound = null;
var gSoundUrlPref = null;
var gIOService = null;
var gFileHandler = null;

function Startup()
{
  // if we don't have the alert service, hide the pref UI for using alerts to notify on new mail
  // see bug #158711
  var newMailNotificationAlertUI = document.getElementById("newMailNotificationAlert");
  newMailNotificationAlertUI.hidden = !("@mozilla.org/alerts-service;1" in Components.classes);
  if (!/Mac/.test(navigator.platform))
    document.getElementById('newMailNotificationBounce').setAttribute("hidden", true);
  // show tray icon option currently available for Windows only
  var newMailNotificationTrayIconPref = document.getElementById("newMailNotificationTrayIcon");
  newMailNotificationTrayIconPref.hidden = !/^Win/.test(navigator.platform);

  gIOService = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService);
  gFileHandler = gIOService.getProtocolHandler("file")
                           .QueryInterface(nsIFileProtocolHandler);
  gSoundUrlPref = document.getElementById("mail.biff.play_sound.url");

  PlaySoundCheck(document.getElementById("mail.biff.play_sound").value);
}

function PlaySoundCheck(aPlaySound)
{
  let playSoundType = document.getElementById("mail.biff.play_sound.type").value;

  EnableElementById("newMailNotificationType", aPlaySound, false);
  EnableSoundURL(aPlaySound && (playSoundType == 1));
}

function EnableSoundURL(aEnable)
{
  EnableElementById("mailnewsSoundFileUrl", aEnable, false);
}

function SelectSound()
{
  var prefBundle = document.getElementById("bundle_prefutilities");

  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  fp.init(window, prefBundle.getString("choosesound"), nsIFilePicker.modeOpen);

  if (gSoundUrlPref.value != "")
    fp.displayDirectory = gFileHandler.getFileFromURLSpec(gSoundUrlPref.value).parent;

  fp.appendFilter(prefBundle.getString("SoundFiles"), "*.wav; *.wave");
  fp.appendFilters(nsIFilePicker.filterAll);

  if (fp.show() == nsIFilePicker.returnOK)
    gSoundUrlPref.value = fp.fileURL.spec;
}

function ReadSoundLocation(aElement)
{
  aElement.value = gSoundUrlPref.value;
  if (aElement.value)
    aElement.file = gFileHandler.getFileFromURLSpec(aElement.value);
}

function PreviewSound()
{
  if (!gSound)
    gSound = Components.classes["@mozilla.org/sound;1"]
                       .createInstance(Components.interfaces.nsISound);
  var soundURL = gSoundUrlPref.value;
  if (soundURL)
    gSound.play(gIOService.newURI(soundURL, null, null));
  else
    gSound.playSystemSound("_moz_mailbeep");
}
