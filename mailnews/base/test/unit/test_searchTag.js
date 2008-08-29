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

/*
 * Testing of tag search features.
 *
 * Specifically tests changes implemented in bug 217034
 * Does not do comprehensive testing.
 *
 */
do_import_script("../mailnews/test/resources/searchTestUtils.js");

const tagService = Cc["@mozilla.org/messenger/tagservice;1"]
                     .getService(Ci.nsIMsgTagService);
const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp = Ci.nsMsgSearchOp;

const Isnt = nsMsgSearchOp.Isnt;
const Is = nsMsgSearchOp.Is;
const IsEmpty = nsMsgSearchOp.IsEmpty;
const Contains = nsMsgSearchOp.Contains;
const DoesntContain = nsMsgSearchOp.DoesntContain;
const IsBefore = nsMsgSearchOp.IsBefore; // control entry not enabled

const offlineMail = nsMsgSearchScope.offlineMail;
const onlineMail = nsMsgSearchScope.onlineMail;
const offlineMailFilter = nsMsgSearchScope.offlineMailFilter;
const onlineMailFilter = nsMsgSearchScope.onlineMailFilter;
const news = nsMsgSearchScope.news; // control entry not enabled

const Keywords = nsMsgSearchAttrib.Keywords;

// test tags
const Tag1 = "istag";
const Tag2 = "notistag";
const Tag3 = "istagnot";
const Tag4 = "istagtoo";
const Tag1Tag4 = Tag1 + " " + Tag4;
const Tag1Tag3 = Tag1 + " " + Tag3;
const Tag1Tag1 = Tag1 + " " + Tag1;

var Tests =
[
// Message has a single valid tag
  // test the valid tag
  { msgTag: Tag1,
    testTag: Tag1,
    op: Is,
    count: 1 },
  { msgTag: Tag1,
    testTag: Tag1,
    op: Isnt,
    count: 0 }, 
  { msgTag: Tag1,
    testTag: Tag1,
    op: Contains,
    count: 1 },
  { msgTag: Tag1,
    testTag: Tag1,
    op: DoesntContain,
    count: 0 },
  { msgTag: Tag1,
    testTag: Tag1,
    op: IsEmpty,
    count: 0 },
  //test an invalid tag, should act like empty
  { msgTag: Tag2,
    testTag: Tag1,
    op: Contains,
    count: 0 },
  { msgTag: Tag2,
    testTag: Tag1,
    op: DoesntContain,
    count: 1 },
  { msgTag: Tag2,
    testTag: Tag1,
    op: Is,
    count: 0 },
  { msgTag: Tag2,
    testTag: Tag1,
    op: Isnt,
    count: 1 },
  { msgTag: Tag2,
    testTag: Tag1,
    op: IsEmpty,
    count: 1 },
//   Message has two valid tags
  // test first tag
  { msgTag: Tag1Tag4,
    testTag: Tag1,
    op: Is,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag1,
    op: Isnt,
    count: 1 }, 
  { msgTag: Tag1Tag4,
    testTag: Tag1,
    op: Contains,
    count: 1 },
  { msgTag: Tag1Tag4,
    testTag: Tag1,
    op: DoesntContain,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag1,
    op: IsEmpty,
    count: 0 },
  // test second tag
  { msgTag: Tag1Tag4,
    testTag: Tag4,
    op: Is,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag4,
    op: Isnt,
    count: 1 }, 
  { msgTag: Tag1Tag4,
    testTag: Tag4,
    op: Contains,
    count: 1 },
  { msgTag: Tag1Tag4,
    testTag: Tag4,
    op: DoesntContain,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag4,
    op: IsEmpty,
    count: 0 },
  // test tag not in message
  { msgTag: Tag1Tag4,
    testTag: Tag2,
    op: Is,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag2,
    op: Isnt,
    count: 1 }, 
  { msgTag: Tag1Tag4,
    testTag: Tag2,
    op: Contains,
    count: 0 },
  { msgTag: Tag1Tag4,
    testTag: Tag2,
    op: DoesntContain,
    count: 1 },
  { msgTag: Tag1Tag4,
    testTag: Tag2,
    op: IsEmpty,
    count: 0 },
  // empty message
  { msgTag: "",
    testTag: Tag2,
    op: Is,
    count: 0 },
  { msgTag: "",
    testTag: Tag2,
    op: Isnt,
    count: 1 }, 
  { msgTag: "",
    testTag: Tag2,
    op: Contains,
    count: 0 },
  { msgTag: "",
    testTag: Tag2,
    op: DoesntContain,
    count: 1 },
  { msgTag: "",
    testTag: Tag2,
    op: IsEmpty,
    count: 1 },
// message with two tags, only one is valid
  // test with the single valid tag  
  { msgTag: Tag1Tag3,
    testTag: Tag1,
    op: Is,
    count: 1 },
  { msgTag: Tag1Tag3,
    testTag: Tag1,
    op: Isnt,
    count: 0 },
  { msgTag: Tag1Tag3,
    testTag: Tag1,
    op: Contains,
    count: 1 },
  { msgTag: Tag1Tag3,
    testTag: Tag1,
    op: DoesntContain,
    count: 0 },
  { msgTag: Tag1Tag3,
    testTag: Tag1,
    op: IsEmpty,
    count: 0 },
  // test with a tag not in the message  
  { msgTag: Tag1Tag3,
    testTag: Tag2,
    op: Is,
    count: 0 },
  { msgTag: Tag1Tag3,
    testTag: Tag2,
    op: Isnt,
    count: 1 },
  { msgTag: Tag1Tag3,
    testTag: Tag2,
    op: Contains,
    count: 0 },
  { msgTag: Tag1Tag3,
    testTag: Tag2,
    op: DoesntContain,
    count: 1 },
  { msgTag: Tag1Tag3,
    testTag: Tag2,
    op: IsEmpty,
    count: 0 },
//   Message has a duplicated tag
  // test the tag
  { msgTag: Tag1Tag1,
    testTag: Tag1,
    op: Is,
    count: 1 },
  { msgTag: Tag1Tag1,
    testTag: Tag1,
    op: Isnt,
    count: 0 }, 
  { msgTag: Tag1Tag1,
    testTag: Tag1,
    op: Contains,
    count: 1 },
  { msgTag: Tag1Tag1,
    testTag: Tag1,
    op: DoesntContain,
    count: 0 },
  { msgTag: Tag1Tag1,
    testTag: Tag1,
    op: IsEmpty,
    count: 0 },

];

