/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains helper methods for dealing with nsIMsgFolders.
 */

const EXPORTED_SYMBOLS = ["getFolderProperties", "getSpecialFolderString",
                          "getFolderFromUri", "allAccountsSorted",
                          "getMostRecentFolders"];

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

/**
 * Returns a string representation of a folder's "special" type.
 *
 * @param aFolder  the nsIMsgFolder whose special type should be returned
 */
function getSpecialFolderString(aFolder) {
  const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
  let flags = aFolder.flags;
  if (flags & nsMsgFolderFlags.Inbox)
    return "Inbox";
  if (flags & nsMsgFolderFlags.Trash)
    return "Trash";
  if (flags & nsMsgFolderFlags.Queue)
    return "Outbox";
  if (flags & nsMsgFolderFlags.SentMail)
    return "Sent";
  if (flags & nsMsgFolderFlags.Drafts)
    return "Drafts";
  if (flags & nsMsgFolderFlags.Templates)
    return "Templates";
  if (flags & nsMsgFolderFlags.Junk)
    return "Junk";
  if (flags & nsMsgFolderFlags.Archive)
    return "Archive";
  if (flags & nsMsgFolderFlags.Virtual)
    return "Virtual";
  return "none";
}

/**
 * This function is meant to be used with trees. It returns the property list
 * for all of the common properties that css styling is based off of.
 *
 * @param aFolder  the folder whose properties should be returned as a string
 *
 * @return         A string of the property names, delimited by space.
 */
function getFolderProperties(aFolder) {
  const nsIMsgFolder = Components.interfaces.nsIMsgFolder;
  let properties = [];

  properties.push("folderNameCol");

  properties.push("serverType-" + aFolder.server.type);

  // set the SpecialFolder attribute
  properties.push("specialFolder-" + getSpecialFolderString(aFolder));

  // Now set the biffState
  switch (aFolder.biffState) {
    case nsIMsgFolder.nsMsgBiffState_NewMail:
      properties.push("biffState-NewMail");
      break;
    case nsIMsgFolder.nsMsgBiffState_NoMail:
      properties.push("biffState-NoMail");
      break;
    default:
      properties.push("biffState-UnknownMail");
  }

  properties.push("isSecure-" + aFolder.server.isSecure);

  if (aFolder.hasNewMessages)
    properties.push("newMessages-true");

  if (aFolder.isServer) {
    properties.push("isServer-true");
  }
  else
  {
    // We only set this if we're not a server
    let shallowUnread = aFolder.getNumUnread(false);
    if (shallowUnread > 0) {
      properties.push("hasUnreadMessages-true");
    }
    else
    {
      // Make sure that shallowUnread isn't negative
      shallowUnread = 0;
    }
    let deepUnread = aFolder.getNumUnread(true);
    if (deepUnread - shallowUnread > 0)
      properties.push("subfoldersHaveUnreadMessages-true");
  }

  properties.push("noSelect-" + aFolder.noSelect);
  properties.push("imapShared-" + aFolder.imapShared);

  return properties.join(" ");
}

/**
 * Returns a folder for a particular uri
 *
 * @param aUri  the rdf uri of the folder to return
 */
function getFolderFromUri(aUri) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  return Cc["@mozilla.org/mail/folder-lookup;1"].
         getService(Ci.nsIFolderLookupService).getFolderById(aUri);
}

/**
 * Returns the sort order value based on the server type to be used for sorting.
 * The servers (accounts) go in the following order:
 * (0) default account, (1) other mail accounts, (2) Local Folders,
 * (3) IM accounts, (4) RSS, (5) News, (9) others (no server)
 * This ordering is encoded in the .sortOrder property of each server type.
 *
 * @param aServer  the server object to be tested
 */
function getServerSortOrder(aServer) {
  // If there is no server sort this object to the end.
  if (!aServer)
    return 999999999;

  // Otherwise get the server sort order from the Account manager.
  return MailServices.accounts.getSortOrder(aServer);
}

/**
 * Compares the passed in accounts according to their precedence.
 */
function compareAccounts(aAccount1, aAccount2) {
  return getServerSortOrder(aAccount1.incomingServer)
           - getServerSortOrder(aAccount2.incomingServer);
}

/**
 * Returns a list of accounts sorted by server type.
 *
 * @param aExcludeIMAccounts  Remove IM accounts from the list?
 */
function allAccountsSorted(aExcludeIMAccounts) {
  // Get the account list, and add the proper items.
  let accountList = toArray(fixIterator(MailServices.accounts.accounts,
                                        Components.interfaces.nsIMsgAccount));

  // This is a HACK to work around bug 41133. If we have one of the
  // dummy "news" accounts there, that account won't have an
  // incomingServer attached to it, and everything will blow up.
  accountList = accountList.filter(function hasServer(a) {
    return a.incomingServer;
  });

  // Remove IM servers.
  if (aExcludeIMAccounts) {
    accountList = accountList.filter(function(a) {
      return a.incomingServer.type != "im";
    });
  }

  return accountList.sort(compareAccounts);
}

/**
 * Returns the most recently used/modified folders from the passed in list.
 *
 * @param aFolderList       The array of nsIMsgFolders to search for recent folders.
 * @param aMaxHits          How many folders to return.
 * @param aTimeProperty     Which folder time property to use.
 *                          Use "MRMTime" for most recently modified time.
 *                          Use "MRUTime" for most recently used time.
 */
function getMostRecentFolders(aFolderList, aMaxHits, aTimeProperty) {
  let recentFolders = [];

  /**
   * This sub-function will add a folder to the recentFolders array if it
   * is among the aMaxHits most recent. If we exceed aMaxHits folders,
   * it will pop the oldest folder, ensuring that we end up with the
   * right number.
   *
   * @param aFolder  The folder to check for recency.
   */
  let oldestTime = 0;
  function addIfRecent(aFolder) {
    let time = 0;
    try {
      time = Number(aFolder.getStringProperty(aTimeProperty)) || 0;
    } catch(e) {}
    if (time <= oldestTime)
      return;

    if (recentFolders.length == aMaxHits) {
      recentFolders.sort(function sort_folders_by_time(a, b) {
                         return a.time < b.time; });
      recentFolders.pop();
      oldestTime = recentFolders[recentFolders.length - 1].time;
    }
    recentFolders.push({ folder: aFolder, time: time });
  }

  for (let folder of aFolderList) {
    addIfRecent(folder);
  }

  return recentFolders.map(function (f) { return f.folder; });
}
