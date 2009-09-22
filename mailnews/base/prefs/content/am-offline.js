/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   dianesun@netscape.com
 *   dascher@mozillamessaging.com
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

var gIncomingServer;
var gServerType;
var gImapIncomingServer;
var gPref = null;
var gLockedPref = null;
var gOfflineMap = null; // map of folder URLs to offline flags

function onInit(aPageId, aServerId) 
{
    onLockPreference();	

    // init values here
    initServerSettings();
    initRetentionSettings();
    initDownloadSettings();
    initOfflineSettings();

    onCheckItem("offline.notDownloadMin", "offline.notDownload");
    onCheckItem("nntp.downloadMsgMin", "nntp.downloadMsg");
    onCheckItem("nntp.removeBodyMin", "nntp.removeBody");
    onCheckKeepMsg();
}

function initOfflineSettings()
{
    checkOffline();
    gOfflineMap = collectOfflineFolders();
}

function initServerSettings()
{
    document.getElementById("offline.notDownload").checked =  gIncomingServer.limitOfflineMessageSize;
    if(gIncomingServer.maxMessageSize > 0)
        document.getElementById("offline.notDownloadMin").setAttribute("value", gIncomingServer.maxMessageSize);
    else
        document.getElementById("offline.notDownloadMin").setAttribute("value", "50");

    if(gServerType == "imap") {
        gImapIncomingServer = gIncomingServer.QueryInterface(Components.interfaces.nsIImapIncomingServer);
        document.getElementById("offline.folders").checked =  gImapIncomingServer.offlineDownload;
    }
}
  
function initRetentionSettings()
{
    var retentionSettings =  gIncomingServer.retentionSettings; 
    initCommonRetentionSettings(retentionSettings);

    document.getElementById("nntp.removeBody").checked =  retentionSettings.cleanupBodiesByDays;
    if(retentionSettings.daysToKeepBodies > 0)
        document.getElementById("nntp.removeBodyMin").setAttribute("value", retentionSettings.daysToKeepBodies);
    else
        document.getElementById("nntp.removeBodyMin").setAttribute("value", "30");
}


function initDownloadSettings()
{
    var downloadSettings =  gIncomingServer.downloadSettings;
    document.getElementById("nntp.downloadMsg").checked = downloadSettings.downloadByDate;
    document.getElementById("nntp.notDownloadRead").checked = downloadSettings.downloadUnreadOnly;
    if(downloadSettings.ageLimitOfMsgsToDownload > 0)
        document.getElementById("nntp.downloadMsgMin").setAttribute("value", downloadSettings.ageLimitOfMsgsToDownload);
    else
        document.getElementById("nntp.downloadMsgMin").setAttribute("value", "30");
 
  // Figure out what the most natural division of the autosync pref into
  // a value and an interval is.
  let autosyncInterval = document.getElementById("autosyncInterval");
  let autosyncValue = document.getElementById("autosyncValue");
  let autosyncPref = document.getElementById("imap.autoSyncMaxAgeDays");
  let autosyncPrefValue = (autosyncPref.value == "") ? -1 :
                                               parseInt(autosyncPref.value, 10);

  // Clear the preference until we're done initializing.
  autosyncPref.value = "";

  if (autosyncPrefValue <= 0) {
    // Special-case values <= 0 to have an interval of "All" and a disabled
    // value of the positive version of the preference, so we don't lose
    // the last value the user typed.
    autosyncInterval.value = 0;
    autosyncValue.value = 31;
    autosyncValue.disabled = true;
  }
  else {
    // Otherwise, get the list of possible intervals, in order from
    // largest to smallest.
    let valuesToTest = [];
    for (let i = autosyncInterval.itemCount - 1; i >= 0; i--)
      valuesToTest.push(autosyncInterval.getItemAtIndex(i).value);

    // and find the first one that divides the preference evenly.
    for (let i in valuesToTest) {
      if (!(autosyncPrefValue % valuesToTest[i])) {
        autosyncInterval.value = valuesToTest[i];
        autosyncValue.value = autosyncPrefValue / autosyncInterval.value;
        break;
      }
    }
  }
  autosyncPref.value = autosyncPrefValue;
}


