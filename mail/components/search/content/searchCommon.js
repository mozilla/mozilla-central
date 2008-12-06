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

var gCurrentFolderToIndex;
var gLastFolderIndexedUri = ""; // this is stored in a pref
var gHeaderEnumerator;
var gMsgHdrsToIndex;
var gMessenger;
var gBackgroundIndexingDone;
var gPrefBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch(null);
var gEnabled;

let SearchIntegration = this;

/**
 * Amount of time the user is idle before we (re)start an indexing sweep
 */
let _idleThresholdSecs = 30;

/**
 * Reference to current timer object
 */
let _timer = null;

/*
 * Init function -- this should be called from the component's init function
 */
function InitSupportIntegration(enabled)
{
  this._log.info("Search integration running in " + (enabled ? "active" : "backoff") + " mode");
  gEnabled = enabled;

  gMessenger = Cc["@mozilla.org/messenger;1"].createInstance().QueryInterface(Ci.nsIMessenger);

  var notificationService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
    .getService(Ci.nsIMsgFolderNotificationService);

  // We want to observe moves, deletes and renames in case we're disabled
  // If we don't, we'll have no idea the support files exist later
  if (enabled)
  {
    notificationService.addListener(gFolderListener, notificationService.all);
    var ObserverService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    ObserverService.addObserver(MsgMsgDisplayedObserver, "MsgMsgDisplayed", false);
    gMsgHdrsToIndex = new Array();
    let idleService = Cc["@mozilla.org/widget/idleservice;1"].
                          getService(Ci.nsIIdleService);
    idleService.addIdleObserver(this._idleObserver, this._idleThresholdSecs);
  }
  else
    notificationService.addListener(gFolderListener, notificationService.msgsMoveCopyCompleted |
                                    notificationService.msgsDeleted |
                                    notificationService.allFolderNotifications);

  // Set up the timer, though we'll only init it later when needed
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
}

/*
 * These functions are to index already existing messages
 */
function FindNextFolderToIndex()
{
  accountManager = Cc["@mozilla.org/messenger/account-manager;1"].getService(Ci.nsIMsgAccountManager);
  var servers = accountManager.allServers;
  var foundFolder = false;
  var useNextFolder = false;

  for each (var server in fixIterator(servers, Ci.nsIMsgIncomingServer))
  {
    var rootFolder = server.rootFolder;
    var allFolders = Cc["@mozilla.org/supports-array;1"].createInstance(Ci.nsISupportsArray);
    rootFolder.ListDescendents(allFolders);
    var numFolders = allFolders.Count();
    this._log.debug("in find next folder, gLastFolderIndexedUri = " +
                    gLastFolderIndexedUri);
    for each (var folder in fixIterator(allFolders, Ci.nsIMsgFolder))
    {
      // if no folder was indexed (or the pref's not set), just use the first folder
      if (!gLastFolderIndexedUri.length || useNextFolder)
      {
        gCurrentFolderToIndex = folder;
        foundFolder = true;
        break;
      }
      else
      {
        if (gLastFolderIndexedUri == folder.URI)
          useNextFolder = true;
      }
    }
  }
  if (!foundFolder)
    gCurrentFolderToIndex = null;
}

function FindNextHdrToIndex()
{
  try
  {
    if (!gHeaderEnumerator)
      gHeaderEnumerator = gCurrentFolderToIndex.getMessages(null);

    // iterate over the folder finding the next message to index
    while (gHeaderEnumerator.hasMoreElements())
    {
      var msgHdr = gHeaderEnumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr);
      if (!msgHdr.getUint32Property(gHdrIndexedProperty))
        return msgHdr;
    }
  }
  catch(ex) {}
  gHeaderEnumerator = null;
  return null;
}

