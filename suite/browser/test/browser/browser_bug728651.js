/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Test that all bundled add-ons are compatible.

const PREF_STRICT_COMPAT = "extensions.strictCompatibility";

function test() {
  waitForExplicitFinish();

  Services.prefs.setBoolPref(PREF_STRICT_COMPAT, true);
  is(AddonManager.strictCompatibility, true, "Strict compatibility should be enabled");

  AddonManager.getAllAddons(function(aAddons) {
    let allCompatible = true;
    aAddons.forEach(function(a) {
      if (a.type != "plugin") { // we don't care about plugins
        ok(a.isCompatible, a.name + " " + a.version + " should be compatible");
        allCompatible = allCompatible && a.isCompatible;
      }
    });
    if (!allCompatible)
      ok(false, "As this test failed, Toolkit test browser_bug557956.js should fail, too.");
    Services.prefs.clearUserPref(PREF_STRICT_COMPAT);
    finish();
  });
}
