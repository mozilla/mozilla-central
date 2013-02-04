/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This object takes care of intercepting page loads and creating the
 * corresponding account if the page load turns out to be a text/xml file from
 * one of our account providers.
 */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;
let Cr = Components.results;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/JXON.js");

/**
 * This is an observer that watches all HTTP requests for one where the
 * response contentType contains text/xml.  Once that observation is
 * made, we ensure that the associated window for that request matches
 * the window belonging to the content tab for the account order form.
 * If so, we attach an nsITraceableListener to read the contents of the
 * request response, and react accordingly if the contents can be turned
 * into an email account.
 *
 * @param aBrowser The XUL <browser> the request lives in.
 * @param aParams An object containing various bits of information.
 * @param aParams.realName The real name of the person
 * @param aParams.email The email address the person picked.
 * @param aParams.searchEngine The search engine associated to that provider.
 */
function httpRequestObserver(aBrowser, aParams) {
  this.browser = aBrowser;
  this.params = aParams;
}

httpRequestObserver.prototype = {
  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "http-on-examine-response")
      return;

    if (!(aSubject instanceof Ci.nsIHttpChannel)) {
      Component.utils.reportError("Failed to get a nsIHttpChannel when "
                                  + "observing http-on-examine-response");
      return;
    }

    let contentType = "";
    try {
      contentType = aSubject.getResponseHeader("Content-Type");
    } catch(e) {
      // If we couldn't get the response header, which can happen,
      // just swallow the exception and return.
      return;
    }

    if (!contentType.toLowerCase().startsWith("text/xml"))
      return;

    let requestWindow = this._getWindowForRequest(aSubject);
    if (!requestWindow || (requestWindow !== this.browser.contentWindow))
      return;

    // Ok, we've got a request that looks like a decent candidate.
    // Let's attach our TracingListener.
    if (aSubject instanceof Ci.nsITraceableChannel) {
      let newListener = new TracingListener(this.browser, this.params);
      newListener.oldListener = aSubject.setNewListener(newListener);
    }
  },

  /**
   * _getWindowForRequest is an internal function that takes an nsIRequest,
   * and returns the associated window for that request.  If it cannot find
   * an associated window, the function returns null. On exception, the
   * exception message is logged to the Error Console and null is returned.
   *
   * @param aRequest the nsIRequest to analyze
   */
  _getWindowForRequest: function(aRequest) {
    try {
      if (aRequest && aRequest.notificationCallbacks) {
        return aRequest.notificationCallbacks
                       .getInterface(Ci.nsILoadContext)
                       .associatedWindow;
      }
      if (aRequest && aRequest.loadGroup
          && aRequest.loadGroup.notificationCallbacks) {
        return aRequest.loadGroup
                       .notificationCallbacks
                       .getInterface(Ci.nsILoadContext)
                       .associatedWindow;
      }
    } catch(e) {
      Components.utils.reportError("Could not find an associated window "
                                   + "for an HTTP request. Error: " + e);
    }
    return null;
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
}

/**
 * TracingListener is an nsITracableChannel implementation that copies
 * an incoming stream of data from a request.  The data flows through this
 * nsITracableChannel transparently to the original listener. Once the
 * response data is fully downloaded, an attempt is made to parse it
 * as XML, and derive email account data from it.
 *
 * @param aBrowser The XUL <browser> the request lives in.
 * @param aParams An object containing various bits of information.
 * @param aParams.realName The real name of the person
 * @param aParams.email The email address the person picked.
 * @param aParams.searchEngine The search engine associated to that provider.
 */
function TracingListener(aBrowser, aParams) {
  this.chunks = [];
  this.browser = aBrowser;
  this.params = aParams;
  this.oldListener = null;
}

TracingListener.prototype = {

  onStartRequest: function (/* nsIRequest */ aRequest,
                            /* nsISupports */ aContext) {
    this.oldListener.onStartRequest(aRequest, aContext);
  },

  onStopRequest: function (/* nsIRequest */ aRequest,
                           /* nsISupports */ aContext,
                           /* int */ aStatusCode) {

    // Why don't people use JSMs? Sigh...
    let accountCreationFuncs = {};
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/util.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/accountConfig.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/emailWizard.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/sanitizeDatatypes.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/fetchhttp.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
     "chrome://messenger/content/accountcreation/readFromXML.js",
     accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/verifyConfig.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/fetchConfig.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/createInBackend.js",
      accountCreationFuncs);
    Services.scriptloader.loadSubScript(
      "chrome://messenger/content/accountcreation/MyBadCertHandler.js",
      accountCreationFuncs);

    let tabmail = document.getElementById('tabmail');
    let success = false;
    let account;

    try {
      // Attempt to construct the downloaded data into XML
      let data = this.chunks.join("");

      // Attempt to derive email account information
      let domParser = Cc["@mozilla.org/xmlextras/domparser;1"]
                       .createInstance(Ci.nsIDOMParser);
      let accountConfig = accountCreationFuncs.readFromXML(JXON.build(
        domParser.parseFromString(data, "text/xml")));
      accountCreationFuncs.replaceVariables(accountConfig,
                                            this.params.realName,
                                            this.params.email);
      account = accountCreationFuncs.createAccountInBackend(accountConfig);
      success = true;
    } catch (e) {
      // Something went wrong with account set up. Dump the error out to the
      // error console. The tab will be closed, and the Account Provisioner
      // tab will be reopened.
      Components.utils.reportError("Problem interpreting provider XML:" + e);
    }

    tabmail.switchToTab(0);

    // Find the tab associated with this browser, and close it.
    let myTabInfo = tabmail.tabInfo
      .filter((function (x) {
            return "browser" in x && x.browser == this.browser;
            }).bind(this))[0];
    tabmail.closeTab(myTabInfo);

    // Respawn the account provisioner to announce our success
    NewMailAccountProvisioner(null, {
      success: success,
      search_engine: this.params.searchEngine,
      account: account,
    });

    this.oldListener.onStopRequest(aRequest, aContext, aStatusCode);
  },

  onDataAvailable: function (/* nsIRequest */ aRequest,
                             /* nsISupports */ aContext,
                             /* nsIInputStream */ aStream,
                             /* int */ aOffset,
                             /* int */ aCount) {
    // We want to read the stream of incoming data, but we also want
    // to make sure it gets passed to the original listener. We do this
    // by passing the input stream through an nsIStorageStream, writing
    // the data to that stream, and passing it along to the next listener.
    let binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
                           .createInstance(Ci.nsIBinaryInputStream);
    let storageStream = Cc["@mozilla.org/storagestream;1"]
                        .createInstance(Ci.nsIStorageStream);
    let outStream = Cc["@mozilla.org/binaryoutputstream;1"]
                    .createInstance(Ci.nsIBinaryOutputStream);

    binaryInputStream.setInputStream(aStream);

    // The segment size of 8192 is a little magical - more or less
    // copied from nsITraceableChannel example code strewn about the
    // web.
    storageStream.init(8192, aCount, null);
    outStream.setOutputStream(storageStream.getOutputStream(0));

    let data = binaryInputStream.readBytes(aCount);
    this.chunks.push(data);

    outStream.writeBytes(data, aCount);
    this.oldListener.onDataAvailable(aRequest, aContext,
                                     storageStream.newInputStream(0),
                                     aOffset, aCount);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener,
                                         Ci.nsIRequestObserver])

}
