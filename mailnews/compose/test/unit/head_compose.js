Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/IOUtils.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://testing-common/mailnews/mailTestUtils.js");
Components.utils.import("resource://testing-common/mailnews/localAccountUtils.js");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var CC = Components.Constructor;

// Ensure the profile directory is set up
do_get_profile();

var gDEPTH = "../../../../";

// Import the required setup scripts.
load("../../../resources/abSetup.js");

// Import the smtp server scripts
Components.utils.import("resource://testing-common/mailnews/maild.js");
Components.utils.import("resource://testing-common/mailnews/smtpd.js");
Components.utils.import("resource://testing-common/mailnews/auth.js");

Components.utils.import("resource:///modules/mailServices.js");

const SMTP_PORT = 1024+120;
var gDraftFolder;

// Setup the daemon and server
function setupServerDaemon(handler) {
  if (!handler)
    handler = function (d) { return new SMTP_RFC2821_handler(d); };
  var server = new nsMailServer(handler, new smtpDaemon());
  return server;
}

function getBasicSmtpServer() {
  let server = localAccountUtils.create_outgoing_server(SMTP_PORT, "user", "password");

  // Override the default greeting so we get something predicitable
  // in the ELHO message
  Services.prefs.setCharPref("mail.smtpserver.default.hello_argument", "test");

  return server;
}

function getSmtpIdentity(senderName, smtpServer) {
  // Set up the identity
  let identity = MailServices.accounts.createIdentity();
  identity.email = senderName;
  identity.smtpServerKey = smtpServer.key;

  return identity;
}

var test;

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}

// This listener is designed just to call OnStopCopy() when its OnStopCopy
// function is called - the rest of the functions are unneeded for a lot of
// tests (but we can't use asyncCopyListener because we need the
// nsIMsgSendListener interface as well).
var copyListener = {
  // nsIMsgSendListener
  onStartSending: function (aMsgID, aMsgSize) {},
  onProgress: function (aMsgID, aProgress, aProgressMax) {},
  onStatus: function (aMsgID, aMsg) {},
  onStopSending: function (aMsgID, aStatus, aMsg, aReturnFile) {},
  onGetDraftFolderURI: function (aFolderURI) {},
  onSendNotPerformed: function (aMsgID, aStatus) {},

  // nsIMsgCopyServiceListener
  OnStartCopy: function () {},
  OnProgress: function (aProgress, aProgressMax) {},
  SetMessageKey: function (aKey) {},
  GetMessageId: function (aMessageId) {},
  OnStopCopy: function (aStatus) {
    OnStopCopy(aStatus);
  },

  // QueryInterface
  QueryInterface: function (iid) {
    if (iid.equals(Ci.nsIMsgSendListener) ||
        iid.equals(Ci.nsIMsgCopyServiceListener) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)
      async_driver();
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress,
    aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags) {},
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {},
  onSecurityChange: function(aWebProgress, aRequest, state) {},

  QueryInterface : function(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsISupportsWeakReference) ||
        iid.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};

function createMessage(aAttachment) {
  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;

  let msgCompose = MailServices.compose.initCompose(params);
  let identity = getSmtpIdentity(null, getBasicSmtpServer());

  let rootFolder = localAccountUtils.rootFolder;
  gDraftFolder = null;
  // Make sure the drafts folder is empty
  try {
    gDraftFolder = rootFolder.getChildNamed("Drafts");
    // try to delete
    rootFolder.propagateDelete(gDraftFolder, true, null);
  } catch (e) {
    // we don't have to remove the folder because it doen't exist yet
  }
  // Create a new, empty drafts folder
  gDraftFolder = rootFolder.createLocalSubfolder("Drafts");

  // Set attachment
  if (aAttachment) {
    let attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                       .createInstance(Ci.nsIMsgAttachment);
    if (aAttachment instanceof Ci.nsIFile) {
      attachment.url = "file://" + aAttachment.path;
      attachment.contentType = 'text/plain';
      attachment.name = aAttachment.leafName;
    } else {
      attachment.url = "data:,";
      attachment.name = aAttachment;
    }
    fields.addAttachment(attachment);
  }

  let progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
  return false;
}

function getAttachmentFromContent(aContent) {
  function getBoundaryStringFromContent(aContent) {
    let found = aContent.match(/Content-Type: multipart\/mixed;\s+boundary="(.*?)"/);
    do_check_neq(found, null);
    do_check_eq(found.length, 2);

    return found[1];
  };

  let boundary = getBoundaryStringFromContent(aContent);
  let regex = new RegExp("\\r\\n\\r\\n--" + boundary + "\\r\\n" +
                         "([\\s\\S]*?)\\r\\n" +
                         "--" + boundary + "--", "m");
  let attachments = aContent.match(regex);
  do_check_neq(attachments, null);
  do_check_eq(attachments.length, 2);
  return attachments[1];
}

