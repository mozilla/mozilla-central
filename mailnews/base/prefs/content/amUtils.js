/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* Prerequisites:
   gServer - server.incomingServer defined in the calling page
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

function BrowseForLocalFolders()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  const nsILocalFile = Components.interfaces.nsILocalFile;

  var currentFolderTextBox = document.getElementById("server.localPath");
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  fp.init(window,
          document.getElementById("browseForLocalFolder")
                  .getAttribute("filepickertitle"),
          nsIFilePicker.modeGetFolder);

  var currentFolder = Components.classes["@mozilla.org/file/local;1"]
                                .createInstance(nsILocalFile);
  currentFolder.initWithPath(currentFolderTextBox.value);
  fp.displayDirectory = currentFolder;

  if (fp.show() != nsIFilePicker.returnOK)
    return;

  // Retrieve the selected folder.
  let selectedFolder = fp.file;

  // check that no other account/server has this same local directory
  let allServers = MailServices.accounts.allServers;
  for (let i = allServers.Count(); --i >= 0;) {
    let currentServer = allServers
      .QueryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
    if (currentServer.key == gServer.key)
      continue;

    if (currentServer.localPath.equals(selectedFolder)) {
      let dirAlreadyUsed = top.document.getElementById("bundle_prefs")
                              .getFormattedString("directoryUsedByOtherAccount",
                                                  [currentServer.prettyName]);
      Services.prompt.alert(window, null, dirAlreadyUsed);
      return;
    }
  }
  currentFolderTextBox.value = selectedFolder.path;
}

function hostnameIsIllegal(hostname)
{
  // XXX TODO do a complete check.
  // this only checks for illegal characters in the hostname
  // but hostnames like "...." and "_" and ".111" will get by
  // my test.  
  var validChars = hostname.match(/[A-Za-z0-9.-]/g);
  if (!validChars || (validChars.length != hostname.length)) {
    return true;
  }

  return false;
}

function trim(string)
{
  return string.trim();
}

/**
 * Return server/folder name formatted with server name if needed.
 *
 * @param aTargetFolder  nsIMsgFolder to format name for
 *                       If target.isServer then only its name is returned.
 *                       Otherwise return the name as "<foldername> on <servername>".
 */
function prettyFolderName(aTargetFolder)
{
  if (aTargetFolder.isServer)
    return aTargetFolder.prettyName;

  return document.getElementById("bundle_messenger")
                 .getFormattedString("verboseFolderFormat",
                                     [aTargetFolder.prettyName,
                                      aTargetFolder.server.prettyName]);
}
