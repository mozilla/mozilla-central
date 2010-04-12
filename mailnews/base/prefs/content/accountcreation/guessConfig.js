/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
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
 * The Original Code is Incoming Mail Auto discovery.
 *
 * The Initial Developer of the Original Code is
 * Brian Kirsch.
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Ascher
 * Ben Bucksch <mozilla bucksch.org>
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

var gOverrideService = Cc["@mozilla.org/security/certoverride;1"]
                       .getService(Ci.nsICertOverrideService);
Cu.import("resource:///modules/gloda/log4moz.js");

const TIMEOUT = 10; // in seconds

// This is a bit ugly - we set outgoingDone to false
// when emailWizard.js cancels the outgoing probe because the user picked
// an outoing server. It does this by poking the probeAbortable object,
// so we need outgoingDone to have global scope.
var outgoingDone = false;

/**
 * Try to guess the config, by:
 * - guessing hostnames (pop3.<domain>, pop.<domain>, imap.<domain>,
 *                       mail.<domain> etc.)
 * - probing known ports (for IMAP, POP3 etc., with SSL, STARTTLS etc.)
 * - opening a connection via the right protocol and checking the
 *   protocol-specific CAPABILITIES like that the server returns.
 *
 * Final verification is not done here, but in verifyConfig().
 *
 * This function is async.
 * @param domain {String} the domain part of the email address
 * @param progressCallback {function(type, hostname, port, ssl, done)}
 *   Called when we try a new hostname/port.
 *   type {String-enum} @see AccountConfig type - "imap", "pop3", "smtp"
 *   hostname {String}
 *   port {Integer}
 *   socketType {Integer-enum} @see AccountConfig.incoming.socketType
 *      1 = plain, 2 = SSL, 3 = STARTTLS
 *   done {Boolean}   false, if we start probing this host/port, true if we're
 *       done and the host is good.  (there is no notification when a host is
 *       bad, we'll just tell about the next host tried)
 * @param successCallback {function(config {AccountConfig})}
 *   Called when we could guess the config.
 *   param accountConfig {AccountConfig} The guessed account config.
 *       username, password, realname, emailaddress etc. are not filled out,
 *       but placeholders to be filled out via replaceVariables().
 * @param errorCallback function(ex)
 *   Called when we could guess not the config, either
 *   because we have not found anything or
 *   because there was an error (e.g. no network connection).
 *   The ex.message will contain a user-presentable message.
 * @param incomingErrorCallback {function(ex, config {AccountConfig})}
 *   Like errorCallback, just that we do have a config for the
 *   outgoing server, just not for the incoming server.
 *   This is not terribly useful, because we may have guessed
 *   the MX server (SMTP server for incoming mail from other SMTP servers),
 *   not the outbound SMTP for users.
 *   Showing MX will highly mislead users, so better to treat that as total error.
 * @param outgoingErrorCallback {function(ex, config {AccountConfig})}
 *   Like errorCallback, just that we do have a config for the
 *   incoming server, just not for the outgoing server.
 * @param resultConfig {AccountConfig} (optional)
 *   A config which may be partially filled in. If so, it will be used as base
 *   for the guess.
 * @param which {String-enum} (optional)  "incoming", "outgoing", or "both".
 *   Default "both". Whether to guess only the incoming or outgoing server.
 * @result {Abortable} Allows you to cancel the guess
 */
