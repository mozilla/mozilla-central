/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Test handling of special chars in folder names
 */

Components.utils.import("resource:///modules/mailServices.js");

var server;

function run_test() {
  // test file with ':' in the name (generated from Mozilla 1.8 branch).
  let bugmail = do_get_file("../../../data/bugmail-1");
  let bugmailmsf = do_get_file("../../../data/bugmail-1.msf");
  let localMailDir = do_get_profile().clone();
  localMailDir.append("Mail");
  localMailDir.append("Local Folders");
  let pop3dir = do_get_profile().clone();
  pop3dir.append("Mail");
  pop3dir.append("poptest");
  // Copy the file to the local mail directory
  bugmail.copyTo(localMailDir, "bugmail:1");
  bugmailmsf.copyTo(localMailDir, "bugmail:1.msf");

  // Copy the file to the pop3 server mail directory
  bugmail.copyTo(pop3dir, "bugmail:1");
  bugmailmsf.copyTo(pop3dir, "bugmail:1.msf");

  // These preferences set up a local folders account so we'll use the
  // contents of the Local Folders dir we've already pre-populated.
  Services.prefs.setCharPref("mail.account.account1.server", "server1");
  Services.prefs.setCharPref("mail.account.account2.server", "server2");
  Services.prefs.setCharPref("mail.accountmanager.accounts",
                             "account1,account2");
  Services.prefs.setCharPref("mail.accountmanager.localfoldersserver",
                             "server1");
  Services.prefs.setCharPref("mail.accountmanager.defaultaccount",
                             "account1");
  Services.prefs.setCharPref("mail.server.server1.directory-rel",
                             "[ProfD]Mail/Local Folders");
  Services.prefs.setCharPref("mail.server.server1.hostname",
                             "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.name", "Local Folders");
  Services.prefs.setCharPref("mail.server.server1.type", "none");
  Services.prefs.setCharPref("mail.server.server1.userName", "nobody");
  Services.prefs.setCharPref("mail.server.server2.directory-rel",
                             "[ProfD]Mail/poptest");
  Services.prefs.setCharPref("mail.server.server2.hostname", "poptest");
  Services.prefs.setCharPref("mail.server.server2.name", "poptest");
  Services.prefs.setCharPref("mail.server.server2.type", "pop3");
  Services.prefs.setCharPref("mail.server.server2.userName", "user");
  // This basically says to ignore the time stamp in the .msf file
  Services.prefs.setIntPref("mail.db_timestamp_leeway", 0x7FFFFFFF);
  
  localAccountUtils.incomingServer = MailServices.accounts.localFoldersServer;
  // force load of accounts.
  let defaultAccount = MailServices.accounts.defaultAccount;

  let pop3Server = MailServices.accounts.FindServer("user", "poptest", "pop3");
  var rootFolder = localAccountUtils.incomingServer.rootMsgFolder
    .QueryInterface(Ci.nsIMsgLocalMailFolder);
  let pop3Root = pop3Server.rootMsgFolder;
  
  // Note: Inbox is not created automatically when there is no deferred server,
  // so we need to create it.
  localAccountUtils.inboxFolder = rootFolder.createLocalSubfolder("Inbox");
  // a local inbox should have a Mail flag!
  localAccountUtils.inboxFolder.setFlag(Ci.nsMsgFolderFlags.Mail);
  
  let rootFolder = localAccountUtils.incomingServer.rootMsgFolder;
  let bugmail = rootFolder.getChildNamed("bugmail:1");
  do_check_eq(bugmail.getTotalMessages(false), 1);
  bugmail = pop3Root.getChildNamed("bugmail:1");
  do_check_eq(bugmail.getTotalMessages(false), 1);
}
