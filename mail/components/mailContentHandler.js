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
 * The Original Code is Mozilla Thunderbird.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

// defined in nsIContentHandler.idl.
const NS_ERROR_WONT_HANDLE_CONTENT = 0x805d0001;

const mch_CID = Components.ID("{1c73f03a-b817-4640-b984-18c3478a9ae3}");
const CONTRACTID_PREFIX = "@mozilla.org/uriloader/content-handler;1?type=";

const CONTENT_TYPES =
  [ "text/html",
    "text/plain"
  ];

var mailContentHandler = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentHandler, Ci.nsIFactory]),

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

var Module = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIModule]),

  getClassObject: function mod_getClassObject(compMgr, cid, iid) {
    if (cid.equals(mch_CID))
      return mailContentHandler.QueryInterface(iid);

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  registerSelf: function mod_registerSelf(compMgr, fileSpec, location, type) {
    var compReg = compMgr.QueryInterface(Ci.nsIComponentRegistrar);

    function registerType(contentType) {
      compReg.registerFactoryLocation(mch_CID,
                                      "mailContentHandler",
                                      CONTRACTID_PREFIX + contentType,
                                      fileSpec, location, type);
    }

    CONTENT_TYPES.forEach(registerType);
  },

  unregisterSelf: function mod_unregisterSelf(compMgr, location, type) {
    compMgr.QueryInterface(Ci.nsIComponentRegistrar)
           .unregisterFactoryLocation(mch_CID, location);
  },

  canUnload: function(compMgr) {
    return true;
  }
};

function NSGetModule(compMgr, fileSpec) {
  return Module;
}
