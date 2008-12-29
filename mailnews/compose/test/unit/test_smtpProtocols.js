/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for getting smtp urls via the protocol handler.
 */

const defaultProtocolFlags =
  Ci.nsIProtocolHandler.URI_NORELATIVE |
  Ci.nsIProtocolHandler.URI_DANGEROUS_TO_LOAD |
  Ci.nsIProtocolHandler.URI_NON_PERSISTABLE |
  Ci.nsIProtocolHandler.URI_FORBIDS_AUTOMATIC_DOCUMENT_REPLACEMENT;

const protocols =
  [ { protocol: "smtp",
      urlSpec: "smtp://user@localhost/",
      defaultPort: Ci.nsISmtpUrl.DEFAULT_SMTP_PORT
    },
    { protocol: "smtps",
      urlSpec: "smtps://user@localhost/",
      defaultPort: Ci.nsISmtpUrl.DEFAULT_SMTPS_PORT
    } ];

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
    for (let i = 0; i < 1024; ++i)
      do_check_eq(pH.allowPort(i, ""), (i == protocols[part].defaultPort));

    // Check we get a URI when we ask for one
    var uri = pH.newURI(protocols[part].urlSpec, "", null);

    uri.QueryInterface(Ci.nsISmtpUrl);

    do_check_eq(uri.spec, protocols[part].urlSpec);

    try {
      // This call should throw NS_ERROR_NOT_IMPLEMENTED. If it doesn't,
      // then we should implement a new test for it.
      pH.newChannel(uri);
      // If it didn't throw, then shout about it.
      do_throw("newChannel not throwing NS_ERROR_NOT_IMPLEMENTED.");
    }
    catch (ex) {
      do_check_eq(ex.result, Cr.NS_ERROR_NOT_IMPLEMENTED);
    }
  }
}
