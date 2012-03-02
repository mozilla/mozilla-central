/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Test that all bundled add-ons are compatible.

const PREF_STRICT_COMPAT = "extensions.strictCompatibility";

function test() {
  waitForExplicitFinish();

  Services.prefs.setBoolPref(PREF_STRICT_COMPAT, true);
  ok(AddonManager.strictCompatibility, "Strict compatibility should be enabled");

  AddonManager.getAllAddons(function gAACallback(aAddons) {
    // Sort add-ons (by name) to improve output.
    aAddons.sort(function compareName(a, b) {
      return a.name.localeCompare(b.name);
    });

    let allCompatible = true;
    aAddons.forEach(function checkCompatibility(a) {
      // Ignore plugins.
      if (a.type == "plugin")
        return;

      ok(a.isCompatible, a.name + " " + a.version + " should be compatible");
      allCompatible = allCompatible && a.isCompatible;
    });
    // Add a reminder.
    if (!allCompatible)
      ok(false, "As this test failed, Toolkit test browser_bug557956.js should fail, too.");

    Services.prefs.clearUserPref(PREF_STRICT_COMPAT);
    finish();
  });
}