function guessConfig(domain, progressCallback, successCallback, errorCallback,
                     incomingErrorCallback, outgoingErrorCallback,
                     resultConfig, which)
{
  assert(typeof(progressCallback) == "function", "need progressCallback");
  assert(typeof(successCallback) == "function", "need successCallback");
  assert(typeof(errorCallback) == "function", "need errorCallback");
  assert(typeof(incomingErrorCallback) == "function",
    "need incomingErrorCallback");
  assert(typeof(outgoingErrorCallback) == "function",
    "need outgoingErrorCallback");
  if (!resultConfig)
    resultConfig = new AccountConfig();
  resultConfig.source = AccountConfig.kSourceGuess;

  var outgoingHostDetector = null;
  var incomingHostDetector = null;
  var incomingEx = null; // if incoming had error, store ex here
  var outgoingEx = null; // if incoming had error, store ex here
  var incomingDone = (which == "outgoing");
  var outgoingDone = (which == "incoming");

  var progress = function(thisTry)
  {
    progressCallback(protocolToString(thisTry.protocol), thisTry.hostname,
                     thisTry.port, sslConvertToSocketType(thisTry.ssl), false,
                     resultConfig);
  };

  var updateConfig = function(config)
  {
    resultConfig = config;
  };

  var checkDone = function()
  {
    if (outgoingEx)
      outgoingErrorCallback(outgoingEx, resultConfig);

    if (incomingEx)
      incomingErrorCallback(incomingEx, resultConfig);

    if (incomingEx && outgoingEx)
    {
      errorCallback(incomingEx, resultConfig);
      return;
    }
    if ((incomingDone || incomingEx) && (outgoingDone || outgoingEx))
    {
      successCallback(resultConfig);
      return;
    }
  };

  var outgoingSuccess = function(thisTry)
  {
    assert(thisTry.protocol == SMTP, "I only know SMTP for outgoing");
    // Ensure there are no previously saved outgoing errors if we've got success
    // here.
    outgoingEx = null;
    resultConfig.outgoing.type = "smtp";
    resultConfig.outgoing.hostname = thisTry.hostname;
    resultConfig.outgoing.port = thisTry.port;
    resultConfig.outgoing.socketType = sslConvertToSocketType(thisTry.ssl);
    resultConfig.outgoing.auth = chooseBestAuthMethod(thisTry.authMethods);
    resultConfig.outgoing.authAlternatives = thisTry.authMethods;
    // TODO
    // cert is also bad when targetSite is set. (Same below for incoming.)
    // Fix SSLErrorHandler and security warning dialog in emailWizard.js.
    resultConfig.outgoing.badCert = thisTry.selfSignedCert;
    resultConfig.outgoing.targetSite = thisTry.targetSite;

    progressCallback(resultConfig.outgoing.type,
        resultConfig.outgoing.hostname, resultConfig.outgoing.port,
        resultConfig.outgoing.socketType, true, resultConfig);
    outgoingDone = true;
    checkDone();
  };

  var outgoingError = function(ex)
  {
    outgoingEx = ex;
    checkDone();
  };

  var incomingSuccess = function(thisTry)
  {
    // Ensure there are no previously saved incoming errors if we've got success
    // here.
    incomingEx = null;
    resultConfig.incoming.type = protocolToString(thisTry.protocol);
    resultConfig.incoming.hostname = thisTry.hostname;
    resultConfig.incoming.port = thisTry.port;
    resultConfig.incoming.socketType = sslConvertToSocketType(thisTry.ssl);
    resultConfig.incoming.auth = chooseBestAuthMethod(thisTry.authMethods);
    resultConfig.incoming.authAlternatives = thisTry.authMethods;
    resultConfig.incoming.badCert = thisTry.selfSignedCert;
    resultConfig.incoming.targetSite = thisTry.targetSite;

    progressCallback(resultConfig.incoming.type,
        resultConfig.incoming.hostname, resultConfig.incoming.port,
        resultConfig.incoming.socketType, true, resultConfig);
    incomingDone = true;
    checkDone();
  };

  var incomingError = function(ex)
  {
    incomingEx = ex;
    checkDone();
  };

  let incomingHostDetector = null;
  let outgoingHostDetector = null;
  incomingHostDetector = new IncomingHostDetector(progress, incomingSuccess,
                                                  incomingError);
  outgoingHostDetector = new OutgoingHostDetector(progress, outgoingSuccess,
                                                  outgoingError);
  if (which == "incoming" || which == "both")
  {
    incomingHostDetector.start(domain, !!resultConfig.incoming.hostname,
        resultConfig.incoming.type, resultConfig.incoming.port,
        resultConfig.incoming.socketType);
  }
  if (which == "outgoing" || which == "both")
  {
    outgoingHostDetector.start(domain, !!resultConfig.outgoing.hostname,
        "smtp", resultConfig.outgoing.port, resultConfig.outgoing.socketType);
  }

  return new GuessAbortable(incomingHostDetector, outgoingHostDetector,
                            updateConfig);
}

function GuessAbortable(incomingHostDetector, outgoingHostDetector,
                        updateConfig)
{
  Abortable.call(this);
  this._incomingHostDetector = incomingHostDetector;
  this._outgoingHostDetector = outgoingHostDetector;
  this._updateConfig = updateConfig;
}
GuessAbortable.prototype =
{
  cancel : function(which)
  {
    switch (which)
    {
      case "incoming":
      default:
        if (this._incomingHostDetector)
          this._incomingHostDetector.cancel();
      case "outgoing":
        if (which != "incoming")
        {
          if (this._outgoingHostDetector)
            this._outgoingHostDetector.cancel();
          outgoingDone = true;
        }
    }
  },

  /**
   * Start a detection that has been cancel()ed before,
   * possibly with other parameters.
   *
   * This is basically an alternative to calling guessConfig() again.
   * TODO deprecate in favor of that?
   *
   * @param domain {String} @see HostDetector.start()
   * @param config {AccountConfig} @see guessConfig() resultConfig
   * @param which {String-enum} @see guessConfig() which
   * @param type {String-enum} @see HostDetector.start()
   * @param port {Integer} @see HostDetector.start()
   * @param socketType {Integer-enum} @see HostDetector.start()
   */
  restart : function(domain, config, which, type, port, socketType)
  {
    // Calling code may have changed config (e.g., user may have changed
    // username) so put new values in resultConfig.
    this._updateConfig(config);
    var incomingHostIsPrecise = !!config.incoming.hostname;
    var outgoingHostIsPrecise = !!config.outgoing.hostname;
    switch (which)
    {
      case "incoming":
        assert(this._incomingHostDetector, "need this._incomingHostDetector");
        this._incomingHostDetector.cancel();
        this._incomingHostDetector.start(domain, incomingHostIsPrecise,
                                         type, port, socketType);
        break;
      case "outgoing":
        assert(this._outgoingHostDetector, "need this._outgoingHostDetector");
        this._outgoingHostDetector.cancel();
        this._outgoingHostDetector.start(domain, outgoingHostIsPrecise,
                                         "smtp", port, socketType);
        break;
      default: // both
        assert(this._incomingHostDetector, "need this._incomingHostDetector");
        assert(this._outgoingHostDetector, "need this._outgoingHostDetector");
        this._incomingHostDetector.cancel();
        this._incomingHostDetector.start(domain, incomingHostIsPrecise,
                                         type, port, socketType);
        this._outgoingHostDetector.cancel();
        this._outgoingHostDetector.start(domain, outgoingHostIsPrecise,
                                         "smtp", port, socketType);
    }
  }
}
extend(GuessAbortable, Abortable);



