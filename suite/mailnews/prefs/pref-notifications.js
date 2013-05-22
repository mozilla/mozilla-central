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
  var newMailNotificationAlertUI = document.getElementById("newMailNotificationAlertBox");
  newMailNotificationAlertUI.hidden = !("@mozilla.org/alerts-service;1" in Components.classes);

  // as long as the old notification code is still around, the new options
  // won't apply if mail.biff.show_new_alert is false and should be hidden
  document.getElementById("showAlertPreviewText").hidden =
  document.getElementById("showAlertSubject").hidden =
  document.getElementById("showAlertSender").hidden =
    !Services.prefs.getBoolPref("mail.biff.show_new_alert");

  // animate dock icon option currently available for Mac OSX only
  var newMailNotificationBouncePref = document.getElementById("newMailNotificationBounceBox");
  newMailNotificationBouncePref.hidden = !navigator.platform.startsWith("Mac");

  // show tray icon option currently available for Windows only
  var newMailNotificationTrayIconPref = document.getElementById("newMailNotificationTrayIconBox");
  newMailNotificationTrayIconPref.hidden = !navigator.platform.startsWith("Win");

  EnableAlert(document.getElementById("mail.biff.show_alert").value, false);
  EnableTrayIcon(document.getElementById("mail.biff.show_tray_icon").value);

  gSoundUrlPref = document.getElementById("mail.biff.play_sound.url");

  PlaySoundCheck(document.getElementById("mail.biff.play_sound").value);
}

function EnableAlert(aEnable, aFocus)
{
  // switch off the balloon if the user wants regular alerts
  if (aEnable)
  {
    let balloonAlert = document.getElementById("mail.biff.show_balloon");
    if (!balloonAlert.locked)
      balloonAlert.value = false;
  }

  EnableElementById("showAlertTime", aEnable, aFocus);
  EnableElementById("showAlertPreviewText", aEnable, false);
  EnableElementById("showAlertSubject", aEnable, false);
  EnableElementById("showAlertSender", aEnable, false);
}

function EnableTrayIcon(aEnable)
{
  EnableElementById("newMailNotificationBalloon", aEnable, false);
}

function ClearAlert(aEnable)
{
  // switch off the regular alerts if the user wants the balloon
  if (aEnable)
  {
    let showAlert = document.getElementById("mail.biff.show_alert");
    if (!showAlert.locked)
      showAlert.value = false;
  }
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
