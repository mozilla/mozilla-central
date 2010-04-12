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
 *   Ben Bucksch <ben.bucksch beonex.com>
 * Portions created by the Initial Developer are Copyright (c) 2010
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

/**
 * Tests accountcreation/readFromXML.js , reading the XML files
 * containing a mail configuration.
 *
 * To allow forwards-compatibility (add new stuff in the future without
 * breaking old clients on the new files), we are now fairly tolerant when
 * reading and allow fallback mechanisms. This test checks whether that works,
 * and of course also whether we can read a normal config and get the proper
 * values.
 */

// Globals
var xmlReader = {};
try {
  let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
       .getService(Ci.mozIJSSubScriptLoader);
  loader.loadSubScript(
      "chrome://messenger/content/accountcreation/util.js", xmlReader);
  loader.loadSubScript(
      "chrome://messenger/content/accountcreation/accountConfig.js",
      xmlReader);
  loader.loadSubScript(
      "chrome://messenger/content/accountcreation/sanitizeDatatypes.js",
      xmlReader);
  loader.loadSubScript(
      "chrome://messenger/content/accountcreation/readFromXML.js", xmlReader);
} catch (ex) {
  // The "accountcreation" files are not available in SeaMonkey (yet).
  xmlReader = null;
}

/*
 * UTILITIES
 */

function assert_equal(aA, aB, aWhy)
{
  if (aA != aB)
    do_throw(aWhy);
  do_check_eq(aA, aB);
};

/**
 * Test that two config entries are the same.
 */
function assert_equal_config(aA, aB, field)
{
  assert_equal(aA, aB, "Configured " + field + " is incorrect.");
};

/*
 * TESTS
 */

/**
 * Test that the xml reader returns a proper config and
 * is also forwards-compatible to new additions to the data format.
 */
function test_readFromXML_config1()
{
  var clientConfigXML =
    <clientConfig>
      <emailProvider id="example.com">
        <domain>example.com</domain>
        <domain>example.net</domain>
        <displayName>Example</displayName>
        <displayShortName>Example Mail</displayShortName>

        <!-- 1. - protocol not supported -->
        <incomingServer type="imap5">
          <hostname>badprotocol.example.com</hostname>
          <port>993</port>
          <socketType>SSL</socketType>
          <username>%EMAILLOCALPART%</username>
          <authentication>ssl-client-cert</authentication>
        </incomingServer>
        <!-- 2. - socket type not supported -->
        <incomingServer type="imap">
          <hostname>badsocket.example.com</hostname>
          <port>993</port>
          <socketType>key-from-DNSSEC</socketType>
          <username>%EMAILLOCALPART%</username>
          <authentication>password-cleartext</authentication>
        </incomingServer>
        <!-- 3. - first supported incoming server -->
        <incomingServer type="imap">
          <hostname>imapmail.example.com</hostname>
          <port>993</port>
          <socketType>SSL</socketType>
          <username>%EMAILLOCALPART%</username>
          <authentication>password-cleartext</authentication>
        </incomingServer>
        <!-- 4. - auth method not supported -->
        <incomingServer type="imap">
          <hostname>badauth.example.com</hostname>
          <port>993</port>
          <socketType>SSL</socketType>
          <username>%EMAILLOCALPART%</username>
          <authentication>ssl-client-cert</authentication>
          <!-- Throw in some elements we don't support yet -->
          <imap>
            <rootFolder path="INBOX." />
            <specialFolder id="sent" path="INBOX.Sent Mail" />
          </imap>
        </incomingServer>
        <!-- 5. - second supported incoming server -->
        <incomingServer type="pop3">
          <hostname>popmail.example.com</hostname>
          <!-- alternative hostname, not yet supported, should be ignored -->
          <hostname>popbackup.example.com</hostname>
          <port>110</port>
          <port>7878</port>
          <!-- unsupported socket type -->
          <socketType>GSSAPI2</socketType>
          <!-- but fall back -->
          <socketType>plain</socketType>
          <username>%EMAILLOCALPART%</username>
          <username>%EMAILADDRESS%</username>
          <!-- unsupported auth method -->
          <authentication>GSSAPI2</authentication>
          <!-- but fall back -->
          <authentication>password-encrypted</authentication>
          <pop3>
            <leaveMessagesOnServer>true</leaveMessagesOnServer>
            <daysToLeaveMessagesOnServer>999</daysToLeaveMessagesOnServer>
          </pop3>
        </incomingServer>

        <!-- outgoing server with invalid auth method -->
        <outgoingServer type="smtp">
          <hostname>badauth.example.com</hostname>
          <port>587</port>
          <socketType>STARTTLS</socketType>
          <username>%EMAILADDRESS%</username>
          <authentication>smtp-after-imap</authentication>
        </outgoingServer>
        <!-- outgoing server - supported -->
        <outgoingServer type="smtp">
          <hostname>smtpout.example.com</hostname>
          <hostname>smtpfallback.example.com</hostname>
          <port>587</port>
          <port>7878</port>
          <socketType>GSSAPI2</socketType>
          <socketType>STARTTLS</socketType>
          <username>%EMAILADDRESS%</username>
          <username>%EMAILLOCALPART%</username>
          <authentication>GSSAPI2</authentication>
          <authentication>client-IP-address</authentication>
          <smtp/>
        </outgoingServer>

        <!-- Throw in some more elements we don't support yet -->
        <enableURL url="http://foobar" />
        <instructionsURL url="http://foobar" />

      </emailProvider>
    </clientConfig>;

  var config = xmlReader.readFromXML(clientConfigXML);

  do_check_eq(config instanceof xmlReader.AccountConfig, true);
  do_check_eq("example.com", config.id);
  do_check_eq("Example", config.displayName);
  do_check_neq(-1, config.domains.indexOf("example.com"));
  // 1. incoming server skipped because of an unsupported protocol
  // 2. incoming server skipped because of an so-far unknown auth method
  // 3. incoming server is fine for us: IMAP, SSL, cleartext password
  server = config.incoming;
  do_check_eq("imapmail.example.com", server.hostname);
  do_check_eq("imap", server.type);
  do_check_eq(2, server.socketType); // SSL
  do_check_eq(3, server.auth); // cleartext password
  // only one more supported incoming server
  do_check_eq(1, config.incomingAlternatives.length);
  // 4. incoming server skipped because of an so-far unknown socketType
  // 5. server: POP
  server = config.incomingAlternatives[0];
  do_check_eq("popmail.example.com", server.hostname);
  do_check_eq("pop3", server.type);
  do_check_eq(1, server.socketType); // no SSL
  do_check_eq(4, server.auth); // encrypted password

  // SMTP server, most preferred
  server = config.outgoing;
  do_check_eq("smtpout.example.com", server.hostname);
  do_check_eq("smtp", server.type);
  do_check_eq(3, server.socketType); // STARTTLS
  do_check_eq(1, server.auth); // no auth
  // no other SMTP servers
  do_check_eq(0, config.outgoingAlternatives.length);
}

