/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Testing of bcc in message summary file added in bug 481667
 */

Components.utils.import("resource:///modules/mailServices.js");

var hdr;

function run_test()
{
  localAccountUtils.loadLocalMailAccount();

  var copyListener = 
  {
    OnStartCopy: function() {},
    OnProgress: function(aProgress, aProgressMax) {},
    SetMessageKey: function(aKey) {
      hdr = localAccountUtils.inboxFolder.GetMessageHeader(aKey);
    },
    SetMessageId: function(aMessageId) {},
    OnStopCopy: function(aStatus) { continueTest();}
  };

  // Get a message into the local filestore.
  var draft = do_get_file("../../../data/draft1");
  do_test_pending();
  MailServices.copy.CopyFileMessage(draft, localAccountUtils.inboxFolder, null, false, 0,
                                    "", copyListener, null);
}

function continueTest()
{
  //dump("\nbccList >" + hdr.bccList);
  //dump("\nccList >" + hdr.ccList);
  //dump("\n");
  do_check_true(hdr.bccList.contains("Another Person"));
  do_check_true(hdr.bccList.contains("<u1@example.com>"));
  do_check_false(hdr.bccList.contains("IDoNotExist"));
  hdr = null;
  do_test_finished();
}

