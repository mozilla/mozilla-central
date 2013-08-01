/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * This test checks pseudo-offline message copies (which is triggered
 * by allowUndo == true in CopyMessages).
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/IMAPpump.js");

const nsMsgMessageFlags = Ci.nsMsgMessageFlags;

var gMsgFile1 = do_get_file("../../../data/bugmail10");
const gMsgId1 = "200806061706.m56H6RWT004933@mrapp54.mozilla.org";
var gMsgFile2 = do_get_file("../../../data/image-attach-test");
const gMsgId2 = "4A947F73.5030709@example.com";
var gMessages = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
var gMsgFile3 = do_get_file("../../../data/SpamAssassinYes");
var gMsg3Id = "bugmail7.m47LtAEf007543@mrapp51.mozilla.org";
var gMsgFile4 = do_get_file("../../../data/bug460636");
var gMsg4Id = "foo.12345@example";

var gFolder1;

// Adds some messages directly to a mailbox (eg new mail)
function addMessagesToServer(messages, mailbox, localFolder)
{
  // For every message we have, we need to convert it to a file:/// URI
  messages.forEach(function (message)
  {
    let URI = Services.io.newFileURI(message.file).QueryInterface(Ci.nsIFileURL);
    message.spec = URI.spec;
  });

  // Create the imapMessages and store them on the mailbox
  messages.forEach(function (message)
  {
    mailbox.addMessage(new imapMessage(message.spec, mailbox.uidnext++, []));
  });
}

function setup() {
  // Turn off autosync_offline_stores because
  // fetching messages is invoked after copying the messages.
  // (i.e. The fetching process will be invoked after OnStopCopy)
  // It will cause crash with an assertion
  // (ASSERTION: tried to add duplicate listener: 'index == -1') on teardown.
  Services.prefs.setBoolPref("mail.server.default.autosync_offline_stores", false);

  setupIMAPPump();

  MailServices.mfn.addListener(mfnListener, MailServices.mfn.folderAdded);
  gIMAPIncomingServer.rootFolder.createSubfolder("folder 1", null);
  yield false;

  gFolder1 = gIMAPIncomingServer.rootFolder.getChildNamed("folder 1");
  do_check_true(gFolder1 instanceof Ci.nsIMsgFolder);

  // these hacks are required because we've created the inbox before
  // running initial folder discovery, and adding the folder bails
  // out before we set it as verified online, so we bail out, and
  // then remove the INBOX folder since it's not verified.
  gIMAPInbox.hierarchyDelimiter = '/';
  gIMAPInbox.verifiedAsOnlineFolder = true;

  // Add messages to the INBOX
  // this is synchronous, afaik
  addMessagesToServer([{file: gMsgFile1, messageId: gMsgId1},
                       {file: gMsgFile2, messageId: gMsgId2},
                      ],
                      gIMAPDaemon.getMailbox("INBOX"), gIMAPInbox);
}

