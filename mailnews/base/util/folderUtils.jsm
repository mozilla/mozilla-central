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
 * The Original Code is mail folder code.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/**
 * This file contains helper methods for dealing with nsIMsgFolders.
 */

var EXPORTED_SYMBOLS = ["setPropertyAtoms", "getSpecialFolderString",
                        "getFolderFromUri"];

/**
 * Returns a string representation of a folder's "special" type
 *
 * @param aFolder  the folder whose special type should be returned
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
