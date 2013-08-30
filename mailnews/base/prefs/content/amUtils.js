/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/MailUtils.js");

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

  // Check if the folder can be used for mail storage.
  if (!top.checkDirectoryIsUsable(selectedFolder))
    return;

  currentFolderTextBox.value = selectedFolder.path;
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

/**
 * Checks validity of junk target server name and folder.
 *
 * @param aTargetURI  the URI specification to check
 * @param aIsServer   true if the URI specifies only a server (without folder)
 *
 * @return  the value of aTargetURI if it is valid (usable), otherwise null
 */
function checkJunkTargetFolder(aTargetURI, aIsServer)
{
  try {
    // Does the target account exist?
    let targetServer = MailUtils.getFolderForURI(aTargetURI + (aIsServer ? "/Junk" : ""),
                                                 !aIsServer).server;

    // If the target server has deferred storage, Junk can't be stored into it.
    if (targetServer.rootFolder != targetServer.rootMsgFolder)
      return null;
  } catch (e) {
    return null;
  }

  return aTargetURI;
}

/**
 * Finds a usable target for storing Junk mail.
 * If the passed in server URI is not usable, choose Local Folders.
 *
 * @param aTargetURI  the URI of a server or folder to try first
 * @param aIsServer   true if the URI specifies only a server (without folder)
 *
 * @return  the server/folder URI of a usable target for storing Junk
 */
function chooseJunkTargetFolder(aTargetURI, aIsServer)
{
  let server = null;

  if (aTargetURI) {
    server = MailUtils.getFolderForURI(aTargetURI, false).server;
    if (!server.canCreateFoldersOnServer || !server.canSearchMessages ||
        (server.rootFolder != server.rootMsgFolder))
      server = null;
  }
  if (!server)
    server = MailServices.accounts.localFoldersServer;

  return server.serverURI + (!aIsServer ? "/Junk" : "");
}

/**
 * Fixes junk target folders if they point to an invalid/unusable (e.g. deferred)
 * folder/account. Only returns the new safe values. It is up to the caller
 * to push them to the proper elements/prefs.
 *
 * @param aSpamActionTargetAccount  The value of the server.*.spamActionTargetAccount pref value (URI).
 * @param aSpamActionTargetFolder   The value of the server.*.spamActionTargetFolder pref value (URI).
 * @param aProposedTarget           The URI of a new target to try.
 * @param aMoveTargetModeValue      The value of the server.*.moveTargetMode pref value (0/1).
 * @param aServerSpamSettings       The nsISpamSettings object of any server
 *                                  (used just for the MOVE_TARGET_MODE_* constants).
 * @param aMoveOnSpam               The server.*.moveOnSpam pref value (bool).
 *
 * @return  an array containing:
 *          newTargetAccount new safe junk target account
 *          newTargetAccount new safe junk target folder
 *          newMoveOnSpam    new moveOnSpam value
 */
function sanitizeJunkTargets(aSpamActionTargetAccount,
                             aSpamActionTargetFolder,
                             aProposedTarget,
                             aMoveTargetModeValue,
                             aServerSpamSettings,
                             aMoveOnSpam)
{
  // Check if folder targets are valid.
  aSpamActionTargetAccount = checkJunkTargetFolder(aSpamActionTargetAccount, true);
  if (!aSpamActionTargetAccount) {
    // If aSpamActionTargetAccount is not valid,
    // reset to default behavior to NOT move junk messages...
    if (aMoveTargetModeValue == aServerSpamSettings.MOVE_TARGET_MODE_ACCOUNT)
      aMoveOnSpam = false;

    // ... and find a good default target.
    aSpamActionTargetAccount = chooseJunkTargetFolder(aProposedTarget, true);
  }

  aSpamActionTargetFolder = checkJunkTargetFolder(aSpamActionTargetFolder, false);
  if (!aSpamActionTargetFolder) {
    // If aSpamActionTargetFolder is not valid,
    // reset to default behavior to NOT move junk messages...
    if (aMoveTargetModeValue == aServerSpamSettings.MOVE_TARGET_MODE_FOLDER)
      aMoveOnSpam = false;

    // ... and find a good default target.
    aSpamActionTargetFolder = chooseJunkTargetFolder(aProposedTarget, false);
  }

  return [ aSpamActionTargetAccount, aSpamActionTargetFolder, aMoveOnSpam ];
}

/**
 * Opens Preferences (Options) dialog on the Advanced pane, General tab
 * so that the user sees where the global receipts settings can be found.
 *
 * @param aTBPaneId     Thunderbird pref paneID to open.
 * @param aTBTabId      Thunderbird tabID to open.
 * @param aTBOtherArgs  Other arguments to send to the pref tab.
 * @param aSMPaneId     Seamonkey pref pane to open.
 */
function openPrefsFromAccountManager(aTBPaneId, aTBTabId, aTBOtherArgs, aSMPaneId) {
  let win = Services.wm.getMostRecentWindow("mail:3pane") ||
            Services.wm.getMostRecentWindow("mail:messageWindow") ||
            Services.wm.getMostRecentWindow("msgcompose");
  if (!win)
    return;

  // If openOptionsDialog() exists, we are in Thunderbird.
  if (typeof win.openOptionsDialog == "function")
    win.openOptionsDialog(aTBPaneId, aTBTabId, aTBOtherArgs);
  // If goPreferences() exists, we are in Seamonkey.
  if (typeof win.goPreferences == "function")
    win.goPreferences(aSMPaneId);
}
