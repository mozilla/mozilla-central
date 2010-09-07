/*
 * Test bodystructure and body fetch by parts. Messages with problem of
 * 'This part will be downloaded on demand' in message pane content (text) area.
 * To add messages to the test, place the 'markerRe' text used for testing in the
 * offending part that is displaying the problem message.
 * Prepend to the filename 'bodystructure' and save in the database
 * See current test files for examples.
 */
var gServer, gIMAPIncomingServer;
function run_test()
{
  let IMAPDaemon = new imapDaemon();;
  const ioS = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);

  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref( "mail.server.server1.max_cached_connections", 1);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon",    false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  // Force bodypart fetching as best as we can.
  // It would be adviseable to enable log and check to be sure body[] is not being
  // fetched in lieu of parts. There may be conditions that bypass bodypart fetch.
  prefBranch.setBoolPref("mail.inline_attachments",     false);
  prefBranch.setIntPref ("browser.cache.disk.capacity",              0);
  prefBranch.setIntPref ("mail.imap.mime_parts_on_demand_threshold", 1);
  prefBranch.setIntPref ("mailnews.display.disallow_mime_handlers",  0);
  prefBranch.setBoolPref("mail.server.default.fetch_by_chunks",  false);
  prefBranch.setIntPref ("mail.imap.mime_parts_on_demand_max_depth", 1);

  gServer = makeServer(IMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();
  let inbox = IMAPDaemon.getMailbox("INBOX");
  let imapS = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                .getService(Ci.nsIMsgMessageService);

  do_test_pending();
  do_timeout(10000, function(){
    do_throw('Tests did not complete within 10 seconds. ABORTING.');
    }
  );

  let fileNames = [];
  let msgFiles = do_get_file("../../../data/").directoryEntries;
  while (msgFiles.hasMoreElements()) {
    let file = msgFiles.getNext();
    let msgfileuri = ioS.newFileURI(file).QueryInterface(Ci.nsIFileURL);
    if (/^bodystructure/i.test(msgfileuri.fileName)) {
      inbox.addMessage(new imapMessage(msgfileuri.spec, inbox.uidnext++, []));
      fileNames.push(msgfileuri.fileName);
    }
  }

  // loop through the files twice, once for plain and one for html check
  let isPlain = true;
  for (let cnt = 2 ; cnt > 0 ; cnt--, isPlain = false) {
    // adjust these for 'view body as' setting
    // 0 orig html 3 sanitized 1 plain text
    prefBranch.setIntPref ("mailnews.display.html_as", isPlain ? 1 : 0);
    prefBranch.setBoolPref("mailnews.display.prefer_plaintext", isPlain);
    let markerRe;
    if (isPlain)
      markerRe = /thisplaintextneedstodisplaytopasstest/;
    else
      markerRe = /thishtmltextneedstodisplaytopasstest/;

    for (let i = 1; i < inbox.uidnext ; i++) {
      let uri = {};
      imapS.GetUrlForUri("imap-message://user@localhost/INBOX#" + i,uri,null);
      uri.value.spec += "?header=quotebody";
      let channel = ioS.newChannelFromURI(uri.value);
      let inStream = channel.open();
      let scriptableInStream = Cc["@mozilla.org/scriptableinputstream;1"]
                 .createInstance(Ci.nsIScriptableInputStream);
      scriptableInStream.init(inStream);
      let availableCount;
      let buf = "";
      while(availableCount =  scriptableInStream.available()) {
        buf += scriptableInStream.read(availableCount);
      }
      dump("##########\nTesting--->" + fileNames[i-1] +
           "; 'prefer plain text': " + isPlain + "\n" +
           buf + "\n" +
           "##########\nTesting--->" + fileNames[i-1] +
           "; 'prefer plain text': " + isPlain + "\n");
      try {
        do_check_true(markerRe.test(buf));
       }
      catch(e){}
    }
  }
  do_timeout_function(700, endTest);
}

function endTest()
{
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  do_test_finished();
}
