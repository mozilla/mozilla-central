/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* Test of accessing over 2 GiB local folder. */

load("../../../resources/messageGenerator.js");
const bugmail10 = do_get_file("../../../data/bugmail10");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

var gLocalInboxSize;
var gLocalTrashFolder;

function run_test()
{
  localAccountUtils.loadLocalMailAccount();

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  let inboxFile = localAccountUtils.inboxFolder.filePath;

  let neededFreeSpace = 0x100000000;
  let freeDiskSpace = inboxFile.diskSpaceAvailable;
  do_print("Free disk space = " + mailTestUtils.toMiBString(freeDiskSpace));
  if (freeDiskSpace < neededFreeSpace) {
    do_print("This test needs " + mailTestUtils.toMiBString(neededFreeSpace) +
             " free space to run. Aborting.");
    todo_check_true(false);

    endTest();
    return;
  }

  // "Trash" folder
  gLocalTrashFolder = localAccountUtils.incomingServer
                                       .rootMsgFolder.getChildNamed("Trash");

  // Extend local folder to over 2 GiB.
  let outputStream = Cc["@mozilla.org/network/file-output-stream;1"]
                       .createInstance(Ci.nsIFileOutputStream)
                       .QueryInterface(Ci.nsISeekableStream);
  // Open in write-only mode, no truncate.
  outputStream.init(inboxFile, 0x02, -1, 0);
  // seek past 2GB.
  outputStream.seek(0, 0x80000010);
  // Write a "space" character.
  outputStream.write(" ", 1);
  outputStream.close();

  // Save initial file size.
  gLocalInboxSize = localAccountUtils.inboxFolder.filePath.fileSize;
  do_print("Local inbox size (before copyFileMessageInLocalFolder()) = " +
           gLocalInboxSize);

  // Append mail data to over 2 GiB position for over 2 GiB msgkey.
  copyFileMessageInLocalFolder(bugmail10, 0, "", null, copyMessages);
}

// Get message whose msg key is over 2 GiB.
function getMessageHdr()
{
  let msgEnum = localAccountUtils.inboxFolder.msgDatabase.EnumerateMessages();
  while (msgEnum.hasMoreElements()) {
    let header = msgEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    if (header.messageKey >= 0x80000000) {
      return header;
    }
  }

  do_throw("Over 2 GiB msgkey was not found!");
}

function copyMessages()
{
  // Make sure inbox file grew (i.e., we were not writing over data).
  let localInboxSize = localAccountUtils.inboxFolder.filePath.fileSize;
  do_print("Local inbox size (after copyFileMessageInLocalFolder()) = " +
           localInboxSize);
  do_check_true(localInboxSize > gLocalInboxSize);

  // Copy the message into the subfolder.
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  messages.appendElement(getMessageHdr(), false);
  MailServices.copy.CopyMessages(localAccountUtils.inboxFolder, messages,
                                 gLocalTrashFolder,
                                 false, copyListener2, null, false);
}

var copyListener2 = {
  OnStartCopy : function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey : function(aKey) {},
  OnStopCopy : function(aStatus) {
    do_check_eq(aStatus, 0);

    do_timeout(0, accessOver2GBMsg);
  }
};

// streamMessage() test by over 2 GiB mail offset.
function accessOver2GBMsg()
{
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let msghdr = getMessageHdr();
  let msgURI = msghdr.folder.getUriForMsg(msghdr);
  let msgServ = messenger.messageServiceFromURI(msgURI);
  msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", true);
}

gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _data : null,
  onStartRequest : function (aRequest, aContext) {
    this._data = "";
  },
  onStopRequest : function (aRequest, aContext, aStatusCode) {
    let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                    .createInstance(Ci.nsIFileInputStream);
    let stream = Cc["@mozilla.org/scriptableinputstream;1"]
                   .createInstance(Ci.nsIScriptableInputStream);

    fstream.init(bugmail10, -1, 0, 0);
    stream.init(fstream);
    let original = stream.read(this._data.length);
    do_check_eq(this._data, original);

    do_timeout(0, endTest);
  },
  onDataAvailable : function (aRequest, aContext, aInputStream, aOff, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  },
};

function endTest() {
  // Free up disk space - if you want to look at the file after running
  // this test, comment out this line.
  localAccountUtils.inboxFolder.filePath.remove(false);

  do_test_finished();
}
