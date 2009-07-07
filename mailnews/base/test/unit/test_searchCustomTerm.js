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
 * Testing of custom search features.
 *
 */
load("../../mailnews/resources/searchTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const kCustomId = "xpcomtest@mozilla.org#test";
var gHdr;

var Tests =
[
  { setValue: "iamgood",
    testValue: "iamnotgood",
    op: Ci.nsMsgSearchOp.Is,
    count: 0 },
  { setValue: "iamgood",
    testValue: "iamgood",
    op: Ci.nsMsgSearchOp.Is,
    count: 1 }
]

// nsIMsgSearchCustomTerm object
customTerm =
{
  id: kCustomId,
  name: "term name",
  getEnabled: function(scope, op)
    {
      return scope == Ci.nsMsgSearchScope.offlineMail &&
             op == Ci.nsMsgSearchOp::Is
    },
  getAvailable: function(scope, op)
    {
      return scope == Ci.nsMsgSearchScope.offlineMail &&
             op == Ci.nsMsgSearchOp::Is
    },
  getAvailableOperators: function(scope, length)
    {
       length.value = 1;
       return [Ci.nsMsgSearchOp.Is];
    },
  match: function(msgHdr, searchValue, searchOp)
    {
      switch (searchOp)
      {
        case Ci.nsMsgSearchOp.Is:
          if (msgHdr.getProperty("theTestProperty") == searchValue)
            return true;
      }
      return false;
    }
};

function run_test()
{
  loadLocalMailAccount();
  let filterService = Cc["@mozilla.org/messenger/services/filters;1"]
                        .getService(Ci.nsIMsgFilterService);
  filterService.addCustomTerm(customTerm);

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) { gHdr = gLocalInboxFolder.GetMessageHeader(aKey);},
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) { doTest();}
  };

  // Get a message into the local filestore.
  // function testSearch() continues the testing after the copy.
  let bugmail1 = do_get_file("../../mailnews/data/bugmail1");
  do_test_pending();

  copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
}

var testObject;

function doTest()
{
  let test = Tests.shift();
  if (test)
  {
    gHdr.setStringProperty("theTestProperty", test.setValue);
    testObject = new TestSearch(gLocalInboxFolder,
                         test.testValue,
                         Ci.nsMsgSearchAttrib.Custom,
                         test.op,
                         test.count,
                         doTest,
                         kCustomId);
  }
  else
  {
    testObject = null;
    gHdr = null;
    do_test_finished();
  }
}

