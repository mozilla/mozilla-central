/*
 * Test nsMsgHdr's In-Reply-To/References parsing logic.
 */

// Import the main scripts that mailnews tests need to set up and tear down
do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");

const copyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);
const anyOldMessage = do_get_file("../mailnews/test/data/bugmail1");

var refsAndResults = [
  // an empty string is not a reference.
  ["", []],
  // super valid things
  ["<abc@def>", ["abc@def"]],
  ["<up@down> <left@right> <ying@yang>",
    ["up@down", "left@right", "ying@yang"]],
  // whitespace type things
  ["    ", []],
  ["   <left@space>", ["left@space"]],
  ["<space@right>   ", ["space@right"]],
  ["   <space@space>   ", ["space@space"]],
  ["\t<tab@tab>\t", ["tab@tab"]],
  ["<a@b>\n\t<tab@newline.n>", ["a@b", "tab@newline.n"]],
  ["<a@b>\r\t<tab@newline.r>", ["a@b", "tab@newline.r"]],
  ["<a@b>\n\t<tab@newline.nr>", ["a@b", "tab@newline.nr"]],
  ["<a@1>\n<a@2> <a@3>\t <a@4>\n  <a@5>\r\t<a@6>\r\n <a@7>\r\n\t ",
   ["a@1", "a@2", "a@3", "a@4", "a@5", "a@6", "a@7"]],
  // be backwards compatible with old-school things that make some sense
  ["i am a stupid message-id", ["i am a stupid message-id"]],
  ["  those were spaces!", ["those were spaces!"]],
  // be backwards compatible with things that make no sense
  ["  seriously\n who does this?", ["seriously\n who does this?"]],
  // handle things we used to be stupid about
  ["<z@1a> was an awesome message!", ["z@1a"]],
  ["   <z@1b> was an awesomer message!", ["z@1b"]],
  ["I can't get enough of <z@2a>", ["z@2a"]],
  ["   nor of I can enough get <z@2b>   ", ["z@2b"]],
  ["let's talk about <z@3a> shall we", ["z@3a"]],
  ["and then let us speak of <z@3b> and its\n many points", ["z@3b"]],
  // be backwards compatible with things that just seem malicious
  [" 4 < 5", ["4 < 5"]],
  [" 6 > 3", ["6 > 3"]],
  ["  look ma!\n newlines!", ["look ma!\n newlines!"]]
];

/**
 * Parse the references in refsAndResults and ensure their references match
 *  the corresponding results.
 * 
 * @param aMsgHdr A message header that you don't mind if we mess with.
 */
function test_references_header_parsing(aMsgHdr) {
  var iCase, iResult, refString, results;
  for (iCase = 0; iCase < refsAndResults.length; iCase++) {
    refString = refsAndResults[iCase][0];
    results   = refsAndResults[iCase][1];
    
    dump("Setting references to: '" + refString + "'\n");
    aMsgHdr.setReferences(refString);
    if (aMsgHdr.numReferences != results.length) {
      dump("Length mis-match! Was expecting:\n");
      for (iResult = 0; iResult < results.length; iResult++) {
        dump("'" + results[iResult] + "'\n");
      }

      dump("Got:\n");

      for (iResult = 0; iResult < aMsgHdr.numReferences; iResult++) {
        dump("'" + aMsgHdr.getStringReference(iResult) +  "'\n");
      }
      
      do_check_eq(aMsgHdr.numReferences, results.length);
    }
    
    for (iResult = 0; iResult < results.length; iResult++) {
      do_check_eq(aMsgHdr.getStringReference(iResult), results[iResult]);
    }
  }
  
  do_test_finished();
}

/*
 * This infrastructure down here exists just to get
 *  test_references_header_parsing its message header.
 */

function run_test() {
  loadLocalMailAccount();
  do_test_pending();
  copyService.CopyFileMessage(anyOldMessage, gLocalInboxFolder, null, false, 0,
                              "", messageHeaderGetterListener, null);
  return true;
}

var messageHeaderGetterListener = {
  msgKey: null,
  
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  GetMessageId: function (aMessageId) {},
  SetMessageKey: function(aKey) {
    this.msgKey = aKey;
  },
  OnStopCopy: function(aStatus) {
    test_references_header_parsing(
      gLocalInboxFolder.GetMessageHeader(this.msgKey));
  },
}
