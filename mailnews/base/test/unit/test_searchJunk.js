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

// Testing of search by junk percent and junk score origin

load("../../mailnews/resources/searchTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const IsGreaterThan = nsMsgSearchOp.IsGreaterThan;
const IsLessThan = nsMsgSearchOp.IsLessThan;
const Is = nsMsgSearchOp.Is;
const Isnt = nsMsgSearchOp.Isnt;

const offlineMail = nsMsgSearchScope.offlineMail;

const JunkScoreOrigin = nsMsgSearchAttrib.JunkScoreOrigin;
const JunkPercent = nsMsgSearchAttrib.JunkPercent;

const fileName = "../../mailnews/data/bugmail1";

/*
 * The search for junkpercent is defined as the effective value,
 * while the "junkpercent" database term is always the result
 * from the bayes filter. This is optimized to make views that
 * rely on junk percent search work with the best value for junk
 * percent, while allowing junk percent from the bayes filter
 * to be saved for analysis.
 *
 * This means that the search for "junk percent" only uses the 
 * database junkpercent value if junkscoreorigin is "plugin".
 * Otherwise, it uses junkstatus (if set) or defaults to 0
 * (not junk) if the message is unclassified.
 */

var Tests = 
[
  // Use junkpercent from database
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "10",
    testValue: 90,
    attrib: JunkPercent,
    op: IsGreaterThan,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "10",
    testValue: 90,
    attrib: JunkPercent,
    op: IsLessThan,
    count: 1},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "10",
    testValue: 90,
    attrib: JunkPercent,
    op: Is,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "90",
    testValue: 10,
    attrib: JunkPercent,
    op: IsGreaterThan,
    count: 1},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "90",
    testValue: 10,
    attrib: JunkPercent,
    op: IsLessThan,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "10",
    testValue: 10,
    attrib: JunkPercent,
    op: Is,
    count: 1},
    
    // values set by user, use junkscore not junkpercent
  { junkScore: "0",
    junkScoreOrigin: "user",
    junkPercent: "90",
    testValue: 50,
    attrib: JunkPercent,
    op: IsGreaterThan,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "user",
    junkPercent: "90",
    testValue: 50,
    attrib: JunkPercent,
    op: IsLessThan,
    count: 1},
  { junkScore: "0",
    junkScoreOrigin: "user",
    junkPercent: "90",
    testValue: 50,
    attrib: JunkPercent,
    op: Is,
    count: 0},
  { junkScore: "100",
    junkScoreOrigin: "user",
    junkPercent: "10",
    testValue: 50,
    attrib: JunkPercent,
    op: IsGreaterThan,
    count: 1},
  { junkScore: "100",
    junkScoreOrigin: "user",
    junkPercent: "10",
    testValue: 50,
    attrib: JunkPercent,
    op: IsLessThan,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "user",
    junkPercent: "90",
    testValue: 0,
    attrib: JunkPercent,
    op: Is,
    count: 1},
    // default to 0 when nothing set
  { junkScore: "",
    junkScoreOrigin: "",
    junkPercent: "",
    testValue: 0,
    attrib: JunkPercent,
    op: Is,
    count: 1},
    
    // junkscoreorigin search tests
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "50",
    testValue: "plugin",
    attrib: JunkScoreOrigin,
    op: Is,
    count: 1},
  { junkScore: "0",
    junkScoreOrigin: "plugin",
    junkPercent: "50",
    testValue: "plugin",
    attrib: JunkScoreOrigin,
    op: Isnt,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "filter",
    junkPercent: "50",
    testValue: "plugin",
    attrib: JunkScoreOrigin,
    op: Is,
    count: 0},
  { junkScore: "0",
    junkScoreOrigin: "filter",
    junkPercent: "50",
    testValue: "plugin",
    attrib: JunkScoreOrigin,
    op: Isnt,
    count: 1},
];

function run_test()
{
  loadLocalMailAccount();
    
  // test that validity table terms are valid

  // offline mail table
  testValidityTable(offlineMail, Is, JunkPercent, true);
  testValidityTable(offlineMail, Isnt, JunkPercent, false);
  testValidityTable(offlineMail, IsGreaterThan, JunkPercent, true);
  testValidityTable(offlineMail, IsLessThan, JunkPercent, true);

  testValidityTable(offlineMail, Is, JunkScoreOrigin, true);
  testValidityTable(offlineMail, Isnt, JunkScoreOrigin, true);
  testValidityTable(offlineMail, IsGreaterThan, JunkScoreOrigin, false);
  testValidityTable(offlineMail, IsLessThan, JunkScoreOrigin, false);

  // Get a message into the local filestore. function testJunkSearch() continues the testing after the copy.
  do_test_pending();
  var file = do_get_file(fileName);
  copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
  return true;
}

var hdr;
var copyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) { hdr = gLocalInboxFolder.GetMessageHeader(aKey);},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) { testJunkSearch();}
};

// Runs at completion of each copy
// process each test from queue, calls itself upon completion of each search
var testObject;
function testJunkSearch()
{
  var test = Tests.shift();
  if (test)
  {
    hdr.setStringProperty("junkpercent", test.junkPercent);
    hdr.setStringProperty("junkscoreorigin", test.junkScoreOrigin);
    hdr.setStringProperty("junkscore", test.junkScore);

    testObject = new TestSearch(gLocalInboxFolder,
                         test.testValue,
                         test.attrib,
                         test.op,
                         test.count,
                         testJunkSearch);
  }
  else
  {
    testObject = null;
    hdr = null;
    do_test_finished();
  }
}
