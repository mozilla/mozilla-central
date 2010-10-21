/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Test font preference migration. This currently only makes sense on Windows --
 * however, we're able to test for all versions of Windows, regardless of which
 * version the test is run on.
 */

Components.utils.import("resource:///modules/mailMigrator.js");

var gPrefBranch = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefBranch);

/**
 * A list of font names to verify using |makeVerifier| and
 * |verifier|. |makeVerifier| expects all the prefs to be passed in, while
 * |verifier| doesn't require any.
 */
const kNamesToVerify = ["serif", "sans", "monospace"];

/**
 * A list of font sizes to verify using |makeVerifier| and
 * |verifier|. |makeVerifier| expects all the prefs to be passed in, while
 * |verifier| doesn't require any. If a size is specified, however, |verifier|
 * can have the migrated and non-migrated sizes passed in separately (by
 * appending either |Migrated| or |NonMigrated| to the property name,
 * respectively).
 */
const kSizesToVerify = ["variableSize", "fixedSize"];

/**
 * A higher order function which returns a function that verifies fonts based on
 * whatever's provided in aFonts and aNonDefaultFonts.
 */
function makeVerifier(aFonts) {
  function verifier(aEncoding, aNonDefaultFonts) {
    if (!aNonDefaultFonts)
      aNonDefaultFonts = {};

    let expectedFonts = {};
    for (let [, key] in Iterator(kNamesToVerify))
      expectedFonts[key] = (key in aNonDefaultFonts ? aNonDefaultFonts[key] :
                            aFonts[key]);
    for (let [, key] in Iterator(kSizesToVerify)) {
      let nonDefaultKey = key + (aFonts.migrated ? "" : "Non") + "Migrated";
      expectedFonts[key] = (nonDefaultKey in aNonDefaultFonts ?
                            aNonDefaultFonts[nonDefaultKey] :
                            aFonts[key]);
    }

    // A distinct lack of magic here, so that failing stuff is generally easier
    // to comment out and debug.
    do_check_eq(gPrefBranch.getCharPref("font.name.serif." + aEncoding),
                expectedFonts.serif);
    do_check_eq(gPrefBranch.getCharPref("font.name.sans-serif." + aEncoding),
                expectedFonts.sans);
    do_check_eq(gPrefBranch.getCharPref("font.name.monospace." + aEncoding),
                expectedFonts.monospace);
    do_check_eq(gPrefBranch.getIntPref("font.size.variable." + aEncoding),
                expectedFonts.variableSize);
    do_check_eq(gPrefBranch.getIntPref("font.size.fixed." + aEncoding),
                expectedFonts.fixedSize);
  }

  return verifier;
}

/**
 * Verifier function for non-ClearType fonts.
 */
var gNonCTVerifier = makeVerifier({
  serif: "Times New Roman",
  sans: "Arial",
  monospace: "Courier New",
  variableSize: 16,
  fixedSize: 13,
  migrated: false,
});

/**
 * Verifier function for ClearType fonts.
 */
var gCTVerifier = makeVerifier({
  serif: "Cambria",
  sans: "Calibri",
  monospace: "Consolas",
  variableSize: 17,
  fixedSize: 14,
  migrated: true,
});

/**
 * Windows versions to pretend we're running this on. Each value of this
 * dictionary is a pair: [Windows version, verifier for this version].
 */
const kWindowsVersions = {  
  // Windows XP
  "xp": [5.1, gNonCTVerifier],
  // Windows Vista
  "vista": [6.0, gCTVerifier],
};

function set_windows_version(aVersion) {
  let sysInfo = Cc["@mozilla.org/system-info;1"]
                  .getService(Ci.nsIWritablePropertyBag2);
  sysInfo.setPropertyAsDouble("version", aVersion);
}

/**
 * Encodings to worry about while clearing prefs.
 */
const kEncodingsToClear = ["x-unicode", "x-western", "x-central-euro",
                           "x-baltic", "x-cyrillic", "el", "tr"];

/**
 * Pref branches to worry about while clearing prefs.
 */
const kPrefBranchesToClear = [
  "font.name.serif.",
  "font.name.sans-serif.",
  "font.name.monospace.",
  "font.size.variable.",
  "font.size.fixed.",
];

/**
 * Reset all font prefs we care about (as defined above) to their defaults.
 *
 * @param [aDontResetVersion] Whether mail.font.windows.version should not be
 *     reset, defaults to false.
 */
function reset_font_prefs(aDontResetVersion) {
  // kPrefBranchesToClear x kEncodingsToClear
  for (let [, prefBranch] in Iterator(kPrefBranchesToClear)) {
    for (let [, encoding] in Iterator(kEncodingsToClear)) {
      let pref = prefBranch + encoding;
      if (gPrefBranch.prefHasUserValue(pref))
        gPrefBranch.clearUserPref(pref);
    }
  }
  if (!aDontResetVersion &&
      gPrefBranch.prefHasUserValue("mail.font.windows.version"))
    gPrefBranch.clearUserPref("mail.font.windows.version");
}