//////////////////////////////////////////////////////////////////////////////
// Implementation
//
// Objects, functions and constants that follow are not to be used outside
// this file.

const kNotTried = 0;
const kOngoing = 1;
const kFailed = 2;
const kSuccess = 3;

/**
 * Internal object holding one server that we should try or did try.
 * Used as |thisTry|.
 *
 * Note: The consts it uses for protocol and ssl are defined towards the end
 * of this file and not the same as those used in AccountConfig (type,
 * socketType). (fix this)
 */
function HostTry()
{
}
HostTry.prototype =
{
  // IMAP, POP or SMTP
  protocol : UNKNOWN,
  // {String}
  hostname : undefined,
  // {Integer}
  port : undefined,
  // NONE, SSL or TLS
  ssl : UNKNOWN,
  // {String} what to send to server
  commands : null,
  // {Integer-enum} kNotTried, kOngoing, kFailed or kSuccess
  status : kNotTried,
  // {Abortable} allows to cancel the socket comm
  abortable : null,

  // {Array of {Integer-enum}} @see _advertisesAuthMethods() result
  // Info about the server, from the protocol and SSL chat
  authMethods : null,
  // {String} Whether the SSL cert is not from a proper CA
  selfSignedCert : false,
  // {String} Which host the SSL cert is made for, if not hostname.
  // If set, this is an SSL error.
  targetSite : null,
};

/**
 * @param successCallback {function(result {HostTry})}
 *    Called when the config is OK
 * @param errorCallback {function(ex)} Called when we could not find a config
 * @param progressCallback { function(server {HostTry}) } Called when we tried
 *    (will try?) a new hostname and port
 */
function HostDetector(progressCallback, successCallback, errorCallback)
{
  this.mSuccessCallback = successCallback;
  this.mProgressCallback = progressCallback;
  this.mErrorCallback = errorCallback;
  this._done = false;
  this._cancel = false;
  // {Array of {HostTry}}, ordered by decreasing preference
  this._hostsToTry = new Array();

  // init logging
  this._log = Log4Moz.getConfiguredLogger("mail.wizard");
  this._log.info("created host detector");
}

