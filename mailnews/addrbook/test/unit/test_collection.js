/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for the Address Collecter Service.
 *
 * XXX todo:
 * - check addition of names with no email addresses (shouldn't allow)
 * - check addition of names and email addresses
 * - check addition of screenname
 * - check updates to existing cards
 */

const nsIAbPMF = Components.interfaces.nsIAbPreferMailFormat;

var testnum = 0;

// Emails and prefer mail format types to check for correct collection.
//
// Note: these emails should be different to allow collecting an address to
// add a different card each time.
var addEmailChecks = [ ["test0@invalid.com", nsIAbPMF.unknown],
                       ["test1@invalid.com", nsIAbPMF.plaintext],
                       ["test2@invalid.com", nsIAbPMF.html],
                       // UTF-8 based addresses (bug 407564)
                       ["test0@\u00D0.com", nsIAbPMF.unknown],
                       ["test0\u00D0@invalid.com", nsIAbPMF.unknown],
                     ];

var collectChecker = {
  addressCollect: null,
  AB: null,

  checkAddress : function (aDetails) {
    try {
      this.addressCollect.collectAddress(aDetails[0], true, aDetails[1]);

      var card = this.AB.cardForEmailAddress(aDetails[0]);

      do_check_true(card != null);

      do_check_eq(card.preferMailFormat, aDetails[1]);
    }
    catch (e) {
      throw "FAILED in checkAddress(" + aDetails[0] + ", " + aDetails[1] + ") : " + e;
    }
  }
};

function run_test()
{
  try {
    ++testnum; // Test 1 - Get the address collecter

    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);

    // XXX Getting the top level and then the child nodes ensures we create all
    // ABs because the address collecter can't currently create ABs itself
    // (bug 314448).
    var rdf = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                        .getService(Components.interfaces.nsIRDFService);
    do_check_true(rdf != null);

    // Must get the top level and its child nodes to initialise the mailing
    // lists. This isn't idea, but its how we currently work.
    var temp = rdf.GetResource("moz-abdirectory:///")
                  .QueryInterface(Components.interfaces.nsIAbDirectory)
                  .childNodes;

    // Get the actual AB for the collector so we can check cards have been
    // added.
    collectChecker.AB =
      rdf.GetResource(prefService.getCharPref("mail.collect_addressbook"))
         .QueryInterface(Components.interfaces.nsIAbMDBDirectory);

    do_check_true(collectChecker.AB != null);

    // Get the actual collecter
    collectChecker.addressCollect =
      Components.classes["@mozilla.org/addressbook/services/addressCollecter;1"]
                .getService(Components.interfaces.nsIAbAddressCollecter);

    do_check_true(collectChecker.addressCollect != null);

    ++testnum; // Test 2 - Email doesn't exist, but don't add it.

    // As we've just set everything up, we know we haven't got anything in the
    // AB, so just try and collect without adding.
    collectChecker.addressCollect.collectAddress(addEmailChecks[0][0],
                                                 false,
                                                 addEmailChecks[0][1]);

    var card = collectChecker.AB.cardForEmailAddress(addEmailChecks[0][0]);

    do_check_true(card == null);

    ++testnum; // Test 3 - Try and collect various emails and formats.

    addEmailChecks.forEach(collectChecker.checkAddress, collectChecker);

  } catch (e) {
    throw "FAILED in address collector tests in test #" + testnum + ": " + e;
  }
};

