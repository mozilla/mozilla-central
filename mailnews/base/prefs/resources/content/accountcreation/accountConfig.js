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
 * Ben Bucksch <ben.bucksch  beonex.com>
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
 * See also <https://wiki.mozilla.org/Thunderbird:Autoconfiguration:ConfigFileFormat>
 * for values stored.
 */

function AccountConfig()
{
  this.incoming =
  {
    type : null, // string-enum: "pop3", "imap", "nntp"
    hostname: null,
    port : null, // Integer
    username : null, // String. May be a placeholder (starts and ends with %).
    password : null,
    // enum: 1 = plain, 2 = SSL/TLS, 3 = STARTTLS always
    // ('TLS when available' is insecure and not supported here)
    socketType : null,
    auth : null, // enum: 1 = plain, 2 = "secure"
    checkInterval : 10, // Integer, in seconds
    // POP3 only:
    useGlobalInbox : false, // boolean. Not yet implemented.
    leaveMessagesOnServer : true,
    daysToLeaveMessagesOnServer : 14,
    deleteByAgeFromServer : true,
    // When user hits delete, delete from local store and from server
    deleteOnServerWhenLocalDelete: true
  },
  this.outgoing =
  {
    hostname: null,
    port : null, // see incoming
    username : null, // see incoming. may be null, if auth is 0.
    password : null, // see incoming. may be null, if auth is 0.
    socketType : null, // see incoming
    auth : null, // see incoming. 0 for no auth.
    addThisServer: true, // if we already have an SMTP server, add this or not.
    // if we already have an SMTP server, use it.
    useGlobalPreferredServer : false,
    existingServerKey : null, // we should reuse an already configures SMTP server. This is nsISmtpServer.key.
    existingServerLabel : null // user display value for existingServerKey
  },
  this.identity =
  {
    // displayed real name of user
    realname : "%REALNAME%",
    // email address of user, as shown in From of outgoing mails
    emailAddress : "%EMAILADDRESS%"
  };
  this.inputFields = [];
  this.domains = [];
};

AccountConfig.prototype =
{
  incoming : null, // see ctor
  outgoing : null, // see ctor
  id : null, // just an internal string to refer to this. Do not show to user.
  source : 0, // who created the config. kSource*
  displayName : null,
  displayShortName : null,
  // Array of Objects with properties varname (value without %), displayName, exampleValue
  inputFields : null,
  // Array of Strings - email address domains for which this config is applicable
  domains : null,
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
  }
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
 * * %EMAILADDRESS% (full email address of the user, usually entered by the user)
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
 *
 * @param otherVariables {Object}
 * Associative array of variable name
 * (without %) and value, e.g. var name "username" with value "fred"
 * would be passed as JS object { username: "fred" } .
 * The var names must exactly match account.inputFields (all vars supplied,
 * no other vars). If account.inputFields is empty or null, pass {} .
 */
function replaceVariables(account, realname, emailfull, password, otherVariables)
{
  sanitize.nonemptystring(emailfull);
  let emailsplit = emailfull.split("@");
  assert(emailsplit.length == 2,
         "email address not in expected format: must contain exactly one @");
  let emaillocal = sanitize.nonemptystring(emailsplit[0]);
  let emaildomain = sanitize.hostname(emailsplit[1]);
  sanitize.label(realname);
  sanitize.nonemptystring(realname);

  otherVariables.EMAILADDRESS = emailfull;
  otherVariables.EMAILLOCALPART = emaillocal;
  otherVariables.EMAILDOMAIN = emaildomain;
  otherVariables.REALNAME = realname;

  account.incoming.password = password;
  account.outgoing.password = password; // set member only if auth required?
  account.incoming.username = _replaceVariable(account.incoming.username,
                                               otherVariables);
  account.outgoing.username = _replaceVariable(account.outgoing.username,
                                               otherVariables);
  account.incoming.hostname =
    sanitize.hostname(_replaceVariable(account.incoming.hostname,
                                       otherVariables));
  if (account.outgoing.hostname) // will be null if user picked existing server.
    account.outgoing.hostname =
      sanitize.hostname(_replaceVariable(account.outgoing.hostname,
                                         otherVariables));
  account.identity.realname =
    _replaceVariable(account.identity.realname, otherVariables);
  account.identity.emailAddress =
    _replaceVariable(account.identity.emailAddress, otherVariables);
  account.displayName = _replaceVariable(account.displayName, otherVariables);
  account.displayShortName =
    _replaceVariable(account.displayShortName, otherVariables);
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