function onPreInit(account, accountValues)
{
  gServerType = getAccountValue(account, accountValues, "server", "type", null, false);
  hideShowControls(gServerType);
  gIncomingServer = account.incomingServer;
  gIncomingServer.type = gServerType;

  // 10 is OFFLINE_SUPPORT_LEVEL_REGULAR, see nsIMsgIncomingServer.idl
  // currently, there is no offline without diskspace
  var titleStringID = (gIncomingServer.offlineSupportLevel >= 10) ?
   "prefPanel-synchronization" : "prefPanel-diskspace";

  var prefBundle = document.getElementById("bundle_prefs");
  var headertitle = document.getElementById("headertitle");
  headertitle.setAttribute('title',prefBundle.getString(titleStringID));
  document.title = prefBundle.getString(titleStringID);

  if (gServerType == "pop3") {
    var pop3Server = gIncomingServer.QueryInterface(Components.interfaces.nsIPop3IncomingServer);
    // hide retention settings for deferred accounts
    if (pop3Server.deferredToAccount.length) {
      var retentionRadio = document.getElementById("retention.keepMsg");
      retentionRadio.setAttribute("hidden", "true");
      var retentionLabel = document.getElementById("retentionDescriptionPop");
      retentionLabel.setAttribute("hidden", "true");
      var applyToFlaggedCheckbox = document.getElementById("retention.applyToFlagged");
      applyToFlaggedCheckbox.setAttribute("hidden", "true");
    }
  }
}

function onClickSelect()
{
   
    top.window.openDialog("chrome://messenger/content/msgSelectOffline.xul", "", "centerscreen,chrome,modal,titlebar,resizable=yes");
    return true;

}

/**
 * Handle updates to the Autosync
 */
function onAutosyncChange()
{
  let autosyncInterval = document.getElementById("autosyncInterval");
  let autosyncValue = document.getElementById("autosyncValue");
  let autosyncPref = document.getElementById("imap.autoSyncMaxAgeDays");

  // If we're not done initializing, don't do anything.
  // (See initDownloadSettings() for more details.)
  if (autosyncPref.value == "")
    return;

  // If the user selected the All option, disable the autosync and the
  // textbox.
  if (autosyncInterval.value == 0) {
    autosyncPref.value = -1;
    autosyncValue.disabled = true;
    return;
  }

  let max = 0x7FFFFFFF / (60 * 60 * 24 * autosyncInterval.value);
  autosyncValue.setAttribute("max", max);
  if (autosyncValue.value > max)
    autosyncValue.value = Math.floor(max);

  autosyncValue.disabled = false;
  autosyncPref.value = autosyncValue.value * autosyncInterval.value;
}

function onCancel()
{
    // restore the offline flags for all folders
    restoreOfflineFolders(gOfflineMap);
    return true;
}

function onSave()
{
    var downloadSettings =
      Components.classes["@mozilla.org/msgDatabase/downloadSettings;1"]
                .createInstance(Components.interfaces.nsIMsgDownloadSettings);

    gIncomingServer.limitOfflineMessageSize = document.getElementById("offline.notDownload").checked;
    gIncomingServer.maxMessageSize = document.getElementById("offline.notDownloadMin").value;

    var retentionSettings = saveCommonRetentionSettings(gIncomingServer.retentionSettings);

    retentionSettings.daysToKeepBodies = document.getElementById("nntp.removeBodyMin").value;
    retentionSettings.cleanupBodiesByDays = document.getElementById("nntp.removeBody").checked;

    downloadSettings.downloadByDate = document.getElementById("nntp.downloadMsg").checked;
    downloadSettings.downloadUnreadOnly = document.getElementById("nntp.notDownloadRead").checked;
    downloadSettings.ageLimitOfMsgsToDownload = document.getElementById("nntp.downloadMsgMin").value;

    gIncomingServer.retentionSettings = retentionSettings;
    gIncomingServer.downloadSettings = downloadSettings;

    if (gImapIncomingServer) {
        // Set the pref on the incomingserver, and set the flag on all folders.
        gImapIncomingServer.offlineDownload = document.getElementById("offline.folders").checked;
    }
}

// Does the work of disabling an element given the array which contains xul id/prefstring pairs.
// Also saves the id/locked state in an array so that other areas of the code can avoid
// stomping on the disabled state indiscriminately.
function disableIfLocked( prefstrArray )
{
    if (!gLockedPref)
      gLockedPref = new Array;

    for (var i=0; i<prefstrArray.length; i++) {
        var id = prefstrArray[i].id;
        var element = document.getElementById(id);
        if (gPref.prefIsLocked(prefstrArray[i].prefstring)) {
            element.disabled = true;
            gLockedPref[id] = true;
        } else {
            element.removeAttribute("disabled");
            gLockedPref[id] = false;
        }
    }
}

