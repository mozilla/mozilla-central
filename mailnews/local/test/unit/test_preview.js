const bugmail10 = do_get_file("../../../data/bugmail10");
const bugmail11 = do_get_file("../../../data/bugmail11");
const bugmail10_preview = 'Do not reply to this email. You can add comments to this bug at https://bugzilla.mozilla.org/show_bug.cgi?id=436880 -- Configure bugmail: https://bugzilla.mozilla.org/userprefs.cgi?tab=email ------- You are receiving this mail because: -----';
const bugmail11_preview = 'Bugzilla has received a request to create a user account using your email address (example@example.org). To confirm that you want to create an account using that email address, visit the following link: https://bugzilla.mozilla.org/token.cgi?t=xxx';

function run_test() {
  do_test_pending();
  copyFileMessageInLocalFolder(bugmail10, 0, "", null, copy_next_message);
}

function copy_next_message(aMessageHeaderKeys, aStatus) {
  copyFileMessageInLocalFolder(bugmail11, 0, "", null, test_preview);
}

function test_preview(aMessageHeaderKeys, aStatus) {
  let headerKeys = aMessageHeaderKeys;
  do_check_neq(headerKeys, null);
  do_check_eq(headerKeys.length, 2);
  try {
    localAccountUtils.inboxFolder.fetchMsgPreviewText(headerKeys,
                                          headerKeys.length, false, null);
    do_check_eq(localAccountUtils.inboxFolder.GetMessageHeader(headerKeys[0]).getStringProperty('preview'),
                bugmail10_preview);
    do_check_eq(localAccountUtils.inboxFolder.GetMessageHeader(headerKeys[1]).getStringProperty('preview'),
                bugmail11_preview);
  } catch(ex) {dump(ex); do_throw(ex) }
  do_test_finished();
}
