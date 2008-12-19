/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for IMAP nsIProtocolHandler implementations.
 */

const defaultProtocolFlags =
  Ci.nsIProtocolHandler.URI_STD |
  Ci.nsIProtocolHandler.URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT |
  Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
  Ci.nsIProtocolHandler.ALLOWS_PROXY;

const protocols =
  [ { protocol: "imap",
      urlSpec: "imap://user@localhost/",
      defaultPort: Ci.nsIImapUrl.DEFAULT_IMAP_PORT
    }
    // XXX Imaps protocol not available via nsIProtocolHandler yet.
    /*,
    { protocol: "imaps",
      urlSpec: "iamps://user@localhost/",
      defaultPort: Ci.nsIImapUrl.DEFAULT_IMAPS_PORT
      }*/
    ];

function run_test() {
  // We need a server to match the urlSpecs above.
  createLocalIMAPServer();

  for (var part = 0; part < protocols.length; ++part) {
    print("protocol: " + protocols[part].protocol);

    var pH = Cc["@mozilla.org/network/protocol;1?name=" +
                protocols[part].protocol]
               .createInstance(Ci.nsIProtocolHandler);

    do_check_eq(pH.scheme, protocols[part].protocol);
    do_check_eq(pH.defaultPort, protocols[part].defaultPort);
    do_check_eq(pH.protocolFlags, defaultProtocolFlags);

    // Whip through some of the ports to check we get the right results.
    // IMAP allows connecting to any port.
    for (let i = 0; i < 1024; ++i)
      do_check_true(pH.allowPort(i, ""));

    // Check we get a URI when we ask for one
    var uri = pH.newURI(protocols[part].urlSpec, "", null);

    uri.QueryInterface(Ci.nsIImapUrl);

    do_check_eq(uri.spec, protocols[part].urlSpec);
  }
}
