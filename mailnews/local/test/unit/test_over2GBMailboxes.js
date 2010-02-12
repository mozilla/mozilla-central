/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */

/* Test of accessing over 2GB local folder */

load("../../mailnews/resources/messageGenerator.js");
const bugmail10 = do_get_file("../../mailnews/data/bugmail10");

var gLocalTrashFolder;
var gCopyService;

function run_test()
{
  loadLocalMailAccount();

  // "Trash" folder
  gLocalTrashFolder = gLocalIncomingServer.rootMsgFolder.getChildNamed("Trash");
  gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"].getService(Ci.nsIMsgCopyService);

  var freeDiskSpace = gLocalInboxFolder.filePath.diskSpaceAvailable;
  if (freeDiskSpace < 0x100000000) {
    dump("not enough free disk space: " + freeDiskSpace + "\n");
    do_test_finished();
    return;
  }

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  // extend local folder to over 2GB
  let outputStream = gLocalInboxFolder.offlineStoreOutputStream
                               .QueryInterface(Ci.nsISeekableStream);
  // seek past 2GB.
  outputStream.seek(0, 0x80000010);
  outputStream.write(" ", 1);
  outputStream.close();

  // add mail data to over 2GB position for over 2G msgkey
  gCopyService.CopyFileMessage(bugmail10, gLocalInboxFolder, null, false, 0,
                               "", copyListener, null);
}

var copyListener = {
  OnStartCopy : function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey : function(aKey) {},
  OnStopCopy : function(aStatus) {
    do_timeout(0, copyMessages);
  }
};

// get message whose msg key is over 2G
function getMessageHdr()
{
  let msgEnum = gLocalInboxFolder.msgDatabase.EnumerateMessages();
  while (msgEnum.hasMoreElements()) {
    let header = msgEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    if (header.messageKey >= 0x80000000) {
      return header;
    }
  }
  do_throw("Not found over 2G msgkey.");
}

function copyMessages()
{
  // copy the message into the subfolder
  let messages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  messages.appendElement(getMessageHdr(), false);
  gCopyService.CopyMessages(gLocalInboxFolder, messages, gLocalTrashFolder,
                            false,
                            copyListener2, null, false);
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

// streamMessage test by over 2GB mail offset
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
    var original = stream.read(this._data.length);

    do_check_eq(this._data, original);
    do_timeout(0, do_test_end());
  },
  onDataAvailable : function (aRequest, aContext, aInputStream, aOff, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  },
};

function do_test_end() {
  do_test_finished();
}
