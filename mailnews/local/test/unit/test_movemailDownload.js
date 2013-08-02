/**
 * The intent of this file is to test that movemail download code
 * works correctly.
 */
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var testSubjects = ["[Bug 397009] A filter will let me tag, but not untag",
                    "Hello, did you receive my bugmail?",
                    "[Bug 655578] list-id filter broken"];

var gMsgHdrs = [];
var gHdrIndex = 0;

// the movemail spool dir file is these three files
// concatenated together.

let gFiles = ["../../../data/bugmail1",
              "../../../data/draft1",
              "../../../data/bugmail19"];

var gMoveMailInbox;

function run_test()
{
  localAccountUtils.loadLocalMailAccount();
  
  let incoming = MailServices.accounts.createIncomingServer("", "", "movemail");
  let workingDir = Services.dirsvc.get("CurWorkD", Ci.nsIFile);
  let workingDirFile = workingDir.clone();
  let fullPath = workingDirFile.path + "/data/movemailspool";
  workingDirFile.initWithPath(fullPath);
  // movemail truncates spool file, so make a copy, and use that
  workingDirFile.copyTo(null, "movemailspool-copy");
  fullPath += "-copy";
  dump("full path = " + fullPath + "\n");
  incoming.setCharValue("spoolDir", fullPath);
  incoming.QueryInterface(Ci.nsILocalMailIncomingServer);
  incoming.getNewMail(null, null, null);
  gMoveMailInbox = incoming.rootFolder.getChildNamed("INBOX");
  // add 3 messages
  do_test_pending();
  continueTest();
}

function continueTest()
{
  // get message headers for the inbox folder
  let enumerator = gMoveMailInbox.msgDatabase.EnumerateMessages();
  var msgCount = 0;
  let hdr;
  while (enumerator.hasMoreElements())
  {
    let hdr = enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
    gMsgHdrs.push(hdr);
    do_check_eq(hdr.subject, testSubjects[msgCount++]);
  }
  do_check_eq(msgCount, 3);
  streamNextMessage();
}

function streamNextMessage()
{
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let msghdr = gMsgHdrs[gHdrIndex];
  let msgURI = msghdr.folder.getUriForMsg(msghdr);
  dump("streaming msg " + msgURI + " store token = " + msghdr.getStringProperty("storeToken"));
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

