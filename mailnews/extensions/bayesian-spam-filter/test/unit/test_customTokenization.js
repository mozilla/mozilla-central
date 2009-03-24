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
 * Portions created by the Initial Developer are Copyright (C) 2009
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

// Tests use of custom tokenization, originally introduced in bug 476389

const nsIJunkMailPlugin =
  Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
    .getService(Ci.nsIJunkMailPlugin);

const prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);

// command functions for test data
const kTrain = 0;  // train a file
const kTest = 1;   // test headers returned from detail
const kSetup = 2;  // run a setup function

// trait ids
const kProArray = [3];
const kAntiArray = [4];

var gTest; // currently active test

// The tests array defines the tests to attempt.

var tests =
[
  // test a few tokens using defaults
  {command: kTrain,
   fileName: "tokenTest.eml"
  },
  {command: kTest,
   fileName: "tokenTest.eml",
   tokens: ["important",
            "subject:eat",
            "message-id:14159",
            "http://www"],
   nottokens: ["idonotexist", "subject:to"]
  },

  // enable received, disable message-id
  // switch tokenization of body to catch full urls (no "." delimiter)
  // enable sender, keeping full value
  {command: kSetup,
   operation: function()
     {
       prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.received", "standard");
       prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.message-id", "false");
       prefs.setCharPref("mailnews.bayesian_spam_filter.body_delimiters", " \t\r\n\v");
       prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.sender", "full");
     }
  },
  {command: kTrain,
   fileName: "tokenTest.eml"
  },
  {command: kTest,
   fileName: "tokenTest.eml",
   tokens: ["important", "subject:eat", "received:reader@example", "skip:h 20",
            "sender:bugzilla test setup <noreply@example.org>", "received:<someone@example"],
   nottokens: ["message-id:14159",
               "http://www"]
  },

  // increase the length of the maximum token to catch full URLs in the body
  // add <>;, remove . from standard header delimiters to better capture emails
  // use custom delimiters on sender, without "." or "<>"
  {command: kSetup,
   operation: function()
     {
       prefs.setIntPref("mailnews.bayesian_spam_filter.maxlengthfortoken", 50);
       prefs.setCharPref("mailnews.bayesian_spam_filter.header_delimiters", " ;<>\t\r\n\v");
       prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.sender", " \t\r\n\v");
     }
  },
  {command: kTrain,
   fileName: "tokenTest.eml"
  },
  {command: kTest,
   fileName: "tokenTest.eml",
   tokens: ["received:someone@example.com", "http://www.example.org", "received:reader@example.org",
            "sender:<noreply@example.org>"],
   nottokens: ["skip:h 20", "received:<someone@example"]
  }

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
    startCommand();
  },

  onMessageTraitDetails: function(aMsgURI, aProTrait, {}, aTokenString,
                                  aTokenPercents, aRunningPercents)
  {
    print("Details for " + aMsgURI);
    for (var i = 0; i < aTokenString.length; i++)
      print("Token " + aTokenString[i]);

    // we should have these tokens
    for each (var value in gTest.tokens)
    {
      print("We should have '" + value + "'? ");
      do_check_true(aTokenString.indexOf(value) >= 0);
    }

    // should not have these tokens
    for each (var value in gTest.nottokens)
    {
      print("We should not have '" + value + "'? ");
      do_check_true(aTokenString.indexOf(value) < 0);
    }
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
  //print("StartCommand command = " + gTest.command + ", remaining tests " + tests.length);
  switch (gTest.command)
  {
    case kTrain:
      // train message

      nsIJunkMailPlugin.setMsgTraitClassification(
        getSpec(gTest.fileName), //in string aMsgURI
        0,
        null,         // in nsIArray aOldTraits
        kProArray.length,
        kProArray,     // in nsIArray aNewTraits
        listener);    // [optional] in nsIMsgTraitClassificationListener aTraitListener
        // null,      // [optional] in nsIMsgWindow aMsgWindow
        // null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
      break;

    case kTest:
      // test headers from detail message
      nsIJunkMailPlugin.detailMessage(
        getSpec(gTest.fileName), // in string aMsgURI
        kProArray[0], // proTrait
        kAntiArray[0],   // antiTrait
        listener);   // in nsIMsgTraitDetailListener aDetailListener
      break;

    case kSetup:
      gTest.operation();
      startCommand();
      break;

  }
}
