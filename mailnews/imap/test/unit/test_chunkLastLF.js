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

 // async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

const gFile = do_get_file("../../../data/bug92111b");
var gIMAPDaemon, gIMAPServer, gIMAPIncomingServer;

// Adds some messages directly to a mailbox (eg new mail)
function addMessageToServer(file, mailbox)
{
  let URI = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  let msg = new imapMessage(URI.spec, mailbox.uidnext++, []);
  // underestimate the actual file size, like some IMAP servers do
  msg.setSize(file.fileSize - 55);
  mailbox.addMessage(msg);
}

function run_test()
{
  // Disable new mail notifications
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);

  // Crank down the message chunk size to make test cases easier
  Services.prefs.setBoolPref("mail.server.default.fetch_by_chunks", true);
  Services.prefs.setIntPref("mail.imap.chunk_size", 1000);
  Services.prefs.setIntPref("mail.imap.min_chunk_size_threshold", 1500);
  Services.prefs.setIntPref("mail.imap.chunk_add", 0);

  // set up IMAP fakeserver and incoming server
  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();

  // The server doesn't support more than one connection
  Services.prefs.setIntPref("mail.server.server1.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.server1.download_on_biff", false);

  async_run_tests([verifyContentLength, endTest]);
}

function verifyContentLength()
{
  dump("adding message to server\n");
  // Add a message to the IMAP server
  addMessageToServer(gFile, gIMAPDaemon.getMailbox("INBOX"));

  let imapS = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                .getService(Ci.nsIMsgMessageService);

  dump("getting uri\n");
  let uri = {};
  imapS.GetUrlForUri("imap-message://user@localhost/INBOX#1", uri, null);

  // Get a channel from this URI, and check its content length
  let channel = Services.io.newChannelFromURI(uri.value);

  dump(channel + "\n");

  // Read all the contents
  channel.asyncOpen(gStreamListener, null);
  yield false;
  // Now check whether our stream listener got the right bytes
  // First, clean up line endings to avoid CRLF vs. LF differences
  let origData = IOUtils.loadFileToString(gFile).replace(/\r\n/g, "\n");
  let streamData = gStreamListener._data.replace(/\r\n/g, "\n");
  do_check_eq(origData.length, streamData.length);
  do_check_eq(origData, streamData);

  // Now try an attachment. &part=1.2
  // let attachmentURL = Services.io.newURI(neckoURL.value.spec + "&part=1.2",
  //                                        null, null);
  // let attachmentChannel = Services.io.newChannelFromURI(attachmentURL);
  // Currently attachments have their content length set to the length of the
  // entire message
  // do_check_eq(attachmentChannel.contentLength, gFile.fileSize);

  yield true;
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  yield true;
}

gStreamListener = {
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIStreamListener]),
  _stream : null,
  _data : null,
  onStartRequest : function (aRequest, aContext) {
    this._data = "";
    this._stream = null;
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
