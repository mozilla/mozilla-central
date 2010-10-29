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
 * The Original Code is the Thunderbird Feature Configurator.
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource:///modules/errUtils.js");
Cu.import("resource:///modules/iteratorUtils.jsm");
Cu.import("resource://gre/modules/DownloadUtils.jsm");

var gPrefBranch = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefBranch);


var AutoSyncConfigurator = {
  /**
   * Update the various text spans and radio buttons with the values we
   * calculate from the IMAP folders.
   */
  updateStatus: function as_updateStatus() {
    try {
      let allSync = true;
      let noneSync = true;
      let currentSize = 0;
      let estimatedSize = 0;
      let freeSpace = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch)
                        .getComplexValue("mail.root.imap-rel",
                                         Ci.nsIRelativeFilePref)
                        .file.diskSpaceAvailable;
      let sizeDifference = 0;

      let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                      getService(Ci.nsIMsgAccountManager).allServers;

      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (!(server instanceof Ci.nsIImapIncomingServer))
          continue;
        let allFolders = Cc["@mozilla.org/supports-array;1"].
                           createInstance(Ci.nsISupportsArray);

        server.rootFolder.ListDescendents(allFolders);
        for each (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
          if (folder.getFlag(Ci.nsMsgFolderFlags.Offline))
            noneSync = false;
          else
            allSync = false;
          let filePath = folder.filePath;
          filePath.initWithPath(filePath.path + ".msf");
          if (filePath.exists())
            currentSize += filePath.fileSize;
          estimatedSize += folder.sizeOnDisk;
        }
      }
      sizeDifference = estimatedSize - currentSize;

      let formatSize = function as_formatSize(aNumBytes) {
        let [size, unit] = DownloadUtils.convertByteUnits(aNumBytes);
        return size + " " + unit;
      }
      $("#free-space").text(formatSize(freeSpace));
      $("#current-size").text(formatSize(currentSize));
      $("#size-difference").text(formatSize(sizeDifference));

      // If we will leave <50MB or take up >50% of free space then warn.
      let newFreeSpace = freeSpace - sizeDifference;
      if (newFreeSpace < (1024 * 1024 * 50) || newFreeSpace < (freeSpace / 2))
        $("#disk-space-warning").show();
      else
        $("#disk-space-warning").hide();

      // Fix the issue where compacting will actually save you space
      if (sizeDifference <= 0)
        $("#disk-space-required").hide();

      // If we're ending up on someSync, then save the settings.
      // (We only want to save the settings for the someSync so that we can
      // switch back to them when the user re-chooses that option.)
      if (!allSync && !noneSync)
        this.saveSyncSettings();

      let sync = $("#some-sync");
      if (allSync)
        sync = $("#all-sync");
      else if (noneSync)
        sync = $("#none-sync");
      sync.click();

      // Make sure we can tell later that this is an automatic change, so
      // that we don't save the folder settings.
      $("#autosync-choice").data("automatic", true);
      sync.change();
    } catch (e) {
      logException(e);
    }
  },

  /**
   * Set the sync preferences based on the radio buttons.
   *
   * @param aSyncStatus the requested sync status.
   * @param aAutomatic true if this is the result of an automatic process
   *        (i.e. not as a result of the user choosing one of the options.)
   */
  setSyncStatus: function as_setSyncStatus(aSyncStatus, aAutomatic) {
    try {
      let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                      getService(Ci.nsIMsgAccountManager).allServers;

      let dataElem = $("#autosync-choice");
      let prevSyncStatus = dataElem.data("prevChecked");
      dataElem.data("prevChecked", aSyncStatus);

      // If the user clicked away from the "some" state, save off the
      // current state of the folders, so that we can restore it later.
      if (prevSyncStatus == "some" && !aAutomatic)
        this.saveFolderSyncSettings();

      let newSync = (aSyncStatus == "some") ?
                    this.syncPref :
                    (aSyncStatus == "all");
      gPrefBranch.setBoolPref("mail.server.default.autosync_offline_stores",
                              newSync);
      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (!(server instanceof Ci.nsIImapIncomingServer))
          continue;
        let subSettings = this.syncSettings[server.key];
        newSync = (aSyncStatus == "some") ?
                  subSettings["server"] :
                  (aSyncStatus == "all");
        server.offlineDownload = newSync;
        $("#" + server.key).toggleClass("syncing", newSync);
        let allFolders = Cc["@mozilla.org/supports-array;1"].
                           createInstance(Ci.nsISupportsArray);

        server.rootFolder.ListDescendents(allFolders);
        for each (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
          if (aSyncStatus == "some") {
            // Restore the state of the folders that we saved from before.
            if (subSettings["#" + folder.folderURL])
              folder.setFlag(Ci.nsMsgFolderFlags.Offline);
            else
              folder.clearFlag(Ci.nsMsgFolderFlags.Offline);
          }
          else {
            if (newSync)
              folder.setFlag(Ci.nsMsgFolderFlags.Offline);
            else
              folder.clearFlag(Ci.nsMsgFolderFlags.Offline);
          }
        }
      }
    } catch (e) {
      logException(e);
    }
  },

  /**
   * Update our copy of the syncSettings and syncPref with the current
   * values from the servers.
   */
  saveSyncSettings: function as_saveSyncSettings() {
    try {
      this.syncPref = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranch)
        .getBoolPref("mail.server.default.autosync_offline_stores");
      this.saveFolderSyncSettings();
    } catch (e) {
      logException(e);
    }
  },

  saveFolderSyncSettings: function as_saveFolderSyncSettings() {
    let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                    getService(Ci.nsIMsgAccountManager).allServers;

    for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
      if (!(server instanceof Ci.nsIImapIncomingServer))
        continue;
      let allFolders = Cc["@mozilla.org/supports-array;1"].
                         createInstance(Ci.nsISupportsArray);

      server.rootFolder.ListDescendents(allFolders);
      let subSettings = {"server": server.offlineDownload};
      for each (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
        subSettings["#" + folder.folderURL] =
            folder.getFlag(Ci.nsMsgFolderFlags.Offline);
      }
      this.syncSettings[server.key] = subSettings;
    }
  },

  onLoad: function as_onLoad() {
    let self = this;

    this.syncSettings = parent.gSubpageData.syncSettings;
    try {
      $("input[name='syncsettings']").change(function() {
        let dataElem = $("#autosync-choice");
        self.setSyncStatus($(this).val(), dataElem.data("automatic"));
        dataElem.removeData("automatic");
      });

      let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                      getService(Ci.nsIMsgAccountManager).allServers;

      let ul = $("#account_list");
      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (!(server instanceof Ci.nsIImapIncomingServer))
          continue;
        let li = $(document.createElement("li"))
                   .attr("id", server.key)
                   .addClass("button")
                   .text(server.prettyName);

        // Save the server into a local variable so that we can close over
        // it in the click callback and not always get the last server from
        // the for each loop.
        let aServer = server;
        li.click(function() {
          try {
            window.openDialog("chrome://messenger/content/AccountManager.xul",
                              "AccountManager",
                              "chrome,centerscreen,modal,titlebar",
                              {server: aServer, selectPage: "am-offline.xul"});
          } catch (e) {
            logException(e);
          }
          self.updateStatus();
        });
        ul.append(li);
      }
      // Save the current settings when we load this page.
      this.saveSyncSettings();
      self.updateStatus();
    } catch (e) {
      logException(e);
    }
  },
}
