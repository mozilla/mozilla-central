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
 * The Original Code is Instantbird.
 *
 * The Initial Developer of the Original Code is
 * Varuna JAYASIRI <vpjayasiri@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Florian Quèze <florian@queze.net>
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

const EXPORTED_SYMBOLS = ["XMPPSession", "XMPPDefaultResource"];

const {interfaces: Ci, utils: Cu} = Components;

Cu.import("resource:///modules/imXPCOMUtils.jsm");
Cu.import("resource:///modules/socket.jsm");
Cu.import("resource:///modules/xmpp-xml.jsm");
Cu.import("resource:///modules/xmpp-authmechs.jsm");

initLogModule("xmpp-session", this);

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/xmpp.properties")
);

// Workaround because a lazy getter can't be exported.
XPCOMUtils.defineLazyGetter(this, "_defaultResource", function()
  l10nHelper("chrome://branding/locale/brand.properties")("brandShortName")
);
__defineGetter__("XMPPDefaultResource", function() _defaultResource);

function XMPPSession(aHost, aPort, aSecurity, aJID, aPassword, aAccount) {
  this._host = aHost;
  this._port = aPort;

  this._connectionSecurity = aSecurity;
  if (this._connectionSecurity == "old_ssl")
    this._security = ["ssl"];
  else if (this._connectionSecurity != "none")
    this._security = [(aPort == 5223 || aPort == 443) ? "ssl" : "starttls"];

  this._jid = aJID;
  this._domain = aJID.domain;
  this._password = aPassword;
  this._account = aAccount;

  this._auth = null;
  this._resource = aJID.resource || XMPPDefaultResource;
  this._handlers = {};
  this._stanzaId = 0;

  this._account.reportConnecting();
  try {
    this.connect(this._host, this._port, this._security);
  } catch (e) {
    Cu.reportError(e);
    // We can't use _networkError because this._account._connection
    // isn't set until we return from the XMPPSession constructor.
    this._account.reportDisconnecting(Ci.prplIAccount.ERROR_NETWORK_ERROR,
                                      _("connection.error.failedToCreateASocket"));
    this._account.reportDisconnected();
  }
}

