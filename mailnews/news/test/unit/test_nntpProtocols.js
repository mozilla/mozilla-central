/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for getting news urls via the protocol handler.
 */

const defaultProtocolFlags =
  Ci.nsIProtocolHandler.URI_NORELATIVE |
  Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE |
  Ci.nsIProtocolHandler.ALLOWS_PROXY |
  Ci.nsIProtocolHandler.URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT;

const protocols =
  [ { protocol: "news",
      urlSpec: "news://user@localhost/",
      defaultPort: Ci.nsINntpUrl.DEFAULT_NNTP_PORT
    },
    // XXX News secure protocol not working yet.
    /*
    { protocol: "snews",
      urlSpec: "snews://user@localhost/",
      defaultPort: Ci.nsINntpUrl.DEFAULT_NNTPS_PORT
      } */];

function run_test() {
  for (var part = 0; part < protocols.length; ++part) {
    print("protocol: " + protocols[part].protocol);

    var pH = Cc["@mozilla.org/network/protocol;1?name=" +
                protocols[part].protocol]
               .createInstance(Ci.nsIProtocolHandler);

    do_check_eq(pH.scheme, protocols[part].protocol);
    do_check_eq(pH.defaultPort, protocols[part].defaultPort);
    do_check_eq(pH.protocolFlags, defaultProtocolFlags);

    // Whip through some of the ports to check we get the right results.
    // NEWS allows connecting to any port.
    for (let i = 0; i < 1024; ++i)
      do_check_true(pH.allowPort(i, ""));

    // Check we get a URI when we ask for one
    var uri = pH.newURI(protocols[part].urlSpec, "", null);

    uri.QueryInterface(Ci.nsINntpUrl);

    do_check_eq(uri.spec, protocols[part].urlSpec);
  }
}