HostDetector.prototype =
{
  cancel : function(ex)
  {
    this._cancel = true;
    // We have to actively stop the network calls, as they may result in
    // callbacks e.g. to the cert handler. If the dialog is gone by the time
    // this happens, the javascript stack is horked.
    for (let i = 0; i < this._hostsToTry.length; i++)
    {
      let thisTry = this._hostsToTry[i]; // {HostTry}
      if (thisTry.abortable)
        thisTry.abortable.cancel();
      thisTry.status = kFailed; // or don't set? Maybe we want to continue.
    }
    if (!ex)
      ex = new UserCancelledException(); // TODO use CanceledException, after it was added to util.js (not fetchhttp.js) in bug 534588 or bug 549045.
    if (!this._done) // success also calls cancel() - skip this in this case
      this.mErrorCallback(ex);
    this._done = true;
  },

  /**
   * Start the detection
   *
   * @param domain {String} to be used as base for guessing.
   *     Should be a domain (e.g. yahoo.co.uk).
   *     If hostIsPrecise == true, it should be a full hostname
   * @param hostIsPrecise {Boolean} (default false)  use only this hostname,
   *     do not guess hostnames.
   * @param type {String-enum}@see AccountConfig type
   *     (Optional. default, 0, undefined, null = guess it)
   * @param port {Integer} (Optional. default, 0, undefined, null = guess it)
   * @param socketType {Integer-enum}@see AccountConfig socketType
   *     (Optional. default, 0, undefined, null = guess it)
   */
  start : function(domain, hostIsPrecise, type, port, socketType)
  {
    domain = domain.replace(/\s*/g, ""); // Remove whitespace
    if (!hostIsPrecise)
      hostIsPrecise = false;
    var protocol = sanitize.translate(type,
        { "imap" : IMAP, "pop3" : POP, "smtp" : SMTP }, UNKNOWN);
    if (!port)
      port = UNKNOWN;
    var ssl = ConvertSocketTypeToSSL(socketType);
    this._cancel = false;
    this._log.info("doing auto detect for protocol " + protocol +
        ", domain " + domain + ", (exactly: " + hostIsPrecise +
        "), port " + port + ", ssl " + ssl);

    // fill this._hostsToTry
    this._hostsToTry = [];
    var hostnamesToTry = [];
    // if hostIsPrecise is true, it's because that's what the user input
    // explicitly, and we'll just try it, nothing else.
    if (hostIsPrecise)
      hostnamesToTry.push(domain);
    else
      hostnamesToTry = this._hostnamesToTry(protocol, domain);

    for (let i = 0; i < hostnamesToTry.length; i++)
    {
      let hostname = hostnamesToTry[i];
      // this._portsToTry() = getIncomingTryOrder()/getOutgoingTryOrder()
      let hostEntries = this._portsToTry(hostname, protocol, ssl, port);
      for (let j = 0; j < hostEntries.length; j++)
      {
        let hostTry = hostEntries[j]; // from getHostEntry()
        hostTry.hostname = hostname;
        hostTry.status = kNotTried;
        this._hostsToTry.push(hostTry);
      }
    }

    this._hostsToTry = sortTriesByPreference(this._hostsToTry);
    this._tryAll();
  },

  // We make all host/port combinations run in parallel, store their
  // results in an array, and as soon as one finishes successfully and all
  // higher-priority ones have failed, we abort all lower-priority ones.

  _tryAll : function()
  {
    if (this._cancel)
      return;
    var me = this;
    for (let i = 0; i < this._hostsToTry.length; i++)
    {
      let thisTry = this._hostsToTry[i]; // {HostTry}
      if (thisTry.status != kNotTried)
        continue;
      this._log.info("poking at " + thisTry.hostname + " port " +
          thisTry.port + " ssl "+ thisTry.ssl + " protocol " +
          protocolToString(thisTry.protocol));
      if (i == 0) // showing 50 servers at once is pointless
        this.mProgressCallback(thisTry);

      thisTry.abortable = SocketUtil(
          thisTry.hostname, thisTry.port, thisTry.ssl,
          thisTry.commands, TIMEOUT,
          new SSLErrorHandler(thisTry, this._log),
          function(wiredata) // result callback
          {
            if (me._cancel)
              return; // don't use response anymore
            me.mProgressCallback(thisTry);
            me._processResult(thisTry, wiredata);
            me._checkFinished();
          },
          function(e) // error callback
          {
            if (me._cancel)
              return; // who set cancel to true already called mErrorCallback()
            me._log.warn(e);
            thisTry.status = kFailed;
            me._checkFinished();
          });
      thisTry.status = kOngoing;
    }
  },

  /**
   * @param thisTry {HostTry}
   * @param wiredata {Array of {String}} what the server returned
   *     in response to our protocol chat
   */
  _processResult : function(thisTry, wiredata)
  {
    if (thisTry._gotCertError == gOverrideService.ERROR_MISMATCH)
    {
      thisTry._gotCertError = false;
      thisTry.status = kFailed;
      return;
    }

    if (thisTry._gotCertError == gOverrideService.ERROR_UNTRUSTED ||
        thisTry._gotCertError == gOverrideService.ERROR_TIME)
    {
      this._log.info("TRYING AGAIN, hopefully with exception recorded");
      thisTry._gotCertError = false;
      thisTry.selfSignedCert = true; // _next_ run gets this exception
      thisTry.status = kNotTried; // try again (with exception)
      this._tryAll();
      return;
    }

    if (wiredata == null || wiredata === undefined)
    {
      this._log.info("no data");
      thisTry.status = kFailed;
      return;
    }
    this._log.info("wiredata: " + wiredata.join(""));
    thisTry.authMethods =
        this._advertisesAuthMethods(thisTry.protocol, wiredata);
    if (thisTry.ssl == TLS && !this._hasTLS(thisTry, wiredata))
    {
      this._log.info("STARTTLS wanted, but not offered");
      thisTry.status = kFailed;
      return;
    }
    if (thisTry.selfSignedCert)
    {
      // the callback will put up the cert exception dialog, so
      // clear the override here.
      this._log.info("clearing validity override for " + thisTry.hostname);
      gOverrideService.clearValidityOverride(thisTry.hostname, thisTry.port);
    }
    this._log.info("success with " + thisTry.hostname + ":" +
        thisTry.port + " " + protocolToString(thisTry.protocol) +
        " ssl " + thisTry.ssl +
        (thisTry.selfSignedCert ? " (selfSignedCert)" : ""));
    thisTry.status = kSuccess;
  },

  _checkFinished : function()
  {
    var successfulTry = null;
    var successfulTryNonSSL = null;
    var unfinishedBusiness = false;
    // this._hostsToTry is ordered by decreasing preference
    for (let i = 0; i < this._hostsToTry.length; i++)
    {
      let thisTry = this._hostsToTry[i];
      if (thisTry.status == kNotTried || thisTry.status == kOngoing)
        unfinishedBusiness = true;
      // thisTry is good, and all higher preference tries failed, so use this
      else if (thisTry.status == kSuccess && !unfinishedBusiness)
      {
        successfulTry = thisTry;
        break;
      }
    }
    if (successfulTry)
    {
      this._log.info("CHOOSING " + successfulTry.hostname + ":" +
          successfulTry.port + " " +
          protocolToString(successfulTry.protocol) + " auth methods [" +
          successfulTry.authMethods.join(",") + "] ssl " + successfulTry.ssl +
          (successfulTry.selfSignedCert ? " (selfSignedCert)" : ""));
      this.mSuccessCallback(successfulTry);
      this._done = true;
      this.cancel();
    }
    else if (!unfinishedBusiness) // all failed
    {
      this._log.info("ran out of options");
      var errorMsg =
        getStringBundle("chrome://messenger/locale/accountCreationModel.properties")
        .GetStringFromName("cannot_find_server.error");
      this.mErrorCallback(new Exception(errorMsg));
      this._done = true;
      // no need to cancel, all failed
    }
    // else let ongoing calls continue
  },


  /**
   * Which auth mechanism the server claims to support.
   * (That doesn't necessarily reflect reality, it is more an upper bound.)
   *
   * @param protocol {Integer-enum} IMAP, POP or SMTP
   * @param capaResponse {Array of {String}} on the wire data
   *     that the server returned. May be the full exchange or just capa.
   * @returns {Array of {Integer-enum} values for AccountConfig.incoming.auth
   *     (or outgoing), in decreasing order of preference.
   *     E.g. [ 5, 4 ] for a server that supports only Kerberos and
   *     encrypted passwords.
   */
  _advertisesAuthMethods : function(protocol, capaResponse)
  {
    // for imap, capabilities include e.g.:
    // "AUTH=CRAM-MD5", "AUTH=NTLM", "AUTH=GSSAPI", "AUTH=MSN"
    // for pop3, the auth mechanisms are returned in capa as the following:
    // "CRAM-MD5", "NTLM", "MSN", "GSSAPI"
    // For smtp, EHLO will return AUTH and then a list of the
    // mechanism(s) supported, e.g.,
    // AUTH LOGIN NTLM MSN CRAM-MD5 GSSAPI
    var result = new Array();
    var line = capaResponse.join("\n").toUpperCase();
    var prefix = "";
    if (protocol == POP)
      prefix = "";
    else if (protocol == IMAP)
      prefix = "AUTH=";
    else if (protocol == SMTP)
      prefix = "AUTH.*";
    else
      throw NotReached("must pass protocol");
    // add in decreasing order of preference
    if (new RegExp(prefix + "GSSAPI").test(line))
      result.push(Ci.nsMsgAuthMethod.GSSAPI);
    if (new RegExp(prefix + "CRAM-MD5").test(line))
      result.push(Ci.nsMsgAuthMethod.passwordEncrypted);
    if (new RegExp(prefix + "(NTLM|MSN)").test(line))
      result.push(Ci.nsMsgAuthMethod.NTLM);
    if ( ! (protocol == IMAP && /LOGINDISABLED/.test(line)))
      result.push(Ci.nsMsgAuthMethod.passwordCleartext);
    return result;
  },

  _hasTLS : function(thisTry, wiredata)
  {
    var capa = thisTry.protocol == POP ? "STLS" : "STARTTLS";
    return thisTry.ssl == TLS &&
        wiredata.join("").toUpperCase().indexOf(capa) != -1;
  },
}

