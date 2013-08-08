/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Extra tests for forgetting newsgroup usernames and passwords.
 */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

const kUsername = "testnews";
const kPassword = "newstest";
const kProtocol = "nntp";
const kHostname = "localhost";
const kServerUrl = "news://" + kHostname;

function run_test()
{
  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../../data/signons-mailnews1.8.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(do_get_profile(), "signons.txt");

  // Set up the basic accounts and folders.
  localAccountUtils.loadLocalMailAccount();

  var incomingServer = MailServices.accounts.createIncomingServer(null, kHostname,
                                                                  kProtocol);

  // Force move to new credentials
  incomingServer.rootFolder.QueryInterface(Ci.nsIMsgNewsFolder)
                           .migrateLegacyCredentials();

  var i;
  var count = {};

  // Test - Check there is a password to begin with...
  var logins = Services.logins.findLogins(count, kServerUrl, null, kServerUrl);

  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUsername);
  do_check_eq(logins[0].password, kPassword);

  // Test - Remove the news password login via the incoming server
  incomingServer.forgetPassword();

  logins = Services.logins.findLogins(count, kServerUrl, null, kServerUrl);

  // should be no passwords left...
  do_check_eq(count.value, 0);
}