var tests = [
  setup,
  function updateFolder() {
    gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;
  },
  function downloadAllForOffline() {
     gIMAPInbox.downloadAllForOffline(asyncUrlListener, null);
     yield false;
  },
  function copyMessagesToInbox() {

    MailServices.copy.CopyFileMessage(gMsgFile3, gIMAPInbox, null, false, 0,
                                      "", asyncCopyListener, null);
    yield false;

    MailServices.copy.CopyFileMessage(gMsgFile4, gIMAPInbox, null, false, 0,
                                      "", asyncCopyListener, null);
    yield false;

    gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
    yield false;

    let db = gIMAPInbox.msgDatabase;

    // test the headers in the inbox
    let enumerator = db.EnumerateMessages();
    while (enumerator.hasMoreElements())
    {
      var message = enumerator.getNext();
      message instanceof Ci.nsIMsgDBHdr;
      dump('message <'+ message.subject +
           '> storeToken: <' + message.getStringProperty("storeToken") +
           '> offset: <' + message.messageOffset +
           '> id: <' + message.messageId +
           '>\n');
      // This fails for file copies in bug 790912. Without  this, messages that
      //  are copied are not visible in pre-pluggableStores versions of TB (pre TB 12)
      do_check_eq(message.messageOffset, parseInt(message.getStringProperty("storeToken")));
    }
  },
  function copyMessagesToSubfolder() {
    //  a message created from IMAP download
    let db = gIMAPInbox.msgDatabase;
    let msg1 = db.getMsgHdrForMessageID(gMsgId1);
    gMessages.appendElement(msg1, false);
    // this is sync, I believe?
    MailServices.copy.CopyMessages(gIMAPInbox, gMessages, gFolder1, false,
                                   null, null, true);

    // two messages originally created from file copies (like in Send)
    let msg3 = db.getMsgHdrForMessageID(gMsg3Id);
    do_check_true(msg3 instanceof Ci.nsIMsgDBHdr);
    gMessages.clear();
    gMessages.appendElement(msg3, false);
    MailServices.copy.CopyMessages(gIMAPInbox, gMessages, gFolder1, false,
                                   null, null, true);

    let msg4 = db.getMsgHdrForMessageID(gMsg4Id);
    do_check_true(msg4 instanceof Ci.nsIMsgDBHdr);

    // because bug 790912 created messages with correct storeToken but messageOffset=0,
    //  these messages may not copy correctly. Make sure that they do, as fixed in bug 790912
    msg4.messageOffset = 0;
    gMessages.clear();
    gMessages.appendElement(msg4, false);
    MailServices.copy.CopyMessages(gIMAPInbox, gMessages, gFolder1, false,
                                   null, null, true);

    // test the db headers in folder1
    db = gFolder1.msgDatabase;
    enumerator = db.EnumerateMessages();
    while (enumerator.hasMoreElements())
    {
      var message = enumerator.getNext();
      message instanceof Ci.nsIMsgDBHdr;
      dump('message <'+ message.subject +
           '> storeToken: <' + message.getStringProperty("storeToken") +
           '> offset: <' + message.messageOffset +
           '> id: <' + message.messageId +
           '>\n');
      do_check_eq(message.messageOffset, parseInt(message.getStringProperty("storeToken")));
    }
  },
  function test_headers() {
    let msgIds = [gMsgId1, gMsg3Id, gMsg4Id];
    for each (msgId in msgIds)
    {
      let newMsgHdr= gFolder1.msgDatabase.getMsgHdrForMessageID(msgId);
      let msgURI = newMsgHdr.folder.getUriForMsg(newMsgHdr);
      let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
      let msgServ = messenger.messageServiceFromURI(msgURI);
      let streamListener = new StreamListener();
      msgServ.streamHeaders(msgURI, streamListener, asyncUrlListener,true);
      yield false;
      dump('\nheaders for messageId ' + msgId + '\n' + streamListener._data + '\n\n');
      do_check_true(streamListener._data.contains(msgId));
    }
  },
  teardown
]

asyncUrlListener.callback = function(aUrl, aExitCode) {
  do_check_eq(aExitCode, 0);
};

function teardown() {
  MailServices.mfn.removeListener(mfnListener);
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}

var mfnListener =
{
  folderAdded: function folderAdded(aFolder)
  {
    // we are only using async yield on the target folder add
    if (aFolder.name == "folder 1")
      async_driver();
  },
};

// We use this as a display consumer
function StreamListener() {}

StreamListener.prototype = 
{
  _data: "",
  _stream : null,

  QueryInterface:
    XPCOMUtils.generateQI([Ci.nsIStreamListener, Ci.nsIRequestObserver]),

  // nsIRequestObserver
  onStartRequest: function(aRequest, aContext) {
    this._data = "";
  },
  onStopRequest: function(aRequest, aContext, aStatusCode) {
    do_check_eq(aStatusCode, 0);
    async_driver();
  },

  // nsIStreamListener
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    if (this._stream == null) {
      this._stream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      this._stream.init(aInputStream);
    }
    this._data += this._stream.read(aCount);
  }
};
