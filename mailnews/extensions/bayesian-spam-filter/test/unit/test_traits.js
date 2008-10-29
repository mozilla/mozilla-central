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
  loadLocalMailAccount();
  do_test_pending();

  startCommand();
}

var listener =
{
  //nsIMsgTraitClassificationListener implementation
  onMessageTraitsClassified: function(aMsgURI, {}, aTraits, aPercents)
  {
    //print("Message URI is " + aMsgURI);

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
