/**
 * Test indexing support for offline IMAP junk.
 */
load("base_index_junk.js");

function run_test() {
  // Set these preferences to stop the cache value "cachePDir" being fetched. This
  // avoids errors on the javascript console, for which the test would otherwise fail.
  // See bug 903402 for follow-up information.
  Services.prefs.setComplexValue("browser.cache.disk.parent_directory",
                                 Ci.nsIFile, do_get_profile());
  Services.prefs.setComplexValue("browser.cache.offline.parent_directory",
                                 Ci.nsIFile, do_get_profile());

  configure_message_injection({mode: "imap", offline: true});
  glodaHelperRunTests(tests);
}

