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
 * The Original Code is Thunderbird about:support.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

var EXPORTED_SYMBOLS = ["AboutSupport"];

const Cc = Components.classes;
const Ci = Components.interfaces;

// Platform-specific includes
if ("@mozilla.org/windows-registry-key;1" in Components.classes)
  Components.utils.import("resource:///modules/aboutSupportWin32.js");
else if ("nsILocalFileMac" in Components.interfaces)
  Components.utils.import("resource:///modules/aboutSupportMac.js");
else
  Components.utils.import("resource:///modules/aboutSupportUnix.js");

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gMessengerBundle = Services.strings.createBundle(
  "chrome://messenger/locale/messenger.properties");

var gSocketTypes = {};
for (let [str, index] in Iterator(Ci.nsMsgSocketType))
  gSocketTypes[index] = str;

var gAuthMethods = {};
for (let [str, index] in Iterator(Ci.nsMsgAuthMethod))
  gAuthMethods[index] = str;

// l10n properties in messenger.properties corresponding to each auth method
var gAuthMethodProperties = {
  "1": "authOld",
  "2": "authPasswordCleartextInsecurely",
  "3": "authPasswordCleartextViaSSL",
  "4": "authPasswordEncrypted",
  "5": "authKerberos",
  "6": "authNTLM",
  "8": "authAnySecure"
};

var AboutSupport = {
  __proto__: AboutSupportPlatform,

  /**
   * Gets details about SMTP servers for a given nsIMsgAccount.
   *
   * @returns A list of records, each record containing the name and other details
   *          about one SMTP server.
   */
  _getSMTPDetails: function AboutSupport__getSMTPDetails(aAccount) {
    let identities = aAccount.identities;
    let defaultIdentity = aAccount.defaultIdentity;
    let smtpDetails = [];

    for each (let identity in fixIterator(identities, Ci.nsIMsgIdentity)) {
      let isDefault = identity == defaultIdentity;
      let smtpServer = {};
      MailServices.smtp.GetSmtpServerByIdentity(identity, smtpServer);
      smtpDetails.push({name: smtpServer.value.displayname,
                        authMethod: smtpServer.value.authMethod,
                        socketType: smtpServer.value.socketType,
                        isDefault: isDefault});
    }

    return smtpDetails;
  },

  /**
   * Returns account details as a list of records.
   */
  getAccountDetails: function AboutSupport_getAccountDetails() {
    let accountDetails = [];
    let accounts = MailServices.accounts.accounts;

    for (let account in fixIterator(accounts, Ci.nsIMsgAccount)) {
      let server = account.incomingServer;
      accountDetails.push({
        key: account.key,
        name: server.prettyName,
        hostDetails: "(" + server.type + ") " + server.hostName +
                     (server.port != -1 ? (":" + server.port) : ""),
        socketType: server.socketType,
        authMethod: server.authMethod,
        smtpServers: this._getSMTPDetails(account),
      });
    }

    function idCompare(accountA, accountB) {
      let regex = /^account([0-9]+)$/;
      let regexA = regex.exec(accountA.key);
      let regexB = regex.exec(accountB.key);
      // There's an off chance that the account ID isn't in the standard
      // accountN form. If so, use the standard string compare against a fixed
      // string ("account") to avoid correctness issues.
      if (!regexA || !regexB) {
        let keyA = regexA ? "account" : accountA.key;
        let keyB = regexB ? "account" : accountB.key;
        return keyA.localeCompare(keyB);
      }
      let idA = parseInt(regexA[1]);
      let idB = parseInt(regexB[1]);
      return idA - idB;
    }

    // Sort accountDetails by account ID.
    accountDetails.sort(idCompare);
    return accountDetails;
  },

  /**
   * Returns the corresponding text for a given socket type index. The text is
   * returned as a record with "localized" and "neutral" entries.
   */
  getSocketTypeText: function AboutSupport_getSocketTypeText(aIndex) {
    let plainSocketType = (aIndex in gSocketTypes ?
                           gSocketTypes[aIndex] : aIndex);
    let prettySocketType;
    try {
      prettySocketType = gMessengerBundle.GetStringFromName(
        "smtpServer-ConnectionSecurityType-" + aIndex);
    }
    catch (e if e.result == Components.results.NS_ERROR_FAILURE) {
      // The string wasn't found in the bundle. Make do without it.
      prettySocketType = plainSocketType;
    }
    return {localized: prettySocketType, neutral: plainSocketType};
  },

  /**
   * Returns the corresponding text for a given authentication method index. The
   * text is returned as a record with "localized" and "neutral" entries.
   */
  getAuthMethodText: function AboutSupport_getAuthMethodText(aIndex) {
    let prettyAuthMethod;
    let plainAuthMethod = (aIndex in gAuthMethods ?
                           gAuthMethods[aIndex] : aIndex);
    if (aIndex in gAuthMethodProperties) {
      prettyAuthMethod =
        gMessengerBundle.GetStringFromName(gAuthMethodProperties[aIndex]);
    }
    else {
      prettyAuthMethod = plainAuthMethod;
    }
    return {localized: prettyAuthMethod, neutral: plainAuthMethod};
  }
};
