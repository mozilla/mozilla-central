/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Testing of Uint32HdrProperty search attribute. Adapted from test_search.js
 */
 
load("../../../resources/searchTestUtils.js");

Components.utils.import("resource:///modules/mailServices.js");

const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const Isnt = nsMsgSearchOp.Isnt;
const Is = nsMsgSearchOp.Is;
const IsGreaterThan = nsMsgSearchOp.IsGreaterThan;
const IsLessThan = nsMsgSearchOp.IsLessThan;

const Uint32HdrProperty = nsMsgSearchAttrib.Uint32HdrProperty;

var Tests =
[
  // test a property that does not exist
  { hdrProperty: "idonotexist",
    op: Is,
    value: 1,
    count: 0 },
  { hdrProperty: "idonotexist",
    op: Isnt,
    value: 1,
    count: 1 },
  // add a property and test its value
  { setup: function setupProperty() {
      let enumerator = localAccountUtils.inboxFolder.msgDatabase.EnumerateMessages();
      while(enumerator.hasMoreElements())
        enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr).setUint32Property("iam23", 23);
    },
    hdrProperty: "iam23",
    op: Is,
    value: 23,
    count: 1 },
  { hdrProperty: "iam23",
    op: Isnt,
    value: 23,
    count: 0 },
  { hdrProperty: "iam23",
    op: Is,
    value: 17,
    count: 0 },
  { hdrProperty: "iam23",
    op: Isnt,
    value: 17,
    count: 1 },
  { hdrProperty: "iam23",
    op: IsGreaterThan,
    value: 25,
    count: 0 },
  { hdrProperty: "iam23",
    op: IsLessThan,
    value: 25,
    count: 1 },
  { hdrProperty: "iam23",
    op: IsGreaterThan,
    value: 17,
    count: 1 },
  { hdrProperty: "iam23",
    op: IsLessThan,
    value: 17,
    count: 0 },
];

function run_test()
{
  localAccountUtils.loadLocalMailAccount();

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) {},
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

// process each test from queue, calls itself upon completion of each search
var testObject;
function testSearch()
{
  var test = Tests.shift();
  if (test)
  {
    if (test.setup)
      test.setup();
    testObject = new TestSearch(localAccountUtils.inboxFolder,
                         test.value,
                         nsMsgSearchAttrib.Uint32HdrProperty,
                         test.op,
                         test.count,
                         testSearch,
                         null,
                         null,
                         test.hdrProperty);
  }
  else
  {
    testObject = null;
    do_test_finished();
  }
}
