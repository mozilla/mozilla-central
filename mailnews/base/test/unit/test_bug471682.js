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
 * Test of message database validity on local copy from bug 471682. What
 * we want to do here is to copy a couple of message to a new folder, and
 * then compare the date and filesize of the folder file with the
 * stored result in dbfolderinfo. If they don't match, that's bad.
 */
const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
const bugmail1 = do_get_file("../../mailnews/data/bugmail1");
var gHdr; // header of test message in local folder

loadLocalMailAccount();
// create a subfolder as a target for copies
var gSubfolder = gLocalInboxFolder.addSubfolder("subfolder");

function run_test()
{
  do_test_pending();
  // step 1: copy a message into the local inbox
  copyService.CopyFileMessage(bugmail1, gLocalInboxFolder, null, false, 0,
                              "", step2, null);
  return;
}

// step 2: copy one message into a subfolder to establish an
//         mbox file time and size
// nsIMsgCopyServiceListener implementation
var step2 = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gHdr = gLocalInboxFolder.GetMessageHeader(aKey);
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // copy the message into the subfolder
    var messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    messages.appendElement(gHdr, false);
    copyService.CopyMessages(gLocalInboxFolder, messages, gSubfolder, false,
                             step3, null, false);
  }
};

// step 3: after the copy, delay to allow copy to complete and allow possible
//         file error time
// nsIMsgCopyServiceListener implementation
var step3 = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    do_timeout(2000, "step4();");
  }
}

// step 4: start a second copy
function step4()
{
  var messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  messages.appendElement(gHdr, false);
  copyService.CopyMessages(gLocalInboxFolder, messages, gSubfolder, false,
                           step5, null, false);
}

// step 5:  actual tests of file size and date
// nsIMsgCopyServiceListener implementation
var step5 = 
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    var dbSize = gSubfolder.msgDatabase.dBFolderInfo.folderSize;
    var dbDate = gSubfolder.msgDatabase.dBFolderInfo.folderDate;
    var filePath = gSubfolder.filePath;
    var date = parseInt(filePath.lastModifiedTime/1000);
    var size = filePath.fileSize;
    do_check_eq(size, dbSize);
    do_check_eq(date, dbDate);
    // End of test, so release our header reference
    gHdr = null;
    do_test_finished();
  }
}
