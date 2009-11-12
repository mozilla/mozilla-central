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
 * This file provides gloda testing infrastructure.
 *
 * A few words about how tests should expect to interact with indexing:
 *
 * By default, we enable only event-driven indexing with an infinite work queue
 *  length.  This means that all messages will be queued for indexing as they
 *  are added or modified.  You should yield to |wait_for_gloda_indexer| to wait
 *  until the indexer completes.  If you want to assert that certain messages
 *  will have been indexed during that pass, you can pass them as arguments to
 *  the function.
 * There is no need to tell us to expect the messages to be indexed prior to the
 *  waiting as long as nothing spins the event loop after you perform the action
 *  that triggers indexing.  None of our existing xpcshell tests do this, but it
 *  is part of the mozmill idiom for its waiting mechanism, so be sure to not
 *  perform a mozmill wait without first telling us to expect the messages.
 */

// Import the main scripts that mailnews tests need to set up and tear down
load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");
load("../../mailnews/resources/logHelper.js");
load("../../mailnews/resources/asyncTestUtils.js");

load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/messageModifier.js");
load("../../mailnews/resources/messageInjection.js");

load("resources/folderEventLogHelper.js");
// register this before gloda gets a chance to do anything so that
registerFolderEventLogHelper();


// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();
// Create a message scenario generator using that message generator
const scenarios = gMessageScenarioFactory = new MessageScenarioFactory(msgGen);

Components.utils.import("resource://app/modules/errUtils.js");

/**
 * Create a 'me' identity of "me@localhost" for the benefit of Gloda.  At the
 *  time of this writing, Gloda only initializes Gloda.myIdentities and
 *  Gloda.myContact at startup with no event-driven updates.  As such, this
 *  function needs to be called prior to gloda startup.
 */
function createMeIdentity() {
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let identity = acctMgr.createIdentity;
  identity.email = "me@localhost";
  identity.fullName = "Me";
}
// and run it now...
createMeIdentity();

// -- Set the gloda prefs
const gPrefs = Cc["@mozilla.org/preferences-service;1"]
                 .getService(Ci.nsIPrefBranch);
// yes to indexing
gPrefs.setBoolPref("mailnews.database.global.indexer.enabled", true);
// no to a sweep we don't control
gPrefs.setBoolPref("mailnews.database.global.indexer.perform_initial_sweep",
    false);
// yes to debug output
gPrefs.setBoolPref("mailnews.database.global.logging.dump", true);

// -- Import our modules
Components.utils.import("resource://app/modules/gloda/public.js");
Components.utils.import("resource://app/modules/gloda/indexer.js");
Components.utils.import("resource://app/modules/gloda/index_msg.js");
Components.utils.import("resource://app/modules/gloda/datastore.js");
Components.utils.import("resource://app/modules/gloda/collection.js");
Components.utils.import("resource://app/modules/gloda/datamodel.js");
Components.utils.import("resource://app/modules/gloda/noun_tag.js");
Components.utils.import("resource://app/modules/gloda/mimemsg.js");

// -- Add a logger listener that throws when we give it a warning/error.
Components.utils.import("resource://app/modules/gloda/log4moz.js");
let throwingAppender = new Log4Moz.ThrowingAppender(do_throw);
throwingAppender.level = Log4Moz.Level.Warn;
Log4Moz.repository.rootLogger.addAppender(throwingAppender);

var LOG = Log4Moz.repository.getLogger("gloda.test");

// index_msg does not export this, so we need to provide it.
const GLODA_BAD_MESSAGE_ID = 1;

// -- Add a hook that makes folders not filthy when we first see them.
register_message_injection_listener({
  /**
   * By default all folders start out filthy.  This is great in the real world
   *  but I went and wrote all the unit tests without entirely thinking about
   *  how this affected said unit tests.  So we add a listener so that we can
   *  force the folders to be clean.
   * This is okay and safe because messageInjection always creates the folders
   *  without any messages in them.
   */
  onRealFolderCreated: function gth_onRealFolderCreated(aRealFolder) {
    let glodaFolder = Gloda.getFolderForFolder(aRealFolder);
    glodaFolder._downgradeDirtyStatus(glodaFolder.kFolderClean);
  },

  /**
   * Make wait_for_gloda_indexer know that it should wait for a msgsClassified
   *  event whenever messages have been injected, at least if event-driven
   *  indexing is enabled.
   */
  onInjectingMessages: function gth_onInjectingMessages() {
    _indexMessageState.interestingEvents.push("msgsClassified");
  },

  /**
   * This basically translates to "we are triggering an IMAP move" and has
   *  the ramification that we should expect a msgsClassified event because
   *  the destination will see the header get added at some point.
   */
  onMovingMessagesWithoutDestHeaders:
      function gth_onMovingMessagesWithoutDestHeaders() {
    _indexMessageState.interestingEvents.push("msgsClassified");
  },
});

