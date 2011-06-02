var MODULE_NAME = "test-folder-names-in-favorite-mode";
var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers"];

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
};

function test_folder_names_in_favorite_pane_view_mode() {
  let acc1 = MailServices.accounts.accounts.QueryElementAt(0, Ci.nsIMsgAccount);
  let acc2 = MailServices.accounts.accounts.QueryElementAt(1, Ci.nsIMsgAccount);
  let rootFolder1 = acc1.incomingServer.rootFolder;
  let rootFolder2 = acc2.incomingServer.rootFolder;

  rootFolder1.createSubfolder("uniqueName", null);
  rootFolder1.createSubfolder("duplicatedName", null);
  rootFolder2.createSubfolder("duplicatedName", null);
  rootFolder2.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox).createSubfolder("duplicatedName", null);

  let fUnique = rootFolder1.getChildNamed("uniqueName");
  let fDup1 = rootFolder1.getChildNamed("duplicatedName");
  let fDup2 = rootFolder2.getChildNamed("duplicatedName");
  let fDup3 = rootFolder2.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox).getChildNamed("duplicatedName");
  let inbox = rootFolder2.getFolderWithFlags(Ci.nsMsgFolderFlags.Inbox);

  fUnique.flags |= Ci.nsMsgFolderFlags.Favorite;
  fDup1.flags |= Ci.nsMsgFolderFlags.Favorite;
  fDup2.flags |= Ci.nsMsgFolderFlags.Favorite;
  fDup3.flags |= Ci.nsMsgFolderFlags.Favorite;
  inbox.flags &= ~Ci.nsMsgFolderFlags.Favorite;

  mc.window.gFolderTreeView.mode = "favorite";

  assert_folder_at_index_as(0, "duplicatedName - Local Folders");
  assert_folder_at_index_as(1, "duplicatedName - tinderbox@invalid.com");
  assert_folder_at_index_as(2, "duplicatedName - tinderbox@invalid.com");
  assert_folder_at_index_as(3, "uniqueName");

  // Reset the flags to the state they were previously.
  fUnique.flags &= ~Ci.nsMsgFolderFlags.Favorite;
  fDup1.flags &= ~Ci.nsMsgFolderFlags.Favorite;
  fDup2.flags &= ~Ci.nsMsgFolderFlags.Favorite;
  fDup3.flags &= ~Ci.nsMsgFolderFlags.Favorite;
  inbox.flags |= Ci.nsMsgFolderFlags.Favorite;
};
