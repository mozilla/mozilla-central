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

// This tests that we do not crash when loading the email bodySearchCrash,
// which was fixed in bug 465805

do_import_script("../mailnews/test/resources/searchTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"].
                      getService(Ci.nsIMsgCopyService);

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const Contains = nsMsgSearchOp.Contains;

const offlineMail = nsMsgSearchScope.offlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;

const Body = nsMsgSearchAttrib.Body;

var Files = 
[
  "../mailnews/test/data/bugmail1",
  "../mailnews/test/data/bodySearchCrash"
]

var Tests =
[

// this number appears in bugmail1
  { value: "432710",
    attrib: Body,
    op: Contains,
    count: 1 },
]

function run_test()
{
  // Setup local mail accounts.

  loadLocalMailAccount();

  // Get a message into the local filestore. function testBodySearch() continues the testing after the copy.
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
                              "", copyListener, null);
    }
    else
      testBodySearch();
  }
};

// Runs at completion of copy

// process each test from queue, calls itself upon completion of each search
var testObject;
function testBodySearch()
{
  print("Test Body Search");
  var test = Tests.shift();
  if (test)
  {
    testObject = new TestSearch(gLocalInboxFolder,
                         test.value,
                         test.attrib,
                         test.op,
                         test.count,
                         testBodySearch);
  }
  else
    do_test_finished();
}
