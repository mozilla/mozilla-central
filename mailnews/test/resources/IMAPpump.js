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

var EXPORTED_SYMBOLS = [
  'IMAPPump',
  'setupIMAPPump',
  'teardownIMAPPump'
];

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/Services.jsm");
Components.utils.import("resource:///modules/XPCOMUtils.jsm");
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");
Components.utils.import("resource://testing-common/mailnews/maild.js");
Components.utils.import("resource://testing-common/mailnews/auth.js");
Components.utils.import("resource://testing-common/mailnews/imapd.js");
Components.utils.import("resource://testing-common/AppInfo.jsm");

// define globals
var IMAPPump = {
  daemon: null,         // the imap fake server daemon
  server: null,         // the imap fake server
  incomingServer: null, // nsIMsgIncomingServer for the imap server
  inbox: null,          // nsIMsgFolder/nsIMsgImapMailFolder for imap inbox
  mailbox: null         // imap fake server mailbox
};
var Ci = Components.interfaces;

function setupIMAPPump(extensions)
{
  // Create Application info if we need it.
  updateAppInfo();

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
        mixinExtension(handler, eval("IMAP_" + part + "_extension"));
      }
      return handler;
    }
    var server = new nsMailServer(createHandler, daemon);
    server.start(IMAP_PORT);
    return server;
  }

  function createLocalIMAPServer() {
    let server = localAccountUtils.create_incoming_server("imap", IMAP_PORT,
							  "user", "password");
    server.QueryInterface(Ci.nsIImapIncomingServer);
    return server;
  }

  // end copy from head_server.js

  IMAPPump.daemon = new imapDaemon();
  IMAPPump.server = makeServer(IMAPPump.daemon, extensions);

  IMAPPump.incomingServer = createLocalIMAPServer();

  if (!localAccountUtils.inboxFolder)
    localAccountUtils.loadLocalMailAccount();

  // We need an identity so that updateFolder doesn't fail
  let localAccount = MailServices.accounts.createAccount();
  let identity = MailServices.accounts.createIdentity();
  localAccount.addIdentity(identity);
  localAccount.defaultIdentity = identity;
  localAccount.incomingServer = localAccountUtils.incomingServer;
  MailServices.accounts.defaultAccount = localAccount;

  // Let's also have another account, using the same identity
  let imapAccount = MailServices.accounts.createAccount();
  imapAccount.addIdentity(identity);
  imapAccount.defaultIdentity = identity;
  imapAccount.incomingServer = IMAPPump.incomingServer;

  // The server doesn't support more than one connection
  Services.prefs.setIntPref("mail.server.default.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  Services.prefs.setBoolPref("mail.server.default.download_on_biff", false);
  Services.prefs.setBoolPref("mail.biff.play_sound", false);
  Services.prefs.setBoolPref("mail.biff.show_alert", false);
  Services.prefs.setBoolPref("mail.biff.show_tray_icon", false);
  Services.prefs.setBoolPref("mail.biff.animate_dock_icon", false);
  Services.prefs.setBoolPref("mail.biff.alert.show_preview", false);

  IMAPPump.incomingServer.performExpand(null);

  IMAPPump.inbox = IMAPPump.incomingServer.rootFolder.getChildNamed("INBOX");
  IMAPPump.mailbox = IMAPPump.daemon.getMailbox("INBOX");
  IMAPPump.inbox instanceof Ci.nsIMsgImapMailFolder;
}

function teardownIMAPPump()
{
  IMAPPump.inbox = null;
  IMAPPump.server.resetTest();
  try {
    IMAPPump.incomingServer.closeCachedConnections();
    let serverSink = IMAPPump.incomingServer.QueryInterface(Ci.nsIImapServerSink);
    serverSink.abortQueuedUrls();
  } catch (ex) {dump(ex);}
  IMAPPump.server.performTest();
  IMAPPump.server.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}
