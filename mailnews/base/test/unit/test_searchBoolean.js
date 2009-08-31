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
 * The Original Code is mozilla.org code
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>
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

/*
 * Demonstrates and tests the use of grouped boolean expressions in search terms
 */
 
const gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const gSearchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);

let gHdr; // the message header for the one mailbox message

var Tests =
[
  { A: false,
    B: false,
    C: false,
    D: false,
    matches: false},
  { A: false,
    B: false,
    C: false,
    D: true,
    matches: false},
  { A: false,
    B: false,
    C: true,
    D: false,
    matches: false},
  { A: false,
    B: false,
    C: true,
    D: true,
    matches: false},
  { A: false,
    B: true,
    C: false,
    D: false,
    matches: false},
  { A: false,
    B: true,
    C: false,
    D: true,
    matches: true},
  { A: false,
    B: true,
    C: true,
    D: false,
    matches: true},
  { A: false,
    B: true,
    C: true,
    D: true,
    matches: true},
  { A: true,
    B: false,
    C: false,
    D: false,
    matches: false},
  { A: true,
    B: false,
    C: false,
    D: true,
    matches: true},
  { A: true,
    B: false,
    C: true,
    D: false,
    matches: true},
  { A: true,
    B: false,
    C: true,
    D: true,
    matches: true},
  { A: true,
    B: true,
    C: false,
    D: false,
    matches: false},
  { A: true,
    B: true,
    C: false,
    D: true,
    matches: true},
  { A: true,
    B: true,
    C: true,
    D: false,
    matches: true},
  { A: true,
    B: true,
    C: true,
    D: true,
    matches: true},
];

var gHitCount = 0;
var searchListener =
{ 
  onSearchHit: function(dbHdr, folder) { gHitCount++; },
  onSearchDone: function(status)
  { 
    testSearch();
  },
  onNewSearch: function() {gHitCount = 0;}
};

function run_test()
{
  loadLocalMailAccount();

  /*
   * I want to create and test a search term that uses this expression:
   *   (A || B ) && (C || D)
   *
   * The logical expressions A, B, C, and D will be represented by header
   * string properties with values of T (true) or F (false).
   *
   */

  // add a search term HdrProperty (some string) Is "T", with grouping
  function addSearchTerm(aHdrProperty, aBeginGrouping, aEndGrouping, aBoolAnd) {
    let searchTerm = gSearchSession.createTerm();
    searchTerm.attrib = Ci.nsMsgSearchAttrib.HdrProperty;

    let value = searchTerm.value;
    // This is tricky - value.attrib must be set before actual values
    value.attrib = Ci.nsMsgSearchAttrib.HdrProperty;
    value.str = "T";
    searchTerm.value = value;

    searchTerm.op = Ci.nsMsgSearchOp.Is;
    searchTerm.booleanAnd = aBoolAnd;
    searchTerm.beginsGrouping = aBeginGrouping;
    searchTerm.endsGrouping = aEndGrouping;
    searchTerm.hdrProperty = aHdrProperty;
    gSearchSession.appendTerm(searchTerm);
  }

  gSearchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, gLocalInboxFolder);
  gSearchSession.registerListener(searchListener);
  // I tried using capital "A" but something makes it lower case internally, so it failed
  addSearchTerm("a", true, false, true);  // "(A"
  addSearchTerm("b", false, true, false); // " || B)"
  addSearchTerm("c", true, false, true);  // " && (C"
  addSearchTerm("d", false, true, false); // " || D)"

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) { gHdr = gLocalInboxFolder.GetMessageHeader(aKey);},
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) { testSearch();}
  };

  // Get a message into the local filestore. function testSearch() continues
  // the testing after the copy.
  var bugmail1 = do_get_file("../../mailnews/data/bugmail1");
  do_test_pending();
  gCopyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
}

let gTest = null;
// process each test from queue, calls itself upon completion of each search
function testSearch()
{
  // tests the previous search
  if (gTest)
    do_check_eq(gHitCount, gTest.matches ? 1 : 0);
  gTest = Tests.shift();
  if (gTest)
  {
    gHdr.setStringProperty("a", gTest.A ? "T" : "F");
    gHdr.setStringProperty("b", gTest.B ? "T" : "F");
    gHdr.setStringProperty("c", gTest.C ? "T" : "F");
    gHdr.setStringProperty("d", gTest.D ? "T" : "F");
    try {
      gSearchSession.search(null);
    }
    catch (e) {dump(e);}
  }
  else
  {
    gSearchSession = null;
    do_test_finished();
  }
}
