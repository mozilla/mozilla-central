/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource:///modules/mailServices.js");

// The basic daemon to use for testing nntpd.js implementations
var gDaemon = setupNNTPDaemon();

const ACR = Components.interfaces.nsIAutoCompleteResult;

function acObserver() {}

acObserver.prototype = {
  _search: null,
  _result: null,

  onSearchResult: function (aSearch, aResult) {
    this._search = aSearch;
    this._result = aResult;
  }
};

function run_test() {
  let type = "RFC 977";
  let localserver = setupLocalServer(NNTP_PORT);
  let server = makeServer(NNTP_RFC977_handler, gDaemon);
  server.start(NNTP_PORT);

  // create identity
  let identity = MailServices.accounts.createIdentity();
  _account.addIdentity(identity);

  let acs = Components.classes["@mozilla.org/autocomplete/search;1?name=news"]
    .getService(Components.interfaces.nsIAutoCompleteSearch);
  let obs;

  let paramsN = JSON.stringify({
    idKey: identity.key,
    accountKey: _account.key,
    type: "addr_newsgroups" });
  let paramsF = JSON.stringify({
    idKey: identity.key,
    accountKey: _account.key,
    type: "addr_followup" });
  let paramsMail = JSON.stringify({
    idKey: identity.key,
    accountKey: _account.key,
    type: "addr_to" });

  // misc.test is not subscribed
  obs = new acObserver();
  acs.startSearch("misc", paramsN, null, obs);
  do_check_true(obs._result == null || obs._result.matchCount == 0);

  obs = new acObserver();
  acs.startSearch("misc", paramsF, null, obs);
  do_check_true(obs._result == null || obs._result.matchCount == 0);

  obs = new acObserver();
  acs.startSearch("misc", paramsMail, null, obs);
  do_check_true(obs._result == null || obs._result.matchCount == 0);

  // test.filter is subscribed
  obs = new acObserver();
  acs.startSearch("filter", paramsN, null, obs);
  do_check_eq(obs._result.matchCount, 1);

  obs = new acObserver();
  acs.startSearch("filter", paramsF, null, obs);
  do_check_eq(obs._result.matchCount, 1);

  // ... but no auto-complete should occur for addr_to
  obs = new acObserver();
  acs.startSearch("filter", paramsMail, null, obs);
  do_check_true(obs._result == null || obs._result.matchCount == 0);

  // test.subscribe.empty and test.subscribe.simple are subscribed
  obs = new acObserver();
  acs.startSearch("subscribe", paramsN, null, obs);
  do_check_eq(obs._result.matchCount, 2);

  obs = new acObserver();
  acs.startSearch("subscribe", paramsF, null, obs);
  do_check_eq(obs._result.matchCount, 2);

  // ... but no auto-complete should occur for addr_to
  obs = new acObserver();
  acs.startSearch("subscribe", paramsMail, null, obs);
  do_check_true(obs._result == null || obs._result.matchCount == 0);

  // test.subscribe.empty is subscribed, test.empty is not
  obs = new acObserver();
  acs.startSearch("empty", paramsN, null, obs);
  do_check_eq(obs._result.matchCount, 1);

  obs = new acObserver();
  acs.startSearch("empty", paramsF, null, obs);
  do_check_eq(obs._result.matchCount, 1);

  server.stop();
};