/**
 * Test that migrating all prefs from defaults works.
 */
function test_migrating_all_prefs(aVerifier) {
  MailMigrator.migrateToClearTypeFonts();
  aVerifier("x-unicode", null);
  aVerifier("x-western", null);
  aVerifier("x-central-euro", null);
  aVerifier("x-cyrillic", null);
  aVerifier("x-baltic", null);
  aVerifier("el", null);
  aVerifier("tr", null);
}

/**
 * Test that if the serif font isn't a default, we don't migrate it.
 */
function test_not_migrating_serif(aVerifier) {
  // All the fonts we set are make-believe
  let nonDefaultFonts = {
    serif: "Foo Serif",
    // If we do not migrate, the font size shouldn't be clobbered at all.
    variableSizeNonMigrated: 20,
  };
  // If we do migrate, if the default style is serif, the font size shouldn't be
  // clobbered. (Otherwise it should.)
  if (gPrefBranch.getCharPref("font.default.x-unicode") == "serif")
    nonDefaultFonts.variableSizeMigrated = 20;

  gPrefBranch.setCharPref("font.name.serif.x-unicode", "Foo Serif");
  gPrefBranch.setIntPref("font.size.variable.x-unicode", 20);

  MailMigrator.migrateToClearTypeFonts();

  aVerifier("x-unicode", nonDefaultFonts);
  aVerifier("x-western", null);
  aVerifier("x-central-euro", null);
  aVerifier("x-cyrillic", null);
  aVerifier("x-baltic", null);
  aVerifier("el", null);
  aVerifier("tr", null);
}

/**
 * Test that if the sans-serif font isn't a default, we don't migrate it.
 */
function test_not_migrating_sans(aVerifier) {
  let nonDefaultFonts = {
    sans: "Foo Sans",
    // If we do not migrate, the font size shouldn't be clobbered at all.
    variableSizeNonMigrated: 20,
  };
  // If we do migrate, if the default style is sans-serif, the font size
  // shouldn't be clobbered. (Otherwise it should.)
  if (gPrefBranch.getCharPref("font.default.x-unicode") == "sans-serif")
    nonDefaultFonts.variableSizeMigrated = 20;

  gPrefBranch.setCharPref("font.name.sans-serif.x-unicode", "Foo Sans");
  gPrefBranch.setIntPref("font.size.variable.x-unicode", 20);

  MailMigrator.migrateToClearTypeFonts();

  aVerifier("x-unicode", nonDefaultFonts);
  aVerifier("x-western", null);
  aVerifier("x-central-euro", null);
  aVerifier("x-cyrillic", null);
  aVerifier("x-baltic", null);
  aVerifier("el", null);
  aVerifier("tr", null);
}

/**
 * Test that if the monospace font isn't a default, we don't migrate it.
 */
function test_not_migrating_monospace(aVerifier) {
  let nonDefaultFonts = {
    monospace: "Foo Mono",
    // The font size should remain what we've set it to below.
    fixedSizeMigrated: 20,
    fixedSizeNonMigrated: 20,
  };

  gPrefBranch.setCharPref("font.name.monospace.x-unicode", "Foo Mono");
  gPrefBranch.setIntPref("font.size.fixed.x-unicode", 20);

  MailMigrator.migrateToClearTypeFonts();

  aVerifier("x-unicode", nonDefaultFonts);
  aVerifier("x-western", null);
  aVerifier("x-central-euro", null);
  aVerifier("x-cyrillic", null);
  aVerifier("x-baltic", null);
  aVerifier("el", null);
  aVerifier("tr", null);
}

/**
 * Test migrating from the default fonts but from font sizes that aren't so.
 */
function test_migrating_non_default_font_sizes(aVerifier) {
  gPrefBranch.setIntPref("font.size.variable.x-unicode", 20);
  gPrefBranch.setIntPref("font.size.fixed.x-western", 30);
  gPrefBranch.setIntPref("font.size.variable.x-central-euro", 40);
  gPrefBranch.setIntPref("font.size.fixed.x-cyrillic", 50);
  gPrefBranch.setIntPref("font.size.variable.x-baltic", 60);
  gPrefBranch.setIntPref("font.size.fixed.el", 70);
  gPrefBranch.setIntPref("font.size.variable.tr", 80);

  MailMigrator.migrateToClearTypeFonts();

  aVerifier("x-unicode", {variableSizeNonMigrated: 20});
  aVerifier("x-western", {fixedSizeNonMigrated: 30});
  aVerifier("x-central-euro", {variableSizeNonMigrated: 40});
  aVerifier("x-cyrillic", {fixedSizeNonMigrated: 50});
  aVerifier("x-baltic", {variableSizeNonMigrated: 60});
  aVerifier("el", {fixedSizeNonMigrated: 70});
  aVerifier("tr", {variableSizeNonMigrated: 80});
}

