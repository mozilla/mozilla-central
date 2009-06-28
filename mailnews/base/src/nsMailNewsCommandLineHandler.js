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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const MAPI_STARTUP_ARG = "MapiStartup";
const MESSAGE_ID_PARAM = "?messageid=";

var nsMailNewsCommandLineHandler =
{
  get _messenger nsMailNewsCommandLineHandler_getMessenger() {
    delete this._messenger;
    return this._messenger = Cc["@mozilla.org/messenger;1"]
                               .createInstance(Ci.nsIMessenger);
  },

  /* nsICommandLineHandler */

  /**
   * Handles the following command line arguments:
   * - -mail: opens the mail folder view
   * - -MapiStartup: indicates that this startup is due to MAPI.
   *   Don't do anything for now.
   */
  handle: function nsMailNewsCommandLineHandler_handle(aCommandLine) {
    // Do this here because xpcshell isn't too happy with this at startup
    Components.utils.import("resource://app/modules/MailUtils.js");
    // -mail <URL>
    let mailURL = null;
    try {
      mailURL = aCommandLine.handleFlagWithParam("mail", false);
    }
    catch (e) {
      // We're going to cover -mail without a parameter later
    }

    if (mailURL && mailURL.length > 0) {
      let msgHdr = null;
      if (/^(mailbox|imap|news)-message:\/\//.test(mailURL)) {
        // This might be a standard message URI, or one with a messageID
        // parameter. Handle both cases.
        let messageIDIndex = mailURL.toLowerCase().indexOf(MESSAGE_ID_PARAM);
        if (messageIDIndex != -1) {
          // messageID parameter
          // Convert the message URI into a folder URI
          let folderURI = mailURL.slice(0, messageIDIndex)
                                 .replace("-message", "");
          // Get the message ID
          let messageID = mailURL.slice(messageIDIndex + MESSAGE_ID_PARAM.length);
          // Make sure the folder tree is initialized
          MailUtils.discoverFolders();

          let folder = MailUtils.getFolderForURI(folderURI, true);
          // The folder might not exist, so guard against that
          if (folder && messageID.length > 0)
            msgHdr = folder.msgDatabase.getMsgHdrForMessageID(messageID);
        }
        else {
          // message URI
          msgHdr = this._messenger.msgHdrFromURI(mailURL);
        }
      }
      else {
        // Necko URL, so convert it into a message header
        let ioService = Cc["@mozilla.org/network/io-service;1"]
                          .getService(Ci.nsIIOService);
        let neckoURL = null;
        try {
          neckoURL = ioService.newURI(mailURL, null, null);
        }
        catch (e) {
          // We failed to convert the URI. Oh well.
        }

        if (neckoURL instanceof Ci.nsIMsgMessageUrl)
          msgHdr = neckoURL.messageHeader;
      }

      if (msgHdr) {
        aCommandLine.preventDefault = true;
        MailUtils.displayMessage(msgHdr);
      }
      else {
        dump("Unrecognized URL: " + mailURL + "\n");
      }
    }

    // -mail (no parameter)
    let mailFlag = aCommandLine.handleFlag("mail", false);
    if (mailFlag) {
      // Focus the 3pane window if one is present, else open one
      let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"]
                             .getService(Ci.nsIWindowMediator);
      let mail3PaneWindow = windowMediator.getMostRecentWindow("mail:3pane");
      if (mail3PaneWindow) {
        mail3PaneWindow.focus();
      }
      else {
        let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                              .getService(Ci.nsIWindowWatcher);
        windowWatcher.openWindow(null, "chrome://messenger/content/", "_blank",
            "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar,dialog=no",
            null);
      }
      aCommandLine.preventDefault = true;
    }

    // -MapiStartup
    aCommandLine.handleFlag(MAPI_STARTUP_ARG, false);
  },

  helpInfo: "  -mail                Open the mail folder view.\n" +
            "  -mail <URL>          Open the message specified by this URL.\n",

  /* nsIClassInfo */
  flags: Ci.nsIClassInfo.SINGLETON,
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  getHelperForLanguage: function(language) null,
  getInterfaces: function(count) {
    let interfaces = [Ci.nsICommandLineHandler];
    count.value = interfaces.length;
    return interfaces;
  },

  /* nsIFactory */
  createInstance: function(outer, iid) {
    if (outer != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler,
                                         Ci.nsIClassInfo,
                                         Ci.nsIFactory])
};

function mailNewsCommandLineHandlerModule() {}
mailNewsCommandLineHandlerModule.prototype =
{
  // XPCOM registration
  classDescription: "MailNews Commandline Handler",
  classID: Components.ID("{2f86d554-f9d9-4e76-8eb7-243f047333ee}"),
  contractID: "@mozilla.org/messenger/clh;1",

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIModule]),
  
  _xpcom_categories: [{
    category: "command-line-handler",
    entry: "m-mail"
  }],

  _xpcom_factory: nsMailNewsCommandLineHandler
};

// NSGetModule: Return the nsIModule object.
function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule([mailNewsCommandLineHandlerModule]);
}
