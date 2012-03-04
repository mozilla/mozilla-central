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
 * The Original Code is the nsSessionStore component.
 *
 * The Initial Developer of the Original Code is
 * Simon Bünzli <zeniko@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
Components.utils.import("resource://gre/modules/Services.jsm");

const SCRIPT = Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
const UNTRUSTED = Components.interfaces.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
const HIDE = Components.interfaces.nsIAboutModule.HIDE_FROM_ABOUTABOUT;

function About() { }
About.prototype = {
  Flags: SCRIPT,
  URI: "chrome://communicator/content/about.xhtml",
  certerrorFlags: SCRIPT | UNTRUSTED | HIDE,
  certerrorURI: "chrome://communicator/content/certError.xhtml",
  dataFlags: SCRIPT,
  dataURI: "chrome://communicator/content/dataman/dataman.xul",
  feedsFlags: SCRIPT | UNTRUSTED | HIDE,
  feedsURI: "chrome://communicator/content/feeds/subscribe.xhtml",
  lifeFlags: SCRIPT | HIDE,
  lifeURI: "chrome://communicator/content/aboutLife.xhtml",
  rightsFlags: SCRIPT | UNTRUSTED,
  rightsURI: "chrome://branding/content/aboutRights.xhtml",
  sessionrestoreFlags: SCRIPT | HIDE,
  sessionrestoreURI: "chrome://communicator/content/aboutSessionRestore.xhtml",
  synctabsFlags: SCRIPT,
  synctabsURI: "chrome://communicator/content/aboutSyncTabs.xul",

  classID: Components.ID("{d54f2c89-8fd6-4eeb-a7a4-51d4dcdf460f}"),
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return this[aURI.path.replace(/-|\W.*$/g, "").toLowerCase() + "Flags"];
  },

  newChannel: function(aURI) {
    var module = aURI.path.replace(/-|\W.*$/g, "").toLowerCase();
    var channel = Services.io.newChannel(this[module + "URI"], null, null);
    channel.originalURI = aURI;
    if (this[module + "Flags"] & UNTRUSTED)
      channel.owner = Services.scriptSecurityManager.getCodebasePrincipal(aURI);
    return channel;
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([About]);
