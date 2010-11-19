/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is autoconfig test code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Tests for accountcreation/guessConfig.js
 *
 * Currently tested:
 * - getHostEntry function.
 * - getIncomingTryOrder function.
 * - getOutgoingTryOrder function.
 *
 * TODO:
 * - Test the returned CMDS.
 * - Figure out what else to test.
 */

// Globals

var loaded = false;
try {
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                         .getService(Components.interfaces.mozIJSSubScriptLoader);
  loader.loadSubScript("chrome://messenger/content/accountcreation/util.js");
  loader.loadSubScript("chrome://messenger/content/accountcreation/accountConfig.js");
  loader.loadSubScript("chrome://messenger/content/accountcreation/sanitizeDatatypes.js");
  loader.loadSubScript("chrome://messenger/content/accountcreation/guessConfig.js");
  loaded = true;
} catch (ex) {
  // The "accountcreation" files are not available in SeaMonkey (yet).
  dump("loading accountcreation JS files failed: " + ex + "\n" + ex.stack + "\n");
}

/*
 * UTILITIES
 */

function assert(aBeTrue, aWhy)
{
  if (!aBeTrue)
    do_throw(aWhy);
  do_check_true(aBeTrue);
};

function assert_equal(aA, aB, aWhy)
{
  if (aA != aB)
    do_throw(aWhy);
  do_check_eq(aA, aB);
};

/**
 * Test that two host entries are the same, ignoring the commands.
 */
function assert_equal_host_entries(hostEntry, expected)
{
  assert_equal(hostEntry.protocol, expected[0], "Protocols are different");
  assert_equal(hostEntry.ssl, expected[1], "SSL values are different");
  assert_equal(hostEntry.port, expected[2], "Port values are different");
};

/**
 * Assert that the list of tryOrders are the same.
 */
function assert_equal_try_orders(aA, aB)
{
  assert_equal(aA.length, aB.length, "tryOrders have different length");
  for (let [i,subA] in Iterator(aA)) {
    let subB = aB[i];
    assert_equal_host_entries(subA, subB);
  }
};

/**
 * Check that the POP calculations are correct for a given host and
 * protocol.
 */
function checkPop(host, protocol)
{
  // port == UNKNOWN
    // [POP, TLS, 110], [POP, SSL, 995], [POP, NONE, 110]
  // port != UNKNOWN
    // ssl == UNKNOWN
      // [POP, TLS, port], [POP, SSL, port], [POP, NONE, port]
    // ssl != UNKNOWN
      // [POP, ssl, port]
  let ssl = UNKNOWN;
  let port = UNKNOWN;
  let tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[POP, TLS, 110],
                           [POP, SSL, 995],
                           [POP, NONE, 110]]);

  ssl = TLS;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[POP, ssl, 110]]);

  ssl = SSL;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[POP, ssl, 995]]);

  ssl = NONE;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[POP, ssl, 110]]);

  ssl = UNKNOWN;
  port = 31337;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[POP, TLS, port],
                           [POP, SSL, port],
                           [POP, NONE, port]]);

  for (ssl in [TLS, SSL, NONE]) {
    tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
    assert_equal_try_orders(tryOrder,
                            [[POP, ssl, port]]);
  }
};

/**
 * Check that the IMAP calculations are correct for a given host and
 * protocol.
 */
function checkImap(host, protocol)
{
  // port == UNKNOWN
    // [IMAP, TLS, 143], [IMAP, SSL, 993], [IMAP, NONE, 143]
  // port != UNKNOWN
    // ssl == UNKNONWN
      // [IMAP, TLS, port], [IMAP, SSL, port], [IMAP, NONE, port]
    // ssl != UNKNOWN
     // [IMAP, ssl, port];

  let ssl = UNKNOWN;
  let port = UNKNOWN;
  let tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, TLS, 143],
                           [IMAP, SSL, 993],
                           [IMAP, NONE, 143]]);

  ssl = TLS;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, ssl, 143]]);

  ssl = SSL;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, ssl, 993]]);

  ssl = NONE;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, ssl, 143]]);

  ssl = UNKNOWN;
  port = 31337;
  tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, TLS, port],
                           [IMAP, SSL, port],
                           [IMAP, NONE, port]]);

  for (ssl in [TLS, SSL, NONE]) {
    tryOrder = getIncomingTryOrder(host, protocol, ssl, port);
    assert_equal_try_orders(tryOrder,
                            [[IMAP, ssl, port]]);
  }
};

