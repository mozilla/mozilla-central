/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test content length for the IMAP protocol. This focuses on necko URLs
 * that are run externally.
 */

load("../../../resources/logHelper.js");
load("../../../resources/mailTestUtils.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/IMAPpump.js");

var gMsgHdr = null;

// Take a multipart message as we're testing attachment URLs as well
const gFile = do_get_file("../../../data/multipart-complex2");
const gMFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(Ci.nsIMsgFolderNotificationService);
                   
var tests = [
  setup,
  addMessageToServer,
  verifyContentLength,
  teardown
];

// Adds some messages directly to a mailbox (eg new mail)
function addMessageToServer() {
  let URI = Services.io.newFileURI(gFile).QueryInterface(Ci.nsIFileURL);
  gIMAPMailbox.addMessage(new imapMessage(URI.spec, gIMAPMailbox.uidnext++, []));

  gIMAPInbox.updateFolder(null);
  yield false;
}

var msgFolderListener = {
  msgAdded: function(aMsgHdr) {
    gMsgHdr = aMsgHdr;
    do_execute_soon(async_driver);
  },
};

function setup() {
  setupIMAPPump();

  // Set up nsIMsgFolderListener to get the header when it's received
  gMFNService.addListener(msgFolderListener, gMFNService.msgAdded);

  gIMAPInbox.flags &= ~Ci.nsMsgFolderFlags.Offline;
}

function verifyContentLength() {
  let messageUri = gIMAPInbox.getUriForMsg(gMsgHdr);
  // Convert this to a URI that necko can run
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let neckoURL = {};
  let messageService = messenger.messageServiceFromURI(messageUri);
  messageService.GetUrlForUri(messageUri, neckoURL, null);
  // Don't use the necko URL directly. Instead, get the spec and create a new
  // URL using the IO service
  let urlToRun = gIOService.newURI(neckoURL.value.spec, null, null);

  // Get a channel from this URI, and check its content length
  let channel = gIOService.newChannelFromURI(urlToRun);
  do_check_eq(channel.contentLength, gFile.fileSize);

  // Now try an attachment. &part=1.2
  let attachmentURL = gIOService.newURI(neckoURL.value.spec + "&part=1.2",
                                        null, null);
  let attachmentChannel = gIOService.newChannelFromURI(attachmentURL);
  // Currently attachments have their content length set to the length of the
  // entire message
  do_check_eq(attachmentChannel.contentLength, gFile.fileSize);
}

function teardown() {
  gMFNService.removeListener(msgFolderListener);
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}
