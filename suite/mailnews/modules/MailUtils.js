/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["MailUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource:///modules/iteratorUtils.jsm");

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
