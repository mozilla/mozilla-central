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
 * Test various things about the font chooser window, including
 * - whether if the font defined in font.name.<style>.<language> is not present
 * on the computer, we fall back to displaying what's in
 * font.name-list.<style>.<language>.
 */

var MODULE_NAME = "test-font-chooser";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "pref-window-helpers"];

// We can't initialize them h because the global scope is read far too
// early.
var Cc, Ci;

var gPrefBranch;
var gFontEnumerator;

// We'll test with Western. Unicode has issues on Windows (bug 550443).
const kLanguage = "x-western";

// A list of fonts present on the computer for each font type.
var gRealFontLists = {};

// A list of font types to consider
const kFontTypes = ["serif", "sans-serif", "monospace"];

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let pwh = collector.getModule("pref-window-helpers");
  pwh.installInto(module);

  Cc = Components.classes;
  Ci = Components.interfaces;
  gPrefBranch = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);

  gFontEnumerator = Cc["@mozilla.org/gfx/fontenumerator;1"]
                      .createInstance(Ci.nsIFontEnumerator);
  for (let [, fontType] in Iterator(kFontTypes)) {
    gRealFontLists[fontType] =
      gFontEnumerator.EnumerateFonts(kLanguage, fontType, {});
    if (gRealFontLists[fontType].length == 0)
      throw new Error("No fonts found for language " + kLanguage +
                      " and font type " + fontType + ".");
  }
}

function assert_fonts_equal(aDescription, aExpected, aActual) {
  if (aExpected != aActual)
    throw new Error("The " + aDescription + " font should be " + aExpected +
                    ", but " + (aActual.length == 0 ?
                                "nothing is actually selected." :
                                "is actually " + aActual + "."));
}

/**
 * Verify that the given fonts are displayed in the font chooser. This opens the
 * pref window to the display pane and checks that, then opens the font chooser
 * and checks that too.
 */
function _verify_fonts_displayed(aSerif, aSansSerif, aMonospace) {
  function verify_display_pane(prefc) {
    let isSansDefault = (gPrefBranch.getCharPref("font.default." + kLanguage) ==
                         "sans-serif");
    let displayPaneExpected = isSansDefault ? aSansSerif : aSerif;
    let displayPaneActual = prefc.e("defaultFont").value;
    assert_fonts_equal("display pane", displayPaneExpected, displayPaneActual);
  }

  // Bring up the preferences window.
  open_pref_window("paneDisplay", verify_display_pane);

  // Now verify the advanced dialog.
  function verify_advanced(fontc) {
    assert_fonts_equal("serif", aSerif, fontc.e("serif").value);
    assert_fonts_equal("sans-serif", aSansSerif, fontc.e("sans-serif").value);
    assert_fonts_equal("monospace", aMonospace, fontc.e("monospace").value);
  }

  // Now open the advanced dialog.
  plan_for_modal_dialog("FontsDialog", verify_advanced);
  // XXX This would have been better done from within the prefs dialog, but
  // test-window-helper.js's WindowWatcher can only handle one modal window at a
  // time.
  mc.window.openDialog("chrome://messenger/content/preferences/fonts.xul",
                       "Fonts", "chrome,titlebar,toolbar,centerscreen,modal");
  wait_for_modal_dialog("FontsDialog");
}

/**
 * Test that for a particular language, whatever's in
 * font.name.<type>.<language> is displayed in the font chooser (if it is
 * present on the cocomputer).
 */
function test_font_name_displayed() {
  gPrefBranch.setCharPref("font.language.group", kLanguage);

  // Pick the first font for each font type and set it.
  let expected = {};
  for (let [fontType, fontList] in Iterator(gRealFontLists)) {
    gPrefBranch.setCharPref("font.name." + fontType + "." + kLanguage,
                            fontList[0]);
    expected[fontType] = fontList[0];
  }

  _verify_fonts_displayed.apply(null, [expected[k]
                                       for ([, k] in Iterator(kFontTypes))]);
}

// Fonts definitely not present on a computer -- we simply use UUIDs. These
// should be kept in sync with the ones in *-prefs.js.
const kFakeFonts = {
  "serif": "bc7e8c62-0634-467f-a029-fe6abcdf1582",
  "sans-serif": "419129aa-43b7-40c4-b554-83d99b504b89",
  "monospace": "348df6e5-e874-4d21-ad4b-359b530a33b7",
};

/**
 * Test that for a particular language, if font.name.<type>.<language> is not
 * present on the computer, we fall back to displaying what's in
 * font.name-list.<type>.<language>.
 */
function test_font_name_not_present() {
  gPrefBranch.setCharPref("font.language.group", kLanguage);

  // The fonts we're expecting to see selected in the font chooser for
  // test_font_name_not_present.
  let expected = {};
  for (let [fontType, fakeFont] in Iterator(kFakeFonts)) {
    // Look at the font.name-list. We need to verify that the first font is the
    // fake one, and that the second one is present on the user's computer.
    let listPref = "font.name-list." + fontType + "." + kLanguage;
    let fontList = gPrefBranch.getCharPref(listPref);
    let fonts = [s.trim() for ([, s] in Iterator(fontList.split(",")))];
    if (fonts.length != 2)
      throw new Error(listPref + " should have exactly two fonts, but it is " +
                      fontList + ".");

    if (fonts[0] != fakeFont)
      throw new Error("The first font in " + listPref + " should be " + fakeFont +
                      ", but is actually " + fonts[0] + ".");

    if (gRealFontLists[fontType].indexOf(fonts[1]) == -1)
      throw new Error("The second font in " + listPref + " (" + fonts[1] +
                      ") should be present on this computer, but isn't.");
    expected[fontType] = fonts[1];

    // Set font.name to be the fake font. font.name-list is handled by
    // wrapper.py.
    gPrefBranch.setCharPref("font.name." + fontType + "." + kLanguage, fakeFont);
  }

  _verify_fonts_displayed.apply(null, [expected[k]
                                       for ([, k] in Iterator(kFontTypes))]);
}
