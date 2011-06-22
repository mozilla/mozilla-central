/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for auto-detecting attachment file charset.
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gSmtpServer;
var gDraftFolder;
var gCurTestNum = 0;
var gAttachedFilePath = null;

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
      do_timeout(0, function() { doTest(++gCurTestNum); });
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress,
    aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onLocationChange: function(aWebProgress, aRequest, aLocation) {},
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

function createMessage(folding)
{
  Services.prefs.setIntPref("mail.strictly_mime.parm_folding", folding);

  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  var params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;

  var msgCompose = MailServices.compose.initCompose(params);
  var identity = getSmtpIdentity(null, gSmtpServer);

  var rootFolder = gLocalIncomingServer.rootMsgFolder;
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

  var attachment = Cc["@mozilla.org/messengercompose/attachment;1"]
                     .createInstance(Ci.nsIMsgAttachment);
  //Set attachment file
  attachment.url = "file://" + gAttachedFilePath;
  attachment.contentType = 'text/plain';
  attachment.name = "test-UTF-8.txt";
  fields.addAttachment(attachment);

  var progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
}

function checkAttachment()
{
  var fileData = loadFileToString(gDraftFolder.filePath);
  var pos = fileData.indexOf("Content-Type: text/plain; charset=UTF-8;");
  do_check_neq(pos, -1);
  do_timeout(0, function() {doTest(++gCurTestNum);});
}

const gTestArray =
[
  function createMessage1() { createMessage(0); },
  function checkAttachment1() { checkAttachment(); }
]

function run_test()
{
  // Ensure we have at least one mail account
  loadLocalMailAccount();

  gSmtpServer = getBasicSmtpServer();

  var attachment_file = do_get_file("data/test-UTF-8.txt");
  gAttachedFilePath = attachment_file.path;
  do_test_pending();

  doTest(1);
}

function doTest(test)
{
  dump("doTest " + test + "\n");
  if (test <= gTestArray.length) {
    gCurTestNum = test;
 
    var testFn = gTestArray[test-1];

    // Set a limit in case the notifications haven't arrived (i.e. a problem)
    do_timeout(10000, function()
    {
      if (gCurTestNum == test)
        do_throw(
          "Notifications not received in 10000 ms for operation " +
          testFn.name);
    });
    try {
      testFn();
    } catch(ex) {
      dump(ex);
      do_throw(ex);
    }
  }
  else {
    do_test_finished(); // for the one in run_test()
  }
}
