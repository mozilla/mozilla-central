load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");

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
    "return-path: alice@t1.example.com\r\n" +
    "Disposition-Notification-To: alice@t1.example.com\r\n";

  let mimeHdr = Components.classes["@mozilla.org/messenger/mimeheaders;1"]
                  .createInstance(Components.interfaces.nsIMimeHeaders);
  mimeHdr.initialize(headers, headers.length);
  let receivedHeader = mimeHdr.extractHeader("To", false);
  dump(receivedHeader+"\n");

  // Need to setup some prefs  
  let prefs = Components.classes["@mozilla.org/preferences-service;1"].
                  getService(Components.interfaces.nsIPrefService);
  prefs = prefs.getBranch("");
  prefs.setBoolPref("mail.mdn.report.enabled", true);
  prefs.setIntPref("mail.mdn.report.not_in_to_cc", 2);
  prefs.setIntPref("mail.mdn.report.other", 2);
  prefs.setIntPref("mail.mdn.report.outside_domain", 2);
  
  var msgFolder = gLocalInboxFolder;

  var msgWindow = {};
 
  var msgHdr = {};

  // Everything looks good so far, let's generate the MDN response.
  var mdnGenerator = Components.classes["@mozilla.org/messenger-mdn/generator;1"]
                               .createInstance(Components.interfaces.nsIMsgMdnGenerator);
  const MDN_DISPOSE_TYPE_DISPLAYED = 0;

  prefs.setIntPref("mail.mdn.report.outside_domain", 1);
  var askUser = mdnGenerator.process(MDN_DISPOSE_TYPE_DISPLAYED, msgWindow, msgFolder,
                                     msgHdr.messageKey, mimeHdr, false);
  do_check_false(askUser);

  prefs.setIntPref("mail.mdn.report.outside_domain", 2);
  var askUser = mdnGenerator.process(MDN_DISPOSE_TYPE_DISPLAYED, msgWindow, msgFolder,
                                     msgHdr.messageKey, mimeHdr, false);
  do_check_true(askUser);
}
