/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Test that the subscribe window for news servers has working autocomplete. */

var MODULE_NAME = 'test-subscribe-news-autocomplete';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'nntp-helpers',
                       'subscribe-window-helpers'];

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let nh = collector.getModule('nntp-helpers');
  nh.installInto(module);
  let swh = collector.getModule('subscribe-window-helpers');
  swh.installInto(module);
}

/**
 * Checks that the filter in the subscribe window works correctly
 * (shows only newsgroups matching all of several search strings
 * separated by whitespace)
 */
function test_subscribe_newsgroup_filter() {
  var daemon = setupNNTPDaemon();
  var remoteServer = startupNNTPServer(daemon, NNTP_PORT);
  let server = setupLocalServer(NNTP_PORT);
  let rootFolder = server.rootFolder;
  open_subscribe_window_from_context_menu(rootFolder, filter_test_helper);
  shutdownNNTPServer(remoteServer);
}

/**
 * Helper function (callback), needed because the subscribe window is modal.
 * @param swc Controller for the subscribe window
 */
function filter_test_helper(swc) {
  enter_text_in_search_box(swc, "subscribe empty");
  utils.waitFor( function() check_newsgroup_displayed(swc, "test.subscribe.empty"),
    "test.subscribe.empty not in the list");
  utils.waitFor( function() !check_newsgroup_displayed(swc, "test.empty"),
    "test.empty is in the list, but should not be");
  utils.waitFor( function() !check_newsgroup_displayed(swc, "test.subscribe.simple"),
    "test.subscribe.simple is in the list, but should not be");
}
