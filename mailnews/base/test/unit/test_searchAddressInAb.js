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

// Testing of to, cc, toorcc in addressbook search features added in bug 187768

do_import_script("mailnews/test/resources/searchTestUtils.js");

// add address book setup
do_import_script("mailnews/addrbook/test/resources/abSetup.js");

const ABUri = kPABData.URI;

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"].
                      getService(Ci.nsIMsgCopyService);

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const IsntInAB = nsMsgSearchOp.IsntInAB;
const IsInAB = nsMsgSearchOp.IsInAB;
const IsBefore = nsMsgSearchOp.IsBefore; // control entry that is not enabled

const offlineMail = nsMsgSearchScope.offlineMail;
const onlineMail = nsMsgSearchScope.onlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;
const onlineMailFilter = nsMsgSearchScope.onlineMailFilter;
const news = nsMsgSearchScope.news; // control entry that is not enabled

const Sender = nsMsgSearchAttrib.Sender;
const To = nsMsgSearchAttrib.To;
const CCopy = nsMsgSearchAttrib.CC;
const ToOrCC = nsMsgSearchAttrib.ToOrCC;
const Keywords = nsMsgSearchAttrib.Keywords; // control entry that is not enabled

/*
 * The address available in the test address book is "PrimaryEmail1@test.invalid"
 * Test emails may also include the address "invalid@example.com"
 *
 * Map of test email contents: (P is "Prim...", I is "inva.." address)
 *
 *  Email      From       To      CC
 *    2         P         P       P
 *    3         I         P       I
 *    4         I         I       P
 *    5         P         I       P
 *    6         I         I,P     P,I
 *    7         I         I       I
 *
 */
 
var Tests =
[
  { value: ABUri,
    attrib: Sender,
    op: IsInAB,
    count: 2 },
  { value: ABUri,
    attrib: To,
    op: IsInAB,
    count: 3 },
  { value: ABUri,
    attrib: ToOrCC,
    op: IsInAB,
    count: 5 },
  { value: ABUri,
    attrib: CCopy,
    op: IsInAB,
    count: 4 },
  { value: ABUri,
    attrib: Sender,
    op: IsntInAB,
    count: 4 },
  { value: ABUri,
    attrib: To,
    op: IsntInAB,
    count: 4 },
  { value: ABUri,
    attrib: ToOrCC,
    op: IsntInAB,
    count: 5 },
  { value: ABUri,
    attrib: CCopy,
    op: IsntInAB,
    count: 3 },
];

var Files = 
[
  "mailnews/test/data/bugmail2",
  "mailnews/test/data/bugmail3",
  "mailnews/test/data/bugmail4",
  "mailnews/test/data/bugmail5",
  "mailnews/test/data/bugmail6",
  "mailnews/test/data/bugmail7"
]

var messageKey, hdr;

