/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The contents of this file will be loaded into the scope of the object
// <prefpane id="notifications_pane">!

var gSoundUrlPref = null;

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
