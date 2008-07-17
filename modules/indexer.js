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

/**
 * Capture the indexing batch concept explicitly.
 *
 * @param aActionDesc ex: "Indexing", "De-indexing" (you should pass in the
 *     localized string)
 * @param aTargetName A folder name, or other.
 */
function IndexingJob(aJobType, aDeltaType, aID) {
  this.jobType = aJobType;
  this.deltaType = aDeltaType;
  this.id = aID;
  this.items = [];
  this.offset = 0;
  this.goal = null;
}

let GlodaIndexer = {
  _datastore: GlodaDatastore,
  _log: Log4Moz.Service.getLogger("gloda.indexer"),
  _strBundle: null,
  _msgwindow: null,
  _domWindow: null,

  _inited: false,
  init: function gloda_index_init(aDOMWindow, aMsgWindow, aStrBundle) {
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
    
    this._strBundle = aStrBundle;
  },
  
  /**
   * Are we enabled, read: are we processing change events?
   */
  _enabled: false,
  get enabled() { return this._enabled; },
  set enabled(aEnable) {
    if (!this._enabled && aEnable) {
      this._msgFolderListener.indexer = this;
      
      let notificationService =
        Cc["@mozilla.org/messenger/msgnotificationservice;1"].
        getService(Ci.nsIMsgFolderNotificationService);
      notificationService.addListener(this._msgFolderListener);
      
      this._enabled = true;
    }
    else if (this._enabled && !aEnable) {
      let notificationService =
        Cc["@mozilla.org/messenger/msgnotificationservice;1"].
        getService(Ci.nsIMsgFolderNotificationService);
      notificationService.removeListener(this._msgFolderListener);
      
      this._enabled = false;
    }
    
    this._log.info("Event-Driven Indexing is now " + this._enabled);
  },

  /** Track whether indexing is active (we have timers in-flight). */
  _indexingActive: false,
  get indexing() { return this._indexingActive; },
  /** You can turn on indexing, but you can't turn it off! */
  set indexing(aShouldIndex) {
    if (!this._indexingActive && aShouldIndex) {
      this._log.info("Indexing Queue Processing Commencing");
      this._indexingActive = true;
      this._domWindow.setTimeout(this._wrapIncrementalIndex, this._indexInterval, this);
    }  
  },
  
  /**
   * Our current job number, out of _indexingJobGoal.  Although our jobs comes
   *  from _indexQueue, this is not an offset into that list because we forget
   *  jobs once we complete them.  As such, this value is strictly for progress
   *  tracking.
   */ 
  _indexingJobCount: 0,
  /**
   * Total number of jobs to process in this current indexing session; may
   *  increase as new jobs are added to the _indexQueue.  This value won't
   *  decrease until the indexing session is completed (and we become idle),
   *  and then it will go to zero.
   */
  _indexingJobGoal: 0,
  
  /**
   * A list of IndexingJob instances to process.
   * - ['account', account object]
   * - ['folder', folder URI]
   * - ['message', delta type, message header, folder ID, message key,
   *      message ID]
   *   (we use folder ID instead of URI so that renames can't trick us)
   */
  _indexQueue: [],
  
  /**
   * The current indexing job.
   */
  _curIndexingJob: null,
  
  /**
   * A message addition job yet to be (completely) processed.  Since message
   *  addition events come to us one-by-one, in order to aggregate them into a
   *  job, we need something like this.  It's up to the indexing loop to
   *  decide when to null this out; it can either do it when it first starts
   *  processing it, or when it has processed the last thing.  It's really a
   *  question of whether we want retrograde motion in the folder progress bar
   *  or the message progress bar.
   */
  _pendingAddJob: null,
  
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
      aListener(this._strBundle ? this._strBundle.getString("actionIdle") : "",
                null, 0, 1, 0, 1);
    return aListener;
  },
  removeListener: function gloda_index_removeListener(aListener) {
    let index = this._indexListeners.indexOf(aListener);
    if (index != -1)
      this._indexListeners(index, 1);
  },
  _notifyListeners: function gloda_index_notifyListeners(aStatus, aFolderName,
      aFolderIndex, aFoldersTotal, aMessageIndex, aMessagesTotal) {
    this._log.debug("notifying listeners >>>");
    for (let iListener=this._indexListeners.length-1; iListener >= 0; 
         iListener--) {
      this._log.debug("  listener " + iListener);
      let listener = this._indexListeners[iListener];
      listener(aStatus, aFolderName, aFolderIndex, aFoldersTotal, aMessageIndex,
               aMessagesTotal);
    }
    this._log.debug("done notifying listeners <<<");
  },
  
  _indexingFolderID: null,
  _indexingFolder: null,
  _indexingDatabase: null,
  _indexingIterator: null,
  
  /**
   * Common logic that we want to deal with the given folder ID.  Besides
   *  cutting down on duplicate code, this ensures that we are listening on
   *  the folder in case it tries to go away when we are using it.
   */
  _indexerEnterFolder: function gloda_index_indexerEnterFolder(aFolderID,
                                                               aNeedIterator) {
    // if leave folder was't cleared first, remove the listener; everyone else
    //  will be nulled out in the exception handler below if things go south
    //  on this folder.
    if (this._indexingFolder !== null) {
      this._indexingDatabase.RemoveListener(this._databaseAnnouncerListener);
    }
    
    let folderURI = GlodaDatastore._mapFolderID(aFolderID);
    this._log.debug("Active Folder URI: " + folderURI);
  
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1'].
                     getService(Ci.nsIRDFService);
    let folder = rdfService.GetResource(folderURI);
    folder.QueryInterface(Ci.nsIMsgFolder); // (we want to explode in the try
    // if this guy wasn't what we wanted)
    this._indexingFolder = folder;
    this._indexingFolderID = aFolderID;

    // The msf may need to be created or otherwise updated, updateFolder will
    //  do this for us.  (GetNewMessages would also do it, but we would be
    //  triggering new message retrieval in that case, which we don't actually
    //  desire.
    // TODO: handle password-protected local cache potentially triggering a
    //  password prompt here...
    try {
      this._indexingFolder.updateFolder(this._msgWindow);
      // we get an nsIMsgDatabase out of this (unsurprisingly) which
      //  explicitly inherits from nsIDBChangeAnnouncer, which has the
      //  AddListener call we want.
      this._indexingDatabase = folder.getMsgDatabase(this._msgWindow);
      if (aNeedIterator)
        this._indexingIterator = Iterator(fixIterator(
                                   //folder.getMessages(this._msgWindow),
                                   this._indexingDatabase.EnumerateMessages(),
                                   Ci.nsIMsgDBHdr));
      this._databaseAnnouncerListener.indexer = this;
      this._indexingDatabase.AddListener(this._databaseAnnouncerListener);
    }
    catch (ex) {
      this._log.error("Problem entering folder: " +
                      folder.prettiestName + ", skipping.");
      this._log.error("Error was: " + ex);
      this._indexingFolder = null;
      this._indexingFolderID = null;
      this._indexingDatabase = null;
      this._indexingIterator = null;
      
      // re-throw, we just wanted to make sure this junk is cleaned up and
      //  get localized error logging...
      throw ex;
    }
  },
  
  _indexerLeaveFolder: function gloda_index_indexerLeaveFolder(aExpected) {
    if (this._indexingFolder !== null) {
      // remove our listener!
      this._indexingDatabase.RemoveListener(this._databaseAnnouncerListener);
      // null everyone out
      this._indexingFolder = null;
      this._indexingFolderID = null;
      this._indexingDatabase = null;
      this._indexingIterator = null;
      // ...including the active job:
      this._curIndexingJob = null;
    }
  },
  
  _wrapIncrementalIndex: function gloda_index_wrapIncrementalIndex(aThis) {
    aThis.incrementalIndex();
  },
  
  incrementalIndex: function gloda_index_incrementalIndex() {
    this._log.debug("index wake-up!");
  
    GlodaDatastore._beginTransaction();
    try {
      let job = this._curIndexingJob;
      for (let tokensLeft=this._indexTokens; tokensLeft > 0; tokensLeft--) {
        // --- Do we need a job?
        if (job === null) {
          // --- Are there any jobs left?
          if (this._indexQueue.length == 0) {
            this._log.info("Done indexing, disabling timer renewal.");
            this._indexingActive = false;
            this._indexingJobCount = 0;
            this._indexingJobGoal = 0;
            this._notifyListeners(this._strBundle.getString("actionIdle"), null,
                                  0, 1, 0, 1);
            break;
          }
          
          // --- Get a job
          else {
            try {
              this._log.debug("Pulling job from queue of size " +
                              this._indexQueue.length);
              job = this._curIndexingJob = this._indexQueue.shift();
              this._indexingJobCount++;
              this._log.debug("Pulled job: " + job.jobType + ", " +
                              job.deltaType + ", " + job.id);
              // (Prepare for the job...)
              if (job.jobType == "folder") {
                // -- FOLDER ADD
                if (job.deltaType > 0) {
                  this._indexerEnterFolder(job.id, true)
                  job.goal = this._indexingFolder.getTotalMessages(false);
                }
                // -- FOLDER DELETE
                else {
                  // nuke the folder id
                  this._datastore.deleteFolderByID(job.id);
                  // and we're done!
                  job = this._curIndexingJob = null;
                }
              }
              // messages
              else {
                // not much to do here; unlink the pending add job if that's him
                if (job === this._pendingAddJob)
                  this._pendingAddJob = null;
                // update our goal from the items length
                job.goal = job.items.length;
              }
            }
            catch (ex) {
              this._log.debug("Failed to start job (at " + ex.fileName + ":" +
                ex.lineNumber + ") because: " + ex);
              job = this._curIndexingJob = null;
            }
          }
        }
        // --- Do the job
        else {
          try {
            if (job.jobType == "folder") {
              // -- FOLDER ADD (steady state)
              if (job.deltaType > 0) {
                // this will throw a stopiteration exception when done, so
                //  we don't need to clean up the job
                this._indexMessage(this._indexingIterator.next());
                job.offset++;
              }
              // there is no steady-state processing for folder deletion
            }
            else if (job.jobType == "message") {
              let item = job.items[job.offset++];
              // -- MESSAGE ADD (batch steady state)
              if (job.deltaType > 0) {
                // item must be [folder ID, message key]

                // get in the folder
                if (this._indexingFolderID != item[0])
                  this._indexerEnterFolder(item[0], false);
                let msgHdr = this._indexingFolder.GetMessageHeader(item[1]);
                if (msgHdr)
                  this._indexMessage(msgHdr);
              }
              // -- MESSAGE MOVE (batch steady state)
              else if (job.deltaType == 0) {
                // item must be [folder ID, header message-id]
                
                // get in the folder
                if (this._indexingFolderID != item[0])
                  this._indexerEnterFolder(item[0], false);
                // process everyone with the message-id.  yeck.
                // uh, except nsIMsgDatabase only thinks there should be one, so
                //  let's pretend that this assumption is not a bad idea for now
                // TODO: stop pretending this assumption is not a bad idea
                let msgHdr = this._indexingDatabase.getMsgHdrForMessageID(item[1]);
                if (msgHdr) {
                  this._indexMessage(msgHdr);
                }
                else {
                  this._log.error("Move unable to locate message with header " +
                    "message-id " + item[1] + ". Folder is known to possess " +
                    this._indexingFolder.getTotalMessages(false) +" messages.");
                }
                // remember to eat extra tokens... when we get more than one...
              }
              // -- MESSAGE DELETE (batch steady state)
              else { // job.deltaType < 0
                // item must be a message id
                let message = GlodaDatastore.getMessageByID(messageID);
                // delete the message!
                if (message !== null)
                  this._deleteMessage(message);
              }
              
              // we do need to kill the job when we hit the items.length
              if (job.offset == job.items.length)
                job = this._curIndexingJob = null;
            }
          }
          catch (ex) {
            this._log.debug("Bailing on job (at " + ex.fileName + ":" +
                ex.lineNumber + ") because: " + ex);
            this._indexerLeaveFolder();
            job = this._curIndexingJob = null;
          }
        }
        
        // perhaps status update
        if (job !== null) {
          if (job.offset % 50 == 1) {
            let actionStr;
            if (job.deltaType > 0)
              actionStr = this._strBundle.getString("actionIndexing");
            else if (job.deltaType == 0)
              actionStr = this._strBundle.getString("actionMoving");
            else
              actionStr = this._strBundle.getString("actionDeindexing");
            let prettyName;
            if (this._indexingFolder !== null)
              prettyName = this._indexingFolder.prettiestName;
            else
              prettyName =
                this._strBundle.getString("messageIndexingExplanation");
            this._notifyListeners(actionStr + ": " +
                                  prettyName,
                                  prettyName,
                                  this._indexingJobCount-1, // count, not index
                                  this._indexingJobGoal,
                                  job.offset,
                                  job.goal);
          }
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
    
    GlodaDatastore._beginTransaction();
    let sideEffects = [this.indexAccount(account) for each
                       (account in fixIterator(msgAccountManager.accounts,
                                               Ci.nsIMsgAccount))];
    GlodaDatastore._commitTransaction();
  },

  indexAccount: function glodaIndexAccount(aAccount) {
    let rootFolder = aAccount.incomingServer.rootFolder;
    if (rootFolder instanceof Ci.nsIMsgFolder) {
      this._log.info("Queueing account folders for indexing: " + aAccount.key);

      GlodaDatastore._beginTransaction();
      let folderJobs =
              [new IndexingJob("folder", 1,
                              GlodaDatastore._mapFolderURI(folder.URI)) for each
              (folder in fixIterator(rootFolder.subFolders, Ci.nsIMsgFolder))];
      GlodaDatastore._commitTransaction();
      
      this._indexingJobGoal += folderJobs.length;
      this._indexQueue = this._indexQueue.concat(folderJobs);
      this.indexing = true;
    }
    else {
      this._log.info("Skipping Account, root folder not nsIMsgFolder");
    }
  },

  indexFolder: function glodaIndexFolder(aFolder) {
    this._log.info("Queue-ing folder for indexing: " + aFolder.prettiestName);
    
    this._indexQueue.push(new IndexingJob("folder", 1,
                          GlodaDatastore._mapFolderURI(aFolder.URI)));
    this._indexingJobGoal++;
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
      this.indexer._log.debug("msgAdded notification");
      if (this.indexer._pendingAddJob === null) {
        this.indexer._pendingAddJob = new IndexingJob("message", 1, null);
        this.indexer._indexQueue.push(this.indexer._pendingAddJob);
        this.indexer._indexingJobGoal++;
      }
      this.indexer._pendingAddJob.items.push(
        [GlodaDatastore._mapFolderURI(aMsgHdr.folder.URI),
         aMsgHdr.messageKey]);
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
      let deleteJob = new IndexingJob("message", -1, null);
      for (let iMsgHdr=0; iMsgHdr < aMsgHdrs.length; iMsgHdr++) {
        let msgHdr = aMsgHdrs.queryElementAt(iMsgHdr, Ci.nsIMsgDBHdr);
        deleteJob.items.push([GlodaDatastore._mapFolderURI(msgHdr.folder.URI),
                              msgHdr.messageKey]);
      }
      this.indexer._indexQueue.push(deleteJob);
      this.indexer._indexingJobGoal++;
      this.indexer.indexing = true;
    },
    
    /**
     * Process a move or copy.  Copies are treated as additions and accordingly
     *  queued for subsequent indexing.  Moves are annoying in that, in theory,
     *  we should be able to just alter the location information and be done
     *  with it.  Unfortunately, we have no clue what the messageKey is for
     *  the moved message until we go looking.  For now, we "simply" move the
     *  messages into the destination folder, wiping their message keys, and
     *  scheduling them all for re-indexing based on their message ids, which
     *  may catch some same-folder duplicates.
     *
     * @TODO Handle the move case better, avoiding a full reindexing of the
     *     messages when possible.  (In fact, the _indexMessage method basically
     *     has enough information to try and give this a whirl, but it's not
     *     foolproof, hence not done and this issue yet to-do.  
     */
    msgsMoveCopyCompleted: function gloda_indexer_msgsMoveCopyCompleted(aMove,
                             aSrcMsgHdrs, aDestFolder) {
      this.indexer._log.debug("MoveCopy notification.  Move: " + aMove);
      try {
      if (aMove) {
        let srcFolder = aSrcMsgHdrs.queryElementAt(0, Ci.nsIMsgDBHdr).folder;
        let messageKeys = [];

        let reindexJob = new IndexingJob("message", 0, null);

        // get the current (about to be nulled) messageKeys and build the
        //  job list too.
        for (let iSrcMsgHdr=0; iSrcMsgHdr < aSrcMsgHdrs.length; iSrcMsgHdr++) {
          let msgHdr = aSrcMsgHdrs.queryElementAt(iSrcMsgHdr, Ci.nsIMsgDBHdr);
          messageKeys.push(msgHdr.messageKey);
          reindexJob.items.push(
            [GlodaDatastore._mapFolderURI(aDestFolder.URI),
             msgHdr.messageId]);
        }
        // quickly move them to the right folder, zeroing their message keys
        GlodaDatastore.updateMessageFoldersByKeyPurging(srcFolder.URI,
                                                        messageKeys,
                                                        aDestFolder.URI);
        // and now let us queue the re-indexings...
        this.indexer._indexQueue.push(reindexJob);
        this.indexer.indexingJobGoal++;
        this.indexer.indexing = true;
      }
      else {
        let copyIndexJob = new IndexingJob("message", 1, null);

        for (let iSrcMsgHdr=0; iSrcMsgHdrs < aSrcMsgHdrs.length; iSrcMsgHdr++) {
          let msgHdr = aSrcMsgHdrs.queryElementAt(iSrcMsgHdr, Ci.nsIMsgDBHdr);
          copyIndexJob.items.push([
            GlodaDatastore._mapFolderURI(aDestFolder.URI),
            msgHdr.messageKey]);
        }

        this.indexer._indexingJobGoal++;
        this.indexer._indexQueue.push(copyIndexJob);
      }
      } catch (ex) { this.indexer._log.error("SAD SAD: " + ex); }
    },
    
    /**
     * Handles folder no-longer-exists-ence.  We want to delete all messages
     *  located in the folder and then kill the URI/id.  To this end we create
     *  two jobs.  One kills all the messages, and one actually deletes the
     *  URI/id.
     */
    folderDeleted: function gloda_indexer_folderDeleted(aFolder) {
      let folderID = GlodaDatastore._mapFolderURI(aFolder.URI);
      
      let messageJob = new IndexingJob("message", -1, null);
      messageJob.items = GlodaDatastore.getMessageIDsByFolderID(folderID);
      this.indexer._indexQueue.push(messageJob);
      
      let folderJob = new IndexingJob("folder", -1, folderID);
      this.indexer._indexQueue.push(folderJob);

      this._indexingJobGoal += 2;
      this.indexing = true;
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
      this._indexingFolderGoal++;
      this.indexer._indexQueue.push(["folder", 1,
        this._mapFolderURI(aDestFolder.URI)]);
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
    indexer: null,
    onAnnouncerGoingAway: function gloda_indexer_dbGoingAway(
                                         aDBChangeAnnouncer) {
      this.indexer._indexerLeaveFolder(false);
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
    
    get needsToRunTask() {
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
   * Since we are using the nsIMsgDBHdr's subject field, this is already done
   *  for us, and we don't actually need to do any extra work.  Hooray!
   */
  _extractOriginalSubject: function glodaIndexExtractOriginalSubject(aMsgHdr) {
    return aMsgHdr.mime2DecodedSubject;
  },
  
  _indexMessage: function gloda_index_indexMessage(aMsgHdr) {
    this._log.debug("*** Indexing message: " + aMsgHdr.messageKey + " : " +
                    aMsgHdr.subject);
    // -- Find/create the conversation the message belongs to.
    // Our invariant is that all messages that exist in the database belong to
    //  a conversation.
    
    // - See if any of the ancestors exist and have a conversationID...
    // (references are ordered from old [0] to new [n-1])
    let references = [aMsgHdr.getStringReference(i) for each
                      (i in range(0, aMsgHdr.numReferences))];
    // also see if we already know about the message...
    references.push(aMsgHdr.messageId);
    // (ancestorLists has a direct correspondence to the message ids)
    let ancestorLists = this._datastore.getMessagesByMessageID(references);
    // pull our current message lookup results off
    references.pop();
    let candidateCurMsgs = ancestorLists.pop();
    
    let conversationID = null;
    // -- figure out the conversation ID
    // if we have a clone/already exist, just use his conversation ID
    if (candidateCurMsgs.length > 0) {
      conversationID = candidateCurMsgs[0].conversationID;
    }
    // otherwise check out our ancestors
    else {
      // (walk from closest to furthest ancestor)
      for (let iAncestor=ancestorLists.length-1; iAncestor >= 0; --iAncestor) {
        let ancestorList = ancestorLists[iAncestor];
        
        if (ancestorList.length > 0) {
          // we only care about the first instance of the message because we are
          //  able to guarantee the invariant that all messages with the same
          //  message id belong to the same conversation. 
          let ancestor = ancestorList[0];
          if (conversationID === null)
            conversationID = ancestor.conversationID;
          else if (conversationID != ancestor.conversationID)
            this._log.error("Inconsistency in conversations invariant on " +
                            ancestor.messageID + ".  It has conv id " +
                            ancestor.conversationID + " but expected " + 
                            conversationID);
        }
      }
    }
    
    let conversation = null;
    // nobody had one?  create a new conversation
    if (conversationID === null) {
      // (the create method could issue the id, making the call return
      //  without waiting for the database...)
      conversation = this._datastore.createConversation(
          this._extractOriginalSubject(aMsgHdr), null, null);
      conversationID = conversation.id;
    }
    
    // Walk from furthest to closest ancestor, creating the ancestors that don't
    //  exist. (This is possible if previous messages that were consumed in this
    //  thread only had an in-reply-to or for some reason did not otherwise
    //  provide the full references chain.)
    for (let iAncestor=0; iAncestor < ancestorLists.length; ++iAncestor) {
      let ancestorList = ancestorLists[iAncestor];
      
      if (ancestorList.length == 0) {
        this._log.debug("creating message with: null, " + conversationID +
                        ", " + references[iAncestor] +
                        ", null.");
        let ancestor = this._datastore.createMessage(null, null, // ghost
                                                     conversationID,
                                                     references[iAncestor],
                                                     null); // no snippet
        ancestorLists[iAncestor].push(ancestor);
      }
    }
    // now all our ancestors exist, though they may be ghost-like...
    
    // find if there's a ghost version of our message or we already have indexed
    //  this message.
    let curMsg = null;
    this._log.debug(candidateCurMsgs.length + " candidate messages");
    for (let iCurCand=0; iCurCand < candidateCurMsgs.length; iCurCand++) {
      let candMsg = candidateCurMsgs[iCurCand];

      this._log.debug("candidate folderID: " + candMsg.folderID +
                      " messageKey: " + candMsg.messageKey);
      
      // if we are in the same folder and we have the same message key, we
      //  are definitely the same, stop looking.
      // if we are in the same folder and the candidate message has a null
      //  message key, we treat it as our best option unless we find an exact
      //  key match. (this would happen because the 'move' notification case
      //  has to deal with not knowing the target message key.  this case
      //  will hopefully be somewhat improved in the future to not go through
      //  this path which mandates re-indexing of the message in its entirety.)
      // if we are in the same folder and the candidate message's underlying
      //  message no longer exists/matches, we'll assume we are the same but
      //  were betrayed by a re-indexing or something, but we have to make sure
      //  a perfect match doesn't turn up.
      if (candMsg.folderURI == aMsgHdr.folder.URI) {
        if ((candMsg.messageKey == aMsgHdr.messageKey) || 
            (candMsg.messageKey === null)) {
          curMsg = candMsg;
          break;
        }
        if (candMsg.messageKey === null)
          curMsg = candMsg;
        else if ((curMsg === null) && (candMsg.folderMessage === null))
          curMsg = candMsg;
      }
      // our choice of last resort, but still okay, is a ghost message
      else if ((curMsg === null) && (candMsg.folderID === null)) {
        curMsg = candMsg;
      }
    }
    
    if (curMsg === null) {
      this._log.debug("...creating new message");
      curMsg = this._datastore.createMessage(aMsgHdr.folder.URI,
                                             aMsgHdr.messageKey,                
                                             conversationID,
                                             aMsgHdr.messageId,
                                             null); // no snippet
     }
     else {
        curMsg._folderID = this._datastore._mapFolderURI(aMsgHdr.folder.URI);
        curMsg._messageKey = aMsgHdr.messageKey;
        this._datastore.updateMessage(curMsg);
     }
     
     Gloda.processMessage(curMsg, aMsgHdr);
  },
  
  /**
   * Wipe a message out of existence from our index.  This is slightly more
   *  tricky than one would first expect because there are potentially
   *  attributes not immediately associated with this message that reference
   *  the message.  Not only that, but deletion of messages may leave a
   *  conversation posessing only ghost messages, which we don't want, so we
   *  need to nuke the moot conversation and its moot ghost messages.
   * For now, we are actually punting on that trickiness, and the exact
   *  nuances aren't defined yet because we have not decided whether to store
   *  such attributes redundantly.  For example, if we have subject-pred-object,
   *  we could actually store this as attributes (subject, id, object) and
   *  (object, id, subject).  In such a case, we could query on (subject, *)
   *  and use the results to delete the (object, id, subject) case.  If we
   *  don't redundantly store attributes, we can deal with the problem by
   *  collecting up all the attributes that accept a message as their object
   *  type and issuing a delete against that.  For example, delete (*, [1,2,3],
   *  message id).
   * (We are punting because we haven't implemented support for generating
   *  attributes like that yet.)
   *
   * @TODO: implement deletion of attributes that reference (deleted) messages
   */
  _deleteMessage: function gloda_index_deleteMessage(aMessage) {
    // -- delete our attributes
    // delete the message's attributes (if we implement the cascade delete, that
    //  could do the honors for us... right now we define the trigger in our
    //  schema but the back-end ignores it)
    aMessage._datastore.clearMessageAttributes(aMessage);
    
    // -- delete our message or ghost us, and maybe nuke the whole conversation
    // look at the other messages in the conversation.
    let conversationMsgs = aMessage._datastore.getMessagesByConversationID(
                             aMessage.conversationID, true);
    let ghosts = [];
    let twinMessage = null;
    for (let iMsg=0; iMsg < conversationMsgs.length; iMsg++) {
      let convMsg = conversationMsgs[iMsg];
      
      // ignore our message
      if (convMsg.id == aMessage.id)
        continue;
      
      if (convMsg.folderID !== null) {
        if (convMsg.headerMessageID == aMessage.headerMessageID) {
          twinMessage = convMsg;
        }
      }
      else {
        ghosts.push(convMsg);
      }
    }
    
    // is everyone else a ghost? (note that conversationMsgs includes us, but
    //  ghosts cannot)
    if ((conversationsMsgs.length - 1) == ghosts.length) {
      // obliterate the conversation including aMessage.
      // since everyone else is a ghost they have no attributes.  however, the
      //  conversation may some day have attributes targeted against it, so it
      //  gets a helper.
      this._deleteConversationOfMessage(aMessage);
      aMessage._nuke();
    }
    else { // there is at least one real message out there, so the only q is...
      // do we have a twin (so it's okay to delete us) or do we become a ghost?
      if (twinMessage !== null) { // just delete us
        aMessage._datastore.deleteMessageByID(aMessage.id);
        aMesssage._nuke();
      }
      else { // ghost us
        aMessage._ghost();
        aMessage._datastore.updateMessage(aMessage);
      }
    }
  },
  
  /**
   * Delete an entire conversation, using the passed-in message which must be
   *  the last non-ghost in the conversation and have its attributes all
   *  deleted.  This function issues the batch delete of all the ghosts (and the
   *  message), and in the future will take care to nuke any attributes
   *  referencing the conversation.
   */
  _deleteConversationOfMessage:
      function gloda_index_deleteConversationOfMessage(aMessage) {
    aMessage._datastore.deleteMessagesByConversationID(aMessage.conversationID);
    aMessage._datastore.deleteConversationByID(aMessage.conversationID);
  },
};