function _continueSweep()
{
  var msgHdrToIndex = null;

  if (gBackgroundIndexingDone)
    return;

  // find the current folder we're working on
  if (!gCurrentFolderToIndex)
    FindNextFolderToIndex();

  // we'd like to index more than one message on each timer fire,
  // but since streaming is async, it's hard to know how long
  // it's going to take to stream any particular message.
  if (gCurrentFolderToIndex)
  {
    var msgHdrToIndex = FindNextHdrToIndex();
  }
  else
  {
    // we've cycled through all the folders, we should take a break
    // from indexing of existing messages
    gBackgroundIndexingDone = true;
    gPrefBranch.setCharPref(gPrefBase + ".lastFolderIndexedUri", "");
  }
  if (!msgHdrToIndex)
  {
    SearchIntegration._log.debug("reached end of folder");
    if (gCurrentFolderToIndex)
    {
      gLastFolderIndexedUri = gCurrentFolderToIndex.URI;
      gPrefBranch.setCharPref(gPrefBase + ".lastFolderIndexedUri", gLastFolderIndexedUri);
      gCurrentFolderToIndex = null;
    }
  }
  else
  {
    QueueMessageToGetIndexed(msgHdrToIndex);
  }

  // Restart the timer, and call ourselves
  try {
    SearchIntegration._timer.cancel();
  } catch (ex) {}
  SearchIntegration._timer
    .initWithCallback(arguments.callee,
                      gMsgHdrsToIndex.length > 1 ? 5000 : 1000,
                      Ci.nsITimer.TYPE_ONE_SHOT);
}

/**
 * Idle observer; starts running through folders when it receives an "idle"
 * notification, and cancels any timers when it receives a "back" notification.
 */
let _idleObserver =
{
  observe: function search_idle_observe(aSubject, aTopic, aData)
  {
    if (aTopic == "idle")
    {
      SearchIntegration._log.debug("Idle detected, continuing sweep")
      // We call _continueSweep this way to be neater there
      SearchIntegration._continueSweep();
    }
    else if (aTopic == "back")
    {
      SearchIntegration._log.debug("Non-idle, so suspending sweep")
      try {
        SearchIntegration._timer.cancel();
      } catch (ex) {}
    }
  }
};

/*
 * This object gets notifications for messages that are read, giving them a
 * higher priority
 */
var MsgMsgDisplayedObserver =
{
  // Components.interfaces.nsIObserver
  observe: function(aHeaderSink, aTopic, aData)
  {
    SearchIntegration._log.debug("topic = " + aTopic + " uri = " + aData);
    var msgHdr = gMessenger.msgHdrFromURI(aData);
    var indexed = msgHdr.getUint32Property(gHdrIndexedProperty);
    if (!indexed)
    {
      var file = GetSupportFileForMsgHdr(msgHdr);
      if (!file.exists())
        QueueMessageToGetIndexed(msgHdr);
    }
  }
};

/*
 * This object gets notifications for new/moved/copied/deleted messages/folders
 */
