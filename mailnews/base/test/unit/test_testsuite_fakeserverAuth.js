/**
 * Tests functions in mailnews/test/fakeserver/auth.js
 * which are responsible for the authentication in the
 * fakeserver.
 *
 * Do NOT essentially re-code the auth schemes here,
 * just check roundtrips, against static values etc..
 */

Components.utils.import("resource://testing-common/mailnews/auth.js");

const kUsername = "fred1";
const kPassword = "wilma2";

function run_test()
{
  authPLAIN();
  authCRAMMD5();
  return true;
};

/**
 * Test AUTH PLAIN
 */
function authPLAIN()
{
  // roundtrip works
  var line = AuthPLAIN.encodeLine(kUsername, kPassword);
  var req = AuthPLAIN.decodeLine(line);
  do_check_eq(req.username, kUsername);
  do_check_eq(req.password, kPassword);

  // correct encoding
  do_check_eq(line, "AGZyZWQxAHdpbG1hMg==");
};

/**
 * Test AUTH CRAM-MD5
 */
function authCRAMMD5()
{
  // AuthCRAM.createChallenge() creates a different challenge each time
  var hardcodedChallenge = btoa("<123@fake.invalid>");
  var hardcodedResponse = "ZnJlZDEgOTA5YjgwMmM3NTI5NTJlYzI2NjgyMTNmYTdjNWU0ZjQ=";

  // correct encoding
  var req = AuthCRAM.decodeLine(hardcodedResponse);
  do_check_eq(req.username, kUsername);
  var expectedDigest = AuthCRAM.encodeCRAMMD5(hardcodedChallenge, kPassword);
  do_check_eq(req.digest, expectedDigest);

  var challenge = AuthCRAM.createChallenge("fake.invalid");
  challenge = atob(challenge); // decode. function currently returns it already encoded
  var challengeSplit = challenge.split("@");
  do_check_eq(challengeSplit.length, 2);
  do_check_eq(challengeSplit[1], "fake.invalid>");
  do_check_eq(challengeSplit[0][0], "<");
};
