/*
 * Test bodystructure and body fetch by parts. Messages with problem of
 * 'This part will be downloaded on demand' in message pane content (text) area.
 * To add messages to the test, place the 'markerRe' text used for testing in
 * the offending part that is displaying the problem message.
 * Prepend to the filename 'bodystructure' and save in the database
 * See current test files for examples.
 */
 
 // async support
load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

Components.utils.import("resource://gre/modules/Services.jsm");

var gServer, gIMAPIncomingServer, gIMAPDaemon;

var tests = [
  streamMessages,
  endTest
];

function run_test()
{
  gIMAPDaemon = new imapDaemon();
  // pref tuning: one connection only, turn off notifications
  Services.prefs.setIntPref( "mail.server.server1.max_cached_connections", 1);
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon",    false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);

  // Force bodypart fetching as best as we can.
  // It would be adviseable to enable log and check to be sure body[] is not
  // being fetched in lieu of parts. There may be conditions that bypass
  // bodypart fetch.
  Services.prefs.setBoolPref("mail.inline_attachments",     false);
  Services.prefs.setIntPref ("browser.cache.disk.capacity",              0);
  Services.prefs.setIntPref ("mail.imap.mime_parts_on_demand_threshold", 1);
  Services.prefs.setIntPref ("mailnews.display.disallow_mime_handlers",  0);
  Services.prefs.setBoolPref("mail.server.default.fetch_by_chunks",  false);
  Services.prefs.setBoolPref("mail.server.server1.autosync_offline_stores", false);

  gServer = makeServer(gIMAPDaemon, "");
  gIMAPIncomingServer = createLocalIMAPServer();

  //start first test
  async_run_tests(tests);
}

function streamMessages() {
  let inbox = gIMAPDaemon.getMailbox("INBOX");
  let imapS = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                .getService(Ci.nsIMsgMessageService);
  let fileNames = [];
  let msgFiles = do_get_file("../../../data/").directoryEntries;
  while (msgFiles.hasMoreElements()) {
    let file = msgFiles.getNext();
    let msgfileuri =
      Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);
    if (msgfileuri.fileName.toLowerCase().startsWith("bodystructure")) {
      inbox.addMessage(new imapMessage(msgfileuri.spec, inbox.uidnext++, []));
      fileNames.push(msgfileuri.fileName);
    }
  }

  // loop through the files twice, once for plain and one for html check
  let isPlain = true;
  for (let cnt = 2 ; cnt > 0 ; cnt--, isPlain = false) {
    // adjust these for 'view body as' setting
    // 0 orig html 3 sanitized 1 plain text
    Services.prefs.setIntPref ("mailnews.display.html_as", isPlain ? 1 : 0);
    Services.prefs.setBoolPref("mailnews.display.prefer_plaintext", isPlain);
    let marker;
    if (isPlain)
      marker = "thisplaintextneedstodisplaytopasstest";
    else
      marker = "thishtmltextneedstodisplaytopasstest";

    for (let i = 1; i < inbox.uidnext ; i++) {
      let uri = {};
      imapS.GetUrlForUri("imap-message://user@localhost/INBOX#" + i,uri,null);
      uri.value.spec += "?header=quotebody";
      let channel = Services.io.newChannelFromURI(uri.value);
      channel.asyncOpen(gStreamListener, null);
      yield false;
      let buf = gStreamListener._data;
      dump("##########\nTesting--->" + fileNames[i-1] +
           "; 'prefer plain text': " + isPlain + "\n" +
           buf + "\n" +
           "##########\nTesting--->" + fileNames[i-1] +
           "; 'prefer plain text': " + isPlain + "\n");
      try {
        do_check_true(buf.contains(marker));
      }
      catch(e){}
    }
  }
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

function endTest() {
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();
  let thread = Services.tm.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
  yield true;
}

