/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This file provides a simple interface to the imap fake server. Demonstration
 *  of its use can be found in test_imapPump.js
 *
 * The code that forms the core of this file, in its original incarnation,
 *  was test_imapFolderCopy.js  There have been several iterations since
 *  then.
 */

// Make sure we execute this file exactly once
if (typeof gIMAPpump_js__ == "undefined") {
var gIMAPpump_js__ = true;

// We can be executed from multiple depths
// Provide understandable error message
if (typeof gDEPTH == "undefined")
  do_throw("gDEPTH must be defined when using IMAPpump.js");

// add imap fake server methods if missing

if (typeof gMaild_js__ == "undefined")
  load(gDEPTH + "mailnews/fakeserver/maild.js");
if (typeof AuthPLAIN == "undefined")
  load(gDEPTH + "mailnews/fakeserver/auth.js");
if (typeof imapDaemon == "undefined")
  load(gDEPTH + "mailnews/fakeserver/imapd.js");

// Add mailTestUtils for create_incoming_server
load(gDEPTH + "mailnews/resources/mailTestUtils.js");

// define globals
var gIMAPDaemon;         // the imap fake server daemon
var gIMAPServer;         // the imap fake server
var gIMAPIncomingServer; // nsIMsgIncomingServer for the imap server
var gIMAPInbox;          // nsIMsgFolder/nsIMsgImapMailFolder for imap inbox
var gIMAPMailbox;        // imap fake server mailbox

function setupIMAPPump(extensions)
{

  // These are copied from imap's head_server.js to here so we can run
  //   this from any directory.

  const IMAP_PORT = 1024 + 143;

  function makeServer(daemon, infoString) {
    if (infoString in configurations)
      return makeServer(daemon, configurations[infoString].join(","));

    function createHandler(d) {
      var handler = new IMAP_RFC3501_handler(d);
      if (!infoString)
        infoString = "RFC2195";

      var parts = infoString.split(/ *, */);
      for each (var part in parts) {
        if (part.substring(0, 3) == "RFC")
          mixinExtension(handler, eval("IMAP_" + part + "_extension"));
      }
      return handler;
    }
    var server = new nsMailServer(createHandler, daemon);
    server.start(IMAP_PORT);
    return server;
  }

  function createLocalIMAPServer() {
    let server = create_incoming_server("imap", IMAP_PORT, "user", "password");
    server.QueryInterface(Ci.nsIImapIncomingServer);
    return server;
  }

  // end copy from head_server.js

  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, extensions);

  gIMAPIncomingServer = createLocalIMAPServer();

  if (!this.gLocalInboxFolder)
    loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  let localAccount = acctMgr.createAccount();
  let identity = acctMgr.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = gLocalIncomingServer;
  acctMgr.defaultAccount = localAccount;

  // Let's also have another account, using the same identity
  let imapAccount = acctMgr.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = gIMAPIncomingServer;

  // The server doesn't support more than one connection
  Services.prefs.setIntPref("mail.server.default.max_cached_connections",
                            1);
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.default.download_on_biff",
                             false);
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);

  gIMAPIncomingServer.performExpand(null);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("INBOX");
  gIMAPMailbox = gIMAPDaemon.getMailbox("INBOX");
  gIMAPInbox instanceof Ci.nsIMsgImapMailFolder;
}

function teardownIMAPPump()
{
  gIMAPInbox = null;
  gIMAPServer.resetTest();
  try {
    gIMAPIncomingServer.closeCachedConnections();
    let serverSink = gIMAPIncomingServer.QueryInterface(Ci.nsIImapServerSink);
    serverSink.abortQueuedUrls();
  } catch (ex) {dump(ex);}
  gIMAPServer.performTest();
  gIMAPServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

} // end run only once