XMPPSession.prototype = {
  /* for the socket.jsm helper */
  __proto__: Socket,
  connectTimeout: 60,
  readWriteTimeout: 0,

  _security: null,
  _encrypted: false,

  /* Disconnect from the server */
  disconnect: function() {
    if (this.onXmppStanza == this.stanzaListeners.accountListening)
      this.send("</stream:stream>");
    delete this.onXmppStanza;
    Socket.disconnect.call(this);
    if (this._parser) {
      this._parser.destroy();
      delete this._parser;
      if (this._oldParsers) {
        for each (let parser in this._oldParsers)
          parser.destroy();
        delete this._oldParsers;
      }
    }
  },

  /* Report errors to the account */
  onError: function(aError, aException) {
    this._account.onError(aError, aException);
  },

  /* Send a text message to the server */
  send: function(aMsg) {
    this.sendString(aMsg);
  },

  /* Send a stanza to the server.
   * Can set a callback if required, which will be called
   * when the server responds to the stanza with
   * a stanza of the same id. */
  sendStanza: function(aStanza, aCallback, aObject) {
    if (!aStanza.attributes.hasOwnProperty("id"))
      aStanza.attributes["id"] = ++this._stanzaId;
    if (aCallback)
      this.addHandler(aStanza.attributes.id, aCallback.bind(aObject));
    this.send(aStanza.getXML());
    return aStanza.attributes.id;
  },


  /* these 3 methods handle callbacks for specific ids. */
  addHandler: function(aId, aCallback) {
    this._handlers[aId] = aCallback;
  },
  removeHandler: function(aId) {
    delete this._handlers[aId];
  },
  execHandler: function(aId, aStanza) {
    if (!this._handlers.hasOwnProperty(aId))
      return false;
    this._handlers[aId](aStanza);
    this.removeHandler(aId);
    return true;
  },

  /* Start the XMPP stream */
  startStream: function() {
    if (this._parser) {
      // nsSAXXMLReader (inside XMPPParser) leaks if we don't clean up.
      // Unfortunately, calling onStopRequest on nsSAXXMLReader damages
      // something that causes a crash the next time we call onDataAvailable
      // on another parser instance for the same input stream buffer.
      // Workaround: keep references to all previous parsers used
      // for this socket, and call destroy on each of them when we are
      // done reading from that socket.
      if (!this._oldParsers)
        this._oldParsers = [];
      this._oldParsers.push(this._parser);
    }
    this._parser = new XMPPParser(this);
    this.send('<?xml version="1.0"?><stream:stream to="' + this._domain +
              '" xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" version="1.0">');
  },

  /* Log a message (called by the socket code) */
  log: LOG,

  /* Socket events */
  /* The connection is established */
  onConnection: function() {
    if (this._security.indexOf("ssl") != -1) {
      this.onXmppStanza = this.stanzaListeners.startAuth;
      this._encrypted = true;
    }
    else
      this.onXmppStanza = this.stanzaListeners.initStream;
    this._account.reportConnecting(_("connection.initializingStream"));
    this.startStream();
  },

  /* When incoming data is available to be read */
  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    try {
      this._parser.onDataAvailable(aInputStream, aOffset, aCount);
    } catch(e) {
      Cu.reportError(e);
      this.onXMLError("parser-exception", e);
    }
  },

  /* The connection got disconnected without us closing it. */
  onConnectionClosed: function() {
    this._networkError(_("connection.error.serverClosedConnection"));
  },
  onConnectionReset: function() {
    this._networkError(_("connection.error.resetByPeer"));
  },
  onConnectionTimedOut: function() {
    this._networkError(_("connection.error.timedOut"));
  },
  _networkError: function(aMessage) {
    this.onError(Ci.prplIAccount.ERROR_NETWORK_ERROR, aMessage);
  },


  /* Methods called by the XMPPParser instance */
  onXMLError: function(aError, aException) {
    if (aError == "parsing-characters")
      WARN(aError + ": " + aException);
    else
      ERROR(aError + ": " + aException);
    if (aError != "parse-warning" && aError != "parsing-characters")
      this._networkError(_("connection.error.receivedUnexpectedData"));
  },

  // All the functions in stanzaListeners are used as onXmppStanza
  // implementations at various steps of establishing the session.
  stanzaListeners: {
    initStream: function(aStanza) {
      if (aStanza.localName != "features") {
        ERROR("Unexpected stanza " + aStanza.localName + ", expected 'features'");
        this._networkError(_("connection.error.incorrectResponse"));
        return;
      }

      let starttls = aStanza.getElement(["starttls"]);
      if (starttls && this._security.indexOf("starttls") != -1) {
        this._account.reportConnecting(_("connection.initializingEncryption"));
        this.sendStanza(Stanza.node("starttls", Stanza.NS.tls));
        this.onXmppStanza = this.stanzaListeners.startTLS;
        return;
      }
      if (starttls &&
          starttls.children.some(function (c) c.localName == "required")) {
        this.onError(Ci.prplIAccount.ERROR_ENCRYPTION_ERROR,
                     _("connection.error.startTLSRequired"));
        return;
      }
      if (!starttls && this._connectionSecurity == "require_tls") {
        this.onError(Ci.prplIAccount.ERROR_ENCRYPTION_ERROR,
                     _("connection.error.startTLSNotSupported"));
        return;
      }

      // If we aren't starting TLS, jump to the auth step.
      this.onXmppStanza = this.stanzaListeners.startAuth;
      this.onXmppStanza(aStanza);
    },
    startTLS: function(aStanza) {
      if (aStanza.localName != "proceed") {
        this._networkError(_("connection.error.failedToStartTLS"));
        return;
      }

      this.startTLS();
      this._encrypted = true;
      this.startStream();
      this.onXmppStanza = this.stanzaListeners.startAuth;
    },
    startAuth: function(aStanza) {
      if (aStanza.localName != "features") {
        ERROR("Unexpected stanza " + aStanza.localName + ", expected 'features'");
        this._networkError(_("connection.error.incorrectResponse"));
        return;
      }

      let mechs = aStanza.getElement(["mechanisms"]);
      if (!mechs) {
        this._networkError(_("connection.error.noAuthMec"));
        return;
      }

      // Select the auth mechanism we will use. PLAIN will be treated
      // a bit differently as we want to avoid it over an unencrypted
      // connection, except if the user has explicly allowed that
      // behavior.
      let selectedMech = "";
      let canUsePlain = false;
      mechs = mechs.getChildren("mechanism");
      for each (let m in mechs) {
        let mech = m.innerText;
        if (mech == "PLAIN" && !this._encrypted)
          canUsePlain = true;
        else if (XMPPAuthMechanisms.hasOwnProperty(mech)) {
          selectedMech = mech;
          break;
        }
      }
      if (!selectedMech && canUsePlain) {
        if (this._security == "allow_unencrypted_plain_auth")
          selectedMech = "PLAIN";
        else {
          this.onError(Ci.prplIAccount.ERROR_AUTHENTICATION_IMPOSSIBLE,
                       _("connection.error.notSendingPasswordInClear"));
          return;
        }
      }
      if (!selectedMech) {
        this.onError(Ci.prplIAccount.ERROR_AUTHENTICATION_IMPOSSIBLE,
                     _("connection.error.noCompatibleAuthMec"));
        return;
      }
      this._auth = new XMPPAuthMechanisms[selectedMech](this._jid.node,
                                                        this._password,
                                                        this._domain);

      this._account.reportConnecting(_("connection.authenticating"));
      this.onXmppStanza = this.stanzaListeners.authDialog;
      this.onXmppStanza(null); // the first auth step doesn't read anything
    },
    authDialog: function(aStanza) {
      if (aStanza && aStanza.localName == "failure") {
        let errorMsg = "authenticationFailure";
        if (aStanza.getElement(["not-authorized"]))
          errorMsg = "notAuthorized";
        this.onError(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED,
                     _("connection.error." + errorMsg));
        return;
      }

      let result;
      try {
        result = this._auth.next(aStanza);
      } catch(e) {
        ERROR(e);
        this.onError(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED,
                     _("connection.error.authenticationFailure"));
        return;
      }

      if (result.send)
        this.send(result.send.getXML());
      if (result.done)
        this.onXmppStanza = this.stanzaListeners.authResult;
    },
    authResult: function(aStanza) {
      if (aStanza.localName != "success") {
        this.onError(Ci.prplIAccount.ERROR_AUTHENTICATION_FAILED,
                     _("connection.error.notAuthorized"));
        return;
      }

      this.startStream();
      this.onXmppStanza = this.stanzaListeners.startBind;
    },
    startBind: function(aStanza) {
      if (!aStanza.getElement(["bind"])) {
        ERROR("Unexpected lack of the bind feature");
        this._networkError(_("connection.error.incorrectResponse"));
        return;
      }

      this._account.reportConnecting(_("connection.gettingResource"));
      this.sendStanza(Stanza.iq("set", null, null,
                                Stanza.node("bind", Stanza.NS.bind, null,
                                            Stanza.node("resource", null, null,
                                                        this._resource))));
      this.onXmppStanza = this.stanzaListeners.bindResult;
    },
    bindResult: function(aStanza) {
      let jid = aStanza.getElement(["bind", "jid"]);
      if (!jid) {
        this._networkError(_("connection.error.failedToGetAResource"));
        return;
      }
      jid = jid.innerText;
      DEBUG("jid = " + jid);
      this._jid = this._account._parseJID(jid);
      this.sendStanza(Stanza.iq("set", null, null,
                                Stanza.node("session", Stanza.NS.session)));
      this.onXmppStanza = this.stanzaListeners.sessionStarted;
    },
    sessionStarted: function(aStanza) {
      this._account.onConnection();
      this.onXmppStanza = this.stanzaListeners.accountListening;
    },
    accountListening: function(aStanza) {
      let handled = false;
      if (aStanza.attributes.id)
        handled = this.execHandler(aStanza.attributes.id, aStanza);

      this._account.onXmppStanza(aStanza, handled);
      let name = aStanza.qName;
      if (name == "presence")
        this._account.onPresenceStanza(aStanza, handled);
      else if (name == "message")
        this._account.onMessageStanza(aStanza, handled);
      else if (name == "iq")
        this._account.onIQStanza(aStanza, handled);
    }
  },
  onXmppStanza: function(aStanza) {
    ERROR("should not be reached\n");
  }
};
