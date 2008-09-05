/**
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mailnews code.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

function folderLookupService() {
}

folderLookupService.prototype = {
  // XPCOM registration stuff
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFolderLookupService,
                                         Ci.nsIFolderListener]),
  classDescription: "Folder Lookup Service",
  contractID: "@mozilla.org/mail/folder-lookup;1",
  classID: Components.ID("{a30be08c-afc8-4fed-9af7-79778a23db23}"),

  // nsIFolderLookupService impl
  getFolderById: function fls_getFolderById(aId) {
    if (!this._map)
      this._buildMap();

    if (aId in this._map)
      return this._map[aId];

    // This additional creation functionality is provided to replicate legacy
    // rdf functionality.  Callers of this may expect that if the folder does
    // not exist, that we will create it for them.  Do so here.
    var parentString = aId.substr(0, aId.lastIndexOf('/'));

    // If there isn't even a parent, just bail
    if (!(parentString in this._map)) {
      Components.utils.reportError("Asking for subfolder with no parent! " + aId);
      return null;
    }
    var parent = this._map[parentString];
    parent.createSubfolder(aId.substring(aId.lastIndexOf('/') + 1, aId.length));

    // Now that createSubfolder is done, it should have been added into our map
    if (!(aId in this._map)) {
      Components.utils.reportError("Added subfolder but still not in map!");
      return null;
    }
    return this._map[aId];
  },

  _map: null,
  _sessionAdded: false,

  _buildMap: function fls_buildmap() {
    this._map = {};
    var lookupService = this;
    // Adds a folder and any subfolders it might have to the map
    function addFolder(aFolder) {
      lookupService._map[aFolder.URI] = aFolder;

      var childEnum = aFolder.subFolders;
      while (childEnum.hasMoreElements()) {
        addFolder(childEnum.getNext().QueryInterface(Ci.nsIMsgFolder));
      }
    }
 
    var acctMgr = Cc["@mozilla.org/messenger/account-manager;1"].
                  getService(Ci.nsIMsgAccountManager);
    var count = acctMgr.accounts.Count();

    var accounts = new Array();
    for (var i = 0; i < count; i++) {
      var acct = acctMgr.accounts.GetElementAt(i).QueryInterface(Ci.nsIMsgAccount);

      // This is a HACK to work around bug 41133. If we have one of the
      // dummy "news" accounts there, that account won't have an
      // incomingServer attached to it, and everything will blow up.
      if (acct.incomingServer)
        addFolder(acct.incomingServer.rootMsgFolder);
    }

    if (!this._sessionAdded) {
      var session = Cc["@mozilla.org/messenger/services/session;1"].
                    getService(Ci.nsIMsgMailSession);
      session.AddFolderListener(this, Ci.nsIFolderListener.added|Ci.nsIFolderListener.removed);
      this._sessionAdded = true;
    }

    // See the notes below on the observe method
    var ps = Cc["@mozilla.org/preferences-service;1"].
             getService(Components.interfaces.nsIPrefService);
    var branch = ps.getBranch("").QueryInterface(Ci.nsIPrefBranch2);
    branch.addObserver("mail.accountmanager.", this, false);
  },

  OnItemAdded: function fls_onItemAdded(aParent, aItem) {
    if (aItem instanceof Ci.nsIMsgFolder)
      this._map[aItem.URI] = aItem;
  },
  OnItemRemoved: function fls_onItemRemoved(aParent, aItem) {
    if (aItem instanceof Ci.nsIMsgFolder && aItem.URI in this._map)
      delete this._map[aItem.URI];
  },
  OnItemPropertyChanged: function fls_onItemPropertyChanged() {},
  OnItemIntPropertyChanged: function fls_onItemIntPropertyChanged() {},
  OnItemBoolPropertyChanged: function fls_onItemBoolPropertyChanged() {},
  OnItemUnicharPropertyChanged: function fls_onItemUnicharPropertyChanged() {},
  OnItemPropertyFlagChanged: function fls_onItemPropertyFlagChanged() {},
  OnItemEvent: function fls_onItemEvent(folder, event) {},

  // Eww, we also have to watch for account creations, because they have a 
  // "root folder" that doesn't trigger any of the above notifications on
  // creation.
  //
  // XXX Believe it or not, the simplest way to watch for new accounts is to
  // throw an observer on the pref-system. I wish STEEL existed so I could just
  // watch that
  observe: function act_observe(aSubject, aTopic, aPrefName) {
    if (aPrefName != "mail.accountmanager.accounts")
      return;

    // We could do a bunch of work to figure out who was added/removed, but
    // since account creation is a rare enough event, let's just reset.
    this._map = null;
  }
};

function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([folderLookupService]);
}