/**
 * Test incremental migration from mail.font.windows.version = 1.
 */
function test_migrate_from_version_1(aVerifier) {
  gPrefBranch.setIntPref("mail.font.windows.version", 1);
  MailMigrator.migrateToClearTypeFonts();

  // Unicode and Western shouldn't have been migrated.
  gNonCTVerifier("x-unicode", null);
  gNonCTVerifier("x-western", null);
  // These character encodings should have been migrated.
  aVerifier("x-central-euro", null);
  aVerifier("x-cyrillic", null);
  aVerifier("x-baltic", null);
  aVerifier("el", null);
  aVerifier("tr", null);
}

/**
 * Test that we don't attempt to migrate twice.
 */
function test_migrating_at_most_once() {
  set_windows_version(6.0);
  // Migrate once.
  MailMigrator.migrateToClearTypeFonts();
  gCTVerifier("x-unicode", null);
  gCTVerifier("x-western", null);
  gCTVerifier("x-central-euro", null);
  gCTVerifier("x-cyrillic", null);
  gCTVerifier("x-baltic", null);
  gCTVerifier("el", null);
  gCTVerifier("tr", null);

  // Now reset to defaults, but don't reset the pref that determines whether
  // we've migrated.
  reset_font_prefs(true);
  // Verify that we have all the non-ClearType fonts back.
  gNonCTVerifier("x-unicode", null);
  gNonCTVerifier("x-western", null);
  gNonCTVerifier("x-central-euro", null);
  gNonCTVerifier("x-cyrillic", null);
  gNonCTVerifier("x-baltic", null);
  gNonCTVerifier("el", null);
  gNonCTVerifier("tr", null);

  MailMigrator.migrateToClearTypeFonts();
  // Test that the fonts haven't changed.
  gNonCTVerifier("x-unicode", null);
  gNonCTVerifier("x-western", null);
  gNonCTVerifier("x-central-euro", null);
  gNonCTVerifier("x-cyrillic", null);
  gNonCTVerifier("x-baltic", null);
  gNonCTVerifier("el", null);
  gNonCTVerifier("tr", null);
}

/**
 * Test that we attempt to migrate at least once.
 */
function test_migrating_at_least_once() {
  set_windows_version(5.1);
  // Attempt to migrate -- this won't actually work because the Windows version
  // is too low.
  MailMigrator.migrateToClearTypeFonts();
  gNonCTVerifier("x-unicode", null);
  gNonCTVerifier("x-western", null);
  gNonCTVerifier("x-central-euro", null);
  gNonCTVerifier("x-cyrillic", null);
  gNonCTVerifier("x-baltic", null);
  gNonCTVerifier("el", null);
  gNonCTVerifier("tr", null);

  // Now reset to defaults, but don't reset the pref that determines whether
  // we've migrated.
  reset_font_prefs(true);

  // Move to Vista
  set_windows_version(6.0);

  MailMigrator.migrateToClearTypeFonts();
  // Test that we get the ClearType fonts.
  gCTVerifier("x-unicode", null);
  gCTVerifier("x-western", null);
  gCTVerifier("x-central-euro", null);
  gCTVerifier("x-cyrillic", null);
  gCTVerifier("x-baltic", null);
  gCTVerifier("el", null);
  gCTVerifier("tr", null);
}

/**
 * List of tests to run for every Windows version specified in
 * |kWindowsVersions|. These tests get passed in one argument, which is a
 * callback to verify fonts (generally a different one per Windows version).
 */
var testsForEveryVersion = [
  test_migrating_all_prefs,
  test_not_migrating_serif,
  test_not_migrating_sans,
  test_not_migrating_monospace,
  test_migrating_non_default_font_sizes,
];

/**
 * Other tests to run. These tests are considered independent and do not have
 * any arguments. Also, there are no guarantees about the Windows version prior
 * to the test, so it is recommended that tests here set it right at the
 * beginning.
 */
var otherTests = [
  test_migrating_at_most_once,
  test_migrating_at_least_once,
];

function run_test() {
  // Only run on Windows.
  if (!("@mozilla.org/windows-registry-key;1" in Components.classes))
    return;

  reset_font_prefs();

  for (let [, [version, verifier]] in Iterator(kWindowsVersions)) {
    set_windows_version(version);

    for (let [, test] in Iterator(testsForEveryVersion)) {
      test(verifier);
      reset_font_prefs();
    }
  }

  for (let [, test] in Iterator(otherTests)) {
    test();
    reset_font_prefs();
  }
}
