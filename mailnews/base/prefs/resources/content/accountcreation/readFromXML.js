/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Ben Bucksch <ben.bucksch beonex.com>
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 * Takes an XML snipplet (as E4X) and reads the values into
 * a new AccountConfig object.
 * It does so securely (or tries to), by trying to avoid remote execution
 * and similar holes which can appear when reading too naively.
 * Of course it cannot tell whether the actual values are correct,
 * e.g. it can't tell whether the host name is a good server.
 *
 * The XML format is documented at
 * <https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat>
 *
 * @param clientConfigXML {E4X}  The <clientConfig> node.
 * @return AccountConfig   object filled with the data from XML
 */
function readFromXML(clientConfigXML)
{
  if ( ! "emailProvider" in clientConfigXML)
  {
    var stringBundle = getStringBundle("chrome://messenger/content/accountCreationModel.properties");
    throw stringBundle.GetStringFromName("no_emailProvider.error");
  }
  var xml = clientConfigXML.emailProvider;

  var d = new AccountConfig();
  d.source = AccountConfig.kSourceXML;

  d.id = sanitize.alphanumdash(xml.id);
  if ("displayName" in xml)
    d.displayName = sanitize.label(xml.displayName);
  if ("displayShortName" in xml)
    d.displayShortName = sanitize.label(xml.displayShortName);
  for each (var domain in xml.domain)
    d.domains.push(sanitize.hostname(domain));

  // incoming server
  var iX = xml.incomingServer; // input (XML)
  var iO = d.incoming; // output (object)
  iO.type = sanitize.enum(iX.@type, ["pop3", "imap", "nntp"]);
  iO.hostname = sanitize.hostname(iX.hostname);
  iO.port = sanitize.integerRange(iX.port, 1, 65535);
  iO.username = sanitize.string(iX.username); // may be a %VARIABLE%
  iO.auth = sanitize.translate(iX.authentication, { plain : 1, secure : 2 }); // TODO "secure"
  iO.socketType = sanitize.translate(iX.socketType, { plain : 1, SSL: 2, STARTTLS: 3 });
  if (iO.type == "pop3" && "pop3" in iX)
  {
    if ("leaveMessagesOnServer" in iX.pop3)
      iO.leaveMessagesOnServer = sanitize.boolean(iX.pop3.leaveMessagesOnServer);
    if ("daysToLeaveMessagesOnServer" in iX.pop3)
      iO.daysToLeaveMessagesOnServer = iX.pop3.daysToLeaveMessagesOnServer;
  }

  // outgoing server
  var oX = xml.outgoingServer; // input (XML)
  var oO = d.outgoing; // output (object)
  if ( ! oX.@type == "smtp")
  {
    var stringBundle = getStringBundle("chrome://messenger/content/accountCreationModel.properties");
    throw stringBundle.GetStringFromName("outgoing_not_smtp.error");
  }
  oO.hostname = sanitize.hostname(oX.hostname);
  oO.port = sanitize.integerRange(oX.port, 1, 65535);
  if ("username" in oX)
    oO.username = sanitize.string(oX.username);
  oO.socketType = sanitize.translate(oX.socketType, { plain : 1, SSL: 2, STARTTLS: 3 });
  oO.auth = sanitize.translate(oX.authentication,
          { none : 0 /* e.g. IP-address-based */, plain : 1, secure : 2,  // TODO "secure"
            "smtp-after-pop" : 0 /* hope for the best */});
  if ("addThisServer" in oX)
    oO.addThisServer = sanitize.boolean(oX.addThisServer);
  if ("useGlobalPreferredServer" in oX)
    oO.useGlobalPreferredServer = sanitize.boolean(oX.useGlobalPreferredServer);

  for each (var inputField in xml.inputField)
  {
    if ( ! d.inputFields)
      d.inputFields = new Array();
    var fieldset =
    {
      varname : sanitize.alphanumdash(inputField.@key).toUpperCase(),
      displayName : sanitize.label(inputField.@label),
      exampleValue : sanitize.label(inputField.text())
    };
    d.inputFields.push(fieldset);
  }

  for each (var enableURL in xml.enableURL)
  {
    if ( ! d.enableURLs)
      d.enableURLs = new Array();
    var fieldset =
    {
      url : sanitize.url(sanitize.nonemptystring(enableURL.@url)),
      instruction : sanitize.label(sanitize.nonemptystring(enableURL.@instruction))
    };
    d.enableURLs.push(fieldset);
  }

  return d;
}
