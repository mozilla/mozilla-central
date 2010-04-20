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

Cu.import("resource://app/modules/errUtils.js");
Cu.import("resource://gre/modules/iteratorUtils.jsm");
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

      this.updateSyncSettings();

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

      let sync = $("#some-sync");
      if (allSync)
        sync = $("#all-sync");
      else if (noneSync)
        sync = $("#none-sync");
      sync.click();
      sync.change();
    } catch (e) {
      logException(e);
    }
  },

  /**
   * Set the sync preferences based on the radio buttons.
   *
   * @param aSyncStatus the requested sync status.
   */
  setSyncStatus: function as_setSyncStatus(aSyncStatus) {
    try {
      let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                      getService(Ci.nsIMsgAccountManager).allServers;

      let newSync = (aSyncStatus == "some") ?
                    this.syncPref :
                    (aSyncStatus == "all");
      gPrefBranch.setBoolPref("mail.server.default.autosync_offline_stores",
                              newSync);
      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (!(server instanceof Ci.nsIImapIncomingServer))
          continue;
        let allFolders = Cc["@mozilla.org/supports-array;1"].
                           createInstance(Ci.nsISupportsArray);

        newSync = (aSyncStatus == "some") ?
                  this.syncSettings[server.key] :
                  (aSyncStatus == "all");
        server.offlineDownload = newSync;
        server.rootFolder.ListDescendents(allFolders);
        for each (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
          if (newSync)
            folder.setFlag(Ci.nsMsgFolderFlags.Offline);
          else
            folder.clearFlag(Ci.nsMsgFolderFlags.Offline);
        }
        $("#" + server.key).toggleClass("syncing", newSync);
      }
    } catch (e) {
      logException(e);
    }
  },

  /**
   * Update our copy of the syncSettings and syncPref with the current
   * values from the servers.
   */
  updateSyncSettings: function as_updateSyncSettings() {
    try {
      this.syncPref = Cc["@mozilla.org/preferences-service;1"]
        .getService(Ci.nsIPrefBranch)
        .getBoolPref("mail.server.default.autosync_offline_stores");
      let servers = Cc["@mozilla.org/messenger/account-manager;1"].
                      getService(Ci.nsIMsgAccountManager).allServers;

      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (!(server instanceof Ci.nsIImapIncomingServer))
          continue;
        this.syncSettings[server.key] = server.offlineDownload;
      }
    } catch (e) {
      logException(e);
    }
  },

  onLoad: function as_onLoad() {
    let self = this;

    this.syncSettings = parent.gSubpageData.syncSettings;
    try {
      $("input[name='syncsettings']").change(function() {
        self.setSyncStatus($(this).val());
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
      self.updateStatus();
    } catch (e) {
      logException(e);
    }
  },
}
