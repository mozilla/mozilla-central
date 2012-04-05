/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Varada Parthasarathi <varada@netscape.com>
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
/* Prerequisites:
   gServer - server.incomingServer defined in the calling page
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

const nsIFilePicker = Components.interfaces.nsIFilePicker;
const nsILocalFile = Components.interfaces.nsILocalFile;
const LOCALFILE_CTRID = "@mozilla.org/file/local;1";

function BrowseForLocalFolders()
{
  var currentFolderTextBox = document.getElementById("server.localPath");
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);

  fp.init(window,
          document.getElementById("browseForLocalFolder")
                  .getAttribute("filepickertitle"),
          nsIFilePicker.modeGetFolder);

  var currentFolder = Components.classes[LOCALFILE_CTRID]
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
    // IM server type does not have a .localPath
    if (currentServer.key == gServer.key || currentServer.type == "im")
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
 * @param target  nsIMsgFolder to format name for
 *                If target.isServer then only its name is returned.
 *                Otherwise return the name as <foldername> on <servername>.
 **/
function prettyFolderName(target)
{
  if (target.isServer)
    return target.prettyName;

  return document.getElementById("bundle_messenger")
                 .getFormattedString("verboseFolderFormat",
                                     [target.prettyName, target.server.prettyName]);
}
