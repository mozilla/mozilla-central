/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

EXPORTED_SYMBOLS = ['GlodaUtils'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

/**
 * @namespace A holding place for logic that is not gloda-specific and should
 *  reside elsewhere.
 */
var GlodaUtils = {
  _mimeConverter: null,
  deMime: function gloda_utils_deMime(aString) {
    if (this._mimeConverter == null) {
      this._mimeConverter = Cc["@mozilla.org/messenger/mimeconverter;1"].
                            getService(Ci.nsIMimeConverter);
    }
    
    return this._mimeConverter.decodeMimeHeader(aString, null, false, true);
  },
  
  _headerParser: null,
  
  /**
   * Parses an RFC 2822 list of e-mail addresses and returns an object with
   *  4 attributes, as described below.  We will use the example of the user
   *  passing an argument of '"Bob Smith" <bob@company.com>'.
   *  
   * count: the number of addresses parsed. (ex: 1)
   * addresses: a list of e-mail addresses (ex: ["bob@company.com"])
   * names: a list of names (ex: ["Bob Smith"])
   * fullAddresses: aka the list of name and e-mail together (ex: ['"Bob Smith"
   *  <bob@company.com>']).
   *
   * This method is a convenience wrapper around nsIMsgHeaderParser. 
   */
  parseMailAddresses: function gloda_utils_parseMailAddresses(aMailAddresses) {
    if (this._headerParser == null) {
      this._headerParser = Cc["@mozilla.org/messenger/headerparser;1"].
                           getService(Ci.nsIMsgHeaderParser);
    }
    let addresses = {}, names = {}, fullAddresses = {};
    this._headerParser.parseHeadersWithArray(aMailAddresses, addresses,
                                             names, fullAddresses);
    return {names: names.value, addresses: addresses.value,
            fullAddresses: fullAddresses.value,
            count: names.value.length}; 
  },
  
  /**
   * MD5 hash a string and return the hex-string result. Impl from nsICryptoHash
   *  docs.
   */
  md5HashString: function gloda_utils_md5hash(aString) {
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].
                    createInstance(Ci.nsIScriptableUnicodeConverter);
    let trash = {};
    converter.charset = "UTF-8";
    let data = converter.convertToByteArray(aString, trash);

    let hasher = Cc['@mozilla.org/security/hash;1'].
                 createInstance(Ci.nsICryptoHash);
    hasher.init(Ci.nsICryptoHash.MD5);
    hasher.update(data, data.length);
    let hash = hasher.finish(false);
    
     // return the two-digit hexadecimal code for a byte
    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    // convert the binary hash data to a hex string.
    return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
  },
  
  getCardForEmail: function gloda_utils_getCardForEmail(aAddress) {
    // search through all of our local address books looking for a match.
    let enumerator = Components.classes["@mozilla.org/abmanager;1"]
                               .getService(Ci.nsIAbManager)
                               .directories;
    let cardForEmailAddress;
    let addrbook;
    while (!cardForEmailAddress && enumerator.hasMoreElements())
    {
      addrbook = enumerator.getNext().QueryInterface(Ci.nsIAbDirectory);
      try
      {
        cardForEmailAddress = addrbook.cardForEmailAddress(aAddress);
        if (cardForEmailAddress)
          return cardForEmailAddress;
      } catch (ex) {}
    }

    return null;
  },
};
