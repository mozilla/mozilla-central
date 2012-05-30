/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  var exception;
  if (typeof(clientConfigXML) != "xml" ||
      !("emailProvider" in clientConfigXML))
  {
    dump("client config xml = " + clientConfigXML + "\n");
    var stringBundle = getStringBundle(
        "chrome://messenger/locale/accountCreationModel.properties");
    throw stringBundle.GetStringFromName("no_emailProvider.error");
  }
  var xml = clientConfigXML.emailProvider;

  var d = new AccountConfig();
  d.source = AccountConfig.kSourceXML;

  d.id = sanitize.hostname(xml.@id);
  d.displayName = d.id;
  try {
    d.displayName = sanitize.label(xml.displayName[0]);
  } catch (e) { logException(e); }
  for each (var domain in xml.domain)
  {
    try {
      d.domains.push(sanitize.hostname(domain));
    } catch (e) { logException(e); exception = e; }
  }
  if (domain.length == 0)
    throw exception ? exception : "need proper <domain> in XML";
  exception = null;

  // incoming server
  for each (let iX in xml.incomingServer) // input (XML)
  {
    let iO = d.createNewIncoming(); // output (object)
    try {
      // throws if not supported
      iO.type = sanitize.enum(iX.@type, ["pop3", "imap", "nntp"]);
      iO.hostname = sanitize.hostname(iX.hostname[0]);
      iO.port = sanitize.integerRange(iX.port[0], 1, 65535);
      // We need a username even for Kerberos, need it even internally.
      iO.username = sanitize.string(iX.username[0]); // may be a %VARIABLE%

      if ("password" in iX) {
        d.rememberPassword = true;
        iO.password = sanitize.string(iX.password[0]);
      }

      for each (let iXsocketType in iX.socketType)
      {
        try {
          iO.socketType = sanitize.translate(iXsocketType,
              { plain : 1, SSL: 2, STARTTLS: 3 });
          break; // take first that we support
        } catch (e) { exception = e; }
      }
      if (!iO.socketType)
        throw exception ? exception : "need proper <socketType> in XML";
      exception = null;

      for each (let iXauth in iX.authentication)
      {
        try {
          iO.auth = sanitize.translate(iXauth,
              { "password-cleartext" : Ci.nsMsgAuthMethod.passwordCleartext,
                // @deprecated TODO remove
                "plain" : Ci.nsMsgAuthMethod.passwordCleartext,
                "password-encrypted" : Ci.nsMsgAuthMethod.passwordEncrypted,
                // @deprecated TODO remove
                "secure" : Ci.nsMsgAuthMethod.passwordEncrypted,
                "GSSAPI" : Ci.nsMsgAuthMethod.GSSAPI,
                "NTLM" : Ci.nsMsgAuthMethod.NTLM });
          break; // take first that we support
        } catch (e) { exception = e; }
      }
      if (!iO.auth)
        throw exception ? exception : "need proper <authentication> in XML";
      exception = null;

      // defaults are in accountConfig.js
      if (iO.type == "pop3" && "pop3" in iX)
      {
        try {
          if ("leaveMessagesOnServer" in iX.pop3[0])
            iO.leaveMessagesOnServer =
                sanitize.boolean(iX.pop3.leaveMessagesOnServer);
          if ("daysToLeaveMessagesOnServer" in iX.pop3[0])
            iO.daysToLeaveMessagesOnServer =
                sanitize.integer(iX.pop3.daysToLeaveMessagesOnServer);
        } catch (e) { logException(e); }
        try {
          if ("downloadOnBiff" in iX.pop3[0])
            iO.downloadOnBiff = sanitize.boolean(iX.pop3.downloadOnBiff);
        } catch (e) { logException(e); }
      }

      // processed successfully, now add to result object
      if (!d.incoming.hostname) // first valid
        d.incoming = iO;
      else
        d.incomingAlternatives.push(iO);
    } catch (e) { exception = e; }
  }
  if (!d.incoming.hostname)
    // throw exception for last server
    throw exception ? exception : "Need proper <incomingServer> in XML file";
  exception = null;

  // outgoing server
  for each (let oX in xml.outgoingServer) // input (XML)
  {
    let oO = d.createNewOutgoing(); // output (object)
    try {
      if (oX.@type != "smtp")
      {
        var stringBundle = getStringBundle(
            "chrome://messenger/locale/accountCreationModel.properties");
        throw stringBundle.GetStringFromName("outgoing_not_smtp.error");
      }
      oO.hostname = sanitize.hostname(oX.hostname[0]);
      oO.port = sanitize.integerRange(oX.port[0], 1, 65535);

      for each (let oXsocketType in oX.socketType)
      {
        try {
          oO.socketType = sanitize.translate(oXsocketType,
              { plain : 1, SSL: 2, STARTTLS: 3 });
          break; // take first that we support
        } catch (e) { exception = e; }
      }
      if (!oO.socketType)
        throw exception ? exception : "need proper <socketType> in XML";
      exception = null;

      for each (let oXauth in oX.authentication)
      {
        try {
          oO.auth = sanitize.translate(oXauth,
              { // open relay
                "none" : Ci.nsMsgAuthMethod.none,
                // inside ISP or corp network
                "client-IP-address" : Ci.nsMsgAuthMethod.none,
                // hope for the best
                "smtp-after-pop" : Ci.nsMsgAuthMethod.none,
                "password-cleartext" : Ci.nsMsgAuthMethod.passwordCleartext,
                // @deprecated TODO remove
                "plain" : Ci.nsMsgAuthMethod.passwordCleartext,
                "password-encrypted" : Ci.nsMsgAuthMethod.passwordEncrypted,
                // @deprecated TODO remove
                "secure" : Ci.nsMsgAuthMethod.passwordEncrypted,
                "GSSAPI" : Ci.nsMsgAuthMethod.GSSAPI,
                "NTLM" : Ci.nsMsgAuthMethod.NTLM,
              });
          break; // take first that we support
        } catch (e) { exception = e; }
      }
      if (!oO.auth)
        throw exception ? exception : "need proper <authentication> in XML";
      exception = null;

      if ("username" in oX ||
          // if password-based auth, we need a username,
          // so go there anyways and throw.
          oO.auth == Ci.nsMsgAuthMethod.passwordCleartext ||
          oO.auth == Ci.nsMsgAuthMethod.passwordEncrypted)
        oO.username = sanitize.string(oX.username[0]);

      if ("password" in oX) {
        d.rememberPassword = true;
        oO.password = sanitize.string(oX.password[0]);
      }

      try {
        // defaults are in accountConfig.js
        if ("addThisServer" in oX)
          oO.addThisServer = sanitize.boolean(oX.addThisServer);
        if ("useGlobalPreferredServer" in oX)
          oO.useGlobalPreferredServer =
              sanitize.boolean(oX.useGlobalPreferredServer);
      } catch (e) { logException(e); }

      // processed successfully, now add to result object
      if (!d.outgoing.hostname) // first valid
        d.outgoing = oO;
      else
        d.outgoingAlternatives.push(oO);
    } catch (e) { logException(e); exception = e; }
  }
  if (!d.outgoing.hostname)
    // throw exception for last server
    throw exception ? exception : "Need proper <outgoingServer> in XML file";
  exception = null;

  d.inputFields = new Array();
  for each (let inputField in xml.inputField)
  {
    try {
      var fieldset =
      {
        varname : sanitize.alphanumdash(inputField.@key).toUpperCase(),
        displayName : sanitize.label(inputField.@label),
        exampleValue : sanitize.label(inputField.text())
      };
      d.inputFields.push(fieldset);
    } catch (e) { logException(e); } // for now, don't throw,
        // because we don't support custom fields yet anyways.
  }

  return d;
}
