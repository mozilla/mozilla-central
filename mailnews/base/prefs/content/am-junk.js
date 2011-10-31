/*
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2002
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#     Scott MacGregor <mscott@mozilla.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
*/

const KEY_ISP_DIRECTORY_LIST = "ISPDL";
var gPrefBranch = null;

function onInit(aPageId, aServerId)
{
  Components.utils.import("resource:///modules/mailServices.js");
  Components.utils.import("resource:///modules/iteratorUtils.jsm");

  // manually adjust several pref UI elements
  document.getElementById('spamLevel').checked =
    document.getElementById('server.spamLevel').value > 0;
    
  var spamActionTargetAccount = document.getElementById('server.spamActionTargetAccount').value;
  var am = Components.classes["@mozilla.org/messenger/account-manager;1"]
                     .getService(Components.interfaces.nsIMsgAccountManager);
  if (!spamActionTargetAccount)
  {
    var server = GetMsgFolderFromUri(aServerId, false).server;
    if (server.canCreateFoldersOnServer && server.canSearchMessages)
      spamActionTargetAccount = aServerId;
    else
      spamActionTargetAccount = am.localFoldersServer.serverURI;
    document.getElementById('server.spamActionTargetAccount').value = spamActionTargetAccount;
  }
  document.getElementById("actionAccountPopup")
          .selectFolder(GetMsgFolderFromUri(spamActionTargetAccount));
  var spamActionTargetFolder = document.getElementById('server.spamActionTargetFolder').value;
  if (!spamActionTargetFolder)
  {
    spamActionTargetFolder = am.localFoldersServer.serverURI + "/Junk";
    document.getElementById('server.spamActionTargetFolder').value = spamActionTargetFolder;
  }

  try
  {
    var folder = GetMsgFolderFromUri(spamActionTargetFolder);
    var longFolderName = document.getElementById("bundle_messenger")
                                 .getFormattedString("verboseFolderFormat",
                                 [folder.prettyName, folder.server.prettyName]);
    document.getElementById("actionTargetFolder")
            .setAttribute("label", longFolderName);
  }

  // OK for folder to not exist
  catch (e) {}

  var currentArray = [];
  if (document.getElementById("server.useWhiteList").checked)
    currentArray = document.getElementById("server.whiteListAbURI").value.split(" ");

  // set up the whitelist UI
  var wList = document.getElementById("whiteListAbURI");

  // Ensure the whitelist is empty
  while (wList.lastChild)
    wList.removeChild(wList.lastChild);

  // Populate the listbox with address books
  let abItems = [];
  for (let ab in fixIterator(MailServices.ab.directories,
                             Components.interfaces.nsIAbDirectory)) {
    // We skip mailing lists and remote address books.
    if (ab.isMailList || ab.isRemote)
      continue;

    let abItem = document.createElement("listitem");
    abItem.setAttribute("type", "checkbox");
    abItem.setAttribute("class", "listitem-iconic");
    abItem.setAttribute("label", ab.dirName);
    abItem.setAttribute("value", ab.URI);

    // Due to bug 448582, we have to use setAttribute to set the
    // checked value of the listitem.
    abItem.setAttribute("checked",  (currentArray.indexOf(ab.URI) != -1));

    abItems.push(abItem);
  }

  // Sort the list
  function sortFunc(a, b) {
    return a.getAttribute("label").toLowerCase()
           > b.getAttribute("label").toLowerCase();
  }

  abItems.sort(sortFunc);

  // And then append each item to the listbox
  for (let i = 0; i < abItems.length; i++)
    wList.appendChild(abItems[i]);

  // set up trusted IP headers
  var serverFilterList = document.getElementById("useServerFilterList");
  serverFilterList.value =
    document.getElementById("server.serverFilterName").value;
  if (!serverFilterList.selectedItem)
    serverFilterList.selectedIndex = 0;
   
  updateMoveTargetMode(document.getElementById('server.moveOnSpam').checked);

  // enable or disable the useServerFilter checkbox
  var checked = document.getElementById("server.useServerFilter").checked;
  onServerFilterToggle(checked);
}

