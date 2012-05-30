/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file creates the class AccountConfig, which is a JS object that holds
 * a configuration for a certain account. It is *not* created in the backend
 * yet (use aw-createAccount.js for that), and it may be incomplete.
 *
 * Several AccountConfig objects may co-exist, e.g. for autoconfig.
 * One AccountConfig object is used to prefill and read the widgets
 * in the Wizard UI.
 * When we autoconfigure, we autoconfig writes the values into a
 * new object and returns that, and the caller can copy these
 * values into the object used by the UI.
 *
 * See also
 * <https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat>
 * for values stored.
 */

function AccountConfig()
{
  this.incoming = this.createNewIncoming();
  this.incomingAlternatives = [];
  this.outgoing = this.createNewOutgoing();
  this.outgoingAlternatives = [];
  this.identity =
  {
    // displayed real name of user
    realname : "%REALNAME%",
    // email address of user, as shown in From of outgoing mails
    emailAddress : "%EMAILADDRESS%",
  };
  this.inputFields = [];
  this.domains = [];
};
AccountConfig.prototype =
{
  // @see createNewIncoming()
  incoming : null,
  // @see createNewOutgoing()
  outgoing : null,
  /**
   * Other servers which can be used instead of |incoming|,
   * in order of decreasing preference.
   * (|incoming| itself should not be included here.)
   * { Array of incoming/createNewIncoming() }
   */
  incomingAlternatives : null,
  outgoingAlternatives : null,
  // just an internal string to refer to this. Do not show to user.
  id : null,
  // who created the config.
  // { one of kSource* }
  source : 0,
  displayName : null,
  // { Array of { varname (value without %), displayName, exampleValue } }
  inputFields : null,
  // email address domains for which this config is applicable
  // { Array of Strings }
  domains : null,

  /**
   * Factory function for incoming and incomingAlternatives
   */
  createNewIncoming : function()
  {
    return {
      // { String-enum: "pop3", "imap", "nntp" }
      type : null,
      hostname : null,
      // { Integer }
      port : null,
      // May be a placeholder (starts and ends with %). { String }
      username : null,
      password : null,
      // { enum: 1 = plain, 2 = SSL/TLS, 3 = STARTTLS always, 0 = not inited }
      // ('TLS when available' is insecure and not supported here)
      socketType : 0,
      /**
       * true when the cert is invalid (and thus SSL useless), because it's
       * 1) not from an accepted CA (including self-signed certs)
       * 2) for a different hostname or
       * 3) expired.
       * May go back to false when user explicitly accepted the cert.
       */
      badCert : false,
      /**
       * How to log in to the server: plaintext or encrypted pw, GSSAPI etc.
       * Defined by Ci.nsMsgAuthMethod
       * Same as server pref "authMethod".
       */
      auth : 0,
      /**
       * Other auth methods that we think the server supports.
       * They are ordered by descreasing preference.
       * (|auth| itself is not included in |authAlternatives|)
       * {Array of Ci.nsMsgAuthMethod} (same as .auth)
       */
      authAlternatives : null,
      // in minutes { Integer }
      checkInterval : 10,
      loginAtStartup : true,
      // POP3 only:
      // Not yet implemented. { Boolean }
      useGlobalInbox : false,
      leaveMessagesOnServer : true,
      daysToLeaveMessagesOnServer : 14,
      deleteByAgeFromServer : true,
      // When user hits delete, delete from local store and from server
      deleteOnServerWhenLocalDelete : true,
      downloadOnBiff : true,
    };
  },
  /**
   * Factory function for outgoing and outgoingAlternatives
   */
  createNewOutgoing : function()
  {
    return {
      type : "smtp",
      hostname : null,
      port : null, // see incoming
      username : null, // see incoming. may be null, if auth is 0.
      password : null, // see incoming. may be null, if auth is 0.
      socketType : 0, // see incoming
      badCert : false, // see incoming
      auth : 0, // see incoming
      authAlternatives : null, // see incoming
      addThisServer : true, // if we already have an SMTP server, add this
      // if we already have an SMTP server, use it.
      useGlobalPreferredServer : false,
      // we should reuse an already configured SMTP server.
      // nsISmtpServer.key
      existingServerKey : null,
      // user display value for existingServerKey
      existingServerLabel : null,
    };
  },

  /**
   * Returns a deep copy of this object,
   * i.e. modifying the copy will not affect the original object.
   */
  copy : function()
  {
    // Workaround: deepCopy() fails to preserve base obj (instanceof)
    var result = new AccountConfig();
    for (var prop in this)
      result[prop] = deepCopy(this[prop]);

    return result;
  },
  isComplete : function()
  {
    return (!!this.incoming.hostname && !!this.incoming.port &&
         !!this.incoming.socketType && !!this.incoming.auth &&
         !!this.incoming.username &&
         (!!this.outgoing.existingServerKey ||
          (!!this.outgoing.hostname && !!this.outgoing.port &&
           !!this.outgoing.socketType && !!this.outgoing.auth &&
           !!this.outgoing.username)));
  },
};


