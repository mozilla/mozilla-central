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
 *   Kent James <kent@caspia.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

const EXPORTED_SYMBOLS = ['GlodaIndexer', 'IndexingJob'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://app/modules/iteratorUtils.jsm");

Cu.import("resource://app/modules/gloda/log4moz.js");

Cu.import("resource://app/modules/gloda/utils.js");
Cu.import("resource://app/modules/gloda/datastore.js");
Cu.import("resource://app/modules/gloda/gloda.js");
Cu.import("resource://app/modules/gloda/collection.js");
Cu.import("resource://app/modules/gloda/connotent.js");

/**
 * @class Capture the indexing batch concept explicitly.
 *
 * @param aJobType The type of thing we are indexing.  Current choices are:
 *   "folder" and "message".  Previous choices included "account".  The indexer
 *   currently knows too much about these; they should be de-coupled.
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
 */
function IndexingJob(aJobType, aID, aItems) {
  this.jobType = aJobType;
  this.id = aID;
  this.items = (aItems != null) ? aItems : [];
  this.offset = 0;
  this.goal = null;
}
IndexingJob.prototype = {
  toString: function IndexingJob_toString() {
    return "[job:" + this.jobType +
      " id:" + this.id + " items:" + (this.items ? this.items.length : "no") +
      " offset:" + this.offset + " goal:" + this.goal + "]";
  }
};

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
 * ===  Indexing Throttling
 *
 * Adaptive Indexing
 * - The indexer tries to stay out of the way of other running code in
 *   Thunderbird (autosync) and other code on the system.  We try and target
 *   some number of milliseconds of activity between intentional inactive
 *   periods.  The number of milliseconds of activity varies based on whether we
 *   believe the user to be actively using the computer or idle.  We use our
 *   inactive periods as a way to measure system load; if we receive our
 *   notification promptly at the end of our inactive period, we believe the
 *   system is not heavily loaded.  If we do not get notified promptly, we
 *   assume there is other stuff going on and back off.
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

  /**
   * Periodic performance adjustment parameters:  The overall goal is to adjust
   *  our rate of work so that we don't interfere with the user's activities
   *  when they are around (non-idle), and the system in general (when idle).
   *  Being nice when idle isn't quite as important, but is a good idea so that
   *  when the user un-idles we are able to back off nicely.  Also, we give
   *  other processes on the system a chance to do something.
   *
   * We do this by organizing our work into discrete "tokens" of activity,
   *  then processing the number of tokens that we have determined will
   *  not impact the UI. Then we pause to give other activities a chance to get
   *  some work done, and we measure whether anything happened during our pause.
   *  If something else is going on in our application during that pause, we
   *  give it priority (up to a point) by delaying further indexing.
   *
   * Keep in mind that many of our operations are actually asynchronous, so we
   *  aren't entirely starving the event queue.  However, a lot of the async
   *  stuff can end up not having any actual delay between events. For
   *  example, we only index offline message bodies, so there's no network
   *  latency involved, just disk IO; the only meaningful latency will be the
   *  initial disk seek (if there is one... pre-fetching may seriously be our
   *  friend).
   *
   * In order to maintain responsiveness, I assert that we want to minimize the
   *  length of the time we are dominating the event queue.  This suggests
   *  that we want break up our blocks of work frequently.  But not so
   *  frequently that there is a lot of waste.  Accordingly our algorithm is
   *  basically:
   *
   * - Estimate the time that it takes to process a token, and schedule the
   *   number of tokens that should fit into that time.
   * - Detect user activity, and back off immediately if found.
   * - Try to delay commits and garbage collection until the user is inactive,
   *   as these tend to cause a brief pause in the UI.
   */

  /**
   * The number of milliseconds before we declare the user idle and step up our
   *  indexing.
   */
  _INDEX_IDLE_ADJUSTMENT_TIME: 5000,

  /**
   * The time delay in milliseconds before we should schedule our initial sweep.
   */
  _INITIAL_SWEEP_DELAY: 10000,

  /**
   * How many milliseconds in the future should we schedule indexing to start
   *  when turning on indexing (and it was not previously active).
   */
  _INDEX_KICKOFF_DELAY: 200,

  /**
   * The time interval, in milliseconds, of pause between indexing batches.  The
   *  maximum processor consumption is determined by this constant and the
   *  active |_cpuTargetIndexTime|.
   *
   * For current constants, that puts us at 50% while the user is active and 83%
   *  when idle.
   */
  _INDEX_INTERVAL: 32,

  /**
   * Number of indexing 'tokens' we are allowed to consume before yielding for
   *  each incremental pass.  Consider a single token equal to indexing a single
   *  medium-sized message.  This may be altered by user session (in)activity.
   * Because we fetch message bodies, which is potentially asynchronous, this
   *  is not a precise knob to twiddle.
   */
  _indexTokens: 2,

  /**
   * Stopwatches used to measure performance during indexing, and during
   * pauses between indexing. These help us adapt our indexing constants so
   *  as to not explode your computer.  Kind of us, no?
   */
  _perfIndexStopwatch: null,
  _perfPauseStopwatch: null,
  /**
   * Do we have an uncommitted indexer transaction that idle callback should commit?
   */
  _idleToCommit: false,
  /**
   * Target CPU time per batch of tokens, current value (milliseconds).
   */
  _cpuTargetIndexTime: 32,
  /**
   * Target CPU time per batch of tokens, during non-idle (milliseconds).
   */
  _CPU_TARGET_INDEX_TIME_ACTIVE: 32,
  /**
   * Target CPU time per batch of tokens, during idle (milliseconds).
   */
  _CPU_TARGET_INDEX_TIME_IDLE: 160,
  /**
   * Average CPU time per processed token (milliseconds).
   */
  _cpuAverageTimePerToken: 16,
  /**
   * Damping factor for _cpuAverageTimePerToken, as an approximate
   * number of tokens to include in the average time.
   */
  _CPU_AVERAGE_TIME_DAMPING: 200,
  /**
   * Maximum tokens per batch. This is normally just a sanity check.
   */
  _CPU_MAX_TOKENS_PER_BATCH: 100,
  /**
   * CPU usage during a pause to declare that system was busy (milliseconds).
   * This is typically set as 1.5 times the minimum resolution of the cpu
   * usage clock, which is 16 milliseconds on Windows systems, and (I think)
   * smaller on other systems, so we take the worst case.
   */
  _CPU_IS_BUSY_TIME: 24,
  /**
   * Time that return from pause may be late before the system is declared
   * busy, in milliseconds. (Same issues as _CPU_IS_BUSY_TIME).
   */
  _PAUSE_LATE_IS_BUSY_TIME: 24,
  /**
   * Number of times that we will repeat a pause while waiting for a
   * free CPU.
   */
  _PAUSE_REPEAT_LIMIT: 10,
  /**
   * Minimum time delay between commits, in milliseconds.
   */
  _MINIMUM_COMMIT_TIME: 5000,
  /**
   * Maximum time delay between commits, in milliseconds.
   */
  _MAXIMUM_COMMIT_TIME: 20000,

  /**
   * Unit testing hook to get us to emit additional logging that verges on
   *  inane for general usage but is helpful in unit test output to get a lay
   *  of the land and for paranoia reasons.
   */
  _unitTestSuperVerbose: false,
  /**
   * Unit test vector to get notified when a worker has a problem and it has
   *  a recover helper associated.  This gets called with an argument
   *  indicating whether the recovery helper indicates recovery was possible.
   */
  _unitTestHookRecover: null,
  /**
   * Unit test vector to get notified when a worker runs into an exceptional
   *  situation (an exception propagates or gets explicitly killed) and needs
   *  to be cleaned up.  This gets called with an argument indicating if there
   *  was a helper that was used or if we just did the default cleanup thing.
   */
  _unitTestHookCleanup: null,

  /**
   * Last commit time.  Tracked to try and only commit at reasonable intervals.
   */
  _lastCommitTime: Date.now(),

  _inited: false,
  /**
   * Initialize the indexer.
   */
  _init: function gloda_index_init() {
    if (this._inited)
      return;

    this._inited = true;

    this._callbackHandle.init();

    // create the timer that drives our intermittent indexing
    this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    // create the timer for larger offsets independent of indexing
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

    this._idleService = Cc["@mozilla.org/widget/idleservice;1"]
                          .getService(Ci.nsIIdleService);

    // create our performance stopwatches
    try {
      this._perfIndexStopwatch = Cc["@mozilla.org/stopwatch;1"]
                                   .createInstance(Ci.nsIStopwatch);
      this._perfPauseStopwatch = Cc["@mozilla.org/stopwatch;1"]
                                   .createInstance(Ci.nsIStopwatch);

    } catch (ex) {
      this._log.error("problem creating stopwatch!: " + ex);
    }
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

    this._perfIndexStopwatch = null;
    this._perfPauseStopwatch = null;

    // Remove listeners to avoid reference cycles on the off chance one of them
    // holds a reference to the indexer object.
    this._indexListeners = [];

    this._indexerIsShutdown = true;

    if (!this.enabled)
      return;

    this._log.info("Shutting Down");

    // don't let anything try and convince us to start indexing again
    this.suppressIndexing = true;

    // If there is an active job and it has a cleanup handler, run it.
    if (this._curIndexingJob) {
      let workerDef = this._curIndexingJob._workerDef;
      if (workerDef.cleanup)
        workerDef.cleanup.call(workerDef.indexer, this._curIndexingJob);
    }
    // Definitely clean out the async call stack and any associated data
    this._callbackHandle.cleanup();
    this._workBatchData = undefined;

    // disable ourselves and all of the specific indexers
    this.enabled = false;

    GlodaDatastore.shutdown();
  },

  /**
   * The list of indexers registered with us.  If you are a core gloda indexer
   *  (you ship with gloda), then you can import this file directly and should
   *  make sure your indexer is imported in 'everybody.js' in the right order.
   *  If you are not core gloda, then you should import 'public.js' and only
   *  then should you import 'indexer.js' to get at GlodaIndexer.
   */
  _indexers: [],
  /**
   * Register an indexer with the Gloda indexing mechanism.
   *
   * @param aIndexer.name The name of your indexer.
   * @param aIndexer.enable Your enable function.  This will be called during
   *     the call to registerIndexer if Gloda indexing is already enabled.  If
   *     indexing is not yet enabled, you will be called
   * @param aIndexer.disable Your disable function.  This will be called when
   *     indexing is disabled or we are shutting down.  This will only be called
   *     if enable has already been called.
   * @param aIndexer.workers A list of tuples of the form [worker type code,
   *     worker generator function, optional scheduling trigger function].  The
   *     type code is the string used to uniquely identify the job type.  If you
   *     are not core gloda, your job type must start with your extension's name
   *     and a colon; you can collow that with anything you want.  The worker
   *     generator is not easily explained in here.  The trigger function is
   *     invoked immediately prior to calling the generator to create it.  The
   *     trigger function takes the job as an argument and should perform any
   *     finalization required on the job.  Most workers should not need to use
   *     the trigger function.
   * @param aIndexer.initialSweep We call this to tell each indexer when it is
   *     its turn to run its indexing sweep.  The idea of the indexing sweep is
   *     that this is when you traverse things eligible for indexing to make
   *     sure they are indexed.  Right now we just call everyone at the same
   *     time and hope that their jobs don't fight too much.
   */
  registerIndexer: function gloda_index_registerIndexer(aIndexer) {
    this._log.info("Registering indexer: " + aIndexer.name);
    this._indexers.push(aIndexer);

    try {
      for each (let [iWorker, workerInfo] in Iterator(aIndexer.workers)) {
        let workerCode = workerInfo[0];
        let workerDef = workerInfo[1];
        workerDef.indexer = aIndexer;
        this._indexerWorkerDefs[workerCode] = workerDef;
        if (!("recover" in workerDef))
          workerDef.recover = null;
        if (!("cleanup" in workerDef))
          workerDef.cleanup = null;
        if (!("onSchedule" in workerDef))
          workerDef.onSchedule = null;
        if (!("jobCanceled" in workerDef))
          workerDef.jobCanceled = null;
      }
    }
    catch (ex) {
      this._log.warn("Helper indexer threw exception on worker enum.");
    }

    if (this._enabled) {
      try {
        aIndexer.enable();
      } catch (ex) {
        this._log.warn("Helper indexer threw exception on enable: " + ex);
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
      // register for shutdown, offline notifications
      let observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
      observerService.addObserver(this, "network:offline-status-changed", false);
      observerService.addObserver(this, "quit-application", false);

      // register for idle notification
      this._idleService.addIdleObserver(this, this._indexIdleThresholdSecs);

      this._enabled = true;

      for each (let [iIndexer, indexer] in Iterator(this._indexers)) {
        try {
          indexer.enable();
        } catch (ex) {
          this._log.warn("Helper indexer threw exception on enable: " + ex);
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
          this._INITIAL_SWEEP_DELAY, Ci.nsITimer.TYPE_ONE_SHOT);
    }
    else if (this._enabled && !aEnable) {
      for each (let [iIndexer, indexer] in Iterator(this._indexers)) {
        try {
          indexer.disable();
        } catch (ex) {
          this._log.warn("Helper indexer threw exception on disable: " + ex);
        }
      }

      // remove observer; no more events to observe!
      let observerService = Cc["@mozilla.org/observer-service;1"].
                              getService(Ci.nsIObserverService);
      observerService.removeObserver(this, "network:offline-status-changed");
      observerService.removeObserver(this, "quit-application");

      // remove idle
      this._idleService.removeIdleObserver(this, this._indexIdleThresholdSecs);

      this._enabled = false;
    }

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
        this._timer.initWithCallback(this._timerCallbackDriver,
                                     this._INDEX_KICKOFF_DELAY,
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
        this._timer.initWithCallback(this._timerCallbackDriver,
                                     this._INDEX_KICKOFF_DELAY,
                                     Ci.nsITimer.TYPE_ONE_SHOT);
    }
  },

  /**
   * Track whether an initial sweep has been performed.  This mainly exists so
   *  that unit testing can stop us from performing an initial sweep.
   */
  _initialSweepPerformed: false,
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
    if (GlodaIndexer._initialSweepPerformed)
      return;
    GlodaIndexer._initialSweepPerformed = true;
    for each (let [, indexer] in Iterator(GlodaIndexer._indexers)) {
      indexer.initialSweep();
    }
  },

  kWorkSync: Gloda.kWorkSync,
  kWorkAsync: Gloda.kWorkAsync,
  kWorkDone: Gloda.kWorkDone,
  kWorkPause: Gloda.kWorkPause,
  kWorkDoneWithResult: Gloda.kWorkDoneWithResult,

  /**
   * Our current job number.  Meaningless value that increments with every job
   *  we process that resets to 0 when we run out of jobs.  Currently used by
   *  the activity manager's gloda listener to tell when we have changed jobs.
   * We really need a better listener mechanism.
   */
  _indexingJobCount: 0,

  /**
   * A list of IndexingJob instances to process.
   */
  _indexQueue: [],

  /**
   * The current indexing job.
   */
  _curIndexingJob: null,

  /**
   * The number of seconds before we declare the user idle and commit if
   *  needed.
   */
  _indexIdleThresholdSecs: 3,

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
   *     current zero-based job number (int),
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
      aListener(Gloda.kIndexerIdle, null, 0, 0, 1);
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
   *
   * This was not pretty but got ugly once we moved the message indexing out
   *  to its own indexer.  Some generalization is required but will likely
   *  require string hooks.
   */
  _notifyListeners: function gloda_index_notifyListeners() {
    let status, prettyName, jobIndex, jobItemIndex, jobItemGoal;

    if (this.indexing && this._curIndexingJob) {
      let job = this._curIndexingJob;
      status = Gloda.kIndexerIndexing;

      let indexer = this._indexerWorkerDefs[job.jobType].indexer;
      if ("_indexingFolder" in indexer)
        prettyName = (indexer._indexingFolder != null) ?
                     indexer._indexingFolder.prettiestName : null;
      else
        prettyName = null;

      jobIndex = this._indexingJobCount-1;
      jobItemIndex = job.offset;
      jobItemGoal  = job.goal;
    }
    else {
      status = Gloda.kIndexerIdle;
      prettyName = null;
      jobIndex = 0;
      jobItemIndex = 0;
      jobItemGoal = 1;
    }

    // Some people ascribe to the belief that the most you can give is 100%.
    // We know better, but let's humor them.
    if (jobItemIndex > jobItemGoal)
      jobItemGoal = jobItemIndex;

    for (let iListener = this._indexListeners.length-1; iListener >= 0;
         iListener--) {
      let listener = this._indexListeners[iListener];
      try {
        listener(status, prettyName, jobIndex, jobItemIndex, jobItemGoal);
      }
      catch(ex) {
        this._log.error(ex);
      }
    }
  },

  /**
   * A wrapped callback driver intended to be used by timers that provide
   *  arguments we really do not care about.
   */
  _timerCallbackDriver: function gloda_index_timerCallbackDriver() {
    GlodaIndexer.callbackDriver();
  },

  /**
   * A simple callback driver wrapper to provide 'this'.
   */
  _wrapCallbackDriver: function gloda_index_wrapCallbackDriver() {
    GlodaIndexer.callbackDriver.apply(GlodaIndexer, arguments);
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
   *  we re-schedule ourselves after a time delay (controlled by _INDEX_INTERVAL)
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
      this._timer.initWithCallback(this._timerCallbackDriver,
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
            this._timer.initWithCallback(this._timerCallbackDriver,
                                         this._INDEX_INTERVAL,
                                         Ci.nsITimer.TYPE_ONE_SHOT);
          else { // it's important to indicate no more callbacks are in flight
            this._indexingActive = false;
          }
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
    /**
     * The stack of generators we are processing.  The (numerically) last one is
     *  also the |activeIterator|.
     */
    activeStack: [],
    /**
     * The generator at the top of the |activeStack| and that we will call next
     *  or send on next if nothing changes.
     */
    activeIterator: null,
    /**
     * Meta-information about the generators at each level of the stack.
     */
    contextStack: [],
    /**
     * Push a new generator onto the stack.  It becomes the active generator.
     */
    push: function gloda_index_callbackhandle_push(aIterator, aContext) {
      this.activeStack.push(aIterator);
      this.contextStack.push(aContext);
      this.activeIterator = aIterator;
    },
    /**
     * For use by generators that want to call another asynchronous process
     *  implemented as a generator.  They should do
     *  "yield aCallbackHandle.pushAndGo(someGenerator(arg1, arg2));".
     *
     * @public
     */
    pushAndGo: function gloda_index_callbackhandle_pushAndGo(aIterator,
                                                             aContext) {
      this.push(aIterator, aContext);
      return GlodaIndexer.kWorkSync;
    },
    /**
     * Pop the active generator off the stack and close it.
     */
    pop: function gloda_index_callbackhandle_pop() {
      this.activeIterator.close();
      this.activeStack.pop();
      this.contextStack.pop();
      if (this.activeStack.length)
        this.activeIterator = this.activeStack[this.activeStack.length - 1];
      else
        this.activeIterator = null;
    },
    /**
     * Someone propagated an exception and we need to clean-up all the active
     *  logic as best we can.  Which is not really all that well.
     *
     * @param [aOptionalStopAtDepth=0] The length the stack should be when this
     *     method completes.  Pass 0 or omit for us to clear everything out.
     *     Pass 1 to leave just the top-level generator intact.
     */
    cleanup: function gloda_index_callbackhandle_cleanup(aOptionalStopAtDepth) {
      if (aOptionalStopAtDepth === undefined)
        aOptionalStopAtDepth = 0;
      while (this.activeStack.length > aOptionalStopAtDepth) {
        this.pop();
      }
    },
    /**
     * For use when a generator finishes up by calling |doneWithResult| on us;
     *  the async driver calls this to pop that generator off the stack
     *  and get the result it passed in to its call to |doneWithResult|.
     *
     * @protected
     */
    popWithResult: function gloda_index_callbackhandle_popWithResult() {
      this.pop();
      let result = this._result;
      this._result = null;
      return result;
    },
    _result: null,
    /**
     * For use by generators that want to return a result to the calling
     *  asynchronous generator.  Specifically, they should do
     *  "yield aCallbackHandle.doneWithResult(RESULT);".
     *
     * @public
     */
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
  _workBatchData: undefined,
  /**
   * The workBatch generator handles a single 'batch' of processing, managing
   *  the database transaction and keeping track of "tokens".  It drives the
   *  _actualWorker generator which is doing the work.
   * workBatch will only produce kWorkAsync, kWorkPause, and kWorkDone
   *  notifications.  If _actualWorker returns kWorkSync and there are still
   *  tokens available, workBatch will keep driving _actualWorker until it
   *  encounters a kWorkAsync (which workBatch will yield to callbackDriver), or
   *  it runs out of tokens and yields a kWorkPause or kWorkDone.
   */
  workBatch: function gloda_index_workBatch() {

    // Do we still have an open transaction? If not, start a new one.
    if (!this._idleToCommit)
      GlodaDatastore._beginTransaction();
    else
      // We'll manage commit ourself while this routine is active.
      this._idleToCommit = false;

    this._perfIndexStopwatch.start();
    let batchCount;
    let haveMoreWork = true;
    let transactionToCommit = true;
    let inIdle;

    let notifyDecimator = 0;

    while (haveMoreWork) {
      // Both explicit work activity points (sync + async) and transfer of
      //  control return (via kWorkDone*) results in a token being eaten.  The
      //  idea now is to make tokens less precious so that the adaptive logic
      //  can adjust them with less impact.  (Before this change, doing 1
      //  token's work per cycle ended up being an entire non-idle time-slice's
      //  work.)
      // During this loop we track the clock real-time used even though we
      //  frequently yield to asynchronous operations.  These asynchronous
      //  operations are either database queries or message streaming requests.
      //  Both may involve disk I/O but no network I/O (since we only stream
      //  messages that are already available offline), but in an ideal
      //  situation will come from cache and so the work this function kicks off
      //  will dominate.
      // We do not use the CPU time to this end because...
      //  1) Our timer granularity on linux is worse for CPU than for wall time.
      //  2) That can fail to account for our I/O cost.
      //  3) If something with a high priority / low latency need (like playing
      //     a video) is fighting us, although using CPU time will accurately
      //     express how much time we are actually spending to index, our goal
      //     is to control the duration of our time slices, not be "right" about
      //     the actual CPU cost.  In that case, if we attempted to take on more
      //     work, we would likely interfere with the higher priority process or
      //     make ourselves less responsive by drawing out the period of time we
      //     are dominating the main thread.
      this._perfIndexStopwatch.start();
      batchCount = 0;
      while (batchCount < this._indexTokens) {

        if ((this._callbackHandle.activeIterator === null) &&
            !this._hireJobWorker()) {
          haveMoreWork = false;
          break;
        }
        batchCount++;

        // XXX for performance, we may want to move the try outside the for loop
        //  with a quasi-redundant outer loop that shunts control back inside
        //  if we left the loop due to an exception (without consuming all the
        //  tokens.)
        try {
          switch (this._callbackHandle.activeIterator.send(
                    this._workBatchData)) {
            case this.kWorkSync:
              this._workBatchData = undefined;
              break;
            case this.kWorkAsync:
              this._workBatchData = yield this.kWorkAsync;
              break;
            case this.kWorkDone:
              this._callbackHandle.pop();
              this._workBatchData = undefined;
              break;
            case this.kWorkDoneWithResult:
              this._workBatchData = this._callbackHandle.popWithResult();
              break;
            default:
              break;
          }
        }
        catch (ex) {
          let workerDef = this._curIndexingJob._workerDef;
          if (workerDef.recover) {
            let recoverToDepth =
              workerDef.recover.call(workerDef.indexer,
                                     this._curIndexingJob,
                                     this._callbackHandle.contextStack);
            if (this._unitTestHookRecover)
              this._unitTestHookRecover(recoverToDepth, ex,
                                        this._curIndexingJob,
                                        this._callbackHandle);

            if (recoverToDepth) {
              this._callbackHandle.cleanup(recoverToDepth);
              continue;
            }
          }
          // (we either did not have a recover handler or it couldn't recover)
          // call the cleanup helper if there is one
          if (workerDef.cleanup) {
            workerDef.cleanup.call(workerDef.indexer, this._curIndexingJob);
            if (this._unitTestHookCleanup)
              this._unitTestHookCleanup(true, ex, this._curIndexingJob,
                                        this._callbackHandle);
          }
          else {
            if (this._unitTestHookCleanup)
              this._unitTestHookCleanup(false, ex, this._curIndexingJob,
                                        this._callbackHandle);
          }

          // Clean out everything on the async stack, warn about the job, kill.
          // We do not log this warning lightly; it will break unit tests and
          //  be visible to users.  Anything expected should likely have a
          //  recovery function or the cleanup logic should be extended to
          //  indicate that the failure is acceptable.
          this._callbackHandle.cleanup();
          this._log.warn("Problem during " + this._curIndexingJob +
            ", bailing.  Problem was at " + ex.fileName + ":" +
            ex.lineNumber + ": " + ex +
            (ex.stack ? (". Stack:\n  " + ex.stack.replace("\n", "\n  ", "g"))
                      : ""));
          this._curIndexingJob = null;
          // the data must now be invalid
          this._workBatchData = undefined;
        }
      }
      this._perfIndexStopwatch.stop();

      // We want to stop ASAP when leaving idle, so we can't rely on the
      // standard polled callback. We do the polling ourselves.
      if (this._idleService.idleTime < this._INDEX_IDLE_ADJUSTMENT_TIME) {
        inIdle = false;
        this._cpuTargetIndexTime = this._CPU_TARGET_INDEX_TIME_ACTIVE;
      }
      else {
        inIdle = true;
        this._cpuTargetIndexTime = this._CPU_TARGET_INDEX_TIME_IDLE;
      }

      // take a breather by having the caller re-schedule us sometime in the
      //  future, but only if we're going to perform another loop iteration.
      if (haveMoreWork) {
        notifyDecimator = (notifyDecimator + 1) % 32;
        if (!notifyDecimator)
          this._notifyListeners();

        for (let pauseCount = 0;
             pauseCount < this._PAUSE_REPEAT_LIMIT;
             pauseCount++) {
          this._perfPauseStopwatch.start();

          yield this.kWorkPause;

          this._perfPauseStopwatch.stop();
          // We repeat the pause if the pause was longer than
          //  we expected, or if it used a significant amount
          //  of cpu, either of which indicate significant other
          //  activity.
          if ((this._perfPauseStopwatch.cpuTimeSeconds * 1000 <
               this._CPU_IS_BUSY_TIME) &&
              (this._perfPauseStopwatch.realTimeSeconds * 1000 -
               this._INDEX_INTERVAL < this._PAUSE_LATE_IS_BUSY_TIME))
            break;
        }
      }
      if (batchCount > 0) {
        let totalTime = this._perfIndexStopwatch.realTimeSeconds * 1000;
        let timePerToken = totalTime / batchCount;
        // Damp the average time since it is a rough estimate only.
        this._cpuAverageTimePerToken =
          (totalTime +
           this._CPU_AVERAGE_TIME_DAMPING * this._cpuAverageTimePerToken) /
          (batchCount + this._CPU_AVERAGE_TIME_DAMPING);
        // We use the larger of the recent or the average time per token, so
        //  that we can respond quickly to slow down indexing if there
        //  is a sudden increase in time per token.
        let bestTimePerToken =
            Math.max(timePerToken, this._cpuAverageTimePerToken);
        // Always index at least one token!
        this._indexTokens =
            Math.max(1, this._cpuTargetIndexTime / bestTimePerToken);
        // But no more than the a maximum limit, just for sanity's sake.
        this._indexTokens = Math.min(this._CPU_MAX_TOKENS_PER_BATCH,
                                     this._indexTokens);
        this._indexTokens = Math.ceil(this._indexTokens);
      }

      // Should we try to commit now?
      let elapsed = Date.now() - this._lastCommitTime;
      // Commit tends to cause a brief UI pause, so we try to delay it (but not
      //  forever) if the user is active. If we're done and idling, we'll also
      //  commit, otherwise we'll let the idle callback do it.
      let doCommit = transactionToCommit &&
                      (elapsed > this._MAXIMUM_COMMIT_TIME) ||
                      (inIdle && (elapsed > this._MINIMUM_COMMIT_TIME ||
                                  !haveMoreWork));
      if (doCommit) {
        GlodaCollectionManager.cacheCommitDirty();
        // Set up an async notification to happen after the commit completes so
        //  that we can avoid the indexer doing something with the database that
        //  causes the main thread to block against the completion of the commit
        //  (which can be a while) on 1.9.1.
        GlodaDatastore.runPostCommit(this._callbackHandle.wrappedCallback);
        // kick off the commit
        GlodaDatastore._commitTransaction();
        yield this.kWorkAsync;
        // Let's do the GC after the commit completes just so we can avoid
        //  having any ugly interactions.
        GlodaUtils.forceGarbageCollection(false);
        this._lastCommitTime = Date.now();
        // Restart the transaction if we still have work.
        if (haveMoreWork)
          GlodaDatastore._beginTransaction();
        else
          transactionToCommit = false;
      }
    }

    // try and get a job if we don't have one for the sake of the notification
    if (this.indexing && (this._actualWorker === null))
      this._hireJobWorker();
    else
      this._notifyListeners();

    // If we still have a transaction to commit, tell idle to do the commit
    //  when it gets around to it.
    if (transactionToCommit)
      this._idleToCommit = true;

    yield this.kWorkDone;
  },

  /**
   * Maps indexing job type names to a worker definition.
   * The worker definition is an object with the following attributes where
   *  only worker is required:
   * - worker:
   * - onSchedule: A function to be invoked when the worker is scheduled.  The
   *    job is passed as an argument.
   * - recover:
   * - cleanup:
   */
  _indexerWorkerDefs: {},
  /**
   * Perform the initialization step and return a generator if there is any
   *  steady-state processing to be had.
   */
  _hireJobWorker: function gloda_index_hireJobWorker() {
    // In no circumstances should there be data bouncing around from previous
    //  calls if we are here.  |killActiveJob| depends on this.
    this._workBatchData = undefined;

    if (this._indexQueue.length == 0) {
      this._log.info("--- Done indexing, disabling timer renewal.");

      this._curIndexingJob = null;
      this._indexingDesired = false;
      this._indexingJobCount = 0;
      return false;
    }

    let job = this._curIndexingJob = this._indexQueue.shift();
    this._indexingJobCount++;

    let generator = null;

    if (job.jobType in this._indexerWorkerDefs) {
      let workerDef = this._indexerWorkerDefs[job.jobType];
      job._workerDef = workerDef;

      // Prior to creating the worker, call the scheduling trigger function
      //  if there is one.  This is so that jobs can be finalized.  The
      //  initial use case is event-driven message indexing that accumulates
      //  a list of messages to index but wants it locked down once we start
      //  processing the list.
      if (workerDef.onSchedule)
        workerDef.onSchedule.call(workerDef.indexer, job);

      generator = workerDef.worker.call(workerDef.indexer, job,
                                        this._callbackHandle);
    }
    else {
      // Nothing we can do about this.  Be loud about it and try to schedule
      //  something else.
      this._log.error("Unknown job type: " + job.jobType);
      return this._hireJobWorker();
    }

    if (this._unitTestSuperVerbose)
      this._log.debug("Hired job of type: " + job.jobType);

    this._notifyListeners();

    if (generator) {
      this._callbackHandle.push(generator);
      return true;
    }
    else
      return false;
  },

  /**
   * Schedule a job for indexing.
   */
  indexJob: function glodaIndexJob(aJob) {
    this._log.info("Queue-ing job for indexing: " + aJob.jobType);

    this._indexQueue.push(aJob);
    this.indexing = true;
  },

  /**
   * Kill the active job.  This means a few things:
   * - Kill all the generators in the callbackHandle stack.
   * - If we are currently waiting on an async return, we need to make sure it
   *    does not screw us up.
   * - Make sure the job's cleanup function gets called if appropriate.
   *
   * The async return case is actually not too troublesome.  Since there is an
   *  active indexing job and we are not (by fiat) in that call stack, we know
   *  that the callback driver is guaranteed to get triggered again somehow.
   *  The only issue is to make sure that _workBatchData does not end up with
   *  the data.  We compel |_hireJobWorker| to erase it to this end.
   *
   * @note You MUST NOT call this function from inside a job or an async funtion
   *    on the callbackHandle's stack of generators.  If you are in that
   *    situation, you should just throw an exception.  At the very least,
   *    use a timeout to trigger us.
   */
  killActiveJob: function() {
    // There is nothing to do if we have no job
    if (!this._curIndexingJob)
      return;

    // -- Blow away the stack with cleanup.
    let workerDef = this._curIndexingJob._workerDef;
    if (this._unitTestHookCleanup)
      this._unitTestHookCleanup(workerDef.cleanup ? true : false,
                                "no exception, this was killActiveJob",
                                this._curIndexingJob,
                                this._callbackHandle);
    this._callbackHandle.cleanup();
    if (workerDef.cleanup)
      workerDef.cleanup.call(workerDef.indexer, this._curIndexingJob);

    // Eliminate the job.
    this._curIndexingJob = null;
  },

  /**
   * Purge all jobs that the filter function returns true for.  This does not
   *  kill the active job, use |killActiveJob| to do that.
   *
   * Make sure to call this function before killActiveJob
   *
   * @param aFilterElimFunc A filter function that takes an |IndexingJob| and
   *     returns true if the job should be purged, false if it should not be.
   *     The filter sees the jobs in the order they are scheduled.
   */
  purgeJobsUsingFilter: function(aFilterElimFunc) {
    for (let iJob = 0; iJob < this._indexQueue.length; iJob++) {
      let job = this._indexQueue[iJob];

      // If the filter says to, splice the job out of existence (and make sure
      //  to fixup iJob to compensate.)
      if (aFilterElimFunc(job)) {
        this._indexQueue.splice(iJob--, 1);
        let workerDef = this._indexerWorkerDefs[job.jobType];
        if (workerDef.jobCanceled)
          workerDef.jobCanceled.call(workerDef.indexer, job);
      }
    }
  },

  /* *********** Event Processing *********** */
  observe: function gloda_indexer_observe(aSubject, aTopic, aData) {
    // idle
    if (aTopic == "idle") {
      // Do we need to commit an indexer transaction?
      if (this._idleToCommit) {
        this._idleToCommit = false;
        GlodaCollectionManager.cacheCommitDirty();
        GlodaDatastore._commitTransaction();
        this._lastCommitTime = Date.now();
        this._notifyListeners();
      }
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


};
GlodaIndexer._init();
