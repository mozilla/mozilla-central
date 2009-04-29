/*
 * Test bug 460636 - nsMsgSaveAsListener sometimes inserts extra LF characters
 */

var gIMAPDaemon, gServer, gIMAPIncomingServer, gSavedMsgFile;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

const gFileName = "bug460636";
const gMsgFile = do_get_file("../../mailnews/data/" + gFileName);
                     
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
  var prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.server1.max_cached_connections", 1);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  var inbox = gIMAPDaemon.getMailbox("INBOX");

  /*
   * Ok, prelude done. Read the original message from disk
   * (through a file URI), and add it to the Inbox.
   */
  var msgfileuri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService)
                     .newFileURI(gMsgFile).QueryInterface(Ci.nsIFileURL);

  inbox.addMessage(new imapMessage(msgfileuri.spec, inbox.uidnext++, []));

  /*
   * Save the message to a local file. IMapMD corresponds to
   * mozilla/_test/mailtest/ImapMail in the build directory
   * (where fakeserver puts the IMAP mailbox files). If we pass
   * the test, we'll remove the file afterwards (cf. UrlListener),
   * otherwise it's kept in IMapMD.
   */
  gSavedMsgFile = Cc["@mozilla.org/file/directory_service;1"]
                  .getService(Ci.nsIProperties)
                  .get("IMapMD", Ci.nsILocalFile);
  gSavedMsgFile.append(gFileName + ".eml");

  do_test_pending();
  do_timeout(10000, "do_throw('SaveMessageToDisk did not complete within 10 seconds (incorrect messageURI?). ABORTING.');");

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
    do_check_eq(loadFileToString(gMsgFile), loadFileToString(gSavedMsgFile));

    // The file doesn't get closed straight away, but does after a little bit.
    // So wait, and then remove it. We need to test this to ensure we don't
    // indefinitely lock the file.
    do_timeout(1000, "endTest();");
  }
};
