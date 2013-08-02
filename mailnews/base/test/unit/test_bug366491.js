/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// tests return of junk percent from bayesian filter

// main setup

// only needed during debug
//do_import_script("mailnews/extensions/bayesian-spam-filter/test/resources/trainingfile.js");

Components.utils.import("resource:///modules/mailServices.js");

// local constants
const kUnclassified = MailServices.junk.UNCLASSIFIED;
const kJunk = MailServices.junk.JUNK;
const kGood = MailServices.junk.GOOD;

/*
 * This test is not intended to check the spam calculations,
 * but only that the junk percent is transmitted (particularly
 * for intermediate values). The test
 * junkPercent values below were calculated by the plugin,
 * not indepedently verified.
 */
 
var tests = 
[
  {fileName: "ham2.eml",
   junkPercent: 8},
  {fileName: "spam2.eml",
   junkPercent: 81},
];

var emails =
[
  {fileName: "ham1.eml",
   classification: kGood},
  {fileName: "spam1.eml",
   classification: kJunk},
];

// main test
function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  do_test_pending();
  doTestingListener.onMessageClassified(null, null, null);
  return true;
};

var haveClassification = false;
var doTestingListener = 
{
  onMessageClassified: function(aMsgURI, aClassification, aJunkPercent)
  {
    // Do we have more training emails? If so, train
    var email = emails.shift();
    if (email)
    {
      MailServices.junk.setMessageClassification(getSpec(email.fileName),
        kUnclassified, email.classification, null, doTestingListener);
      return;
    }

    if (!aMsgURI)
      return; // ignore end of batch

    // Have we completed a classification? If so, test
    if (haveClassification)
    {
      let test = tests.shift();
      do_check_eq(getSpec(test.fileName), aMsgURI);
      do_check_eq(test.junkPercent, aJunkPercent);
    }

    // Do we have more classifications to do? Then classify the first one.
    if (tests.length)
    {
      haveClassification = true;
      MailServices.junk.classifyMessage(getSpec(tests[0].fileName),
        null, doTestingListener);
      return;
    }

    else
      do_test_finished();
  }
};

// helper functions

function getSpec(aFileName)
{
  var file = do_get_file("../../../extensions/bayesian-spam-filter/test/unit/resources/" + aFileName);
  var uri = Services.io.newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
