load("../../mailnews/resources/messageGenerator.js");

var gMessages = [];
const nsMsgSearchScope  = Ci.nsMsgSearchScope;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;
const nsMsgSearchOp     = Ci.nsMsgSearchOp;
const nsMsgMessageFlags = Ci.nsMsgMessageFlags;
const nsMsgFolderFlags = Ci.nsMsgFolderFlags;

const kSetCount = 13;
const kNumExpectedMatches = 10;

function setupGlobals()
{
  loadLocalMailAccount();
  // Create a message generator
  gMessageGenerator = new MessageGenerator();
  let localInbox = gLocalInboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);

  for (let i = 0; i < kSetCount; i++) {
    let message = gMessageGenerator.makeMessage();
    gMessages.push(message);
    localInbox.addMessage(message.toMboxString());
  }
}

function run_test() {
  setupGlobals();
  do_test_pending();
  let inboxDB = gLocalInboxFolder.msgDatabase;

  // give messages 1,3,5 gloda-ids. These won't end up in our search hits.
  let msgHdr1 = inboxDB.getMsgHdrForMessageID(gMessages[0].messageId);
  msgHdr1.setUint32Property("gloda-id", 11111);
  let msgHdr3 = inboxDB.getMsgHdrForMessageID(gMessages[2].messageId);
  msgHdr3.setUint32Property("gloda-id", 33333);
  let msgHdr5 = inboxDB.getMsgHdrForMessageID(gMessages[4].messageId);
  msgHdr5.setUint32Property("gloda-id", 5555);
  // set up a search term array that will give us the array of messages
  // that gloda should index, as defined by this function:
  let searchSession = Cc["@mozilla.org/messenger/searchSession;1"]
                        .createInstance(Ci.nsIMsgSearchSession);
  let searchTerms = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);

  searchSession.addScopeTerm(Ci.nsMsgSearchScope.offlineMail, gLocalInboxFolder);
  let searchTerm = searchSession.createTerm();

  // Create the following search term:
  // (folderFlag & Mail && folderFlag != ImapBox) &&
  //    msg property.gloda-id isEmpty

  searchTerm.beginsGrouping = true;
  searchTerm.booleanAnd = true;
  searchTerm.attrib = nsMsgSearchAttrib.FolderFlag;
  searchTerm.op = nsMsgSearchOp.Is;
  let value = searchTerm.value;
  value.status = nsMsgFolderFlags.Mail;
  value.attrib = nsMsgSearchAttrib.FolderFlag;
  searchTerm.value = value;
  searchTerms.appendElement(searchTerm, false);

  searchTerm = searchSession.createTerm();
  searchTerm.booleanAnd = true;
  searchTerm.attrib = nsMsgSearchAttrib.FolderFlag;
  searchTerm.op = nsMsgSearchOp.Isnt;
  value = searchTerm.value;
  value.status = nsMsgFolderFlags.ImapBox;
  value.attrib = nsMsgSearchAttrib.FolderFlag;
  searchTerm.value = value;
  searchTerm.endsGrouping = true;
  searchTerms.appendElement(searchTerm, false);

  searchTerm = searchSession.createTerm();
  searchTerm.booleanAnd = true;
  searchTerm.attrib = nsMsgSearchAttrib.HdrProperty;
  searchTerm.hdrProperty = "gloda-id";
  searchTerm.op = nsMsgSearchOp.IsEmpty;
  value = searchTerm.value;
  value.str = "gloda-id";
  value.attrib = nsMsgSearchAttrib.HdrProperty;
  searchTerm.value = value;
  searchTerms.appendElement(searchTerm, false);

  let filterEnumerator = inboxDB.getFilterEnumerator(searchTerms);
  let numMatches = {};
  let keepGoing = inboxDB.nextMatchingHdrs(filterEnumerator, 100, 100, null, numMatches);
  do_check_eq(kNumExpectedMatches, numMatches.value);
  do_check_false(keepGoing);
  filterEnumerator = inboxDB.getFilterEnumerator(searchTerms);
  let matchingHdrs = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  do {
    keepGoing = inboxDB.nextMatchingHdrs(filterEnumerator, 5, 5, matchingHdrs, numMatches);
  }
  while (keepGoing);
  do_check_eq(kNumExpectedMatches, matchingHdrs.length);
  let firstMatch = matchingHdrs.queryElementAt(0, Ci.nsIMsgDBHdr);
  do_check_eq(firstMatch.messageId, gMessages[1].messageId);
  let secondMatch = matchingHdrs.queryElementAt(1, Ci.nsIMsgDBHdr);
  do_check_eq(secondMatch.messageId, gMessages[3].messageId);

  // try it backwards, with roller skates:
  filterEnumerator = inboxDB.getFilterEnumerator(searchTerms, true);
  matchingHdrs.clear();
  do {
    keepGoing = inboxDB.nextMatchingHdrs(filterEnumerator, 5, 5, matchingHdrs, numMatches);
  }
  while (keepGoing);
  do_check_eq(kNumExpectedMatches, matchingHdrs.length);
  let firstMatch = matchingHdrs.queryElementAt(0, Ci.nsIMsgDBHdr);
  do_check_eq(firstMatch.messageId, gMessages[12].messageId);
  let secondMatch = matchingHdrs.queryElementAt(1, Ci.nsIMsgDBHdr);
  do_check_eq(secondMatch.messageId, gMessages[11].messageId);
  let tenthMatch = matchingHdrs.queryElementAt(9, Ci.nsIMsgDBHdr);
  do_check_eq(tenthMatch.messageId, gMessages[1].messageId);

  do_test_finished();
}