/*
 * TESTS
 */

/**
 * Test that getHostEntry returns the correct port numbers.
 *
 * TODO:
 * - Test the returned commands as well.
 */
function test_getHostEntry()
{
  // IMAP port numbers.
  assert_equal_host_entries(getHostEntry(IMAP, TLS, UNKNOWN),
                            [IMAP, TLS, 143]);
  assert_equal_host_entries(getHostEntry(IMAP, SSL, UNKNOWN),
                            [IMAP, SSL, 993]);
  assert_equal_host_entries(getHostEntry(IMAP, NONE, UNKNOWN),
                            [IMAP, NONE, 143]);

  // POP port numbers.
  assert_equal_host_entries(getHostEntry(POP, TLS, UNKNOWN),
                            [POP, TLS, 110]);
  assert_equal_host_entries(getHostEntry(POP, SSL, UNKNOWN),
                            [POP, SSL, 995]);
  assert_equal_host_entries(getHostEntry(POP, NONE, UNKNOWN),
                            [POP, NONE, 110]);

  // SMTP port numbers.
  assert_equal_host_entries(getHostEntry(SMTP, TLS, UNKNOWN),
                            [SMTP, TLS, 587]);
  assert_equal_host_entries(getHostEntry(SMTP, SSL, UNKNOWN),
                            [SMTP, SSL, 465]);
  assert_equal_host_entries(getHostEntry(SMTP, NONE, UNKNOWN),
                            [SMTP, NONE, 587]);
};

/**
 * Test the getIncomingTryOrder method.
 */
function test_getIncomingTryOrder()
{
  // protocol == POP || host starts with pop. || host starts with pop3.
  checkPop( "example.com", POP );
  checkPop( "pop.example.com", UNKNOWN );
  checkPop( "pop3.example.com", UNKNOWN );
  checkPop( "imap.example.com", POP );

  // protocol == IMAP || host starts with imap.
  checkImap( "example.com", IMAP );
  checkImap( "imap.example.com", UNKNOWN );
  checkImap( "pop.example.com", IMAP );

  let domain = "example.com";
  let protocol = UNKNOWN;
  let ssl = UNKNOWN;
  let port = UNKNOWN;
  let tryOrder = getIncomingTryOrder(domain, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, TLS, 143],
                           [IMAP, SSL, 993],
                           [POP, TLS, 110],
                           [POP, SSL, 995],
                           [IMAP, NONE, 143],
                           [POP, NONE, 110]]);

  port = 31337;
  let tryOrder = getIncomingTryOrder(domain, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[IMAP, TLS, port],
                           [IMAP, SSL, port],
                           [POP, TLS, port],
                           [POP, SSL, port],
                           [IMAP, NONE, port],
                           [POP, NONE, port]]);
};

/**
 * Test the getOutgoingTryOrder method.
 */
function test_getOutgoingTryOrder()
{
  let domain = "example.com";
  let protocol = SMTP;
  let ssl = UNKNOWN;
  let port = UNKNOWN;
  let tryOrder = getOutgoingTryOrder(domain, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[SMTP, TLS, 587],
                           [SMTP, TLS, 25],
                           [SMTP, SSL, 465],
                           [SMTP, NONE, 587],
                           [SMTP, NONE, 25]]);
  port = 31337
  tryOrder = getOutgoingTryOrder(domain, protocol, ssl, port);
  assert_equal_try_orders(tryOrder,
                          [[SMTP, TLS, port],
                           [SMTP, SSL, port],
                           [SMTP, NONE, port]]);
};


function run_test()
{
  if (!loaded)
  {
    // if you see this with Thunderbird, then it's an error
    dump("INFO | test_autoconfigUtils.js not running, because this is SeaMonkey.\n");
    return true;
  }

  test_getHostEntry();
  test_getIncomingTryOrder();
  test_getOutgoingTryOrder();
};
