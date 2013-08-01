/*
 * Test bug 92111 - imap download-by-chunks doesn't download complete file if the
 * server lies about rfc822.size (known to happen for Exchange and gmail)
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer, gSavedMsgFile;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const gFileName = "bug92111";
const gMsgFile = do_get_file("../../../data/" + gFileName);
                     
function run_test()
{
  /*
   * Set up an IMAP server. The bug is only triggered when nsMsgSaveAsListener
   * is used (i.e., for IMAP and NNTP).
   */
  gIMAPDaemon = new imapDaemon();
  gServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();

  // pref tuning: one connection only, turn off notifications
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);
  Services.prefs.setIntPref("mail.server.server1.max_cached_connections", 1);
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  // Crank down the message chunk size to make test cases easier
  Services.prefs.setBoolPref("mail.server.default.fetch_by_chunks", true);
  Services.prefs.setIntPref("mail.imap.chunk_size", 1000);
  Services.prefs.setIntPref("mail.imap.min_chunk_size_threshold", 1500);
  Services.prefs.setIntPref("mail.imap.chunk_add", 0);

  var inbox = gIMAPDaemon.getMailbox("INBOX");

  /*
   * Ok, prelude done. Read the original message from disk
   * (through a file URI), and add it to the Inbox.
   */
  var msgfileuri =
    Services.io.newFileURI(gMsgFile).QueryInterface(Ci.nsIFileURL);

  let message = new imapMessage(msgfileuri.spec, inbox.uidnext++, []);
  // report an artificially low size, like gmail and Exchange do
  message.setSize(gMsgFile.fileSize - 100);
  inbox.addMessage(message);

  /*
   * Save the message to a local file. IMapMD corresponds to
   * <profile_dir>/mailtest/ImapMail (where fakeserver puts the IMAP mailbox
   * files). If we pass the test, we'll remove the file afterwards
   * (cf. UrlListener), otherwise it's kept in IMapMD.
   */
  gSavedMsgFile = Services.dirsvc.get("IMapMD", Ci.nsIFile);
  gSavedMsgFile.append(gFileName + ".eml");

  do_test_pending();
  do_timeout(10000, function(){
      do_throw('SaveMessageToDisk did not complete within 10 seconds' +
        '(incorrect messageURI?). ABORTING.');
      }
    );

  /*
   * From nsIMsgMessageService.idl:
   * void SaveMessageToDisk(in string aMessageURI, in nsIFile aFile,
   *                        in boolean aGenerateDummyEnvelope,
   *                        in nsIUrlListener aUrlListener, out nsIURI aURL,
   *                        in boolean canonicalLineEnding,
   *                        in nsIMsgWindow aMsgWindow);
   * Enforcing canonicalLineEnding (i.e., CRLF) makes sure that the
   * test also runs successfully on platforms not using CRLF by default.
   */
  gIMAPService.SaveMessageToDisk("imap-message://user@localhost/INBOX#"
                                 + (inbox.uidnext-1), gSavedMsgFile,
                                 false, UrlListener, {}, true, null);
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();
  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  try {
    gSavedMsgFile.remove(false);
  }
  catch (ex) {
    dump(ex);
    do_throw(ex);
  }
  do_test_finished();
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // operation succeeded
    do_check_eq(rc, 0);

    // File contents were not modified
    do_check_eq(IOUtils.loadFileToString(gMsgFile),
		IOUtils.loadFileToString(gSavedMsgFile));

    // The file doesn't get closed straight away, but does after a little bit.
    // So wait, and then remove it. We need to test this to ensure we don't
    // indefinitely lock the file.
    do_timeout(1000, endTest);
  }
};

// XXX IRVING we need a separate check somehow to make sure we store the correct
// content size for chunked messages where the server lied
