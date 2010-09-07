const bugmail10 = do_get_file("../../../data/bugmail10");
const bugmail11 = do_get_file("../../../data/bugmail11");
const bugmail10_preview = 'Do not reply to this email. You can add comments to this bug at https://bugzilla.mozilla.org/show_bug.cgi?id=436880 -- Configure bugmail: https://bugzilla.mozilla.org/userprefs.cgi?tab=email ------- You are receiving this mail because: -----';
const bugmail11_preview = 'Bugzilla has received a request to create a user account using your email address (example@example.org). To confirm that you want to create an account using that email address, visit the following link: https://bugzilla.mozilla.org/token.cgi?t=xxx';

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

var hdrs = [];

function run_test() {
  loadLocalMailAccount();

  // "Master" do_test_pending(), paired with a do_test_finished() at the end of
  // all the operations.
  do_test_pending();

  copyService.CopyFileMessage(bugmail10, gLocalInboxFolder, null, false, 0,
                              "", copyListener, null);
  return true;
}

// nsIMsgCopyServiceListener implementation
var copyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    hdrs.push(aKey);
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) {
    copyService.CopyFileMessage(bugmail11, gLocalInboxFolder, null, false, 0,
                                "", copyListener2, null);
  }
};

// nsIMsgCopyServiceListener implementation
var copyListener2 =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    hdrs.push(aKey);
  },
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    gLocalInboxFolder.fetchMsgPreviewText(hdrs, hdrs.length, false, null);
    do_check_eq(gLocalInboxFolder.GetMessageHeader(hdrs[0]).getStringProperty('preview'),
                bugmail10_preview);
    do_check_eq(gLocalInboxFolder.GetMessageHeader(hdrs[1]).getStringProperty('preview'),
                bugmail11_preview);
    do_test_finished();
  }
};
