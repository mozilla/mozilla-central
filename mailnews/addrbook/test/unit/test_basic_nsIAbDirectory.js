/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for basic address book functions - tests obtaining the (default)
 * personal address book and getting its details from the nsIAbDirectory.
 *
 * Functions/attributes not currently tested:
 * - lastModifiedDate
 * - childNodes
 * - childCards
 * - deleteDirectory
 * - hasCard
 * - hasDirectory
 * - addCard
 * - modifyCard
 * - deleteCards
 * - dropCard
 * - addressLists
 * - addMailList
 * - listNickName
 * - description
 * - editMailListToDatabase
 * - copyMailList
 * - createNewDirectory
 * - createDirectoryByURI
 */

var testnum = 0;

// Main function for the this test so we can check both personal and
// collected books work correctly in an easy manner.
function check_ab(abConfig) {
  try {
    ++testnum; // Test 1 - Get the directory

    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Components.interfaces.nsIRDFService);
    do_check_true(rdf != null);

    var AB = rdf.GetResource(abConfig.URI)
                 .QueryInterface(Components.interfaces.nsIAbDirectory);
    do_check_true(AB != null);


    ++testnum; // Test 2 - Is it the right type?

    do_check_true(AB instanceof Components.interfaces.nsIAbMDBDirectory);


    ++testnum; // Test 3 - Check attributes

    do_check_eq(AB.propertiesChromeURI, kNormalPropertiesURI);
    do_check_eq(AB.operations,
                Components.interfaces.nsIAbDirectory.opRead |
                Components.interfaces.nsIAbDirectory.opWrite |
                Components.interfaces.nsIAbDirectory.opSearch);
    do_check_eq(AB.dirName, abConfig.dirName);
    do_check_eq(AB.dirType, abConfig.dirType);
    do_check_eq(AB.fileName, abConfig.fileName);
    do_check_eq(AB.URI, abConfig.URI);
    do_check_eq(AB.position, abConfig.position);
    do_check_eq(AB.isMailList, false);
    do_check_eq(AB.isRemote, false);
    do_check_eq(AB.isSecure, false);
    do_check_eq(AB.searchDuringLocalAutocomplete, true);
    do_check_eq(AB.supportsMailingLists, true);
    do_check_eq(AB.dirPrefId, abConfig.dirPrefID);


    ++testnum; // Test 4 - check getting default preferences

    var gPref = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefBranch);

    do_check_eq(AB.getIntValue("random", 54321), 54321);
    do_check_eq(AB.getBoolValue("random", false), false);
    do_check_eq(AB.getStringValue("random", "abc"), "abc");
    do_check_eq(AB.getLocalizedStringValue("random", "xyz"), "xyz");


    ++testnum; // Test 5 - check get/set int preferences on nsIAbDirectory

    AB.setIntValue("inttest", 12345);
    do_check_eq(gPref.getIntPref(abConfig.dirPrefID + ".inttest"), 12345);
    do_check_eq(AB.getIntValue("inttest", -1), 12345);

    AB.setIntValue("inttest", 123456);
    do_check_eq(gPref.getIntPref(abConfig.dirPrefID + ".inttest"), 123456);
    do_check_eq(AB.getIntValue("inttest", -2), 123456);


    ++testnum; // Test 6 - check get/set bool preferences on nsIAbDirectory

    AB.setBoolValue("booltest", true);
    do_check_eq(gPref.getBoolPref(abConfig.dirPrefID + ".booltest"), true);
    do_check_eq(AB.getBoolValue("booltest", false), true);

    AB.setBoolValue("booltest", false);
    do_check_eq(gPref.getBoolPref(abConfig.dirPrefID + ".booltest"), false);
    do_check_eq(AB.getBoolValue("booltest", true), false);


    ++testnum; // Test 7 - check get/set string preferences on nsIAbDirectory

    AB.setStringValue("stringtest", "tyu");
    do_check_eq(gPref.getCharPref(abConfig.dirPrefID + ".stringtest"), "tyu");
    do_check_eq(AB.getStringValue("stringtest", ""), "tyu");

  } catch (e) {
    throw "FAILED in AB \"" + abConfig.dirName + "\" in test #" +
          testnum + ": " + e;
  }
}

function run_test() {
  // Check the default personal address book
  check_ab(kPABData);

  // Check the default collected address book
  check_ab(kCABData);
};
