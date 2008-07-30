/**
 * A simple test to check for a regression of bug 448165: Mailnews crashes in
 * nsAbMDBDirectory::DeleteCards if aCards is null
 */
function run_test() {
  // get the Address Book Manager service
  var abManager = Cc["@mozilla.org/abmanager;1"].getService(Ci.nsIAbManager);
  // get the Personal Address Book
  var pab = abManager.getDirectory(kPABData.URI);
  do_check_true(pab instanceof Ci.nsIAbDirectory);
  try {
    pab.deleteCards(null); // this should throw an error
    do_throw("Error, deleteCards should throw an error when null is passed to it");
  }
  catch (e) {
    // make sure the correct error message was thrown
    do_check_neq(e.toString().indexOf("NS_ERROR_INVALID_POINTER"), -1);
  }
}
