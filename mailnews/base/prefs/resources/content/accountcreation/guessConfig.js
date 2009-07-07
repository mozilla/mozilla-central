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
Cu.import("resource://app/modules/gloda/log4moz.js");
Cu.import("resource://gre/modules/autoconfigUtils.jsm");

const TIMEOUT =  10; // in seconds

// This is a bit ugly - we set outgoingDone to false
// when emailWizard.js cancels the outgoing probe because the user picked
// an outoing server. It does this by poking the probeAbortable object,
// so we need outgoingDone to have global scope.
var outgoingDone = false;

/**
 * Try to guess the config, by:
 * - guessing hostnames (pop3.<domain>, pop.<domain>, imap.<domain>,
 *                       mail.<domain> etc.)
 * - probing known ports (143 for IMAP, 110 for POP3, 573 for SMTP, more for SSL)
 * - opening a connection via the right protocol and checking the
 *   protocol-specific CAPABILITIES like that the server returns.
 *
 * Final verification is not done here, but in verifyConfig().
 *
 * This function is async.
 * @param domain {String} the domain part of the email address
 * @param progressCallback {function(type, hostname, port, ssl, done)}
 *   Called when we try a new hostname/port.
 *   type {String-enum} "imap", "pop3", "smtp", like AccountConfig.incoming.type
 *   hostname {String}
 *   port {Integer}
 *   ssl {Integer} 1 = plain, 2 = SSL, 3 = TLS, like
 *       AccountConfig.incoming.socketType:
 *   done {Boolean}   false, if we start probing this host/port, true if we're
 *       done and the host is good.  (there is no notification when a host is
 *       bad, we'll just tell about the next host tried)
 * @param successCallback function(accountConfig)
 *   Called when we could guess the config.
 *   param accountConfig {AccountConfig} The guessed account config.
 *       username, password, realname, emailaddress etc. are not filled out,
 *       but placeholders to be filled out via replaceVariables().
 * @param errorCallback function(ex)
 *   Called when we could guess not the config, either
 *   because we have not found anything or
 *   because there was an error (e.g. no network connection).
 *   The ex.message will contain a user-presentable message.
 * @param incomingErrorCallback function(ex, config)
 *   Like errorCallback, just that we do have a config for the
 *   outgoing server, just not for the incoming server.
 *   This is not terribly useful, because we may have guessed
 *   the MX server (SMTP server for incoming mail from other SMTP servers),
 *   not the outbound SMTP for users.
 *   Showing MX will highly mislead users, so better to treat that as total error.
 * @param outgoingErrorCallback function(ex, config)
 *   Like errorCallback, just that we do have a config for the
 *   incoming server, just not for the outgoing server.
 * @param resultConfig: an AutoConfig object which is most likely partially
 *   filled in.
 * @param which: 'incoming', 'outgoing', or 'both'.
 * @result {Abortable}
 */
