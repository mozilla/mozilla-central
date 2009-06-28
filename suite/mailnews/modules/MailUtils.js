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

/**
 * This module has several utility functions for use by both core and
 * third-party code. Some functions are aimed at code that doesn't have a
 * window context, while others can be used anywhere.
 */
var MailUtils =
{
  /**
   * Discover all folders. This is useful during startup, when you have code
   * that deals with folders and that executes before the main 3pane window is
   * open (the folder tree wouldn't have been initialized yet).
   */
  discoverFolders: function MailUtils_discoverFolders()
  {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    let servers = accountManager.allServers;
    for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer))
      server.rootFolder.subFolders;
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
                       aCheckFolderAttributes)
  {
    let folder = null;
    let rdfService = Cc['@mozilla.org/rdf/rdf-service;1']
                       .getService(Ci.nsIRDFService);
    folder = rdfService.GetResource(aFolderURI);
    // This is going to QI the folder to an nsIMsgFolder as well
    if (folder && folder instanceof Ci.nsIMsgFolder)
    {
      if (aCheckFolderAttributes && !(folder.parent || folder.isServer))
        return null;
    }
    else
    {
      return null;
    }

    return folder;
  },

  /**
   * Displays this message in a new window.
   *
   * @param aMsgHdr the message header to display
   */
  displayMessage: function MailUtils_displayMessage(aMsgHdr)
  {
    this.openMessageInNewWindow(aMsgHdr);
  },

  /**
   * Open a new standalone message window with this header.
   *
   * @param aMsgHdr the message header to display
   */
  openMessageInNewWindow: function MailUtils_openMessageInNewWindow(aMsgHdr)
  {
    // Pass in the message URI as messageWindow.js doesn't handle message headers
    let messageURI = Cc["@mozilla.org/supports-string;1"]
                       .createInstance(Ci.nsISupportsString);
    messageURI.data = aMsgHdr.folder.getUriForMsg(aMsgHdr);

    let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                          .getService(Ci.nsIWindowWatcher);
    windowWatcher.openWindow(null,
        "chrome://messenger/content/messageWindow.xul", "_blank",
        "all,chrome,dialog=no,status,toolbar", messageURI);
  }
};
