/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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
 * Test noun_mimetype.  Exists because I just changed its implementation and I'm
 * afraid I may have damaged it and it's hard to tell, so ironically a unit test
 * is the easiest solution.  (Don't you hate it when the right thing to do is
 * also the easy thing to do?)
 */

load("resources/glodaTestHelper.js");

Components.utils.import("resource://app/modules/gloda/noun_mimetype.js");

/* ===== Tests ===== */

var passResults = [];
var curPassResults;
/**
 * Setup a new 'pass' by nuking the MimeTypeNoun's state if it has any.  The
 *  goal here is to verify that the database persistence is actually working,
 *  and we can only do that if we convince it to nuke its authoritative 'cache'
 *  and grab a new copy.
 */
function new_pass() {
  // we have to nuke if it has already happened...
  if (passResults.length) {
    MimeTypeNoun._mimeTypes = {};
    MimeTypeNoun._mimeTypesByID = {};
    MimeTypeNoun._mimeTypeHighID = {};
    MimeTypeNoun._highID = 0;
    MimeTypeNoun._init();
  }
  curPassResults = [];
  passResults.push(curPassResults);

  // the mime type does some async stuff... make sure we don't advance until
  //  it is done with said stuff.
  yield wait_for_gloda_db_flush();
}

function test_basics() {
  let python;
  // if this is not the first pass, check for python before other things to
  //  make sure we're not just relying on consistent logic rather than actual
  //  persistence
  if (passResults.length)
    python = MimeTypeNoun.getMimeType("text/x-python");

  let jpeg = MimeTypeNoun.getMimeType("image/jpeg");
  curPassResults.push(jpeg);

  let png = MimeTypeNoun.getMimeType("image/png");
  curPassResults.push(png);

  let html = MimeTypeNoun.getMimeType("text/html");
  curPassResults.push(html);

  let plain = MimeTypeNoun.getMimeType("text/plain");
  curPassResults.push(plain);

  // if this is for the first time, check for python now (see above)
  if (!passResults.length)
    python = MimeTypeNoun.getMimeType("text/x-python");
  // but always add it to the results now, as we need consistent ordering
  //  since we use a list.
  curPassResults.push(python);


  // sanity-checking the parsing
  do_check_eq(jpeg.type, "image");
  do_check_eq(jpeg.subType, "jpeg");

  // - make sure the numeric trickiness for the block stuff is actually doing
  //  the right thing!
  const BLOCK_SIZE = MimeTypeNoun.TYPE_BLOCK_SIZE;
  // same blocks
  do_check_eq(Math.floor(jpeg.id / BLOCK_SIZE),
              Math.floor(png.id / BLOCK_SIZE));
  do_check_eq(Math.floor(html.id / BLOCK_SIZE),
              Math.floor(plain.id / BLOCK_SIZE));
  // different blocks
  do_check_neq(Math.floor(jpeg.id / BLOCK_SIZE),
               Math.floor(html.id / BLOCK_SIZE));
}

function test_parameters() {
  let plain = MimeTypeNoun.getMimeType("text/plain");
  do_check_eq(plain, MimeTypeNoun.getMimeType('text/plain; charset="UTF-8"'));
}

function verify_passes_are_the_same() {
  var firstPassResults = passResults[0];
  for (let iType = 0; iType < curPassResults.length; iType++) {
    for (let iPass = 1; iPass < passResults.length; iPass++) {
      do_check_eq(firstPassResults[iType].id,
                  passResults[iPass][iType].id);
    }
  }
}

/* ===== Driver ===== */

var tests = [
  // do two passes of test_basics making sure that persisted values really
  //  persist...
  new_pass,
  test_basics,
  new_pass,
  test_basics,
  verify_passes_are_the_same,

  test_parameters,

];

function run_test() {
  glodaHelperRunTests(tests);
}
