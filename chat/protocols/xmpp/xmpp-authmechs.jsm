/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module exports XMPPAuthMechanisms, an object containing all
// the supported SASL authentication mechanisms.
// By default we currently support the PLAIN and the DIGEST-MD5 mechanisms.
// As this is only used by XMPPSession, it may seem like an internal
// detail of the XMPP implementation, but exporting it is valuable so that
// add-ons can add support for more auth mechanisms easily by adding them
// in XMPPAuthMechanisms without having to modify XMPPSession.

const EXPORTED_SYMBOLS = ["XMPPAuthMechanisms"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/xmpp-xml.jsm");

/* Handle PLAIN authorization mechanism */
function PlainAuth(username, password, domain) {
  let data = "\0"+ username + "\0" + password;
  // btoa for Unicode, see https://developer.mozilla.org/en-US/docs/DOM/window.btoa
  this._base64Data = btoa(unescape(encodeURIComponent(data)));
}
PlainAuth.prototype = {
  next: function(aStanza) ({
    done: true,
    send: Stanza.node("auth", Stanza.NS.sasl, {mechanism: "PLAIN"},
                      this._base64Data)
  })
};


/* Handles DIGEST-MD5 authorization mechanism */

// md5 function adapted from netwerk/test/unit/test_authentication.js
// If aUTF8 is true, aString will be treated as an UTF8 encoded string,
// otherwise it can contain binary data.
function md5(aString, aUTF8) {
  let ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
  ch.init(ch.MD5);

  let data;
  if (aUTF8) {
    let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";
    data = converter.convertToByteArray(aString);
  }
  else
    data = [aString.charCodeAt(i) for (i in aString)];

  ch.update(data, data.length);
  return ch.finish(false);
}
function md5hex(aString) {
  let hash = md5(aString);
  function toHexString(charCode) ("0" + charCode.toString(16)).slice(-2)
  return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
}

function digestMD5(aName, aRealm, aPassword, aNonce, aCnonce, aDigestUri) {
  let y = md5(aName + ":" + aRealm + ":" + aPassword, true);
  return md5hex(md5hex(y + ":" + aNonce + ":" + aCnonce) +
                ":" + aNonce + ":00000001:" + aCnonce + ":auth:" +
                md5hex("AUTHENTICATE:" + aDigestUri));
}

function DigestMD5Auth(username, password, domain) {
  this._username = username;
  this._password = password;
  this._domain = domain;
  this.next = this._init;
}
DigestMD5Auth.prototype = {
  _init: function(aStanza) {
    this.next = this._generateResponse;
    return {
      done: false,
      send: Stanza.node("auth", Stanza.NS.sasl, {mechanism: "DIGEST-MD5"})
    };
  },

  _generateResponse: function(aStanza) {
    let decoded = atob(aStanza.innerText.replace(/[^A-Za-z0-9\+\/\=]/g, ""));
    let data = {realm: ""};

    for each (let elem in decoded.split(",")) {
      let e = elem.split("=");
      if (e.length != 2)
        throw "Error decoding: " + elem;

      data[e[0]] = e[1].replace(/"|'/g, "");
    }

    data.username = this._username;

    const kChars =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    const kNonceLength = 32;
    let nonce = "";
    for (let i = 0; i < kNonceLength; ++i)
      nonce += kChars[Math.floor(Math.random() * kChars.length)];

    data.cnonce = nonce;
    data.nc = "00000001";
    data.qop = "auth",
    data["digest-uri"] = "xmpp/" + this._domain + (data.host ? "/" + host : "");
    data.response = digestMD5(this._username, data.realm, this._password,
                              data.nonce, data.cnonce, data["digest-uri"]);
    data.charset = "utf-8";

    let response =
      ["username", "realm", "nonce", "cnonce", "nc", "qop", "digest-uri",
       "response", "charset"].map(function(key) key + "=\"" + data[key] + "\"")
                             .join(",");

    this.next = this._finish;

    return {
      done: false,
      send: Stanza.node("response", Stanza.NS.sasl, null, btoa(response))
    };
  },

  _finish: function(aStanza) {
    if (aStanza.localName != "challenge")
      throw "Not authorized";

    return {
      done: true,
      send: Stanza.node("response", Stanza.NS.sasl)
    };
  }
};

var XMPPAuthMechanisms = {"PLAIN": PlainAuth, "DIGEST-MD5": DigestMD5Auth};
