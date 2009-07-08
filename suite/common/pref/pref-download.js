/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 *
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Manuel Reimer <Manuel.Reimer@gmx.de>
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

var gFPHandler;

function Startup()
{
  var pAutoDL = document.getElementById("browser.download.autoDownload");
  SetAutoDLEnabled(pAutoDL.value);
  var pDLSound = document.getElementById("browser.download.finished_download_sound");
  SetSoundEnabled(pDLSound.value);
 
  // Define globals
  gFPHandler = Components.classes["@mozilla.org/network/protocol;1?name=file"]
                         .getService(Components.interfaces.nsIFileProtocolHandler);

  // if we don't have the alert service, hide the pref UI for using alerts to
  // notify on download completion
  // see bug #158711
  var downloadDoneNotificationAlertUI = document.getElementById("finishedNotificationAlert");
  downloadDoneNotificationAlertUI.hidden = !("@mozilla.org/alerts-service;1" in Components.classes);
}

function SetAutoDLEnabled(aEnable)
{
  EnableElementById("downloadLocation", !aEnable, false);
}

function SetSoundEnabled(aEnable)
{
  EnableElementById("downloadSndURL", aEnable, false);
  document.getElementById("downloadSndPreview").disabled = !aEnable;
}

function ReadDLFolder(aField)
{
  var file = document.getElementById("browser.download.dir").value;
  if (file)
  {
    aField.file = file;
    aField.label = (/Mac/.test(navigator.platform)) ? file.leafName : file.path;
  }
}

function DownloadSelectFolder()
{
  var pref = document.getElementById("browser.download.dir");
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var title = prefutilitiesBundle.getString("downloadfolder");
  fp.init(window, title, nsIFilePicker.modeGetFolder);
  fp.displayDirectory = pref.value;
  fp.appendFilters(nsIFilePicker.filterAll);
  if (fp.show() == nsIFilePicker.returnOK)
    pref.value = fp.file;
}


function BrowseSound()
{
  var pref = document.getElementById("browser.download.finished_sound_url");

  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var title = prefutilitiesBundle.getString("choosesound");
  fp.init(window, title, nsIFilePicker.modeOpen);

  if (pref.value)
    fp.displayDirectory = gFPHandler.getFileFromURLSpec(pref.value)
                                    .parent.QueryInterface(nsILocalFile);

  var ftype = prefutilitiesBundle.getString("SoundFiles");
  fp.appendFilter(ftype, "*.wav; *.wave");
  fp.appendFilters(nsIFilePicker.filterAll);

  if (fp.show() == nsIFilePicker.returnOK)
    pref.value = fp.fileURL.spec;
}

function PreviewSound()
{
  var pref = document.getElementById("browser.download.finished_sound_url");
  var sound = Components.classes["@mozilla.org/sound;1"]
                        .createInstance(Components.interfaces.nsISound);

  if (pref.value)
  {
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    sound.play(ioservice.newURI(pref.value, null, null));
  }
  else
    sound.beep();
}

function ReadSndFile(aField)
{
  var pref = document.getElementById("browser.download.finished_sound_url");
  if (pref.value)
  {
    var file = gFPHandler.getFileFromURLSpec(pref.value);
    aField.file = file;
    aField.label = (/Mac/.test(navigator.platform)) ? file.leafName : file.path;
  }
}