/**
 * Test the replaceVariables method.
 */
function test_replaceVariables()
{
  var clientConfigXML =
    <clientConfig>
      <emailProvider id="example.com">
        <domain>example.com</domain>
        <displayName>example.com</displayName>
        <displayShortName>example.com</displayShortName>
        <incomingServer type="pop3">
          <hostname>pop.%EMAILDOMAIN%</hostname>
          <port>995</port>
          <socketType>SSL</socketType>
          <username>%EMAILLOCALPART%</username>
          <authentication>plain</authentication>
          <pop3>
            <leaveMessagesOnServer>true</leaveMessagesOnServer>
            <daysToLeaveMessagesOnServer>999</daysToLeaveMessagesOnServer>
          </pop3>
        </incomingServer>
        <outgoingServer type="smtp">
          <hostname>smtp.example.com</hostname>
          <port>587</port>
          <socketType>STARTTLS</socketType>
          <username>%EMAILADDRESS%</username>
          <authentication>plain</authentication>
          <addThisServer>true</addThisServer>
          <useGlobalPreferredServer>false</useGlobalPreferredServer>
        </outgoingServer>
      </emailProvider>
    </clientConfig>;

  var config = xmlReader.readFromXML(clientConfigXML);

  xmlReader.replaceVariables(config, 
                             "Yamato Nadeshiko",
                             "yamato.nadeshiko@example.com",
                             "abc12345");

  assert_equal_config(config.incoming.username,
                      "yamato.nadeshiko",
                      "incoming server username");
  assert_equal_config(config.outgoing.username,
                      "yamato.nadeshiko@example.com",
                      "outgoing server username");
  assert_equal_config(config.incoming.hostname,
                      "pop.example.com",
                      "incoming server hostname");
  assert_equal_config(config.outgoing.hostname,
                      "smtp.example.com",
                      "outgoing server hostname");
  assert_equal_config(config.identity.realname,
                      "Yamato Nadeshiko",
                      "user real name");
  assert_equal_config(config.identity.emailAddress, 
                      "yamato.nadeshiko@example.com",
                      "user email address");
}

function run_test()
{
  if (!xmlReader)
  {
    // if you see this and this is Thunderbird, then it's an error
    dump("test_autoconfigXML.js not running, because this is SeaMonkey.");
    return;
  }

  test_readFromXML_config1();
  test_replaceVariables();
};
