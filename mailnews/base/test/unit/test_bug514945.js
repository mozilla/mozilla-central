/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
