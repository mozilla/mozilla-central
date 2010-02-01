/**
 * Tests functions atob() and btoa() in mailnews/test/resources/mailTestUtils.js .
 *
 * Note:
 * btoa() = base64 encode
 * atob() = base64 decode
 * (i.e. "binary" = plain, and "ascii" = encoded)
 */

function run_test()
{
  var plain = "testtesttest";
  var encoded = "dGVzdHRlc3R0ZXN0";

  // correct encoding according to spec
  do_check_eq(btoa(plain), encoded); // encode
  do_check_eq(atob(encoded), plain); // decode

  // roundtrip works
  do_check_eq(atob(btoa(plain)), plain);
  do_check_eq(btoa(atob(encoded)), encoded);
  return true;
};
