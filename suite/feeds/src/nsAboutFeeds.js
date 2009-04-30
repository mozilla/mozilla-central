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
 * The Original Code is the SeaMonkey internet suite code.
 *
 * The Initial Developer of the Original Code is
 * Caio Tiago Oliveira <asrail@gmail.com>
 *
 * Portions created by the Initial Developer are Copyright (C) 2009
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

const ABOUTFEEDS_URI = "chrome://communicator/content/feeds/subscribe.xhtml";
const ABOUTFEEDS_CONTRACTID = "@mozilla.org/network/protocol/about;1?what=feeds";
const ABOUTFEEDS_CLASSNAME = "About Feeds Page";
const ABOUTFEEDS_CLASSID = Components.ID("{f3487aac-65a0-4101-88a4-f7450c231351}");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutFeeds() {
}

AboutFeeds.prototype = {
  classDescription: ABOUTFEEDS_CLASSNAME,
  contractID: ABOUTFEEDS_CONTRACTID,
  classID: ABOUTFEEDS_CLASSID,
  implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
  QueryInterface: XPCOMUtils.generateQI(
    [Components.interfaces.nsIAboutModule,
    Components.interfaces.nsISupports]),

  newChannel: function(aURI) {
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
                           .getService(Components.interfaces.nsIScriptSecurityManager);
    var channel = ios.newChannel(ABOUTFEEDS_URI, null, null);
    var principal = secMan.getCodebasePrincipal(aURI);

    channel.originalURI = aURI;
    channel.owner = principal;

    return channel;
  },

  getURIFlags: function() {
    return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT |
           Components.interfaces.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT;
  },

};

function NSGetModule(cm, file) {
  return XPCOMUtils.generateModule([AboutFeeds]);
}
