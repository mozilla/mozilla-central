/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tests use of custom tokenization, originally introduced in bug 476389

Components.utils.import("resource:///modules/mailServices.js");

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
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.received", "standard");
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.message-id", "false");
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.body_delimiters", " \t\r\n\v");
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.sender", "full");
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
       Services.prefs.setIntPref("mailnews.bayesian_spam_filter.maxlengthfortoken", 50);
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.header_delimiters", " ;<>\t\r\n\v");
       Services.prefs.setCharPref("mailnews.bayesian_spam_filter.tokenizeheader.sender", " \t\r\n\v");
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
  localAccountUtils.loadLocalMailAccount();
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

      MailServices.junk.setMsgTraitClassification(
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
      MailServices.junk.detailMessage(
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
