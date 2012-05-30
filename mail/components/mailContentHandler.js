/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

// defined in nsIContentHandler.idl.
const NS_ERROR_WONT_HANDLE_CONTENT = 0x805d0001;

function mailContentHandler() {
}
mailContentHandler.prototype = {
  classID: Components.ID("{1c73f03a-b817-4640-b984-18c3478a9ae3}"),

  _xpcom_factory: {
    createInstance: function mch_factory_ci(outer, iid) {
      if (outer)
        throw Components.results.NS_ERROR_NO_AGGREGATION;
      return gMailContentHandler.QueryInterface(iid);
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentHandler]),

  openInExternal: function mch_OpenInExternal(uri) {
    Cc["@mozilla.org/uriloader/external-protocol-service;1"]
      .getService(Ci.nsIExternalProtocolService)
      .loadUrl(uri);
  },

  // nsIContentHandler

  handleContent: function mch_HandleContent(aContentType, aWindowContext,
                                            aRequest) {
    try {
      if (!Cc["@mozilla.org/webnavigation-info;1"]
             .getService(Ci.nsIWebNavigationInfo)
             .isTypeSupported(aContentType, null))
        throw NS_ERROR_WONT_HANDLE_CONTENT;
    }
    catch (e) {
      throw NS_ERROR_WONT_HANDLE_CONTENT;
    }

    aRequest.QueryInterface(Ci.nsIChannel);

    // For internal protocols (e.g. imap, mailbox, mailto), we want to handle
    // them internally as we know what to do. For http and https we don't
    // actually deal with external windows very well, so we redirect them to
    // the external browser.
    if (!aRequest.URI.schemeIs("http") && !aRequest.URI.schemeIs("https"))
      throw NS_ERROR_WONT_HANDLE_CONTENT;

    this.openInExternal(aRequest.URI);
    aRequest.cancel(Cr.NS_BINDING_ABORTED);
  },

  // nsIFactory
  createInstance: function mch_CI(outer, iid) {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory: function mch_lock(lock) {
    // No-op.
  }
};
var gMailContentHandler = new mailContentHandler();

const NSGetFactory = XPCOMUtils.generateNSGetFactory([mailContentHandler]);
