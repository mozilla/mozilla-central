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


let GlodaUtils = {
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
   *  4 attributes: count, the number of addresses parsed; addresses, a list of
   *  e-mail addresses (ex: bob@company.com); names, list (ex: Bob Smith); and
   *  fullAddresses, aka the list of name and e-mail together (ex: "Bob Smith"
   *  <bob@company.com>). 
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
  
  extractBodySnippet: function gloda_utils_extractBodySnippet(aBodyString) {
  },
};
