/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// tests reduction in size of training.dat

// main setup

load("resources/trainingfile.js");

Components.utils.import("resource:///modules/mailServices.js");

// before shrink, the trained messages have 76 tokens. Force shrink.
Services.prefs.setIntPref("mailnews.bayesian_spam_filter.junk_maxtokens", 75);

// local constants
const kUnclassified = MailServices.junk.UNCLASSIFIED;
const kJunk = MailServices.junk.JUNK;
const kGood = MailServices.junk.GOOD;

var emails =          [ "ham1.eml",  "ham2.eml",  "spam1.eml",
                        "spam2.eml", "spam3.eml", "spam4.eml" ];
var classifications = [ kGood,       kGood,       kJunk,
                        kJunk,       kJunk,       kJunk ];
var trainingData;

// main test
function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  MailServices.junk.resetTrainingData();

  do_test_pending();
  
  var email = emails.shift();
  var classification = classifications.shift();
  // additional calls to setMessageClassifiaction are done in the callback
  MailServices.junk.setMessageClassification(getSpec(email),
    kUnclassified, classification, null, doTestingListener);
}

var doTestingListener = 
{
  onMessageClassified: function(aMsgURI, aClassification, aJunkPercent)
  {
    if (!aMsgURI)
      return; // ignore end-of-batch signal
    var email = emails.shift();
    var classification = classifications.shift();
    if (email)
    {
      MailServices.junk.setMessageClassification(getSpec(email),
          kUnclassified, classification, null, doTestingListener);
      return;
    }
    
    // all done classifying, time to test
    MailServices.junk.shutdown(); // just flushes training.dat
    trainingData = new TrainingData();
    trainingData.read();

    /*
    // List training.dat information for debug
    dump("training.data results: goodMessages=" + trainingData.mGoodMessages
      + " junkMessages = " + trainingData.mJunkMessages
      + " goodTokens = " + trainingData.mGoodTokens
      + " junkTokens = " + trainingData.mJunkTokens
      + "\n");
    print("Good counts");
    for (var token in trainingData.mGoodCounts)
      dump("count: " + trainingData.mGoodCounts[token] + " token: " + token + "\n");
    print("Junk Counts");
    for (var token in trainingData.mJunkCounts)
      dump("count: " + trainingData.mJunkCounts[token] + " token: " + token + "\n");
    */
    
    /* Selected pre-shrink counts after training
    training.data results: goodMessages=2 junkMessages = 4 tokens = 78
    Good counts
    count: 1 token: subject:report
    count: 2 token: important
    count: 2 token: to:careful reader <reader@example.org>

    Junk Counts
    count: 3 token: make
    count: 4 token: money
    count: 4 token: to:careful reader <reader@example.org>
    count: 2 token: money!
    */
    
    // Shrinking divides all counts by two. In comments, I show the
    // calculation for each test, (pre-shrink count)/2.

    do_check_eq(trainingData.mGoodMessages, 1); //  2/2
    do_check_eq(trainingData.mJunkMessages, 2); //  4/2
    checkToken("money", 0, 2);  // (0/2, 4/2)
    checkToken("subject:report", 0, 0);  // (1/2, 0/2)
    checkToken("to:careful reader <reader@example.org>", 1, 2); // (2/2, 4/2)
    checkToken("make", 0, 1); // (0/2, 3/2)
    checkToken("important", 1, 0); // (2/2, 0/2)
    
    do_test_finished();
  }
};

// helper functions

function checkToken(aToken, aGoodCount, aJunkCount)
{
  print(" checking " + aToken);
  var goodCount = trainingData.mGoodCounts[aToken];
  var junkCount = trainingData.mJunkCounts[aToken];
  if (!goodCount) goodCount = 0;
  if (!junkCount) junkCount = 0;
  do_check_eq(goodCount, aGoodCount);
  do_check_eq(junkCount, aJunkCount);
}
