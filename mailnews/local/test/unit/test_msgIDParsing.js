/*
 * Test bug 676916 - nsParseMailbox parses multi-line message-id header incorrectly
 */


load("../../../resources/mailTestUtils.js");
var gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

loadLocalMailAccount();

let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
               .getService(Ci.nsIMsgAccountManager);
let localAccount = acctMgr.FindAccountForServer(gLocalIncomingServer);
let identity = acctMgr.createIdentity();
identity.email = "bob@t2.exemple.net";
localAccount.addIdentity(identity);
localAccount.defaultIdentity = identity;

function run_test()
{
  var headers = 
    "from: alice@t1.example.com\r\n" + 
    "to: bob@t2.exemple.net\r\n" + 
    "message-id:   \r\n   <abcmessageid>\r\n";

  let localFolder = gLocalInboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  gLocalInboxFolder.addMessage("From \r\n"+ headers + "\r\nhello\r\n");
  var msgHdr = gLocalInboxFolder.GetMessageHeader(0);
  do_check_eq(msgHdr.messageId, "abcmessageid");
}
