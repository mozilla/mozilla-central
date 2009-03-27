/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for the Address Collector Service part 2.
 *
 * This test checks that we don't collect addresses when they already exist
 * in other address books.
 */

const nsIAbPMF = Components.interfaces.nsIAbPreferMailFormat;

function run_test()
{
  // Test - Get the address collecter

  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch);

  var abManager = Components.classes["@mozilla.org/abmanager;1"]
                            .getService(Components.interfaces.nsIAbManager);

  // Get the actual collecter
  var addressCollect =
    Components.classes["@mozilla.org/addressbook/services/addressCollector;1"]
              .getService(Components.interfaces.nsIAbAddressCollector);

  // Set the new pref afterwards to ensure we change correctly
  prefService.setCharPref("mail.collect_addressbook", kCABData.URI);

  // For this test use an address book that isn't the one we're collecting
  // to.
  var testAB = do_get_file("data/collect.mab");

  testAB.copyTo(gProfileDir, kPABData.fileName);

  // XXX Getting all directories ensures we create all ABs because the
  // address collecter can't currently create ABs itself (bug 314448).
  var temp = abManager.directories;

  addressCollect.collectAddress("Other Book <other@book.invalid>", true,
                                nsIAbPMF.unknown);

  var PAB = abManager.getDirectory(kPABData.URI);

  var childCards = PAB.childCards;

  do_check_true(childCards.hasMoreElements());

  var card = childCards.getNext().QueryInterface(Components.interfaces.nsIAbCard);

  do_check_eq(card.displayName, "Other Book");
  do_check_eq(card.primaryEmail, "other@book.invalid");

  // Check the CAB has no cards.
  var CAB = abManager.getDirectory(kCABData.URI);

  do_check_false(CAB.childCards.hasMoreElements());
};
