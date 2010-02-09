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
 * David Bienvenu <bienvenu@mozillamessaging.com>.
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

// Test of chaining of search scopes in a search session. In particular,
//  Bug 541969 made us not search an imap folder if the search scope before it
// there was an empty local folder.

// main test

load("../../mailnews/resources/messageGenerator.js");

var gIMAPInbox;
var gServer, gIMAPIncomingServer;

const gIMAPService = Cc["@mozilla.org/messenger/messageservice;1?type=imap"]
                       .getService(Ci.nsIMsgMessageService);

// Globals
var gIMAPDaemon, gServer, gIMAPIncomingServer;

function run_test()
{
  // Pull in the IMAP fake server code
  load("../../test_imap/unit/head_server.js");

  loadLocalMailAccount();

  /*
   * Set up an IMAP server.
   */
  let IMAPDaemon = new imapDaemon();
  gServer = makeServer(IMAPDaemon, "");
  IMAPDaemon.createMailbox("secondFolder", {subscribed : true});
  gIMAPIncomingServer = createLocalIMAPServer();
  gIMAPIncomingServer.maximumConnectionsNumber = 1;

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
  
  // pref tuning: one connection only, turn off notifications
  let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
  prefBranch.setBoolPref("mail.biff.play_sound", false);
  prefBranch.setBoolPref("mail.biff.show_alert", false);
  prefBranch.setBoolPref("mail.biff.show_tray_icon", false);
  prefBranch.setBoolPref("mail.biff.animate_dock_icon", false);

  // add a single message to the imap inbox.
  let messages = [];
  let gMessageGenerator = new MessageGenerator();
  messages = messages.concat(gMessageGenerator.makeMessage());
  gSynthMessage = messages[0];

  let ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  let msgURI =
    ioService.newURI("data:text/plain;base64," +
                     btoa(gSynthMessage.toMessageString()),
                     null, null);
  let imapInbox =  IMAPDaemon.getMailbox("INBOX")
  gMessage = new imapMessage(msgURI.spec, imapInbox.uidnext++, []);
  imapInbox.addMessage(gMessage);

  // Get the IMAP inbox...
  let rootFolder = gIMAPIncomingServer.rootFolder;
  gIMAPInbox = rootFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox)
                         .QueryInterface(Ci.nsIMsgImapMailFolder);

  // update folder to download header.
  gIMAPInbox.updateFolderWithListener(null, UrlListener);
  do_test_pending();
}

var UrlListener = 
{
  OnStartRunningUrl: function(url) { },
  OnStopRunningUrl: function(url, rc)
  {
    // Check for ok status.
    do_check_eq(rc, 0);
    searchTest();
  }
};

function searchTest()
{
  // Get the IMAP inbox...
  emptyLocal1 = gLocalIncomingServer.rootFolder.addSubfolder("empty 1");

  let searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);

  let searchTerm = searchSession.createTerm();
  searchTerm.matchAll = true;
  searchSession.appendTerm(searchTerm);
  searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, emptyLocal1);
  searchSession.addScopeTerm(Ci.nsMsgSearchScope.onlineMail, gIMAPInbox);
  searchSession.registerListener(searchListener);
  searchSession.search(null);
}

var numTotalMessages;

// nsIMsgSearchNotify implementation
var searchListener =
{ 
  onNewSearch: function() 
  {
    numTotalMessages = 0;
  },
  onSearchHit: function(dbHdr, folder)
  {
    numTotalMessages++;
  },
  onSearchDone: function(status)
  { 
    do_check_eq(numTotalMessages, 1);
    do_timeout(1000, endTest);
    return true;
  }
};

function endTest()
{
  // Cleanup, null out everything, close all cached connections and stop the
  // server
  gIMAPIncomingServer.closeCachedConnections();
  gServer.stop();

  var thread = gThreadManager.currentThread;
  while (thread.hasPendingEvents())
    thread.processNextEvent(true);

  do_test_finished();
}
