/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *   Joey Minta <jminta@gmail.com>
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

/*
 * This file provides a number of methods for modifying (synthetic) messages
 *  for testing purposes.
 */

Components.utils.import("resource://app/modules/iteratorUtils.jsm");

/**
 * Represents a set of synthetic messages, also supporting insertion into and
 *  tracking of the message folders to which they belong.  This then allows
 *  mutations of the messages (in their folders) for testing purposes.
 *
 * In general, you would create a synthetic message set by passing in only a
 *  list of synthetic messages, and then add then messages to nsIMsgFolders by
 *  using one of the addMessage* methods.  This will populate the aMsgFolders
 *  and aFolderIndices values.  (They are primarily intended for reasons of
 *  slicing, but people who know what they are doing can also use them.)
 *
 * @param aSynMessage The synthetic messages that should belong to this set.
 * @param aMsgFolders Optional nsIMsgDBFolder or list of folders.
 * @param aFolderIndices Optional list where each value is an index into the
 *     msgFolders attribute, specifying what folder the message can be found
 *     in.  The value may also be null if the message has not yet been
 *     inserted into a folder.
 */
function SyntheticMessageSet(aSynMessages, aMsgFolders, aFolderIndices) {
  this.synMessages = aSynMessages;

  if (aMsgFolders == null)
    this.msgFolders = [];
  else if (!('length' in aMsgFolders))
    this.msgFolders = [aMsgFolders];
  else
    this.msgFolders = aMsgFolders;

  if (aFolderIndices == null)
    this.folderIndices = [null for each (blah in Iterator(aSynMessages))];
  else
    this.folderIndices = aFolderIndices;
}
SyntheticMessageSet.prototype = {
  addMessageToFolderByIndex: function(aFolder, aMessageIndex) {
    let aFolderIndex = this.msgFolders.indexOf(aFolder);
    if (aFolderIndex == -1)
      aFolderIndex = this.msgFolders.push(aFolder) - 1;
    this.folderIndices[aMessageIndex] = aFolderIndex;
    aFolder.addMessage(this.synMessages[aMessageIndex].toMboxString());
  },
  /**
   * Union this set with another set and return the (new) result.
   *
   * @param aOtherSet The other synthetic message set.
   * @returns a new SyntheticMessageSet containing the union of this set and
   *     the other set.
   */
  union: function(aOtherSet) {
    let messages = this.synMessages.concat(aOtherSet.synMessages);
    let folders = this.msgFolders.concat();
    let indices = this.folderIndices.concat();

    let folderUrisToIndices = {};
    for each (let [iFolder, folder] in Iterator(this.msgFolders)) {
      folderUrisToIndices[folder.URI] = iFolder;
    }

    for (let iOther = 0; iOther < aOtherSet.synMessages.length; iOther++) {
      let folderIndex = aOtherSet.folderIndices[iOther];
      if (folderIndex == null) {
        indices.push(folderIndex);
      }
      else {
        let folder = aOtherSet.msgFolders[folderIndex];
        if (!(folder.URI in folderUrisToIndices)) {
          folderUrisToIndices[folder.URI] = folders.length;
          folders.push(folder);
        }
        indices.push(folderUrisToIndices[folder.URI]);
      }
    }

    return new SyntheticMessageSet(messages, folders, indices);
  },

  /**
   * @return a JS list of the message headers for all messages inserted into a
   *     folder.
   */
  get msgHdrs() {
    let msgDatabases = [folder.msgDatabase for each
                        ([, folder] in Iterator(this.msgFolders))];
    for (let [iMsg, synMsg] in Iterator(this.synMessages)) {
      let folderIndex = this.folderIndices[iMsg];
      if (folderIndex != null)
        yield msgDatabases[folderIndex].getMsgHdrForMessageID(synMsg.messageId);
    }
  },
  /**
   * @return an nsIMutableArray of the message headers for all messages inserted
   *     into a folder.
   */
  get xpcomHdrArray() {
    return toXPCOMArray(this.msgHdrs,
                        Components.interfaces.nsIMutableArray);
  },
  /**
   * @return a list where each item is a list with two elements; the first is
   *     an nsIMsgFolder, and the second is a list of all of the nsIMsgDBHdrs
   *     for the synthetic messages in the set inserted into that folder.
   */
  get foldersWithMsgHdrs() {
    let results = [[folder, []] for each
                   ([, folder] in Iterator(this.msgFolders))];
    for (let [iMsg, synMsg] in Iterator(this.synMessages)) {
      let folderIndex = this.folderIndices[iMsg];
      if (folderIndex != null) {
        let [folder, msgHdrs] = results[folderIndex];
        msgHdrs.push(folder.msgDatabase.getMsgHdrForMessageID(synMsg.messageId));
      }
    }
    return results;
  },
  /**
   * @return a generator that yields [nsIMsgFolder, nsIMutableArray of the
   *     messages from the set in that folder].
   */
  get foldersWithXpcomHdrArrays() {
    for (let [, [folder, msgHdrs]] in Iterator(this.foldersWithMsgHdrs)) {
      yield [folder, toXPCOMArray(msgHdrs,
                                  Components.interfaces.nsIMutableArray)];
    }
  },
  setRead: function(aRead) {
    for each (let msgHdr in this.msgHdrs) {
      msgHdr.markRead(aRead);
    }
  },
  setStarred: function(aStarred) {
    for each (let msgHdr in this.msgHdrs) {
      msgHdr.markFlagged(aRead);
    }
  },
  addTag: function(aTagName) {
    for (let [folder, xpcomHdrArray] in this.foldersWithXpcomHdrArrays) {
      folder.addKeywordsToMessages(xpcomHdrArray, aTagName);
    }
  },
  removeTag: function(aTagName) {
    for (let [folder, xpcomHdrArray] in this.foldersWithXpcomHdrArrays) {
      folder.removeKeywordsFromMessages(xpcomHdrArray, aTagName);
    }
  },
  /**
   * Sets the junk score for the messages to junk/non-junk.  It does not
   *  involve the bayesian classifier because we really don't want it
   *  affecting our unit tests!  (Unless we were testing the bayesian
   *  classifier.  Which I'm conveniently not.  Feel free to add a
   *  "setJunkForRealsies" method if you are.)
   */
  setJunk: function(aIsJunk) {
    let junkscore = aIsJunk ? "100" : "0";
    for each (let msgHdr in this.msgHdrs) {
      msgHdr.setStringProperty("junkscore", junkscore);
    };
  },

  /**
   * Slice the message set using the exact Array.slice semantics (because we
   *  call Array.slice).
   */
  slice: function() {
    let slicedMessages = this.synMessages.slice.apply(this.synMessages,
                                                      arguments);
    let slicedIndices = this.folderIndices.slice.apply(this.folderIndices,
                                                       arguments);
    return new SyntheticMessageSet(slicedMessages, this.msgFolders,
                                   slicedIndices);
  }
};
