/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test content length for the mailbox protocol. This focuses on necko URLs
 * that are run externally.
 */

// Take a multipart message as we're testing attachment URLs as well
var gFile = do_get_file("../../mailnews/data/multipart-complex2");
var gMessageKey;

function run_test()
{
  // Set up local folders
  loadLocalMailAccount();

  // Copy a message into the local folder
  Cc["@mozilla.org/messenger/messagecopyservice;1"]
    .getService(Ci.nsIMsgCopyService)
    .CopyFileMessage(gFile, gLocalInboxFolder, null, false, 0, "",
                     gCopyListener, null);

  do_test_pending();
}

var gCopyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) { gMessageKey = aKey; },
  GetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) 
  {
    do_timeout_function(0, verifyContentLength);
  }
};

function verifyContentLength()
{
  // First get the message URI
  let msgHdr = gLocalInboxFolder.GetMessageHeader(gMessageKey);
  let messageUri = gLocalInboxFolder.getUriForMsg(msgHdr);
  // Convert this to a URI that necko can run
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let neckoURL = {};
  let messageService = messenger.messageServiceFromURI(messageUri);
  messageService.GetUrlForUri(messageUri, neckoURL, null);
  // Don't use the necko URL directly. Instead, get the spec and create a new
  // URL using the IO service
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);
  let urlToRun = ioService.newURI(neckoURL.value.spec, null, null);

  // Get a channel from this URI, and check its content length
  let channel = ioService.newChannelFromURI(urlToRun);
  do_check_eq(channel.contentLength, gFile.fileSize);

  // Now try an attachment. &part=1.2
  let attachmentURL = ioService.newURI(neckoURL.value.spec + "&part=1.2",
                                       null, null);
  let attachmentChannel = ioService.newChannelFromURI(attachmentURL);
  // Currently attachments have their content length set to the length of the
  // entire message
  do_check_eq(channel.contentLength, gFile.fileSize);

  do_test_finished();
}
