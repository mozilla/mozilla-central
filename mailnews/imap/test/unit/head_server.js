// Import fakeserver
load("../../mailnews/fakeserver/maild.js");
load("../../mailnews/fakeserver/imapd.js");

// And mailnews scripts
load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");

const IMAP_PORT = 1024 + 143;

function makeServer(daemon, infoString) {
  if (infoString in configurations)
    return makeHandler(daemon, configurations[infoString].join(","));

  var handler = new IMAP_RFC3501_handler(daemon);
  if (!infoString)
    infoString = "";

  var parts = infoString.split(/ *, */);
  for each (var part in parts) {
    if (part.substring(0, 3) == "RFC")
      mixinExtension(handler, eval("IMAP_" + part + "_extension"));
  }
  var server = new nsMailServer(handler);
  server.start(IMAP_PORT);
  return server;
}

function createLocalIMAPServer() {
  var acctmgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);
  
  var server = acctmgr.createIncomingServer(null, "localhost", "imap");
  server.port = IMAP_PORT;
  server.username = "user";
  server.password = "password";
  server.valid = false;

  var account = acctmgr.createAccount();
  account.incomingServer = server;
  server.valid = true;

  server.QueryInterface(Ci.nsIImapIncomingServer);
  return server;
}
