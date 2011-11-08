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
 * This is a listener that will take care of intercepting the right request and
 * creating the account accordingly.
 *
 * @param aBrowser The XUL <browser> the request lives in.
 * @param aParams An object containing various bits of information.
 * @param aParams.realName The real name of the person
 * @param aParams.email The email address the person picked.
 * @param aParams.searchEngine The search engine associated to that provider.
 */
function AccountProvisionerListener (aBrowser, aParams) {
  this.browser = aBrowser;
  this.params = aParams;
}

AccountProvisionerListener.prototype = {
  onStateChange: function (/* in nsIWebProgress */ aWebProgress,
                           /* in nsIRequest */ aRequest,
                           /* in unsigned long */ aStateFlags,
                           /* in nsresult */ aStatus) {
    // This is the earliest notification we get...
    if ((aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) &&
        (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_WINDOW)) {
      let channel = aRequest.QueryInterface(Ci.nsIHttpChannel);
      let contentType = channel.getResponseHeader("Content-Type");
      if (contentType == "text/xml") {
        // Stop the request so that the user doesn't see the XML, and close the
        // content tab while we're at it.
        this.browser.stop();
        let tabmail = window.document.getElementById("tabmail");
        let myTabInfo = tabmail.tabInfo
          .filter((function (x) x.browser == this.browser).bind(this))[0];
        tabmail.closeTab(myTabInfo);

        // Fire off a request to get the XML again, this time so that we can
        // analyze it and get its contents.
        aRequest.QueryInterface(Ci.nsIChannel);
        let url = aRequest.URI;
        let newChannel = NetUtil.newChannel(url);
        let chunks = [];
        let self = this;
        let inputStream = newChannel.asyncOpen({

          onStartRequest: function (/* nsIRequest */ aRequest,
                                    /* nsISupports */ aContext) {
          },

          onStopRequest: function (/* nsIRequest */ aRequest,
                                   /* nsISupports */ aContext,
                                   /* int */ aStatusCode) {
            try {
              let data = chunks.join("");
              let xml = new XML(data);
              let accountConfig = accountCreationFuncs.readFromXML(xml);
              accountCreationFuncs.replaceVariables(accountConfig,
                self.params.realName,
                self.params.email);
              accountCreationFuncs.createAccountInBackend(accountConfig);
              NewMailAccountProvisioner(null, {
                success: true,
                search_engine: self.params.searchEngine,
              });
            } catch (e) {
              Components.utils.reportError(e);
            }
          },

          onDataAvailable: function (/* nsIRequest */ aRequest,
                                     /* nsISupports */ aContext,
                                     /* nsIInputStream */ aStream,
                                     /* int */ aOffset,
                                     /* int */ aCount) {
            let str = NetUtil.readInputStreamToString(aStream, aCount);
            chunks.push(str);
          },

          QueryInterface: XPCOMUtils.generateQI([Ci.nsIStreamListener,
                                                 Ci.nsIRequestObserver])

        }, null);
      }
    }
  },

  onProgressChange: function (/* in nsIWebProgress */ aWebProgress,
                              /* in nsIRequest */ aRequest,
                              /* in long */ aCurSelfProgress,
                              /* in long */ aMaxSelfProgress,
                              /* in long */ aCurTotalProgress,
                              /* in long */ aMaxTotalProgress) {
  },

  onLocationChange: function (/* in nsIWebProgress */ aWebProgress,
                              /* in nsIRequest */ aRequest,
                              /* in nsIURI */ aLocation) {
  },

  onStatusChange: function (/* in nsIWebProgress */ aWebProgress,
                            /* in nsIRequest */ aRequest,
                            /* in nsresult */ aStatus,
                            /* in wstring */ aMessage) {
  },

  onSecurityChange: function (/* in nsIWebProgress */ aWebProgress,
                              /* in nsIRequest */ aRequest,
                              /* in unsigned long */ aState) {
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupportsWeakReference,
                                         Ci.nsIWebProgressListener]),
};