/**
 * @param authMethods @see return value of _advertisesAuthMethods()
 *    Note: the returned auth method will be removed from the array.
 * @return one of them, the preferred one
 * Note: this might be Kerberos, which might not actually work,
 * so you might need to try the others, too.
 */
function chooseBestAuthMethod(authMethods)
{
  if (!authMethods || !authMethods.length)
    return Ci.nsMsgAuthMethod.passwordCleartext;
  return authMethods.shift(); // take first (= most preferred)
}


function IncomingHostDetector(
  progressCallback, successCallback, errorCallback)
{
  HostDetector.call(this, progressCallback, successCallback, errorCallback);
}
IncomingHostDetector.prototype =
{
  _hostnamesToTry : function(protocol, domain)
  {
    var hostnamesToTry = [];
    if (protocol != POP)
      hostnamesToTry.push("imap." +  domain);
    if (protocol != IMAP)
    {
      hostnamesToTry.push("pop3." +  domain);
      hostnamesToTry.push("pop." +  domain);
    }
    hostnamesToTry.push("mail." + domain);
    hostnamesToTry.push(domain);
    return hostnamesToTry;
  },
  _portsToTry : getIncomingTryOrder,
}
extend(IncomingHostDetector, HostDetector);

function OutgoingHostDetector(
  progressCallback, successCallback, errorCallback)
{
  HostDetector.call(this, progressCallback, successCallback, errorCallback);
}
OutgoingHostDetector.prototype =
{
  _hostnamesToTry : function(protocol, domain)
  {
    var hostnamesToTry = [];
    hostnamesToTry.push("smtp." + domain);
    hostnamesToTry.push("mail." + domain);
    hostnamesToTry.push(domain);
    return hostnamesToTry;
  },
  _portsToTry : getOutgoingTryOrder,
}
extend(OutgoingHostDetector, HostDetector);