function _prepareIndexerForTesting() {
  if (!GlodaIndexer.enabled)
    do_throw("The gloda indexer is somehow not enabled.  This is problematic.");

  // Make the indexer be more verbose about indexing for us...
  GlodaIndexer._unitTestSuperVerbose = true;
  GlodaMsgIndexer._unitTestSuperVerbose = true;

  // -- Lobotomize the adaptive indexer
  // The indexer doesn't need to worry about load; zero his rescheduling time.
  GlodaIndexer._INDEX_INTERVAL = 0;

  // The indexer already registered for the idle service; we must remove this
  //  or "idle" notifications will still get sent via the observer mechanism.
  let realIdleService = GlodaIndexer._idleService;
  realIdleService.removeIdleObserver(GlodaIndexer,
                                     GlodaIndexer._indexIdleThresholdSecs);
  // pretend we are always idle
  GlodaIndexer._idleService = {
    idleTime: 1000,
    addIdleObserver: function() {
      // There is no actual need to register with the idle observer, and if
      //  we do, the stupid "idle" notification will trigger commits.
    },
    removeIdleObserver: function() {
    }
  };

  // We want the event-driven indexer to always handle indexing and never spill
  //  to an indexing sweep unless a test intentionally does so.
  GlodaIndexer._indexMaxEventQueueMessages = 10000;

  // Lobotomize the adaptive indexer's constants
  GlodaIndexer._cpuTargetIndexTime = 10000000;
  GlodaIndexer._CPU_TARGET_INDEX_TIME_ACTIVE = 10000000;
  GlodaIndexer._CPU_TARGET_INDEX_TIME_IDLE = 10000000;
  GlodaIndexer._CPU_IS_BUSY_TIME = 10000000;
  GlodaIndexer._PAUSE_LATE_IS_BUSY_TIME = 10000000;

  delete GlodaIndexer._indexTokens;
  GlodaIndexer.__defineGetter__("_indexTokens", function() {
    return this._CPU_MAX_TOKENS_PER_BATCH;
  });
  GlodaIndexer.__defineSetter__("_indexTokens", function() {});

  // This includes making commits only happen when we the unit tests explicitly
  //  tell them to.
  GlodaIndexer._MINIMUM_COMMIT_TIME = 10000000;
  GlodaIndexer._MAXIMUM_COMMIT_TIME = 10000000;

  GlodaIndexer._unitTestHookRecover = _indexMessageState._testHookRecover;
  GlodaIndexer._unitTestHookCleanup = _indexMessageState._testHookCleanup;
}

const _wait_for_gloda_indexer_defaults = {
  verifier: null,
  augment: false,
  deleted: null,

  // Things should not be recovering or failing and cleaning up unless the test
  //  is expecting it.
  recovered: 0,
  failedToRecover: 0,
  cleanedUp: 0,
  hadNoCleanUp: 0,
};

/**
 * Wait for the gloda indexer to finish indexing.  When it has finished,
 *  assert that the set of messages indexed is exactly the set passed in.
 *  If a verification function is provided, use it on a per-message basis
 *  to make sure the resulting gloda message looks like it should given the
 *  synthetic message.
 *
 * Note that if the indexer is not currently active we assume it has already
 *  completed; we do not entertain the possibility that it has not yet started.
 *  Since the indexer is 'active' as soon as it sees an event, this does mean
 *  that you need to wait to make sure the indexing event has happened before
 *  calling us.  This is reasonable.
 *
 * @param aSynMessageSets A single SyntheticMessageSet or list of
 *     SyntheticMessageSets containing exactly the messages we should expect to
 *     see.
 * @param [aConfig.verifier] The function to call to verify that the indexing
 *     had the desired result.  Takes arguments aSynthMessage (the synthetic
 *     message just indexed), aGlodaMessage (the gloda message representation of
 *     the indexed message), and aPreviousResult (the value last returned by the
 *     verifier function for this given set of messages, or undefined if it is
 *     the first message.)
 * @param [aConfig.augment=false] Should we augment the synthetic message sets
 *     with references to their corresponding gloda messages?  The messages
 *     will show up in a 'glodaMessages' list on the syn set.
 * @param [aConfig.deleted] A single SyntheticMessageSet or list of them
 *     containing messages that should be recognized as deleted by the gloda
 *     indexer in this pass.
 */
function wait_for_gloda_indexer(aSynMessageSets, aConfig) {
  let ims = _indexMessageState;

  if (aSynMessageSets == null)
    aSynMessageSets = [];
  else if (!("length" in aSynMessageSets))
    aSynMessageSets = [aSynMessageSets];

  ims.synMessageSets = aSynMessageSets;

  function get_val(aKey) {
    if (aConfig && (aKey in aConfig))
      return aConfig[aKey];
    else
      return _wait_for_gloda_indexer_defaults[aKey];
  }

  ims.verifier = get_val("verifier");
  ims.augmentSynSets = get_val("augment");
  ims.deletionSynSets = get_val("deleted");
  if (ims.deletionSynSets && !("length" in ims.deletionSynSets))
    ims.deletionSynSets = [ims.deletionSynSets];

  ims.expectedWorkerRecoveredCount = get_val("recovered");
  ims.expectedFailedToRecoverCount = get_val("failedToRecover");
  ims.expectedCleanedUpCount = get_val("cleanedUp");
  ims.expectedHadNoCleanUpCount = get_val("hadNoCleanUp");

  // If we are waiting on certain events to occur first, block on those.
  if (ims.interestingEvents.length) {
    ims.waitingForEvents = true;
    mark_action("glodaTestHelper", "waiting for events", ims.interestingEvents);
    return false;
  }

  // if we are still indexing, there is nothing to do right now; save off
  //  and rely on the indexing completion state change to trigger things.
  if (GlodaIndexer.indexing) {
    ims.waitingForIndexingCompletion = true;
    mark_action("glodaTestHelper", "waiting for indexer asynchronously", []);
    return false;
  }

  mark_action("glodaTestHelper", "indexing believed already completed", []);
  ims.assertExpectedMessagesIndexed();
  return true;
}

