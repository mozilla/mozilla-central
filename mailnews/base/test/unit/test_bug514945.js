/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Testing of GetAvailable crashes in bug 514945
 */
 
function run_test()
{ 
  const kValidityManager = Cc['@mozilla.org/mail/search/validityManager;1']
                             .getService(Ci.nsIMsgSearchValidityManager);

  let validityTable = kValidityManager.getTable(Ci.nsMsgSearchScope.offlineMail);

  // When we try to access a bad value of getAvailable, it should give an error,
  //  not crash.
  let BAD_VALUE = 1000000; // some large value that is beyond the array bounds
  let haveExpectedError = false;
  try {
    let isAvailable = validityTable.getAvailable(Ci.nsMsgSearchAttrib.Subject, BAD_VALUE);
  } catch (e) { dump('Error but no crash, this is what we want:' + e + '\n');
                haveExpectedError = true;
              }

  do_check_true(haveExpectedError);

// One of the causes of this is that search term operators are not being
//  initialized, resulting in random values of the operator. Make sure that is
//  fixed.

  const kSearchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);
  let searchTerm = kSearchSession.createTerm();
  do_check_eq(searchTerm.op, Ci.nsMsgSearchOp.Contains);
}
