/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
      channel.owner = null;
    return channel;
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([About]);
