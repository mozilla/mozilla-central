gDEPTH = "../../../../";

// Import the main scripts that mailnews tests need to set up and tear down
load("../../../resources/mailDirService.js");
load("../../../resources/mailTestUtils.js");

// Import the pop3 server scripts
load("../../../fakeserver/maild.js")
load("../../../fakeserver/auth.js")
load("../../../fakeserver/pop3d.js")

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
      do_timeout_function(0, this.callbackFunction,
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
  Cc["@mozilla.org/messenger/messagecopyservice;1"]
    .getService(Ci.nsIMsgCopyService)
    .CopyFileMessage(aMessageFile,
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
