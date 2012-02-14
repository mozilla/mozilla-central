/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Extra tests for forgetting newsgroup usernames and passwords.
 */

load("../../../resources/mailTestUtils.js");

const kUsername = "testnews";
const kPassword = "newstest";
const kProtocol = "nntp";
const kHostname = "localhost";
const kServerUrl = "news://" + kHostname;

function run_test()
{
  // Login Manager
  var loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../../data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  // Set up the basic accounts and folders.
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var incomingServer = acctMgr.createIncomingServer(null, kHostname,
                                                    kProtocol);

  // Force move to new credentials
  incomingServer.rootFolder.QueryInterface(Ci.nsIMsgNewsFolder)
                           .migrateLegacyCredentials();

  var i;
  var count = {};

  // Test - Check there is a password to begin with...
  var logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUsername);
  do_check_eq(logins[0].password, kPassword);

  // Test - Remove the news password login via the incoming server
  incomingServer.forgetPassword();

  logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  // should be no passwords left...
  do_check_eq(count.value, 0);
}
