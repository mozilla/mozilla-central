/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsIMsgFolder functions.
 */

Components.utils.import("resource:///modules/mailServices.js");

function run_test() {
  // Create a local mail account (we need this first)
  MailServices.accounts.createLocalMailAccount();

  // Get the account
  let account = MailServices.accounts.accounts.queryElementAt(0, Components.interfaces.nsIMsgAccount);

  // Get the root folder
  var root = account.incomingServer.rootFolder;

  // Add a sub folder to ensure that we have some folders created
  root.createSubfolder("folder1", null);

  // Test - getChildNamed

  var caught = false;
  try {
    root.getChildNamed("folder");
  }
  catch (e) {
    caught = true;
  }
  do_check_eq(caught, true);

  caught = false;
  try {
    root.getChildNamed("Trash1");
  }
  catch (e) {
    caught = true;
  }
  do_check_eq(caught, true);

  var folder1 = root.getChildNamed("folder1");

  do_check_neq(folder1, folder2);
  do_check_eq(folder1.prettiestName, "folder1");

  var folder2 = root.getChildNamed("FOLDER1");

  do_check_eq(folder1, folder2);

  // Check special folders aren't deletable, and that normal folders are.
  if (!root.containsChildNamed("Inbox"))
    root.createSubfolder("Inbox", null);
  var inbox = root.getChildNamed("Inbox");
  inbox.setFlag(Ci.nsMsgFolderFlags.Inbox);
  do_check_false(inbox.deletable);

  if (!root.containsChildNamed("Drafts"))
    root.createSubfolder("Drafts", null);
  var drafts = root.getChildNamed("Drafts");
  drafts.setFlag(Ci.nsMsgFolderFlags.Drafts);
  do_check_false(drafts.deletable);

  if (!root.containsChildNamed("Templates"))
    root.createSubfolder("Templates", null);
  var templates = root.getChildNamed("Templates");
  templates.setFlag(Ci.nsMsgFolderFlags.Templates);
  do_check_false(templates.deletable);

  if (!root.containsChildNamed("Sent"))
     root.createSubfolder("Sent", null);
  var sent = root.getChildNamed("Sent");
  sent.setFlag(Ci.nsMsgFolderFlags.SentMail);
  do_check_false(sent.deletable);

  if (!root.containsChildNamed("Archives"))
    root.createSubfolder("Archives", null);
  var archives = root.getChildNamed("Archives");
  archives.setFlag(Ci.nsMsgFolderFlags.Archive);
  do_check_false(archives.deletable);

  if (!root.containsChildNamed("Trash"))
    root.createSubfolder("Trash", null);
  var trash = root.getChildNamed("Trash");
  trash.setFlag(Ci.nsMsgFolderFlags.Trash);
  do_check_false(trash.deletable);

  if (!root.containsChildNamed("Outbox"))
    root.createSubfolder("Outbox", null);
  var outbox = root.getChildNamed("Outbox");
  outbox.setFlag(Ci.nsMsgFolderFlags.Queue);
  do_check_false(outbox.deletable);

  // test a normal folder is deletable
  do_check_true(folder1.deletable);
}
