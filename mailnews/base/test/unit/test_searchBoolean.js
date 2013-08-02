/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Demonstrates and tests the use of grouped boolean expressions in search terms
 */
 
Components.utils.import("resource:///modules/mailServices.js");

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
  localAccountUtils.loadLocalMailAccount();

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

  gSearchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail,
                              localAccountUtils.inboxFolder);
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
    SetMessageKey: function(aKey) {
      gHdr = localAccountUtils.inboxFolder.GetMessageHeader(aKey);
    },
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) { testSearch();}
  };

  // Get a message into the local filestore. function testSearch() continues
  // the testing after the copy.
  var bugmail1 = do_get_file("../../../data/bugmail1");
  do_test_pending();
  MailServices.copy.CopyFileMessage(bugmail1, localAccountUtils.inboxFolder, null,
                                    false, 0, "", copyListener, null);
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
    gSearchSession.unregisterListener(searchListener);
    do_test_finished();
  }
}
