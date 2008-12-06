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

/*
 * This file currently contains a fairly general implementation of asynchronous
 *  indexing with a very explicit message indexing implementation.  As gloda
 *  will eventually want to index more than just messages, the message-specific
 *  things should ideally lose their special hold on this file.  This will
 *  benefit readability/size as well.
 */

EXPORTED_SYMBOLS = ['GlodaIndexer', 'IndexingJob'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.import("resource://app/modules/gloda/log4moz.js");

Cu.import("resource://app/modules/gloda/utils.js");
Cu.import("resource://app/modules/gloda/datastore.js");
Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/collection.js");
Cu.import("resource://app/modules/gloda/connotent.js");

Cu.import("resource://app/modules/gloda/mimemsg.js");

// for list comprehension fun
function range(begin, end) {
  for (let i = begin; i < end; ++i) {
    yield i;
  }
}

const GFI = Log4Moz.repository.getLogger("gloda.fixiterator");


// FROM STEEL (a la Joey Minta/jminta)
// (and to go away when STEEL is checked in, although we may also want to
//  consider just specializing the code in the few places this method is used.)
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
          GFI.error(face + " => " + ex.fileName + ":" + ex.lineNumber + ": " + ex)
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

function MakeCleanMsgHdrCallback(aMsgHdr, aGlodaMessageID) {
  return function() {
    // Mark this message as indexed
    aMsgHdr.setUint32Property(GlodaIndexer.GLODA_MESSAGE_ID_PROPERTY,
                              aGlodaMessageID);
    // If there is a gloda-dirty flag on there, clear it by writing a 0.  (But
    //  don't do this if we didn't have a dirty flag on there in the first
    //  case.)  It sounds like we would actually prefer to "cut" the "cell",
    //  but I don't see any in-domain means of doing that.
    try {
      let isDirty = aMsgHdr.getUint32Property(
        GlodaIndexer.GLODA_DIRTY_PROPERTY);
      if (isDirty)
        aMsgHdr.setUint32Property(GlodaIndexer.GLODA_DIRTY_PROPERTY, 0);
    }
    catch (ex) {}
  };
}

const MSG_FLAG_OFFLINE = 0x80;
const MSG_FLAG_EXPUNGED = 0x08;

/**
 * @class Capture the indexing batch concept explicitly.
 *
 * @param aJobType The type of thing we are indexing.  Current choices are:
 *   "folder" and "message".  Previous choices included "account".  The indexer
 *   currently knows too much about these; they should be de-coupled.
 * @param aDeltaType -1 for deletion, 0 for move, 1 for addition/new.
 * @param aID Specific to the job type, but for now only used to hold folder
 *     IDs.
 *
 * @ivar items The list of items to process during this job/batch.  (For
 *     example, if this is a "messages" job, this would be the list of messages
 *     to process, although the specific representation is determined by the
 *     job.)  The list will only be mutated through the addition of extra items.
 * @ivar offset The current offset into the 'items' list (if used), updated as
 *     processing occurs.  If 'items' is not used, the processing code can also
 *     update this in a similar fashion.  This is used by the status
 *     notification code in conjunction with goal.
 * @ivar goal The total number of items to index/actions to perform in this job.
 *     This number may increase during the life of the job, but should not
 *     decrease.  This is used by the status notification code in conjunction
 *     with the goal.
 * @ivar recoverable Integer indicating if this job is recoverable, and how
 *     many failures we should allow for before we give up.  By default, this is
 *     set to 10, but your job should choose a more appopriate number itself.
 *
 * @constructor
 */
function IndexingJob(aJobType, aDeltaType, aID) {
  this.jobType = aJobType;
  this.deltaType = aDeltaType;
  this.id = aID;
  this.items = [];
  this.offset = 0;
  this.goal = null;
  this.recoverable = 10;
}

/**
 * @namespace Core indexing logic, plus message-specific indexing logic.
 *
 * === Indexing Goals
 * We have the following goals:
 *
 * Responsiveness
 * - When the user wants to quit, we should be able to stop and quit in a timely
 *   fasion.
 * - We should not interfere with the user's thunderbird usage.
 *
 * Correctness
 * - Quitting should not result in any information loss; we should (eventually)
 *   end up at the same indexed state regardless of whether a user lets
 *   indexing run to completion or restarts thunderbird in the middle of the
 *   process.  (It is okay to take slightly longer in the latter case.)
 * 
 * Worst Case Scenario Avoidance
 * - We should try to be O(1) memory-wise regardless of what notifications
 *   are thrown at us.
 *
 * === Indexing Strategy
 * To these ends, we implement things like so:
 *
 * Mesage State Tracking
 * - We store a property on all indexed headers indicating their gloda message
 *   id.  This allows us to tell whether a message is indexed from the header,
 *   without having to consult the SQL database.
 * - When we receive an event that indicates that a message's meta-data has
 *   changed and gloda needs to re-index the message, we set a property on the
 *   header that indicates the message is dirty.
 * - We store a property on folders that indicate that the folder's index is
 *   up-to-date.  Absence of this property is akin to a 0=folder not up to date.
 *   There is no particular reason for the choice of using the folder's
 *   properties (via the folder cache implementation) over gloda's own folder
 *   meta-data.
 *
 * Indexing Message Control
 * - We index IMAP messages that are offline.  We index all local messages.
 *   We plan to avoid indexing news messages.
 * - We would like a way to express desires about indexing that either don't
 *   confound offline storage with indexing, or actually allow some choice.
 *
 * Indexing
 * - We process one folder at a time, walking the headers in the folder,
 *   indexing those which should be indexed, but which have never been indexed
 *   or are dirty.
 * - For local folders, we use GetDatabaseWithReparse to ensure that the .msf
 *   file exists.  For IMAP folders, we simply use GetDatabase because we know
 *   the auto-sync logic will make sure that the folder is up-to-date and we
 *   want to avoid creating problems through use of updateFolder.
 *
 * Indexing Throttling
 * - Unless we believe everything is up-to-date, then we are always indexing.
 *   We must be able to process messages 
 *
 *
 * === Message Indexing
 * 
 * We are good at listening to nsIMsgFolderListener events.  Unfortunately,
 *  MailNews isn't pervasively thorough at generating these yet (newsgroups
 *  don't produce them, probably not RSS either.)  This provides us with
 *  message addition, moves/copies, and deletion.
 * We are not good at listening to nsIFolderListener events.  This means we fail
 *  to update ourselves when a message is changed because of a change in tags,
 *  read status/starred status/etc.  (Well, in fairness, events aren't actually
 *  generated in all of those cases either, yet, but we should try.)  We need
 *  to handle this.
 *
 * Currently, when we index a message, when it comes to attributes, we ignore
 *  all that has come before us and simply blow away the attributes and apply
 *  those provided by the attribute providers anew.  This is not particularly
 *  efficient for anyone.  Also, I think we probably screw this up now that we
 *  have object identity support.  Uh, so, this should be improved, but
 *  certainly works.
 * 
 */
var GlodaIndexer = {
  /**
   * A partial attempt to generalize to support multiple databases.  Each
   *  database would have its own datastore would have its own indexer.  But
   *  we rather inter-mingle our use of this field with the singleton global
   *  GlodaDatastore.
   */
  _datastore: GlodaDatastore,
  _log: Log4Moz.repository.getLogger("gloda.indexer"),
  /**
   * Our nsITimer that we use to schedule ourselves on the main thread
   *  intermittently.  The timer always exists but may not always be active.
   */
  _timer: null,
  /**
   * Our nsITimer that we use to schedule events in the "far" future.  For now,
   *  this means not compelling an initial indexing sweep until some number of
   *  seconds after startup. 
   */
  _longTimer: null,

  _inited: false,
  /**
   * Initialize the indexer.
   */
  _init: function gloda_index_init() {
    if (this._inited)
      return;
    
    this._inited = true;
    
    // initialize our listeners' this pointers
    this._databaseAnnouncerListener.indexer = this;
    this._msgFolderListener.indexer = this;
    
    this._callbackHandle.init();
    
    // create the timer that drives our intermittent indexing
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    // create the timer for larger offsets independent of indexing
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

    // figure out if event-driven indexing should be enabled...
    let prefService = Cc["@mozilla.org/preferences-service;1"].
                        getService(Ci.nsIPrefService);
    let branch = prefService.getBranch("mailnews.database.global.indexer.");
    let eventDrivenEnabled = false; // default
    let performInitialSweep = true; // default
    try {
      eventDrivenEnabled = branch.getBoolPref("enabled");
    } catch (ex) {
      dump("%%% annoying exception on pref access: " + ex);
    }
    // this is a secret preference mainly intended for testing purposes.
    try {
      performInitialSweep = branch.getBoolPref("perform_initial_sweep");
    } catch (ex) {}
    // pretend we have already performed an initial sweep...
    if (!performInitialSweep)
      this._initialSweepPerformed = true;

    this.enabled = eventDrivenEnabled;
  },
  
  /**
   * When shutdown, indexing immediately ceases and no further progress should
   *  be made.  This flag goes true once, and never returns to false.  Being
   *  in this state is a destructive thing from whence we cannot recover.
   */
  _indexerIsShutdown: false,
  
  /**
   * Shutdown the indexing process and datastore as quickly as possible in
   *  a synchronous fashion.
   * 
   * @returns true on full and immediate shutdown, false if we need to pend on
   *     something asynchronous.
   */
  _shutdown: function gloda_index_shutdown() {
    // no more timer events, please
    try {
      this._timer.cancel();
    } catch (ex) {}
    this._timer = null;
    try {
      this._longTimer.cancel();
    } catch (ex) {}
    this._longTimer = null;
    
    this._indexerIsShutdown = true;
    
    if (!this.enabled)
      return true;
    
    this._log.info("Shutting Down");

    this.suppressIndexing = true;
    this._indexerLeaveFolder(); // nop if we aren't "in" a folder
    this._callbackHandle.cleanup();
    this._workBatchData = undefined;
    this.enabled = false;

    GlodaDatastore.shutdown();
  },
  
  _otherIndexers: [],
  registerIndexer: function gloda_index_registerIndexer(aIndexer) {
    this._log.info("Registering indexer: " + aIndexer.name);
    this._otherIndexers.push(aIndexer);
    
    try {
      for each (let [iWorker, workerInfo] in Iterator(aIndexer.workers)) {
        let [workerCode, workerFunc] = workerInfo;
        this._otherIndexerWorkers[workerCode] = [aIndexer, workerFunc];
      }
    }
    catch (ex) {
      this._log.warning("Helper indexer threw exception on worker enum.");
    }
    
    if (this._enabled) {
      try {
        aIndexer.enable();
      } catch (ex) {
        this._log.warning("Helper indexer threw exception on enable: " + ex);
      }
    }
  },
  
  /**
   * Are we enabled, read: are we processing change events?
   */
  _enabled: false,
  get enabled() { return this._enabled; },
  set enabled(aEnable) {
    if (!this._enabled && aEnable) {
      // register for:
      // - folder loaded events, so we know when getDatabaseWithReparse has finished
      //   updating the index/what not (if it was't immediately available)
      // - property changes (so we know when a message's read/starred state have
      //   changed.)
      let mailSession = Cc["@mozilla.org/messenger/services/session;1"].
                          getService(Ci.nsIMsgMailSession);
      this._folderListener._init(this);
      mailSession.AddFolderListener(this._folderListener,
                                    Ci.nsIFolderListener.propertyFlagChanged |
                                    Ci.nsIFolderListener.event);
  
      // register for shutdown, offline notifications
      let observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
      observerService.addObserver(this, "network:offline-status-changed", false);
      observerService.addObserver(this, "quit-application", false);
  
      // register for idle notification
      let idleService = Cc["@mozilla.org/widget/idleservice;1"].
                          getService(Ci.nsIIdleService);
      idleService.addIdleObserver(this, this._indexIdleThresholdSecs);

      let notificationService =
        Cc["@mozilla.org/messenger/msgnotificationservice;1"].
        getService(Ci.nsIMsgFolderNotificationService);
      notificationService.addListener(this._msgFolderListener,
                                      Ci.nsIMsgFolderNotificationService.all);
      
      this._enabled = true;
      
      for each (let [iIndexer, indexer] in Iterator(this._otherIndexers)) {
        try {
          indexer.enable();
        } catch (ex) {
          this._log.warning("Helper indexer threw exception on enable: " + ex);
        }
      }
      
      // if we have an accumulated desire to index things, kick it off again.
      if (this._indexingDesired) {
        this._indexingDesired = false; // it's edge-triggered for now
        this.indexing = true;
      }
      
      // if we have not done an initial sweep, schedule scheduling one.
      if (!this._initialSweepPerformed)
        this._longTimer.initWithCallback(this._scheduleInitialSweep,
          this._initialSweepDelay, Ci.nsITimer.TYPE_ONE_SHOT);
    }
    else if (this._enabled && !aEnable) {
      for each (let [iIndexer, indexer] in Iterator(this._otherIndexers)) {
        try {
          indexer.disable();
        } catch (ex) {
          this._log.warning("Helper indexer threw exception on disable: " + ex);
        }
      }

      // remove observer; no more events to observe!
      let observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
      observerService.removeObserver(this, "network:offline-status-changed");
      observerService.removeObserver(this, "quit-application");
  
      // remove idle
      let idleService = Cc["@mozilla.org/widget/idleservice;1"].
                          getService(Ci.nsIIdleService);
      idleService.removeIdleObserver(this, this._indexIdleThresholdSecs);
  
      // remove FolderLoaded notification listener
      let mailSession = Cc["@mozilla.org/messenger/services/session;1"].
                          getService(Ci.nsIMsgMailSession);
      mailSession.RemoveFolderListener(this._folderListener);

      let notificationService =
        Cc["@mozilla.org/messenger/msgnotificationservice;1"].
        getService(Ci.nsIMsgFolderNotificationService);
      notificationService.removeListener(this._msgFolderListener);
      
      this._enabled = false;
    }
    
    this._log.info("Event-Driven Indexing is now " + this._enabled);
  },

  /** Track whether indexing is desired (we have jobs to prosecute). */
  _indexingDesired: false,
  /**
   * Track whether we have an actively pending callback or timer event.  We do
   *  this so we don't experience a transient suppression and accidentally
   *  get multiple event-chains driving indexing at the same time (which the
   *  code will not handle correctly).
   */
  _indexingActive: false,
  /**
   * Indicates whether indexing is currently ongoing.  This may return false
   *  while indexing activities are still active, but they will quiesce shortly.
   */
  get indexing() {
    return this._indexingDesired && !this._suppressIndexing;
  },
  /** Indicates whether indexing is desired. */
  get indexingDesired() {
    return this._indexingDesired;
  },
  /**
   * Set this to true to indicate there is indexing work to perform.  This does
   *  not mean indexing will begin immediately (if it wasn't active), however.
   *  If suppressIndexing has been set, we won't do anything until indexing is
   *  no longer suppressed.
   */
  set indexing(aShouldIndex) {
    if (!this._indexingDesired && aShouldIndex) {
      this._indexingDesired = true;
      if (this.enabled && !this._indexingActive && !this._suppressIndexing) {
        this._log.info("+++ Indexing Queue Processing Commencing");
        this._indexingActive = true;
        this._timer.initWithCallback(this._wrapCallbackDriver,
                                     this._indexInterval,
                                     Ci.nsITimer.TYPE_ONE_SHOT);
      }
    }
  },
  
  _suppressIndexing: false,
  /**
   * Set whether or not indexing should be suppressed.  This is to allow us to
   *  avoid running down a laptop's battery when it is not on AC.  Only code
   *  in charge of regulating that tracking should be setting this variable; if
   *  other factors want to contribute to such a decision, this logic needs to
   *  be changed to track that, since last-write currently wins.
   */
  set suppressIndexing(aShouldSuppress) {
    this._suppressIndexing = aShouldSuppress;
    
    // re-start processing if we are no longer suppressing, there is work yet
    //  to do, and the indexing process had actually stopped.
    if (!this._suppressIndexing && this._indexingDesired &&
        !this._indexingActive) {
        this._log.info("+++ Indexing Queue Processing Resuming");
        this._indexingActive = true;
        this._timer.initWithCallback(this._wrapCallbackDriver,
                                     this._indexInterval,
                                     Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  /**
   * Our timer-driven callback to schedule our first initial indexing sweep.
   *  Because it is invoked by an nsITimer it operates without the benefit of
   *  a 'this' context and must use GlodaIndexer instead of this.
   * Since an initial sweep could have been performed before we get invoked,
   *  we need to check whether an initial sweep is still desired before trying
   *  to schedule one.  We don't need to worry about whether one is active
   *  because the indexingSweepNeeded takes care of that.  
   */
  _scheduleInitialSweep: function gloda_index_scheduleInitialSweep() {
    if (!GlodaIndexer._initialSweepPerformed)
      GlodaIndexer.indexingSweepNeeded = true;
  },
  
  _initialSweepPerformed: false,
  _indexingSweepActive: false,
  /**
   * Indicate that an indexing sweep is desired.  We kick-off an indexing
   *  sweep at start-up and whenever we receive an event-based notification
   *  that we either can't process as an event or that we normally handle
   *  during the sweep pass anyways.
   */
  set indexingSweepNeeded(aNeeded) {
    if (!this._indexingSweepActive && aNeeded) {
      this._indexQueue.push(new IndexingJob("sweep", 0, null));
      this._indexingJobGoal++;
      this._indexingSweepActive = true;
      this.indexing = true;
    }
  },

  /**
   * Indicates that we have pending deletions to process, meaning that there
   *  are gloda message rows flagged for deletion.  If this value is a boolean,
   *  it means the value is known reliably.  If this value is null, it means
   *  that we don't know, likely because we have started up and have not checked
   *  the database.
   */
  pendingDeletions: null,
  
  GLODA_MESSAGE_ID_PROPERTY: "gloda-id",
  GLODA_DIRTY_PROPERTY: "gloda-dirty",
  /**
   * The message (or folder state) is believed up-to-date.
   */
  kMessageClean: 0,
  /**
   * The message (or folder) is known to not be up-to-date. In the case of
   *  folders, this means that some of the messages in the folder may be dirty.
   *  However, because of the way our indexing works, it is possible there may
   *  actually be no dirty messages in a folder.  (We attempt to process
   *  messages in an event-driven fashion for a finite number of messages, but
   *  because we can quit without completing processing of the queue, we need to
   *  mark the folder dirty, just-in-case.)  (We could do some extra leg-work
   *  and do a better job of marking the folder clean again.)   
   */
  kMessageDirty: 1,
  /**
   * We have not indexed the folder at all, but messages in the folder think
   *  they are indexed.  Once we mark all the messages in the folder as being
   *  dirty so that they don't confuse us, we downgrade the folder's dirty
   *  status to just kMessageDirty.
   */
  kMessageFilthy: 2,

  kWorkSync: Gloda.kWorkSync,
  kWorkAsync: Gloda.kWorkAsync,
  kWorkDone: Gloda.kWorkDone,
  kWorkPause: Gloda.kWorkPause,
  kWorkDoneWithResult: Gloda.kWorkDoneWithResult,
  
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
   * The number of seconds before we declare the user idle and step up our
   *  indexing.
   */
  _indexIdleThresholdSecs: 15,
  
  /**
   * The time delay in milliseconds before we should schedule our initial sweep.
   */
  _initialSweepDelay: 10000,
  
  /**
   * The time interval, in milliseconds between performing indexing work.
   *  This may be altered by user session (in)activity.
   */ 
  _indexInterval: 100,
  _indexInterval_whenActive: 100,
  _indexInterval_whenIdle: 20,
  /**
   * Number of indexing 'tokens' we are allowed to consume before yielding for
   *  each incremental pass.  Consider a single token equal to indexing a single
   *  medium-sized message.  This may be altered by user session (in)activity.
   * Because we fetch message bodies, which is potentially asynchronous, this
   *  is not a precise knob to twiddle.
   */
  _indexTokens: 2,
  _indexTokens_whenActive: 2,
  _indexTokens_whenIdle: 10,
  
  /**
   * Number of indexing 'tokens' we consume before we issue a commit.  The
   *  goal is to de-couple our time scheduling from our commit schedule.  It's
   *  far better for user responsiveness to take lots of little bites instead
   *  of a few big ones, but bites that result in commits cannot be little... 
   */
  _indexCommitTokens: 10,
  
  /**
   * The number of messages that we should queue for processing before letting
   *  them fall on the floor and relying on our folder-walking logic to ensure
   *  that the messages are indexed.
   * The reason we allow for queueing messages in an event-driven fashion is
   *  that once we have reached a steady-state, it is preferable to be able to
   *  deal with new messages and modified meta-data in a prompt fasion rather
   *  than having to (potentially) walk every folder in the system just to find
   *  the message that the user changed the tag on.
   */
  _indexMaxEventQueueMessages: 20,
  
  _indexListeners: [],
  /**
   * Add an indexing progress listener.  The listener will be notified of at
   *  least all major status changes (idle -> indexing, indexing -> idle), plus
   *  arbitrary progress updates during the indexing process.
   * If indexing is not active when the listener is added, a synthetic idle
   *  notification will be generated.
   *
   * @param aListener A listener function, taking arguments: status (Gloda.
   *     kIndexer*), the folder name if a folder is involved (string or null),
   *     current zero-based job number (int), total number of jobs (int),
   *     current item number being indexed in this job (int), total number
   *     of items in this job to be indexed (int).
   *
   * @TODO should probably allow for a 'this' value to be provided
   * @TODO generalize to not be folder/message specific.  use nouns!
   */
  addListener: function gloda_index_addListener(aListener) {
    // should we weakify?
    if (this._indexListeners.indexOf(aListener) == -1)
      this._indexListeners.push(aListener);
    // if we aren't indexing, give them an idle indicator, otherwise they can
    //  just be happy when we hit the next actual status point.
    if (!this.indexing)
      aListener(Gloda.kIndexerIdle, null, 0, 1, 0, 1);
    return aListener;
  },
  /**
   * Remove the given listener so that it no longer receives indexing progress
   *  updates.
   */
  removeListener: function gloda_index_removeListener(aListener) {
    let index = this._indexListeners.indexOf(aListener);
    if (index != -1)
      this._indexListeners.splice(index, 1);
  },
  /**
   * Helper method to tell listeners what we're up to.  For code simplicity,
   *  the caller is just deciding when to send this update (preferably at
   *  reasonable intervals), and doesn't need to provide any indication of
   *  state... we figure that out ourselves.
   */
  _notifyListeners: function gloda_index_notifyListeners() {
    let status, prettyName, jobIndex, jobTotal, jobItemIndex, jobItemGoal;
    
    if (this.indexing && this._curIndexingJob) {
      let job = this._curIndexingJob;
      if (job.deltaType > 0)
        status = Gloda.kIndexerIndexing;
      else if (job.deltaType == 0)
        status = Gloda.kIndexerMoving;
      else
        status = Gloda.kIndexerRemoving;
        
      let prettyName = (this._indexingFolder !== null) ?
                       this._indexingFolder.prettiestName : null;

      jobIndex = this._indexingJobCount-1;
      jobTotal = this._indexingJobGoal;
      jobItemIndex = job.offset;
      jobItemGoal  = job.goal;
    }
    else {
      status = Gloda.kIndexerIdle;
      prettyName = null;
      jobIndex = 0;
      jobTotal = 1;
      jobItemIndex = 0;
      jobItemGoal = 1;
    }
      
    for (let iListener = this._indexListeners.length-1; iListener >= 0; 
         iListener--) {
      let listener = this._indexListeners[iListener];
      listener(status, prettyName, jobIndex, jobTotal, jobItemIndex,
               jobItemGoal);
    }
  },
  
  /** The GlodaFolder corresponding to the folder we are indexing. */
  _indexingGlodaFolder: null,
  /** The nsIMsgFolder we are currently indexing. */
  _indexingFolder: null,
  /** The nsIMsgDatabase we are currently indexing. */
  _indexingDatabase: null,
  /**
   * The iterator we are using to iterate over the headers in
   *  this._indexingDatabase.
   */
  _indexingIterator: null,
  
  /** folder whose entry we are pending on */
  _pendingFolderEntry: null,
  
  /**
   * Common logic that we want to deal with the given folder ID.  Besides
   *  cutting down on duplicate code, this ensures that we are listening on
   *  the folder in case it tries to go away when we are using it.
   *
   * @return true when the folder was successfully entered, false when we need
   *     to pend on notification of updating of the folder (due to re-parsing
   *     or what have you).  In the event of an actual problem, an exception
   *     will escape.
   */
  _indexerEnterFolder: function gloda_index_indexerEnterFolder(aFolderID,
                                                               aNeedIterator) {
    // leave the folder if we haven't explicitly left it.
    if (this._indexingFolder !== null) {
      this._indexerLeaveFolder();
    }
    
    this._indexingGlodaFolder = GlodaDatastore._mapFolderID(aFolderID);
    this._indexingFolder = this._indexingGlodaFolder.getXPCOMFolder(
                             this._indexingGlodaFolder.kActivityIndexing);
    
    if (this._indexingFolder)
      this._log.debug("Entering folder: " + this._indexingFolder.URI);

    try {
      // The msf may need to be created or otherwise updated for local folders.
      // This may require yielding until such time as the msf has been created.
      try {
        if (this._indexingFolder instanceof Ci.nsIMsgLocalMailFolder) {
          this._indexingDatabase =
            this._indexingFolder.getDatabaseWithReparse(this._indexingFolder,
                                                        null);
        }
        // we need do nothing special for IMAP, news, or other
      }
      catch ( e if e.result == Cr.NS_ERROR_NOT_INITIALIZED) {
        // this means that we need to pend on the update.
        this._log.debug("Pending on folder load...");
        this._pendingFolderEntry = this._indexingFolder;
        // do not set _indexingGlodaFolder.indexing to false at this point,
        //  because it might decide to sever the nsIMsgFolder's reference to the
        //  database which would, at the very least, confuse things.
        this._indexingFolder = null;
        this._indexingGlodaFolder = null;
        this._indexingDatabase = null;
        this._indexingIterator = null;
        return this.kWorkAsync;
      }
      // we get an nsIMsgDatabase out of this (unsurprisingly) which
      //  explicitly inherits from nsIDBChangeAnnouncer, which has the
      //  AddListener call we want.
      if (this._indexingDatabase == null)
        this._indexingDatabase = this._indexingFolder.getMsgDatabase(null);
      if (aNeedIterator)
        this._indexerGetIterator();
      this._indexingDatabase.AddListener(this._databaseAnnouncerListener);
    }
    catch (ex) {
      this._log.error("Problem entering folder: " +
                      (this._indexingFolder ?
                         this._indexingFolder.prettiestName : "unknown") + 
                      ", skipping. Error was: " + ex.fileName + ":" +
                      ex.lineNumber + ": " + ex);
      this._indexingGlodaFolder.indexing = false;
      this._indexingFolder = null;
      this._indexingGlodaFolder = null;
      this._indexingDatabase = null;
      this._indexingIterator = null;
      
      // re-throw, we just wanted to make sure this junk is cleaned up and
      //  get localized error logging...
      throw ex;
    }
    
    return this.kWorkSync;
  },
  
  _indexerGetIterator: function gloda_indexer_indexerGetIterator() {
    this._indexingIterator = fixIterator(
                               this._indexingDatabase.EnumerateMessages(),
                               Ci.nsIMsgDBHdr);
  },
  
  _indexerLeaveFolder: function gloda_index_indexerLeaveFolder(aExpected) {
    if (this._indexingFolder !== null) {
      if (this._indexingDatabase) {
        this._indexingDatabase.Commit(Ci.nsMsgDBCommitType.kLargeCommit);
        // remove our listener!
        this._indexingDatabase.RemoveListener(this._databaseAnnouncerListener);
      }
      // let the gloda folder know we are done indexing
      this._indexingGlodaFolder.indexing = false;
      // null everyone out
      this._indexingFolder = null;
      this._indexingGlodaFolder = null;
      this._indexingDatabase = null;
      this._indexingIterator = null;
    }
  },
  
  /**
   * Event fed to us by our nsIFolderListener when a folder is loaded.  We use
   *  this event to two ends:
   *
   * - Know when a folder we were trying to open to index is actually ready to
   *   be indexed.  (The summary may have not existed, may have been out of
   *   date, or otherwise.)
   * - Know when 
   *
   * @param aFolder An nsIMsgFolder, already QI'd.
   */
  _onFolderLoaded: function gloda_index_onFolderLoaded(aFolder) {
    if ((this._pendingFolderEntry !== null) &&
        (aFolder.URI == this._pendingFolderEntry.URI)) {
      this._log.debug("...Folder Loaded!");
      this._pendingFolderEntry = null;
      this.callbackDriver();
    }
  },
  
  /**
   * A simple wrapper to make 'this' be right for incrementalIndex.
   */
  _wrapCallbackDriver: function gloda_index_wrapCallbackDriver() {
    GlodaIndexer.callbackDriver();
  },

  /**
   * The current processing 'batch' generator, produced by a call to workBatch()
   *  and used by callbackDriver to drive execution.
   */
  _batch: null,
  _inCallback: false,
  _savedCallbackArgs: null,
  /**
   * The root work-driver.  callbackDriver creates workBatch generator instances
   *  (stored in _batch) which run until they are done (kWorkDone) or they
   *  (really the embedded _actualWorker) encounter something asynchronous.
   *  The convention is that all the callback handlers end up calling us,
   *  ensuring that control-flow properly resumes.  If the batch completes,
   *  we re-schedule ourselves after a time delay (controlled by _indexInterval)
   *  and return.  (We use one-shot timers because repeating-slack does not
   *  know enough to deal with our (current) asynchronous nature.)
   */
  callbackDriver: function gloda_index_callbackDriver() {
    // just bail if we are shutdown
    if (this._indexerIsShutdown)
      return;
    
    // it is conceivable that someone we call will call something that in some
    //  cases might be asynchronous, and in other cases immediately generate
    //  events without returning.  In the interest of (stack-depth) sanity,
    //  let's handle this by performing a minimal time-delay callback.
    // this is also now a good thing sequencing-wise.  if we get our callback
    //  with data before the underlying function has yielded, we obviously can't
    //  cram the data in yet.  Our options in this case are to either mark the
    //  fact that the callback has already happened and immediately return to
    //  the iterator when it does bubble up the kWorkAsync, or we can do as we
    //  have been doing, but save the 
    if (this._inCallback) {
      this._savedCallbackArgs = arguments;
      this._timer.initWithCallback(this._wrapCallbackDriver,
                                   0,
                                   Ci.nsITimer.TYPE_ONE_SHOT);
      return;
    }
    this._inCallback = true;

    try {
      if (this._batch === null)
        this._batch = this.workBatch();
      
      // kWorkAsync, kWorkDone, kWorkPause are allowed out; kWorkSync is not
      // On kWorkDone, we want to schedule another timer to fire on us if we are
      //  not done indexing.  (On kWorkAsync, we don't care what happens, because
      //  someone else will be receiving the callback, and they will call us when
      //  they are done doing their thing.
      let args;
      if (this._savedCallbackArgs != null) {
        args = this._savedCallbackArgs;
        this._savedCallbackArgs = null;
      }
      else
        args = arguments; //Array.slice.call(arguments);
      
      let result;
      if (args.length == 0)
        result = this._batch.next();
      else if (args.length == 1)
        result = this._batch.send(args[0]);
      else // arguments works with destructuring assignment
        result = this._batch.send(args);
      switch (result) {
        // job's done, close the batch and re-schedule ourselves if there's more
        //  to do.
        case this.kWorkDone:
          this._batch.close();
          this._batch = null;
          // (intentional fall-through to re-scheduling logic) 
        // the batch wants to get re-scheduled, do so.
        case this.kWorkPause:
          if (this.indexing)
            this._timer.initWithCallback(this._wrapCallbackDriver,
                                         this._indexInterval,
                                         Ci.nsITimer.TYPE_ONE_SHOT);
          else // it's important to indicate no more callbacks are in flight
            this._indexingActive = false;
          break;
        case this.kWorkAsync:
          // there is nothing to do.  some other code is now responsible for
          //  calling us.
          break;
      }
    }
    finally {    
      this._inCallback = false;
    }
  },

  _callbackHandle: {
    init: function gloda_index_callbackhandle_init() {
      this.wrappedCallback = GlodaIndexer._wrapCallbackDriver;
      this.callbackThis = GlodaIndexer;
      this.callback = GlodaIndexer.callbackDriver;
    },
    activeStack: [],
    activeIterator: null,
    push: function gloda_index_callbackhandle_push(aIterator) {
      this.activeStack.push(aIterator);
      this.activeIterator = aIterator;
    },
    pushAndGo: function gloda_index_callbackhandle_pushAndGo(aIterator) {
      this.push(aIterator);
      return this.activeIterator.next();
    },
    pop: function gloda_index_callbackhandle_pop() {
      this.activeIterator.close();
      this.activeStack.pop();
      if (this.activeStack.length)
        this.activeIterator = this.activeStack[this.activeStack.length - 1];
      else
        this.activeIterator = null;
    },
    /**
     * Someone propagated an exception and we need to clean-up all the active
     *  logic as best we can.  Which is not really all that well.
     */
    cleanup: function gloda_index_callbackhandle_cleanup(aOptionalStopAtDepth) {
      if (aOptionalStopAtDepth === undefined)
        aOptionalStopAtDepth = 0;
      while (this.activeStack.length > aOptionalStopAtDepth) {
        this.pop();
      }
    },
    popWithResult: function gloda_index_callbackhandle_popWithResult() {
      this.pop();
      let result = this._result;
      this._result = null;
      return result;
    },
    _result: null,
    doneWithResult: function gloda_index_callbackhandle_doneWithResult(aResult){
      this._result = aResult;
      return Gloda.kWorkDoneWithResult;
    },
    
    /* be able to serve as a collection listener, resuming the active iterator's
       last yield kWorkAsync */
    onItemsAdded: function() {},
    onItemsModified: function() {},
    onItemsRemoved: function() {},
    onQueryCompleted: function(aCollection) {
      GlodaIndexer.callbackDriver();
    }
  },
  _forceGCCounter: 0,
  FORCE_GC_THRESHOLD: 256,
  _workBatchData: undefined,
  /**
   * The workBatch generator handles a single 'batch' of processing, managing
   *  the database transaction and keeping track of "tokens".  It drives the
   *  _actualWorker generator which is doing the work.
   * workBatch will only produce kWorkAsync and kWorkDone notifications.
   *  If _actualWorker returns kWorkSync and there are still tokens available,
   *  workBatch will keep driving _actualWorker until it encounters a
   *  kWorkAsync (which workBatch will yield to callbackDriver), or it runs
   *  out of tokens and yields a kWorkDone. 
   */
  workBatch: function gloda_index_workBatch() {
    let commitTokens = this._indexCommitTokens;
    GlodaDatastore._beginTransaction();

    while (commitTokens > 0) {
      for (let tokensLeft = this._indexTokens; tokensLeft > 0;
          tokensLeft--, commitTokens--) {
        // we need to periodically force a GC to avoid excessive process size
        //  and because nsAutoLock is a jerk on debug builds
        if (++this._forceGCCounter >= this.FORCE_GC_THRESHOLD) {
          Cu.forceGC();
          this._forceGCCounter = 0;
        }
        
        if ((this._callbackHandle.activeIterator === null) &&
            !this._hireJobWorker()) {
          commitTokens = 0;
          break;
        }
      
        // XXX for performance, we may want to move the try outside the for loop
        //  with a quasi-redundant outer loop that shunts control back inside
        //  if we left the loop due to an exception (without consuming all the
        //  tokens.)
        try {
          switch (this._callbackHandle.activeIterator.send(this._workBatchData)) {
            case this.kWorkSync:
              this._workBatchData = undefined;
              break;
            case this.kWorkAsync:
              this._workBatchData = yield this.kWorkAsync;
              break;
            case this.kWorkDone:
              this._callbackHandle.pop();
              this._workBatchData = undefined;
              tokensLeft++; // don't eat a token for this pass
              break;
            case this.kWorkDoneWithResult:
              this._workBatchData = this._callbackHandle.popWithResult();
              tokensLeft++; // don't eat a token for this pass
              continue;
          }
        }
        catch (ex) {
          // Try and recover if the job is recoverable and the iterator that
          //  experienced the problem wasn't the job worker.  (If it was the
          //  job worker, we can't rely on its state to be intact.) 
          if (this._curIndexingJob.recoverable > 0 &&
              this._callbackHandle.activeStack.length > 1) {
            this._curIndexingJob.recoverable--;
            this._log.warn("Problem during job, trying to recover.  Problem " +
              "was at " + ex.fileName + ":" + ex.lineNumber + ": " + ex);
            // cleanup but leave the job's iterator intact.
            this._callbackHandle.cleanup(1);
            // the data must now be invalid
            this._workBatchData = undefined;
          }
          else {
            this._log.warn("Bailing on job (at " + ex.fileName + ":" +
                ex.lineNumber + ") because: " + ex);
            // make sure we no longer have a current folder
            this._indexerLeaveFolder(true);
            this._curIndexingJob = null;
            // clear out our current generators and our related data
            this._callbackHandle.cleanup();
            this._workBatchData = undefined;
          }
        }
      }
      
      // take a breather by having the caller re-schedule us sometime in the
      //  future, but only if we're going to perform another loop iteration.
      if (commitTokens > 0)
        yield this.kWorkPause;
    }
    // XXX doing the dirty commit/check every time could be pretty expensive...
    GlodaCollectionManager.cacheCommitDirty();
    GlodaDatastore._commitTransaction();
    
    // try and get a job if we don't have one for the sake of the notification
    if (this.indexing && (this._actualWorker === null))
      this._hireJobWorker();
    this._notifyListeners();
    
    yield this.kWorkDone;
  },

  _otherIndexerWorkers: {},
  /**
   * Perform the initialization step and return a generator if there is any
   *  steady-state processing to be had.
   */
  _hireJobWorker: function gloda_index_hireJobWorker() {
    if (this._indexQueue.length == 0) {
      this._log.info("--- Done indexing, disabling timer renewal.");
      
      if (this._indexingFolder !== null) {
        this._indexerLeaveFolder(true);
      }
      
      this._curIndexingJob = null;
      this._indexingDesired = false;
      this._indexingJobCount = 0;
      this._indexingJobGoal = 0;
      return false;
    }

    //this._log.debug("++ Pulling job from queue of size " +
    //                this._indexQueue.length);
    let job = this._curIndexingJob = this._indexQueue.shift();
    this._indexingJobCount++;
    //this._log.debug("++ Pulled job: " + job.jobType + ", " +
    //                job.deltaType + ", " + job.id);
    let generator = null;
    
    if (job.jobType == "sweep") {
      generator = this._worker_indexingSweep(job);
    }
    else if (job.jobType == "folder") {
      generator = this._worker_folderIndex(job);
    }
    else if(job.jobType == "message") {
      // we do not want new work items to be added as we are processing, so
      //  clear _pendingAddJob.  A new job will be created as needed.
      if (job === this._pendingAddJob)
        this._pendingAddJob = null;
      // update our goal from the items length
      job.goal = job.items.length;
                  
      generator = this._worker_messageIndex(job);
    }
    else if (job.jobType == "delete") {
      // we'll count the block processing as a cost of 1...
      job.goal = 1;
      generator = this._worker_processDeletes(job);
    }
    else if (job.jobType in this._otherIndexerWorkers) {
      let [indexer, workerFunc] = this._otherIndexerWorkers[job.jobType];
      generator = workerFunc.call(indexer, job, this._callbackHandle);
    }
    else {
      this._log.warning("Unknown job type: " + job.jobType);
    }
    
    if (generator) {
      this._callbackHandle.push(generator);
      return true;
    }
    else
      return false;
  },

  /**
   * Performs the folder sweep, locating folders that should be indexed, and
   *  creating a folder indexing job for them, and rescheduling itself for
   *  execution after that job is completed.  Once it indexes all the folders,
   *  if we believe we have deletions to process (or just don't know), it kicks
   *  off a deletion processing job.
   *
   * Folder traversal logic is based off the spotlight/vista indexer code; we
   *  retrieve the list of servers and folders each time want to find a new
   *  folder to index.  This avoids needing to maintain a perfect model of the
   *  folder hierarchy at all times.  (We may eventually want to do that, but
   *  this is sufficient and safe for now.)  Although our use of dirty flags on
   *  the folders allows us to avoid tracking the 'last folder' we processed,
   *  we do so to avoid getting 'trapped' in a folder with a high rate of
   *  changes.
   */
  _worker_indexingSweep: function gloda_worker_indexingSweep(aJob) {
    // walk the folders
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"].
                           getService(Ci.nsIMsgAccountManager);
    let servers = accountManager.allServers;
    let useNextFolder = false;
    
    if (aJob.lastFolderIndexedUri === undefined)
      aJob.lastFolderIndexedUri = '';
  
    for (let i = 0; i < servers.Count(); i++)
    {
      let server = servers.QueryElementAt(i, Ci.nsIMsgIncomingServer);
      let rootFolder = server.rootFolder;
      
      let allFolders = Cc["@mozilla.org/supports-array;1"].
                         createInstance(Ci.nsISupportsArray);
      rootFolder.ListDescendents(allFolders);
      let numFolders = allFolders.Count();
      for (let folderIndex = 0; folderIndex < numFolders; folderIndex++)
      {
        let folder = allFolders.GetElementAt(folderIndex).QueryInterface(
                                                            Ci.nsIMsgFolder);

        if (!this.shouldIndexFolder(folder))
          continue;
        
        // we could also check nsMsgFolderFlags.Mail conceivably...
        let isLocal = folder instanceof Ci.nsIMsgLocalMailFolder;
        // we only index local folders or IMAP folders that are marked offline.
        if (!isLocal && !(folder.flags & Ci.nsMsgFolderFlags.Offline))
          continue;

        // if no folder was indexed (or the pref's not set), just use the first folder
        if (!aJob.lastFolderIndexedUri || useNextFolder)
        {
          // make sure the folder is dirty before accepting this job...
          let glodaFolder = GlodaDatastore._mapFolder(folder);
          if (!glodaFolder.dirtyStatus)
            continue;
        
          aJob.lastFolderIndexedUri = folder.URI;
          this._indexingJobGoal += 2;
          // add a job for the folder indexing
          this._indexQueue.push(new IndexingJob("folder", 0,
              this._datastore._mapFolder(folder).id));
          // re-schedule this job (although this worker will die)
          this._indexQueue.push(aJob);
          yield this.kWorkDone;
        }
        else
        {
          if (aJob.lastFolderIndexedUri == folder.URI)
            useNextFolder = true;
        }
      }
    }
    
    // consider deletion
    if (this.pendingDeletion || this.pendingDeletion === null) {
      this._indexingJobGoal++;
      this._indexQueue.push(new IndexingJob("delete", 0, null));
      // no need to set this.indexing to true, it must be true if we are here.
    }
    
    // if this is our first sweep, give the other indexers a chance to do their
    //  own initial sweep.  it's on them to schedule their own job if they have
    //  a lot to do, but if they only have a little to do, they can get away
    //  with it, as we yield a sync after each one.
    if (!this._initialSweepPerformed) {
      for each (let [iIndexer, indexer] in Iterator(this._otherIndexers)) {
        try {
          indexer.initialSweep();
        }
        catch (ex) {
          this._log.warning("Helper indexer threw exception on initial sweep:" +
                            ex);
        }
        yield this.kWorkSync;
      }
      this._initialSweepPerformed = true;
    }
    
    // we don't have any more work to do...
    this._indexingSweepActive = false;
    yield this.kWorkDone;
  },

  /**
   * Index the contents of a folder.
   */
  _worker_folderIndex: function gloda_worker_folderIndex(aJob) {
    yield this._indexerEnterFolder(aJob.id, true);
    
    if (!this.shouldIndexFolder(this._indexingFolder))
      yield this.kWorkDone;
    
    aJob.goal = this._indexingFolder.getTotalMessages(false);
    
    // there is of course a cost to all this header investigation even if we
    //  don't do something.  so we will yield with kWorkSync for every block. 
    const HEADER_CHECK_BLOCK_SIZE = 100;
    
    let isLocal = this._indexingFolder instanceof Ci.nsIMsgLocalMailFolder;
    // we can safely presume if we are here that this folder has been selected
    //  for offline processing...

    // Handle the filthy case.  A filthy folder may have misleading properties
    //  on the message that claim the message is indexed.  They are misleading
    //  because the database, for whatever reason, does not have the messages
    //  (accurately) indexed.
    // We need to walk all the messages and mark them filthy if they have a
    //  dirty property.  Once we have done this, we can downgrade the folder's
    //  dirty status to plain dirty.  We do this rather than trying to process
    //  everyone in one go in a filthy context because if we have to terminate
    //  indexing before we quit, we don't want to have to re-index messages next
    //  time.  (This could even lead to never completing indexing in a
    //  pathological situation.)
    let glodaFolder = GlodaDatastore._mapFolder(this._indexingFolder);
    if (glodaFolder.dirtyStatus == glodaFolder.kFolderFilthy) {
      let count = 0;
      for (let msgHdr in this._indexingIterator) {
        // we still need to avoid locking up the UI, pause periodically...
        if (++count % HEADER_CHECK_BLOCK_SIZE == 0)
          yield this.kWorkSync;
        
        let glodaMessageId = msgHdr.getUint32Property(
                             this.GLODA_MESSAGE_ID_PROPERTY);
        // if it has a gloda message id, we need to mark it filthy
        if (glodaMessageId != 0)
          msgHdr.setUint32Property(this.GLODA_DIRTY_PROPERTY,
                                   this.kMessageFilthy);
        // if it doesn't have a gloda message id, we will definitely index it,
        //  so no action is required.
      }
      // this will automatically persist to the database
      glodaFolder.dirtyStatus = glodaFolder.kFolderDirty;
      
      // We used up the iterator, get a new one.
      this._indexerGetIterator();
    }
    
    for (let msgHdr in this._indexingIterator) {
      // per above, we want to periodically release control while doing all
      //  this header traversal/investigation.
      if (++aJob.offset % HEADER_CHECK_BLOCK_SIZE == 0)
        yield this.kWorkSync;
      
      if ((isLocal || (msgHdr.flags & MSG_FLAG_OFFLINE)) &&
          !(msgHdr.flags & MSG_FLAG_EXPUNGED)) {
        // this returns 0 when missing
        let glodaMessageId = msgHdr.getUint32Property(
                             this.GLODA_MESSAGE_ID_PROPERTY);
        
        // if it has a gloda message id, it has been indexed, but it still
        //  could be dirty.
        if (glodaMessageId != 0) {
          // (returns 0 when missing)
          let isDirty = msgHdr.getUint32Property(this.GLODA_DIRTY_PROPERTY)!= 0;

          // it's up to date if it's not dirty 
          if (!isDirty)
            continue;
        }
        
        this._log.debug(">>>  _indexMessage");
        yield this._callbackHandle.pushAndGo(this._indexMessage(msgHdr,
            this._callbackHandle));
        this._log.debug("<<<  _indexMessage");
      }
    }
    
    glodaFolder.dirtyStatus = glodaFolder.kFolderClean;
    
    // by definition, it's not likely we'll visit this folder again anytime soon
    this._indexerLeaveFolder();
    
    yield this.kWorkDone;
  },
  
  /**
   * Index a specific list of messages that we know to index from
   *  event-notification hints.
   */
  _worker_messageIndex: function gloda_worker_messageAdd(aJob) {
    // if we are already in the correct folder, our "get in the folder" clause
    //  will not execute, so we need to make sure this value is accurate in
    //  that case.  (and we want to avoid multiple checks...)
    let folderIsLocal =
      this._indexingFolder instanceof Ci.nsIMsgLocalMailFolder;
    for (; aJob.offset < aJob.items.length; aJob.offset++) {
      let item = aJob.items[aJob.offset];
      // item is either [folder ID, message key] or
      //                [folder ID, message ID]

      // get in the folder
      if (!this._indexingGlodaFolder ||
          this._indexingGlodaFolder.id != item[0]) {
        yield this._indexerEnterFolder(item[0], false);

        // stay out of folders we should not be in!
        if (!this.shouldIndexFolder(this._indexingFolder))
          continue;
        
        folderIsLocal =
          this._indexingFolder instanceof Ci.nsIMsgLocalMailFolder;
      }

      let msgHdr;
      if (typeof item[1] == "number")
        msgHdr = this._indexingFolder.GetMessageHeader(item[1]);
      else
        // same deal as in move processing.
        // TODO fixme to not assume singular message-id's.
        msgHdr = this._indexingDatabase.getMsgHdrForMessageID(item[1]);
      
      // it needs a header, the header needs to not be expunged, plus, the
      //  message needs to be considered offline.
      if (msgHdr &&
          !(msgHdr.flags&MSG_FLAG_EXPUNGED) &&
          (folderIsLocal || (msgHdr.flags & MSG_FLAG_OFFLINE)))
        yield this._callbackHandle.pushAndGo(this._indexMessage(msgHdr,
            this._callbackHandle));
      else
        yield this.kWorkSync;
    }
    yield this.kWorkDone;
  },
  
  /**
   * Process pending deletes...
   */
  _worker_processDeletes: function gloda_worker_processDeletes(aJob,
      aCallbackHandle) {
    // get a block of messages to delete.  for now, let's just do this
    //  synchronously.  we don't care if there are un-landed delete changes
    //  on the asynchronous thread.  (well, there is a potential race that
    //  would result in us clearing pendingDeletions erroneously, but the
    //  processedAny flag and our use of a while loop here make this
    //  sufficiently close to zero until we move to being async.)
    let messagesToDelete = this._datastore.getDeletedMessageBlock();
    let processedAny = false;
    while (messagesToDelete.length) {
      aJob.goal += messagesToDelete.length;
      for each (let [iMessage, message] in Iterator(messagesToDelete)) {
        yield aCallbackHandle.pushAndGo(this._deleteMessage(message));
        aJob.offset++;
        yield this.kWorkSync;
      }
      
      processedAny = true;
      messagesToDelete = this._datastore.getDeletedMessageBlock(); 
    }
    if (processedAny)
      this.pendingDeletions = false;
    
    yield this.kWorkDone;
  },

  /**
   * Determine whether a folder is suitable for indexing.
   * 
   * @param aMsgFolder An nsIMsgFolder you want to see if we should index.
   * 
   * @returns true if we want to index messages in this type of folder, false if
   *     we do not.
   */
  shouldIndexFolder: function(aMsgFolder) {
    let folderFlags = aMsgFolder.flags;
    // only index mail folders but stay out of virtual folders
    return ((folderFlags & Ci.nsMsgFolderFlags.Mail) &&
            !(folderFlags & Ci.nsMsgFolderFlags.Virtual));
  },
  
  /**
   * Queue all of the folders of all of the accounts of the current profile
   *  for indexing.  We traverse all folders and queue them immediately to try
   *  and have an accurate estimate of the number of folders that need to be
   *  indexed.  (We previously queued accounts rather than immediately
   *  walking their list of folders.)
   */
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

  /**
   * Queue all of the folders belonging to an account for indexing.
   */
  indexAccount: function glodaIndexAccount(aAccount) {
    let rootFolder = aAccount.incomingServer.rootFolder;
    if (rootFolder instanceof Ci.nsIMsgFolder) {
      this._log.info("Queueing account folders for indexing: " + aAccount.key);

      let allFolders = Cc["@mozilla.org/supports-array;1"]
                         .createInstance(Ci.nsISupportsArray);
      rootFolder.ListDescendents(allFolders);
      let numFolders = allFolders.Count();
      let folderJobs = [];
      for (let folderIndex = 0; folderIndex < numFolders; folderIndex++) {
        let folder = allFolders.GetElementAt(folderIndex).QueryInterface(
                                                            Ci.nsIMsgFolder);
        if (this.shouldIndexFolder(folder))
          folderJobs.push(
            new IndexingJob("folder", 1, GlodaDatastore._mapFolder(folder).id));
      }
      
      this._indexingJobGoal += folderJobs.length;
      this._indexQueue = this._indexQueue.concat(folderJobs);
      this.indexing = true;
    }
    else {
      this._log.info("Skipping Account, root folder not nsIMsgFolder");
    }
  },

  indexJob: function glodaIndexJob(aJob) {
    this._log.info("Queue-ing job for indexing: " + aJob.jobType);
    
    this._indexQueue.push(aJob);
    this._indexingJobGoal++;
    this.indexing = true;
  },
  
  /**
   * Queue a single folder for indexing given an nsIMsgFolder.
   */
  indexFolder: function glodaIndexFolder(aFolder) {
    this._log.info("Queue-ing folder for indexing: " + aFolder.prettiestName);
    
    this._indexQueue.push(new IndexingJob("folder", 1,
                          GlodaDatastore._mapFolder(aFolder).id));
    this._indexingJobGoal++;
    this.indexing = true;
  },
  
  /**
   * Queue a list of messages for indexing.
   *
   * @param aFoldersAndMessages List of [nsIMsgFolder, message key] tuples.
   */
  indexMessages: function gloda_index_indexMessages(aFoldersAndMessages) {
    let job = new IndexingJob("message", 1, null);
    job.items = [[GlodaDatastore._mapFolder(fm[0]).id, fm[1]] for each
                 ([i, fm] in Iterator(aFoldersAndMessages))];
    this._indexQueue.push(job);
    this._indexingJobGoal++;
    this.indexing = true;
  },
  
  /* *********** Event Processing *********** */
  observe: function gloda_indexer_observe(aSubject, aTopic, aData) {
    // idle
    if (aTopic == "idle") {
      if (this.indexing)
        this._log.debug("Detected idle, throttling up.");
      this._indexInterval = this._indexInterval_whenIdle;
      this._indexTokens = this._indexTokens_whenIdle;
    }
    else if (aTopic == "back") {
      if (this.indexing)
        this._log.debug("Detected un-idle, throttling down.");
      this._indexInterval = this._indexInterval_whenActive;
      this._indexTokens = this._indexTokens_whenActive;
    }
    // offline status
    else if (aTopic == "network:offline-status-changed") {
      if (aData == "offline") {
        this.suppressIndexing = true;
      }
      else { // online
        this.suppressIndexing = false;
      }
    }
    // shutdown fallback
    else if (aTopic == "quit-application") {
      this._shutdown();
    }
  },

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
      // make sure the message is eligible for indexing...
      let msgFolder = aMsgHdr.folder;
      if (!this.indexer.shouldIndexFolder(msgFolder))
        return;
      let isFolderLocal = msgFolder instanceof Ci.nsIMsgLocalMailFolder;
      if (!isFolderLocal && !(msgFolder.flags&Ci.nsMsgFolderFlags.Offline))
        return;
      
      // mark the folder dirty so we know to look in it, but there is no need
      //  to mark the message because it will lack a gloda-id anyways.
      let glodaFolder = GlodaDatastore._mapFolder(msgFolder);
      glodaFolder.dirtyStatus = true;

      if (this.indexer._pendingAddJob === null) {
        this.indexer._pendingAddJob = new IndexingJob("message", 1, null);
        this.indexer._indexQueue.push(this.indexer._pendingAddJob);
        this.indexer._indexingJobGoal++;
      }
      // only queue the message if we haven't overflowed our event-driven budget
      if (this.indexer._pendingAddJob.items.length <
          this.indexer._indexMaxEventQueueMessages) {
        this.indexer._pendingAddJob.items.push(
          [glodaFolder.id, aMsgHdr.messageKey]);
        this.indexer.indexing = true;
        this.indexer._log.debug("msgAdded notification, event indexing");
      }
      else {
        this.indexer.indexingSweepNeeded = true;
        this.indexer._log.debug("msgAdded notification, sweep indexing");
      }
    },
    
    /**
     * Handle real, actual deletion (move to trash and IMAP deletion model
     *  don't count; we only see the deletion here when it becomes forever,
     *  or rather _just before_ it becomes forever.  Because the header is
     *  going away, we need to either process things immediately or extract the
     *  information required to purge it later without the header.
     * To this end, we mark all messages that were indexed in the gloda message
     *  database as deleted.  We set our pending deletions flag to let our
     *  indexing logic know that after its next wave of folder traversal, it
     *  should perform a deletion pass.  If it turns out the messages are coming
     *  back, the fact that deletion is thus deferred can be handy, as we can
     *  reuse the existing gloda message. 
     */
    msgsDeleted: function gloda_indexer_msgsDeleted(aMsgHdrs) {
      this.indexer._log.debug("msgsDeleted notification");
      
      let glodaMessageIds = [];
      
      let deleteJob = new IndexingJob("message", -1, null);
      for (let iMsgHdr = 0; iMsgHdr < aMsgHdrs.length; iMsgHdr++) {
        let msgHdr = aMsgHdrs.queryElementAt(iMsgHdr, Ci.nsIMsgDBHdr);
        try {
          glodaMessageIds.push(msgHdr.getUint32Property(
            this.indexer.GLODA_MESSAGE_ID_PROPERTY));
        }
        catch (ex) {}
      }
      
      if (glodaMessageIds.length) {
        this.indexer._datastore.markMessagesDeletedByIDs(glodaMessageIds);
        this.indexer.pendingDeletions = true;
      }
    },
    
    /**
     * Process a move or copy.
     * Moves to a local folder can be dealt with (relatively) efficiently; the
     *  target message headers exist at the time of the notification.  The trick
     *  is that we aren't provided with them.
     * Moves to an IMAP folder are troublesome because mailnews may not actually
     *  know anything about the messages in their new location.  If there isn't
     *  a currently open connection to the destination folder, we will only hear
     *  about the headers when the user browses there or IMAP auto-sync gets to
     *  the folder.  Either way, we will actually receive a msgAdded event for
     *  each message, so the main thing we need to do is provide a hint to the
     *  indexing logic that the gloda message in question should be reused and
     *  is not a duplicate.
     * Because copied messages are, by their nature, duplicate messages, we
     *  do not particularly care about them.  As such, we defer their processing
     *  to the automatic sync logic that will happen much later on.  This is
     *  potentially desirable in case the user deletes some of the original
     *  messages, allowing us to reuse the gloda message representations when
     *  we finally get around to indexing the messages.  We do need to mark the
     *  folder as dirty, though, to clue in the sync logic.
     */
    msgsMoveCopyCompleted: function gloda_indexer_msgsMoveCopyCompleted(aMove,
                             aSrcMsgHdrs, aDestFolder) {
      this.indexer._log.debug("MoveCopy notification.  Move: " + aMove);
      try {
        if (aMove) {
          // target is a local folder, we can find the destination messages
          if (aDestFolder instanceof Ci.nsIMsgLocalMailFolder) {
            // ...of course, finding the destination messages is not going to
            //  be cheap.  we're O(n) for the messages in the target folder
            //  (which is >= the number of moved messages).
            // XXX for now, we assume the gloda-id is not propagated at the
            //  cost of getting confused if multiple messages have the same
            //  message-id header; we would do better to get the gloda-id
            //  propagated and use that.  (needs C++ code changes.)
            // (we would still need to do the traversal because we still need
            //  to know the messageKey in the target folder...)
            let srcMsgIdToHdr = {};

            for (let iMsgHdr = 0; iMsgHdr < aSrcMsgHdrs.length; iMsgHdr++) {
              let msgHdr = aSrcMsgHdrs.queryElementAt(iMsgHdr, Ci.nsIMsgDBHdr);
              // (note: collissions on message-id headers are possible and sad)
              srcMsgIdToHdr[msgHdr.messageId] = msgHdr;
            }
            let glodaIds = [];
            let newMessageKeys = [];
            for each (let destMsgHdr in fixIterator(aDest.getMessages(null),
                                                    Ci.nsIMsgDBHdr)) {
              let destMsgId = destMsgHdr.messageId;
              let matchingSrcHdr = srcMsgIdToHdr[destMsgId];
              if (matchingSrcHdr) {
                try {
                  let glodaId = matchingSrcHdr.getUint32Property(
                    this.indexer.GLODA_MESSAGE_ID_PROPERTY); 
                  glodaIds.push(glodaId);
                  newMessageKeys.push(destMsgHdr.messageKey);
                }
                // no gloda id means it hasn't been indexed, so the move isn't
                //  required.
                catch (ex) {}
              }
            }
            
            // this method takes care to update the in-memory representations
            //  too; we don't need to do anything
            this.indexer._datastore.updateMessageLocations(glodaIds,
              newMessageKeys, aDestFolder);
          }
          // target is IMAP or something we equally don't understand
          else {
            // XXX the srcFolder will always be the same for now, but we
            //  probably don't want to depend on it, or at least want a unit
            //  test that will break if it changes...
            let srcFolder = aSrcMsgHdrs.queryElementAt(0,Ci.nsIMsgDBHdr).folder;
    
            // get the current (about to be nulled) messageKeys and build the
            //  job list too.
            let messageKeys = [];
            for (let iMsgHdr = 0; iMsgHdr < aSrcMsgHdrs.length; iMsgHdr++) {
              let msgHdr = aSrcMsgHdrs.queryElementAt(iMsgHdr, Ci.nsIMsgDBHdr);
              messageKeys.push(msgHdr.messageKey);
            }
            // XXX we could extract the gloda message id's instead.
            // quickly move them to the right folder, zeroing their message keys
            this.indexer._datastore.updateMessageFoldersByKeyPurging(
              srcFolder, messageKeys, aDestFolder);
            // we _do not_ need to mark the folder as dirty, because the
            //  message added events will cause that to happen.
          }
        }
       // copy case
        else {
          // mark the folder as dirty; we'll get to it later.
          let destGlodaFolder = GlodaDatastore._mapFolder(aDestFolder);
          destGlodaFolder.dirtyStatus = true;
          this.indexer.indexingSweepNeeded = true;
        }
      } catch (ex) {
        this.indexer._log.error("Problem encountered during message move/copy" +
          ": " + ex);
      }
    },
    
    /**
     * Handles folder no-longer-exists-ence.  We mark all messages as deleted
     *  and remove the folder from our URI table.  Currently, if a folder that
     *  contains other folders is deleted, we may either receive one
     *  notification for the folder that is deleted, or a notification for the
     *  folder and one for each of its descendents.  This depends upon the
     *  underlying account implementation, so we explicitly handle each case.
     *  Namely, we treat it as if we're only planning on getting one, but we
     *  handle if the children are already gone for some reason.
     */
    folderDeleted: function gloda_indexer_folderDeleted(aFolder) {
      this.indexer._log.debug("folderDeleted notification");
      
      delFunc = function(folder) {
        if (this._datastore._folderKnown(aFolder)) {
          let folder = GlodaDatastore._mapFolder(aFolder);
          this._datastore.markMessagesDeletedByID(folder.id);
          this._datastore.deleteFolderByID(folder.id);
        }
      };

      let descendentFolders = Cc["@mozilla.org/supports-array;1"].
                                createInstance(Ci.nsISupportsArray);
      aFolder.ListDescendents(descendentFolders);
      
      // (the order of operations does not matter; child, non-child, whatever.)
      // delete the parent
      delFunc(aFolder);
      // delete all its descendents
      for (let folder in fixIterator(descendentFolders, Ci.nsIMsgFolder)) {
        delFunc(folder);
      }
        
      this.indexer.pendingDeletions = true;
    },
    
    /**
     * Handle a folder being copied or moved.
     * Moves are handled by a helper function shared with _folderRenameHelper
     *  (which takes care of any nesting involved).
     * Copies are actually ignored, because our periodic indexing traversal
     *  should discover these automatically.  We could hint ourselves into
     *  action, but arguably a set of completely duplicate messages is not
     *  a high priority for indexing.
     */
    folderMoveCopyCompleted: function gloda_indexer_folderMoveCopyCompleted(
                               aMove, aSrcFolder, aDestFolder) {
      this.indexer._log.debug("folderMoveCopy notification (Move: " + aMove
                              + ")");
      if (aMove) {
        let targetURI = aDestFolder.URI +
                        srcURI.substring(srcURI.lastIndexOf("/"));
        return this._folderRenameHelper(aSrcFolder, targetURI);
      }
      this.indexer.indexingSweepNeeded = true;
    },
    
    /**
     * We just need to update the URI <-> ID maps and the row in the database,
     *  all of which is actually done by the datastore for us.
     * This method needs to deal with the complexity where local folders will
     *  generate a rename notification for each sub-folder, but IMAP folders
     *  will generate only a single notification.  Our logic primarily handles
     *  this by not exploding if the original folder no longer exists.
     */
    _folderRenameHelper: function gloda_indexer_folderRenameHelper(aOrigFolder,
                                                                   aNewURI) {
      let descendentFolders = Cc["@mozilla.org/supports-array;1"].
                                createInstance(Ci.nsISupportsArray);
      aOrigFolder.ListDescendents(descendentFolders);
      
      let origURI = aOrigFolder.URI;
      // this rename is straightforward.
      GlodaDatastore.renameFolder(aOrigFolder, aNewURI);
      
      for (let folder in fixIterator(descendentFolders, Ci.nsIMsgFolder)) {
        let oldSubURI = folder.URI;
        // mangle a new URI from the old URI.  we could also try and do a
        //  parallel traversal of the new folder hierarchy, but that seems like
        //  more work.
        let newSubURI = aNewURI + oldSubURI.substring(origURI.length)
        this.indexer._datastore.renameFolder(oldSubURI, newSubURI);
      }

      this.indexer._log.debug("folder renamed: " + origURI + " to " + aNewURI);
    },
    
    /**
     * Handle folder renames, dispatching to our rename helper (which also
     *  takes care of any nested folder issues.)
     */
    folderRenamed: function gloda_indexer_folderRenamed(aOrigFolder,
                                                        aNewFolder) {
      this._folderRenameHelper(aOrigFolder, aNewFolder.URI);
    },
    
    itemEvent: function gloda_indexer_itemEvent(aItem, aEvent, aData) {
      // nop.  this is an expansion method on the part of the interface and has
      //  no known events that we need to handle.
    },
  },
  
  /**
   * A nsIFolderListener (listening on nsIMsgMailSession so we get all of
   *  these events) PRIMARILY to get folder loaded notifications.  Because of
   *  deficiencies in the nsIMsgFolderListener's events at this time, we also
   *  get our folder-added and newsgroup notifications from here for now.  (This
   *  will be rectified.)  
   */
  _folderListener: {
    indexer: null,
    _kFolderLoadedAtom: null,
    _kKeywordsAtom: null,
    _kStatusAtom: null,
    _kFlaggedAtom: null,
    _kJunkStatusChangedAtom: null,
    
    _init: function gloda_indexer_fl_init(aIndexer) {
      this.indexer = aIndexer;
      let atomService = Cc["@mozilla.org/atom-service;1"].
                        getService(Ci.nsIAtomService);
      this._kFolderLoadedAtom = atomService.getAtom("FolderLoaded");
      // we explicitly know about these things rather than bothering with some
      //  form of registration scheme because these aren't going to change much.
      this._kKeywordsAtom = atomService.getAtom("Keywords");
      this._kStatusAtom = atomService.getAtom("Status");
      this._kFlaggedAtom = atomService.getAtom("Flagged");
      this._kJunkStatusChangedAtom = atomService.getAtom("JunkStatusChanged");
    },
    
    /**
     * Helper method to do the leg-work associated with flagging a message
     *  for re-indexing because of some change in meta-state that happened to
     *  it.  Job-wise, we treat this as a message addition; we are uniquely
     *  identifying the message by providing its folder ID and message key, and
     *  the indexer will cleanly map this to the existing gloda message.
     */
    _reindexChangedMessage: function gloda_indexer_reindexChangedMessage(
        aMsgHdr) {
      // make sure the message is eligible for indexing...
      let msgFolder = aMsgHdr.folder;
      if (!this.indexer.shouldIndexFolder(msgFolder))
        return;
      let isFolderLocal = msgFolder instanceof Ci.nsIMsgLocalMailFolder;
      if (!isFolderLocal && !(msgFolder.flags&Ci.nsMsgFolderFlags.Offline))
        return;
    
      // mark the message as dirty
      // (We could check for the presence of the gloda message id property
      //  first to know whether we technically need the dirty property.  I'm
      //  not sure whether it is worth the high-probability exception cost.) 
      aMsgHdr.setUint32Property(this.indexer.GLODA_DIRTY_PROPERTY, 1);
      // mark the folder dirty too, so we know to look inside
      let glodaFolder = GlodaDatastore._mapFolder(msgFolder);
      glodaFolder.dirtyStatus = true;
      
      if (this.indexer._pendingAddJob === null) {
        this.indexer._pendingAddJob = new IndexingJob("message", 1, null);
        this.indexer._indexQueue.push(this.indexer._pendingAddJob);
        this.indexer._indexingJobGoal++;
      }
      // only queue the message if we haven't overflowed our event-driven budget
      if (this.indexer._pendingAddJob.items.length <
          this.indexer._indexMaxEventQueueMessages)
        this.indexer._pendingAddJob.items.push(
          [GlodaDatastore._mapFolder(msgFolder).id,
           aMsgHdr.messageKey]);
      this.indexer.indexing = true;
    },
  
    OnItemAdded: function gloda_indexer_OnItemAdded(aParentItem, aItem) {
    },
    OnItemRemoved: function gloda_indexer_OnItemRemoved(aParentItem, aItem) {
    },
    OnItemPropertyChanged: function gloda_indexer_OnItemPropertyChanged(
                             aItem, aProperty, aOldValue, aNewValue) {
    },
    OnItemIntPropertyChanged: function gloda_indexer_OnItemIntPropertyChanged(
                                aItem, aProperty, aOldValue, aNewValue) {
    },
    OnItemBoolPropertyChanged: function gloda_indexer_OnItemBoolPropertyChanged(
                                aItem, aProperty, aOldValue, aNewValue) {
    },
    OnItemUnicharPropertyChanged:
        function gloda_indexer_OnItemUnicharPropertyChanged(
          aItem, aProperty, aOldValue, aNewValue) {
      
    },
    /**
     * Notice when user activity changes a message's status, or automated
     *  junk processing flags a message as junk.
     */
    OnItemPropertyFlagChanged: function gloda_indexer_OnItemPropertyFlagChanged(
                                aMsgHdr, aProperty, aOldValue, aNewValue) {
      if (aProperty == this._kKeywordsAtom ||
          aProperty == this._kStatusAtom ||
          aProperty == this._kFlaggedAtom ||
          aProperty == this._kJunkStatusChangedAtom) {
        if (this.indexer.enabled) {
          this.indexer._log.debug("ItemPropertyFlagChanged notification");
          this._reindexChangedMessage(aMsgHdr);
        }
      }
    },
    
    /**
     * Get folder loaded notifications for folders that had to do some
     *  (asynchronous) processing before they could be opened.
     */
    OnItemEvent: function gloda_indexer_OnItemEvent(aFolder, aEvent) {
      if (aEvent == this._kFolderLoadedAtom)
        this.indexer._onFolderLoaded(aFolder);
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
    
    onHdrFlagsChanged: function(aHdrChanged, aOldFlags, aNewFlags, aInstigator) {},
    onHdrDeleted: function(aHdrChanged, aParentKey, aFlags, aInstigator) {},
    onHdrAdded: function(aHdrChanged, aParentKey, aFlags, aInstigator) {},
    onParentChanged: function(aKeyChanged, aOldParent, aNewParent, 
                              aInstigator) {},
    onReadChanged: function(aInstigator) {},
    onJunkScoreChanged: function(aInstigator) {},
    onHdrPropertyChanged: function (aHdrToChange, aPreChange, aStatus,
                                    aInstigator) {},
  },
  
  _indexMessage: function gloda_indexMessage(aMsgHdr, aCallbackHandle) {
    this._log.debug("*** Indexing message: " + aMsgHdr.messageKey + " : " +
                    aMsgHdr.subject);
    MsgHdrToMimeMessage(aMsgHdr, aCallbackHandle.callbackThis,
        aCallbackHandle.callback);
    let [,aMimeMsg] = yield this.kWorkAsync;

    if (aMimeMsg)
      this._log.debug("  * Got Mime Message!");
    else
      this._log.debug("  * Did not get body!");

    // -- Find/create the conversation the message belongs to.
    // Our invariant is that all messages that exist in the database belong to
    //  a conversation.
    
    // - See if any of the ancestors exist and have a conversationID...
    // (references are ordered from old [0] to new [n-1])
    let references = [aMsgHdr.getStringReference(i) for each
                      (i in range(0, aMsgHdr.numReferences))];
    // also see if we already know about the message...
    references.push(aMsgHdr.messageId);
    
    this._datastore.getMessagesByMessageID(references, aCallbackHandle.callback,
      aCallbackHandle.callbackThis);
    // (ancestorLists has a direct correspondence to the message ids)
    let ancestorLists = yield this.kWorkAsync; 
    
    this._log.debug("ancestors raw: " + ancestorLists);
    this._log.debug("ref len: " + references.length + " anc len: " + ancestorLists.length);
    this._log.debug("references: " + Log4Moz.enumerateProperties(references).join(","));
    this._log.debug("ancestors: " + Log4Moz.enumerateProperties(ancestorLists).join(","));
    
    // pull our current message lookup results off
    references.pop();
    let candidateCurMsgs = ancestorLists.pop();
    
    let conversationID = null;
    let conversation = null;
    // -- figure out the conversation ID
    // if we have a clone/already exist, just use his conversation ID
    if (candidateCurMsgs.length > 0) {
      conversationID = candidateCurMsgs[0].conversationID;
      conversation = candidateCurMsgs[0].conversation;
    }
    // otherwise check out our ancestors
    else {
      // (walk from closest to furthest ancestor)
      for (let iAncestor = ancestorLists.length-1; iAncestor >= 0;
          --iAncestor) {
        let ancestorList = ancestorLists[iAncestor];
        
        if (ancestorList.length > 0) {
          // we only care about the first instance of the message because we are
          //  able to guarantee the invariant that all messages with the same
          //  message id belong to the same conversation. 
          let ancestor = ancestorList[0];
          if (conversationID === null) {
            conversationID = ancestor.conversationID;
            conversation = ancestor.conversation;
          }
          else if (conversationID != ancestor.conversationID)
            this._log.error("Inconsistency in conversations invariant on " +
                            ancestor.headerMessageID + ".  It has conv id " +
                            ancestor.conversationID + " but expected " + 
                            conversationID + ". ID: " + ancestor.id);
        }
      }
    }
    
    // nobody had one?  create a new conversation
    if (conversationID === null) {
      // (the create method could issue the id, making the call return
      //  without waiting for the database...)
      conversation = this._datastore.createConversation(
          aMsgHdr.mime2DecodedSubject, null, null);
      conversationID = conversation.id;
    }
    
    // Walk from furthest to closest ancestor, creating the ancestors that don't
    //  exist. (This is possible if previous messages that were consumed in this
    //  thread only had an in-reply-to or for some reason did not otherwise
    //  provide the full references chain.)
    for (let iAncestor = 0; iAncestor < ancestorLists.length; ++iAncestor) {
      let ancestorList = ancestorLists[iAncestor];
      
      if (ancestorList.length == 0) {
        this._log.debug("creating message with: null, " + conversationID +
                        ", " + references[iAncestor] +
                        ", null.");
        let ancestor = this._datastore.createMessage(null, null, // ghost
                                                     conversationID, null,
                                                     references[iAncestor],
                                                     null, // no subject
                                                     null, // no body
                                                     null); // no attachments
        this._datastore.insertMessage(ancestor);
        ancestorLists[iAncestor].push(ancestor);
      }
    }
    // now all our ancestors exist, though they may be ghost-like...
    
    // find if there's a ghost version of our message or we already have indexed
    //  this message.
    let curMsg = null;
    this._log.debug(candidateCurMsgs.length + " candidate messages");
    for (let iCurCand = 0; iCurCand < candidateCurMsgs.length; iCurCand++) {
      let candMsg = candidateCurMsgs[iCurCand];

      this._log.debug("candidate folderID: " + candMsg.folderID +
                      " messageKey: " + candMsg.messageKey);
      
      if (candMsg.folderURI == aMsgHdr.folder.URI) {
        // if we are in the same folder and we have the same message key, we
        //  are definitely the same, stop looking.
        if (candMsg.messageKey == aMsgHdr.messageKey) {
          curMsg = candMsg;
          break;
        }
        // if (we are in the same folder and) the candidate message has a null
        //  message key, we treat it as our best option unless we find an exact
        //  key match. (this would happen because the 'move' notification case
        //  has to deal with not knowing the target message key.  this case
        //  will hopefully be somewhat improved in the future to not go through
        //  this path which mandates re-indexing of the message in its entirety)
        if (candMsg.messageKey === null)
          curMsg = candMsg;
        // if (we are in the same folder and) the candidate message's underlying
        //  message no longer exists/matches, we'll assume we are the same but
        //  were betrayed by a re-indexing or something, but we have to make
        //  sure a perfect match doesn't turn up.
        else if ((curMsg === null) &&
                 (aMsgHdr.folder.GetMessageHeader(candMsg.messageKey) === null))
          curMsg = candMsg;
      }
      // our choice of last resort, but still okay, is a ghost message
      else if ((curMsg === null) && (candMsg.folderID === null)) {
        curMsg = candMsg;
      }
    }
    
    let attachmentNames = null;
    if (aMimeMsg) {
      let allAttachmentNames = [att.name for each
                                ([i, att] in Iterator(aMimeMsg.allAttachments))
                                if (att.isRealAttachment)];
      // we need some kind of delimeter for the names.  we use a newline.
      if (allAttachmentNames)
        attachmentNames = allAttachmentNames.join("\n");
    } 
    
    let isNew;
    if (curMsg === null) {
      curMsg = this._datastore.createMessage(aMsgHdr.folder,
                                             aMsgHdr.messageKey,                
                                             conversationID,
                                             aMsgHdr.date,
                                             aMsgHdr.messageId);
      curMsg._conversation = conversation;
      isNew = true;
    }
    else {
      isNew = (curMsg._folderID === null); // aka was-a-ghost
      // (messageKey can be null if it's not new in the move-case)
      curMsg._folderID = this._datastore._mapFolder(aMsgHdr.folder).id;
      curMsg._messageKey = aMsgHdr.messageKey;
      curMsg.date = new Date(aMsgHdr.date / 1000); 
      // note: we are assuming that our matching logic is flawless in that
      //  if this message was not a ghost, we are assuming the 'body'
      //  associated with the id is still exactly the same.  It is conceivable
      //  that there are cases where this is not true.
    }

    if (aMimeMsg) {
      let bodyPlain = aMimeMsg.bodyPlain;
      if (bodyPlain) {
        curMsg._bodyLines = bodyPlain.split(/\r?\n/);
        curMsg._content = new GlodaContent();
      }
      else {
        this._log.warn("Have aMimeMsg but not bodyPlain?");
      }
    }
    else {
      this._log.warn("aMimeMsg went away?");
    }
    
    if (isNew) {
      curMsg._isNew = true;
      curMsg._subject = aMsgHdr.mime2DecodedSubject;
      curMsg._attachmentNames = attachmentNames;
    }
    
    yield aCallbackHandle.pushAndGo(
        Gloda.grokNounItem(curMsg,
            {header: aMsgHdr, mime: aMimeMsg,
             bodyLines: curMsg._bodyLines, content: curMsg._content},
            isNew,
            aCallbackHandle));
    
    delete curMsg._bodyLines;
    delete curMsg._content;
    delete curMsg._isNew;
    delete curMsg._subject;
    delete curMsg._attachmentNames;
    
    // we want to update the header for messages only after the transaction
    //  irrevocably hits the disk.  otherwise we could get confused if the
    //  transaction rolls back or what not.
    GlodaDatastore.runPostCommit(MakeCleanMsgHdrCallback(aMsgHdr, curMsg.id));
    
    yield this.kWorkDone;
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
    let conversationCollection = aMessage.conversation.getMessagesCollection(
        aCallbackHandle);
    yield this.kWorkAsync;
    let conversationMsgs = conversationCollection.items;
    
    let ghosts = [];
    let twinMessage = null;
    for (let iMsg = 0; iMsg < conversationMsgs.length; iMsg++) {
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
    if ((conversationMsgs.length - 1) == ghosts.length) {
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
        aMessage._nuke();
      }
      else { // ghost us
        aMessage._ghost();
        aMessage._datastore.updateMessage(aMessage);
      }
    }
    
    yield this.kWorkDone;
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
GlodaIndexer._init();
