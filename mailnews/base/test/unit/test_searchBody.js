/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This tests various body search criteria.
 */
load("../../../resources/searchTestUtils.js");

Components.utils.import("resource:///modules/mailServices.js");

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const Isnt = nsMsgSearchOp.Isnt;
const Is = nsMsgSearchOp.Is;
const IsEmpty = nsMsgSearchOp.IsEmpty;
const IsntEmpty = nsMsgSearchOp.IsntEmpty;
const Contains = nsMsgSearchOp.Contains;
const DoesntContain = nsMsgSearchOp.DoesntContain;
const IsBefore = nsMsgSearchOp.IsBefore; // control entry not enabled

const offlineMail = nsMsgSearchScope.offlineMail;
const onlineMail = nsMsgSearchScope.onlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;
const onlineMailFilter = nsMsgSearchScope.onlineMailFilter;
const news = nsMsgSearchScope.news; // control entry not enabled

const Body = nsMsgSearchAttrib.Body;

var Files =
[
  "../../../data/base64-1",
  "../../../data/basic1",
  "../../../data/multipart-base64-2",
  "../../../data/bug132340"
]
var Tests =
[
  /* Translate Base64 messages */
  { value: "World!",
    op: Contains,
    count: 2 },
  /* Don't match the base64 text */
  { value: "DQp",
    op: Contains,
    count: 0 },
  /* Nested multipart/mixed, don't match */
  { value: "PGh",
    op: Contains,
    count: 0 },
  /* An encoded base-64 text/plain match */
  { value: "base 64 text",
    op: Contains,
    count: 1 },
];

function fixFile(file) {
  var fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                  .createInstance(Ci.nsIFileInputStream);
  fstream.init(file, -1, -1, Ci.nsIFileInputStream.CLOSE_ON_EOF);
  var sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                  .createInstance(Ci.nsIScriptableInputStream);
  sstream.init(fstream);

  var str = sstream.read(4096);
  if (str.startsWith("From ")) {
    sstream.close();
    fstream.close();
    return file;
  }
  var data = "From - Tue Oct 02 00:26:47 2007\r\n";
  do {
    data += str;
    str = sstream.read(4096);
  } while (str.length > 0);

  sstream.close();
  fstream.close();

  let targetFile = Cc["@mozilla.org/file/local;1"]
                     .createInstance(Ci.nsILocalFile);
  targetFile.initWithFile(do_get_profile());
  targetFile.append(file.leafName);
  let ostream = Cc["@mozilla.org/network/file-output-stream;1"]
                  .createInstance(Ci.nsIFileOutputStream);
  ostream.init(targetFile, -1, -1, 0);
  ostream.write(data, data.length);
  ostream.close();
  return targetFile;
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
      var file = fixFile(do_get_file(fileName));
      MailServices.copy.CopyFileMessage(file, localAccountUtils.inboxFolder, null,
                                        false, 0, "", copyListener, null);
    }
    else
      testBodySearch();
  }
};

function run_test()
{
  localAccountUtils.loadLocalMailAccount();

  // test that validity table terms are valid

  // offline mail table
  testValidityTable(offlineMail, Contains, Body, true);
  testValidityTable(offlineMail, DoesntContain, Body, true);
  testValidityTable(offlineMail, Is, Body, true);
  testValidityTable(offlineMail, Isnt, Body, true);
  testValidityTable(offlineMail, IsEmpty, Body, false);
  testValidityTable(offlineMail, IsntEmpty, Body, false);
  testValidityTable(offlineMail, IsBefore, Body, false);

  // offline mail filter table
  testValidityTable(offlineMailFilter, Contains, Body, true);
  testValidityTable(offlineMailFilter, DoesntContain, Body, true);
  testValidityTable(offlineMailFilter, Is, Body, true);
  testValidityTable(offlineMailFilter, Isnt, Body, true);
  testValidityTable(offlineMailFilter, IsEmpty, Body, false);
  testValidityTable(offlineMailFilter, IsntEmpty, Body, false);
  testValidityTable(offlineMailFilter, IsBefore, Body, false);

  // online mail
  testValidityTable(onlineMail, Contains, Body, true);
  testValidityTable(onlineMail, DoesntContain, Body, true);
  testValidityTable(onlineMail, Is, Body, false);
  testValidityTable(onlineMail, Isnt, Body, false);
  testValidityTable(onlineMail, IsEmpty, Body, false);
  testValidityTable(onlineMail, IsntEmpty, Body, false);
  testValidityTable(onlineMail, IsBefore, Body, false);

  // online mail filter  
  /*testValidityTable(onlineMailFilter, Contains, Body, true);
  testValidityTable(onlineMailFilter, DoesntContain, Body, true);
  testValidityTable(onlineMailFilter, Is, Body, false);
  testValidityTable(onlineMailFilter, Isnt, Body, false);
  testValidityTable(onlineMailFilter, IsEmpty, Body, false);
  testValidityTable(onlineMailFilter, IsntEmpty, Body, false);
  testValidityTable(onlineMailFilter, IsBefore, Body, false);*/

  // News does not support body tests
  testValidityTable(news, Contains, Body, false);
  testValidityTable(news, DoesntContain, Body, false);
  testValidityTable(news, Is, Body, false);
  testValidityTable(news, Isnt, Body, false);
  testValidityTable(news, IsEmpty, Body, false);
  testValidityTable(news, IsntEmpty, Body, false);
  testValidityTable(news, IsBefore, Body, false);

  do_test_pending();
  copyListener.OnStopCopy(null);
}

// process each test from queue, calls itself upon completion of each search
var testObject;
function testBodySearch()
{
  var test = Tests.shift();
  if (test)
  {
    testObject = new TestSearch(localAccountUtils.inboxFolder,
                         test.value,
                         Body,
                         test.op,
                         test.count,
                         testBodySearch);
  }
  else
  {
    testObject = null;
    do_test_finished();
  }
}

