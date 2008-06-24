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

// tests return of junk percent from bayesian filter

// main setup

// only needed during debug
//do_import_script("mailnews/extensions/bayesian-spam-filter/test/resources/trainingfile.js");

const nsIJunkMailPlugin = Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                            .getService(Ci.nsIJunkMailPlugin);
const nsIIOService = Cc["@mozilla.org/network/io-service;1"]
                       .getService(Ci.nsIIOService);

// local constants
const kUnclassified = nsIJunkMailPlugin.UNCLASSIFIED;
const kJunk = nsIJunkMailPlugin.JUNK;
const kGood = nsIJunkMailPlugin.GOOD;

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
  loadLocalMailAccount();
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
    { nsIJunkMailPlugin.setMessageClassification(getSpec(email.fileName),
          kUnclassified, email.classification, null, doTestingListener);
      return;
    }

    // Have we completed a classification? If so, test
    if (haveClassification)
    {
      test = tests.shift();
      do_check_eq(getSpec(test.fileName), aMsgURI);
      do_check_eq(test.junkPercent, aJunkPercent);
    }

    // Do we have more classifications to do? Then classify the first one.
    if (tests.length)
    {
      haveClassification = true;
      nsIJunkMailPlugin.classifyMessage(getSpec(tests[0].fileName),
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
  var file = do_get_file("mailnews/extensions/bayesian-spam-filter/test/resources/" + aFileName);
  var uri = nsIIOService.newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
