Cu.import("resource://gloda/modules/gloda.js");
Cu.import("resource://gloda/modules/datamodel.js");
Cu.import("resource://gloda/modules/indexer.js");

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
  if (!ims.inited) {
    GlodaIndexer.addListener(messageIndexerListener.onIndexNotification);
    ims.catchAllCollection = Gloda._wildcardCollection(GlodaMessage.NOUN_ID);
    ims.catchAllCollection.listener = messageCollectionListener;
    
    ims.inited = true;
  }
  
  ims.inputMessages = aSynthMessages;
  ims.glodaMessages = [];
  ims.verifier = aVerifier;
  ims.previousValue = undefined;
  ims.onDone = aOnDone;
}

var indexMessageState = {
  inited: false,
  catchAllCollection: null,
  inputMessages: null,
  glodaMessages: null,
  verifier: null,
  previousValue: undefined,
  onDone: null,
};

var messageCollectionListener = {
  onItemsAdded: function(aItems) {
    let ims = indexMessageState;
    ims.glodaMessages = ims.glodaMessages.concat(aItems);
  },
  
  onItemsModified: function(aItems) {
  },
  
  onItemsRemoved: function(aItems) {
  },
};

var messageIndexerListener = {
  onIndexNotification: function(aStatus, aPrettyName, aJobIndex, aJobTotal,
                                aJobItemIndex, aJobItemGoal) {
    // we only care if indexing has just completed...
    if (!GlodaIndexer.indexing) {
      // get angry if our messages didn't get indexed
    
      // call the verifier.
      let ims = indexMessageState;
      ims.verifier(ims.inputMessage, ims.itemAdded, ims.previousValue);
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
function indexMessagesAndVerify(aScenarioMaker, aVerifier) {
  let firstSet = aScenarioMaker();
  
  let mis = multiIndexState;
  mis.scenarioMaker = aScenarioMaker;
  // so, 32 permutations is probably too generous, not to mention an odd choice.
  mis.numPermutations = Math.min(factorial(firstSet.length), 32);
  mis.nextPermutationId = 1;
  
  
}

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
  for (let l=aArray.length; l >= 0; l--) {
    let offset = aPermutationId % l;  
    out.push(aArray[offset]);
    aArray.splice(offset, 1);
    aPermutationId = Math.floor(aPermutationId / l);
  }
  return out;
}

var multiIndexState = {
  scenarioMaker: null,
  numPermutations: undefined,
  nextPermutationId: undefined,
};