var _indexMessageState = {
  /** have we been initialized (hooked listeners, etc.) */
  _inited: false,

  _init: function _indexMessageState_init() {
    if (this._inited)
      return;

    Gloda.addIndexerListener(this.onIndexNotification);
    this.catchAllCollection = Gloda._wildcardCollection(Gloda.NOUN_MESSAGE);
    this.catchAllCollection.listener = this;

    // waitingForEvents support
    // (we want this to happen after gloda registers its own listener, and it
    //  does.)
    let notificationService =
      Cc["@mozilla.org/messenger/msgnotificationservice;1"].
      getService(Ci.nsIMsgFolderNotificationService);
    notificationService.addListener(this,
      Ci.nsIMsgFolderNotificationService.msgsClassified);

    this._inited = true;
  },

  /** our catch-all message collection that nets us all messages passing by */
  catchAllCollection: null,

  /** the synthetic message sets passed in to |wait_for_gloda_indexer| */
  synMessageSets: null,
  /** the user-specified accumulate-style verification func */
  verifier: null,
  /** should we augment the synthetic sets with gloda message info? */
  augmentSynSets: false,
  deletionSynSets: null,

  /** Expected value of |_workerRecoveredCount| at assertion time */
  expectedWorkerRecoveredCount: null,
  /** Expected value of |_workerFailedToRecoverCount| at assertion time */
  expectedFailedToRecoverCount: null,
  /** Expected value of |_workerCleanedUpCount| at assertion time */
  expectedCleanedUpCount: null,
  /** Expected value of |_workerHadNoCleanUpCount| at assertion time */
  expectedHadNoCleanUpCount: null,

  /** The number of times a worker had a recover helper and it recovered. */
  _workerRecoveredCount: 0,
  /**
   * The number of times a worker had a recover helper and it did not recover.
   */
  _workerFailedToRecoverCount: 0,
  /**
   * The number of times a worker had a cleanup helper and it cleaned up.
   */
  _workerCleanedUpCount: 0,
  /**
   * The number of times a worker had no cleanup helper but there was a cleanup.
   */
  _workerHadNoCleanUpCount: 0,

  /**
   * Are we currently in an async wait on events?  We only take concrete action
   *  on an event if this is true (and we were expecting the event).
   */
  waitingForEvents: false,
  /**
   * A list of events that we need to see before we allow ourselves to perform
   *  the indexer check.  For example, if "msgsClassified" is in here, it means
   *  that whether the indexer is active or not is irrelevant until we have
   *  seen that msgsClassified event.
   */
  interestingEvents: [],

  _jsonifyCallbackHandleState: function(aCallbackHandle) {
    return {
      _stringRep: aCallbackHandle.activeStack.length + " active generators",
      activeStackLength: aCallbackHandle.activeStack.length,
      contextStack: aCallbackHandle.contextStack,
    };
  },

  _testHookRecover: function(aRecoverResult, aOriginEx, aActiveJob,
                             aCallbackHandle) {
    mark_action("glodaEvent", "indexer recovery hook fired",
                ["recover result:", aRecoverResult,
                 "originating exception:", aOriginEx,
                 "active job:", aActiveJob,
                 "callbackHandle:",
                 _indexMessageState._jsonifyCallbackHandleState(
                   aCallbackHandle)]);
    if (aRecoverResult)
      _indexMessageState._workerRecoveredCount++;
    else
      _indexMessageState._workerFailedToRecoverCount++;
  },

  _testHookCleanup: function(aHadCleanupFunc, aOriginEx, aActiveJob,
                             aCallbackHandle) {
    mark_action("glodaEvent", "indexer cleanup hook fired",
                ["had cleanup?", aHadCleanupFunc,
                 "originating exception:", aOriginEx,
                 "active job:", aActiveJob,
                 "callbackHandle",
                 _indexMessageState._jsonifyCallbackHandleState(
                   aCallbackHandle)]);
    if (aHadCleanupFunc)
      _indexMessageState._workerCleanedUpCount++;
    else
      _indexMessageState._workerHadNoCleanUpCount++;
  },

  /**
   * The gloda messages indexed since the last call to |wait_for_gloda_indexer|.
   */
  _glodaMessagesByMessageId: {},
  _glodaDeletionsByMessageId: {},

  assertExpectedMessagesIndexed:
      function _indexMessageState_assertExpectedMessagesIndexed() {
    let verifier = this.verifier;
    let previousValue = undefined;

    // - Check we have a gloda message for every syn message and verify
    for each (let [, msgSet] in Iterator(this.synMessageSets)) {
      if (this.augmentSynSets)
        msgSet.glodaMessages = [];
      for each (let [iSynMsg, synMsg] in Iterator(msgSet.synMessages)) {
        if (!(synMsg.messageId in this._glodaMessagesByMessageId)) {
          let msgHdr = msgSet.getMsgHdr(iSynMsg);
          mark_failure(
            ["Header", msgHdr, "in folder", msgHdr ? msgHdr.folder: "no header?",
             "should have been indexed."]);
        }

        let glodaMsg = this._glodaMessagesByMessageId[synMsg.messageId];
        if (this.augmentSynSets)
          msgSet.glodaMessages.push(glodaMsg);

        this._glodaMessagesByMessageId[synMsg.messageId] = null;
        if (verifier) {
          try {
            previousValue = verifier(synMsg, glodaMsg, previousValue);
          }
          catch (ex) {
            // ugh, too verbose
            //logObject(synMsg, "synMsg");
            //logObject(glodaMsg, "glodaMsg");
            dump("synMsg: " + synMsg + "\n");
            dump("glodaMsg: " + glodaMsg + "\n");
            mark_failure(
              ["Verification failure:", synMsg, "is not close enough to",
                glodaMsg, "; basing this on exception:", ex]);
          }
        }
      }
    }

    // - Check that we don't have any extra gloda messages (lacking syn msgs)
    for each (let [, glodaMsg] in Iterator(this._glodaMessagesByMessageId)) {
      if (glodaMsg != null) {
        // logObject is too verbose right now
        dump("gloda message: " + glodaMsg + "\n");
        mark_failure(
          ["Gloda message", glodaMsg, "should not have been indexed.",
           "Source header:", glodaMsg.folderMessage]);
      }
    }

    if (this.deletionSynSets) {
      for each (let [, msgSet] in Iterator(this.deletionSynSets)) {
        for each (let [iSynMsg, synMsg] in Iterator(msgSet.synMessages)) {
          if (!(synMsg.messageId in this._glodaDeletionsByMessageId)) {
            do_throw("Synthetic message " + synMsg + " did not get deleted!");
          }

          let glodaMsg = this._glodaMessagesByMessageId[synMsg.messageId];

          this._glodaDeletionsByMessageId[synMsg.messageId] = null;
        }
      }
    }

    // - Check that we don't have unexpected deletions
    for each (let [messageId, glodaMsg] in
              Iterator(this._glodaDeletionsByMessageId)) {
      if (glodaMsg != null) {
        logObject(glodaMsg, "glodaMsg");
        do_throw("Gloda message with message id " + messageId + " was " +
                 "unexpectedly deleted!");
      }
    }

    if (this.expectedWorkerRecoveredCount != null &&
        this.expectedWorkerRecoveredCount != this._workerRecoveredCount)
      mark_failure(["Expected worker-recovered count did not match actual!",
                    "Expected", this.expectedWorkerRecoveredCount,
                    "actual", this._workerRecoveredCount]);
    if (this.expectedFailedToRecoverCount != null &&
        this.expectedFailedToRecoverCount != this._workerFailedToRecoverCount)
      mark_failure(["Expected worker-failed-to-recover count did not match " +
                     "actual!",
                    "Expected", this.expectedFailedToRecoverCount,
                    "actual", this._workerFailedToRecoverCount]);
    if (this.expectedCleanedUpCount != null &&
        this.expectedCleanedUpCount != this._workerCleanedUpCount)
      mark_failure(["Expected worker-cleaned-up count did not match actual!",
                    "Expected", this.expectedCleanedUpCount,
                    "actual", this._workerCleanedUpCount]);
    if (this.expectedHadNoCleanUpCount != null &&
        this.expectedHadNoCleanUpCount != this._workerHadNoCleanUpCount)
      mark_failure(["Expected worker-had-no-cleanup count did not match actual!",
                    "Expected", this.expectedHadNoCleanUpCount,
                    "actual", this._workerHadNoCleanUpCount]);

    this._glodaMessagesByMessageId = {};
    this._glodaDeletionsByMessageId = {};

    this._workerRecoveredCount = 0;
    this._workerFailedToRecoverCount = 0;
    this._workerCleanedUpCount = 0;
    this._workerHadNoCleanUpCount = 0;

    // make sure xpcshell head.js knows we tested something
    _passedChecks++;
  },

  /*
   * Our catch-all collection listener.  Any time a new message gets indexed,
   *  we should receive an onItemsAdded call.  Any time an existing message
   *  gets reindexed, we should receive an onItemsModified call.  Any time an
   *  existing message actually gets purged from the system, we should receive
   *  an onItemsRemoved call.
   */
  onItemsAdded: function(aItems) {
    mark_action("glodaEvent", "itemsAdded", aItems);

    for each (let [, item] in Iterator(aItems)) {
      if (item.headerMessageID in this._glodaMessagesByMessageId)
        mark_failure(
          ["Gloda message", item, "already indexed once since the last" +
            "wait_for_gloda_indexer call!"]);

      this._glodaMessagesByMessageId[item.headerMessageID] = item;
    }

    // simulate some other activity clearing out the the current folder's
    // cached database, which used to kill the indexer's enumerator.
    if (++this._numItemsAdded == 3)
      GlodaMsgIndexer._indexingFolder.msgDatabase = null;
  },

  onItemsModified: function(aItems) {
    mark_action("glodaEvent", "itemsModified", aItems);

    for each (let [, item] in Iterator(aItems)) {
      if (item.headerMessageID in this._glodaMessagesByMessageId)
        mark_failure(
          ["Gloda message", item, "already indexed once since the last" +
            "wait_for_gloda_indexer call!"]);

      this._glodaMessagesByMessageId[item.headerMessageID] = item;
    }
  },

  onItemsRemoved: function(aItems) {
    mark_action("glodaEvent", "removed", aItems);

    for each (let [, item] in Iterator(aItems)) {
      if (item.headerMessageID in this._glodaDeletionsByMessageId)
        mark_failure(
          ["Gloda message", item, "already deleted once since the last" +
            "wait_for_gloda_indexer call!"]);

      this._glodaDeletionsByMessageId[item.headerMessageID] = item;
    }
  },

  _numItemsAdded : 0,

  /**
   * Gloda indexer listener, used to know when all active indexing jobs have
   *  completed so that we can try and process all the things that should have
   *  been processed.
   */
  onIndexNotification: function(aStatus, aPrettyName, aJobIndex,
                                aJobItemIndex, aJobItemGoal) {
    let ims = _indexMessageState;
    LOG.debug("((( Index listener notified! aStatus = " + aStatus +
              " waiting: " + ims.waitingForIndexingCompletion + "\n");

    // we only care if indexing has just completed and we're waiting
    if (aStatus == Gloda.kIndexerIdle && !GlodaIndexer.indexing &&
        ims.waitingForIndexingCompletion) {
      ims.assertExpectedMessagesIndexed();
      ims.waitingForIndexingCompletion = false;
      LOG.debug("  kicking driver...\n");
      async_driver();
    }
  },

  /**
   * If this was an expected interesting event, remove it from the list.  If it
   *  was the last expected event and we were waiting for it, advance to
   *  asserting about what we indexed or waiting for indexing to complete.
   * If an event happens that we did not expect, it does not matter.  We know
   *  this because we add events we care about to interestingEvents before they
   *  can possibly be fired.
   */
  msgsClassified: function(aMsgHdrs, aJunkClassified, aTraitClassified) {
    let idx = this.interestingEvents.indexOf("msgsClassified");
    if (idx != -1) {
      this.interestingEvents.splice(idx, 1);
      // was that the last of the expected events?
      if (!this.interestingEvents.length && this.waitingForEvents) {
        this.waitingForEvents = false;
        if (GlodaIndexer.indexing) {
          this.waitingForIndexingCompletion = true;
          mark_action("glodaTestHelper", "saw last interesting event, " +
                      "waiting for indexer asynchronously", []);
          return;
        }

        mark_action("glodaTestHelper", "saw last interesting event, " +
                    "indexing believed already completed", []);
        this.assertExpectedMessagesIndexed();
        async_driver();
      }
    }
  },
};

