// We can be executed from multiple depths
// Provide gDEPTH if not already defined
if (typeof gDEPTH == "undefined")
  var gDEPTH = "../../../../";

// Import fakeserver
load(gDEPTH + "mailnews/fakeserver/maild.js");
load(gDEPTH + "mailnews/fakeserver/auth.js");
load(gDEPTH + "mailnews/fakeserver/imapd.js");

// And mailnews scripts
load(gDEPTH + "mailnews/resources/mailDirService.js");
load(gDEPTH + "mailnews/resources/mailTestUtils.js");

const IMAP_PORT = 1024 + 143;

function makeServer(daemon, infoString, otherProps) {
  if (infoString in configurations)
    return makeServer(daemon, configurations[infoString].join(","), otherProps);

  function createHandler(d) {
    var handler = new IMAP_RFC3501_handler(d);
    if (!infoString)
      infoString = "RFC2195";

    var parts = infoString.split(/ *, */);
    for each (var part in parts) {
      if (part.startsWith("RFC"))
        mixinExtension(handler, eval("IMAP_" + part + "_extension"));
    }
    if (otherProps) {
      for (var prop in otherProps)
        handler[prop] = otherProps[prop];
    }
    return handler;
  }
  var server = new nsMailServer(createHandler, daemon);
  server.start(IMAP_PORT);
  return server;
}

function createLocalIMAPServer() {
  let server = create_incoming_server("imap", IMAP_PORT, "user", "password");
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
