/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

 /**
 * The intent of this file is to show a folder loaded event after a load
 * with a null database.
 *
 */
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

var testSubjects = ["[Bug 397009] A filter will let me tag, but not untag",
                    "Hello, did you receive my bugmail?"];
var gMsgFile1 = do_get_file("../../../data/bugmail1");
var gMsgFile2 = do_get_file("../../../data/draft1");

var gTargetFolder = null;

var tests = [
  function setup()
  {
    do_timeout(5000, function() {
      // should be done by now
      do_check_true(false);
    });
 
    if (typeof localAccountUtils.inboxFolder == 'undefined')
      localAccountUtils.loadLocalMailAccount();
    localAccountUtils.rootFolder.createSubfolder("target", null);
    gTargetFolder = localAccountUtils.rootFolder.getChildNamed("target");

    MailServices.copy.CopyFileMessage(gMsgFile1, gTargetFolder, null, false, 0,
                                      "", asyncCopyListener, null);
    yield false;

    MailServices.copy.CopyFileMessage(gMsgFile2, gTargetFolder, null, false, 0,
                                      "", asyncCopyListener, null);
    yield false;

  },

  function firstUpdate()
  {
    // get message headers for the target folder
    let enumerator = gTargetFolder.msgDatabase.EnumerateMessages();
    var msgCount = 0;
    while(enumerator.hasMoreElements())
    {
      msgCount++;
      let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
      do_check_eq(hdr.subject, testSubjects[msgCount - 1]);
    }
    do_check_eq(msgCount, 2);

    // try an update
    mailTestUtils.updateFolderAndNotify(gTargetFolder, function () {
      dump("after FolderLoaded1\n");
      async_driver();
    });
    yield false;
  },

  function secondUpdate()
  {
    // If the following executes, the test hangs in bug 787557.
    gTargetFolder.msgDatabase = null;
    // try an update
    mailTestUtils.updateFolderAndNotify(gTargetFolder, function () {
      dump("after FolderLoaded2\n");
      async_driver();
    });
    yield false;
  },

];

function run_test() {
  async_run_tests(tests);
}