function onPreInit(account, accountValues)
{
  gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService)
                          .getBranch("mail.server." +
                                      account.incomingServer.key + ".");
  buildServerFilterMenuList();
}

function updateMoveTargetMode(aEnable)
{
  if (aEnable)
    document.getElementById("broadcaster_moveMode").removeAttribute("disabled");
  else
    document.getElementById("broadcaster_moveMode").setAttribute("disabled", "true");

  updatePurgeSpam(aEnable, "purgeSpam");
  updatePurgeSpam(aEnable, "purgeSpamInterval");
}

function updatePurgeSpam(aEnable, aPref)
{
  if (!aEnable || gPrefBranch.prefIsLocked(aPref))
    document.getElementById("server." + aPref).setAttribute("disabled", "true");
  else
    document.getElementById("server." + aPref).removeAttribute("disabled");
}

function updateSpamLevel()
{
  document.getElementById('server.spamLevel').value =
    document.getElementById('spamLevel').checked ? 100 : 0;
}

// propagate changes to the server filter menu list back to 
// our hidden wsm element.
function onServerFilterListChange()
{
  document.getElementById('server.serverFilterName').value =
    document.getElementById("useServerFilterList").value;
}

/**
 * Called when someone checks or unchecks the server-filter checkbox.  We need
 * to enable or disable the menulist accordingly
 *
 * @param  the boolean value of the checkbox
 */
function onServerFilterToggle(aValue)
{
  document.getElementById("useServerFilterList").disabled = !aValue;
}

function onSave()
{
  onSaveWhiteList();
}

// propagate changes to the whitelist menu list back to
// our hidden wsm element.
function onSaveWhiteList()
{
  var wList = document.getElementById("whiteListAbURI");
  var wlArray = [];

  for (var i = 0; i < wList.getRowCount(); i++)
  {
    var wlNode = wList.getItemAtIndex(i);
    if (wlNode.checked) {
      let abURI = wlNode.getAttribute("value");
      wlArray.push(abURI);
    }
  }
  var wlValue = wlArray.join(" ");
  document.getElementById("server.whiteListAbURI").setAttribute("value", wlValue);
  document.getElementById("server.useWhiteList").checked = (wlValue != "");
}

function onActionTargetChange(aEvent, aWSMElementId)
{
  var folder = aEvent.target._folder;
  document.getElementById(aWSMElementId).value = folder.URI;
  var folderName;
  if (folder.isServer)
    folderName = folder.prettyName;
  else
    folderName = document.getElementById("bundle_messenger")
                         .getFormattedString("verboseFolderFormat",
                         [folder.prettyName, folder.server.prettyName]);
  aEvent.currentTarget.setAttribute("label", folderName);
}

function buildServerFilterMenuList()
{
  var fileLocator = Components.classes["@mozilla.org/file/directory_service;1"]
                              .getService(Components.interfaces.nsIProperties);
  // Now walk through the isp directories looking for sfd files
  var ispDirectories = fileLocator.get(KEY_ISP_DIRECTORY_LIST, Components.interfaces.nsISimpleEnumerator);
  while (ispDirectories.hasMoreElements()) 
  {
    var ispDirectory = ispDirectories.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (ispDirectory)
      buildServerFilterListFromDir(ispDirectory);
  }
}

// helper function called by buildServerFilterMenuList. Enumerates over the passed in
// directory looking for .sfd files. For each entry found, it gets appended to the menu list
function buildServerFilterListFromDir(aDir)
{
  var ispHeaderList = document.getElementById('useServerFilterList');

  // now iterate over each file in the directory looking for .sfd files
  var entries = aDir.directoryEntries.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);

  while (entries.hasMoreElements())
  {
    var entry = entries.nextFile;
    if (entry.isFile())
    {
      // we only care about files that end in .sfd
      if (entry.isFile() && /\.sfd$/.test(entry.leafName))
      {
        var fileName = RegExp.leftContext;
        // if we've already added an item with this name, then don't add it again.
        if (ispHeaderList.getElementsByAttribute("value", fileName).item(0))
          continue;
        ispHeaderList.appendItem(fileName, fileName);
      }
    }
  }
}
