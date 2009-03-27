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
  notifyWhenDatastoreDone(next_test);
}

function test_basics() {
  let jpeg = MimeTypeNoun.getMimeType("image/jpeg");
  LOG.debug("jpeg mime type: " + jpeg);
  curPassResults.push(jpeg);
  
  let png = MimeTypeNoun.getMimeType("image/png");
  LOG.debug("jpeg mime type: " + png);
  curPassResults.push(png);
  
  let html = MimeTypeNoun.getMimeType("text/html");
  LOG.debug("jpeg mime type: " + html);
  curPassResults.push(html);
  
  let plain = MimeTypeNoun.getMimeType("text/plain");
  LOG.debug("jpeg mime type: " + plain);
  curPassResults.push(plain);
  
  // sanity-checking the parsing
  do_check_eq(jpeg.type, "image");
  do_check_eq(jpeg.subType, "jpeg");
  // - make sure the numeric trickiness for the block stuff is actually doing
  //  the right thing!
  BLOCK_SIZE = MimeTypeNoun.TYPE_BLOCK_SIZE;
  // same blocks
  do_check_eq(Math.floor(jpeg.id / BLOCK_SIZE),
              Math.floor(png.id / BLOCK_SIZE));
  do_check_eq(Math.floor(html.id / BLOCK_SIZE),
              Math.floor(plain.id / BLOCK_SIZE));
  // different blocks
  do_check_neq(Math.floor(jpeg.id / BLOCK_SIZE),
               Math.floor(html.id / BLOCK_SIZE));
  
  next_test();
}

function verify_passes_are_the_same() {
  var firstPassResults = passResults[0];
  for (let iType = 0; iType < curPassResults.length; iType++) {
    for (let iPass = 1; iPass < passResults.length; iPass++) {
      do_check_eq(firstPassResults[iType].id,
                  passResults[iPass][iType].id);
    }
  }
  next_test();
}

/* ===== Driver ===== */

var tests = [
  new_pass,
  test_basics,
  new_pass,
  test_basics,
  verify_passes_are_the_same
];

function run_test() {
  // use mbox injection so we get multiple folders...
  injectMessagesUsing(INJECT_MBOX);
  glodaHelperRunTests(tests);
}
