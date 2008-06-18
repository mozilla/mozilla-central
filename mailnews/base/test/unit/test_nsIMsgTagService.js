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
 * Kent James <kent@caspia.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
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
 * Tests of nsIMsgTagService.
 *
 * Specifically tests changes implemented in bug 217034
 * Does not do comprehensive testing.
 *
 */
const tagService = Cc["@mozilla.org/messenger/tagservice;1"]
                     .getService(Ci.nsIMsgTagService);

function run_test()
{
  // These are both tags and keys. Note keys are forced to be lower case
  const tag1 = "istag";
  const tag2 = "notistag";
  const tag3 = "istagnot";
  const tag4 = "istagtoo";

  // add a tag
  tagService.addTagForKey(tag1, tag1, null, null);

  // delete any existing tags
  var tagArray = tagService.getAllTags({});
  for (var i = 0; i < tagArray.length; i++)
    tagService.deleteKey(tagArray[i].key);

  // make sure added tag is now gone
  do_check_false(tagService.isValidKey(tag1));

  // add single tag, and check again
  tagService.addTagForKey(tag1, tag1, null, null);
  do_check_true(tagService.isValidKey(tag1));
  do_check_false(tagService.isValidKey(tag4));

  // add second tag and check
  tagService.addTagForKey(tag4, tag4, null, null);
  do_check_true(tagService.isValidKey(tag1));
  do_check_false(tagService.isValidKey(tag2));
  do_check_false(tagService.isValidKey(tag3));
  do_check_true(tagService.isValidKey(tag4));

  // delete a tag and check
  tagService.deleteKey(tag1);
  do_check_false(tagService.isValidKey(tag1));
  do_check_false(tagService.isValidKey(tag2));
  do_check_false(tagService.isValidKey(tag3));
  do_check_true(tagService.isValidKey(tag4));

  // add many tags and check again
  for (i = 0; i < 100; i++)
    tagService.addTagForKey(i, "lotsatags" + i, null, null);
  do_check_false(tagService.isValidKey(tag1));
  do_check_false(tagService.isValidKey(tag2));
  do_check_false(tagService.isValidKey(tag3));
  do_check_true(tagService.isValidKey(tag4));

  for (i = 0; i < 100; i++)
  {
    do_check_true(tagService.isValidKey(i));
    // make sure it knows the difference betweens tags and keys
    do_check_false(tagService.isValidKey("lotsatags" + i));
    // are we confused by key at start of tag?
    do_check_false(tagService.isValidKey(i + "lotsatags"));
  }
}

/*  
  function printTags()
  {
    var tags = tagService.getAllTags({});
    for (var i = 0; i < tags.length; i++)
      print("# " + i + " key [" + tags[i].key + "] tag [" + tags[i].tag + "]");
  }
 */

