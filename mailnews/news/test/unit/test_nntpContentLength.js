/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test content length for the news protocol. This focuses on necko URLs
 * that are run externally.
 */

// The basic daemon to use for testing nntpd.js implementations
var daemon = setupNNTPDaemon();

var server;
var localserver;

function run_test() {
  // XXX The server doesn't support returning sizes!
  return;

  type = "RFC 977";
  var handler = new NNTP_RFC977_handler(daemon);
  localserver = setupLocalServer(NNTP_PORT);
  server = new nsMailServer(handler);
  server.start(NNTP_PORT);

  try {
    // Get the folder and new mail
    let folder = localserver.rootFolder.getChildNamed("test.subscribe.simple");
    folder.clearFlag(Ci.nsMsgFolderFlags.Offline);
    folder.getNewMessages(null, {
      OnStopRunningUrl: function () { localserver.closeCachedConnections(); }});
    server.performTest();

    do_check_eq(folder.getTotalMessages(false), 1);
    do_check_true(folder.hasNewMessages);

    server.resetTest();

    // Get the message URI
    let msgHdr = folder.firstNewMessage;
    let messageUri = folder.getUriForMsg(msgHdr);
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
    do_check_eq(channel.contentLength, kSimpleNewsArticle.length);

    // Now try an attachment. &part=1.2
    // XXX the message doesn't really have an attachment
    let attachmentURL = ioService.newURI(neckoURL.value.spec + "&part=1.2",
                                         null, null);
    let attachmentChannel = ioService.newChannelFromURI(attachmentURL);
    // Currently attachments have their content length set to the length of the
    // entire message
    do_check_eq(channel.contentLength, kSimpleNewsArticle.length);
  }
  catch (e) {
    server.stop();
    do_throw(e);
  }
};
