/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 *   Kent James <kent@caspia.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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

// define globals
var gIMAPDaemon;         // the imap fake server daemon
var gIMAPServer;         // the imap fake server
var gIMAPIncomingServer; // nsIMsgIncomingServer for the imap server
var gIMAPInbox;          // nsIMsgFolder/nsIMsgImapMailFolder for imap inbox
var gIMAPMailbox;        // imap fake server mailbox

function setupIMAPPump()
{

  // These are copied from imap's head_server.js to here so we can run
  //   this from any directory.

  const IMAP_PORT = 1024 + 143;

  function makeServer(daemon, infoString) {
    if (infoString in configurations)
      return makeServer(daemon, configurations[infoString].join(","));

    var handler = new IMAP_RFC3501_handler(daemon);
    if (!infoString)
      infoString = "RFC2195";

    var parts = infoString.split(/ *, */);
    for each (var part in parts) {
      if (part.substring(0, 3) == "RFC")
        mixinExtension(handler, eval("IMAP_" + part + "_extension"));
    }
    var server = new nsMailServer(handler);
    server.start(IMAP_PORT);
    return server;
  }

  function createLocalIMAPServer() {
    var acctmgr = Cc["@mozilla.org/messenger/account-manager;1"]
                    .getService(Ci.nsIMsgAccountManager);

    var server = acctmgr.createIncomingServer("user", "localhost", "imap");
    server.port = IMAP_PORT;
    server.username = "user";
    server.password = "password";
    server.valid = false;

    var account = acctmgr.createAccount();
    account.incomingServer = server;
    server.valid = true;

    server.QueryInterface(Ci.nsIImapIncomingServer);
    return server;
  }

  // end copy from head_server.js

  gIMAPDaemon = new imapDaemon();
  gIMAPServer = makeServer(gIMAPDaemon, "");

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
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setIntPref("mail.server.default.max_cached_connections", 1);
  // We aren't interested in downloading messages automatically
  prefBranch.setBoolPref("mail.server.default.download_on_biff", false);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);
  prefBranch.setBoolPref("mail.biff.alert.show_preview", false);

  gIMAPIncomingServer.performExpand(null);

  gIMAPInbox = gIMAPIncomingServer.rootFolder.getChildNamed("INBOX");
  gIMAPMailbox = gIMAPDaemon.getMailbox("INBOX");
  gIMAPInbox instanceof Ci.nsIMsgImapMailFolder;
}

function teardownIMAPPump()
{
  gIMAPInbox = null;
  gIMAPServer.resetTest();
  gIMAPIncomingServer.closeCachedConnections();
  gIMAPServer.performTest();
  gIMAPServer.stop();
  let thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);
}

} // end run only once
