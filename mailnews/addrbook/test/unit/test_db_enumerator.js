/**
 * This test verifies that we don't crash if we have an enumerator on an
 * addr database and delete the underlying directory, which forces the ab
 * closed.
 */
var abm             = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
var ab_prefix       = "test-537815-";
var re_prefix       = new RegExp(ab_prefix)
var card_properties = { FirstName: "01-first-3", LastName: "02-last", PrimaryEmail: "08-email-1@zindus.com" };
var max_addressbooks = 10;

function bug_537815_fixture_setup()
{
  let i, key;

  for (i = 1; i <= max_addressbooks; i++) {
    let ab_name = ab_prefix + i;
    abm.newAddressBook(ab_name, "", 2);
    dump("created: " + ab_name + "\n");

    for (var j = 1; j < 2; j++) {
      let enm_dirs = abm.directories;
      while (enm_dirs.hasMoreElements()) {
        let elem = enm_dirs.getNext().QueryInterface(Ci.nsIAbDirectory);
        let uri = elem.URI;
        let dir = abm.getDirectory(uri);

        dump("considering: j: " + j + " " + elem.dirName + "\n");

        if (j == 1 && String(elem.dirName).match(re_prefix)) {
          for (i = 1; i <= 1000; i++) {
            let abCard = Cc["@mozilla.org/addressbook/cardproperty;1"].createInstance().QueryInterface(Ci.nsIAbCard);

            for (key in card_properties)
              abCard.setProperty(key, card_properties[key]);

            abCard = dir.addCard(abCard);
          }
          dump("populated: " + elem.dirName + "\n");
        }
      }
    }
  }
}

function bug_537815_test()
{
  let enm_dirs = abm.directories;
  let i, key;

  while (enm_dirs.hasMoreElements()) {
    let elem = enm_dirs.getNext().QueryInterface(Ci.nsIAbDirectory);
    let uri  = elem.URI;
    let dir  = abm.getDirectory(uri);

    if (String(elem.dirName).match(re_prefix)) {
      let enm_cards = dir.childCards;

      while (enm_cards.hasMoreElements()) {
        let item = enm_cards.getNext();
        let abCard = item.QueryInterface(Ci.nsIAbCard);

        for (i in card_properties) {
          let value = abCard.getProperty(key, null);
        }
      }
      dump("visited all cards in: " + elem.dirName + "\n");
    }
  }
}

function test_bug_537815()
{
  bug_537815_fixture_setup();
  bug_537815_test();
  bug_537815_fixture_tear_down();
}

function bug_537815_fixture_tear_down()
{
  let enm_dirs = abm.directories;
  let a_uri = {};

  while (enm_dirs.hasMoreElements()) {
    let elem = enm_dirs.getNext().QueryInterface(Ci.nsIAbDirectory);

    if (String(elem.dirName).match(re_prefix)) {
      a_uri[elem.URI] = true;
      dump("to be deleted: " + elem.dirName + "\n");
    }
  }

  for (let uri in a_uri)
    abm.deleteAddressBook(uri);
}

function run_test()
{
  test_bug_537815();
}
