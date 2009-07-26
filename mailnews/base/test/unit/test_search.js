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
 * David Bienvenu <bienvenu@nventure.com>.
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
 * Testing of general mail search features.
 *
 * This tests some search attributes not tested by other specific tests,
 * e.g., test_searchTag.js or test_searchJunk.js
 */
load("../../mailnews/resources/searchTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const Isnt = nsMsgSearchOp.Isnt;
const Is = nsMsgSearchOp.Is;
const IsEmpty = nsMsgSearchOp.IsEmpty;
const IsntEmpty = nsMsgSearchOp.IsntEmpty;
const Contains = nsMsgSearchOp.Contains;
const DoesntContain = nsMsgSearchOp.DoesntContain;
const BeginsWith = nsMsgSearchOp.BeginsWith;
const EndsWith = nsMsgSearchOp.EndsWith;
const IsBefore = nsMsgSearchOp.IsBefore; // control entry not enabled

const offlineMail = nsMsgSearchScope.offlineMail;
const onlineMail = nsMsgSearchScope.onlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;
const onlineMailFilter = nsMsgSearchScope.onlineMailFilter;
const news = nsMsgSearchScope.news; // control entry not enabled

const OtherHeader = nsMsgSearchAttrib.OtherHeader;
const From = nsMsgSearchAttrib.Sender;

var Tests =
[
  // test the To: header
  { testString: "PrimaryEmail1@test.invalid",
    testAttribute: From,
    op: Is,
    count: 1 },
  { testString: "PrimaryEmail1@test.invalid",
    testAttribute: From,
    op: Isnt,
    count: 0 },
  { testString: "PrimaryEmail",
    testAttribute: From,
    op: BeginsWith,
    count: 1 },
  { testString: "invalid",
    testAttribute: From,
    op: BeginsWith,
    count: 0 },
  { testString: "invalid",
    testAttribute: From,
    op: EndsWith,
    count: 1},
  { testString: "Primary",
    testAttribute: From,
    op: EndsWith,
    count: 0},
  { testString: "QAContact",
    testAttribute: OtherHeader,
    op: BeginsWith,
    count: 1},
  { testString: "filters",
    testAttribute: OtherHeader,
    op: BeginsWith,
    count: 0},
  { testString: "mail.bugs",
    testAttribute: OtherHeader,
    op: EndsWith,
    count: 1},
  { testString: "QAContact",
    testAttribute: OtherHeader,
    op: EndsWith,
    count: 0},
  { testString: "QAcontact filters@mail.bugs",
    testAttribute: OtherHeader,
    op: Is,
    count: 1},
  { testString: "filters@mail.bugs",
    testAttribute: OtherHeader,
    op: Is,
    count: 0},
  { testString: "QAcontact filters@mail.bugs",
    testAttribute: OtherHeader,
    op: Isnt,
    count: 0},
  { testString: "QAcontact",
    testAttribute: OtherHeader,
    op: Isnt,
    count: 1},
  { testString: "filters",
    testAttribute: OtherHeader,
    op: Contains,
    count: 1},
  { testString: "foobar",
    testAttribute: OtherHeader,
    op: Contains,
    count: 0},
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
    testObject = new TestSearch(gLocalInboxFolder,
                         test.testString,
                         test.testAttribute,
                         test.op,
                         test.count,
                         testSearch,
                         null,
                         "X-Bugzilla-Watch-Reason");
  }
  else
  {
    testObject = null;
    do_test_finished();
  }
}

