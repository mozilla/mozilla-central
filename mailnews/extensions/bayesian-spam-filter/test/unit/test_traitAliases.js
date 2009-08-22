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

// Tests bayes trait analysis with aliases. Adapted from test_traits.js

/*
 * These tests rely on data stored in a file, with the same format as traits.dat,
 * that was trained in the following manner. There are two training messages,
 * included here as files aliases1.eml and aliases2.eml  Aliases.dat was trained on
 * each of these messages, for different trait indices, as follows, with
 * columns showing the training count for each trait index:
 *
 *     file   count(1001)  count(1005) count(1007) count(1009)
 *
 *   aliases1.eml      1            0           2           0
 *   aliases2.eml      0            1           0           1
 *
 * There is also a third email file, aliases3.eml, which combines tokens
 * from aliases1.eml and aliases2.eml
 *
 * The goal here is to demonstrate that traits 1001 and 1007, and traits
 * 1005 and 1009, can be combined using aliases. We classify messages with
 * trait 1001 as the PRO trait, and 1005 as the ANTI trait.
 *
 * With these characteristics, I've run a trait analysis without aliases, and
 * determined that the following is the correct percentage results from the
 * analysis for each message. "Train11" means that the training was 1 pro count
 * from aliases1.eml, and 1 anti count from alias2.eml. "Train32" is 3 pro counts,
 * and 2 anti counts.
 *
 *                 percentage
 *    file         Train11       Train32
 *
 * alias1.eml        92             98
 * alias2.eml         8              3
 * alias3.eml        50             53
 */

const nsIJunkMailPlugin =
    Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
      .getService(Ci.nsIJunkMailPlugin);
const traitService = Cc["@mozilla.org/msg-trait-service;1"]
                       .getService(Ci.nsIMsgTraitService);
const kProTrait = 1001;
const kAntiTrait = 1005;
const kProAlias = 1007;
const kAntiAlias = 1009;

var gTest; // currently active test

// The tests array defines the tests to attempt. Format of
// an element "test" of this array:
//
//   test.fileName: file containing message to test
//   test.proAliases: array of aliases for the pro trait
//   test.antiAliases: array of aliases for the anti trait
//   test.percent: expected results from the classifier

var tests =
[
  {fileName: "aliases1.eml",
   proAliases: [],
   antiAliases: [],
   percent: 92
  },
  {fileName: "aliases2.eml",
   proAliases: [],
   antiAliases: [],
   percent: 8
  },
  {fileName: "aliases3.eml",
   proAliases: [],
   antiAliases: [],
   percent: 50
  },
  {fileName: "aliases1.eml",
   proAliases: [kProAlias],
   antiAliases: [kAntiAlias],
   percent: 98
  },
  {fileName: "aliases2.eml",
   proAliases: [kProAlias],
   antiAliases: [kAntiAlias],
   percent: 3
  },
  {fileName: "aliases3.eml",
   proAliases: [kProAlias],
   antiAliases: [kAntiAlias],
   percent: 53
  },
]

// main test
function run_test()
{
  loadLocalMailAccount();

  // load in the aliases trait testing file
  nsIJunkMailPlugin.QueryInterface(Ci.nsIMsgCorpus)
                   .updateData(do_get_file("resources/aliases.dat"), true);
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

    do_check_eq(aPercents[0], gTest.percent)
    // All done, start the next test
    startCommand();
  },
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

  // classify message
  var antiArray = [kAntiTrait];
  var proArray = [kProTrait];

  // remove any existing aliases
  let proAliases = traitService.getAliases(kProTrait, {});
  let antiAliases = traitService.getAliases(kAntiTrait, {});
  let proAlias;
  let antiAlias;
  while (proAlias = proAliases.pop())
    traitService.removeAlias(kProTrait, proAlias);
  while (antiAlias = antiAliases.pop())
    traitService.removeAlias(kAntiTrait, antiAlias);

  // add new aliases
  while (proAlias = gTest.proAliases.pop())
    traitService.addAlias(kProTrait, proAlias);
  while (antiAlias = gTest.antiAliases.pop())
    traitService.addAlias(kAntiTrait, antiAlias);
  
  nsIJunkMailPlugin.classifyTraitsInMessage(
    getSpec(gTest.fileName), // in string aMsgURI
    proArray.length, // length of traits arrays
    proArray,    // in array aProTraits,
    antiArray,   // in array aAntiTraits
    listener);   // in nsIMsgTraitClassificationListener aTraitListener
    //null,      // [optional] in nsIMsgWindow aMsgWindow
    //null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
}
