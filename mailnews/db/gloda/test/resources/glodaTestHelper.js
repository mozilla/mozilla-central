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

// -- Pull in the POP3 fake-server / local account helper code
do_import_script("../mailnews/local/test/unit/head_maillocal.js");

// -- Import our modules
Components.utils.import("resource://app/modules/gloda/public.js");
Components.utils.import("resource://app/modules/gloda/indexer.js");

/** Inject messages using a POP3 fake-server. */
const INJECT_FAKE_SERVER = 1;
/** Inject messages using freshly created mboxes. */
const INJECT_MBOX = 2;

/**
 * Convert a list of synthetic messages to a form appropriate to feed to the
 *  POP3 fakeserver.
 */
function _synthMessagesToFakeRep(aSynthMessages) {
  return [{fileData: msg.toMessageString(), size: -1} for each
          (msg in aSynthMessages)];
}

function imsInit() {
  let ims = indexMessageState;

  if (!ims.inited) {
    // Disable new mail notifications
    var prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefBranch);
  
    prefSvc.setBoolPref("mail.biff.play_sound", false);
    prefSvc.setBoolPref("mail.biff.show_alert", false);
    prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
    prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);
  
    Gloda.addIndexerListener(messageIndexerListener.onIndexNotification);
    ims.catchAllCollection = Gloda._wildcardCollection(Gloda.NOUN_MESSAGE);
    ims.catchAllCollection.listener = messageCollectionListener;
    
    // The indexer doesn't need to worry about load; zero his rescheduling time. 
    //GlodaIndexer._indexInterval = 0;
    
    if (ims.injectMechanism == INJECT_FAKE_SERVER) {
      // set up POP3 fakeserver to feed things in...
      [ims.daemon, ims.server] = setupServerDaemon();
      // (this will call loadLocalMailAccount())
      ims.incomingServer = createPop3ServerAndLocalFolders();
  
      ims.pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                          .getService(Ci.nsIPop3Service);
    }
    else if (ims.injectMechanism == INJECT_MBOX) {
      // we need a local account to stash the mboxes under.
      loadLocalMailAccount();
    }
    
    ims.inited = true;
  }
}

/**
 * Have gloda index the given synthetic messages, calling the verifier function
 *  (with accumulator field) once the message has been succesfully indexed.
 *
 * We use two mechanisms to do this.  One: we create an open-ended message
 *  collection that gets notified whenever a new message hits the scene.  Two:
 *  we register as a notification listener so that we might know when indexing
 *  has completed.
 *
 * @param aSynthMessages The synthetic messages to introduce to a folder,
 *     resulting in gloda indexing them.
 * @param aVerifier The function to call to verify that the indexing had the
 *     desired result.  Takes arguments aSynthMessage (the synthetic message
 *     just indexed), aGlodaMessage (the gloda message representation of the
 *     indexed message), and aPreviousResult (the value last returned by the
 *     verifier function for this given set of messages, or undefined if it is
 *     the first message.)
 * @param aOnDone The function to call when we complete processing this set of
 *     messages.
 */
function indexMessages(aSynthMessages, aVerifier, aOnDone) {
  let ims = indexMessageState;
  
  ims.inputMessages = aSynthMessages;
  ims.glodaMessages = [];
  ims.verifier = aVerifier;
  ims.previousValue = undefined;
  ims.onDone = aOnDone;

  if (ims.injectMechanism == INJECT_FAKE_SERVER) {
    ims.daemon.setMessages(_synthMessagesToFakeRep(aSynthMessages));
    do_timeout(0, "driveFakeServer();");
  }
  else if (ims.injectMechanism == INJECT_MBOX) {
    ims.mboxName = "injecty" + ims.nextMboxNumber++;
    writeMessagesToMbox(aSynthMessages, gProfileDir,
                        "Mail/Local Folders/" + ims.mboxName);

    let rootFolder = gLocalIncomingServer.rootMsgFolder;
    let subFolder = rootFolder.addSubfolder(ims.mboxName);

    // we need to explicitly kick off indexing...
    updateFolderAndNotify(subFolder, function() {
      GlodaIndexer.indexFolder(subFolder);
    });
  }

}

