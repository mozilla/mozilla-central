Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://testing-common/mailnews/mailDirService.js");
Components.utils.import("resource://testing-common/mailnews/mailTestUtils.js");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

var gProfileDir = ProfileDir.initialize(do_get_profile());

var gDEPTH = "../../../../";

// Import the main scripts that mailnews tests need to set up and tear down
load("../../../resources/localAccountUtils.js");

// Import the pop3 server scripts
Components.utils.import("resource://testing-common/mailnews/maild.js");
load("../../../fakeserver/auth.js");
load("../../../fakeserver/pop3d.js");

Components.utils.import("resource:///modules/mailServices.js");

const POP3_PORT = 1024+110;

// Setup the daemon and server
// If the debugOption is set, then it will be applied to the server.
function setupServerDaemon(debugOption) {
  var daemon = new pop3Daemon();
  var extraProps = {};
  function createHandler(d) {
    var handler = new POP3_RFC5034_handler(d);
    for (var prop in extraProps) {
      handler[prop] = extraProps[prop];
    }
    return handler;
  }
  var server = new nsMailServer(createHandler, daemon);
  if (debugOption)
    server.setDebugLevel(debugOption);
  return [daemon, server, extraProps];
}

function createPop3ServerAndLocalFolders() {
  loadLocalMailAccount();
  let server = create_incoming_server("pop3", POP3_PORT, "fred", "wilma");
  return server;
}

var gCopyListener =
{
  callbackFunction: null,
  copiedMessageHeaderKeys: [],
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) {
    try {
      this.copiedMessageHeaderKeys.push(aKey);
    } catch (ex) {
      dump(ex);
    }
  },
  GetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) {
    if (this.callbackFunction) {
      mailTestUtils.do_timeout_function(0, this.callbackFunction,
					null,
					[ this.copiedMessageHeaderKeys, aStatus ]);
    }
  }
};

/**
 * copyFileMessageInLocalFolder
 * A utility wrapper of nsIMsgCopyService.CopyFileMessage to copy a message
 * into local inbox folder.
 *
 * @param aMessageFile     An instance of nsILocalFile to copy.
 * @param aMessageFlags    Message flags which will be set after message is
 *                         copied
 * @param aMessageKeyword  Keywords which will be set for newly copied
 *                         message
 * @param aMessageWindow   Window for notification callbacks, can be null
 * @param aCallback        Callback function which will be invoked after
 *                         message is copied
 */
function copyFileMessageInLocalFolder(aMessageFile,
                                      aMessageFlags,
                                      aMessageKeywords,
                                      aMessageWindow,
                                      aCallback) {
  // Set up local folders
  loadLocalMailAccount();

  gCopyListener.callbackFunction = aCallback;
  // Copy a message into the local folder
  MailServices.copy.CopyFileMessage(aMessageFile,
                                    gLocalInboxFolder,
                                    null, false,
                                    aMessageFlags,
                                    aMessageKeywords,
                                    gCopyListener,
                                    aMessageWindow);
}

function do_check_transaction(real, expected) {
  // If we don't spin the event loop before starting the next test, the readers
  // aren't expired. In this case, the "real" real transaction is the last one.
  if (real instanceof Array)
    real = real[real.length - 1];

  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}

function create_temporary_directory() {
  let directory = Services.dirsvc.get("TmpD", Ci.nsIFile);
  directory.append("mailFolder");
  directory.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0700);
  return directory;
}

function create_sub_folders(parent, subFolders) {
  parent.leafName = parent.leafName + ".sbd";
  parent.create(Ci.nsIFile.DIRECTORY_TYPE, parseInt("0700", 8));

  for (let folder in subFolders) {
    let subFolder = parent.clone();
    subFolder.append(subFolders[folder].name);
    subFolder.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0600", 8));
    if (subFolders[folder].subFolders)
      create_sub_folders(subFolder, subFolders[folder].subFolders);
  }
}

function create_mail_directory(subFolders) {
  let root = create_temporary_directory();

  for (let folder in subFolders) {
    if (!subFolders[folder].subFolders)
      continue;
    let directory = root.clone();
    directory.append(subFolders[folder].name);
    create_sub_folders(directory, subFolders[folder].subFolders);
  }

  return root;
}

function setup_mailbox(type, mailboxPath) {
  let user = Cc["@mozilla.org/uuid-generator;1"]
               .getService(Ci.nsIUUIDGenerator)
               .generateUUID().toString();
  let incomingServer =
    MailServices.accounts.createIncomingServer(user, "Local Folder", type);
  incomingServer.localPath = mailboxPath;

  return incomingServer.rootFolder;
}

