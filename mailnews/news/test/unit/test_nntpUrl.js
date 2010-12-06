/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

function getMessageHeaderFromUrl(aUrl) {
  let msgUrl = Cc["@mozilla.org/messenger/messageservice;1?type=news"]
                .getService(Ci.nsINntpService)
                .QueryInterface(Ci.nsIProtocolHandler)
                .newURI(aUrl, null, null)
                .QueryInterface(Ci.nsIMsgMessageUrl);
  return msgUrl.messageHeader;
}

function run_test() {

  // This is crash test for Bug 392729

  try {
    // nntp:// protocol isn't supported yet until bug 226890 is fixed.
    // When We pass invlid nntp:// protocol format, we should throw a exception.
    let hdr = getMessageHeaderFromUrl("nntp://localhost:" + NNTP_PORT);
    do_check_true(false); 
  } catch (e) {
    do_check_true(e.result == Components.results.NS_ERROR_ILLEGAL_VALUE);
  }

  try {
    // msgkey is invalid for news:// protocol
    let hdr = getMessageHeaderFromUrl("news://localhost:" + NNTP_PORT +
                                      "/message-id?group=test.subscribe.simple&key=abcdefghijk");
    do_check_true(false); 
  } catch (e) {
    do_check_true(e.result == Components.results.NS_ERROR_ILLEGAL_VALUE);
  }
}