var gFolderListener = {
  msgAdded: function(aMsg)
  {
    SearchIntegration._log.info("in msgAdded");
    // The message already being there is an expected case
    var file = GetSupportFileForMsgHdr(aMsg);
    if (!file.exists())
      QueueMessageToGetIndexed(aMsg);
  },

  msgsDeleted: function(aMsgs)
  {
    SearchIntegration._log.info("in msgsDeleted");
    var count = aMsgs.length;
    for (var i = 0; i < count; i++)
    {
      var file = GetSupportFileForMsgHdr(aMsgs.queryElementAt(i, Ci.nsIMsgDBHdr));
      if (file.exists())
        file.remove(false);
    }
  },

  msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder)
  {
    SearchIntegration._log.info("in msgsMoveCopyCompleted, aMove = " + aMove);
    var count = aSrcMsgs.length;
    for (var i = 0; i < count; i++)
    {
      var msg = aSrcMsgs.queryElementAt(i, Ci.nsIMsgDBHdr);
      var srcFile = GetSupportFileForMsgHdr(msg);
      if (srcFile && srcFile.exists())
      {
        var destFile = aDestFolder.filePath;
        destFile.leafName = destFile.leafName + ".mozmsgs";
        if (!destFile.exists())
        {
          try
          {
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
          else if (gEnabled)
            srcFile.copyTo(destFile, "");
      }
    }
  },

  folderDeleted: function(aFolder)
  {
    SearchIntegration._log.info("in folderDeleted, folder name = " +
                                aFolder.prettiestName);
    var srcFile = aFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    if (srcFile.exists())
      srcFile.remove(true);
  },

  folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
  {
    SearchIntegration._log.info("in folderMoveCopyCompleted, aMove = " + aMove);
    var srcFile = aSrcFolder.filePath;
    var destFile = aDestFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    destFile.leafName += ".sbd";
    SearchIntegration._log.debug("src file path = " + srcFile.path);
    SearchIntegration._log.debug("dst file path = " + destFile.path);
    if (srcFile.exists())
    {
      // We're not going to copy if we aren't in active mode
      if (aMove)
        srcFile.moveTo(destFile, "");
      else if (gEnabled)
        srcFile.copyTo(destFile, "");
    }
  },

  folderRenamed: function(aOrigFolder, aNewFolder)
  {
    SearchIntegration._log.info("in folderRenamed, aOrigFolder = " +
                                aOrigFolder.prettiestName + ", aNewFolder = " +
                                aNewFolder.prettiestName);
    var srcFile = aOrigFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    var destName = aNewFolder.name + ".mozmsgs";
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
};

/*
 * Support functions to queue/generate files
 */
function QueueMessageToGetIndexed(msgHdr)
{
  if (gMsgHdrsToIndex.push(msgHdr) == 1)
  {
    this._log.info("generating support file for id = " + msgHdr.messageId);
    GenerateSupportFile(msgHdr);
  }
  else
    this._log.info("queueing support file generation for id = " +
                   msgHdr.messageId);
}

function GetSupportFileForMsgHdr(msgHdr)
{
  var folder = msgHdr.folder;
  if (folder)
  {
    var messageId = msgHdr.messageId;
    messageId = encodeURIComponent(messageId);
    this._log.debug("encoded message id = " + messageId);
    if (folder)
    {
      var file = folder.filePath;
      file.leafName = file.leafName + ".mozmsgs";
      file.appendRelativePath(messageId + gFileExt);
      this._log.debug("getting support file path = " + file.path);
      return file;
    }
  }
  return null;
}

const MSG_FLAG_HAS_RE = 0x0010;

function GenerateSupportFile(msgHdr)
{
  try
  {
    var folder = msgHdr.folder;
    if (folder)
    {
      var messageId = msgHdr.messageId;
      // for the trunk, this should work
      // var netUtils = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsINetUtil);
      // messageId = netUtils.escapeString(messageId, netUtils.ESCAPE_URL_PATH);
      messageId = encodeURIComponent(messageId);
      // We don't require the subject for this, keeping it if necessary later.
      // gStreamListener.subject = ((msgHdr.flags & MSG_FLAG_HAS_RE) ? "Re: " : "") + msgHdr.mime2DecodedSubject;
      this._log.info("generating support file, id = " + messageId);
      var file = folder.filePath;

      file.leafName = file.leafName + ".mozmsgs";
      SearchIntegration._log.debug("file leafname = " + file.leafName);
      if (!file.exists())
      {
        try
        {
          // create the directory, if it doesn't exist
          file.create(Ci.nsIFile.DIRECTORY_TYPE, 0644);
        }
        catch(ex) { this._log.error(ex); }
      }
      gStreamListener.msgHdr = msgHdr;

      file.appendRelativePath(messageId + gFileExt);
      //file.leafName = messageId + gFileExt;
      this._log.debug("file path = " + file.path);
      file.create(0, 0644);
      var uri = folder.getUriForMsg(msgHdr);
      //SIDump("in onItemAdded messenger = " + messenger + "\n");
      var msgService = gMessenger.messageServiceFromURI(uri);
      gStreamListener.outputFile = file;

      try
      {
        // XXX For now, try getting the messages from the server. This has to be
        // improved so that we don't generate any excess network traffic
        msgService.streamMessage(uri, gStreamListener, null, null, false, "", false);
      }
      catch (ex)
      {
        // This is an expected case, in case we're offline
        this._log.warn("StreamMessage not successful for id = " + messageId);
        gStreamListener.onDoneStreamingCurMessage(false);
      }
    }
  }
  catch (ex)
  {
    this._log.error(ex);
    gStreamListener.onDoneStreamingCurMessage(false);
  }
}

/**
 * Logging functionality, shamelessly ripped from gloda
 * If enabled, warnings and above are logged to the error console, while dump
 * gets everything
 */
let _log = null;
function _initLogging()
{
  let formatter = new Log4Moz.BasicFormatter();
  let root = Log4Moz.repository.rootLogger;
  root.level = Log4Moz.Level.Debug;

  this._log = Log4Moz.repository.getLogger("SearchInt");

  let enableConsoleLogging = false;
  let enableDumpLogging = false;

  try
  {
    enableConsoleLogging = gPrefBranch.getBoolPref(gPrefBase + ".logging.console");
    enableDumpLogging = gPrefBranch.getBoolPref(gPrefBase + ".logging.dump");
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
