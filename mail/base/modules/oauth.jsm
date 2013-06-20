/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This js module does OAuth 1.0 authentication. It was originally intended to
 * be shareable by various components that need Oauth, but some changes will
 * need to be made to support differences in OAuth usage.
 */

const {classes: Cc, interfaces: Ci, results: Cr, utils: Cu} = Components;

var EXPORTED_SYMBOLS = ["OAuth"];

Cu.import("resource://gre/modules/Http.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");

function OAuth(aDisplayName, aBaseUri, aAuthUri, aAuthToken, aAuthTokenSecret,
               aAppKey, aAppSecret, aSignatureMethod, aTempCredentialsMethod,
               aAuthorizeMethod, aRequestCredentialsMethod)
{
  this._userInfo = {};
  this.displayName = aDisplayName;
  this.baseURI = aBaseUri;
  this.authURI = aAuthUri;
  this.token = aAuthToken;
  this.tokenSecret = aAuthTokenSecret;
  this.consumerKey = aAppKey;
  this.consumerSecret = aAppSecret;
  this.log = Log4Moz.getConfiguredLogger("TBOAuth");

  this.signatureMethod = aSignatureMethod || "HMAC-SHA1";
  this.tempCredentialsMethod = aTempCredentialsMethod || "oauth/request_token";
  this.authorizeMethod = aAuthorizeMethod || "oauth/authorize";
  this.requestCredentialsMethod = aRequestCredentialsMethod || "oauth/access_token";
}

