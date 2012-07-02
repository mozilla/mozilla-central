/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const MAPI_STARTUP_ARG = "MapiStartup";
const MESSAGE_ID_PARAM = "?messageid=";

const CMDLINEHANDLER_CID = Components.ID("{2f86d554-f9d9-4e76-8eb7-243f047333ee}");
const CMDLINEHANDLER_CONTRACTID = "@mozilla.org/commandlinehandler/general-startup;1?type=mail";

var nsMailNewsCommandLineHandler =
{
  get _messenger() {
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
    Components.utils.import("resource:///modules/MailUtils.js");
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
        let neckoURL = null;
        try {
          neckoURL = Services.io.newURI(mailURL, null, null);
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
      let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
      if (mail3PaneWindow) {
        mail3PaneWindow.focus();
      }
      else {
        Services.ww.openWindow(null, "chrome://messenger/content/", "_blank",
            "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar,dialog=no",
            null);
      }
      aCommandLine.preventDefault = true;
    }

    // -MapiStartup
    aCommandLine.handleFlag(MAPI_STARTUP_ARG, false);
  },

  helpInfo: "  -mail              Open the mail folder view.\n" +
            "  -mail <URL>        Open the message specified by this URL.\n",

  classInfo: XPCOMUtils.generateCI({classID: CMDLINEHANDLER_CID,
                                    contractID: CMDLINEHANDLER_CONTRACTID,
                                    interfaces: [Ci.nsICommandLineHandler],
                                    flags: Ci.nsIClassInfo.SINGLETON}),

  /* nsIFactory */
  createInstance: function(outer, iid) {
    if (outer != null)
      throw Cr.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler,
                                         Ci.nsIFactory])
};

function mailNewsCommandLineHandlerModule() {}
mailNewsCommandLineHandlerModule.prototype =
{
  // XPCOM registration
  classID: CMDLINEHANDLER_CID,

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIModule]),

  _xpcom_factory: nsMailNewsCommandLineHandler
};

var components = [mailNewsCommandLineHandlerModule];
const NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
