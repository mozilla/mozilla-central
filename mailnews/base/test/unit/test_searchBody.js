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
 * Joshua Cranmer <Pidgeot18@gmail.com>
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
 * This tests various body search criteria.
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
const IsBefore = nsMsgSearchOp.IsBefore; // control entry not enabled

const offlineMail = nsMsgSearchScope.offlineMail;
const onlineMail = nsMsgSearchScope.onlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;
const onlineMailFilter = nsMsgSearchScope.onlineMailFilter;
const news = nsMsgSearchScope.news; // control entry not enabled

const Body = nsMsgSearchAttrib.Body;

var Files =
[
  "../../mailnews/data/base64-1",
  "../../mailnews/data/basic1",
  "../../mailnews/data/multipart-base64-2",
  "../../mailnews/data/bug132340"
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
  if (str.substring(0, 5) == "From ") {
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
  targetFile.initWithFile(gProfileDir);
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
      copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
    }
    else
      testBodySearch();
  }
};

function run_test()
{
  loadLocalMailAccount();

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
    testObject = new TestSearch(gLocalInboxFolder,
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

