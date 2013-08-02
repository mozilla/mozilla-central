/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that temporary files for draft are surely removed.
 */

Components.utils.import("resource://gre/modules/Services.jsm");

var gMsgCompose;
var gExpectedFiles;

var progressListener = {
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)
      do_timeout(0, check_result);
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
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

function get_temporary_files_for(name) {
  let file = Services.dirsvc.get("TmpD", Ci.nsIFile);
  file.append(name);
  file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

  file.remove(false);

  return file;
}

function collect_expected_temporary_files() {
  let files = [];

  files.push(get_temporary_files_for("nsemail.html"));
  files.push(get_temporary_files_for("nsemail.eml"));
  files.push(get_temporary_files_for("nscopy.tmp"));

  return files;
}

function check_files_not_exist(files) {
  files.forEach(function(file) {
    do_check_false(file.exists());
  });
}

function check_result() {
  // temp files should be deleted as soon as the draft is finished saving.
  check_files_not_exist(gExpectedFiles);

  do_test_finished();
}

function run_test() {
  gExpectedFiles = collect_expected_temporary_files();
  do_register_cleanup(function() {
    gExpectedFiles.forEach(function(file) {
      if (file.exists())
        file.remove(false);
    });
  });

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();

  gMsgCompose = Cc["@mozilla.org/messengercompose/compose;1"]
                  .createInstance(Ci.nsIMsgCompose);
  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);

  fields.body = "body text";
  // set multipart for nsemail.html
  fields.useMultipartAlternative = true;

  params.composeFields = fields;
  params.format = Ci.nsIMsgCompFormat.HTML;

  gMsgCompose.initialize(params, null, null);

  let identity = getSmtpIdentity(null, getBasicSmtpServer());

  let draftFolder = localAccountUtils.rootFolder.createLocalSubfolder("Drafts");

  let progress = Cc["@mozilla.org/messenger/progress;1"]
                   .createInstance(Ci.nsIMsgProgress);
  progress.registerListener(progressListener);

  do_test_pending();

  gMsgCompose.SendMsg(Ci.nsIMsgSend.nsMsgSaveAsDraft, identity, "", null,
                      progress);
}