//////////////////////////////////////////////////////////////////////////
// Encode protocol ports and order of preference

// Protocol Types
const UNKNOWN = -1;
const IMAP = 0;
const POP = 1;
const SMTP = 2;
// Security Types
const NONE = 0; // no encryption
//1 would be "TLS if available"
const TLS = 2; // STARTTLS
const SSL = 3; // SSL / TLS

const IMAP_PORTS = {}
IMAP_PORTS[NONE] = 143;
IMAP_PORTS[TLS] = 143;
IMAP_PORTS[SSL] = 993;

const POP_PORTS = {}
POP_PORTS[NONE] = 110;
POP_PORTS[TLS] = 110;
POP_PORTS[SSL] = 995;

const SMTP_PORTS = {}
SMTP_PORTS[NONE] = 587;
SMTP_PORTS[TLS] = 587;
SMTP_PORTS[SSL] = 465;

const CMDS = {}
CMDS[IMAP] = ["1 CAPABILITY\r\n", "2 LOGOUT\r\n"];
CMDS[POP] = ["CAPA\r\n", "QUIT\r\n"];
CMDS[SMTP] = ["EHLO we-guess.mozilla.org\r\n", "QUIT\r\n"];

/**
 * Sort by preference of SSL, IMAP etc.
 * @param tries {Array of {HostTry}}
 * @returns {Array of {HostTry}}
 */
function sortTriesByPreference(tries)
{
  return tries.sort(function __sortByPreference(a, b)
  {
    // -1 = a is better; 1 = b is better; 0 = equal
    // Prefer SSL/TLS above all else
    if (a.ssl != NONE && b.ssl == NONE)
      return -1;
    if (b.ssl != NONE && a.ssl == NONE)
      return 1;
    // Prefer IMAP over POP
    if (a.protocol == IMAP && b.protocol == POP)
      return -1;
    if (b.protocol == IMAP && a.protocol == POP)
      return 1;
    // For hostnames, leave existing sorting, as in _hostnamesToTry()
    // For ports, leave existing sorting, as in getOutgoingTryOrder()
    return 0;
  });
};

// TODO prefer SSL over STARTTLS,
// either in sortTriesByPreference or in getIncomingTryOrder() (and outgoing)

/**
 * @returns {Array of {HostTry}}
 */
function getIncomingTryOrder(host, protocol, ssl, port)
{
  var lowerCaseHost = host.toLowerCase();

  if (protocol == UNKNOWN &&
      (!lowerCaseHost.indexOf("pop.") || !lowerCaseHost.indexOf("pop3.")))
    protocol = POP;
  else if (protocol == UNKNOWN && !lowerCaseHost.indexOf("imap."))
    protocol = IMAP;

  if (protocol != UNKNOWN) {
    if (ssl == UNKNOWN)
      return [getHostEntry(protocol, TLS, port),
              getHostEntry(protocol, SSL, port),
              getHostEntry(protocol, NONE, port)];
    return [getHostEntry(protocol, ssl, port)];
  }
  if (ssl == UNKNOWN)
    return [getHostEntry(IMAP, TLS, port),
            getHostEntry(IMAP, SSL, port),
            getHostEntry(POP, TLS, port),
            getHostEntry(POP, SSL, port),
            getHostEntry(IMAP, NONE, port),
            getHostEntry(POP, NONE, port)];
  return [getHostEntry(IMAP, ssl, port),
          getHostEntry(POP, ssl, port)];
};

/**
 * @returns {Array of {HostTry}}
 */
