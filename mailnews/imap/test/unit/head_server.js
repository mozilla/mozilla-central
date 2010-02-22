// Import fakeserver
load("../../mailnews/fakeserver/maild.js");
load("../../mailnews/fakeserver/auth.js");
load("../../mailnews/fakeserver/imapd.js");

// And mailnews scripts
load("../../mailnews/resources/mailDirService.js");
load("../../mailnews/resources/mailTestUtils.js");

const IMAP_PORT = 1024 + 143;

function makeServer(daemon, infoString) {
  if (infoString in configurations)
    return makeServer(daemon, configurations[infoString].join(","));

  var handler = new IMAP_RFC3501_handler(daemon);
  if (!infoString)
    infoString = "RFC2195";

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

  var server = acctmgr.createIncomingServer("user", "localhost", "imap");
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

// <copied from="head_maillocal.js">
/**
 * @param fromServer server.playTransaction
 * @param expected ["command", "command", ...]
 * @param withParams if false,
 *    everything apart from the IMAP command will the stripped.
 *    E.g. 'lsub "" "*"' will be compared as 'lsub'.
 *    Exception is "authenticate", which also get its first parameter in upper case,
 *    e.g. "authenticate CRAM-MD5".
 */
function do_check_transaction(fromServer, expected, withParams) {
  // If we don't spin the event loop before starting the next test, the readers
  // aren't expired. In this case, the "real" real transaction is the last one.
  if (fromServer instanceof Array)
    fromServer = fromServer[fromServer.length - 1];

  var realTransaction = new Array();
  for (var i = 0; i < fromServer.them.length; i++)
  {
    var line = fromServer.them[i]; // e.g. '1 login "user" "password"'
    var components = line.split(" ");
    if (components.length < 2)
      throw "IMAP command in transaction log missing: " + line;
    if (withParams)
      realTransaction.push(line.substr(components[0].length + 1));
    else if (components[1] == "authenticate")
      realTransaction.push(components[1] + " " + components[2].toUpperCase());
    else
      realTransaction.push(components[1]);
  }

  do_check_eq(realTransaction.join(", "), expected.join(", "));
}
