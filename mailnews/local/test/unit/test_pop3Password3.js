/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Extra tests for POP3 passwords (forgetPassword)
 */

const kUser1 = "testpop3";
const kUser2 = "testpop3a";
const kProtocol = "pop3";
const kHostname = "localhost";
const kServerUrl = "mailbox://" + kHostname;

function run_test()
{
  // Login Manager
  var loginMgr = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

  // Passwords File (generated from Mozilla 1.8 branch).
  var signons = do_get_file("../../mailnews/data/signons-mailnews1.8-multiple.txt");

  // Copy the file to the profile directory for a PAB
  signons.copyTo(gProfileDir, "signons.txt");

  // Set up the basic accounts and folders.
  // We would use createPop3ServerAndLocalFolders() however we want to have
  // a different username and NO password for this test (as we expect to load
  // it from signons.txt).
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var incomingServer1 = acctMgr.createIncomingServer(kUser1, kHostname,
                                                     kProtocol);

  var incomingServer2 = acctMgr.createIncomingServer(kUser2, kHostname,
                                                     kProtocol);

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
  incomingServer1.forgetPassword();

 logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  // should be one login left for kUser2
  do_check_eq(count.value, 1);
  do_check_eq(logins[0].username, kUser2);

  // Test - Remove the other login via the incoming server
  incomingServer2.forgetPassword();

  logins = loginMgr.findLogins(count, kServerUrl, null, kServerUrl);

  // should be one login left for kUser2
  do_check_eq(count.value, 0);
  do_check_eq(logins.length, 0);
}