function guessConfig(domain, progressCallback, successCallback, errorCallback,
                     incomingErrorCallback, outgoingErrorCallback,
                     resultConfig, which)
{
  resultConfig.source = AccountConfig.kSourceGuess;

  var outgoingHostDetector = null;
  var incomingHostDetector = null;
  var incomingEx = null; // if incoming had error, store ex here
  var outgoingEx = null; // if incoming had error, store ex here
  var incomingDone = false;

  if (which == 'incoming')
    outgoingDone = true;

  if (which == 'outgoing')
    incomingDone = true;

  var progress = function(type, hostname, port, ssl)
  {
    progressCallback(protocolToString(type), hostname, port,
                     sslConvertToSocketType(ssl), false, resultConfig);
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

  var outgoingSuccess = function(type, hostname, port, ssl, secureAuth,
                                  badCert, targetSite)
  {
    assert(type == SMTP, "I only know SMTP for outgoing");
    resultConfig.outgoing.hostname = hostname;
    resultConfig.outgoing.port = port;
    // non-auth smtp servers must be rare at this point.
    resultConfig.outgoing.auth = 1;
    resultConfig.outgoing.socketType = sslConvertToSocketType(ssl);
    resultConfig.outgoing.badCert = badCert;

    progressCallback(protocolToString(type), hostname, port,
                     sslConvertToSocketType(ssl), true, resultConfig);
    outgoingDone = true;
    checkDone();
  };

  var outgoingError = function(ex)
  {
    outgoingEx = ex;
    checkDone();
  };

  var incomingSuccess = function(type, hostname, port, ssl, secureAuth, badCert,
                                 targetSite)
  {
    ddump("incomingSuccess outgoingDone = " + outgoingDone + "\n");
    ddump("incoming success username = " + resultConfig.incoming.username + "\n");
    resultConfig.incoming.hostname = hostname;
    resultConfig.incoming.port = port;
    resultConfig.incoming.type = protocolToString(type);
    resultConfig.incoming.socketType =  sslConvertToSocketType(ssl);
    resultConfig.incoming.badCert = badCert;
    resultConfig.incoming.targetSite = targetSite;
    resultConfig.incoming.auth = secureAuth ? 2 : 1;

    progressCallback(protocolToString(type), hostname, port,
                     sslConvertToSocketType(ssl), true, resultConfig);
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
  if (which == 'incoming' || which == 'both')
  {
    incomingHostDetector.autoDetect(domain,
                                    resultConfig.incoming.hostname ? true : false,
                                    resultConfig.incoming.protocol ? resultConfig.incoming.protocol : undefined,
                                    resultConfig.incoming.port ? resultConfig.incoming.port : undefined,
                                    resultConfig.incoming.socketType ? resultConfig.incoming.socketType : undefined);
  }
  if (which == 'outgoing' || which == 'both')
  {
    outgoingHostDetector.autoDetect(domain,
                                    resultConfig.outgoing.hostname ? true : false,
                                    resultConfig.outgoing.port ? resultConfig.outgoing.port : undefined,
                                    resultConfig.outgoing.socketType ? resultConfig.outgoing.socketType : undefined);
  }

  return new GuessAbortable(incomingHostDetector, outgoingHostDetector,
                            updateConfig);
}

function GuessAbortable(incomingHostDetector, outgoingHostDetector,
                        updateConfig)
{
  this._init(incomingHostDetector, outgoingHostDetector, updateConfig);
}

GuessAbortable.prototype =
{
  _init : function(incomingHostDetector, outgoingHostDetector, updateConfig)
  {
    this._incomingHostDetector = incomingHostDetector;
    this._outgoingHostDetector = outgoingHostDetector;
    this._updateConfig = updateConfig;
  },

  cancel : function(which)
  {
    switch (which)
    {
      case 'incoming':
      default:
        if (this._incomingHostDetector)
          this._incomingHostDetector.cancel();
      case 'outgoing':
        if (which != 'incoming')
        {
          if (this._outgoingHostDetector)
            this._outgoingHostDetector.cancel();

          ddump("setting outgoingDone to true\n");
          outgoingDone = true;
        }
    }
  },

  restart : function(domain, config,
                     which /* 'incoming' or 'outgoing', default to both */,
                     protocol, port, socketType)
  {
    // Calling code may have changed config (e.g., user may have changed
    // username) so put new values in resultConfig.
    this._updateConfig(config);
    switch (which)
    {
      case 'incoming':
        if (this._incomingHostDetector)
        {
          this._incomingHostDetector.cancel();
          this._incomingHostDetector.autoDetect(domain, true, protocol, port, socketType);
        }
        else
        {
          ddump("no incoming host detector!"); // TODO use assert()
        }
        break;
      case 'outgoing':
          if (this._outgoingHostDetector)
          {
            this._outgoingHostDetector.cancel();
            this._outgoingHostDetector.autoDetect(domain, true, port, socketType);
          } else {
            ddump("no outgoing host detector!"); // TODO use assert()
          }
          break
      default: // both
        if (this._incomingHostDetector)
        {
          this._incomingHostDetector.cancel();
          this._incomingHostDetector.autoDetect(domain, true, protocol, port,
                                                socketType);
        }
        if (this._outgoingHostDetector)
        {
          this._outgoingHostDetector.cancel();
          this._outgoingHostDetector.autoDetect(domain, true, port, socketType);
        }
    }
  }
}
extend(GuessAbortable, Abortable);

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

/**
 * @param successCallback {function(type, hostname, port, ssl)} Called when the
 * config is OK
 *    type @see constants above
 *    hostname {String}
 *    port {Integer}
 *    ssl @see constants above
 * @param errorCallback {function(ex)} Called when we could not find a config
 * @param progressCallback { function(hostname, port) } Called when we tried
 *    (will try?) a new hostname and port
 */
function HostDetector(progressCallback, successCallback, errorCallback)
{
  this._init(progressCallback, successCallback, errorCallback);
}

HostDetector.prototype =
{
  _loggerName : "hostdetector",

  _init : function HostDetector_init(progressCallback, successCallback,
                                     errorCallback)
  {
    this.mSuccessCallback = successCallback;
    this.mProgressCallback = progressCallback;
    this.mErrorCallback = errorCallback;
    this._initLogging();
    this._doneFlag = false;
    this._cancel = false;
    this._caller = null;
    this._result = null;
    this._tryIndex = 0;
    this._hostsToTry = new Array;
    this._gotCertError = false;
  },

  _initLogging : function ()
  {
    this._log = Log4Moz.getConfiguredLogger(this._loggerName);
    this._log.info("Initializing " + this._loggerName + ' logger');
  },

  // TODO we could make all host/port combinations run in parallel, store their
  // results in an array, and as soon as one finishes successfully and all
  // higher-priority ones have failed, abort all lower-priority ones.

  _tryNextHost : function()
  {
    if (this._cancel)
      return;

    if (this._hostIndex >= this._hostsToTry.length)
    {
      // Ran out of options.
      this._log.info("ran out of hosts");
      var stringBundle = getStringBundle("chrome://messenger/content/accountCreationModel.properties");
      var errorMsg = stringBundle.GetStringFromName("cannot_find_server.error");
      this.mErrorCallback(new Exception(errorMsg));
      return;
    }
    this._host = this._hostsToTry[this._hostIndex++];
    this._log.info("hostname: " + this._host);
    this._tryHost();
  },

  keepTrying : function()
  {
    if (this._cancel)
        return;
    this._tryIndex++;
    var curTry = this.tryOrder[this._tryIndex];

    if (curTry === undefined) {
      // Ran out of options.
      this._log.info("ran out of tries");
      this._tryNextHost();
      return;
    }

    let curTry = this.tryOrder[this._tryIndex];
    let type = curTry[0];
    let port = curTry[2];
    let ssl = curTry[1];
    this.mProgressCallback(type, this._host, port, ssl);
    this._log.info("poking at " + this._host + " on port " +
                   curTry[2].toString() + " ssl: "+ curTry[1]);

    SocketUtil(this._host, curTry[2], curTry[1] == SSL, curTry[3], TIMEOUT,
               this, this.onResult, this._gotCertError);
  },

  processCertError : function(socketInfo, status, targetSite)
  {
    this._log.warn("Got Cert error for "+ targetSite);

    if (!status)
      return true;

    let cert = status.QueryInterface(Ci.nsISSLStatus).serverCert;
    let flags = 0;

    if (status.isUntrusted)
      flags |= gOverrideService.ERROR_UNTRUSTED;
    if (status.isDomainMismatch)
      flags |= gOverrideService.ERROR_MISMATCH;
    if (status.isNotValidAtThisTime)
      flags |= gOverrideService.ERROR_TIME;

    let parts = targetSite.split(':');
    let host = parts[0];
    let port = parts[1];

    // If domain mismatch, then we shouldn't accept, and instead try the domain
    // in the cert to the list of tries.
    // Not skipping mismatches for now because it's too common, and until we can
    // poke around the cert and find out what domain to try, best to live
    // w/ orange than red.

    this._gotCertError = true;
    this._targetSite = targetSite;
    this._certOverrideProcessed = false;
    gOverrideService.rememberValidityOverride(host, port, cert, flags,
        false); // last bit is temporary -- should it be true? XXX
    this._log.warn("!! Overrode bad cert temporarily " + host + ' ' + port +
                   'flags = ' + flags + '\n');
    return true;
  },

  processSSLError : function(socketInfo, status, targetSite)
  {
    ddump ("got SSL error\n");
    // XXX record that there was an SSL error, and tell the user
    // about it somehow
    // XXX test case?
    // return true if you want to suppress the default PSM dialog
    return false;
  },

  onResult : function(wiredata)
  {
    if (this._cancel) // it's been canceled
      return; // just don't use response nor continue

    if (this._gotCertError)
    {
      this._log.info("TRYING AGAIN, hopefully w/ exception recorded");
      this._tryIndex--; // this will just try same host/port, again
      this._selfSignedCert = true; // _next_ run through
      this._gotCertError = false;
    }

    let curTry = this.tryOrder[this._tryIndex];
    if (curTry === undefined)
    {
      this._log.error("curTry undefined, _tryIndex is " + this._tryIndex);
      return;
    }

    if (wiredata == null || wiredata === undefined)
    {
      this._log.info("no data");
    }
    else
    {
      if (curTry[1] != TLS || this._matchTLS(curTry, wiredata))
      {
        this._log.info("non-null data: " + wiredata.toString());
        let type = curTry[0];
        let port = curTry[2];
        let ssl = curTry[1];
        let secureAuth = this._advertisesSecureAuth(type, wiredata);
        if (this._selfSignedCert)
        {
          // the callback will put up the cert exception dialog, so
          // clear the override here.
          this._log.info("clearing validity override");
          gOverrideService.clearValidityOverride(this._host, curTry[2]);
        }
        this._log.info("SUCCESS, _selfSignedCert = " + this._selfSignedCert);
        this.mSuccessCallback(type, this._host, port, ssl, secureAuth,
                              this._selfSignedCert, this._targetSite);
        return; // stop trying, you're done!
      }
    }

    // report success if you found it.
    this.keepTrying()
  },

  cancel : function()
  {
    this._cancel = true;
    // XXX this is not enough -- we have to actively stop the network calls, as
    // they may result in callbacks e.g. to the cert handler.  If the dialog is
    // gone by the time this happens, the javascript stack is horked.
  },

  _advertisesSecureAuth : function(protocol, capaResponse)
  {
    // for imap to support secure auth,
    // capabilities needs to return 1 or more of the following:
    // "AUTH=CRAM-MD5", "AUTH=NTLM", "AUTH=GSSAPI", "AUTH=MSN"
    // for pop3, the auth mechanisms are returned in capa as the following:
    // "CRAM-MD5", "NTLM", "MSN", "GSSAPI"
    // For smtp, EHLO will return AUTH and then a list of the
    // mechanism(s) supported, e.g.,
    // AUTH LOGIN NTLM MSN CRAM-MD5 GSSAPI
    let line = capaResponse.join("\n")
    if (protocol == POP)
      return /CRAM-MD5|NTLM|MSN|GSSAPI/.test(line);
    if (protocol == IMAP)
      return /AUTH=(CRAM-MD5|NTLM|MSN|GSSAPI)/.test(line);
    if (protocol == SMTP)
      return /AUTH (CRAM-MD5|NTLM|MSN|GSSAPI)/.test(line);
  },

  _matchTLS : function(curTry, result)
  {
      return curTry != null && curTry[1] == TLS &&
             hasTLS(result.join("\n"), curTry[0]);
  }
}

function IncomingHostDetector(progressCallback, successCallback, errorCallback)
{
  this._init(progressCallback, successCallback, errorCallback);
}

IncomingHostDetector.prototype =
{
  __proto__ : new HostDetector(),

  type : 'incoming',

  _loggerName : "incominghostdetector",

  autoDetect : function(host, /* required */
                        hostIsPrecise /* false */,
                        protocol /* UNKNOWN */,
                        port /* UNKNOWN */,
                        socketType /* UNKNOWN */) {
    if (hostIsPrecise === undefined)
      hostIsPrecise = false;
    if (protocol === undefined)
      protocol = UNKNOWN;
    if (port === undefined)
      port = UNKNOWN;
    if (socketType === undefined)
      socketType = UNKNOWN;
    this._cancel = false;

    this._log.info("doing autoDetectIncoming("+host+", "+hostIsPrecise+
                   ", "+protocol+", "+port+")");
    //Strip off any white space
    this.host = host.replace(/\s*/g, "");
    this._hostsToTry = [];
    this._specifiedProtocol = protocol;
    this._specifiedPort = port;
    this._specifiedSSL = ConvertSocketTypeToSSL(socketType);

    // if hostIsPrecise is true, it's because that's what the user input
    // explicitly, and we'll just try it, nothing else.

    if (hostIsPrecise !== undefined && hostIsPrecise == true)
    {
      this._hostsToTry.push(this.host);
    }
    else
    {
      if (this._specifiedProtocol != POP)
        this._hostsToTry.push("imap." +  this.host);
      if (this._specifiedProtocol != IMAP)
      {
        this._hostsToTry.push("pop3." +  this.host);
        this._hostsToTry.push("pop." +  this.host);
      }
      this._hostsToTry.push("mail." + this.host);
      this._hostsToTry.push(this.host);
    }
    this._hostIndex = 0;
    this._tryNextHost();
  },

  _tryHost : function() {
    // If the protocol was specified, trust that.
    // Same for the port number.
    // Ditto for the socketType.
    // Otherwise, if the hostname starts with pop try POP3 protocols first,
    // otherwise check IMAP4 protocols first.

    this.tryOrder = getIncomingTryOrder(this._host, this._specifiedProtocol,
                                        this._specifiedSSL,
                                        this._specifiedPort);
    this._tryIndex = -1;
    this.keepTrying();
  }
}

function OutgoingHostDetector(progressCallback, successCallback, errorCallback)
{
  this._init(progressCallback, successCallback, errorCallback);
}
OutgoingHostDetector.prototype =
{
  __proto__: new HostDetector(),

  type: 'outgoing',

  _loggerName : "outgoinghostdetector",

  autoDetect : function(host, /* required */
                        hostIsPrecise /* false */,
                        port /* UNKNOWN */,
                        socketType /* UNKNOWN */)
  {
    if (hostIsPrecise === undefined)
      hostIsPrecise = false;
    if (port === undefined)
      port = UNKNOWN;

    this._log.info("doing autoDetectOutgoing(" + host + ", " + hostIsPrecise +
                   ", " + "port = " + port + ")");
    //Strip off any white space
    this.host = host.replace(/\s*/g, "");
    this._hostsToTry = [];
    this._cancel = false;
    this._specifiedPort = port;
    this._specifiedSocketType = socketType;
    this._hostsToTry = [];
    if (hostIsPrecise)
    {
      this._hostsToTry.push(this.host);
    }
    else
    {
      this._hostsToTry.push("smtp." + this.host);
      this._hostsToTry.push("mail." +  this.host);
      this._hostsToTry.push(this.host);
    }
    this._hostIndex = 0;
    this._tryNextHost();
  },

  _tryHost : function()
  {
    this.tryOrder = getOutgoingTryOrder(this._specifiedPort)
    this._tryIndex = -1;
    this.keepTrying();
  }
}

function hasTLS(line, type)
{
  return line.indexOf(type != POP ? "STARTTLS" : "STLS") != -1;
}

function SocketUtil(host, port, useSSL, protocolData, timeout, listener, scope,
                    clearoverride)
{
  //
  // @host: The DNS hostname to connect to.
  // @port: The numberic port to connect to on the host.
  // @useSSL: Boolean flag indicating whether the connection should be
  //          made with a Secure Socket Layer.
  // @protocolData: An Array of protocol specific strings to send to the
  //                server.
  // @timeout: The timeout value in seconds between server responses.
  // @callback: An object implementing an onResult function. This will
  //            be called with the result string array from the server
  //            or null if no communication occurred.
  //            ie. var cb = {
  //                     onResult: function(result) {
  //                              doSomething();
  //                         }
  //                  };
  //
  var fired = false;

  function callListener(result)
  {
    if (fired)
      return;

    scope.call(listener, result);
    fired = true;
  }

  // Very basic error checking.
  if (!protocolData || !protocolData.length)
  {
    callListener(null);
    return;
  }

  try
  {
    // The current index in the protocolData Array
    var index = 0;
    var initialized = false;

    function timeoutFunc()
    {
       if (!initialized)
         callListener(null);
    }

    //In case DNS takes too long or does not resolve or another blocking
    // issue occurs before the timeout can be set on the socket, this
    // ensures that the listener callback will be fired in a timely manner.
    // XXX There might to be some clean up needed after the timeout is fired
    // for socket and io resources.

     //The timeout value plus 2 seconds
    setTimeout(timeoutFunc, (timeout * 1000) + 2000);

    var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                           .getService(Ci.nsISocketTransportService);

    var transport = transportService.createTransport(useSSL ? ['ssl'] : null,
                                                     useSSL ? 1 : 0, host,
                                                     port, null);

    transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_CONNECT, timeout);
    transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_READ_WRITE, timeout);
    try {
      transport.securityCallbacks = new BadCertHandler(listener);
    } catch (e) {
      // XXX TODO FIXME
      alert(e);
    }
    var outstream = transport.openOutputStream(0,0,0);
    var stream = transport.openInputStream(0,0,0);
    var instream = Cc["@mozilla.org/scriptableinputstream;1"]
                   .createInstance(Ci.nsIScriptableInputStream);
    instream.init(stream);

    var dataListener =
    {
      data : new Array(),
      onStartRequest: function(request, context)
      {
        initialized = true;
        if (!fired)
        {
          //Send the first request
          let outputData = protocolData[index++];
          outstream.write(outputData, outputData.length);
        }
      },
      onStopRequest: function(request, context, status)
      {
        instream.close();
        outstream.close();
        callListener(this.data.length ? this.data : null);
      },
      onDataAvailable: function(request, context, inputStream, offset, count)
      {
        if (!fired)
        {
          let inputData = instream.read(count);
          this.data.push(inputData);
          if (index < protocolData.length)
          {
            //Send the next request to the server.
            let outputData = protocolData[index++];
            outstream.write(outputData, outputData.length);
          }
        }
      }
    };
    var pump = Cc["@mozilla.org/network/input-stream-pump;1"]
               .createInstance(Ci.nsIInputStreamPump);

    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead(dataListener, null);
   }
   catch (ex)
   {
    callListener(null);
    ddump(ex);
   }
   return null;
}