// enum consts

// .source
AccountConfig.kSourceUser = 1; // user manually entered the config
AccountConfig.kSourceXML = 2; // config from XML from ISP or Mozilla DB
AccountConfig.kSourceGuess = 3; // guessConfig()


/**
 * Some fields on the account config accept placeholders (when coming from XML).
 *
 * These are the predefined ones
 * * %EMAILADDRESS% (full email address of the user, usually entered by user)
 * * %EMAILLOCALPART% (email address, part before @)
 * * %EMAILDOMAIN% (email address, part after @)
 * * %REALNAME%
 * as well as those defined in account.inputFields.*.varname, with % added
 * before and after.
 *
 * These must replaced with real values, supplied by the user or app,
 * before the account is created. This is done here. You call this function once
 * you have all the data - gathered the standard vars mentioned above as well as
 * all listed in account.inputFields, and pass them in here. This function will
 * insert them in the fields, returning a fully filled-out account ready to be
 * created.
 *
 * @param account {AccountConfig}
 * The account data to be modified. It may or may not contain placeholders.
 * After this function, it should not contain placeholders anymore.
 * This object will be modified in-place.
 *
 * @param emailfull {String}
 * Full email address of this account, e.g. "joe@example.com".
 * Empty of incomplete email addresses will/may be rejected.
 *
 * @param realname {String}
 * Real name of user, as will appear in From of outgoing messages
 *
 * @param password {String}
 * The password for the incoming server and (if necessary) the outgoing server
 */
function replaceVariables(account, realname, emailfull, password)
{
  sanitize.nonemptystring(emailfull);
  let emailsplit = emailfull.split("@");
  assert(emailsplit.length == 2,
         "email address not in expected format: must contain exactly one @");
  let emaillocal = sanitize.nonemptystring(emailsplit[0]);
  let emaildomain = sanitize.hostname(emailsplit[1]);
  sanitize.label(realname);
  sanitize.nonemptystring(realname);

  let otherVariables = {};
  otherVariables.EMAILADDRESS = emailfull;
  otherVariables.EMAILLOCALPART = emaillocal;
  otherVariables.EMAILDOMAIN = emaildomain;
  otherVariables.REALNAME = realname;

  if (password) {
    account.incoming.password = password;
    account.outgoing.password = password; // set member only if auth required?
  }
  account.incoming.username = _replaceVariable(account.incoming.username,
                                               otherVariables);
  account.outgoing.username = _replaceVariable(account.outgoing.username,
                                               otherVariables);
  account.incoming.hostname =
      _replaceVariable(account.incoming.hostname, otherVariables);
  if (account.outgoing.hostname) // will be null if user picked existing server.
    account.outgoing.hostname =
        _replaceVariable(account.outgoing.hostname, otherVariables);
  account.identity.realname =
      _replaceVariable(account.identity.realname, otherVariables);
  account.identity.emailAddress =
      _replaceVariable(account.identity.emailAddress, otherVariables);
  account.displayName = _replaceVariable(account.displayName, otherVariables);
}

function _replaceVariable(variable, values)
{
  let str = variable;
  if (typeof(str) != "string")
    return str;

  for (let varname in values)
      str = str.replace("%" + varname + "%", values[varname]);

  return str;
}
