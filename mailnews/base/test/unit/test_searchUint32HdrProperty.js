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
 * Testing of Uint32HdrProperty search attribute. Adapted from test_search.js
 */
 
load("../../mailnews/resources/searchTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

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
      let enumerator = gLocalInboxFolder.msgDatabase.EnumerateMessages();
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
  loadLocalMailAccount();

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
  var bugmail1 = do_get_file("../../mailnews/data/bugmail1");
  do_test_pending();
  copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
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
    testObject = new TestSearch(gLocalInboxFolder,
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
