/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Testing of to, cc, toorcc in addressbook search features added in bug 187768
// Added testing of AllAddresses from bug 310359

load("../../../resources/searchTestUtils.js");

// add address book setup
load("../../../resources/abSetup.js");

Components.utils.import("resource:///modules/mailServices.js");

const ABUri = kPABData.URI;

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
const AllAddresses = nsMsgSearchAttrib.AllAddresses;
const Keywords = nsMsgSearchAttrib.Keywords; // control entry that is not enabled

/*
 * The address available in the test address book is "PrimaryEmail1@test.invalid"
 * Test emails may also include the address "invalid@example.com"
 *
 *
 * Map of test email contents: (P is "Prim...", I is "inva.." address, N is none)
 *
 *
 *  Email      From       To      CC    BCC
 *    1         P         I       I     N
 *    2         P         P       P     N
 *    3         I         P       I     N
 *    4         I         I       P     N
 *    5         P         I       P     N
 *    6         I         I,P     P,I   N
 *    7         I         I       I     P
 *    8         I         P       P     N
 *
 */
 
var Tests =
[
  { value: ABUri,
    attrib: Sender,
    op: IsInAB,
    count: 3 },
  { value: ABUri,
    attrib: To,
    op: IsInAB,
    count: 4 },
  { value: ABUri,
    attrib: ToOrCC,
    op: IsInAB,
    count: 6 },
  { value: ABUri,
    attrib: AllAddresses,
    op: IsInAB,
    count: 8 },
  { value: ABUri,
    attrib: CCopy,
    op: IsInAB,
    count: 5 },
  { value: ABUri,
    attrib: Sender,
    op: IsntInAB,
    count: 5 },
  { value: ABUri,
    attrib: To,
    op: IsntInAB,
    count: 5 },
  { value: ABUri,
    attrib: ToOrCC,
    op: IsntInAB,
    count: 6 },
  { value: ABUri,
    attrib: AllAddresses,
    op: IsntInAB,
    count: 7 },
  { value: ABUri,
    attrib: CCopy,
    op: IsntInAB,
    count: 4 },
];

var Files = 
[
  "../../../data/bugmail1",
  "../../../data/bugmail2",
  "../../../data/bugmail3",
  "../../../data/bugmail4",
  "../../../data/bugmail5",
  "../../../data/bugmail6",
  "../../../data/bugmail7",
  "../../../data/bugmail8"
]

var messageKey, hdr;

function run_test()
{
  // Setup local mail accounts.
  localAccountUtils.loadLocalMailAccount();
    
    // Test setup - copy the data file into place
  var testAB = do_get_file("../../../addrbook/test/unit/data/cardForEmail.mab");

  // Copy the file to the profile directory for a PAB
  testAB.copyTo(do_get_profile(), kPABData.fileName);

  // test that validity table terms are valid

  // offline mail table
  testValidityTable(offlineMail, IsInAB, Sender, true);
  testValidityTable(offlineMail, IsInAB, To, true);
  testValidityTable(offlineMail, IsInAB, ToOrCC, true);
  testValidityTable(offlineMail, IsInAB, AllAddresses, true);
  testValidityTable(offlineMail, IsInAB, CCopy, true);
  testValidityTable(offlineMail, IsInAB, Keywords, false);
  testValidityTable(offlineMail, IsntInAB, Sender, true);
  testValidityTable(offlineMail, IsntInAB, To, true);
  testValidityTable(offlineMail, IsntInAB, ToOrCC, true);
  testValidityTable(offlineMail, IsntInAB, AllAddresses, true);
  testValidityTable(offlineMail, IsntInAB, CCopy, true);
  testValidityTable(offlineMail, IsntInAB, Keywords, false);
  testValidityTable(offlineMail, IsBefore, Sender, false);
  testValidityTable(offlineMail, IsBefore, To, false);
  testValidityTable(offlineMail, IsBefore, ToOrCC, false);
  testValidityTable(offlineMail, IsBefore, AllAddresses, false);
  testValidityTable(offlineMail, IsBefore, CCopy, false);
  testValidityTable(offlineMail, IsBefore, Keywords, false);

  // offline mail filter table
  testValidityTable(offlineMailFilter, IsInAB, Sender, true);
  testValidityTable(offlineMailFilter, IsInAB, To, true);
  testValidityTable(offlineMailFilter, IsInAB, ToOrCC, true);
  testValidityTable(offlineMailFilter, IsInAB, AllAddresses, true);
  testValidityTable(offlineMailFilter, IsInAB, CCopy, true);
  testValidityTable(offlineMailFilter, IsInAB, Keywords, false);
  testValidityTable(offlineMailFilter, IsntInAB, Sender, true);
  testValidityTable(offlineMailFilter, IsntInAB, To, true);
  testValidityTable(offlineMailFilter, IsntInAB, AllAddresses, true);
  testValidityTable(offlineMailFilter, IsntInAB, ToOrCC, true);
  testValidityTable(offlineMailFilter, IsntInAB, CCopy, true);
  testValidityTable(offlineMailFilter, IsntInAB, Keywords, false);
  testValidityTable(offlineMailFilter, IsBefore, Sender, false);
  testValidityTable(offlineMailFilter, IsBefore, To, false);
  testValidityTable(offlineMailFilter, IsBefore, ToOrCC, false);
  testValidityTable(offlineMailFilter, IsBefore, AllAddresses, false);
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
      MailServices.copy.CopyFileMessage(file, localAccountUtils.inboxFolder, null,
                                        false, 0, "", copyListener, null);
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
    testObject = new TestSearch(localAccountUtils.inboxFolder,
                         test.value,
                         test.attrib,
                         test.op,
                         test.count,
                         testAbSearch);
  }
  else
    do_test_finished();
}