// Disables xul elements that have associated preferences locked.
function onLockPreference()
{
    var isDownloadLocked = false;
    var isGetNewLocked = false;
    var initPrefString = "mail.server"; 
    var finalPrefString; 

    var prefService = Components.classes["@mozilla.org/preferences-service;1"];
    prefService = prefService.getService();
    prefService = prefService.QueryInterface(Components.interfaces.nsIPrefService);

    // This panel does not use the code in AccountManager.js to handle
    // the load/unload/disable.  keep in mind new prefstrings and changes
    // to code in AccountManager, and update these as well.
    var allPrefElements = [
      { prefstring:"limit_offline_message_size", id:"offline.notDownload"},
      { prefstring:"max_size", id:"offline.notDownloadMin"},
      { prefstring:"downloadUnreadOnly", id:"nntp.notDownloadRead"},
      { prefstring:"downloadByDate", id:"nntp.downloadMsg"},
      { prefstring:"ageLimit", id:"nntp.downloadMsgMin"},
      { prefstring:"retainBy", id:"retention.keepMsg"},
      { prefstring:"daysToKeepHdrs", id:"retention.keepOldMsgMin"},
      { prefstring:"numHdrsToKeep", id:"retention.keepNewMsgMin"},
      { prefstring:"keepUnreadOnly", id:"retention.keepUnread"},
      { prefstring:"daysToKeepBodies", id:"nntp.removeBodyMin"},
      { prefstring:"cleanupBodies", id:"nntp.removeBody" },
      { prefstring:"applyToFlagged", id:"retention.applyToFlagged"},
      { prefstring:"disable_button.selectFolder", id:"selectNewsgroupsButton"},
      { prefstring:"disable_button.selectFolder", id:"selectImapFoldersButton"}
    ];

    finalPrefString = initPrefString + "." + gIncomingServer.key + ".";
    gPref = prefService.getBranch(finalPrefString);

    disableIfLocked( allPrefElements );
} 

function onCheckItem(changeElementId, checkElementId)
{
    var element = document.getElementById(changeElementId);
    var checked = document.getElementById(checkElementId).checked;
    if(checked && !gLockedPref[checkElementId] ) {
        element.removeAttribute("disabled");
    }
    else {
        element.setAttribute("disabled", "true");
    }
}

function checkOffline()
{
    var offline = document.getElementById("offline.folders").checked;
    var folderPickerButton = document.getElementById('selectImapFoldersButton');
    folderPickerButton.disabled = !offline;
}

function toggleOffline()
{
    checkOffline();
    var offline = document.getElementById("offline.folders").checked;
    var rootFolder = gIncomingServer.rootFolder;
    var allFolders = Components.classes["@mozilla.org/supports-array;1"]
                               .createInstance(Components.interfaces.nsISupportsArray);
    rootFolder.ListDescendents(allFolders);
    var numFolders = allFolders.Count();
    var folder;
    for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
    {
      folder = allFolders.QueryElementAt(folderIndex,
                                         Components.interfaces.nsIMsgFolder);
      if (offline)
        folder.setFlag(Components.interfaces.nsMsgFolderFlags.Offline);
      else
        folder.clearFlag(Components.interfaces.nsMsgFolderFlags.Offline);
    }
    
}

function collectOfflineFolders()
{
    var offlineFolderMap = {};
    var rootFolder = gIncomingServer.rootFolder;
    var allFolders = Components.classes["@mozilla.org/supports-array;1"]
                               .createInstance(Components.interfaces.nsISupportsArray);
    rootFolder.ListDescendents(allFolders);
    var numFolders = allFolders.Count();
    var folder;
    for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
    {
      folder = allFolders.QueryElementAt(folderIndex,
                                         Components.interfaces.nsIMsgFolder);
      offlineFolderMap[folder.folderURL] = folder.getFlag(Components.interfaces.nsMsgFolderFlags.Offline);
    }
    return offlineFolderMap;
}

function restoreOfflineFolders(offlineFolderMap)
{
    var rootFolder = gIncomingServer.rootFolder;
    var allFolders = Components.classes["@mozilla.org/supports-array;1"]
                               .createInstance(Components.interfaces.nsISupportsArray);
    rootFolder.ListDescendents(allFolders);
    var numFolders = allFolders.Count();
    var folder;
    for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
    {
      folder = allFolders.QueryElementAt(folderIndex,
                                         Components.interfaces.nsIMsgFolder);
      if (offlineFolderMap[folder.folderURL])
        folder.setFlag(Components.interfaces.nsMsgFolderFlags.Offline);
      else
        folder.clearFlag(Components.interfaces.nsMsgFolderFlags.Offline);
    }
}