function injectMessagesUsing(aInjectMechanism) {
  indexMessageState.injectMechanism = aInjectMechanism;
}

var indexMessageState = {
  /** have we been initialized (hooked listeners, etc.) */
  inited: false,
  /** our catch-all message collection that nets us all messages passing by */
  catchAllCollection: null,
  /** the set of synthetic messages passed in to indexMessages */
  inputMessages: null,
  /** the gloda messages resulting from indexing corresponding to input ones */
  glodaMessages: null,
  /** the user-specified accumulate-style verification func */
  verifier: null,
  /** the result of the last call to the verification function */
  previousValue: undefined,
  /** the function to call once we have indexed all the messages */
  onDone: null,
  
  injectMechanism: INJECT_FAKE_SERVER,
  
  /* === Fake Server State === */
  /** nsMailServer instance with POP3_RFC1939 handler */
  server: null,
  serverStarted: false,
  /** pop3Daemon instance */
  daemon: null,
  /** incoming pop3 server */
  incomingServer: null,
  /** pop3 service */
  pop3Service: null,

  /* === MBox Injection State === */
  nextMboxNumber: 0,
  mboxName: null,

  /**
   * Listener to handle the completion of the POP3 message retrieval (one way or
   *  the other.)
   */
  urlListener: {
    OnStartRunningUrl: function (url) {
    },
    OnStopRunningUrl: function (url, result) {
      let ims = indexMessageState;
      try {
        // this returns a log of the transaction, but we don't care.  (we
        //  assume that the POP3 stuff works.)
        ims.server.playTransaction();
        // doesn't hurt to break if the POP3 broke though...
        do_check_eq(result, 0);
      }
      catch (e) {
        // If we have an error, clean up nicely before we throw it.
        ims.server.stop();
  
        var thread = gThreadManager.currentThread;
        while (thread.hasPendingEvents())
          thread.processNextEvent(true);
  
        do_throw(e);
      }
      
      // we are expecting the gloda indexer to receive some notification as the
      //  result of the new messages showing up, so we don't actually need to
      //  do anything here.
    }
  }
};


/**
 * Indicate that we should expect some modified messages to be indexed.
 * 
 * @param aMessages The messages that will be modified and we should expect
 *   notifications about.  We currently don't do anything with these other than
 *   count them, so pass whatever you want and it will be the 'source message'
 *   (1st argument) to your verifier function.
 * @param aVerifier See indexMessage's aVerifier argument.
 * @param aDone The (optional) callback to call on completion.
 */
function expectModifiedMessages(aMessages, aVerifier, aOnDone) {
  let ims = indexMessageState;
  
  ims.inputMessages = aMessages;
  ims.glodaMessages = [];
  ims.verifier = aVerifier;
  ims.previousValue = undefined;
  ims.onDone = aOnDone;
  
  // we don't actually need to do anything.  the caller is going to be
  //  triggering a notification which will spur the indexer into action.  the
  //  indexer uses its own scheduling mechanism to drive itself, so as long
  //  as an event loop is active, we're good.
}

/**
 * Perform the mail fetching, seeing it through to completion.
 */
