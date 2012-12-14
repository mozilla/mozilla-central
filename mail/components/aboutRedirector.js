/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function AboutRedirector() {}
AboutRedirector.prototype = {
  classDescription: "Mail about: Redirector",
  classID: Components.ID("{8cc51368-6aa0-43e8-b762-bde9b9fd828c}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  // Each entry in the map has the key as the part after the "about:" and the
  // value as a record with url and flags entries. Note that each addition here
  // should be coupled with a corresponding addition in mailComponents.manifest.
  _redirMap: {
    "rights": {url: "chrome://messenger/content/aboutRights.xhtml",
               flags: (Ci.nsIAboutModule.ALLOW_SCRIPT |
                       Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT)},
    "support": {url: "chrome://messenger/content/about-support/aboutSupport.xhtml",
                flags: Ci.nsIAboutModule.ALLOW_SCRIPT},
  },

  /**
   * Gets the module name from the given URI.
   */
  _getModuleName: function AboutRedirector__getModuleName(aURI) {
    // Strip out the first ? or #, and anything following it
    let name = (/[^?#]+/.exec(aURI.path))[0];
    return name.toLowerCase();
  },

  getURIFlags: function(aURI) {
    let name = this._getModuleName(aURI);
    if (!(name in this._redirMap))
      throw Components.results.NS_ERROR_ILLEGAL_VALUE;
    return this._redirMap[name].flags;
  },

  newChannel: function(aURI) {
    let name = this._getModuleName(aURI);
    if (!(name in this._redirMap))
      throw Components.results.NS_ERROR_ILLEGAL_VALUE;

    let channel = Services.io.newChannel(this._redirMap[name].url, null, null);
    channel.originalURI = aURI;

    if (this._redirMap[name].flags & Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT) {
      let principal = Services.scriptSecurityManager.getNoAppCodebasePrincipal(aURI);
      channel.owner = principal;
    }

    return channel;
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutRedirector]);
