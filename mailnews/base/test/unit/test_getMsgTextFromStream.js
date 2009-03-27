/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * Test suite for GetMsgTextFromStream.
 *
 * Currently tests: text/plain, text/html -- with tags stripped and without,
 * base64, multipart.
 * Does not currently test: quoted-printable, stripping quotes, UTF-8, small values of
 * bytesToRead.
 */
const kDataRoot = "../../mailnews/data/"

function create(fileName, bytes, compressQuotes, stripHTML, outContentType)
{
  return {name: fileName, bytesToRead: bytes, compressQuotes: compressQuotes, stripHTML: stripHTML,
          contentType: outContentType};
}

const gTestFiles =
[
  create("basic1", 1024, false, false, "text/plain"), // Simple plain text
  create("basic1", 1024, false, true, "text/plain"), // should be same as above
  create("basic2", 1024, false, false, "text/html"), // Simple HTML
  create("basic3", 1024, false, true, "text/html"), // HTML with tags stripped out
  create("basic4", 1024, false, false, "text/plain"), // No content type, should be assumed to be text/plain
  create("basic4", 1024, false, true, "text/plain"),
  create("basic5", 1024, false, false, "text/plain"), // HTML content in text/plain
  create("basic5", 1024, false, true, "text/plain"),
  create("base64-1", 1024, false, false, "text/plain"), // base64 text/plain
  create("base64-1", 1024, false, true, "text/plain"),
  create("base64-2", 1024, false, false, "text/html"), // base64 text/html
  create("base64-3", 1024, false, true, "text/html"), // strip out tags here
  create("multipart1", 1024, false, false, "text/plain"), // basic multipart message
  create("multipart1", 1024, false, true, "text/plain"),
  create("multipart2", 1024, false, false, "text/html"), // multipart HTML
  create("multipart3", 1024, false, true, "text/html"),
  create("multipart4", 1024, false, false, "text/plain"), // text with no headers
  create("multipart4", 1024, false, true, "text/plain"),
  create("multipart-base64-1", 1024, false, false, "text/plain"), // base64 encoded text
  create("multipart-base64-1", 1024, false, true, "text/plain"),
  create("multipart-base64-2", 1024, false, false, "text/html"),
  create("multipart-base64-3", 1024, false, true, "text/html"),
  create("multipart-complex1", 1024, false, true, "text/html"), // Things get more complex here
  create("multipart-complex2", 1024, false, false, "text/plain"),
  create("multipart-complex2", 1024, false, true, "text/plain"),
]

function run_test()
{
  loadLocalMailAccount();
  var folder = gLocalIncomingServer.rootMsgFolder;

  gTestFiles.forEach(function (test)
  {
    dump("Testing "+test.name+"\n");
    var inFile = do_get_file(kDataRoot + test.name);
    var inStream = Cc["@mozilla.org/network/file-input-stream;1"]
                     .createInstance(Ci.nsIFileInputStream);
    inStream.init(inFile, -1, -1, Ci.nsIFileInputStream.CLOSE_ON_EOF);

    // Now get the message body using getMsgTextFromStream
    var contentType = {};
    var body = folder.getMsgTextFromStream(inStream, "", test.bytesToRead, 65536,
                                           test.compressQuotes, test.stripHTML, contentType);

    // Now we need to compare the output
    do_check_eq(test.contentType, contentType.value);

    var resultFile = do_get_file(kDataRoot + test.name + ".out");
    var actualBody = loadFileToString(resultFile, "UTF-8");
    do_check_eq(body, actualBody);
  });
}
