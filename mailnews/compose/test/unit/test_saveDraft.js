/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for checking correctly saved as draft with unread.
 */

var gSmtpServer;
var gDraftFolder;
var gCurTestNum = 0;

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP){
      do_timeout(0, function(){doTest(++gCurTestNum);});
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
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

function createMessage() {
  var msgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                     .createInstance(Ci.nsIMsgCompose);
  var fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  var params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.composeFields = fields;
  msgCompose.initialize(params);
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
  gDraftFolder = rootFolder.addSubfolder("Drafts");

  var progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);
  msgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                     progress);
}

function checkResult() {
  do_check_eq(gDraftFolder.getTotalMessages(false), 1);
  do_check_eq(gDraftFolder.getNumUnread(false), 1);

  do_timeout(0, function(){doTest(++gCurTestNum);});
}

const gTestArray =
[
 createMessage,
 checkResult,
];

function run_test() {
  // Ensure we have at least one mail account
  loadLocalMailAccount();

  gSmtpServer = getBasicSmtpServer();

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
    do_timeout(10000, function() {
        if(gCurTestNum == test)
	  do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
        }
      );
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
