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

EXPORTED_SYMBOLS = ['GlodaIndexer'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");

Cu.import("resource://gloda/modules/utils.js");
Cu.import("resource://gloda/modules/datastore.js");
Cu.import("resource://gloda/modules/gloda.js");

function range(begin, end) {
  for (let i = begin; i < end; ++i) {
    yield i;
  }
}

// FROM STEEL
/**
 * This function will take a variety of xpcom iterators designed for c++ and turn
 * them into a nice JavaScript style object that can be iterated using for...in
 *
 * Currently, we support the following types of xpcom iterators:
 *   nsISupportsArray
 *   nsIEnumerator
 *   nsISimpleEnumerator
 *
 *   @param aEnum  the enumerator to convert
 *   @param aIface (optional) an interface to QI each object to prior to returning
 *
 *   @note This does *not* return an Array object.  It returns an object that can
 *         be use in for...in contexts only.  To create such an array, use
 *         var array = [a for (a in fixIterator(xpcomEnumerator))];
 */
function fixIterator(aEnum, aIface) {
  let face = aIface || Ci.nsISupports;
  // Try to QI our object to each of the known iterator types.  If the QI does
  // not throw, assign our iteration function
  try {
    aEnum.QueryInterface(Ci.nsISupportsArray);
    let iter = function() {
      let count = aEnum.Count();
      for (let i = 0; i < count; i++)
        yield aEnum.GetElementAt(i).QueryInterface(face);
    }
    return { __iterator__: iter };
  } catch(ex) {}
  
  // Now try nsIEnumerator
  try {
    aEnum.QueryInterface(Ci.nsIEnumerator);
    let done = false;
    let iter = function() {
      while (!done) {
        try {
          //rets.push(aEnum.currentItem().QueryInterface(face));
          yield aEnum.currentItem().QueryInterface(face);
          aEnum.next();
        } catch(ex) {
          done = true;
        }
      }
    };

    return { __iterator__: iter };
  } catch(ex) {}
  
  // how about nsISimpleEnumerator? this one is nice and simple
  try {
    aEnum.QueryInterface(Ci.nsISimpleEnumerator);
    let iter = function () {
      while (aEnum.hasMoreElements())
        yield aEnum.getNext().QueryInterface(face);
    }
    return { __iterator__: iter };
  } catch(ex) {}
}

let GlodaIndexer = {
  _datastore: GlodaDatastore,
  _log: Log4Moz.Service.getLogger("gloda.indexer"),

  indexEverything: function glodaIndexEverything() {
  
    this._log.info("Indexing Everything");
    let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].
                            getService(Ci.nsIMsgAccountManager);
    
    let blah = [this.indexAccount(account) for each
                (account in fixIterator(msgAccountManager.accounts,
                                        Ci.nsIMsgAccount))];

    this._log.info("Indexing Everything");
  },

  indexAccount: function glodaIndexAccount(aAccount) {
    this._log.info(">>> Indexing Account: " + aAccount.key);
    
    let rootFolder = aAccount.incomingServer.rootFolder;
    if (rootFolder instanceof Ci.nsIMsgFolder) {
      let blah = [this.indexFolder(folder) for each
                  (folder in fixIterator(rootFolder.subFolders, Ci.nsIMsgFolder))];
    }
    else {
      this._log.info("      Skipping Account, root folder not nsIMsgFolder");
    }
  
    this._log.info("<<< Indexing Account: " + aAccount.key);
  },

  indexFolder: function glodaIndexFolder(aFolder) {
    this._log.info("   >>> Indexing Folder: " + aFolder.prettiestName);
    for each (let msgHdr in fixIterator(aFolder.getMessages(null),
                                        Ci.nsIMsgDBHdr)) {
      this._log.info("      >>> Indexing Message: " + msgHdr.messageId +
                     " (" + msgHdr.subject + ")");
      this.indexMessage(msgHdr);
      this._log.info("      <<< Indexing Message: " + msgHdr.messageId);
    }
    this._log.info("   <<< Indexing Folder: " + aFolder.prettiestName);
  },
  
  /**
   * Attempt to extract the original subject from a message.  For replies, this
   *  means either taking off the 're[#]:' (or variant, including other language
   *  variants), or in a Microsoft specific-ism, from the Thread-Topic header.
   *
   * Ideally, we would just be able to call NS_MsgStripRE to do the bulk of the
   *  work for us, especially since the subject may be encoded.
   */
  _extractOriginalSubject: function glodaIndexExtractOriginalSubject(aMsgHdr) {
    // mailnews.localizedRe contains a comma-delimited list of alternate
    //  prefixes.
    // NS_MsgStripRE does this, and bug 139317 proposes adding this to
    //  nsIMimeConverter
    
    // HACK FIXME: for now, we just return the subject without any processing 
    return aMsgHdr.mime2DecodedSubject;
  },
  
  indexMessage: function glodaIndexMessage(aMsgHdr) {
  
    // -- Find/create the conversation the message belongs to.
    // Our invariant is that all messages that exist in the database belong to
    //  a conversation.
    
    // - See if any of the ancestors exist and have a conversationID...
    // (references are ordered from old [0] to new [n-1])
    let references = [aMsgHdr.getStringReference(i) for each
                      (i in range(0, aMsgHdr.numReferences))];
    // also see if we already know about the message...
    references.push(aMsgHdr.messageId);
    // (ancestors have a direct correspondence to the message id)
    let ancestors = this._datastore.getMessagesByMessageID(references);
    // pull our current message lookup results off
    references.pop();
    let curMsg = ancestors.pop();
    
    if (curMsg != null) {
      // we already know about the guy, which means he was either previously
      // a ghost or he is a duplicate...
      if (curMsg.messageKey != null) {
        this._log.warn("Attempting to re-index message: " + aMsgHdr.messageId
                        + " (" + aMsgHdr.subject + ")");
        return;
      } 
    }
    
    let conversationID = null;
    
    // (walk from closest to furthest ancestor)
    for (let iAncestor=ancestors.length-1; iAncestor >= 0; --iAncestor) {
      let ancestor = ancestors[iAncestor];
      
      if (ancestor != null) { // ancestor.conversationID cannot be null
        if (conversationID == null)
          conversationID = ancestor.conversationID;
        else if (conversationID != ancestor.conversationID)
          this._log.error("Inconsistency in conversations invariant on " +
                          ancestor.messageID + ".  It has conv id " +
                          ancestor.conversationID + " but expected " + 
                          conversationID);
      }
    }
    
    let conversation = null;
    if (conversationID == null) {
      // (the create method could issue the id, making the call return
      //  without waiting for the database...)
      conversation = this._datastore.createConversation(
          this._extractOriginalSubject(aMsgHdr), null, null);
      conversationID = conversation.id;
    }
    
    // Walk from furthest to closest ancestor, creating the ancestors that don't
    //  exist, and updating any to have correct parentID's if they don't have
    //  one.  (This is possible if previous messages that were consumed in this
    //  thread only had an in-reply-to or for some reason did not otherwise
    //  provide the full references chain.)
    let lastAncestorId = null;
    for (let iAncestor=0; iAncestor < ancestors.length; ++iAncestor) {
      let ancestor = ancestors[iAncestor];
      
      if (ancestor == null) {
        this._log.debug("creating message with: null, " + conversationID +
                        ", " + lastAncestorId + ", " + references[iAncestor] +
                        ", null.");
        ancestor = this._datastore.createMessage(null, null, // no folder loc
                                                 conversationID,
                                                 lastAncestorId,
                                                 references[iAncestor],
                                                 null); // no snippet
        ancestors[iAncestor] = ancestor;
      }
      else if (ancestor.parentID == null) {
        ancestor._parentID = lastAncestorId;
        this._datastore.updateMessage(ancestor);
      }
      
      lastAncestorId = ancestor.id;
    }
    // now all our ancestors exist, though they may be ghost-like...
    
    if (curMsg == null) {
      this._log.debug("creating message with: " + aMsgHdr.folder.URI +
                      ", " + conversationID +
                      ", " + lastAncestorId + ", " + aMsgHdr.messageId +
                      ", null.");
      curMsg = this._datastore.createMessage(aMsgHdr.folder.URI,
                                             aMsgHdr.messageKey,                
                                             conversationID,
                                             lastAncestorId,
                                             aMsgHdr.messageId,
                                             null); // no snippet
     }
     else {
        curMsg.folderURI = aMsgHdr.folder.URI;
        curMsg.messageKey = aMsgHdr.messageKey;
        this._datastore.updateMessage(curMsg);
     }
     
     Gloda.processMessage(curMsg, aMsgHdr);
  },
};
