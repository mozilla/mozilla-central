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
 * The Original Code is the fakeserver.
 *
 * The Initial Developer of the Original Code is
 *  Ben Bucksch <ben.bucksch beonex.com>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * This file implements the authentication mechanisms
 * - AUTH PLAIN
 * - AUTH CRAM-MD5
 * for all the server implementations, i.e. in a generic way.
 * In fact, you could use this to implement a real server in JS :-) .
 *
 * @author Ben Bucksch <ben.bucksch beonex.com>
 */

/**
 * Implements AUTH PLAIN
 * @see RFC 4616
 */
var AuthPLAIN = {
  /**
   * Takes full PLAIN auth line, and decodes it.
   *
   * @param line {String}
   * @returns {Object { username : value, password : value } }
   * @throws {String}   error to return to client
   */
  decodeLine: function(line) {
    dump("AUTH PLAIN line -" + line + "-\n");
    line = atob(line); // base64 decode
    aap = line.split("\u0000"); // 0-charater is delimiter
    if (aap.length != 3)
      throw "Expected three parts";
    /* aap is: authorize-id, authenticate-id, password.
       Generally, authorize-id = authenticate-id = username.
       authorize-id may thus be empty and then defaults to authenticate-id. */
    var result = {};
    var authzid = aap[0];
    result.username = aap[1];
    result.password = aap[2];
    dump("authorize-id: -" + authzid + "-, username: -" + result.username + "-, password: -" + result.password + "-\n");
    if (authzid && authzid != result.username)
      throw "Expecting a authorize-id that's either the same as authenticate-id or empty";
    return result;
  },

  /**
   * Create an AUTH PLAIN line, to allow a client to authenticate to a server.
   * Useful for tests.
   */
  encodeLine : function(username, password)
  {
    return btoa("\u0000" + username + "\u0000" + password); // base64 encode
  },
};

var AuthLOGIN = {
  /**
   * Takes full LOGIN auth line, and decodes it.
   * It may contain either username or password,
   * depending on state/step (first username, then pw).
   *
   * @param line {String}
   * @returns {String}   username or password
   * @throws {String}   error to return to client
   */
  decodeLine: function (line) {
    dump("AUTH LOGIN -" + atob(line) + "-\n");
    return atob(line); // base64 decode
  },
};

/**
  * Implements AUTH CRAM-MD5
  * @see RFC 2195, RFC 2104
  */
var AuthCRAM = {
  /**
   * First part of CRAM exchange is that the server sends
   * a challenge to the client. The client response depends on
   * the challenge. (This prevents replay attacks, I think.)
   * This function generates the challenge.
   *
   * You need to store it, you'll need it to check the client response.
   *
   * @param domain {String}   Your hostname or domain,
   *    e.g. "example.com", "mx.example.com" or just "localhost".
   * @returns {String}   The challenge.
   *   It's already base64-encoded. Send it as-is to the client.
   */
  createChallenge : function(domain)
  {
    var timestamp = new Date().getTime(); // unixtime
    var challenge = "<" + timestamp + "@" + domain + ">";
    dump("CRAM challenge unencoded: " + challenge + "\n");
    return btoa(challenge);
  },
  /**
   * Takes full CRAM-MD5 auth line, and decodes it.
   *
   * Compare the returned |digest| to the result of
   * encodeCRAMMD5(). If they match, the |username|
   * returned here is authenticated.
   *
   * @param line {String}
   * @returns {Object { username : value, digest : value } }
   * @throws {String}   error to return to client
   */
  decodeLine : function(line)
  {
    dump("AUTH CRAM-MD5 line -" + line + "-\n");
    line = atob(line);
    dump("base64 decoded -" + line + "-\n");
    sp = line.split(" ");
    if (sp.length != 2)
      throw "Expected one space";
    var result = {};
    result.username = sp[0];
    result.digest = sp[1];
    return result;
  },
  /**
   * @param text {String}   server challenge (base64-encoded)
   * @param key {String}   user's password
   * @return {String}   digest as hex string
   */
  encodeCRAMMD5 : function(text, key)
  {
    text = atob(text); // createChallenge() returns it already encoded
    dump("encodeCRAMMD5(text: -" + text + "-, key: -" + key + "-)\n");
    const kInputLen = 64;
    //const kHashLen = 16;
    const kInnerPad = 0x36; // per spec
    const kOuterPad = 0x5C;

    key = this.textToNumberArray(key);
    text = this.textToNumberArray(text);
    // Make sure key is exactly kDigestLen bytes long. Algo per spec.
    if (key.length > kInputLen)
      key = this.md5(key); // (results in kHashLen)
    while (key.length < kInputLen)
      key.push(0); // fill up with zeros

    // MD5((key XOR outerpad) + MD5((key XOR innerpad) + text)) , per spec
    var digest = this.md5(this.xor(key, kOuterPad)
         .concat(this.md5(this.xor(key, kInnerPad)
         .concat(text))));
    return this.arrayToHexString(digest);
  },
  // Utils
  xor : function(binary, value)
  {
    var result = [];
    for (var i = 0; i < binary.length; i++)
      result.push(binary[i] ^ value);
    return result;
  },
  md5 : function(binary)
  {
    var md5 = Cc["@mozilla.org/security/hash;1"]
        .createInstance(Ci.nsICryptoHash);
    md5.init(Ci.nsICryptoHash.MD5);
    md5.update(binary, binary.length);
    return this.textToNumberArray(md5.finish(false));
  },
  textToNumberArray : function(text)
  {
    var array = [];
    for (var i = 0; i < text.length; i++)
      array.push(text.charCodeAt(i) & 0xFF); // convert string (only lower byte) to array
    return array;
  },
  arrayToHexString : function(binary)
  {
    var result = "";
    for (var i = 0; i < binary.length; i++)
    {
      if (binary[i] > 255)
        throw "unexpected that value > 255";
      let hex = binary[i].toString(16);
      if (hex.length < 2)
        hex = "0" + hex;
      result += hex;
    }
    return result;
  },
};
