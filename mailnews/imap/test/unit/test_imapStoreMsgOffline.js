/**
 * This test checks if the imap protocol code saves message to
 * offline stores correctly, when we fetch the message for display.
 * It checks:
 *   - Normal messages, no attachments.
 *   - Message with inline attachment (e.g., image)
 *   - Message with non-inline attachment (e.g., .doc file)
 *   - Message with mix of attachment types.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

var gMessageGenerator = new MessageGenerator();
var gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

const nsMsgMessageFlags = Ci.nsMsgMessageFlags;

var gMsgFile1 = do_get_file("../../../data/bugmail10");
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
var gMsgFile2 = do_get_file("../../../data/image-attach-test");
const gMsgId2 = "4A947F73.5030709@example.com";
var gMsgFile3 = do_get_file("../../../data/external-attach-test");
const gMsgId3 = "876TY.5030709@example.com";

var gFirstNewMsg;
var gFirstMsgSize;
var gImapInboxOfflineStoreSize;

// We use this as a display consumer
var streamListener =
{
  _data: "",

  QueryInterface:
    XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

  // nsIRequestObserver
  onStartRequest: function(aRequest, aContext) {
  },
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    do_check_eq(aStatusCode, 0);
  },

  // nsIStreamListener
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    let scriptStream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);

    scriptStream.init(aInputStream);

    scriptStream.read(aCount);
  }
};

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    let URI =
      Services.io.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

function setup() {
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  Services.prefs.setBoolPref("mail.server.server1.offline_download", true);
  // make small threshhold for mpod so our test messages don't have to be big.
  // XXX We can't set this pref until the fake server supports body structure.
  // So for now, we'll leave it at the default value, which is larger than any of
  // our test messages.
  // Services.prefs.setIntPref("mail.imap.mime_parts_on_demand_threshold", 3000);

  setupIMAPPump();

  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  IMAPPump.inbox.hierarchyDelimiter = '/';
  IMAPPump.inbox.verifiedAsOnlineFolder = true;


  // Add a couple of messages to the INBOX
  // this is synchronous, afaik
  addMessagesToServer([{file: gMsgFile1, messageId: gMsgId1},
                        {file: gMsgFile2, messageId: gMsgId2},
                        {file: gMsgFile3, messageId: gMsgId3},
//                         {file: gMsgFile5, messageId: gMsgId5},
                      ],
                        IMAPPump.daemon.getMailbox("INBOX"), IMAPPump.inbox);
}

var gIMAPService;

var tests = [
  setup,
  function updateFolder() {
    IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function selectFirstMsg() {

  // We postpone creating the imap service until after we've set the prefs
  // that it reads on its startup.
  gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

    let db = IMAPPump.inbox.msgDatabase;
    let msg1 = db.getMsgHdrForMessageID(gMsgId1);
    let url = new Object;
    gIMAPService.DisplayMessage(IMAPPump.inbox.getUriForMsg(msg1),
                                            streamListener,
                                            null,
                                            asyncUrlListener,
                                            null,
                                            url);
    yield false;
  },
  function select2ndMsg() {
    let msg1 = IMAPPump.inbox.msgDatabase.getMsgHdrForMessageID(gMsgId1);
    do_check_neq(msg1.flags & nsMsgMessageFlags.Offline, 0);
    let db = IMAPPump.inbox.msgDatabase;
    let msg2 = db.getMsgHdrForMessageID(gMsgId2);
    let url = new Object;
    gIMAPService.DisplayMessage(IMAPPump.inbox.getUriForMsg(msg2),
                                            streamListener,
                                            null,
                                            asyncUrlListener,
                                            null,
                                            url);
    yield false;
  },
  function select3rdMsg() {
    let msg2 = IMAPPump.inbox.msgDatabase.getMsgHdrForMessageID(gMsgId2);
    do_check_neq(msg2.flags & nsMsgMessageFlags.Offline, 0);
    let db = IMAPPump.inbox.msgDatabase;
    let msg3 = db.getMsgHdrForMessageID(gMsgId3);
    let url = new Object;
    gIMAPService.DisplayMessage(IMAPPump.inbox.getUriForMsg(msg3),
                                            streamListener,
                                            null,
                                            asyncUrlListener,
                                            null,
                                            url);
    yield false;
  },
  function verify3rdMsg() {
    let msg3 = IMAPPump.inbox.msgDatabase.getMsgHdrForMessageID(gMsgId3);
    // can't turn this on because our fake server doesn't support body structure.
//    do_check_eq(msg3.flags & nsMsgMessageFlags.Offline, 0);
  },
  function addNewMsgs() {
    let mbox = IMAPPump.daemon.getMailbox("INBOX")
    // make a couple messges
    let messages = [];
    let bodyString = "";
    for (let i = 0; i < 100; i++)
      bodyString += "1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890\r\n";

    let gMessageGenerator = new MessageGenerator();
    messages = messages.concat(gMessageGenerator.makeMessage({body: {body: bodyString, contentType: "text/plain"}}));

    gFirstNewMsg = mbox.uidnext;
    // need to account for x-mozilla-status, status2, and envelope.
    gFirstMsgSize = messages[0].toMessageString().length + 102;

    messages.forEach(function (message)
    {
      let dataUri = Services.io.newURI("data:text/plain;base64," +
                                       btoa(message.toMessageString()),
                                       null, null);
      mbox.addMessage(new imapMessage(dataUri.spec, mbox.uidnext++, []));
    });
    IMAPPump.inbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function testQueuedOfflineDownload()
  {
    // Make sure that streaming the same message and then trying to download
    // it for offline use doesn't end up in it getting added to the offline 
    // store twice.
    gImapInboxOfflineStoreSize = IMAPPump.inbox.filePath.fileSize + gFirstMsgSize;
    let newMsgHdr = IMAPPump.inbox.GetMessageHeader(gFirstNewMsg);
    let msgURI = newMsgHdr.folder.getUriForMsg(newMsgHdr);
    let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
    let msgServ = messenger.messageServiceFromURI(msgURI);
    msgServ.streamMessage(msgURI, gStreamListener, null, null, false, "", false);
    yield false;
  },
  function firstStreamFinished()
  {
    // nsIMsgFolder.DownloadMessagesForOffline does not take a listener, so
    // we invoke nsIImapService.downloadMessagesForOffline directly with a 
    // listener.
    MailServices.imap.downloadMessagesForOffline(gFirstNewMsg,
                                                 IMAPPump.inbox,
                                                 asyncUrlListener,
                                                 null);
    yield false;
  },
  function checkOfflineStoreSize()
  {
    dump("checking offline store size\n");
    do_check_true(IMAPPump.inbox.filePath.fileSize <= gImapInboxOfflineStoreSize);
  },
  teardown
]

let gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _data : null,
  onStartRequest : function (aRequest, aContext) {
    this._data = "";
  },
  onStopRequest : function (aRequest, aContext, aStatusCode) {
    async_driver();
  },
  onDataAvailable : function (aRequest, aContext, aInputStream, aOff, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  },
};

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
