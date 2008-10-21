// Import the main scripts that mailnews tests need to set up and tear down
do_import_script("../mailnews/test/resources/mailDirService.js");
do_import_script("../mailnews/test/resources/mailTestUtils.js");

// Import the pop3 server scripts
do_import_script("../mailnews/test/fakeserver/maild.js")
do_import_script("../mailnews/test/fakeserver/pop3d.js")

const POP3_PORT = 1024+110;

// Setup the daemon and server
// If the debugOption is set, then it will be applied to the server.
function setupServerDaemon(debugOption) {
  var daemon = new pop3Daemon();
  var handler = new POP3_RFC1939_handler(daemon);
  var server = new nsMailServer(handler);
  if (debugOption)
    server.setDebugLevel(debugOption);
  return [daemon, server, handler];
}

function createPop3ServerAndLocalFolders() {
  loadLocalMailAccount();

  var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                  .getService(Ci.nsIMsgAccountManager);

  var incoming = acctMgr.createIncomingServer("fake", "localhost", "pop3");

  incoming.port = POP3_PORT;
  incoming.password = "server";

  return incoming;
}

function do_check_transaction(real, expected) {
  // real.them may have an extra QUIT on the end, where the stream is only
  // closed after we have a chance to process it and not them. We therefore
  // excise this from the list
  if (real.them[real.them.length-1] == "QUIT")
    real.them.pop();

  do_check_eq(real.them.join(","), expected.join(","));
  dump("Passed test " + test + "\n");
}