function run_test()
{
  // Setup local mail accounts.

  loadLocalMailAccount();
    
    // Test setup - copy the data file into place
  var testAB = do_get_file("mailnews/addrbook/test/unit/data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB
  testAB.copyTo(gProfileDir, kPABData.fileName);

  // test that validity table terms are valid

  // offline mail table
  testValidityTable(offlineMail, IsInAB, Sender, true);
  testValidityTable(offlineMail, IsInAB, To, true);
  testValidityTable(offlineMail, IsInAB, ToOrCC, true);
  testValidityTable(offlineMail, IsInAB, CCopy, true);
  testValidityTable(offlineMail, IsInAB, Keywords, false);
  testValidityTable(offlineMail, IsntInAB, Sender, true);
  testValidityTable(offlineMail, IsntInAB, To, true);
  testValidityTable(offlineMail, IsntInAB, ToOrCC, true);
  testValidityTable(offlineMail, IsntInAB, CCopy, true);
  testValidityTable(offlineMail, IsntInAB, Keywords, false);
  testValidityTable(offlineMail, IsBefore, Sender, false);
  testValidityTable(offlineMail, IsBefore, To, false);
  testValidityTable(offlineMail, IsBefore, ToOrCC, false);
  testValidityTable(offlineMail, IsBefore, CCopy, false);
  testValidityTable(offlineMail, IsBefore, Keywords, false);

  // offline mail filter table
  testValidityTable(offlineMailFilter, IsInAB, Sender, true);
  testValidityTable(offlineMailFilter, IsInAB, To, true);
  testValidityTable(offlineMailFilter, IsInAB, ToOrCC, true);
  testValidityTable(offlineMailFilter, IsInAB, CCopy, true);
  testValidityTable(offlineMailFilter, IsInAB, Keywords, false);
  testValidityTable(offlineMailFilter, IsntInAB, Sender, true);
  testValidityTable(offlineMailFilter, IsntInAB, To, true);
  testValidityTable(offlineMailFilter, IsntInAB, ToOrCC, true);
  testValidityTable(offlineMailFilter, IsntInAB, CCopy, true);
  testValidityTable(offlineMailFilter, IsntInAB, Keywords, false);
  testValidityTable(offlineMailFilter, IsBefore, Sender, false);
  testValidityTable(offlineMailFilter, IsBefore, To, false);
  testValidityTable(offlineMailFilter, IsBefore, ToOrCC, false);
  testValidityTable(offlineMailFilter, IsBefore, CCopy, false);
  testValidityTable(offlineMailFilter, IsBefore, Keywords, false);

  // online mail
  testValidityTable(onlineMail, IsInAB, Sender, false);
  testValidityTable(onlineMail, IsInAB, To, false);
  testValidityTable(onlineMail, IsInAB, ToOrCC, false);
  testValidityTable(onlineMail, IsInAB, CCopy, false);
  testValidityTable(onlineMail, IsInAB, Keywords, false);
  testValidityTable(onlineMail, IsntInAB, Sender, false);
  testValidityTable(onlineMail, IsntInAB, To, false);
  testValidityTable(onlineMail, IsntInAB, ToOrCC, false);
  testValidityTable(onlineMail, IsntInAB, CCopy, false);
  testValidityTable(onlineMail, IsntInAB, Keywords, false);
  testValidityTable(onlineMail, IsBefore, Sender, false);
  testValidityTable(onlineMail, IsBefore, To, false);
  testValidityTable(onlineMail, IsBefore, ToOrCC, false);
  testValidityTable(onlineMail, IsBefore, CCopy, false);
  testValidityTable(onlineMail, IsBefore, Keywords, false);

  // online mail filter  
  testValidityTable(onlineMailFilter, IsInAB, Sender, true);
  testValidityTable(onlineMailFilter, IsInAB, To, true);
  testValidityTable(onlineMailFilter, IsInAB, ToOrCC, true);
  testValidityTable(onlineMailFilter, IsInAB, CCopy, true);
  testValidityTable(onlineMailFilter, IsInAB, Keywords, false);
  testValidityTable(onlineMailFilter, IsntInAB, Sender, true);
  testValidityTable(onlineMailFilter, IsntInAB, To, true);
  testValidityTable(onlineMailFilter, IsntInAB, ToOrCC, true);
  testValidityTable(onlineMailFilter, IsntInAB, CCopy, true);
  testValidityTable(onlineMailFilter, IsntInAB, Keywords, false);
  testValidityTable(onlineMailFilter, IsBefore, Sender, false);
  testValidityTable(onlineMailFilter, IsBefore, To, false);
  testValidityTable(onlineMailFilter, IsBefore, ToOrCC, false);
  testValidityTable(onlineMailFilter, IsBefore, CCopy, false);
  testValidityTable(onlineMailFilter, IsBefore, Keywords, false);

  // news
  testValidityTable(news, IsInAB, Sender, false);
  testValidityTable(news, IsInAB, To, false);
  testValidityTable(news, IsInAB, ToOrCC, false);
  testValidityTable(news, IsInAB, CCopy, false);
  testValidityTable(news, IsInAB, Keywords, false);
  testValidityTable(news, IsntInAB, Sender, false);
  testValidityTable(news, IsntInAB, To, false);
  testValidityTable(news, IsntInAB, ToOrCC, false);
  testValidityTable(news, IsntInAB, CCopy, false);
  testValidityTable(news, IsntInAB, Keywords, false);
  testValidityTable(news, IsBefore, Sender, false);
  testValidityTable(news, IsBefore, To, false);
  testValidityTable(news, IsBefore, ToOrCC, false);
  testValidityTable(news, IsBefore, CCopy, false);
  testValidityTable(news, IsBefore, Keywords, false);

  // Get a message into the local filestore. function testAbSearch() continues the testing after the copy.
  do_test_pending();
  copyListener.OnStopCopy(null);
  return true;
}

var copyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) 
  {
    var fileName = Files.shift();
    if (fileName)
    { 
      var file = do_get_file(fileName);
      copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                              copyListener, null);
    }
    else
      testAbSearch();
  }
};

// Runs at completion of copy

// process each test from queue, calls itself upon completion of each search
var testObject;
function testAbSearch()
{
  print("Test AbSearch");
  var test = Tests.shift();
  if (test)
  {
    testObject = new TestSearch(gLocalInboxFolder,
                         test.value,
                         test.attrib,
                         test.op,
                         test.count,
                         testAbSearch);
  }
  else
    do_test_finished();
}