/**
 * Given a function that generates a set of synthetic messages, feed those
 *  messages to gloda to be indexed, verifying the resulting indexed messages
 *  have the desired properties by calling the provided verification function.
 * This process is executed once for each possible permutation of observation
 *  of the synthetic messages.  (Well, we cap it; brute-force test your logic
 *  on your own time; you should really only be feeding us minimal scenarios.)
 *
 * @param aScenarioMaker A function that, when called, will generate a series
 *   of SyntheticMessage instances.  Each call to this method should generate
 *   a new set of conceptually equivalent, but not identical, messages.  This
 *   allows us to process without having to reset our state back to nothing each
 *   time.  (This is more to try and make sure we run the system with a 'dirty'
 *   state than a bid for efficiency.)
 * @param aVerifier Verifier function, same signature/intent as the same
 *   argument for wait_for_gloda_indexer (who we internally end up calling).
 */
function indexAndPermuteMessages(aScenarioMaker, aVerifier) {
  return async_run({func: _runPermutations,
                    args: [aScenarioMaker, aVerifier]});
}

/**
 * Actual worker for |indexAndPermuteMessages|.  This only exists because
 *  |indexAndPermuteMessages| can't be a generator itself, so it just shims to
 *  us.
 */
function _runPermutations(aScenarioMaker, aVerifier) {
  let folder = make_empty_folder();

  // To calculate the permutations, we need to actually see what gets produced.
  let scenarioMessages = aScenarioMaker();
  let numPermutations = Math.min(factorial(scenarioMessages.length), 32);
  for (let iPermutation = 0; iPermutation < numPermutations; iPermutation++) {
    mark_sub_test_start("Permutation",
                        (iPermutation + 1) + "/" + numPermutations,
                        true);
    // if this is not the first time through, we need to create a new set
    if (iPermutation)
      scenarioMessages = aScenarioMaker();
    scenarioMessages = permute(scenarioMessages, iPermutation);
    let scenarioSet = new SyntheticMessageSet(scenarioMessages);
    yield add_sets_to_folders(folder, [scenarioSet]);
    yield wait_for_gloda_indexer(scenarioSet, aVerifier);

    mark_sub_test_end();
  }
}

