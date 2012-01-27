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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jonathan Protzenko <jonathan.protzenko@gmail.com>
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

// Why don't people use JSMs? Sigh...
let accountCreationFuncs = {};
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/util.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/accountConfig.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/emailWizard.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/sanitizeDatatypes.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/fetchhttp.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/readFromXML.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/verifyConfig.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/fetchConfig.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/createInBackend.js", accountCreationFuncs);
Services.scriptloader.loadSubScript("chrome://messenger/content/accountcreation/MyBadCertHandler.js", accountCreationFuncs);

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

    if (contentType.toLowerCase().indexOf("text/xml") != 0)
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
    try {
      // Attempt to construct the downloaded data into XML
      let data = this.chunks.join("");
      let xml = new XML(data);

      // Attempt to derive email account information
      let accountConfig = accountCreationFuncs.readFromXML(xml);
      accountCreationFuncs.replaceVariables(accountConfig,
        this.params.realName,
        this.params.email);
      let account = accountCreationFuncs.createAccountInBackend(accountConfig);

      // Switch to the mail tab
      let tabmail = document.getElementById('tabmail');
      tabmail.switchToTab(0);

      // Find the tab associated with this browser, and close it.
      let myTabInfo = tabmail.tabInfo
        .filter((function (x) {
              return "browser" in x && x.browser == this.browser;
              }).bind(this))[0];
      tabmail.closeTab(myTabInfo);

      // Respawn the account provisioner to announce our success
      NewMailAccountProvisioner(null, {
        success: true,
        search_engine: this.params.searchEngine,
        account: account,
      });
    } catch (e) {
      // Something went wrong.  Right now, we just dump the problem out
      // to the Error Console.  We should really do something smarter and
      // more user-facing, because if - for example - a provider passes
      // some bogus XML, this routine silently fails.
      Components.utils.reportError("Problem interpreting provider XML:" + e);
    }

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
