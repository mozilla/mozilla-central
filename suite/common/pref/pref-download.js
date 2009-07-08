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

const kDesktop = 0;
const kDownloads = 1;
const kUserDir = 2;
var gFPHandler;

function Startup()
{
  // Define globals
  gFPHandler = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService)
                         .getProtocolHandler("file")
                         .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

  // if we don't have the alert service, hide the pref UI for using alerts to
  // notify on download completion
  // see bug #158711
  /* XXX: sound is to be reintroduced with bug 490467
  var downloadDoneNotificationAlertUI = document.getElementById("finishedNotificationAlert");
  downloadDoneNotificationAlertUI.hidden = !("@mozilla.org/alerts-service;1" in Components.classes);
  */
}

/**
  * Enables/disables the folder field and Browse button based on whether a
  * default download directory is being used.
  */
function ReadUseDownloadDir()
{
  var downloadFolder = document.getElementById("downloadFolder");
  var chooseFolder = document.getElementById("chooseFolder");
  var preference = document.getElementById("browser.download.useDownloadDir");
  downloadFolder.disabled = !preference.value;
  chooseFolder.disabled = !preference.value;
}

/**
  * Displays a file picker in which the user can choose the location where
  * downloads are automatically saved, updating preferences and UI in
  * response to the choice, if one is made.
  */
function ChooseFolder()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;

  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var title = prefutilitiesBundle.getString("downloadfolder");
  fp.init(window, title, nsIFilePicker.modeGetFolder);
  fp.appendFilters(nsIFilePicker.filterAll);

  var folderListPref = document.getElementById("browser.download.folderList");
  fp.displayDirectory = IndexToFolder(folderListPref.value); // file

  if (fp.show() == nsIFilePicker.returnOK) {
    var currentDirPref = document.getElementById("browser.download.dir");
    currentDirPref.value = fp.file;
    folderListPref.value = FolderToIndex(fp.file);
    // Note, the real prefs will not be updated yet, so dnld manager's
    // userDownloadsDirectory may not return the right folder after
    // this code executes. displayDownloadDirPref will be called on
    // the assignment above to update the UI.
  }
}

/**
  * Initializes the download folder display settings based on the user's
  * preferences.
  */
function DisplayDownloadDirPref()
{
  var folderListPref = document.getElementById("browser.download.folderList");
  var currentDirPref = IndexToFolder(folderListPref.value); // file
  var prefutilitiesBundle = document.getElementById("bundle_prefutilities");
  var iconUrlSpec = gFPHandler.getURLSpecFromFile(currentDirPref);
  var downloadFolder = document.getElementById("downloadFolder");
  downloadFolder.image = "moz-icon://" + iconUrlSpec + "?size=16";

  // Display a 'pretty' label or the path in the UI.
  switch (FolderToIndex(currentDirPref)) {
    case kDesktop:
      downloadFolder.label = prefutilitiesBundle.getString("desktopFolderName");
      break;
    case kDownloads:
      downloadFolder.label = prefutilitiesBundle.getString("downloadsFolderName");
      break;
    default:
      downloadFolder.label = currentDirPref ? currentDirPref.path : "";
      break;
  }
}

/**
  * Returns the Desktop folder.
  */
function GetDesktopFolder()
{
  return Components.classes["@mozilla.org/file/directory_service;1"]
                   .getService(Components.interfaces.nsIProperties)
                   .get("Desk", Components.interfaces.nsILocalFile);
}

/**
  * Returns the Downloads folder as determined by the XPCOM directory service
  * via the download manager's attribute defaultDownloadsDirectory.
  */
function GetDownloadsFolder()
{
  return Components.classes["@mozilla.org/download-manager;1"]
                   .getService(Components.interfaces.nsIDownloadManager)
                   .defaultDownloadsDirectory;
}

/**
  * Determines the type of the given folder.
  *
  * @param   aFolder
  *          the folder whose type is to be determined
  * @returns integer
  *          kDesktop if aFolder is the Desktop or is unspecified,
  *          kDownloads if aFolder is the Downloads folder,
  *          kUserDir otherwise
  */
function FolderToIndex(aFolder)
{
  if (!aFolder || aFolder.equals(GetDesktopFolder()))
    return kDesktop;
  if (aFolder.equals(GetDownloadsFolder()))
    return kDownloads;
  return kUserDir;
}

/**
  * Converts an integer into the corresponding folder.
  *
  * @param   aIndex
  *          an integer
  * @returns the Desktop folder if aIndex == kDesktop,
  *          the Downloads folder if aIndex == kDownloads,
  *          the folder stored in browser.download.dir
  */
function IndexToFolder(aIndex)
{
  var folder;
  switch (aIndex) {
    default:
      folder = document.getElementById("browser.download.dir").value;
      if (folder && folder.exists())
        return folder;
    case kDownloads:
      folder = GetDownloadsFolder();
      if (folder && folder.exists())
        return folder;
    case kDesktop:
      return GetDesktopFolder();
  }
}

/* XXX: sound is to be reintroduced with bug 490467
function SetSoundEnabled(aEnable)
{
  EnableElementById("downloadSndURL", aEnable, false);
  document.getElementById("downloadSndPreview").disabled = !aEnable;
}

function BrowseSound()
{
  var pref = document.getElementById("browser.download.finished_sound_url");

  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  const nsILocalFile = Components.interfaces.nsILocalFile;
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
*/