/**
 * A simple factorial function used to calculate the number of permutations
 *  possible for a given set of messages.
 */
function factorial(i, rv) {
  if (i <= 1)
    return rv || 1;
  return factorial(i-1, (rv || 1) * i); // tail-call capable
}

/**
 * Permute an array given a 'permutation id' that is an integer that fully
 *  characterizes the permutation through the decisions that need to be made
 *  at each step.
 *
 * @param aArray Source array that is destructively processed.
 * @param aPermutationId The permutation id.  A permutation id of 0 results in
 *     the original array's sequence being maintained.
 */
function permute(aArray, aPermutationId) {
  let out = [];
  for (let l=aArray.length; l > 0; l--) {
    let offset = aPermutationId % l;
    out.push(aArray[offset]);
    aArray.splice(offset, 1);
    aPermutationId = Math.floor(aPermutationId / l);
  }
  return out;
}

var _defaultExpectationExtractors = {};
_defaultExpectationExtractors[Gloda.NOUN_MESSAGE] = [
  function expectExtract_message_gloda(aGlodaMessage) {
    return aGlodaMessage.headerMessageID;
  },
  function expectExtract_message_synth(aSynthMessage) {
    return aSynthMessage.messageId;
  }
];
_defaultExpectationExtractors[Gloda.NOUN_CONTACT] = [
  function expectExtract_contact_gloda(aGlodaContact) {
    return aGlodaContact.name;
  },
  function expectExtract_contact_name(aName) {
    return aName;
  }
];
_defaultExpectationExtractors[Gloda.NOUN_IDENTITY] = [
  function expectExtract_identity_gloda(aGlodaIdentity) {
    return aGlodaIdentity.value;
  },
  function expectExtract_identity_address(aAddress) {
    return aAddress;
  }
];

function expectExtract_default_toString(aThing) {
  return aThing.toString();
}

/// see {queryExpect} for info on what we do
function QueryExpectationListener(aExpectedSet, aGlodaExtractor,
                                  aOrderVerifier, aCallerStackFrame) {
  this.expectedSet = aExpectedSet;
  this.glodaExtractor = aGlodaExtractor;
  this.orderVerifier = aOrderVerifier;
  this.completed = false;
  this.callerStackFrame = aCallerStackFrame;
  // track our current 'index' in the results for the (optional) order verifier,
  //  but also so we can provide slightly more useful debug output
  this.nextIndex = 0;
}