function driveFakeServer() {
  let ims = indexMessageState;
dump(">>> enter driveFakeServer\n");
  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  try {
    if (!(ims.serverStarted)) {
      dump("  starting fake server\n");
      ims.server.start(POP3_PORT);
      ims.serverStarted = true;
    }
    else {
      dump("  resetting fake server\n");
      ims.server.resetTest();
    }
    
    // Now get the mail
    dump("  issuing GetNewMail\n");
    ims.pop3Service.GetNewMail(null, ims.urlListener, gLocalInboxFolder,
                               ims.incomingServer);
    dump("  issuing performTest\n")
    ims.server.performTest();
  }
  catch (e) {
    ims.server.stop();
    do_throw(e);
  }
  finally {
    dump("  draining events\n");
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
dump("<<< exit driveFakeServer\n");
}

/**
 * Tear down the fake server.  This is very important to avoid things getting
 *  upset during shutdown.  (Namely, XPConnect will get mad about running in
 *  a context without "Components" defined.)
 */
function killFakeServer() {
  let ims = indexMessageState;

  ims.incomingServer.closeCachedConnections();
  
  // No more tests, let everything finish
  ims.server.stop();
  
  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

/**
 * Our catch-all collection listener.  Any time a new message gets indexed,
 *  we should receive an onItemsAdded call.  Any time an existing message
 *  gets reindexed, we should receive an onItemsModified call.  Any time an
 *  existing message actually gets purged from the system, we should receive
 *  an onItemsRemoved call.
 */
var messageCollectionListener = {
  onItemsAdded: function(aItems) {
    dump("onItemsAdded\n");
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
  },
  
  onItemsModified: function(aItems) {
    dump("onItemsModified\n");
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
  },
  
  onItemsRemoved: function(aItems) {
  }
};

/**
 * Gloda indexer listener, used to know when all active indexing jobs have
 *  completed so that we can try and process all the things that should have
 *  been processed.
 */
var messageIndexerListener = {
  onIndexNotification: function(aStatus, aPrettyName, aJobIndex, aJobTotal,
                                aJobItemIndex, aJobItemGoal) {
    // we only care if indexing has just completed...
    if (!GlodaIndexer.indexing) {
      let ims = indexMessageState;
      
      // this is just the synthetic notification if inputMessages is null
      if (ims.inputMessages === null)
       return;

      // if we haven't seen all the messages we should see, assume that the
      //  rest are on their way, and are just coming in a subsequent job...
      // (Also, the first time we register our listener, we will get a synthetic
      //  idle status; at least if the indexer is idle.)
      if (ims.glodaMessages.length < ims.inputMessages.length) {
        return;
      }
    
      // call the verifier.  (we expect them to generate an exception if the
      //  verification fails, using do_check_*/do_throw; we don't care about
      //  the return value except to propagate forward to subsequent calls.)
      for (let iMessage=0; iMessage < ims.inputMessages.length; iMessage++) {
        if (ims.verifier)
          ims.previousValue = ims.verifier(ims.inputMessages[iMessage],
                                           ims.glodaMessages[iMessage],
                                           ims.previousValue);
      }

      if (ims.onDone)
        ims.onDone();
    }
  }
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
 *   argument for indexMessages (who we internally end up calling).
 * @param aOnDone The (optional) function to call when we have finished
 *   processing.  Note that this handler is only called when there are no
 *   additional jobs to be queued.  So if you queue up 5 jobs, you can pass in
 *   the same aOnDone handler for all of them, confident in the knowledge that
 *   only the last job will result in the done handler being called.  
 */
function indexAndPermuteMessages(aScenarioMaker, aVerifier, aOnDone) {
  let mis = multiIndexState;
  
  mis.queue.push([aScenarioMaker, aVerifier, aOnDone]);

  // start processing it immediately if we're not doing anything...
  if (!mis.active)
    _multiIndexNext();
}

/**
 * Helper function that does the actual multi-indexing work for each call
 *  made to indexAndPermuteMessages.  Since those calls can stack, the arguments
 *  are queued, and we process them when there is no (longer) a current job.
 *  _permutationIndexed handles the work of trying the subsequent permutations
 *  for each job we de-queue and initiate.
 */
function _multiIndexNext() {
  let mis = multiIndexState;
  
  if (mis.queue.length) {
    mis.active = true;
    
    let [aScenarioMaker, aVerifier, aOnDone] = mis.queue.shift();
  
    let firstSet = aScenarioMaker();
    
    mis.scenarioMaker = aScenarioMaker;
    mis.verifier = aVerifier;
    // 32 permutations is probably too generous, not to mention an odd choice.
    mis.numPermutations = Math.min(factorial(firstSet.length), 32);
    mis.nextPermutationId = 1;
    
    mis.onDone = aOnDone;
    
    indexMessages(firstSet, mis.verifier, _permutationIndexed);
  }
  else {
    mis.active = false;
    if (mis.onDone)
      mis.onDone();
  }
}

/**
 * The onDone handler for indexAndPermuteMessages/_multiIndexNext's use of
 *  indexMessages under the hood.  Generates and initiates processing of then
 *  next permutation if any remain, otherwise deferring to _multiIndexNext to
 *  de-queue the next call/job or close up shop. 
 */
function _permutationIndexed() {
  let mis = multiIndexState;
  if (mis.nextPermutationId < mis.numPermutations)
    indexMessages(permute(mis.scenarioMaker(), mis.nextPermutationId++),
                  mis.verifier, _permutationIndexed);
  else
    _multiIndexNext();
}

/**
 * The state global for indexAndPermuteMessages / _multiIndexNext / 
 *  _permutationIndexed.
 */
var multiIndexState = {
  scenarioMaker: null,
  verifier: null,
  onDone: null,
  numPermutations: undefined,
  nextPermutationId: undefined,
  active: false,
  queue: []
};

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

// TODO: FIXME: XXX: this should go away, I put it in mailTestUtils.js, but
//  for the sanity of people trying to use this code who might not have my
//  other patches, I have left it here for now.
function toXPArray(aItems) {
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  aItems.forEach(function (item) {
    array.appendElement(item, false);
  });
  return array;
}

/**
 *
 */
function twiddleAndTest(aSynthMsg, aActionsAndTests) {
  let iTwiddling = 0;
  function twiddle_next_attr(smsg, gmsg) {
    let curTwiddling = aActionsAndTests[iTwiddling];
    let twiddleFunc = curTwiddling[0];
    let desiredState = curTwiddling[2];
    
    // the underlying nsIMsgDBHdr should exist at this point...
    do_check_neq(gmsg.folderMessage, null);
    // prepare 
    expectModifiedMessages([gmsg.folderMessage], verify_next_attr);
    // tell the function to perform its mutation to the desired state
    twiddleFunc(gmsg.folderMessage, desiredState);
  }
  function verify_next_attr(smsg, gmsg) {
    let curTwiddling = aActionsAndTests[iTwiddling];
    let verifyFunc = curTwiddling[1];
    let expectedVal = curTwiddling[curTwiddling.length == 3 ? 2 : 3];
    verifyFunc(smsg, gmsg, expectedVal);
    
    if (++iTwiddling < aActionsAndTests.length)
      twiddle_next_attr(smsg, gmsg);
    else
      next_test();
  }
  
  indexMessages([aSynthMsg], twiddle_next_attr);
}

var glodaHelperTests = [];
var glodaHelperIterator = null;

function _gh_test_iterator() {
  do_test_pending();

  for (let iTest=0; iTest < glodaHelperTests.length; iTest++) {
    dump("====== Test function: " + glodaHelperTests[iTest].name + "\n");
    yield glodaHelperTests[iTest]();
  }

  if (indexMessageState.injectMechanism == INJECT_FAKE_SERVER) {
    killFakeServer();
  }

  do_test_finished();
  
  // once the control flow hits the root after do_test_finished, we're done,
  //  so let's just yield something to avoid callers having to deal with an
  //  exception indicating completion.
  glodaHelperIterator = null;
  yield null;
}

function next_test() {
  glodaHelperIterator.next();
}

function glodaHelperRunTests(aTests) {
  imsInit();
  glodaHelperTests = aTests;
  glodaHelperIterator = _gh_test_iterator();
  next_test();
}
