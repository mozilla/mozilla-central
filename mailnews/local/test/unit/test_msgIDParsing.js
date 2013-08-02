/*
 * Test bug 676916 - nsParseMailbox parses multi-line message-id header incorrectly
 */


Components.utils.import("resource:///modules/mailServices.js");

var gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

localAccountUtils.loadLocalMailAccount();

let localAccount = MailServices.accounts.FindAccountForServer(gLocalIncomingServer);
let identity = MailServices.accounts.createIdentity();
identity.email = "bob@t2.example.net";
localAccount.addIdentity(identity);
localAccount.defaultIdentity = identity;

function run_test()
{
  var headers = 
    "from: alice@t1.example.com\r\n" + 
    "to: bob@t2.example.net\r\n" + 
    "message-id:   \r\n   <abcmessageid>\r\n";

  let localFolder = gLocalInboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  gLocalInboxFolder.addMessage("From \r\n"+ headers + "\r\nhello\r\n");
  var msgHdr = gLocalInboxFolder.GetMessageHeader(0);
  do_check_eq(msgHdr.messageId, "abcmessageid");
}