QueryExpectationListener.prototype = {
  onItemsAdded: function query_expectation_onItemsAdded(aItems, aCollection) {
    for each (let [, item] in Iterator(aItems)) {
      let glodaStringRep;
      try {
        glodaStringRep = this.glodaExtractor(item);
      }
      catch (ex) {
        do_throw("Gloda extractor threw during query expectation for item: " +
                 item + " exception: " + ex);
      }

      // make sure we were expecting this guy
      if (glodaStringRep in this.expectedSet)
        delete this.expectedSet[glodaStringRep];
      else
        mark_failure(["Query returned unexpected result!", item,
                      "expected set", this.expectedSet,
                      "caller", this.callerStackFrame]);

      if (this.orderVerifier) {
        try {
          this.orderVerifier(this.nextIndex, item, aCollection);
        }
        catch (ex) {
          // if the order was wrong, we could probably go for an output of what
          //  we actually got...
          dump("!!! ORDER PROBLEM, SO ORDER DUMP!\n");
          for each (let [iThing, thing] in Iterator(aItems)) {
            dump(iThing + ": " + thing +
                 (aCollection.stashedColumns ?
                  (". " + aCollection.stashedColumns[thing.id].join(", ")) :
                  "") + "\n");
          }
          throw ex;
        }
      }
      this.nextIndex++;

      // make sure the query's test method agrees with the database about this
      if (!aCollection.query.test(item)) {
        logObject(item);
        do_throw("Query test returned false when it should have been true on " +
                 "extracted: " + glodaStringRep + " item: " + item);
      }
    }
  },
  onItemsModified: function query_expectation_onItemsModified(aItems,
      aCollection) {
  },
  onItemsRemoved: function query_expectation_onItemsRemoved(aItems,
      aCollection) {
  },
  onQueryCompleted: function query_expectation_onQueryCompleted(aCollection) {
    // we may continue to match newly added items if we leave our query as it
    //  is, so let's become explicit to avoid related troubles.
    aCollection.becomeExplicit();

    // expectedSet should now be empty
    for each (let [key, value] in Iterator(this.expectedSet)) {
      dump("I have seen " + this.nextIndex + " results, but not:\n");
      do_throw("Query should have returned " + key + " (" + value + ")");
    }

    // xpcshell exposure that we did something
    _passedChecks++;

    mark_action("glodaTestHelper", "query satisfied with:", aCollection.items);
    async_driver();
  },
};

/**
 * Execute the given query, verifying that the result set contains exactly the
 *  contents of the expected set; no more, no less.  Since we expect that the
 *  query will result in gloda objects, but your expectations will not be posed
 *  in terms of gloda objects (though they could be), we rely on extractor
 *  functions to take the gloda result objects and the expected result objects
 *  into the same string.
 * If you don't provide extractor functions, we will use our defaults (based on
 *  the query noun type) if available, or assume that calling toString is
 *  sufficient.
 * Calls next_test automatically once the query completes and the results are
 *  checked.
 *
 * @param aQuery Either a query to execute, or a dict with the following keys:
 *     - queryFunc: The function to call that returns a function.
 *     - queryThis: The 'this' to use for the invocation of queryFunc.
 *     - args: A list (possibly empty) or arguments to precede the traditional
 *         arguments to query.getCollection.
 *     - nounId: The (numeric) noun id of the noun type expected to be returned.
 * @param aExpectedSet The list of expected results from the query where each
 *     item is suitable for extraction using aExpectedExtractor.  We have a soft
 *     spot for SyntheticMessageSets and automatically unbox them.
 * @param aGlodaExtractor The extractor function to take an instance of the
 *     gloda representation and return a string for comparison/equivalence
 *     against that returned by the expected extractor (against the input
 *     instance in aExpectedSet.)  The value returned must be unique for all
 *     of the expected gloda representations of the expected set.  If omitted,
 *     the default extractor for the gloda noun type is used.  If no default
 *     extractor exists, toString is called on the item.
 * @param aExpectedExtractor The extractor function to take an instance from the
 *     values in the aExpectedSet and return a string for comparison/equivalence
 *     against that returned by the gloda extractor.  The value returned must
 *     be unique for all of the values in the expected set.  If omitted, the
 *     default extractor for the presumed input type based on the gloda noun
 *     type used for the query is used, failing over to toString.
 * @param aOrderVerifier Optional function to verify the order the results are
 *     received in.  Function signature should be of the form (aZeroBasedIndex,
 *     aItem, aCollectionResultIsFor).
 * @returns The collection created from the query.
 */
function queryExpect(aQuery, aExpectedSet, aGlodaExtractor,
    aExpectedExtractor, aOrderVerifier) {
  if (aQuery.test)
    aQuery = {queryFunc: aQuery.getCollection, queryThis: aQuery, args: [],
              nounId: aQuery._nounDef.id};

  if ("synMessages" in aExpectedSet)
    aExpectedSet = aExpectedSet.synMessages;

  // - set extractor functions to defaults if omitted
  if (aGlodaExtractor == null) {
    if (_defaultExpectationExtractors[aQuery.nounId] !== undefined)
      aGlodaExtractor = _defaultExpectationExtractors[aQuery.nounId][0];
    else
      aGlodaExtractor = expectExtract_default_toString;
  }
  if (aExpectedExtractor == null) {
    if (_defaultExpectationExtractors[aQuery.nounId] !== undefined)
      aExpectedExtractor = _defaultExpectationExtractors[aQuery.nounId][1];
    else
      aExpectedExtractor = expectExtract_default_toString;
  }

  // - build the expected set
  let expectedSet = {};
  for each (let [, item] in Iterator(aExpectedSet)) {
    try {
      expectedSet[aExpectedExtractor(item)] = item;
    }
    catch (ex) {
      do_throw("Expected extractor threw during query expectation for item: " +
               item + " exception: " + ex);
    }
  }
  mark_action("glodaTestHelper", "expecting", [expectedSet]);

  // - create the listener...
  aQuery.args.push(new QueryExpectationListener(expectedSet,
                                                aGlodaExtractor,
                                                aOrderVerifier,
                                                Components.stack.caller));
  return aQuery.queryFunc.apply(aQuery.queryThis, aQuery.args);
}

