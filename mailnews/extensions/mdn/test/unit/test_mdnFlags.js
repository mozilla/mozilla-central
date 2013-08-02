/**
 * This tests that setting mdn flags works correctly, so that we don't
 * reprompt when the user re-selects a message.
 */

var gMessenger = Cc["@mozilla.org/messenger;1"].
                   createInstance(Ci.nsIMessenger);

localAccountUtils.loadLocalMailAccount();

let localAccount = MailServices.accounts
                               .FindAccountForServer(localAccountUtils.incomingServer);
let identity = MailServices.accounts.createIdentity();
identity.email = "bob@t2.example.net";
localAccount.addIdentity(identity);
localAccount.defaultIdentity = identity;



function run_test()
{
  var headers = 
    "from: alice@t1.example.com\r\n" +
    "to: bob@t2.example.net\r\n" +
    "return-path: alice@t1.example.com\r\n" +
    "Disposition-Notification-To: alice@t1.example.com\r\n";

  let mimeHdr = Components.classes["@mozilla.org/messenger/mimeheaders;1"]
                  .createInstance(Components.interfaces.nsIMimeHeaders);
  mimeHdr.initialize(headers);
  let receivedHeader = mimeHdr.extractHeader("To", false);

  let localFolder = localAccountUtils.inboxFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  localAccountUtils.inboxFolder.addMessage("From \r\n"+ headers + "\r\nhello\r\n");
  // Need to setup some prefs  
  Services.prefs.setBoolPref("mail.mdn.report.enabled", true);
  Services.prefs.setIntPref("mail.mdn.report.not_in_to_cc", 2);
  Services.prefs.setIntPref("mail.mdn.report.other", 2);
  Services.prefs.setIntPref("mail.mdn.report.outside_domain", 2);
  
  var msgFolder = localAccountUtils.inboxFolder;

  var msgWindow = {};
 
  var msgHdr = mailTestUtils.firstMsgHdr(localAccountUtils.inboxFolder);

  // Everything looks good so far, let's generate the MDN response.
  var mdnGenerator = Components.classes["@mozilla.org/messenger-mdn/generator;1"]
                               .createInstance(Components.interfaces.nsIMsgMdnGenerator);
  const MDN_DISPOSE_TYPE_DISPLAYED = 0;

  mdnGenerator.process(MDN_DISPOSE_TYPE_DISPLAYED, msgWindow, msgFolder,
                       msgHdr.messageKey, mimeHdr, false);
  mdnGenerator.userDeclined();
  do_check_neq(msgHdr.flags & Ci.nsMsgMessageFlags.MDNReportSent, 0);
  do_check_eq(msgHdr.flags & Ci.nsMsgMessageFlags.MDNReportNeeded, 0);
}
