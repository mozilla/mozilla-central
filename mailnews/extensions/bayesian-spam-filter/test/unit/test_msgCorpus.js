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
 * Portions created by the Initial Developer are Copyright (C) 2009
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

// Tests corpus management functions using nsIMsgCorpus

var msgCorpus =
  Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
    .getService(Ci.nsIMsgCorpus);

// tokens found in the test corpus file. trait 1001 was trained with
// 2 messages, and trait 1003 with 1.

var tokenData = [
// [traitid, count, token]
  [1001, 0, "iDoNotExist"],
  [1001, 1, "linecount"],
  [1001, 2, "envelope-to:kenttest@caspia.com"],
  [1003, 0, "iAlsoDoNotExist"],
  [1003, 0, "isjunk"], // in 1001 but not 1003
  [1003, 1, "linecount"],
  [1003, 1, "subject:test"],
  [1003, 1, "envelope-to:kenttest@caspia.com"],
]

// list of tests

var gTests =
[
  // train two different combinations of messages
  function checkLoadOnce() {
    let fileName = "msgCorpus.dat";
    let file = do_get_file("resources/" + fileName);
    msgCorpus.updateData(file, true);

    // check message counts
    let messageCount = {};
    msgCorpus.corpusCounts(1001, messageCount);
    do_check_eq(2, messageCount.value);
    msgCorpus.corpusCounts(1003, messageCount);
    do_check_eq(1, messageCount.value);

    for (i = 0; i < tokenData.length; i++) {
      let id = tokenData[i][0];
      let count = tokenData[i][1];
      let word = tokenData[i][2];
      do_check_eq(count, msgCorpus.getTokenCount(word, id));
    }
  },
  function checkLoadTwice() {
    let fileName = "msgCorpus.dat";
    let file = do_get_file("resources/" + fileName);
    msgCorpus.updateData(file, true);

    // check message counts
    let messageCount = {};
    msgCorpus.corpusCounts(1001, messageCount);
    do_check_eq(4, messageCount.value);
    msgCorpus.corpusCounts(1003, messageCount);
    do_check_eq(2, messageCount.value);

    for (i = 0; i < tokenData.length; i++) {
      let id = tokenData[i][0];
      let count = 2 * tokenData[i][1];
      let word = tokenData[i][2];
      do_check_eq(count, msgCorpus.getTokenCount(word, id));
    }
  },
  // remap the ids in the file to different local ids
  function loadWithRemap() {
    let fileName = "msgCorpus.dat";
    let file = do_get_file("resources/" + fileName);
    msgCorpus.updateData(file, true, 2, [1001, 1003], [1, 3]);

    for (i = 0; i < tokenData.length; i++) {
      let id = tokenData[i][0] - 1000;
      let count = tokenData[i][1];
      let word = tokenData[i][2];
      do_check_eq(count, msgCorpus.getTokenCount(word, id));
    }
  },
  // test removing data
  function checkRemove() {
    let fileName = "msgCorpus.dat";
    let file = do_get_file("resources/" + fileName);
    msgCorpus.updateData(file, false);

    // check message counts
    let messageCount = {};
    msgCorpus.corpusCounts(1001, messageCount);
    do_check_eq(2, messageCount.value);
    msgCorpus.corpusCounts(1003, messageCount);
    do_check_eq(1, messageCount.value);

    for (i = 0; i < tokenData.length; i++) {
      let id = tokenData[i][0];
      let count = tokenData[i][1];
      let word = tokenData[i][2];
      do_check_eq(count, msgCorpus.getTokenCount(word, id));
    }
  },
  // test clearing a trait
  function checkClear() {
    let messageCountObject = {};
    /*
    msgCorpus.corpusCounts(1001, messageCountObject);
    let v1001 = messageCountObject.value;
    msgCorpus.corpusCounts(1003, messageCountObject);
    let v1003 = messageCountObject.value;
    dump("pre-clear value " + v1001 + " " + v1003 + "\n");
    /**/
    msgCorpus.clearTrait(1001);
    // check that the message count is zero
    msgCorpus.corpusCounts(1001, messageCountObject);
    do_check_eq(0, messageCountObject.value);
    // but the other trait should still have counts
    msgCorpus.corpusCounts(1003, messageCountObject);
    do_check_eq(1, messageCountObject.value);
    // check that token count was cleared
    for (i = 0; i < tokenData.length; i++) {
      let id = tokenData[i][0];
      let count = tokenData[i][1];
      let word = tokenData[i][2];
      do_check_eq(id == 1001 ? 0 : count, msgCorpus.getTokenCount(word, id));
    }
  },

]

// main test
function run_test()
{
  do_test_pending();
  while(1)
  {
    if (!gTests.length)       // Do we have more commands?
    {
      // no, all done
      do_test_finished();
      return;
    }

    let test = gTests.shift();
    test();
  }
}