/**
 * Run an (async) SQL statement against the gloda database.  The statement
 *  should be a SELECT COUNT; we check the count against aExpectedCount.
 *  Any additional arguments are positionally bound to the statement.
 *
 * We run the statement asynchronously to get a consistent view of the database.
 */
function sqlExpectCount(aExpectedCount, aSQLString /* ... params */) {
  let conn = GlodaDatastore.asyncConnection;
  let stmt = conn.createStatement(aSQLString);

  for (let iArg = 2; iArg < arguments.length; iArg++) {
    GlodaDatastore._bindVariant(stmt, iArg-2, arguments[iArg]);
  }

  let desc = Array.slice.call(arguments, 1);
  mark_action("glodaTestHelper", "running SQL count", desc);
  stmt.executeAsync(new _SqlExpectationListener(aExpectedCount, desc,
                                                Components.stack.caller));
  // we don't need the statement anymore
  stmt.finalize();

  return false;
}

function _SqlExpectationListener(aExpectedCount, aDesc, aCallerStackFrame) {
  this.actualCount = null;
  this.expectedCount = aExpectedCount;
  this.sqlDesc = aDesc;
  this.callerStackFrame = aCallerStackFrame;
}
_SqlExpectationListener.prototype = {
  handleResult: function sel_handleResult(aResultSet) {
    let row = aResultSet.getNextRow();
    if (!row)
      mark_failure(["No result row returned from caller", this.callerStackFrame,
                    "SQL:", sqlDesc]);
    this.actualCount = row.getInt64(0);
  },

  handleError: function sel_handleError(aError) {
    mark_failure(["SQL error from caller", this.callerStackFrame,
                  "result", aError, "SQL: ", sqlDesc]);
  },

  handleCompletion: function sel_handleCompletion(aReason) {
    if (this.actualCount != this.expectedCount)
      mark_failure(["Actual count of", this.actualCount,
                    "does not match expected count of", this.expectedCount,
                    "from caller", this.callerStackFrame,
                    "SQL", this.sqlDesc]);
    async_driver();
  },
};

/**
 * Resume execution when the db has run all the async statements whose execution
 *  was queued prior to this call.  We trigger a commit to accomplish this,
 *  although this could also be accomplished without a commit.  (Though we would
 *  have to reach into datastore.js and get at the raw connection or extend
 *  datastore to provide a way to accomplish this.)
 */
function wait_for_gloda_db_flush() {
  // we already have a mechanism to do this by forcing a commit.  arguably,
  //  it would be better to use a mechanism that does not induce an fsync.
  var savedDepth = GlodaDatastore._transactionDepth;
  if (!savedDepth)
    GlodaDatastore._beginTransaction();
  GlodaDatastore.runPostCommit(async_driver);
  // we don't actually need to run things to zero... we can just wait for the
  //  outer transaction to close itself...
  GlodaDatastore._commitTransaction();
  if (savedDepth)
    GlodaDatastore._beginTransaction();
  return false;
}

let _gloda_simulate_hang_data = null;
let _gloda_simulate_hang_waiting_for_hang = false;

function _simulate_hang_on_MsgHdrToMimeMessage() {
  _gloda_simulate_hang_data = [MsgHdrToMimeMessage, null, arguments];
  if (_gloda_simulate_hang_waiting_for_hang)
    async_driver();
}

/**
 * If you have configured gloda to hang while indexing, this is the thing
 *  you wait on to make sure the indexer actually gets to the point where it
 *  hangs.
 */
function wait_for_indexing_hang() {
  // if we already hit the hang, no need to do anything async...
  if (_gloda_simulate_hang_data != null)
    return true;
  _gloda_simulate_hang_waiting_for_hang = true;
  return false;
}

/**
 * An injected fault exception.
 */
function InjectedFault(aWhy) {
  this.message = aWhy;
}
InjectedFault.prototype = {
  toString: function() {
    return "[InjectedFault: " + this.message + "]";
  }
};

function _inject_failure_on_MsgHdrToMimeMessage() {
  throw new InjectedFault("MsgHdrToMimeMessage");
}

/**
 * Configure gloda indexing.  For most settings, the settings get clobbered by
 *  the next time this method is called.  Omitted settings reset to the defaults.
 *  However, anything labeled as a 'sticky' setting stays that way until
 *  explicitly changed.
 *
 * @param {boolean} [aArgs.event=true] Should event-driven indexing be enabled
 *     (true) or disabled (false)?  Right now, this actually suppresses
 *     indexing... the semantics will be ironed out as-needed.
 * @param [aArgs.hangWhile] Must be either omitted (for don't force a hang) or
 *     "streaming" indicating that we should do a no-op instead of performing
 *     the message streaming.  This will manifest as a hang until
 *     |resume_from_simulated_hang| is invoked or the test explicitly causes the
 *     indexer to abort (in which case you do not need to call the resume
 *     function.)  You must omit injectFaultIn if you use hangWhile.
 * @param [aArgs.injectFaultIn=null] Must be omitted (for don't inject a
 *     failure) or "streaming" indicating that we should inject a failure when
 *     the message indexer attempts to stream a message.  The fault will be an
 *     appropriate exception.  You must omit hangWhile if you use injectFaultIn.
 */
