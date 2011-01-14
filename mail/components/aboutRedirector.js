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
 * The Original Code is about:robots.
 *
 * The Initial Developer of the Original Code is Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ryan Flint <rflint@mozilla.com>
 *   Justin Dolske <dolske@mozilla.com>
 *   Mark Banner <bugzilla@standard8.plus.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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
      let secMan = Cc["@mozilla.org/scriptsecuritymanager;1"]
                     .getService(Ci.nsIScriptSecurityManager);
      let principal = secMan.getCodebasePrincipal(aURI);
      channel.owner = principal;
    }

    return channel;
  }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutRedirector]);
