/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for getting mailbox urls via the protocol handler.
 */

const defaultProtocolFlags =
  Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
  Ci.nsIProtocolHandler.URI_STD |
  Ci.nsIProtocolHandler.URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT;

const protocols =
  [ { protocol: "mailbox",
      urlSpec: "mailbox://user@localhost/",
      // mailbox protocol doesn't use a port
      defaultPort: -1
    },
  ];

function run_test()
{
  for (var part = 0; part < protocols.length; ++part) {
    print("protocol: " + protocols[part].protocol);

    var pH = Cc["@mozilla.org/network/protocol;1?name=" +
                protocols[part].protocol]
               .createInstance(Ci.nsIProtocolHandler);

    do_check_eq(pH.scheme, protocols[part].protocol);
    do_check_eq(pH.defaultPort, protocols[part].defaultPort);
    do_check_eq(pH.protocolFlags, defaultProtocolFlags);

    // Whip through some of the ports to check we get the right results.
    for (let i = 0; i < 1024; ++i)
      do_check_eq(pH.allowPort(i, ""), false);

    // Check we get a URI when we ask for one
    var uri = pH.newURI(protocols[part].urlSpec, "", null);

    uri.QueryInterface(Ci.nsIMailboxUrl);

    do_check_eq(uri.spec, protocols[part].urlSpec);

    do_check_neq(pH.newChannel(uri), null);
  }
}
