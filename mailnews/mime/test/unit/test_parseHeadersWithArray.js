/*
 * Test that nsIMsgHeaderParser.parseHeadersWithArray returns
 * null instead of 0-length strings.
 */

Components.utils.import("resource:///modules/mailServices.js");

function run_test() {
  let addresses = {}, names = {}, fullAddresses = {};
  let n = MailServices.headerParser.parseHeadersWithArray("example@host.invalid",
                                                          addresses, names, fullAddresses);
  do_check_eq(1, n);
  do_check_eq("example@host.invalid", addresses.value[0]);
  do_check_eq(null, names.value[0]);
  do_check_eq("example@host.invalid", fullAddresses.value[0]);
}
