/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Extra tests for SMTP passwords (forgetPassword)
 */

const kUser1 = "testsmtp";
const kUser2 = "testsmtpa";
const kProtocol = "smtp";
const kHostname = "localhost";
const kServerUrl = kProtocol + "://" + kHostname;

function run_test()
{
  // Login Manager
  var loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../mailnews/test/data/signons-mailnews1.8-multiple.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  // Set up the basic accounts and folders.
  loadLocalMailAccount();

  var smtpServer1 = getBasicSmtpServer();
  var smtpServer2 = getBasicSmtpServer();

  smtpServer1.authMethod = 1;
  smtpServer1.username = kUser1;
  smtpServer2.authMethod = 1;
  smtpServer2.username = kUser2;

  var i;
  var count = {};

  // Test - Check there are two logins to begin with.
  var logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  do_check_eq(count.value, 2);

  // These will either be one way around or the other.
  if (logins[0].username == kUser1) {
    do_check_eq(logins[1].username, kUser2);
  } else {
    do_check_eq(logins[0].username, kUser2);
    do_check_eq(logins[1].username, kUser1);
  }

  // Test - Remove a login via the incoming server
  smtpServer1.forgetPassword();

  logins = logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  // should be one login left for kUser2
  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUser2);

  // Test - Remove the other login via the incoming server
  smtpServer2.forgetPassword();

  logins = logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  // should be one login left for kUser2
  do_check_eq(count.value, 0);
  do_check_eq(logins.length, 0);
}
