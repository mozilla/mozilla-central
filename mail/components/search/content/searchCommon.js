#if 0
/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is spotlight integration code.
 *
 * The Initial Developer of the Original Code is
 * David Bienvenu <bienvenu@mozilla.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Siddharth Agarwal <sid1337@gmail.com>
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

/*
 * Common, useful functions for desktop search integration components.
 *
 * The following symbols have to be defined for each component that includes this:
 * - gHdrIndexedProperty: the property in the database that indicates whether a message
 *   has been indexed
 * - gFileExt: the file extension to be used for support files
 * - gPrefBase: the base for preferences that are stored
 * - gStreamListener: an nsIStreamListener to read message text
 */
#endif

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/iteratorUtils.jsm");
Cu.import("resource://app/modules/gloda/log4moz.js");

let SearchSupport =
{
  /**
   * URI of last folder indexed. Kept in sync with the pref
   */
  __lastFolderIndexedUri: null,
  set _lastFolderIndexedUri(uri)
  {
    this._prefBranch.setCharPref("lastFolderIndexedUri", uri);
    this.__lastFolderIndexedUri = uri;
  },
  get _lastFolderIndexedUri()
  {
    // If we don't know about it, get it from the pref branch
    if (this.__lastFolderIndexedUri === null)
    {
      this.__lastFolderIndexedUri = "";
      try {
        this.__lastFolderIndexedUri =
          this._prefBranch.getCharPref("lastFolderIndexedUri");
      } catch (ex) {}
    }
    return this.__lastFolderIndexedUri;
  },

  /**
   * Queue of message headers to index
   */
  _msgHdrsToIndex: [],

  /**
   * Messenger object, used primarily to get message URIs
   */
  __messenger: null,
  get _messenger()
  {
    if (!this.__messenger)
      this.__messenger = Cc["@mozilla.org/messenger;1"]
                         .createInstance(Ci.nsIMessenger);
    return this.__messenger;
  },

  /// The preferences branch to use
  __prefBranch: null,
  get _prefBranch()
  {
    if (!this.__prefBranch)
      this.__prefBranch = Cc["@mozilla.org/preferences-service;1"]
                            .getService(Ci.nsIPrefService)
                            .getBranch(this._prefBase);
    return this.__prefBranch;
  },

  /**
   * Amount of time the user is idle before we (re)start an indexing sweep
   */
  _idleThresholdSecs: 30,

  /**
   * Reference to timer object
   */
  __timer: null,
  get _timer()
  {
    if (!this.__timer)
      this.__timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    return this.__timer;
  },

  _cancelTimer: function()
  {
    try {
      this._timer.cancel();
    }
    catch (ex) {}
  },

  /**
   * Enabled status.
   *
   * When we're enabled, then we get notifications about every message or folder
   * operation, including "message displayed" operations which we bump up in
   * priority. We also have a background sweep which we do on idle.
   *
   * We aren't fully disabled when we're "disabled", though. We still observe
   * message and folder moves and deletes, as we don't want to have support
   * files for non-existent messages.
   */
  _enabled: null,
  set enabled(aEnable)
  {
    // Nothing to do if there's no change in state
    if (this._enabled == aEnable)
      return;

    this._log.info("Enabled status changing from " + this._enabled + " to " +
                   aEnable);

    let notificationService =
      Cc["@mozilla.org/messenger/msgnotificationservice;1"]
        .getService(Ci.nsIMsgFolderNotificationService);

    this._removeObservers();

    if (aEnable)
    {
      // This stuff we always need to do
      notificationService.addListener(this._msgFolderListener,
                                      notificationService.all &
                                      ~notificationService.folderAdded);
      let observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
      observerService.addObserver(this, "MsgMsgDisplayed", false);
      let idleService = Cc["@mozilla.org/widget/idleservice;1"]
                          .getService(Ci.nsIIdleService);
      idleService.addIdleObserver(this, this._idleThresholdSecs);
    }
    else
      // We want to observe moves, deletes and renames in case we're disabled
      // If we don't, we'll have no idea the support files exist later
      notificationService.addListener(this._msgFolderListener,
                                      notificationService.msgsMoveCopyCompleted |
                                      notificationService.msgsDeleted |
                                      (notificationService.allFolderNotifications &
                                       ~notificationService.folderAdded));
    this._enabled = aEnable;
  },
  get enabled()
  {
    return this._enabled;
  },

  /**
   * Remove whatever observers are present. This is done while switching states
   */
  _removeObservers: function()
  {
    if (this.enabled === null)
      return;

    let notificationService =
      Cc["@mozilla.org/messenger/msgnotificationservice;1"]
        .getService(Ci.nsIMsgFolderNotificationService);
    notificationService.removeListener(this._msgFolderListener);

    if (this.enabled)
    {
      let observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
      observerService.removeObserver(this, "MsgMsgDisplayed", false);
      let idleService = Cc["@mozilla.org/widget/idleservice;1"]
                          .getService(Ci.nsIIdleService);
      idleService.removeIdleObserver(this, this._idleThresholdSecs);

      // in case there's a background sweep going on
      this._cancelTimer();
    }
    // We don't need to do anything extra if we're disabled
  },

  /**
   * Init function -- this should be called from the component's init function
   */
  _initSupport: function search_init_support(enabled)
  {
    this._log.info("Search integration running in " +
                   (enabled ? "active" : "backoff") + " mode");
    this.enabled = enabled;
  },

  /**
   * Current folder being indexed
   */
  _currentFolderToIndex: null,

  /**
   * For the current folder being indexed, an enumerator for all the headers in
   * the folder
   */
  _headerEnumerator: null,

  /*
   * These functions are to index already existing messages
   */
  _findNextFolderToIndex: function search_find_next_folder()
  {
    let accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                           .getService(Ci.nsIMsgAccountManager);
    let servers = accountManager.allServers;
    let foundFolder = false;
    let useNextFolder = false;

    for each (var server in fixIterator(servers, Ci.nsIMsgIncomingServer))
    {
      let rootFolder = server.rootFolder;
      let allFolders = Cc["@mozilla.org/supports-array;1"]
                         .createInstance(Ci.nsISupportsArray);
      rootFolder.ListDescendents(allFolders);
      let numFolders = allFolders.Count();
      this._log.debug("in find next folder, lastFolderIndexedUri = " +
                      this._lastFolderIndexedUri);
      for each (var folder in fixIterator(allFolders, Ci.nsIMsgFolder))
      {
        // if no folder was indexed (or the pref's not set), just use the first
        // folder
        if (!this._lastFolderIndexedUri.length || useNextFolder)
        {
          this._currentFolderToIndex = folder;
          foundFolder = true;
          break;
        }
        else
        {
          if (this._lastFolderIndexedUri == folder.URI)
            useNextFolder = true;
        }
      }
    }
    if (!foundFolder)
      this._currentFolderToIndex = null;
  },

  _findNextHdrToIndex: function search_find_next_header()
  {
    try
    {
      if (!this._headerEnumerator)
        this._headerEnumerator = this._currentFolderToIndex.messages;

      // iterate over the folder finding the next message to index
      while (this._headerEnumerator.hasMoreElements())
      {
        let msgHdr = this._headerEnumerator.getNext()
                         .QueryInterface(Ci.nsIMsgDBHdr);
        if (!msgHdr.getUint32Property(this._hdrIndexedProperty))
          return msgHdr;
      }
    }
    catch(ex) {}

    // If we couldn't find any headers to index, null out the enumerator
    this._headerEnumerator = null;
    return null;
  },

  /**
   * Whether background indexing has been completed
   */
  __backgroundIndexingDone: false,

  /**
   * The main background sweeping function. It first looks for a folder to
   * start or continue indexing in, then for a header. If it can't find anything
   * to index, it resets the last folder indexed URI so that the sweep can
   * be restarted
   */
  _continueSweep: function search_continue_sweep()
  {
    let msgHdrToIndex = null;

    if (this.__backgroundIndexingDone)
      return;

    // find the current folder we're working on
    if (!this._currentFolderToIndex)
      this._findNextFolderToIndex();

    // we'd like to index more than one message on each timer fire,
    // but since streaming is async, it's hard to know how long
    // it's going to take to stream any particular message.
    if (this._currentFolderToIndex)
      msgHdrToIndex = this._findNextHdrToIndex();
    else
    {
      // we've cycled through all the folders, we should take a break
      // from indexing of existing messages
      this.__backgroundIndexingDone = true;
      this._lastFolderIndexedUri = "";
    }
    if (!msgHdrToIndex)
    {
      this._log.debug("reached end of folder");
      if (this._currentFolderToIndex)
      {
        this._lastFolderIndexedUri = this._currentFolderToIndex.URI;
        this._currentFolderToIndex = null;
      }
    }
    else
      this._queueMessage(msgHdrToIndex);

    // Restart the timer, and call ourselves
    this._cancelTimer();
    this._timer.initWithCallback(this._wrapContinueSweep,
                                 this._msgHdrsToIndex.length > 1 ? 5000 : 1000,
                                 Ci.nsITimer.TYPE_ONE_SHOT);
  },

  /**
   * A simple wrapper to make "this" be right for _continueSweep
   */
  _wrapContinueSweep: function search_wrap_continue_sweep()
  {
    SearchIntegration._continueSweep();
  },

  /**
   * Observer implementation. Consists of
   * - idle observer; starts running through folders when it receives an "idle"
   * notification, and cancels any timers when it receives a "back" notification
   * - msg displayed observer, queues the message if necessary
   */
  observe: function search_observe(aSubject, aTopic, aData)
  {
    if (aTopic == "idle")
    {
      this._log.debug("Idle detected, continuing sweep")
      this._continueSweep();
    }
    else if (aTopic == "back")
    {
      this._log.debug("Non-idle, so suspending sweep")
      this._cancelTimer();
    }
    else if (aTopic == "MsgMsgDisplayed")
    {
      this._log.debug("topic = " + aTopic + " uri = " + aData);
      let msgHdr = this._messenger.msgHdrFromURI(aData);
      let indexed = msgHdr.getUint32Property(this._hdrIndexedProperty);
      if (!indexed)
      {
        let file = this._getSupportFile(msgHdr);
        if (!file.exists())
          this._queueMessage(msgHdr);
      }
    }
  },

  /**
   * This object gets notifications for new/moved/copied/deleted messages/folders
   */
  _msgFolderListener: {
    msgAdded: function(aMsg)
    {
      SearchIntegration._log.info("in msgAdded");
      // The message already being there is an expected case
      let file = SearchIntegration._getSupportFile(aMsg);
      if (!file.exists())
        SearchIntegration._queueMessage(aMsg);
    },

    msgsDeleted: function(aMsgs)
    {
      SearchIntegration._log.info("in msgsDeleted");
      let count = aMsgs.length;
      for (let i = 0; i < count; i++)
      {
        let file = SearchIntegration._getSupportFile(
                     aMsgs.queryElementAt(i, Ci.nsIMsgDBHdr));
        if (file.exists())
          file.remove(false);
      }
    },

    msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder)
    {
      SearchIntegration._log.info("in msgsMoveCopyCompleted, aMove = " + aMove);
      // Forget about copies if disabled
      if (!aMove && !this.enabled)
        return;

      let count = aSrcMsgs.length;
      for (let i = 0; i < count; i++)
      {
        let srcFile = SearchIntegration._getSupportFile(
                        aSrcMsgs.queryElementAt(i, Ci.nsIMsgDBHdr));
        if (srcFile && srcFile.exists())
        {
          let destFile = aDestFolder.filePath;
          destFile.leafName = destFile.leafName + ".mozmsgs";
          if (!destFile.exists())
          {
            try {
              // create the directory, if it doesn't exist
              destFile.create(Ci.nsIFile.DIRECTORY_TYPE, 0644);
            }
            catch(ex) {SearchIntegration._log.warn(ex);}
          }
          SearchIntegration._log.debug("dst file path = " + destFile.path);
          SearchIntegration._log.debug("src file path = " + srcFile.path);
          // We're not going to copy in case we're not in active mode
          if (destFile.exists())
            if (aMove)
              srcFile.moveTo(destFile, "");
            else
              srcFile.copyTo(destFile, "");
        }
      }
    },

    folderDeleted: function(aFolder)
    {
      SearchIntegration._log.info("in folderDeleted, folder name = " +
                                  aFolder.prettiestName);
      let srcFile = aFolder.filePath;
      srcFile.leafName = srcFile.leafName + ".mozmsgs";
      if (srcFile.exists())
        srcFile.remove(true);
    },

    folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
    {
      SearchIntegration._log.info("in folderMoveCopyCompleted, aMove = " +
                                  aMove);

      // Forget about copies if disabled
      if (!aMove && !this.enabled)
        return;

      let srcFile = aSrcFolder.filePath;
      let destFile = aDestFolder.filePath;
      srcFile.leafName = srcFile.leafName + ".mozmsgs";
      destFile.leafName += ".sbd";
      SearchIntegration._log.debug("src file path = " + srcFile.path);
      SearchIntegration._log.debug("dst file path = " + destFile.path);
      if (srcFile.exists())
      {
        // We're not going to copy if we aren't in active mode
        if (aMove)
          srcFile.moveTo(destFile, "");
        else
          srcFile.copyTo(destFile, "");
      }
    },

    folderRenamed: function(aOrigFolder, aNewFolder)
    {
      SearchIntegration._log.info("in folderRenamed, aOrigFolder = " +
                                  aOrigFolder.prettiestName +
                                  ", aNewFolder = " + aNewFolder.prettiestName);
      let srcFile = aOrigFolder.filePath;
      srcFile.leafName = srcFile.leafName + ".mozmsgs";
      let destName = aNewFolder.name + ".mozmsgs";
      SearchIntegration._log.debug("src file path = " + srcFile.path);
      SearchIntegration._log.debug("dst name = " + destName);
      if (srcFile.exists())
        srcFile.moveTo(null, destName);
    },

    itemEvent: function(aItem, aEvent, aData)
    {
      SearchIntegration._log.info("in itemEvent, aItem = " + aItem +
                                  ", aEvent = " + aEvent + ", aData = " + aData);
    }
  },

  /*
   * Support functions to queue/generate files
   */
  _queueMessage: function search_queue_message(msgHdr)
  {
    if (this._msgHdrsToIndex.push(msgHdr) == 1)
    {
      this._log.info("generating support file for id = " + msgHdr.messageId);
      this._streamListener.startStreaming(msgHdr);
    }
    else
      this._log.info("queueing support file generation for id = " +
                     msgHdr.messageId);
  },

  _getSupportFile: function search_get_support_file(msgHdr)
  {
    let folder = msgHdr.folder;
    if (folder)
    {
      let messageId = encodeURIComponent(msgHdr.messageId);
      this._log.debug("encoded message id = " + messageId);
      let file = folder.filePath;
      file.leafName = file.leafName + ".mozmsgs";
      file.appendRelativePath(messageId + this._fileExt);
      this._log.debug("getting support file path = " + file.path);
      return file;
    }
    return null;
  },

  /**
   * Base to use for stream listeners, extended by the respective
   * implementations
   */
  _streamListenerBase: {
    /// Output file
    _outputFile: null,

    /// Stream to use to write to the output file
    __outputStream: null,
    set _outputStream(stream)
    {
      if (this.__outputStream)
        this.__outputStream.close();
      this.__outputStream = stream;
    },
    get _outputStream()
    {
      return this.__outputStream;
    },

    /// Reference to message header
    _msgHdr: null,

    QueryInterface: function(aIId, instance) {
      if (aIId.equals(Ci.nsIStreamListener) || aIId.equals(Ci.nsISupports))
        return this;

      throw Components.results.NS_ERROR_NO_INTERFACE;
    },

    /// "Finish" function, cleans up behind itself if unsuccessful
    _onDoneStreaming: function search_on_done_streaming(successful)
    {
      this._outputStream = null;
      if (!successful && this._msgHdr)
      {
        let file = SearchIntegration._getSupportFile(this._msgHdr);
        if (file && file.exists())
          file.remove(false);
      }
      // should we try to delete the file on disk in case not successful?
      SearchIntegration._msgHdrsToIndex.shift();

      if (SearchIntegration._msgHdrsToIndex.length > 0)
        this.startStreaming(SearchIntegration._msgHdrsToIndex[0]);
    },

    /// "Start" function
    startStreaming: function search_start_streaming(msgHdr)
    {
      try
      {
        let folder = msgHdr.folder;
        if (folder)
        {
          let messageId = encodeURIComponent(msgHdr.messageId);
          SearchIntegration._log.info("generating support file, id = " +
                                      messageId);
          let file = folder.filePath;

          file.leafName = file.leafName + ".mozmsgs";
          SearchIntegration._log.debug("file leafname = " + file.leafName);
          if (!file.exists())
          {
            try {
              // create the directory, if it doesn't exist
              file.create(Ci.nsIFile.DIRECTORY_TYPE, 0644);
            }
            catch(ex) { this._log.error(ex); }
          }

          file.appendRelativePath(messageId + SearchIntegration._fileExt);
          SearchIntegration._log.debug("file path = " + file.path);
          file.create(0, 0644);
          let uri = folder.getUriForMsg(msgHdr);
          let msgService = SearchIntegration._messenger
            .messageServiceFromURI(uri);
          this._msgHdr = msgHdr;
          this._outputFile = file;
          try
          {
            // XXX For now, try getting the messages from the server. This has
            // to be improved so that we don't generate any excess network
            // traffic
            msgService.streamMessage(uri, this, null, null, false, "", false);
          }
          catch (ex)
          {
            // This is an expected case, in case we're offline
            SearchIntegration._log.warn("StreamMessage unsuccessful for id = " +
                                        messageId);
            this._onDoneStreaming(false);
          }
        }
      }
      catch (ex)
      {
        SearchIntegration._log.error(ex);
        this._onDoneStreaming(false);
      }
    }
  },

  /**
   * Logging functionality, shamelessly ripped from gloda
   * If enabled, warnings and above are logged to the error console, while dump
   * gets everything
   */
  _log: null,
  _initLogging: function search_init_logging()
  {
    let formatter = new Log4Moz.BasicFormatter();
  let root = Log4Moz.repository.rootLogger;
    root.level = Log4Moz.Level.Debug;

  this._log = Log4Moz.repository.getLogger("SearchInt");

    let enableConsoleLogging = false;
    let enableDumpLogging = false;

    try
    {
      enableConsoleLogging = this._prefBranch.getBoolPref("logging.console");
      enableDumpLogging = this._prefBranch.getBoolPref("logging.dump");
    }
    catch (ex) {}

    if (enableConsoleLogging)
    {
      let capp = new Log4Moz.ConsoleAppender(formatter);
      capp.level = Log4Moz.Level.Warn;
      this._log.addAppender(capp);
    }
    if (enableDumpLogging)
    {
      let dapp = new Log4Moz.DumpAppender(formatter);
      dapp.level = Log4Moz.Level.All;
      this._log.addAppender(dapp);
    }

    this._log.info("Logging initialized");
  }
};
