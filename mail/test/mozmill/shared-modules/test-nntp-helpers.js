/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);

const MODULE_NAME = 'test-nntp-helpers';

const RELATIVE_ROOT = '../shared-modules';

const MODULES_REQUIRES = ['folder-display-helpers', 'window-helpers'];

const kSimpleNewsArticle =
  "From: John Doe <john.doe@example.com>\n"+
  "Date: Sat, 24 Mar 1990 10:59:24 -0500\n"+
  "Newsgroups: test.subscribe.simple\n"+
  "Subject: H2G2 -- What does it mean?\n"+
  "Message-ID: <TSS1@nntp.test>\n"+
  "\n"+
  "What does the acronym H2G2 stand for? I've seen it before...\n";

// The groups to set up on the fake server.
// It is an array of tuples, where the first element is the group name and the
// second element is whether or not we should subscribe to it.
var groups = [
  ["test.empty", false],
  ["test.subscribe.empty", true],
  ["test.subscribe.simple", true],
  ["test.filter", true]
];

var folderDisplayHelper;
var mc;
var windowHelper;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  windowHelper = collector.getModule('window-helpers');
  testHelperModule = {
    Cc: Cc,
    Ci: Ci,
    Cu: Cu,
    // fake some xpcshell stuff
    _TEST_FILE: ["mozmill"],
    do_throw: function(aMsg) {
      throw new Error(aMsg);
    },
    do_check_eq: function() {},
    do_check_neq: function() {},
  };
  folderDisplayHelper.load_via_src_path("nntpd.js", testHelperModule);
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.setupNNTPDaemon = setupNNTPDaemon;
  module.NNTP_PORT = NNTP_PORT;
  module.setupLocalServer = setupLocalServer;
}


// Sets up the NNTP daemon object for use in fake server
function setupNNTPDaemon() {
  var daemon = new testHelperModule.nntpDaemon();

  groups.forEach(function (element) {
    daemon.addGroup(element[0]);
  });

  var article = new testHelperModule.newsArticle(kSimpleNewsArticle);
  daemon.addArticleToGroup(article, "test.subscribe.simple", 1);

  return daemon;
}

// Enable strict threading
var prefs = Cc["@mozilla.org/preferences-service;1"]
              .getService(Ci.nsIPrefBranch);
prefs.setBoolPref("mail.strict_threading", true);


// Make sure we don't try to use a protected port. I like adding 1024 to the
// default port when doing so...
const NNTP_PORT = 1024+119;

var _server = null;

function subscribeServer(incomingServer) {
  // Subscribe to newsgroups
  incomingServer.QueryInterface(Ci.nsINntpIncomingServer);
  groups.forEach(function (element) {
      if (element[1])
        incomingServer.subscribeToNewsgroup(element[0]);
    });
  // Only allow one connection
  incomingServer.maximumConnectionsNumber = 1;
}

// Sets up the client-side portion of fakeserver
function setupLocalServer(port) {
  if (_server != null)
    return _server;
  var acctmgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var server = acctmgr.createIncomingServer(null, "localhost", "nntp");
  server.port = port;
  server.valid = false;

  var account = acctmgr.createAccount();
  account.incomingServer = server;
  server.valid = true;

  subscribeServer(server);

  _server = server;

  return server;
}

const URLCreator = Cc["@mozilla.org/messenger/messageservice;1?type=news"]
                     .getService(Ci.nsINntpService)
                     .QueryInterface(Ci.nsIProtocolHandler);

function create_post(baseURL, file) {
  var url = URLCreator.newURI(baseURL, null, null);
  url.QueryInterface(Ci.nsINntpUrl);

  var post = Cc["@mozilla.org/messenger/nntpnewsgrouppost;1"]
               .createInstance(Ci.nsINNTPNewsgroupPost);
  post.postMessageFile = do_get_file(file);
  url.messageToPost = post;
  return url;
}