function configure_gloda_indexing(aArgs) {
  let shouldSuppress = ("event" in aArgs) ? !aArgs.event : false;
  if (shouldSuppress != GlodaIndexer.suppressIndexing) {
    mark_action("glodaTestHelper",
                "setting supress indexing to " + shouldSuppress, []);
    GlodaIndexer.suppressIndexing = shouldSuppress;
  }

  if ("hangWhile" in aArgs) {
    mark_action("glodaTestHelper", "enabling hang injection in",
                [aArgs.hangWhile]);
    switch (aArgs.hangWhile) {
      case "streaming":
        GlodaMsgIndexer._MsgHdrToMimeMessageFunc =
          _simulate_hang_on_MsgHdrToMimeMessage;
        break;
      default:
        mark_failure([aArgs.hangWhile,
                      "is not a legal choice for hangWhile"]);
    }
  }
  else if ("injectFaultIn" in aArgs) {
    mark_action("glodaTestHelper", "enabling fault injection in",
                [aArgs.hangWhile]);
    switch (aArgs.injectFaultIn) {
      case "streaming":
        GlodaMsgIndexer._MsgHdrToMimeMessageFunc =
          _inject_failure_on_MsgHdrToMimeMessage;
        break;
      default:
        mark_failure([aArgs.injectFaultIn,
                      "is not a legal choice for injectFaultIn"]);
    }
  }
  else {
    if (GlodaMsgIndexer._MsgHdrToMimeMessageFunc != MsgHdrToMimeMessage)
      mark_action("glodaTestHelper", "clearing hang/fault injection", []);
    GlodaMsgIndexer._MsgHdrToMimeMessageFunc = MsgHdrToMimeMessage;
  }
}

/**
 * Call this to resume from the hang induced by configuring the indexer with
 *  a "hangWhile" argument to |configure_gloda_indexing|.
 *
 * @param [aJustResumeExecution=false] Should we just poke the callback driver
 *     for the indexer rather than continuing the call.  You would likely want
 *     to do this if you committed a lot of violence while in the simulated
 *     hang and proper resumption would throw exceptions all over the place.
 *     (For example; if you hang before streaming and destroy the message
 *     header while suspended, resuming the attempt to stream will throw.)
 */
function resume_from_simulated_hang(aJustResumeExecution) {
  if (aJustResumeExecution) {
    mark_action("glodaTestHelper",
                "resuming from simulated hang with direct wrapper callback",
                []);
    GlodaIndexer._wrapCallbackDriver();
  }
  else {
    let [func, dis, args] = _gloda_simulate_hang_data;
    mark_action("glodaTestHelper",
                "resuming from simulated hang with call to: " + func.name,
                []);
    func.apply(dis, args);
  }
}

/**
 * Test driving logic that takes a list of tests to run.  Every completed test
 *  needs to call (or cause to be called) next_test.
 *
 * @param aTests A list of test functions to call.
 * @param [aNounID] The noun ID for the noun under test.
 */
function glodaHelperRunTests(aTests, aNounID) {
  // Initialize the message state if we are dealing with messages.  At some
  //  point we probably want to just completely generalize the indexing state.
  //  That point is likely when our testing infrastructure needs the support
  //  provided by _indexMessageState for things other than messages.
  if (aNounID === undefined ||
      aNounID == Gloda.NOUN_MESSAGE)
    _indexMessageState._init();

  _prepareIndexerForTesting();

  async_run_tests(aTests);
}

/**
 * Wipe out almost everything from the clutches of the GlodaCollectionManager.
 * By default, it is caching things and knows about all the non-GC'ed
 *  collections.  Tests may want to ensure that their data is loaded from disk
 *  rather than relying on the cache, and so, we exist.
 * The exception to everything is that Gloda's concept of myContact and
 *  myIdentities needs to have its collections still be reachable or invariants
 *  are in danger of being "de-invarianted".
 * The other exception to everything are any catch-all-collections used by our
 *  testing/indexing process.  We don't scan for them, we just hard-code their
 *  addition if they exist.
 */
function nukeGlodaCachesAndCollections() {
  // explode if the GlodaCollectionManager somehow doesn't work like we think it
  //  should.  (I am reluctant to put this logic in there, especially because
  //  knowledge of the Gloda contact/identity collections simply can't be known
  //  by the colleciton manager.)
  if ((GlodaCollectionManager._collectionsByNoun === undefined) ||
      (GlodaCollectionManager._cachesByNoun === undefined))
    // we don't check the Gloda contact/identities things because they might not
    //  get initialized if there are no identities, which is the case for our
    //  unit tests right now...
    do_throw("Try and remember to update the testing infrastructure when you " +
             "change things!");

  // we can just blow away the known collections
  GlodaCollectionManager._collectionsByNoun = {};
  // but then we have to put the myContact / myIdentities junk back
  if (Gloda._myContactCollection) {
    GlodaCollectionManager.registerCollection(Gloda._myContactCollection);
    GlodaCollectionManager.registerCollection(Gloda._myIdentitiesCollection);
  }
  // don't forget our testing catch-all collection!
  if (_indexMessageState.catchAllCollection) {
    // empty it out in case it has anything in it
    _indexMessageState.catchAllCollection.clear();
    // and now we can register it
    GlodaCollectionManager.registerCollection(
        _indexMessageState.catchAllCollection);
  }

  // caches aren't intended to be cleared, but we also don't want to lose our
  //  caches, so we need to create new ones from the ashes of the old ones.
  let oldCaches = GlodaCollectionManager._cachesByNoun;
  GlodaCollectionManager._cachesByNoun = {};
  for each (let cache in oldCaches) {
    GlodaCollectionManager.defineCache(cache._nounDef, cache._maxCacheSize);
  }
}
