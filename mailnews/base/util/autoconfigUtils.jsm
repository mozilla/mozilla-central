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
 * The Original Code is autoconfig code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
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

/**
 * This file contains helper methods for dealing with autoconfig.
 */

var EXPORTED_SYMBOLS = [
  "UNKNOWN", "IMAP", "POP", "SMTP", "NONE", "TLS", "SSL",
  "getHostEntry", "getIncomingTryOrder", "getOutgoingTryOrder"];

// Protocol Types
const UNKNOWN = -1;
const IMAP = 0;
const POP = 1;
const SMTP = 2;
// Security Types
const NONE = 0; // no encryption
//1 would be "TLS if available"
const TLS = 2; // STARTTLS
const SSL = 3; // SSL / TLS

const IMAP4_CMDS = ["1 CAPABILITY\r\n", "2 LOGOUT\r\n"];
const POP3_CMDS  = ["CAPA\r\n", "QUIT\r\n"];
const SMTP_CMDS = ["EHLO\r\n", "QUIT\r\n"];

const IMAP_PORTS = {}
IMAP_PORTS[TLS]=143;
IMAP_PORTS[SSL]=993;
IMAP_PORTS[NONE]=143;

const POP_PORTS = {}
POP_PORTS[TLS]=110;
POP_PORTS[SSL]=995;
POP_PORTS[NONE]=110;

const SMTP_PORTS = {}
SMTP_PORTS[TLS]=587;
SMTP_PORTS[SSL]=465;
SMTP_PORTS[NONE]=25;

const CMDS = {}
CMDS[IMAP]=IMAP4_CMDS;
CMDS[POP]=POP3_CMDS;
CMDS[SMTP]=SMTP_CMDS;

function getHostEntry(protocol, ssl, port)
{
  if (!port || port == UNKNOWN) {
    switch (protocol) {
      case POP:
        port = POP_PORTS[ssl];
        break;
      case IMAP:
        port = IMAP_PORTS[ssl];
        break;
      case SMTP:
        port = SMTP_PORTS[ssl];
        break;
    }
  }

  return [protocol, ssl, port, CMDS[protocol]];
};

function getIncomingTryOrder(host, protocol, ssl, port)
{
  var lowerCaseHost = host.toLowerCase();

  if (protocol == UNKNOWN &&
      (!lowerCaseHost.indexOf("pop.") || !lowerCaseHost.indexOf("pop3.")))
    protocol = POP;
  else if (protocol == UNKNOWN && !lowerCaseHost.indexOf("imap."))
    protocol = IMAP;

  if (protocol != UNKNOWN) {
    if (ssl == UNKNOWN)
      return [getHostEntry(protocol, TLS, port),
              getHostEntry(protocol, SSL, port),
              getHostEntry(protocol, NONE, port)];
    return [getHostEntry(protocol, ssl, port)];
  }
  if (ssl == UNKNOWN)
    return [getHostEntry(IMAP, TLS, port),
            getHostEntry(IMAP, SSL, port),
            getHostEntry(POP, TLS, port),
            getHostEntry(POP, SSL, port),
            getHostEntry(IMAP, NONE, port),
            getHostEntry(POP, NONE, port)];
  return [getHostEntry(IMAP, ssl, port),
          getHostEntry(POP, ssl, port)];
};

function getOutgoingTryOrder(port)
{
  if (port == UNKNOWN)
    return [getHostEntry(SMTP, TLS, port),
            getHostEntry(SMTP, SSL, port),
            getHostEntry(SMTP, TLS, 25),
            getHostEntry(SMTP, NONE, 587),
            getHostEntry(SMTP, NONE, port)];
  return [getHostEntry(SMTP, TLS, port),
          getHostEntry(SMTP, SSL, port),
          getHostEntry(SMTP, NONE, port)];
};
