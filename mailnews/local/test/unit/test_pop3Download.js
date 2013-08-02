/**
 * The intent of this file is to test that pop3 download code message storage
 * works correctly.
 */
load("../../../resources/POP3pump.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var testSubjects = ["[Bug 397009] A filter will let me tag, but not untag",
                    "Hello, did you receive my bugmail?",
                    "[Bug 655578] list-id filter broken"];

var gMsgHdrs = [];
var gHdrIndex = 0;
let gFiles = ["../../../data/bugmail1",
              "../../../data/draft1",
              "../../../data/bugmail19"];

// This combination of prefs is required to reproduce bug 713611, which
// is what this test is about.
Services.prefs.setBoolPref("mailnews.downloadToTempFile", false);
Services.prefs.setBoolPref("mail.server.default.leave_on_server", true);

function run_test()
{
  // add 3 messages
  gPOP3Pump.files = gFiles;
  gPOP3Pump.onDone = continueTest;
  do_test_pending();
  gPOP3Pump.run();
}

function continueTest()
{
  // get message headers for the inbox folder
  let enumerator = localAccountUtils.inboxFolder.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  let hdr;
  while (enumerator.hasMoreElements())
  {
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    gMsgHdrs.push(hdr);
    do_check_eq(hdr.subject, testSubjects[msgCount++]);
  }
  do_check_eq(msgCount, 3);
  gPOP3Pump = null;
  streamNextMessage();
}

function streamNextMessage()
{
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let msghdr = gMsgHdrs[gHdrIndex];
  let msgURI = msghdr.folder.getUriForMsg(msghdr);
  let msgServ = messenger.messageServiceFromURI(msgURI);
  msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", true);
}

gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _data : null,
  onStartRequest : function (aRequest, aContext) {
    this._stream = null;
    this._data = "";
  },
  onStopRequest : function (aRequest, aContext, aStatusCode) {
    // check that the streamed message starts with "From "
    do_check_true(this._data.startsWith("From "));
    if (++gHdrIndex == gFiles.length)
      do_test_finished();
    else
      streamNextMessage();
  },
  onDataAvailable : function (aRequest, aContext, aInputStream, aOff, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  },
};

