var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                          .getService(Components.interfaces.nsIIOService);
var resProt = ioService.getProtocolHandler("resource")
                       .QueryInterface(Components.interfaces.nsIResProtocolHandler);

//var aliasFile = Components.classes["@mozilla.org/file/local;1"]
//                          .createInstance(Components.interfaces.nsILocalFile);
var glodaFile = do_get_file("../mailnews/db/global");
//aliasFile.initWithPath("../mailnews/db/global");

var aliasURI = ioService.newFileURI(glodaFile);
resProt.setSubstitution("gloda", aliasURI);

Components.utils.import("resource://gloda/modules/public.js");
Components.utils.import("resource://gloda/modules/indexer.js");

do_import_script("../mailnews/local/test/unit/head_maillocal.js");

/**
 * Convert a list of synthetic messages to a form appropriate to feed to the
 *  POP3 fakeserver.
 */
function _synthMessagesToFakeRep(aSynthMessages) {
  return [{fileData: msg.toMessageString(), size: -1} for each
          (msg in aSynthMessages)];
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
    
    // set up POP3 fakeserver to feed things in...
    [ims.daemon, ims.server] = setupServerDaemon();
    ims.incomingServer = createPop3ServerAndLocalFolders();

    ims.pop3Service = Cc["@mozilla.org/messenger/popservice;1"]
                        .getService(Ci.nsIPop3Service);
    
    ims.inited = true;
  }
  
  ims.daemon.setMessages(_synthMessagesToFakeRep(aSynthMessages));
  ims.active = true;
  do_timeout(0, "driveFakeServer();");
}

var indexMessageState = {
  /** have we been initialized (hooked listeners, etc.) */
  inited: false,
  active: false,
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
  
  /** nsMailServer instance with POP3_RFC1939 handler */
  server: null,
  serverStarted: false,
  /** pop3Daemon instance */
  daemon: null,
  /** incoming pop3 server */
  incomingServer: null,
  /** pop3 service */
  pop3Service: null,

  urlListener: {
    OnStartRunningUrl: function (url) {
    },
    OnStopRunningUrl: function (url, result) {
dump("~~onStopRuningUrl\n");
      let ims = indexMessageState;
      try {
        var transaction = ims.server.playTransaction();
        // we don't realy care about the transaction 
  
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
  
      // Let OnStopRunningUrl return cleanly before doing anything else.
      //do_timeout(0, "indexMessageState.checkBusy();");
    }
  },
  
  checkBusy: function() {
dump("~~~~checkBusy\n");
    let ims = indexMessageState;
    if (tests.length == 0) {
    }
  
    // If the server hasn't quite finished, just delay a little longer.
    if (ims.incomingServer.serverBusy ||
        (ims.incomingServer instanceof Ci.nsIPop3IncomingServer &&
         ims.incomingServer.runningProtocol)) {
      do_timeout(20, ims.checkBusy);
      return;
    }
    
    // if there is more to do, do it
    //if (ims.active)
    //  driveFakeServer();
  }
};

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

function killFakeServer() {
  let ims = indexMessageState;

  ims.incomingServer.closeCachedConnections();
  
  // No more tests, let everything finish
  ims.server.stop();
  
  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

var messageCollectionListener = {
  onItemsAdded: function(aItems) {
    dump("onItemsAdded\n");
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
  },
  
  onItemsModified: function(aItems) {
  },
  
  onItemsRemoved: function(aItems) {
  }
};

var messageIndexerListener = {
  onIndexNotification: function(aStatus, aPrettyName, aJobIndex, aJobTotal,
                                aJobItemIndex, aJobItemGoal) {
    dump("onIndexNotification\n");
    // we only care if indexing has just completed...
    if (!GlodaIndexer.indexing) {
dump("  gloda is no longer indexing.\n");
      let ims = indexMessageState;
      
      // if we haven't seen all the messages we should see, assume that the
      //  rest are on their way, and are just coming in a subsequent job...
      if (ims.glodaMessages.length < ims.inputMessages.length) {
dump("we wanted " + ims.inputMessages.length + " but have seen " + 
     ims.glodaMessages.length + "\n");
        return;
      }
    
      // call the verifier.  (we expect them to generate an exception if the
      //  verification fails, using do_check_*/do_throw; we don't care about
      //  the return value except to propagate forward to subsequent calls.)
      for (let iMessage=0; iMessage < ims.inputMessages.length; iMessage++) {
        ims.previousValue = ims.verifier(ims.inputMessages[iMessage],
                                         ims.glodaMessages[iMessage],
                                         ims.previousValue);
      }

dump("  calling onDone\n");
      ims.active = false;
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
 */
function indexAndPermuteMessages(aScenarioMaker, aVerifier, aOnDone) {
  let mis = multiIndexState;
  
  mis.queue.push([aScenarioMaker, aVerifier, aOnDone]);

  // start processing it immediately if we're not doing anything...
  if (!mis.active)
    _multiIndexNext();
}

function _multiIndexNext() {
  let mis = multiIndexState;
  
  if (mis.queue.length) {
    mis.active = true;
    
    let [aScenarioMaker, aVerifier, aOnDone] = mis.queue.shift();
  
    let firstSet = aScenarioMaker();
    
    mis.scenarioMaker = aScenarioMaker;
    mis.verifier = aVerifier;
    // so, 32 permutations is probably too generous, not to mention an odd choice.
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

function _permutationIndexed() {
  let mis = multiIndexState;
  if (mis.nextPermutationId < mis.numPermutations)
    indexMessages(permute(mis.scenarioMaker(), mis.nextPermutationId++),
                  mis.verifier, _permutationIndexed);
  else
    _multiIndexNext();
}

var multiIndexState = {
  scenarioMaker: null,
  verifier: null,
  onDone: null,
  numPermutations: undefined,
  nextPermutationId: undefined,
  active: false,
  queue: []
};

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
dump ("permute returning: " + out + "\n");
  return out;
}
