/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains helper methods for dealing with nsIMsgFolders.
 */

var EXPORTED_SYMBOLS = ["setPropertyAtoms", "getSpecialFolderString",
                        "getFolderFromUri"];

/**
 * Returns a string representation of a folder's "special" type
 *
 * @param aFolder  the nsIMsgFolder whose special type should be returned
 */
function getSpecialFolderString(aFolder) {
  const Ci = Components.interfaces;
  if (aFolder.flags & Ci.nsMsgFolderFlags.Inbox)
    return "Inbox";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Trash)
    return "Trash";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Queue)
    return "Outbox";
  if (aFolder.flags & Ci.nsMsgFolderFlags.SentMail)
    return "Sent";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Drafts)
    return "Drafts";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Templates)
    return "Templates";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Junk)
    return "Junk";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Archive)
    return "Archive";
  if (aFolder.flags & Ci.nsMsgFolderFlags.Virtual)
    return "Virtual";
  return "none";
}

/**
 * This function is meant to be used with trees. It adds atoms for all of the
 * common properties that css styling is based off of.
 *
 * @param aFolder     the folder whose properties should be added as atoms
 * @param aProperties the nsIProperties object where the atoms should be added
 */
function setPropertyAtoms(aFolder, aProperties) {
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  let atomSvc = Cc["@mozilla.org/atom-service;1"].getService(Ci.nsIAtomService);
  function addAtom(aName) {
    aProperties.AppendElement(atomSvc.getAtom(aName));
  }

  addAtom("folderNameCol");
  if (aFolder.getNumUnread(false) > 0)
    addAtom("hasUnreadMessages-true");

  if (aFolder.isServer)
    addAtom("isServer-true");

  addAtom("serverType-" + aFolder.server.type);

  // set the SpecialFolder attribute
  addAtom("specialFolder-" + getSpecialFolderString(aFolder));

  // Now set the biffState
  switch (aFolder.biffState) {
    case Ci.nsIMsgFolder.nsMsgBiffState_NewMail:
      addAtom("biffState-NewMail");
      break;
    case Ci.nsIMsgFolder.nsMsgBiffState_NoMail:
      addAtom("biffState-NoMail");
      break;
    default:
      addAtom("biffState-UnknownMail");
  }

  addAtom("isSecure-" + aFolder.server.isSecure);

  if (aFolder.hasNewMessages)
    addAtom("newMessages-true");

  // We only set this if we're not a server
  if (!aFolder.isServer) {
    let shallowUnread = aFolder.getNumUnread(false);
    // Make sure that shallowUnread isn't negative
    if (shallowUnread < 0)
      shallowUnread = 0;
    let deepUnread = aFolder.getNumUnread(true);
    if (deepUnread - shallowUnread > 0)
      addAtom("subfoldersHaveUnreadMessages-true");
  }

  addAtom("noSelect-" + aFolder.noSelect);
  addAtom("imapShared-" + aFolder.imapShared);
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
