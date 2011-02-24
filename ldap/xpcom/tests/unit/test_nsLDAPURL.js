/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsLDAPURL functions.
 */

const Ci = Components.interfaces;
const Cc = Components.classes;

// If we are still using the wallet service, then default port numbers
// are still visible in the password manager, and therefore we need to have
// them in the url. The toolkit login manager doesn't do this.
const usingWallet = "nsIWalletService" in Ci;
const portAdpt = usingWallet ? ":389" : "";

const ldapURLs =
  [ { url: "ldap://localhost/dc=test",
      spec: "ldap://localhost/dc=test",
      asciiSpec: "ldap://localhost/dc=test",
      host: "localhost",
      asciiHost: "localhost",
      port: -1,
      scheme: "ldap",
      path: "/dc=test",
      prePath: "ldap://localhost",
      hostPort: "localhost",
      dn: "dc=test",
      scope: Ci.nsILDAPURL.SCOPE_BASE,
      filter: "(objectclass=*)",
      options: 0
    },
    { url: "ldap://localhost:389/dc=test,dc=abc??sub?(objectclass=*)",
      spec: "ldap://localhost" + portAdpt + "/dc=test,dc=abc??sub?(objectclass=*)",
      asciiSpec: "ldap://localhost" + portAdpt + "/dc=test,dc=abc??sub?(objectclass=*)",
      host: "localhost",
      asciiHost: "localhost",
      port: usingWallet ? 389 : -1,
      scheme: "ldap",
      path: "/dc=test,dc=abc??sub?(objectclass=*)",
      prePath: "ldap://localhost" + portAdpt,
      hostPort: "localhost" + portAdpt,
      dn: "dc=test,dc=abc",
      scope: Ci.nsILDAPURL.SCOPE_SUBTREE,
      filter: "(objectclass=*)",
      options: 0
    },
    { url: "ldap://\u65e5\u672c\u8a93.jp:389/dc=tes\u65e5t??one?(oc=xyz)",
      spec: "ldap://\u65e5\u672c\u8a93.jp" + portAdpt + "/dc=tes%E6%97%A5t??one?(oc=xyz)",
      asciiSpec: "ldap://xn--wgv71a309e.jp" + portAdpt + "/dc=tes%E6%97%A5t??one?(oc=xyz)",
      host: "\u65e5\u672c\u8a93.jp",
      asciiHost: "xn--wgv71a309e.jp",
      port: usingWallet ? 389 : -1,
      scheme: "ldap",
      path: "/dc=tes%E6%97%A5t??one?(oc=xyz)",
      prePath: "ldap://\u65e5\u672c\u8a93.jp" + portAdpt,
      hostPort: "\u65e5\u672c\u8a93.jp" + portAdpt,
      dn: "dc=tes\u65e5t",
      scope: Ci.nsILDAPURL.SCOPE_ONELEVEL,
      filter: "(oc=xyz)",
      options: 0
    },
    { url: "ldaps://localhost/dc=test",
      spec: "ldaps://localhost/dc=test",
      asciiSpec: "ldaps://localhost/dc=test",
      host: "localhost",
      asciiHost: "localhost",
      port: -1,
      scheme: "ldaps",
      path: "/dc=test",
      prePath: "ldaps://localhost",
      hostPort: "localhost",
      dn: "dc=test",
      scope: Ci.nsILDAPURL.SCOPE_BASE,
      filter: "(objectclass=*)",
      options: Ci.nsILDAPURL.OPT_SECURE
    }
  ];

