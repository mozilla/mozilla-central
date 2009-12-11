/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

// tests reduction in size of training.dat

// main setup

load("resources/trainingfile.js");

const nsIPrefBranch = Cc["@mozilla.org/preferences-service;1"]
                        .getService(Ci.nsIPrefBranch);

// before shrink, the trained messages have 76 tokens. Force shrink.
nsIPrefBranch.setIntPref("mailnews.bayesian_spam_filter.junk_maxtokens", 75);

const nsIJunkMailPlugin = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                            .getService(Ci.nsIJunkMailPlugin);
// local constants
const kUnclassified = nsIJunkMailPlugin.UNCLASSIFIED;
const kJunk = nsIJunkMailPlugin.JUNK;
const kGood = nsIJunkMailPlugin.GOOD;

var emails =          [ "ham1.eml",  "ham2.eml",  "spam1.eml",
                        "spam2.eml", "spam3.eml", "spam4.eml" ];
var classifications = [ kGood,       kGood,       kJunk,
                        kJunk,       kJunk,       kJunk ];
var trainingData;

// main test
function run_test()
{
  loadLocalMailAccount();
  nsIJunkMailPlugin.resetTrainingData();

  do_test_pending();
  
  var email = emails.shift();
  var classification = classifications.shift();
  // additional calls to setMessageClassifiaction are done in the callback
  nsIJunkMailPlugin.setMessageClassification(getSpec(email),
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
    { nsIJunkMailPlugin.setMessageClassification(getSpec(email),
          kUnclassified, classification, null, doTestingListener);
      return;
    }
    
    // all done classifying, time to test
    nsIJunkMailPlugin.shutdown(); // just flushes training.dat
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
