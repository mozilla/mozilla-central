/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgCompose functions relating to listeners.
 */

const SmtpServiceContractID = "@mozilla.org/messengercompose/smtp;1";
const nsISmtpService = Components.interfaces.nsISmtpService;

var testnum = 0;

function run_test() {
  try {
    var smtpService = Components.classes[SmtpServiceContractID]
                                .getService(nsISmtpService);

    ++testnum; // Test 1 - no servers

    var smtpServers = smtpService.smtpServers;
    do_check_false(smtpServers.hasMoreElements());

    do_check_eq(smtpService.defaultServer, null);

    ++testnum; // Test 2 - add single server, and check

    var smtpServer = smtpService.createSmtpServer();

    smtpServer.hostname = "localhost";
    smtpServer.description = "test";

    smtpService.defaultServer = smtpServer;

    ++testnum; // Test 3 - Check to see there is only one element in the server
               // list
    smtpServers = smtpService.smtpServers;
    do_check_true(smtpServers.hasMoreElements());
    do_check_eq(smtpServer, smtpServers.getNext());
    do_check_false(smtpServers.hasMoreElements());

    ++testnum; // Test 4 - Find the server in different ways
    do_check_eq(smtpServer, smtpService.findServer("", "localhost"));
    do_check_eq(smtpServer, smtpService.getServerByKey(smtpServer.key));

    ++testnum; // Test 5 - Try finding one that doesn't exist.
    do_check_eq(null, smtpService.findServer("", "test"));

    ++testnum; // Test 6 - Check default server is still ok
    do_check_eq(smtpServer, smtpService.defaultServer);

    ++testnum; // Test 7 - Delete the only server
    smtpService.deleteSmtpServer(smtpServer);

    smtpServers = smtpService.smtpServers;
    do_check_false(smtpServers.hasMoreElements());
 
    //    do_check_eq(null, smtpService.defaultServer);

    ++testnum; // Test 8 - add multiple servers

    var smtpServerArray = new Array(3);
    var i;

    for (i = 0; i < 3; ++i)
      smtpServerArray[i] = smtpService.createSmtpServer();

    smtpServerArray[0].hostname = "localhost";
    smtpServerArray[0].description = "test";
    smtpServerArray[0].username = "user";

    smtpServerArray[1].hostname = "localhost";
    smtpServerArray[1].description = "test1";
    smtpServerArray[1].username = "user1";

    smtpServerArray[2].hostname = "localhost1";
    smtpServerArray[2].description = "test2";
    smtpServerArray[2].username = "";

    // Now check them
    smtpServers = smtpService.smtpServers;

    var found = [false, false, false];

    while (smtpServers.hasMoreElements()) {
      var smtpServer = smtpServers.getNext();

      for (i = 0; i < 3; ++i)
        if (smtpServer == smtpServerArray[i])
          found[i] = true;
    }

    do_check_eq(found, "true,true,true");

    ++testnum; // Test 9 - Find the servers.

    do_check_eq(smtpServerArray[0], smtpService.findServer("user", "localhost"));
    do_check_eq(smtpServerArray[1], smtpService.findServer("user1", "localhost"));
    do_check_eq(smtpServerArray[2], smtpService.findServer("", "localhost1"));

    do_check_eq(null, smtpService.findServer("user2", "localhost"));

    // XXX: FIXME
    // do_check_eq(null, smtpService.findServer("", "localhost"));

    for (i = 0; i < 3; ++i)
      do_check_eq(smtpServerArray[i],
                  smtpService.getServerByKey(smtpServerArray[i].key));

    ++testnum; // Test 10 - Delete the servers

    for (i = 0; i < 3; ++i)
      smtpService.deleteSmtpServer(smtpServerArray[i]);

    smtpServers = smtpService.smtpServers;
    do_check_false(smtpServers.hasMoreElements());
  }
  catch (e) {
    throw "FAILED in test #" + testnum + " : " + e;
  }
};