function getOutgoingTryOrder(host, protocol, ssl, port)
{
  assert(protocol == SMTP, "need SMTP as protocol for outgoing");
  if (ssl == UNKNOWN)
  {
    if (port == UNKNOWN)
      // neither SSL nor port known
      return [getHostEntry(SMTP, TLS, UNKNOWN),
              getHostEntry(SMTP, TLS, 25),
              getHostEntry(SMTP, SSL, UNKNOWN),
              getHostEntry(SMTP, NONE, UNKNOWN),
              getHostEntry(SMTP, NONE, 25)];
    // port known, SSL not
    return [getHostEntry(SMTP, TLS, port),
            getHostEntry(SMTP, SSL, port),
            getHostEntry(SMTP, NONE, port)];
  }
  // SSL known, port not
  if (port == UNKNOWN)
  {
    if (ssl == SSL)
      return [getHostEntry(SMTP, SSL, UNKNOWN)];
    else // TLS or NONE
      return [getHostEntry(SMTP, ssl, UNKNOWN),
              getHostEntry(SMTP, ssl, 25)];
  }
  // SSL and port known
  return [getHostEntry(SMTP, ssl, port)];
};

/**
 * @returns {HostTry} with proper default port and commands,
 *     but without hostname.
 */
function getHostEntry(protocol, ssl, port)
{
  if (!port || port == UNKNOWN) {
    switch (protocol) {
      case POP:
        port = POP_PORTS[ssl];
        break;
      case IMAP:
        port = IMAP_PORTS[ssl];
        break;
      case SMTP:
        port = SMTP_PORTS[ssl];
        break;
      default:
        throw new NotReached("unsupported protocol " + protocol);
    }
  }

  var r = new HostTry();
  r.protocol = protocol;
  r.ssl = ssl;
  r.port = port;
  r.commands = CMDS[protocol];
  return r;
};


// Convert consts from those used here to those from AccountConfig
// TODO adjust consts to match AccountConfig

// here -> AccountConfig
function sslConvertToSocketType(ssl)
{
  if (ssl == NONE)
    return 1;
  if (ssl == SSL)
    return 2;
  if (ssl == TLS)
    return 3;
  throw new NotReached("unexpected SSL type");
}

// AccountConfig -> here
function ConvertSocketTypeToSSL(socketType)
{
  switch (socketType) {
    case 1:
      return NONE;
    case 2:
      return SSL;
    case 3:
      return TLS;
    default:
      return UNKNOWN;
  }
}

// here -> AccountConfig
function protocolToString(type)
{
  if (type == IMAP)
    return "imap";
  if (type == POP)
    return "pop3";
  if (type == SMTP)
    return "smtp";
  throw new NotReached("unexpected protocol");
}



/////////////////////////////////////////////////////////
// SSL cert error handler

/**
 * Called by MyBadCertHandler.js, which called by PSM
 * to tell us about SSL certificate errors.
 * @param thisTry {HostTry}
 * @param logger {Log4Moz logger}
 */
function SSLErrorHandler(thisTry, logger)
{
  this._try = thisTry;
  this._log = logger;
  this._gotCertError = false;
}
SSLErrorHandler.prototype =
{
  processCertError : function(socketInfo, status, targetSite)
  {
    this._log.warn("Got Cert error for "+ targetSite);

    if (!status)
      return true;

    let cert = status.QueryInterface(Ci.nsISSLStatus).serverCert;
    let flags = 0;

    let parts = targetSite.split(":");
    let host = parts[0];
    let port = parts[1];

    if (status.isDomainMismatch) {
      this._try._gotCertError = gOverrideService.ERROR_MISMATCH;
      flags |= gOverrideService.ERROR_MISMATCH;

      // If it was just a domain mismatch error
      // TODO "just"??? disabling it for now
      if (false && !(status.isUntrusted || status.isNotValidAtThisTime)) {
        // then, if we didn't get a wildcard in the certificate,
        if (cert.commonName.charAt(0) != "*") {
          // then add this host to the hosts to try, and skip to the end.
          /* TODO This is logically broken, I think
           * The hostname is in the cert, because the cert is only valid for
           * this host. Anybody can get a cert (even from a CA) for
           * imap.badsite.com . If you MITM me (which is what SSL certs try
           * to prevent), we'll get imap.badsite.com here. Now, if we treat
           * this as "cool, let's see whether imap.badsite.com also works!",
           * the SSL cert was kind of pointless, no?
           * Sure, we can let the user confirm it first (not sure whether we
           * do that!), but that may be too risky, because users are likely
           * to just accept. See phishing. */
          if (this._hostsToTry.indexOf(cert.commonName) == -1) 
            this._hostsToTry.push(cert.commonName);
          this._tryIndex = this.tryOrder.length - 1;
        }
        return true;
      }
    }

    if (status.isUntrusted) {
      this._try._gotCertError = gOverrideService.ERROR_UNTRUSTED;
      flags |= gOverrideService.ERROR_UNTRUSTED;
    }
    if (status.isNotValidAtThisTime) {
      this._try._gotCertError = gOverrideService.ERROR_TIME;
      flags |= gOverrideService.ERROR_TIME;
    }

    // If domain mismatch, then we shouldn't accept, and instead try the domain
    // in the cert to the list of tries.
    // Not skipping mismatches for now because it's too common, and until we can
    // poke around the cert and find out what domain to try, best to live
    // w/ orange than red.

    this._try.targetSite = targetSite;
    this._try._certOverrideProcessed = false;
    gOverrideService.rememberValidityOverride(host, port, cert, flags,
        false); // last bit is temporary -- should it be true? XXX
    this._log.warn("!! Overrode bad cert temporarily " + host + " " + port +
                   "flags = " + flags + "\n");
    return true;
  },

  processSSLError : function(socketInfo, status, targetSite)
  {
    this._log.error("got SSL error, please implement the handler!");
    // XXX record that there was an SSL error, and tell the user
    // about it somehow
    // XXX test case?
    // return true if you want to suppress the default PSM dialog
    return false;
  },
}