function run_test() {
  var url;

  // Get the IO service;
  var ioService = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

  // Test - get and check urls.

  var part = 0;
  for (part = 0; part < ldapURLs.length; ++part)
  {
    dump("url: " + ldapURLs[part].url + "\n");
    url = ioService.newURI(ldapURLs[part].url, null, null);

    do_check_eq(url.spec, ldapURLs[part].spec);
    do_check_eq(url.asciiSpec, ldapURLs[part].asciiSpec);
    do_check_eq(url.scheme, ldapURLs[part].scheme);
    do_check_eq(url.host, ldapURLs[part].host);
    do_check_eq(url.asciiHost, ldapURLs[part].asciiHost);
    do_check_eq(url.port, ldapURLs[part].port);
    do_check_eq(url.path, ldapURLs[part].path);
    do_check_eq(url.prePath, ldapURLs[part].prePath);
    do_check_eq(url.hostPort, ldapURLs[part].hostPort);
    // XXX nsLDAPURL ought to have classinfo.
    url = url.QueryInterface(Ci.nsILDAPURL);
    do_check_eq(url.dn, ldapURLs[part].dn);
    do_check_eq(url.scope, ldapURLs[part].scope);
    do_check_eq(url.filter, ldapURLs[part].filter);
    do_check_eq(url.options, ldapURLs[part].options);
  }

  // Test - Check changing ldap values
  dump("Other Tests\n");

  // Start off with a base url
  const kBaseURL = "ldap://localhost:389/dc=test,dc=abc??sub?(objectclass=*)";

  url = ioService.newURI(kBaseURL, null, null)
                 .QueryInterface(Ci.nsILDAPURL);

  // Test - dn

  url.dn = "dc=short";

  do_check_eq(url.dn, "dc=short");
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??sub?(objectclass=*)");

  // Test - scope

  url.scope = Ci.nsILDAPURL.SCOPE_BASE;

  do_check_eq(url.scope, Ci.nsILDAPURL.SCOPE_BASE);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short???(objectclass=*)");

  url.scope = Ci.nsILDAPURL.SCOPE_ONELEVEL;

  do_check_eq(url.scope, Ci.nsILDAPURL.SCOPE_ONELEVEL);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  // Test - filter

  url.filter = "(oc=ygh)";

  do_check_eq(url.filter, "(oc=ygh)");
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(oc=ygh)");

  url.filter = "";

  do_check_eq(url.filter, "(objectclass=*)");
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  // Test - scheme

  // An old version used to have a bug whereby if you set the scheme to the
  // same thing twice, you'd get the options set wrongly.
  url.scheme = "ldaps";
  do_check_eq(url.options, 1);
  do_check_eq(url.spec, "ldaps://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");
  url.scheme = "ldaps";
  do_check_eq(url.options, 1);
  do_check_eq(url.spec, "ldaps://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  do_check_true(url.schemeIs("ldaps"));
  do_check_false(url.schemeIs("ldap"));

  url.scheme = "ldap";
  do_check_eq(url.options, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");
  url.scheme = "ldap";
  do_check_eq(url.options, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  do_check_true(url.schemeIs("ldap"));
  do_check_false(url.schemeIs("ldaps"));

  // Test - Options

  url.options = Ci.nsILDAPURL.OPT_SECURE;

  do_check_eq(url.options, Ci.nsILDAPURL.OPT_SECURE);
  do_check_eq(url.spec, "ldaps://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  url.options = 0;

  do_check_eq(url.options, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  // Test - Equals

  var url2 = ioService.newURI("ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)", null, null)
                      .QueryInterface(Ci.nsILDAPURL);

  do_check_true(url.equals(url2));

  url2.spec = "ldap://localhost:389/dc=short??sub?(objectclass=*)";

  do_check_false(url.equals(url2));

  // Test Attributes

  do_check_eq(url.attributes.length, 0);

  // Nothing should happend if the attribute doesn't exist
  url.removeAttribute("abc");

  do_check_eq(url.attributes.length, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  url.addAttribute("dn");
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short?dn?one?(objectclass=*)");

  do_check_eq(url.attributes, "dn");

  url.removeAttribute("dn");

  do_check_eq(url.attributes.length, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  var newAttrs = "abc,def,ghi,jkl";
  url.attributes = newAttrs;

  var i;

  do_check_eq(url.attributes, newAttrs);
  do_check_eq(url.spec,
              "ldap://localhost" + portAdpt + "/dc=short?" +
              newAttrs + "?one?(objectclass=*)");

  // Try adding an existing attribute - should do nothing
  url.addAttribute("def");
  do_check_eq(url.attributes, newAttrs);

  //  url.addAttribute("jk");

  do_check_true(url.hasAttribute("jkl"));
  do_check_true(url.hasAttribute("def"));
  do_check_true(url.hasAttribute("ABC"));
  do_check_false(url.hasAttribute("cde"));
  do_check_false(url.hasAttribute("3446"));
  do_check_false(url.hasAttribute("kl"));
  do_check_false(url.hasAttribute("jk"));

  // Sub-string of an attribute, so this shouldn't change anything.
  url.removeAttribute("kl");
  url.removeAttribute("jk");
  url.removeAttribute("ef");
  do_check_eq(url.attributes, newAttrs);

  url.removeAttribute("abc");
  newAttrs = newAttrs.substring(4);

  do_check_eq(url.attributes, newAttrs);
  do_check_eq(url.spec,
              "ldap://localhost" + portAdpt + "/dc=short?" +
              newAttrs + "?one?(objectclass=*)");

  // This shouldn't fail, just clear the list
  url.attributes = "";

  do_check_eq(url.attributes.length, 0);
  do_check_eq(url.spec, "ldap://localhost" + portAdpt + "/dc=short??one?(objectclass=*)");

  // Set attributes via the url spec

  newAttrs = "abc,def,ghi,jkl";
  url.spec = "ldap://localhost/dc=short?" + newAttrs + "?one?(objectclass=*)";

  do_check_eq(url.attributes, newAttrs);
  do_check_eq(url.spec,
              "ldap://localhost/dc=short?" + newAttrs + "?one?(objectclass=*)");

  url.spec = "ldap://localhost/dc=short??one?(objectclass=*)";

  attrs = url.attributes;
  do_check_eq(attrs.length, 0);
  do_check_eq(url.spec, "ldap://localhost/dc=short??one?(objectclass=*)");

  // Test - clone

  url.spec = "ldap://localhost/dc=short?abc,def,ghi,jkl?one?(objectclass=*)";

  var newUrl = url.clone();

  do_check_eq(newUrl.spec,
              "ldap://localhost/dc=short?abc,def,ghi,jkl?one?(objectclass=*)");
}
