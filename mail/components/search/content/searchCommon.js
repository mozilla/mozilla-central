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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

var gCurrentFolderToIndex;
var gLastFolderIndexedUri = ""; // this is stored in a pref
var gHeaderEnumerator;
var gMsgHdrsToIndex;
var gMessenger;
var gAlarm;
var gBackgroundIndexingDone;
var gPrefBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch(null);
var gEnabled;

/*
 * Init function -- this should be called from the component's init function
 */
function InitSupportIntegration(enabled)
{
  SIDump("Search integration running in " + (enabled ? "active" : "backoff") + " mode\n");
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

    restartTimer(60);
  }
  else
    notificationService.addListener(gFolderListener, notificationService.msgsMoveCopyCompleted |
                                    notificationService.msgsDeleted |
                                    notificationService.allFolderNotifications);
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
    SIDump("in find next folder, gLastFolderIndexedUri = " + gLastFolderIndexedUri + "\n");
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

function onTimer()
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
    SIDump("reached end of folder\n");
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
  restartTimer(gMsgHdrsToIndex.length > 1 ? 5 : 1);
}

function restartTimer(seconds)
{
  if (gAlarm)
    gAlarm.cancel();
  var jslib = Cc["@mozilla.org/url-classifier/jslib;1"]
    .getService().wrappedJSObject;

  gAlarm = new jslib.G_Alarm(onTimer, seconds*1000);
}

/*
 * This object gets notifications for messages that are read, giving them a
 * higher priority
 */
var MsgMsgDisplayedObserver =
{
  // Components.interfaces.nsIObserver
  observe: function(aHeaderSink, aTopic, aData)
    {
    // if the user is reading messages, we're not idle, so restart timer.
    restartTimer(60);
    SIDump("topic = " + aTopic + " uri = " + aData + "\n");
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
    SIDump("in msgAdded\n");
    restartTimer(30);
    // The message already being there is an expected case
    var file = GetSupportFileForMsgHdr(aMsg);
    if (!file.exists())
      QueueMessageToGetIndexed(aMsg);
  },

  msgsDeleted: function(aMsgs)
  {
    SIDump("in msgsDeleted\n");
    // mail getting deleted, we're not idle, so restart timer.
    if (gEnabled)
      restartTimer(60);
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
    SIDump("in msgsMoveCopyCompleted\n");
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
          catch(ex) {SIDump(ex);}
        }
        SIDump ("dst file path = " + destFile.path + "\n");
        SIDump ("src file path = " + srcFile.path + "\n");
        // We're not going to copy in case we're not in active mode
        if (destFile.exists())
          if (aMove)
            srcFile.moveTo(destFile, "");
          else if (gEnabled)
            srcFile.copyTo(destFile, "");
      }
    }
    if (gEnabled)
      restartTimer(30);
    SIDump("moveCopyCompleted move = " + aMove + "\n");
  },

  folderDeleted: function(aFolder)
  {
    SIDump("in folderDeleted, folder name = " + aFolder.prettiestName + "\n");
    var srcFile = aFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    if (srcFile.exists())
      srcFile.remove(true);
  },

  folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
  {
    SIDump("in folderMoveCopyCompleted, aMove = " + aMove + "\n");
    var srcFile = aSrcFolder.filePath;
    var destFile = aDestFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    destFile.leafName += ".sbd";
    SIDump("src file path = " + srcFile.path + "\n");
    SIDump("dst file path = " + destFile.path + "\n");
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
    SIDump("in folderRenamed, aOrigFolder = "+aOrigFolder.prettiestName+", aNewFolder = "+aNewFolder.prettiestName+"\n");
    var srcFile = aOrigFolder.filePath;
    srcFile.leafName = srcFile.leafName + ".mozmsgs";
    var destName = aNewFolder.name + ".mozmsgs";
    SIDump("src file path = " + srcFile.path + "\n");
    SIDump("dst name = " + destName + "\n");
    if (srcFile.exists())
      srcFile.moveTo(null, destName);
  },

  itemEvent: function(aItem, aEvent, aData)
  {
    SIDump("in itemEvent, aItem = "+aItem+", aEvent = "+aEvent+", aData = "+aData+"\n");
  }
};

/*
 * Support functions to queue/generate files
 */
function QueueMessageToGetIndexed(msgHdr)
{
  if (gMsgHdrsToIndex.push(msgHdr) == 1)
  {
    SIDump("generating support file\n");
    GenerateSupportFile(msgHdr);
  }
  else
    SIDump("queueing support file generation\n");
}

function GetSupportFileForMsgHdr(msgHdr)
{
  var folder = msgHdr.folder;
  if (folder)
  {
    var messageId = msgHdr.messageId;
    messageId = encodeURIComponent(messageId);
    SIDump("encoded message id = " + messageId + "\n");
    // this should work on the trunk, but not in 2.0
//    messageId = netUtils.escapeString(messageId, 3 /* netUtils.ESCAPE_URL_PATH */);
    if (folder)
    {
      var file = folder.filePath;
      file.leafName = file.leafName + ".mozmsgs";
      file.appendRelativePath(messageId + gFileExt);
      SIDump("getting support file path = " + file.path + "\n");
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
      SIDump("generate support file, message id = " + messageId + "\n");
      var file = folder.filePath;

      file.leafName = file.leafName + ".mozmsgs";
      SIDump("file leafname = " + file.leafName + "\n");
      if (!file.exists())
      {
        try
        {
          // create the directory, if it doesn't exist
          file.create(Ci.nsIFile.DIRECTORY_TYPE, 0644);
        }
        catch(ex) {SIDump(ex);}
      }
      gStreamListener.msgHdr = msgHdr;

      file.appendRelativePath(messageId + gFileExt);
      //file.leafName = messageId + gFileExt;
      SIDump("file path = " + file.path + "\n");
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
        SIDump("StreamMessage not successful\n");
        gStreamListener.onDoneStreamingCurMessage(false);
      }
    }
  }
  catch (ex)
  {
    SIDump(ex);
    gStreamListener.onDoneStreamingCurMessage(false);
  }
}

/* Debug function */
var gSIDump = true;
function SIDump(str)
{
  if (gSIDump)
    dump(str);
}
