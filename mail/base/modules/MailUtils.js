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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var EXPORTED_SYMBOLS = ["MailUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://app/modules/MailConsts.js");
const MC = MailConsts;

/**
 * This module has several utility functions for use by both core and
 * third-party code. Some functions are aimed at code that doesn't have a
 * window context, while others can be used anywhere.
 */
var MailUtils =
{
  /**
   * A reference to the root pref branch
   */
  get _prefBranch MailUtils_get_prefBranch() {
    delete this._prefBranch;
    return this._prefBranch = Cc["@mozilla.org/preferences-service;1"]
                                .getService(Ci.nsIPrefService)
                                .getBranch(null);
  },

  /**
   * Discover all folders. This is useful during startup, when you have code
   * that deals with folders and that executes before the main 3pane window is
   * open (the folder tree wouldn't have been initialized yet).
   */
  discoverFolders: function MailUtils_discoverFolders() {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    let servers = accountManager.allServers;
    for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer))
      server.rootFolder.subFolders;
  },

  /**
   * Get the nsIMsgFolder corresponding to this file. This just looks at all
   * folders and does a direct match.
   *
   * One of the places this is used is desktop search integration -- to open
   * the search result corresponding to a mozeml/wdseml file, we need to figure
   * out the folder using the file's path.
   *
   * @param aFile the nsILocalFile to convert to a folder
   * @returns the nsIMsgFolder corresponding to aFile, or null if the folder
   *          isn't found
   */
  getFolderForFileInProfile:
      function MailUtils_getFolderForFileInProfile(aFile) {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    let folders = accountManager.allFolders;

    for each (let folder in fixIterator(folders.enumerate(), Ci.nsIMsgFolder)) {
      if (folder.filePath.equals(aFile))
        return folder;
    }
    return null;
  },

  /**
   * Get the nsIMsgFolder corresponding to this URI. This uses the RDF service
   * to do the work.
   *
   * @param aFolderURI the URI to convert into a folder
   * @param aCheckFolderAttributes whether to check that the folder either has
   *                              a parent or isn't a server
   * @returns the nsIMsgFolder corresponding to this URI, or null if
   *          aCheckFolderAttributes is true and the folder doesn't have a
   *          parent or is a server
   */
  getFolderForURI: function MailUtils_getFolderForURI(aFolderURI,
                       aCheckFolderAttributes) {
    let folder = null;
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1']
                       .getService(Ci.nsIRDFService);
    folder = rdfService.GetResource(aFolderURI);
    // This is going to QI the folder to an nsIMsgFolder as well
    if (folder && folder instanceof Ci.nsIMsgFolder) {
      if (aCheckFolderAttributes && !(folder.parent || folder.isServer))
        return null;
    }
    else {
      return null;
    }

    return folder;
  },

  /**
   * Displays this message header in a new tab, a new window or an existing
   * window, depending on the preference and whether a 3pane or standalone
   * window is already open. This function should be called when you'd like to
   * display a message to the user according to the pref set.
   *
   * @param aMsgHdr the message header to display
   */
  displayMessage: function MailUtils_displayMessage(aMsgHdr) {
    let openMessageBehavior = this._prefBranch.getIntPref(
                                  "mail.openMessageBehavior");

    if (openMessageBehavior == MC.OpenMessageBehavior.NEW_WINDOW) {
      this.openMessageInNewWindow(aMsgHdr);
    }
    else if (openMessageBehavior == MC.OpenMessageBehavior.EXISTING_WINDOW) {
      // Try reusing an existing window. If we can't, fall back to opening a
      // new window
      if (!this.openMessageInExistingWindow(aMsgHdr))
        this.openMessageInNewWindow(aMsgHdr);
    }
    else if (openMessageBehavior == MC.OpenMessageBehavior.NEW_TAB) {
      // Try opening a new tab in a 3pane window. If we can't, fall back to
      // opening a new window
      let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                             .getService(Ci.nsIWindowMediator);
      let mail3PaneWindow = windowMediator.getMostRecentWindow("mail:3pane");
      // Do this directly instead of calling MsgOpenNewTabForMessage, because
      // that passes in gFolderDisplay.view to be cloned, and we don't want
      // that
      if (mail3PaneWindow) {
        mail3PaneWindow.document.getElementById("tabmail").openTab("message",
            {msgHdr: aMsgHdr, background: false});
        mail3PaneWindow.focus();
      }
      else {
        this.openMessageInNewWindow(aMsgHdr);
      }
    }
  },

  /**
   * Show this message in an existing window.
   *
   * @param aMsgHdr the message header to display
   * @param aViewWrapperToClone [optional] a DB view wrapper to clone for the
   *                            message window
   * @returns true if an existing window was found and the message header was
   *          displayed, false otherwise
   */
  openMessageInExistingWindow:
      function MailUtils_openMessageInExistingWindow(aMsgHdr,
                                                     aViewWrapperToClone) {
    let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Ci.nsIWindowMediator);
    let messageWindow = windowMediator.getMostRecentWindow("mail:messageWindow");
    if (messageWindow) {
      messageWindow.displayMessage(aMsgHdr, aViewWrapperToClone);
      return true;
    }
    return false;
  },

  /**
   * Open a new standalone message window with this header.
   *
   * @param aMsgHdr the message header to display
   */
  openMessageInNewWindow: function MailUtils_openMessageInNewWindow(aMsgHdr) {
    let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                          .getService(Ci.nsIWindowWatcher);
    windowWatcher.openWindow(null,
        "chrome://messenger/content/messageWindow.xul", "_blank",
        "all,chrome,dialog=no,status,toolbar", aMsgHdr);
  }
};
