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
var gFile = do_get_file("../../../data/multipart-complex2");

function run_test()
{
  do_test_pending();
  copyFileMessageInLocalFolder(gFile, 0, "", null, verifyContentLength);
}

function verifyContentLength(aMessageHeaderKeys, aStatus)
{
  do_check_neq(aMessageHeaderKeys, null);
  // First get the message URI
  let msgHdr = localAccountUtils.inboxFolder.GetMessageHeader(aMessageHeaderKeys[0]);
  let messageUri = localAccountUtils.inboxFolder.getUriForMsg(msgHdr);
  // Convert this to a URI that necko can run
  let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
  let neckoURL = {};
  let messageService = messenger.messageServiceFromURI(messageUri);
  messageService.GetUrlForUri(messageUri, neckoURL, null);
  // Don't use the necko URL directly. Instead, get the spec and create a new
  // URL using the IO service
  let urlToRun = Services.io.newURI(neckoURL.value.spec, null, null);

  // Get a channel from this URI, and check its content length
  let channel = Services.io.newChannelFromURI(urlToRun);
  do_check_eq(channel.contentLength, gFile.fileSize);

  // Now try an attachment. &part=1.2
  let attachmentURL = Services.io.newURI(neckoURL.value.spec + "&part=1.2",
                                         null, null);
  let attachmentChannel = Services.io.newChannelFromURI(attachmentURL);
  // Currently attachments have their content length set to the length of the
  // entire message
  do_check_eq(channel.contentLength, gFile.fileSize);

  do_test_finished();
}
