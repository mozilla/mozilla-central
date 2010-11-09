/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test to ensure that CopyFileMessage checks for > 4GB local folder, and that
 * we can parse and compact folders over 4GB to allow users to get them under
 * 4GB.
 */

load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/alertTestUtils.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var gLocalInboxSize;

var gGotAlert = false;

var dummyDocShell =
{
  getInterface: function (iid) {
    if (iid.equals(Ci.nsIAuthPrompt)) {
      return Cc["@mozilla.org/login-manager/prompter;1"]
               .getService(Ci.nsIAuthPrompt);
    }

    throw Components.results.NS_ERROR_FAILURE;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDocShell,
                                         Ci.nsIInterfaceRequestor])
}

function alert(aDialogTitle, aText) {
  do_check_eq(aText.indexOf("The folder Inbox is full, and can't hold any more messages."), 0);
  gGotAlert = true;
}

// Dummy message window so we can do the move as an offline operation.
var dummyMsgWindow =
{
  rootDocShell: dummyDocShell,
  promptDialog: alertUtilsPrompts,

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgWindow,
                                         Ci.nsISupportsWeakReference])
};


var copyListener = {
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aMsgKey) {},
  GetMessageId: function() {},
  OnStopCopy: function(aStatus) {
    do_check_false(Components.isSuccessCode(aStatus));
  }
};


function run_test()
{
  loadLocalMailAccount();

  let inboxFile = gLocalInboxFolder.filePath.clone();

  // On Windows, check whether the drive is NTFS. If it is, mark the file as
  // sparse. If it isn't, then bail out now, because in all probability it is
  // FAT32, which doesn't support file sizes greater than 4 GB.
  if ("@mozilla.org/windows-registry-key;1" in Cc &&
      get_file_system(inboxFile) != "NTFS")
  {
    dump("On Windows, this test only works on NTFS volumes.\n");
    endTest();
    return;
  }
  let isFileSparse = mark_file_region_sparse(inboxFile, 0, 0x10000000f);
  if (!isFileSparse && inboxFile.diskSpaceAvailable < 0x200000000)
  {
    dump("On systems where files can't be marked sparse, this test needs 8 " +
         "GB of free disk space.\n");
    endTest();
    return;
  }

  // extend local folder to over 2GB
  let outputStream = gLocalInboxFolder.offlineStoreOutputStream
    .QueryInterface(Ci.nsISeekableStream);
  // seek past 4GB.
  outputStream.seek(0, 0x10000000f);
  outputStream.write(" ", 1);
  outputStream.close();
  gLocalInboxSize = gLocalInboxFolder.filePath.fileSize;

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  let file = do_get_file("../../../data/multipart-complex2");
  let copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

  try {
    copyService.CopyFileMessage(file, gLocalInboxFolder, null, false, 0,
                                "", copyListener, dummyMsgWindow);
  } catch (ex) {
  }
  endTest();

}

function endTest()
{
  do_check_true(gGotAlert);
  // free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  gLocalInboxFolder.filePath.remove(false);
  do_test_finished();
}