//////////////////////////////////////////////////////////////////
// Socket Util


/**
 * @param hostname {String} The DNS hostname to connect to.
 * @param port {Integer} The numberic port to connect to on the host.
 * @param ssl {Integer} SSL, TLS or NONE
 * @param commands {Array of String}: protocol commands
 *          to send to the server.
 * @param timeout {Integer} seconds to wait for a server response, then cancel.
 * @param sslErrorHandler {SSLErrorHandler}
 * @param resultCallback {function(wiredata)} This function will
 *            be called with the result string array from the server
 *            or null if no communication occurred.
 * @param errorCallback {function(e)}
 */
function SocketUtil(hostname, port, ssl, commands, timeout,
                    sslErrorHandler, resultCallback, errorCallback)
{
  assert(commands && commands.length, "need commands");

  var index = 0; // commands[index] is next to send to server
  var initialized = false;
  var aborted = false;

  function _error(e)
  {
    if (aborted)
      return;
    aborted = true;
    errorCallback(e);
  }

  function timeoutFunc()
  {
    if (!initialized)
      _error("timeout");
  }

  // In case DNS takes too long or does not resolve or another blocking
  // issue occurs before the timeout can be set on the socket, this
  // ensures that the listener callback will be fired in a timely manner.
  // XXX There might to be some clean up needed after the timeout is fired
  // for socket and io resources.

  // The timeout value plus 2 seconds
  setTimeout(timeoutFunc, (timeout * 1000) + 2000);

  var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                         .getService(Ci.nsISocketTransportService);

  // @see NS_NETWORK_SOCKET_CONTRACTID_PREFIX
  var socketTypeName = ssl == SSL ? "ssl" : (ssl == TLS ? "starttls" : null);
  var transport = transportService.createTransport([socketTypeName],
                                                   ssl == NONE ? 0 : 1,
                                                   hostname, port, null);

  transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_CONNECT, timeout);
  transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_READ_WRITE, timeout);
  try {
    transport.securityCallbacks = new BadCertHandler(sslErrorHandler);
  } catch (e) {
    _error(e);
  }
  var outstream = transport.openOutputStream(0, 0, 0);
  var stream = transport.openInputStream(0, 0, 0);
  var instream = Cc["@mozilla.org/scriptableinputstream;1"]
      .createInstance(Ci.nsIScriptableInputStream);
  instream.init(stream);

  var dataListener =
  {
    data : new Array(),
    onStartRequest: function(request, context)
    {
      try {
        initialized = true;
        if (!aborted)
        {
          // Send the first request
          let outputData = commands[index++];
          outstream.write(outputData, outputData.length);
        }
      } catch (e) { _error(e); }
    },
    onStopRequest: function(request, context, status)
    {
      try {
        instream.close();
        outstream.close();
        resultCallback(this.data.length ? this.data : null);
      } catch (e) { _error(e); }
    },
    onDataAvailable: function(request, context, inputStream, offset, count)
    {
      try {
        if (!aborted)
        {
          let inputData = instream.read(count);
          this.data.push(inputData);
          if (index < commands.length)
          {
            // Send the next request to the server.
            let outputData = commands[index++];
            outstream.write(outputData, outputData.length);
          }
        }
      } catch (e) { _error(e); }
    }
  };

  try {
    var pump = Cc["@mozilla.org/network/input-stream-pump;1"]
        .createInstance(Ci.nsIInputStreamPump);

    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead(dataListener, null);
    return new SocketAbortable(transport);
  } catch (e) { _error(e); }
}

function SocketAbortable(transport)
{
  Abortable.call(this);
  assert(transport instanceof Ci.nsITransport, "need transport");
  this._transport = transport;
}
SocketAbortable.prototype =
{
  cancel : function()
  {
    try {
      this._transport.close(Components.results.NS_ERROR_ABORT);
    } catch (e) {
      ddump("canceling socket failed: " + e);
    }
  }
}
extend(SocketAbortable, Abortable);