OAuth.prototype = {
  consumerKey: "",
  consumerSecret: "",
  completionURI: "http://oauthcallback.local/",
  baseURI: "",
  token : "",
  tokenSecret : "",
  connectSuccessCallback : null,
  connectFailureCallback : null,
  /**
   * Start the OAuth connection process, if not connected.
   *
   * @param aSuccess success callback, called synchronously if we are already
                     connected, or the connection succeeds.
   * @param aFailure failure callback.
   */
  connect: function(aSuccess, aFailure, aWithUI) {
    if (this.connected || this.connecting)
      return;

    this._enabled = true;
    // Get a new token if needed...
    if (!this.token || !this.tokenSecret) {
      if (!aWithUI) {
        aFailure();
        return;
      }
      this.connectSuccessCallback = aSuccess;
      this.connectFailureCallback = aFailure;
      this.log.info("don't think we have a token or token secret");
      this.requestToken();
      return;
    }

    this.log.info("Connecting using existing token");
    aSuccess();
  },
  /**
   * Sign a request and send it, using the oauth connection.
   * 
   * @param aUrl Url to open
   * @param aHeaders Additional headers to send
   * @param aMethod "Get"/"Post"/"Put"
   * @param aPOSTData Data to post
   * @param aOnLoad Success callback
   * @param aOnError Error callback
   * @param aThis passed as first param to success and error callbacks
   * @param aOAuthParams additional params to pass to request
   */
  signAndSend: function(aUrl, aHeaders, aMethod, aPOSTData, aOnLoad, aOnError, aThis,
                        aOAuthParams) {
    this.log.info("sign and send aUrl = " + aUrl);
    const kChars =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    const kNonceLength = 6;
    let nonce = "";
    for (let i = 0; i < kNonceLength; ++i)
      nonce += kChars[Math.floor(Math.random() * kChars.length)];

    let params = (aOAuthParams || []).concat([
      ["oauth_consumer_key", this.consumerKey],
      ["oauth_nonce", nonce],
      ["oauth_signature_method", this.signatureMethod],
      ["oauth_token", this.token],
      ["oauth_timestamp", Math.floor(((new Date()).getTime()) / 1000)],
      ["oauth_version", "1.0"]
    ]);

    let dataParams = [];
    let url = /^https?:/.test(aUrl) ? aUrl : this.baseURI + aUrl;
    let urlSpec = url;
    let queryIndex = url.indexOf("?");
    if (queryIndex != -1) {
      urlSpec = url.slice(0, queryIndex);
      dataParams = url.slice(queryIndex + 1).split("&")
                      .map(function(p) p.split("=").map(percentEncode));
    }
    this.log.info("in sign and send url = " + url + "\nurlSpec = " + urlSpec);
    this.log.info("dataParams = " + dataParams);

    let signature;
    if (this.signatureMethod === "HMAC-SHA1") {
      let signatureKey = this.consumerSecret + "&" + this.tokenSecret;
      let signatureBase =
        aMethod + "&" + encodeURIComponent(urlSpec) + "&" +
        params.concat(dataParams)
              .sort(function(a,b) (a[0] < b[0]) ? -1 : (a[0] > b[0]) ? 1 : 0)
              .map(function(p) p.map(percentEncode).join("%3D"))
              .join("%26");

      this.log.info("sig base = " + signatureBase);
      let keyFactory = Cc["@mozilla.org/security/keyobjectfactory;1"]
                       .getService(Ci.nsIKeyObjectFactory);
      let hmac =
        Cc["@mozilla.org/security/hmac;1"].createInstance(Ci.nsICryptoHMAC);
      hmac.init(hmac.SHA1,
                keyFactory.keyFromString(Ci.nsIKeyObject.HMAC, signatureKey));
      // No UTF-8 encoding, special chars are already escaped.
      let bytes = [b.charCodeAt() for each (b in signatureBase)];
      hmac.update(bytes, bytes.length);
      signature = encodeURIComponent(hmac.finish(true));
    }
    else if (this.signatureMethod == "PLAINTEXT") {
      signature = percentEncode(percentEncode(this.consumerSecret) + "&" +
                                percentEncode(this.tokenSecret));
    }
    else {
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    }

    params.push(["oauth_signature", signature]);

    let authorization =
      "OAuth " + params.map(function (p) p[0] + "=\"" + p[1] + "\"").join(", ");
    let options = {
      headers: (aHeaders || []).concat([["Authorization", authorization]]),
      postData: aPOSTData,
      method: aMethod,
      onLoad: aOnLoad.bind(aThis),
      onError: aOnError.bind(aThis)
    };
    return httpRequest(url, options);
  },
  _parseURLData: function(aData) {
    let result = {};
    aData.split("&").forEach(function (aParam) {
      let [key, value] = aParam.split("=");
      result[key] = value;
    });
    return result;
  },

  _streamingRequest: null,
  _pendingData: "",
  _receivedLength: 0,
  onDataAvailable: function(aRequest) {
    let text = aRequest.target.responseText;
    let newText = this._pendingData + text.slice(this._receivedLength);
    this.log.info("Received data: " + newText);
    let messages = newText.split(/\r\n?/);
  },

  requestToken: function() {
    let oauthParams =
      [["oauth_callback", encodeURIComponent(this.completionURI)]];
    this.signAndSend(this.tempCredentialsMethod,
                     null, "POST", null,
                     this.onRequestTokenReceived,
                     this.connectFailureCallback, this,
                     oauthParams);
  },
  onRequestTokenReceived: function(aData) {
    this.log.info("Received request token.");
    let data = this._parseURLData(aData);
    if (!data.oauth_token || !data.oauth_token_secret) {
      this.log.info("didn't get request token");
      this.connectFailureCallback();
      return;
    }
    this.token = data.oauth_token;
    this.tokenSecret = data.oauth_token_secret;

    this.requestAuthorization();
  },
  requestAuthorization: function() {
    this.log.info("requesting oauth");
    const url = this.authURI + this.authorizeMethod + "?oauth_token=";
    this._browserRequest =
      { promptText : "auth prompt",
        account: this,
        url: url + this.token + "&oauth_callback=" + this.completionURI,
        _active: true,
        iconURI : "",  // would be nice to set this from the oauth user...
        cancelled: function() {
          if (!this._active)
            return;
          this.account.log.info("auth cancelled");
          this.account.finishAuthorizationRequest();
          this.account.onAuthorizationReceived(null);
          this.account.connectFailureCallback();
        // ### auth cancelled.
        },
        loaded: function(aWindow, aWebProgress) {
          if (!this._active)
            return;

          this._listener = {
            QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                                   Ci.nsISupportsWeakReference]),
            _cleanUp: function() {
              this.webProgress.removeProgressListener(this);
              this.window.close();
              delete this.window;
            },
            _checkForRedirect: function(aURL) {
              if (aURL.indexOf(this._parent.completionURI) != 0)
                return;

              this._parent.finishAuthorizationRequest();
              this._parent.onAuthorizationReceived(aURL);
            },
            onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
              const wpl = Ci.nsIWebProgressListener;
              if (aStateFlags & (wpl.STATE_START | wpl.STATE_IS_NETWORK))
                this._checkForRedirect(aRequest.name);
            },
            onLocationChange: function(aWebProgress, aRequest, aLocation) {
              this._checkForRedirect(aLocation.spec);
            },
            onProgressChange: function() {},
            onStatusChange: function() {},
            onSecurityChange: function() {},

            window: aWindow,
            webProgress: aWebProgress,
            _parent: this.account
          };
        aWebProgress.addProgressListener(this._listener,
                                         Ci.nsIWebProgress.NOTIFY_ALL);
      },
    };
     this.wrappedJSObject = this._browserRequest;
     Services.ww.openWindow(null,
                            "chrome://messenger/content/browserRequest.xul",
                             null, "chrome,centerscreen,width=980px,height=600px", this);
  },
  finishAuthorizationRequest: function() {
    if (!("_browserRequest" in this))
      return;

    this._browserRequest._active = false;
    if ("_listener" in this._browserRequest)
      this._browserRequest._listener._cleanUp();
    delete this._browserRequest;
  },
  onAuthorizationReceived: function(aData) {
    this.log.info("authorization received");
    let data = this._parseURLData(aData);

    this.requestAccessToken([["oauth_verifier", data.oauth_verifier]]);
  },
  requestAccessToken: function(aVerifier) {
    this.signAndSend(this.requestCredentialsMethod, null, "POST", null,
                     this.onAccessTokenReceived, this.connectFailureCallback, this,
                     aVerifier);
  },
  onAccessTokenReceived: function(aData) {
    this.log.info("Received access token. urlData = " + aData);
    let result = this._parseURLData(aData);

    this.token = result.oauth_token;
    this.tokenSecret = result.oauth_token_secret;
    this.connectSuccessCallback();
  },


  cleanUp: function() {
    this.finishAuthorizationRequest();
    if (this._pendingRequests.length != 0) {
      for each (let request in this._pendingRequests)
        request.abort();
      delete this._pendingRequests;
    }
    if (this._streamingRequest) {
      this._streamingRequest.abort();
      delete this._streamingRequest;
    }
  },
  unInit: function() {
    this.cleanUp();
  },
};

