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

// Test of message count changes in virtual folder views

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
const tagService = Cc["@mozilla.org/messenger/tagservice;1"]
                     .getService(Ci.nsIMsgTagService);
const dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=" + "quicksearch";
const dbView = Cc[dbviewContractId].createInstance(Ci.nsIMsgDBView);
const bugmail1 = do_get_file("mailnews/test/data/bugmail1");
// I'm only loading msgDBService to help load symbols for debugging
//const msgDBService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
//                     .getService(Ci.nsIMsgDBService);
                     
// main test

// the headers for the test messages. All messages are identical, but
// have different properties set on them.
var hdrs = [];

// how many identical messages to load
var messageCount = 5;

// tag used with test messages
var tag1 = "istag";

function run_test()
{

  loadLocalMailAccount();
    
  // Get messageCount messages into the local filestore.
  do_test_pending();

  // function setupVirtualFolder() continues the testing after CopyFileMessage.
  copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              copyListener, null);
  return true;
}

// nsIMsgCopyServiceListener implementation
var copyListener = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    hdrs.push(gLocalInboxFolder.GetMessageHeader(aKey));
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    if (--messageCount)
      copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                                  copyListener, null);
    else
      setupVirtualFolder();
  }
};

var virtualFolder;
var numTotalMessages; 
var numUnreadMessages;

// virtual folder setup
function setupVirtualFolder()
{
  // add as valid tag tag1, though probably not really necessary
  tagService.addTagForKey(tag1, tag1, null, null);
  
  // add tag1 to 4 messages
  var messages0to3 = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  for (i = 0; i <= 3; i++)
    messages0to3.appendElement(hdrs[i], false);
  gLocalInboxFolder.addKeywordsToMessages(messages0to3, tag1);

  // set 3 messages unread, 2 messages read
  var messages0to2 = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  for (i = 0; i <= 2; i++)
    messages0to2.appendElement(hdrs[i], false);
  gLocalInboxFolder.markMessagesRead(messages0to2, false);

  var messages3to4 = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  for (i = 3; i <= 4; i++)
    messages3to4.appendElement(hdrs[i], false);
  gLocalInboxFolder.markMessagesRead(messages3to4, true);

  // search will look for tag tag1 in the inbox folder
  searchTerm = makeSearchTerm(gLocalInboxFolder, tag1, 
    Ci.nsMsgSearchAttrib.Keywords, Ci.nsMsgSearchOp.Contains);
    
  var rootFolder = gLocalIncomingServer.rootMsgFolder;
  virtualFolder = CreateVirtualFolder("VfTest", rootFolder, gLocalInboxFolder.URI, searchTerm, false);
  var count= new Object;
  
  // Setup search session. Execution continues with testVirtualFolder()
  // after search is done.
  
  var searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);
  searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, gLocalInboxFolder);
  searchSession.appendTerm(searchTerm, false);
  searchSession.registerListener(searchListener);
  searchSession.search(null);
}

// partially based on gSearchNotificationListener in searchBar.js
// nsIMsgSearchNotify implementation
var searchListener =
{ 
  onNewSearch: function() 
  {
    numTotalMessages = 0;
    numUnreadMessages = 0;
  },
  onSearchHit: function(dbHdr, folder)
  {
    //print("Search hit, isRead is " + dbHdr.isRead);
    numTotalMessages++;
    if (!dbHdr.isRead)
      numUnreadMessages++;
  },
  onSearchDone: function(status)
  { 
    print("Finished search hitCount = " + numTotalMessages);
    var db = virtualFolder.getMsgDatabase(null);
    var dbFolderInfo = db.dBFolderInfo;
    dbFolderInfo.numMessages = numTotalMessages;
    dbFolderInfo.numUnreadMessages = numUnreadMessages;
    virtualFolder.updateSummaryTotals(true);
    print("virtual folder unread is " + virtualFolder.getNumUnread(false));
    testVirtualFolder();
  }
};

function testVirtualFolder()
{
  /*** basic functionality tests ***/
  
  // total messages matching search
  do_check_eq(4, virtualFolder.getTotalMessages(false));
  
  // total unread messages in search
  do_check_eq(3, virtualFolder.getNumUnread(false));

  // change unread of one item in search to decrease count
  var message0 = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  message0.appendElement(hdrs[0], false);
  gLocalInboxFolder.markMessagesRead(message0, true);

  do_check_eq(2, virtualFolder.getNumUnread(false));
  
  /*** failures fixed in this bug ***/
   
  // remove tag from one item to decrease count
  var message1 = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  message1.appendElement(hdrs[1], false);

  gLocalInboxFolder.removeKeywordsFromMessages(message1, tag1);
  do_check_eq(3, virtualFolder.getTotalMessages(false));
  do_check_eq(1, virtualFolder.getNumUnread(false));
  
  do_test_finished();
  return true;
}

// helper functions

// adapted from commandglue.js
function CreateVirtualFolder(newName, parentFolder, searchFolderURIs, searchTerm, searchOnline)
{
  var newFolder = parentFolder.addSubfolder(newName);
  newFolder.setFlag(Ci.nsMsgFolderFlags.Virtual);
  var vfdb = newFolder.getMsgDatabase(null);
  var searchTerms = [];
  var searchTermString = getSearchTermString(searchTerm);
  
  var dbFolderInfo = vfdb.dBFolderInfo;
  // set the view string as a property of the db folder info
  // set the original folder name as well.
  dbFolderInfo.setCharProperty("searchStr", searchTermString);
  dbFolderInfo.setCharProperty("searchFolderUri", searchFolderURIs);
  dbFolderInfo.setBooleanProperty("searchOnline", searchOnline);
  vfdb.summaryValid = true;
  vfdb.Close(true);
  
  // use acctMgr to setup the virtual folder listener
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  acctMgr = acctMgr.QueryInterface(Ci.nsIFolderListener);
  //print(acctMgr);
  acctMgr.OnItemAdded(null, newFolder);
  return newFolder;
}

function getSearchTermString(term)
{
  var condition = "";
  
  if (condition.length > 1)
    condition += ' ';
  
  if (term.matchAll)
    condition = "ALL";
  condition += (term.booleanAnd) ? "AND (" : "OR (";
  condition += term.termAsString + ')';
  return condition;
}

// Create a search term for searching aFolder
//   using aAttrib, aOp, and string aStrValue
function makeSearchTerm(aFolder, aStrValue, aAttrib, aOp)
{
  // use a temporary search session
  var searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);
  searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, aFolder);
  var searchTerm = searchSession.createTerm();
  var value = searchTerm.value;
  value.str = aStrValue;
  searchTerm.value = value;
  searchTerm.attrib = aAttrib;
  searchTerm.op = aOp;
  searchTerm.booleanAnd = false;
  searchSession = null;
  return searchTerm;
}

