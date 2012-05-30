/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