var hdr;

function run_test()
{
  loadLocalMailAccount();

  // test that validity table terms are valid

  // offline mail table
  testValidityTable(offlineMail, Contains, Keywords, true);
  testValidityTable(offlineMail, DoesntContain, Keywords, true);
  testValidityTable(offlineMail, Is, Keywords, true);
  testValidityTable(offlineMail, Isnt, Keywords, true);
  testValidityTable(offlineMail, IsEmpty, Keywords, true);
  testValidityTable(offlineMail, IsBefore, Keywords, false);

  // offline mail filter table
  testValidityTable(offlineMailFilter, Contains, Keywords, true);
  testValidityTable(offlineMailFilter, DoesntContain, Keywords, true);
  testValidityTable(offlineMailFilter, Is, Keywords, true);
  testValidityTable(offlineMailFilter, Isnt, Keywords, true);
  testValidityTable(offlineMailFilter, IsEmpty, Keywords, true);
  testValidityTable(offlineMailFilter, IsBefore, Keywords, false);

  // online mail
  testValidityTable(onlineMail, Contains, Keywords, true);
  testValidityTable(onlineMail, DoesntContain, Keywords, true);
  testValidityTable(onlineMail, Is, Keywords, false);
  testValidityTable(onlineMail, Isnt, Keywords, false);
  testValidityTable(onlineMail, IsEmpty, Keywords, false);
  testValidityTable(onlineMail, IsBefore, Keywords, false);

  // online mail filter  
  testValidityTable(onlineMailFilter, Contains, Keywords, true);
  testValidityTable(onlineMailFilter, DoesntContain, Keywords, true);
  testValidityTable(onlineMailFilter, Is, Keywords, true);
  testValidityTable(onlineMailFilter, Isnt, Keywords, true);
  testValidityTable(onlineMailFilter, IsEmpty, Keywords, true);
  testValidityTable(onlineMailFilter, IsBefore, Keywords, false);

  // news
  testValidityTable(news, Contains, Keywords, false);
  testValidityTable(news, DoesntContain, Keywords, false);
  testValidityTable(news, Is, Keywords, false);
  testValidityTable(news, Isnt, Keywords, false);
  testValidityTable(news, IsEmpty, Keywords, false);
  testValidityTable(news, IsBefore, Keywords, false);

  // delete any existing tags
  var tagArray = tagService.getAllTags({});
  for (var i = 0; i < tagArray.length; i++)
    tagService.deleteKey(tagArray[i].key);

  // add as valid tags Tag1 and Tag4
  tagService.addTagForKey(Tag1, Tag1, null, null);
  tagService.addTagForKey(Tag4, Tag4, null, null);

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) { hdr = gLocalInboxFolder.GetMessageHeader(aKey);},
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) { testKeywordSearch();}
  };

  // Get a message into the local filestore. function testKeywordSearch() continues the testing after the copy.
  var bugmail1 = do_get_file("../mailnews/test/data/bugmail1");
  do_test_pending();
  copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
}

// process each test from queue, calls itself upon completion of each search
var testObject;
function testKeywordSearch()
{
  var test = Tests.shift();
  if (test)
  {
    hdr.setStringProperty("keywords", test.msgTag);
    testObject = new TestSearch(gLocalInboxFolder,
                         test.testTag,
                         nsMsgSearchAttrib.Keywords,
                         test.op,
                         test.count,
                         testKeywordSearch);
  }
  else
  {
    testObject = null;
    do_test_finished();
  }
}

