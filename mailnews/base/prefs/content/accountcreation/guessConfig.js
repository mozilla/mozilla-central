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

Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource://gre/modules/Services.jsm");

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
 * @param resultConfig {AccountConfig} (optional)
 *   A config which may be partially filled in. If so, it will be used as base
 *   for the guess.
 * @param which {String-enum} (optional)  "incoming", "outgoing", or "both".
 *   Default "both". Whether to guess only the incoming or outgoing server.
 * @result {Abortable} Allows you to cancel the guess
 */
function guessConfig(domain, progressCallback, successCallback, errorCallback,
                     resultConfig, which)
{
  assert(typeof(progressCallback) == "function", "need progressCallback");
  assert(typeof(successCallback) == "function", "need successCallback");
  assert(typeof(errorCallback) == "function", "need errorCallback");
  if (!resultConfig)
    resultConfig = new AccountConfig();
  resultConfig.source = AccountConfig.kSourceGuess;

  var incomingHostDetector = null;
  var outgoingHostDetector = null;
  var incomingEx = null; // if incoming had error, store ex here
  var outgoingEx = null; // if incoming had error, store ex here
  var incomingDone = (which == "outgoing");
  var outgoingDone = (which == "incoming");
  // If we're offline, we're going to pick the most common settings.
  // (Not the "best" settings, but common).
  if (Services.io.offline)
  {
    resultConfig.source = AccountConfig.kSourceUser;
    resultConfig.incoming.hostname = "mail." + domain;
    resultConfig.incoming.username = resultConfig.identity.emailAddress;
    resultConfig.outgoing.username = resultConfig.identity.emailAddress;
    resultConfig.incoming.type = "imap";
    resultConfig.incoming.port = 143;
    resultConfig.incoming.socketType = 3; // starttls
    resultConfig.incoming.auth = Ci.nsMsgAuthMethod.passwordCleartext;
    resultConfig.outgoing.hostname = "smtp." + domain;
    resultConfig.outgoing.socketType = 1;
    resultConfig.outgoing.port = 587;
    resultConfig.outgoing.auth = Ci.nsMsgAuthMethod.passwordCleartext;
    resultConfig.incomingAlternatives.push({
      hostname: "mail." + domain,
      username: resultConfig.identity.emailAddress,
      type: "pop3",
      port: 110,
      socketType: 3,
      auth: Ci.nsMsgAuthMethod.passwordCleartext
    });
    successCallback(resultConfig);
    return;
  }
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

  var errorInCallback = function(e)
  {
    // The caller's errorCallback threw.
    // hopefully shouldn't happen for users.
    alertPrompt("Error in errorCallback for guessConfig()", e);
  };

  var checkDone = function()
  {
    if (incomingEx)
    {
      try {
        errorCallback(incomingEx, resultConfig);
      } catch (e) { errorInCallback(e); }
      return;
    }
    if (outgoingEx)
    {
      try {
        errorCallback(outgoingEx, resultConfig);
      } catch (e) { errorInCallback(e); }
      return;
    }
    if (incomingDone && outgoingDone)
    {
      try {
        successCallback(resultConfig);
      } catch (e) {
        try {
          errorCallback(e);
        } catch (e) { errorInCallback(e); }
      }
      return;
    }
  };

  var logger = Log4Moz.getConfiguredLogger("mail.wizard");
  var HostTryToAccountServer = function(thisTry, server)
  {
    server.type = protocolToString(thisTry.protocol);
    server.hostname = thisTry.hostname;
    server.port = thisTry.port;
    server.socketType = sslConvertToSocketType(thisTry.ssl);
    server.auth = chooseBestAuthMethod(thisTry.authMethods);
    server.authAlternatives = thisTry.authMethods;
    // TODO
    // cert is also bad when targetSite is set. (Same below for incoming.)
    // Fix SSLErrorHandler and security warning dialog in emailWizard.js.
    server.badCert = thisTry.selfSignedCert;
    server.targetSite = thisTry.targetSite;
    logger.info("CHOOSING " + server.type + " "+ server.hostname + ":" +
          server.port + ", auth method " + server.auth + " " +
          server.authAlternatives.join(",") + ", SSL " + server.socketType +
          (server.badCert ? " (bad cert!)" : ""));
  };

  var outgoingSuccess = function(thisTry, alternativeTries)
  {
    assert(thisTry.protocol == SMTP, "I only know SMTP for outgoing");
    // Ensure there are no previously saved outgoing errors, if we've got
    // success here.
    outgoingEx = null;
    HostTryToAccountServer(thisTry, resultConfig.outgoing);

    for each (let alternativeTry in alternativeTries)
    {
      // resultConfig.createNewOutgoing(); misses username etc., so copy
      let altServer = deepCopy(resultConfig.outgoing);
      HostTryToAccountServer(alternativeTry, altServer);
      assert(resultConfig.outgoingAlternatives);
      resultConfig.outgoingAlternatives.push(altServer);
    }

    progressCallback(resultConfig.outgoing.type,
        resultConfig.outgoing.hostname, resultConfig.outgoing.port,
        resultConfig.outgoing.socketType, true, resultConfig);
    outgoingDone = true;
    checkDone();
  };

  var incomingSuccess = function(thisTry, alternativeTries)
  {
    // Ensure there are no previously saved incoming errors, if we've got
    // success here.
    incomingEx = null;
    HostTryToAccountServer(thisTry, resultConfig.incoming);

    for each (let alternativeTry in alternativeTries)
    {
      // resultConfig.createNewIncoming(); misses username etc., so copy
      let altServer = deepCopy(resultConfig.incoming);
      HostTryToAccountServer(alternativeTry, altServer);
      assert(resultConfig.incomingAlternatives);
      resultConfig.incomingAlternatives.push(altServer);
    }

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
    incomingHostDetector.cancel(new CancelOthersException());
    outgoingHostDetector.cancel(new CancelOthersException());
  };

  var outgoingError = function(ex)
  {
    outgoingEx = ex;
    checkDone();
    incomingHostDetector.cancel(new CancelOthersException());
    outgoingHostDetector.cancel(new CancelOthersException());
  };

  incomingHostDetector = new IncomingHostDetector(progress, incomingSuccess,
                                                  incomingError);
  outgoingHostDetector = new OutgoingHostDetector(progress, outgoingSuccess,
                                                  outgoingError);
  if (which == "incoming" || which == "both")
  {
    incomingHostDetector.start(resultConfig.incoming.hostname ?
            resultConfig.incoming.hostname : domain,
        !!resultConfig.incoming.hostname, resultConfig.incoming.type,
        resultConfig.incoming.port, resultConfig.incoming.socketType);
  }
  if (which == "outgoing" || which == "both")
  {
    outgoingHostDetector.start(resultConfig.outgoing.hostname ?
            resultConfig.outgoing.hostname : domain,
        !!resultConfig.outgoing.hostname, "smtp",
        resultConfig.outgoing.port, resultConfig.outgoing.socketType);
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
  cancel : function(ex)
  {
    this._incomingHostDetector.cancel(ex);
    this._outgoingHostDetector.cancel(ex);
  },
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
 * When the success or errorCallbacks are called to abort the other requests
 * which happened in parallel, this ex is used as param for cancel(), so that
 * the cancel doesn't trigger another callback.
 */
function CancelOthersException()
{
  CancelledException.call(this, "we're done, cancelling the other probes");
}
CancelOthersException.prototype = {}
extend(CancelOthersException, CancelledException);

/**
 * @param successCallback {function(result {HostTry}, alts {Array of HostTry})}
 *    Called when the config is OK
 *    |result| is the most preferred server.
 *    |alts| currently exists only for |IncomingHostDetector| and contains
 *    some servers of the other type (POP3 instead of IMAP), if available.
 * @param errorCallback {function(ex)} Called when we could not find a config
 * @param progressCallback { function(server {HostTry}) } Called when we tried
 *    (will try?) a new hostname and port
 */
function HostDetector(progressCallback, successCallback, errorCallback)
{
  this.mSuccessCallback = successCallback;
  this.mProgressCallback = progressCallback;
  this.mErrorCallback = errorCallback;
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
        thisTry.abortable.cancel(ex);
      thisTry.status = kFailed; // or don't set? Maybe we want to continue.
    }
    if (ex instanceof CancelOthersException)
      return;
    if (!ex)
      ex = new CancelledException();
    this.mErrorCallback(ex);
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
    if (thisTry._gotCertError)
    {
      this._log.info("clearing validity override for " + thisTry.hostname);
      Cc["@mozilla.org/security/certoverride;1"]
        .getService(Ci.nsICertOverrideService)
        .clearValidityOverride(thisTry.hostname, thisTry.port);
    }
    if (thisTry._gotCertError == Ci.nsICertOverrideService.ERROR_MISMATCH)
    {
      thisTry._gotCertError = false;
      thisTry.status = kFailed;
      return;
    }

    if (thisTry._gotCertError == Ci.nsICertOverrideService.ERROR_UNTRUSTED ||
        thisTry._gotCertError == Ci.nsICertOverrideService.ERROR_TIME)
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
    this._log.info("success with " + thisTry.hostname + ":" +
        thisTry.port + " " + protocolToString(thisTry.protocol) +
        " ssl " + thisTry.ssl +
        (thisTry.selfSignedCert ? " (selfSignedCert)" : ""));
    thisTry.status = kSuccess;
  },

  _checkFinished : function()
  {
    var successfulTry = null;
    var successfulTryAlternative = null; // POP3
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
        if (!successfulTry)
        {
          successfulTry = thisTry;
          if (successfulTry.protocol == SMTP)
            break;
        }
        else if (successfulTry.protocol != thisTry.protocol)
        {
          successfulTryAlternative = thisTry;
          break;
        }
      }
    }
    if (successfulTry && (successfulTryAlternative || !unfinishedBusiness))
    {
      this.mSuccessCallback(successfulTry,
          successfulTryAlternative ? [ successfulTryAlternative ] : []);
      this.cancel(new CancelOthersException());
    }
    else if (!unfinishedBusiness) // all failed
    {
      this._log.info("ran out of options");
      var errorMsg = getStringBundle(
          "chrome://messenger/locale/accountCreationModel.properties")
          .GetStringFromName("cannot_find_server.error");
      this.mErrorCallback(new Exception(errorMsg));
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
              //getHostEntry(protocol, SSL, port),
              getHostEntry(protocol, NONE, port)];
    return [getHostEntry(protocol, ssl, port)];
  }
  if (ssl == UNKNOWN)
    return [getHostEntry(IMAP, TLS, port),
            //getHostEntry(IMAP, SSL, port),
            getHostEntry(POP, TLS, port),
            //getHostEntry(POP, SSL, port),
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
              //getHostEntry(SMTP, SSL, UNKNOWN),
              getHostEntry(SMTP, NONE, UNKNOWN),
              getHostEntry(SMTP, NONE, 25)];
    // port known, SSL not
    return [getHostEntry(SMTP, TLS, port),
            //getHostEntry(SMTP, SSL, port),
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
    this._log.error("Got Cert error for "+ targetSite);

    if (!status)
      return true;

    let cert = status.QueryInterface(Ci.nsISSLStatus).serverCert;
    let flags = 0;

    let parts = targetSite.split(":");
    let host = parts[0];
    let port = parts[1];

    /* The following 2 cert problems are unfortunately common:
     * 1) hostname mismatch:
     * user is custeromer at a domain hoster, he owns yourname.org,
     * and the IMAP server is imap.hoster.com (but also reachable as
     * imap.yourname.org), and has a cert for imap.hoster.com.
     * 2) self-signed:
     * a company has an internal IMAP server, and it's only for
     * 30 employees, and they didn't want to buy a cert, so
     * they use a self-signed cert.
     *
     * We would like the above to pass, somehow, with user confirmation.
     * The following case should *not* pass:
     *
     * 1) MITM
     * User has @gmail.com, and an attacker is between the user and
     * the Internet and runs a man-in-the-middle (MITM) attack.
     * Attacker controls DNS and sends imap.gmail.com to his own
     * imap.attacker.com. He has either a valid, CA-issued
     * cert for imap.attacker.com, or a self-signed cert.
     * Of course, attacker.com could also be legit-sounding gmailservers.com.
     *
     * What makes it dangerous is that we (!) propose the server to the user,
     * and he cannot judge whether imap.gmailservers.com is correct or not,
     * and he will likely approve it.
     */

    if (status.isDomainMismatch) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_MISMATCH;
      flags |= Ci.nsICertOverrideService.ERROR_MISMATCH;
    }
    else if (status.isUntrusted) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_UNTRUSTED;
      flags |= Ci.nsICertOverrideService.ERROR_UNTRUSTED;
    }
    else if (status.isNotValidAtThisTime) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_TIME;
      flags |= Ci.nsICertOverrideService.ERROR_TIME;
    }
    else {
      this._try._gotCertError = -1; // other
    }

    /* We will add a temporary cert exception here, so that
     * we can continue and connect and try.
     * But we will remove it again as soon as we close the
     * connection, in _processResult().
     * _gotCertError will serve as the marker that we
     * have to clear the override later.
     *
     * In verifyConfig(), before we send the password, we *must*
     * get another cert exception, this time with dialog to the user
     * so that he gets informed about this and can make a choice.
     */

    this._try.targetSite = targetSite;
    Cc["@mozilla.org/security/certoverride;1"]
      .getService(Ci.nsICertOverrideService)
      .rememberValidityOverride(host, port, cert, flags,
        true); // temporary override
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
  cancel : function(ex)
  {
    try {
      this._transport.close(Components.results.NS_ERROR_ABORT);
    } catch (e) {
      ddump("canceling socket failed: " + e);
    }
  }
}
extend(SocketAbortable, Abortable);
