/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tests bayes trait analysis

// I make this an instance so that I know I can reset and get
// a completely new component. Should be getService in production code.
var nsIJunkMailPlugin =
  Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
    .createInstance(Ci.nsIJunkMailPlugin);

// command functions for test data
const kTrain = 0;  // train a file as a trait
const kClass = 1;  // classify files with traits
const kReset = 2;  // reload plugin, reading in data from disk
const kDetail = 3; // test details

var gTest; // currently active test

// The tests array defines the tests to attempt. Format of
// an element "test" of this array:
//
//   test.command: function to perform, see definitions above
//   test.fileName: file(s) containing message(s) to test
//   test.traitIds: Array of traits to train (kTrain) or pro trait (kClass)
//   test.traitAntiIds: Array of anti traits to classify
//   test.percents: array of arrays (1 per message, 1 per trait) of
//                  expected results from the classifier

var tests =
[
  // train two different combinations of messages
  {command: kTrain,
   fileName: "ham1.eml",
   traitIds: [3,6]
  },
  {command: kTrain,
   fileName: "spam1.eml",
   traitIds: [4]
  },
  {command: kTrain,
   fileName: "spam4.eml",
   traitIds: [5]
  },

  // test the message classifications using both singular and plural classifier
  {command: kClass,
   fileName: "ham1.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   // ham1 is trained "anti" for first test, "pro" for second
   percents: [[0, 100]]
  },
  {command: kClass,
   fileName: "ham2.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   // these are partial percents for an untrained message. ham2 is similar to ham1
   percents: [[8,95]]
  },
  {command: kDetail,
   fileName: "spam2.eml",
   traitIds: [4],
   traitAntiIds: [3],
   percents: { lots: 84,
               money: 84,
               make: 84,
               your: 16 },
   runnings: [84, 92, 95, 81]
  },
  {command: kClass,
   fileName: "spam1.eml,spam2.eml,spam3.eml,spam4.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   // spam1 trained as "pro" for first pro/anti pair
   // spam4 trained as "anti" for second pro/anti pair
   // others are partials
   percents: [ [100,50] , [81,0] , [98,50] , [81,0]]
  },
  // reset the plugin, read in data, and retest the classification
  // this tests the trait file writing
  {command: kReset},
  {command: kClass,
   fileName: "ham1.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   percents: [[0, 100]]
  },
  {command: kClass,
   fileName: "ham2.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   percents: [[8,95]]
  },
  {command: kClass,
   fileName: "spam1.eml,spam2.eml,spam3.eml,spam4.eml",
   traitIds: [4,6],
   traitAntiIds: [3,5],
   percents: [ [100,50] , [81,0] , [98,50] , [81,0]]
  },
]

// main test
function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  do_test_pending();

  startCommand();
}

var listener =
{
  //nsIMsgTraitClassificationListener implementation
  onMessageTraitsClassified: function(aMsgURI, {}, aTraits, aPercents)
  {
    //print("Message URI is " + aMsgURI);
    if (!aMsgURI)
      return; //ignore end-of-batch signal

    switch (gTest.command)
    {
      case kClass:
        do_check_eq(gTest.files[gTest.currentIndex], aMsgURI);
        var currentPercents = gTest.percents[gTest.currentIndex];
        for (var i = 0; i < currentPercents.length; i++)
        {
          //print("expecting score " + currentPercents[i] +
          //      " got score " + aPercents[i]);
          do_check_eq(currentPercents[i], aPercents[i]);
        }
        gTest.currentIndex++;
        break;

      case kTrain:
        // We tested this some in test_junkAsTraits.js, so let's not bother
      default:
        break;
    }
    if (!--gTest.callbacks)
      // All done, start the next test
      startCommand();
  },
  onMessageTraitDetails: function(aMsgURI, aProTrait, {}, aTokenString,
                                  aTokenPercents, aRunningPercents)
  {
    print("Details for " + aMsgURI);
    for (var i = 0; i < aTokenString.length; i++)
    {
      print("Percent " + aTokenPercents[i] +
            " Running " + aRunningPercents[i] +
            " Token " + aTokenString[i]);
      do_check_true(aTokenString[i] in gTest.percents);

      do_check_eq(gTest.percents[aTokenString[i]], aTokenPercents[i]);
      do_check_eq(gTest.runnings[i], aRunningPercents[i]);
      delete gTest.percents[aTokenString[i]];
    }
    do_check_eq(Object.keys(gTest.percents).length, 0);
    gTest.currentIndex++;
    startCommand();
  }
};

// start the next test command
function startCommand()
{
  if (!tests.length)       // Do we have more commands?
  {
    // no, all done
    do_test_finished();
    return;
  }

  gTest = tests.shift();
  print("StartCommand command = " + gTest.command + ", remaining tests " + tests.length);
  switch (gTest.command)
  {
    case kTrain:
      // train message
      var proArray = [];
      for (var i = 0; i < gTest.traitIds.length; i++)
        proArray.push(gTest.traitIds[i]);
      gTest.callbacks = 1;

      nsIJunkMailPlugin.setMsgTraitClassification(
        getSpec(gTest.fileName), //in string aMsgURI
        0,
        null,         // in nsIArray aOldTraits
        proArray.length,
        proArray,     // in nsIArray aNewTraits
        listener);    // [optional] in nsIMsgTraitClassificationListener aTraitListener
        // null,      // [optional] in nsIMsgWindow aMsgWindow
        // null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
      break;

    case kClass:
      // classify message
      var antiArray = [];
      var proArray = [];
      for (var i = 0; i < gTest.traitIds.length; i++)
      {
        antiArray.push(gTest.traitAntiIds[i]);
        proArray.push(gTest.traitIds[i]);
      }
      gTest.files = gTest.fileName.split(",");
      gTest.callbacks = gTest.files.length;
      gTest.currentIndex = 0;
      for (var i = 0; i < gTest.files.length; i++)
        gTest.files[i] = getSpec(gTest.files[i]);
      if (gTest.files.length == 1)
        // use the singular classifier
        nsIJunkMailPlugin.classifyTraitsInMessage(
          getSpec(gTest.fileName), // in string aMsgURI
          proArray.length, // length of traits arrays
          proArray,    // in array aProTraits,
          antiArray,   // in array aAntiTraits
          listener);   // in nsIMsgTraitClassificationListener aTraitListener
          //null,      // [optional] in nsIMsgWindow aMsgWindow
          //null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
      else
      {
        // use the plural classifier
        nsIJunkMailPlugin.classifyTraitsInMessages(
          gTest.files.length, // in unsigned long aCount,
          gTest.files, // [array, size_is(aCount)] in string aMsgURIs,
          proArray.length, // length of traits arrays
          proArray,    // in array aProTraits,
          antiArray,   // in array aAntiTraits
          listener);   // in nsIMsgTraitClassificationListener aTraitListener
          //null,      // [optional] in nsIMsgWindow aMsgWindow
          //null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
      }
      break;

    case kDetail:
      // detail message
      nsIJunkMailPlugin.detailMessage(
        getSpec(gTest.fileName), // in string aMsgURI
        gTest.traitIds[0], // proTrait
        gTest.traitAntiIds[0],   // antiTrait
        listener);   // in nsIMsgTraitDetailListener aDetailListener
      break;
    case kReset:
      // reload a new nsIJunkMailPlugin, reading file in the process
      nsIJunkMailPlugin.shutdown(); // writes files
      nsIJunkMailPlugin = null;
      nsIJunkMailPlugin =
        Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
          .createInstance(Ci.nsIJunkMailPlugin);
      // does not do a callback, so we must restart next command
      startCommand();
      break;

  }
}
