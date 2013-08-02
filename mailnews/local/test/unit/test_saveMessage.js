/*
 * Test bug 460636 - Saving message in local folder as .EML removes starting dot in all lines, and ignores line if single dot only line.
 */

Components.utils.import("resource:///modules/IOUtils.js");

const MSG_LINEBREAK = "\r\n";
const dot = do_get_file("data/dot");
let saveFile = Services.dirsvc.get("TmpD", Ci.nsIFile);
saveFile.append(dot.leafName + ".eml");
saveFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

function run_test()
{
  do_register_cleanup(teardown);
  do_test_pending();
  do_timeout(10000, function() {
    do_throw('SaveMessageToDisk did not complete within 10 seconds' +
      '(incorrect messageURI?). ABORTING.');
  });
  copyFileMessageInLocalFolder(dot, 0, "", null, save_message);
}

function save_message(aMessageHeaderKeys, aStatus) {
  let headerKeys = aMessageHeaderKeys;
  do_check_neq(headerKeys, null);

  let message = localAccountUtils.inboxFolder.GetMessageHeader(headerKeys[0]);
  let msgURI = localAccountUtils.inboxFolder.getUriForMsg(message);
  let messageService = Cc["@mozilla.org/messenger/messageservice;1?type=mailbox-message"]
                       .getService(Ci.nsIMsgMessageService);
  messageService.SaveMessageToDisk(msgURI, saveFile,
                                    false, UrlListener, {}, true, null);
}

function check_each_line(aExpectedLines, aActualLines) {
  let expectedStrings = aExpectedLines.split(MSG_LINEBREAK);
  let actualStrings = aActualLines.split(MSG_LINEBREAK);

  expectedStrings.shift();
  do_check_eq(expectedStrings.length, actualStrings.length);
  for (let line = 0; line < expectedStrings.length; line++)
    do_check_eq(expectedStrings[line], actualStrings[line]);
}

var UrlListener = {
  OnStartRunningUrl: function(aUrl) {
  },
  OnStopRunningUrl: function(aUrl, aExitCode) {
    do_check_eq(aExitCode, 0);
    check_each_line(IOUtils.loadFileToString(dot),
		    IOUtils.loadFileToString(saveFile));
    do_test_finished();
  }
};

function teardown() {
  if (saveFile.exists())
    saveFile.remove(false);
}
