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
  _msgwindow: null,
  _domWindow: null,

  _inited: false,
  init: function gloda_index_init(aDOMWindow, aMsgWindow) {
    if (this._inited)
      return;
    
    this._inited = true;
    
    this._domWindow = aDOMWindow;
    
    // topmostMsgWindow explodes for un-clear reasons if we have multiple
    //  windows open.  very sad.
    /*
    let mailSession = Cc["@mozilla.org/messenger/services/session;1"].
                        getService(Ci.nsIMsgMailSession);
    this._msgWindow = mailSession.topmostMsgWindow;
    */
    this._msgWindow = aMsgWindow;
  },

  /** Track whether indexing is active (we have timers in-flight). */
  _indexingActive: false,
  get indexing() { return this._indexingActive; },
  /** You can turn on indexing, but you can't turn it off! */
  set indexing(aShouldIndex) {
    if (!this._indexingActive && aShouldIndex) {
      this._indexingActive = true;
      this._domWindow.setTimeout(this._wrapIncrementalIndex, this._indexInterval, this);
    }  
  },
  
  /** The nsIMsgFolder we are indexing, or null if we aren't. */
  _indexingFolder: null,
  /** The iterator we are using to traverse _indexingFolder. */
  _indexingIterator: null,
  _indexingFolderCount: 0,
  _indexingFolderGoal: 0,
  _indexingMessageCount: 0,
  _indexingMessageGoal: 0,
  
  /**
   * A list of things yet to index.  Contents will be lists matching one of the
   *  following patterns:
   * - ['account', account object]
   * - ['folder', folder URI]
   * - ['message', delta type, message header, folder ID, message key,
   *      message ID]
   *   (we use folder ID instead of URI so that renames can't trick us)
   */
  _indexQueue: [],
  
  /**
   * The time interval, in milliseconds between performing indexing work.
   *  This may be altered by user session (in)activity.
   */ 
  _indexInterval: 100,
  /**
   * Number of indexing 'tokens' we are allowed to consume before yielding for
   *  each incremental pass.  Consider a single token equal to indexing a single
   *  medium-sized message.  This may be altered by user session (in)activity.
   */
  _indexTokens: 10,
  
  _indexListeners: [],
  /**
   * Add an indexing progress listener.  The listener will be notified of at
   *  least all major status changes (idle -> indexing, indexing -> idle), plus
   *  arbitrary progress updates during the indexing process.
   * If indexing is not active when the listener is added, a synthetic idle
   *  notification will be generated.
   *
   * @param aListener A listener function, taking arguments: status (string),
   *     folder name being indexed (string or null), current zero-based folder
   *     number being indexed (int), total number of folders to index (int),
   *     current message number being indexed in this folder (int), total number
   *     of messages in this folder to be indexed (int).
   */
  addListener: function gloda_index_addListener(aListener) {
    // should we weakify?
    if (this._indexListeners.indexOf(aListener) == -1)
      this._indexListeners.push(aListener);
    // if we aren't indexing, give them an idle indicator, otherwise they can
    //  just be happy when we hit the next actual status point.
    if (!this.indexing)
      aListener("Idle", null, 0, 1, 0, 1);
    return aListener;
  },
  removeListener: function gloda_index_removeListener(aListener) {
    let index = this._indexListeners.indexOf(aListener);
    if (index != -1)
      this._indexListeners(index, 1);
  },
  _notifyListeners: function gloda_index_notifyListeners(aStatus, aFolderName,
      aFolderIndex, aFoldersTotal, aMessageIndex, aMessagesTotal) {
    for (let iListener=this._indexListeners.length-1; iListener >= 0; 
         iListener--) {
      let listener = this._indexListeners[iListener];
      listener(aStatus, aFolderName, aFolderIndex, aFoldersTotal, aMessageIndex,
               aMessagesTotal);
    } 
  },
  
  _wrapIncrementalIndex: function gloda_index_wrapIncrementalIndex(aThis) {
    aThis.incrementalIndex();
  },
  
  incrementalIndex: function gloda_index_incrementalIndex() {
    this._log.debug("index wake-up!");
  
    GlodaDatastore._beginTransaction();
    try {
    
      for (let tokensLeft=this._indexTokens; tokensLeft > 0; tokensLeft--) {
        if (this._indexingFolder != null) {
          try {
            this._indexMessage(this._indexingIterator.next());
            this._indexingMessageCount++;
            
            if (this._indexingMessageCount % 50 == 1) {
              this._notifyListeners("Indexing: " +
                                    this._indexingFolder.prettiestName,
                                    this._indexingFolder.prettiestName,
                                    this._indexingFolderCount,
                                    this._indexingFolderGoal,
                                    this._indexingMessageCount,
                                    this._indexingMessageGoal);
              //this._log.debug("indexed " + this._indexingCount + " in " +
              //                this._indexingFolder.prettiestName);
            }
          }
          catch (ex) {
            this._log.debug("Done with indexing folder because: " + ex);
            this._indexingFolder = null;
            this._indexingIterator = null;
          }
        }
        else if (this._indexQueue.length) {
          let item = this._indexQueue.shift();
          let itemType = item[0];
          
          if (itemType == "account") {
            this.indexAccount(item[1]);
          }
          else if (itemType == "folder") {
            let folderURI = item[1];
            
            this._log.debug("Folder URI: " + folderURI);
  
            let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                             getService(Ci.nsIRDFService);
            let folder = rdfService.GetResource(folderURI);
            if (folder instanceof Ci.nsIMsgFolder) {
              this._indexingFolder = folder;
  
              this._log.debug("Starting indexing of folder: " +
                              folder.prettiestName);
  
              // The msf may need to be created or otherwise updated, updateFolder will
              //  do this for us.  (GetNewMessages would also do it, but we would be
              //  triggering new message retrieval in that case, which we don't actually
              //  desire.
              // TODO: handle password-protected local cache potentially triggering a
              //  password prompt here...
              try {
                //this._indexingFolder.updateFolder(this._msgWindow);
              
                let msgDatabase = folder.getMsgDatabase(this._msgWindow);
                this._indexingIterator = Iterator(fixIterator(
                                           //folder.getMessages(this._msgWindow),
                                           msgDatabase.EnumerateMessages(),
                                           Ci.nsIMsgDBHdr));
                this._indexingFolderCount++;
                this._indexingMessageCount = 0;
                this._indexingMessageGoal = folder.getTotalMessages(false); 
              }
              catch (ex) {
                this._log.error("Problem indexing folder: " +
                                folder.prettiestName + ", skipping.");
                this._log.error("Error was: " + ex);
                this._indexingFolder = null;
                this._indexingIterator = null;
              }
            }
          }
        }
        else {
          this._log.info("Done indexing, disabling timer renewal.");
          this._indexingActive = false;
          this._indexingFolderCount = 0;
          this._indexingFolderGoal = 0;
          this._indexingMessageCount = 0;
          this._indexingMessageGoal = 0;
          this._notifyListeners("Idle", null, 0, 1, 0, 1);
          break;
        }
      }
    
    }
    finally {
      GlodaDatastore._commitTransaction();
    
      if (this.indexing)
        this._domWindow.setTimeout(this._wrapIncrementalIndex, this._indexInterval,
                                this);
    }
  },

  indexEverything: function glodaIndexEverything() {
    this._log.info("Queueing all accounts for indexing.");
    let msgAccountManager = Cc["@mozilla.org/messenger/account-manager;1"].
                            getService(Ci.nsIMsgAccountManager);
    
    let sideEffects = [this.indexAccount(account) for each
                       (account in fixIterator(msgAccountManager.accounts,
                                               Ci.nsIMsgAccount))];
  },

  indexAccount: function glodaIndexAccount(aAccount) {
    let rootFolder = aAccount.incomingServer.rootFolder;
    if (rootFolder instanceof Ci.nsIMsgFolder) {
      this._log.info("Queueing account folders for indexing: " + aAccount.key);

      let folders =
              [["folder", folder.URI] for each
              (folder in fixIterator(rootFolder.subFolders, Ci.nsIMsgFolder))];
      this._indexingFolderGoal += folders.length;
      this._indexQueue = this._indexQueue.concat(folders);
      this.indexing = true;
    }
    else {
      this._log.info("Skipping Account, root folder not nsIMsgFolder");
    }
  },

  indexFolder: function glodaIndexFolder(aFolder) {
    this._log.info("Queue-ing folder for indexing: " + aFolder.prettiestName);
    
    this._indexQueue.push(["folder", aFolder.URI]);
    this.indexing = true;
  },

  
  /* *********** Event Processing *********** */

  /* ***** Folder Changes ***** */  
  /**
   * All additions and removals are queued for processing.  Indexing messages
   *  is potentially phenomenally expensive, and deletion can still be
   *  relatively expensive due to our need to delete the message, its
   *  attributes, and all attributes that reference it.  Additionally,
   *  attribute deletion costs are higher than attribute look-up because
   *  there is the actual row plus its 3 indices, and our covering indices are
   *  no help there.
   *  
   */
  _msgFolderListener: {
    indexer: null,
    
    /**
     * Handle a new-to-thunderbird message, meaning a newly fetched message
     *  (local folder) one revealed by synching with the server (IMAP).  Because
     *  the new-to-IMAP case requires Thunderbird to have opened the folder,
     *  we either need to depend on MailNews to be aggressive about looking
     *  for new messages in folders or try and do it ourselves.  For now, we
     *  leave it up to MailNews proper.
     *
     * For the time being, we post the message header as received to our
     *  indexing queue.  Depending on experience, it may be more suitable to
     *  try and index the message immediately, or hold onto a less specific
     *  form of message information than the nsIMsgDBHdr.  (If we were to
     *  process immediately, it might appropriate to consider having a
     *  transaction open that is commited by timer/sufficient activity, since it
     *  is conceivable we will see a number of these events in fairly rapid
     *  succession.)
     */
    msgAdded: function gloda_indexer_msgAdded(aMsgHdr) {
      this.indexer._indexQueue.push(["message", 1, aMsgHdr]);
      this.indexer.indexing = true; 
    },
    
    /**
     * Handle real, actual deletion (move to trash and IMAP deletion model
     *  don't count; we only see the deletion here when it becomes forever,
     *  or rather _just before_ it becomes forever.  Because the header is
     *  going away, we need to either process things immediately or extract the
     *  information required to purge it later without the header.
     *
     * We opt to process all of the headers immediately, inside a transaction.
     *  We do this because deletions may actually be a batch deletion of many,
     *  many messages, which could be a lot to queue
     */
    msgsDeleted: function gloda_indexer_msgsDeleted(aMsgHdrs) {
      for (let iMsgHdr=0; iMsgHdr < aMsgHdrs.length; iMsgHdr++) {
        let msgHdr = aMsgHdrs.queryElementAt(iMsgHdr, Ci.nsIMsgDBHdr);
        this.indexer._indexQueue.push(["message", -1, msgHdr]);
      }
      this.indexer.indexing = true;
    },
    
    /**
     * Process a move or copy.  Moves are immediately processed, while copies
     *  are treated as additions and accordingly queued for subsequent indexing.
     */
    msgsMoveCopyCompleted: function gloda_indexer_msgsMoveCopyCompleted(aMove,
                             aSrcMsgHdrs, aDestFolder) {
      for () {
        let msgHdr;
        this.indexer._indexQueue.push(["message", 1, msgHdr]);
      }
    },
    
    /**
     * Handles folder no-longer-exists-ence.  We want to delete all messages
     *  located in the folder.
     */
    folderDeleted: function gloda_indexer_folderDeleted(aFolder) {
    },
    
    /**
     * Handle a folder being copied.  I do not believe the MailNews code is
     *  capable of generating a case where aMove is true, but just in case we'll
     *  dispatch to our sibling method, folderRenamed.
     *
     * Folder copying is conceptually all kinds of annoying (I mean, why would
     *  you really need to duplicate all those messages?) but is easily dealt
     *  with by queueing the destination folder for initial indexing. 
     */
    folderMoveCopyCompleted: function gloda_indexer_folderMoveCopyCompleted(
                               aMove, aSrcFolder, aDestFolder) {
      if (aMove) {
        return this.folderRenamed(aSrcFolder, aDestFolder);
      }
      this.indexer._indexQueue.push(["folder", aDestFolder.URI]);
      this.indexer.indexing = true;
    },
    
    /**
     * We just need to update the URI <-> ID maps and the row in the database,
     *  all of which is actually done by the datastore for us.
     */
    folderRenamed: function gloda_indexer_folderRenamed(aOrigFolder,
                                                        aNewFolder) {
      GlodaDatastore.renameFolder(aOrigFolder.URI, aNewFolder.URI);
    },
    
    itemEvent: function gloda_indexer_itemEvent(aItem, aEvent, aData) {
      // nop.  this is an expansion method on the part of the interface and has
      //  no known events that we need to handle.
    },
  },
  
  /* ***** Rebuilding / Reindexing ***** */
  // TODO: implement a folder observer doodad to handle rebuilding / reindexing
  /**
   * Allow us to invalidate an outstanding folder traversal because the
   *  underlying database is going away.  We use other means for detecting 
   *  modifications of the message (labeling, marked (un)read, starred, etc.)
   *
   * This is an nsIDBChangeListener listening to an nsIDBChangeAnnouncer.  To
   *  add ourselves, we get us a nice nsMsgDatabase, query it to the announcer,
   *  then call AddListener.
   */
  _databaseAnnouncerListener: {
    onAnnouncerGoingAway: function gloda_indexer_dbGoingAway(
                                         aDBChangeAnnouncer) {
      // TODO: work
    },
    
    onHdrChange: function(aHdrChanged, aOldFlags, aNewFlags, aInstigator) {},
    onHdrDeleted: function(aHdrChanged, aParentKey, aFlags, aInstigator) {},
    onHdrAdded: function(aHdrChanged, aParentKey, aFlags, aInstigator) {},
    onParentChanged: function(aKeyChanged, aOldParent, aNewParent, 
                              aInstigator) {},
    onReadChanged: function(aInstigator) {},
    onJunkScoreChanged: function(aInstigator) {}
  },
  
  /* ***** MailNews Shutdown ***** */
  // TODO: implement a shutdown/pre-shutdown listener that attempts to either
  //  drain the indexing queue or persist it.
  /**
   * Shutdown task.
   *
   * We implement nsIMsgShutdownTask, served up by nsIMsgShutdownService.  We
   *  offer our services by registering ourselves as a "msg-shutdown" observer
   *  with the observer service.
   */
  _shutdownTask: {
    indexer: null,
    
    get needsToRunTask {
      return this.indexer.indexing;
    },
    
    /**
     * So we could either go all out finishing our indexing, or write down what
     *  we need to index next time around.  For now, we opt to complete our
     *  indexing since it greatly simplifies our lives, but it probably would
     *  be friendly to simply persist our state.
     *
     * XXX: so we can either return false and be done with it, or return true
     *  and provide the stop running notification.
     * We call aUrlListener's OnStopRunningUrl(null, NS_OK) when we are done,
     *  and can provide status updates by calling the shutdown service
     *  (nsIMsgShutdownService)'s setStatusText method. 
     */
    doShutdownTask: function gloda_indexer_doShutdownTask(aUrlListener,
                                                          aMsgWingow) {
      this.indexer._onStopIndexingUrlListener = aUrlListener;
      
      
      
      return true;
    },
    
    getCurrentTaskName: function gloda_indexer_getCurrentTaskName() {
      return this.indexer.strBundle.getString("shutdownTaskName");
    },
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
  
  _indexMessage: function gloda_index_indexMessage(aMsgHdr) {
  
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
        this._log.info("Attempting to re-index message: " + aMsgHdr.messageId
                        + " (" + aMsgHdr.subject + ")");
        return;
      } 
    }
    
    let conversationID = null;
    
    // (walk from closest to furthest ancestor)
    for (let iAncestor=ancestors.length-1; iAncestor >= 0; --iAncestor) {
      let ancestor = ancestors[iAncestor];
      
      if (ancestor != null) { // ancestor.conversationID cannot be null
        if (conversationID === null)
          conversationID = ancestor.conversationID;
        else if (conversationID != ancestor.conversationID)
          this._log.error("Inconsistency in conversations invariant on " +
                          ancestor.messageID + ".  It has conv id " +
                          ancestor.conversationID + " but expected " + 
                          conversationID);
      }
    }
    
    let conversation = null;
    if (conversationID === null) {
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
      
      if (ancestor === null) {
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
      else if (ancestor.parentID === null) {
        ancestor._parentID = lastAncestorId;
        this._datastore.updateMessage(ancestor);
      }
      
      lastAncestorId = ancestor.id;
    }
    // now all our ancestors exist, though they may be ghost-like...
    
    if (curMsg === null) {
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
