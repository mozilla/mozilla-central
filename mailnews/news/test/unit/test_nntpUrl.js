/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource:///modules/mailServices.js");

function getMessageHeaderFromUrl(aUrl) {
  let msgUrl = MailServices.nntp
                .QueryInterface(Ci.nsIProtocolHandler)
                .newURI(aUrl, null, null)
                .QueryInterface(Ci.nsIMsgMessageUrl);
  return msgUrl.messageHeader;
}

function run_test() {

  // This is crash test for Bug 392729
  try {
    // msgkey is invalid for news:// protocol
    let hdr = getMessageHeaderFromUrl("news://localhost:" + NNTP_PORT +
                                      "/123@example.invalid?group=test.subscribe.simple&key=abcdefghijk");
    do_check_true(false); 
  } catch (e) {
    do_check_eq(e.result, Components.results.NS_ERROR_MALFORMED_URI);
  }
}
