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

// Take a multipart message as we're testing attachment URLs as well
const gFile = do_get_file("../../mailnews/data/multipart-complex2");
var gIMAPDaemon, gIMAPServer, gIMAPIncomingServer, gIMAPInbox;
const gMFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(Ci.nsIMsgFolderNotificationService);
                   
// Adds some messages directly to a mailbox (eg new mail)
function addMessageToServer(file, mailbox)
{
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  let URI = ioService.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  mailbox.addMessage(new imapMessage(URI.spec, mailbox.uidnext++, []));

  gIMAPInbox.updateFolder(null);
}

var msgFolderListener =
{
  msgAdded: function(aMsgHdr)
  {
    do_timeout_function(0, verifyContentLength, null, [aMsgHdr]);
  }
};


function run_test()
{
  // Disable new mail notifications
  let prefSvc = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);

  prefSvc.setBoolPref("mail.biff.play_sound", false);
  prefSvc.setBoolPref("mail.biff.show_alert", false);
  prefSvc.setBoolPref("mail.biff.show_tray_icon", false);
  prefSvc.setBoolPref("mail.biff.animate_dock_icon", false);

  // Set up nsIMsgFolderListener to get the header when it's received
  gMFNService.addListener(msgFolderListener, gMFNService.msgAdded);

  // set up IMAP fakeserver and incoming server
  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();

  // we need a local account for the IMAP server to have its sent messages in
  loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let imapAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gIMAPIncomingServer;
  acctMgr.defaultAccount = imapAccount;

  // The server doesn't support more than one connection
  prefSvc.setIntPref("mail.server.server1.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  prefSvc.setBoolPref("mail.server.server1.download_on_biff", false);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("Inbox");
  gIMAPInbox.flags &= ~Ci.nsMsgFolderFlags.Offline;

  do_test_pending();

  // Add a message to the IMAP server
  addMessageToServer(gFile, gIMAPDaemon.getMailbox("INBOX"));

  gIMAPInbox.updateFolder(null);
}

function verifyContentLength(aMsgHdr)
{
  let messageUri = gIMAPInbox.getUriForMsg(aMsgHdr);
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
  do_check_eq(channel.contentLength, gFile.fileSize);

  do_timeout_function(1000, endTest);
}

function endTest()
{
  gIMAPServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.performTest();
  gIMAPServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished(); // for the one in run_test()
}
