/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test handling of special chars in folder names
 */


var server;

function run_test() {
  // Currently, we're only doing a mac-specific test. If we extend
  // this test to include other platforms, we'd need to only do the
  // ':' file name test on the mac.
  if (! ("nsILocalFileMac" in Components.interfaces))
    return;
  // test file with ':' in the name (generated from Mozilla 1.8 branch).
  let bugmail = do_get_file("../../mailnews/data/bugmail-1");
  let bugmailmsf = do_get_file("../../mailnews/data/bugmail-1.msf");
  let localMailDir = gProfileDir.clone();
  localMailDir.append("Mail");
  localMailDir.append("Local Folders");
  let pop3dir = gProfileDir.clone();
  pop3dir.append("Mail");
  pop3dir.append("poptest");
  // Copy the file to the local mail directory
  bugmail.copyTo(localMailDir, "bugmail/1");
  bugmailmsf.copyTo(localMailDir, "bugmail/1.msf");

  // Copy the file to the pop3 server mail directory
  bugmail.copyTo(pop3dir, "bugmail/1");
  bugmailmsf.copyTo(pop3dir, "bugmail/1.msf");

  const prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                 .getService(Components.interfaces.nsIPrefBranch);
  // These preferences set up a local folders account so we'll use the
  // contents of the Local Folders dir we've already pre-populated.
  prefSvc.setCharPref("mail.account.account1.server", "server1");
  prefSvc.setCharPref("mail.account.account2.server", "server2");
  prefSvc.setCharPref("mail.accountmanager.accounts", "account1,account2");
  prefSvc.setCharPref("mail.accountmanager.localfoldersserver", "server1");
  prefSvc.setCharPref("mail.accountmanager.defaultaccount", "account1");
  prefSvc.setCharPref("mail.server.server1.directory-rel", "[ProfD]Mail/Local Folders");
  prefSvc.setCharPref("mail.server.server1.hostname", "Local Folders");
  prefSvc.setCharPref("mail.server.server1.name", "Local Folders");
  prefSvc.setCharPref("mail.server.server1.type", "none");
  prefSvc.setCharPref("mail.server.server1.userName", "nobody");
  prefSvc.setCharPref("mail.server.server2.directory-rel", "[ProfD]Mail/poptest");
  prefSvc.setCharPref("mail.server.server2.hostname", "poptest");
  prefSvc.setCharPref("mail.server.server2.name", "poptest");
  prefSvc.setCharPref("mail.server.server2.type", "pop3");
  prefSvc.setCharPref("mail.server.server2.userName", "user");
  // This basically says to ignore the time stamp in the .msf file
  prefSvc.setIntPref("mail.db_timestamp_leeway", 0x7FFFFFFF);
  
  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
  .getService(Ci.nsIMsgAccountManager);
  
  gLocalIncomingServer = acctMgr.localFoldersServer;
  // force load of accounts.
  let defaultAccount = acctMgr.defaultAccount;

  let pop3Server = acctMgr.FindServer("user", "poptest", "pop3");
  var rootFolder = gLocalIncomingServer.rootMsgFolder;
  let pop3Root = pop3Server.rootMsgFolder;
  
  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  gLocalInboxFolder = rootFolder.addSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  gLocalInboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
  
  let rootFolder = gLocalIncomingServer.rootMsgFolder;
  let bugmail = rootFolder.getChildNamed("bugmail:1");
  do_check_eq(bugmail.getTotalMessages(false), 1);
  bugmail = pop3Root.getChildNamed("bugmail:1");
  do_check_eq(bugmail.getTotalMessages(false), 1);
}
