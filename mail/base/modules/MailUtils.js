/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["MailUtils"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/MailConsts.js");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

const MC = MailConsts;

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
  discoverFolders: function MailUtils_discoverFolders() {
    let servers = MailServices.accounts.allServers;
    for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
      // Bug 466311 Sometimes this can throw file not found, we're unsure
      // why, but catch it and log the fact.
      try {
        server.rootFolder.subFolders;
      }
      catch (ex) {
        Services.console.logStringMessage("Discovering folders for account failed with " +
                                          "exception: " + ex);
      }
    }
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
    let folders = MailServices.accounts.allFolders;

    for (let folder in fixIterator(folders, Ci.nsIMsgFolder)) {
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
   * Display this message header in a new tab, a new window or an existing
   * window, depending on the preference and whether a 3pane or standalone
   * window is already open. This function should be called when you'd like to
   * display a message to the user according to the pref set.
   *
   * @note Do not use this if you want to open multiple messages at once. Use
   *       |displayMessages| instead.
   *
   * @param aMsgHdr the message header to display
   * @param [aViewWrapperToClone] a view wrapper to clone. If null or not
   *                              given, the message header's folder's default
   *                              view will be used
   * @param [aTabmail] a tabmail element to use in case we need to open tabs.
   *                   If null or not given:
   *                   - if one or more 3pane windows are open, the most recent
   *                     one's tabmail is used
   *                   - if no 3pane windows are open, a standalone window is
   *                     opened instead of a tab
   */
  displayMessage: function MailUtils_displayMessage(aMsgHdr,
                      aViewWrapperToClone, aTabmail) {
    this.displayMessages([aMsgHdr], aViewWrapperToClone, aTabmail);
  },

  /**
   * Display the warning if the number of messages to be displayed is greater than
   * the limit set in preferences.
   * @param aNumMessages: number of messages to be displayed
   * @param aConfirmTitle: title ID
   * @param aConfirmMsg: message ID
   * @param aLiitingPref: the name of the pref to retrieve the limit from
   */
  confirmAction: function (aNumMessages, aConfirmTitle, aConfirmMsg, aLimitingPref) {
    let openWarning = Services.prefs.getIntPref(aLimitingPref);
    if ((openWarning > 1) && (aNumMessages >= openWarning)) {
      let bundle = Services.strings.createBundle(
        "chrome://messenger/locale/messenger.properties");
      let title = bundle.GetStringFromName(aConfirmTitle);
      let message = PluralForm.get(aNumMessages,
        bundle.GetStringFromName(aConfirmMsg))
                .replace("#1", aNumMessages);
      if (!Services.prompt.confirm(null, title, message))
        return true;
    }
    return false;
  },
  /**
   * Display these message headers in new tabs, new windows or existing
   * windows, depending on the preference, the number of messages, and whether
   * a 3pane or standalone window is already open. This function should be
   * called when you'd like to display multiple messages to the user according
   * to the pref set.
   *
   * @param aMsgHdrs an array containing the message headers to display. The
   *                 array should contain at least one message header
   * @param [aViewWrapperToClone] a DB view wrapper to clone for each of the
   *                              tabs or windows
   * @param [aTabmail] a tabmail element to use in case we need to open tabs.
   *                   If given, the window containing the tabmail is assumed
   *                   to be in front. If null or not given:
   *                   - if one or more 3pane windows are open, the most recent
   *                     one's tabmail is used, and the window is brought to the
   *                     front
   *                   - if no 3pane windows are open, standalone windows are
   *                     opened instead of tabs
   */
  displayMessages: function MailUtils_displayMessages(aMsgHdrs,
                       aViewWrapperToClone, aTabmail) {
    let openMessageBehavior = Services.prefs.getIntPref(
                                  "mail.openMessageBehavior");

    if (openMessageBehavior == MC.OpenMessageBehavior.NEW_WINDOW) {
      this.openMessagesInNewWindows(aMsgHdrs, aViewWrapperToClone);
    }
    else if (openMessageBehavior == MC.OpenMessageBehavior.EXISTING_WINDOW) {
      // Try reusing an existing window. If we can't, fall back to opening new
      // windows
      if (aMsgHdrs.length > 1 || !this.openMessageInExistingWindow(aMsgHdrs[0]))
        this.openMessagesInNewWindows(aMsgHdrs, aViewWrapperToClone);
    }
    else if (openMessageBehavior == MC.OpenMessageBehavior.NEW_TAB) {
      let mail3PaneWindow = null;
      if (!aTabmail) {
        // Try opening new tabs in a 3pane window
        mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
        if (mail3PaneWindow)
          aTabmail = mail3PaneWindow.document.getElementById("tabmail");
      }

      if (aTabmail) {
        if (this.confirmAction(aMsgHdrs.length, "openTabWarningTitle",
                               "openTabWarningConfirmation",
                               "mailnews.open_tab_warning"))
          return;
        for each (let [i, msgHdr] in Iterator(aMsgHdrs))
          // Open all the tabs in the background, except for the last one
          aTabmail.openTab("message", {msgHdr: msgHdr,
              viewWrapperToClone: aViewWrapperToClone,
              background: (i < (aMsgHdrs.length - 1)),
              disregardOpener: (aMsgHdrs.length > 1),
          });

        if (mail3PaneWindow)
          mail3PaneWindow.focus();
      }
      else {
        // We still haven't found a tabmail, so we'll need to open new windows
        this.openMessagesInNewWindows(aMsgHdrs, aViewWrapperToClone);
      }
    }
  },

  /**
   * Show this message in an existing window.
   *
   * @param aMsgHdr the message header to display
   * @param [aViewWrapperToClone] a DB view wrapper to clone for the message
   *                              window
   * @returns true if an existing window was found and the message header was
   *          displayed, false otherwise
   */
  openMessageInExistingWindow:
      function MailUtils_openMessageInExistingWindow(aMsgHdr,
                                                     aViewWrapperToClone) {
    let messageWindow = Services.wm.getMostRecentWindow("mail:messageWindow");
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
   * @param [aViewWrapperToClone] a DB view wrapper to clone for the message
   *                              window
   */
  openMessageInNewWindow:
      function MailUtils_openMessageInNewWindow(aMsgHdr, aViewWrapperToClone) {
    // It sucks that we have to go through XPCOM for this
    let args = {msgHdr: aMsgHdr, viewWrapperToClone: aViewWrapperToClone};
    args.wrappedJSObject = args;

    Services.ww.openWindow(null,
        "chrome://messenger/content/messageWindow.xul", "",
        "all,chrome,dialog=no,status,toolbar", args);
  },

  /**
   * Open new standalone message windows for these headers. This will prompt
   * for confirmation if the number of windows to be opened is greater than the
   * value of the mailnews.open_window_warning preference.
   *
   * @param aMsgHdrs an array containing the message headers to display
   * @param [aViewWrapperToClone] a DB view wrapper to clone for each message
   *                              window
   */
   openMessagesInNewWindows:
       function MailUtils_openMessagesInNewWindows(aMsgHdrs,
                                                   aViewWrapperToClone) {
    if (this.confirmAction(aMsgHdrs.length, "openWindowWarningTitle",
                           "openWindowWarningConfirmation",
                           "mailnews.open_window_warning"))
      return;

    for each (let [, msgHdr] in Iterator(aMsgHdrs))
      this.openMessageInNewWindow(msgHdr, aViewWrapperToClone);
  },

  /**
   * Display this message header in a folder tab in a 3pane window. This is
   * useful when the message needs to be displayed in the context of its folder
   * or thread.
   *
   * @param aMsgHdr the message header to display
   */
  displayMessageInFolderTab: function MailUtils_displayMessageInFolderTab(
                                 aMsgHdr) {
    // Try opening new tabs in a 3pane window
    let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      mail3PaneWindow.MsgDisplayMessageInFolderTab(aMsgHdr);
    }
    else {
      let args = {msgHdr: aMsgHdr};
      args.wrappedJSObject = args;
      Services.ww.openWindow(null,
          "chrome://messenger/content/", "",
          "all,chrome,dialog=no,status,toolbar", args);
    }
  },

  /**
   * The number of milliseconds to wait between loading of folders in
   * |setStringPropertyOnFolderAndDescendents|.  We wait at all because
   * opening msf databases is a potentially expensive synchronous operation that
   * can approach the order of a second in pathological cases like gmail's
   * all mail folder.
   *
   * If we did not use a timer or otherwise spin the event loop we would
   * completely lock up the UI.  In theory we would still maintain some degree
   * of UI responsiveness if we just used postMessage to break up our work so
   * that the event loop still got a chance to run between our folder openings.
   * The use of any delay between processing folders is to try and avoid causing
   * system-wide interactivity problems from dominating the system's available
   * disk seeks to such an extent that other applications start experiencing
   * non-trivial I/O waits.
   *
   * The specific choice of delay remains an arbitrary one to maintain app
   * and system responsiveness per the above while also processing as many
   * folders as quickly as possible.
   *
   * This is exposed primarily to allow unit tests to set this to 0 to minimize
   * throttling.
   */
  INTER_FOLDER_PROCESSING_DELAY_MS: 10,

  /**
   * Set a string property on a folder and all of its descendents, taking care
   * to avoid locking up the main thread and to avoid leaving folder databases
   * open.  To avoid locking up the main thread we operate in an asynchronous
   * fashion; we invoke a callback when we have completed our work.
   *
   * Using this function will write the value into the folder cache
   * (panacea.dat) as well as the folder itself.  Hopefully you want this; if
   * you do not, keep in mind that the only way to avoid that is to retrieve
   * the nsIMsgDatabase and then the nsIDbFolderInfo.  You would want to avoid
   * that as much as possible because once those are exposed to you, XPConnect
   * is going to hold onto them creating a situation where you are going to be
   * in severe danger of extreme memory bloat unless you force garbage
   * collections after every time you close a database.
   *
   * @param aPropertyName The name of the property to set.
   * @param aPropertyValue The (string) value of the property to set.
   * @param aFolder The parent folder; we set the string property on it and all
   *     of its descendents.
   * @param [aCallback] The optional callback to invoke once we finish our work.
   *     The callback is provided a boolean success value; true means we
   *     managed to set the values on all folders, false means we encountered a
   *     problem.
   */
  setStringPropertyOnFolderAndDescendents:
      function MailUtils_setStringPropertyOnFolderAndDescendents(aPropertyName,
                                                                 aPropertyValue,
                                                                 aFolder,
                                                                 aCallback) {
    // We need to add the base folder as it does not get added by ListDescendants.
    let allFolders = toXPCOMArray([aFolder], Ci.nsIMutableArray);
    // - get all the descendants
    aFolder.ListDescendants(allFolders);

    // - worker function
    function folder_string_setter_worker() {
      for each (let folder in fixIterator(allFolders, Ci.nsIMsgFolder)) {
        // set the property; this may open the database...
        folder.setStringProperty(aPropertyName, aPropertyValue);
        // force the reference to be forgotten.
        folder.msgDatabase = null;
        yield undefined;
      }
    }
    let worker = folder_string_setter_worker();

    // - driver logic
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    function folder_string_setter_driver() {
      try {
        worker.next();
      }
      catch (ex) {
        // Any type of exception kills the generator, but only StopIteration
        // indicates success.
        timer.cancel();
        if (aCallback)
          aCallback(ex == StopIteration);
      }
    }
    // make sure there is at least 100 ms of not us between doing things.
    timer.initWithCallback(folder_string_setter_driver,
                           this.INTER_FOLDER_PROCESSING_DELAY_MS,
                           Ci.nsITimer.TYPE_REPEATING_SLACK);
  },
};
