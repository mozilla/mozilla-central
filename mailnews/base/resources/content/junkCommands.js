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
 * The Original Code is split from mailCommands.js, which is Mozilla
 * Communicator client code, released March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Kent James <kent@caspia.com>
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

 /* functions use for junk processing commands
  *
  * TODO: These functions make the false assumption that a view only contains
  *       a single folder. This is not true for XF saved searches.
  *
  * globals prerequisites used:
  *
  *   window.MsgStatusFeedback
  *   GetSelectedIndices(view)
  *   messenger
  *   gMessengerBundle
  *   gDBView
  *   gMsgFolderSelected
  *   MsgJunkMailInfo(aCheckFirstUse)
  *   SetNextMessageAfterDelete()
  *   pref
  *   msgWindow
  */

/*
 * determineActionsForJunkMsgs
 *
 * Determines the actions that should be carried out on the messages
 * that are being marked as junk
 *
 * @param aFolder
 *        the folder with messages being marked as junk
 *
 * @return an object with two properties: 'markRead' (boolean) indicating
 *         whether the messages should be marked as read, and 'junkTargetFolder'
 *         (nsIMsgFolder) specifying where the messages should be moved, or
 *         null if they should not be moved.
 */
function determineActionsForJunkMsgs(aFolder)
{
  var actions = { markRead: false, junkTargetFolder: null };
  var spamSettings = aFolder.server.spamSettings;

  // note we will do moves/marking as read even if the spam
  // feature is disabled, since the user has asked to use it
  // despite the disabling

  actions.markRead = spamSettings.markAsReadOnSpam;
  actions.junkTargetFolder = null;

  // move only when the corresponding setting is activated
  // and the currently viewed folder is not the junk folder.
  if (spamSettings.moveOnSpam &&
      !(aFolder.flags & Components.interfaces.nsMsgFolderFlags.Junk))
  {
    var spamFolderURI = spamSettings.spamFolderURI;
    if (!spamFolderURI)
    {
      // XXX TODO
      // we should use nsIPromptService to inform the user of the problem,
      // e.g. when the junk folder was accidentally deleted.
      dump('determineActionsForJunkMsgs: no spam folder found, not moving.');
    }
    else
      actions.junkTargetFolder = GetMsgFolderFromUri(spamFolderURI);
  }

  return actions;
}

/**
 * performActionsOnJunkMsgs
 *
 * Performs required operations on a list of newly-classified junk messages
 *
 * @param aFolder
 *        the folder with messages being marked as junk
 *
 * @param aJunkMsgHdrs
 *        nsIArray containing headers (nsIMsgDBHdr) of new junk messages
 *
 * @param aGoodMsgHdrs
 *        nsIArray containing headers (nsIMsgDBHdr) of new good messages
 */
 function performActionsOnJunkMsgs(aFolder, aJunkMsgHdrs, aGoodMsgHdrs)
{
  if (aFolder instanceof Components.interfaces.nsIMsgImapMailFolder) // need to update IMAP custom flags
  {
    if (aJunkMsgHdrs.length)
    {
      var junkMsgKeys = new Array();
      for (var i = 0; i < aJunkMsgHdrs.length; i++)
        junkMsgKeys[i] = aJunkMsgHdrs.queryElementAt(i, Components.interfaces.nsIMsgDBHdr).messageKey;
      aFolder.storeCustomKeywords(null, "Junk", "NonJunk", junkMsgKeys, junkMsgKeys.length);
    }

    if (aGoodMsgHdrs.length)
    {
      var goodMsgKeys = new Array();
      for (var i = 0; i < aGoodMsgHdrs.length; i++)
        goodMsgKeys[i] = aGoodMsgHdrs.queryElementAt(i, Components.interfaces.nsIMsgDBHdr).messageKey;
      aFolder.storeCustomKeywords(null, "NonJunk", "Junk", goodMsgKeys, goodMsgKeys.length);
    }
  }

  if (aJunkMsgHdrs.length)
  {
    var actionParams = determineActionsForJunkMsgs(aFolder);
    if (actionParams.markRead)
      aFolder.markMessagesRead(aJunkMsgHdrs, true);

    if (actionParams.junkTargetFolder)
      Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Components.interfaces.nsIMsgCopyService)
                .CopyMessages(aFolder, aJunkMsgHdrs, actionParams.junkTargetFolder,
                  true /* isMove */, null, msgWindow, true /* allow undo */);
  }
}

/**
 * MessageClassifier
 *
 * Helper object storing the list of pending messages to process,
 * and implementing junk processing callback
 *
 * @param aFolder
 *        the folder with messages to be analyzed for junk
 * @param aTotalMessages
 *        Number of messages to process, used for progress report only
 */

function MessageClassifier(aFolder, aTotalMessages)
{
  this.mFolder = aFolder;
  this.mJunkMsgHdrs = Components.classes["@mozilla.org/array;1"]
                                .createInstance(Components.interfaces.nsIMutableArray);
  this.mGoodMsgHdrs = Components.classes["@mozilla.org/array;1"]
                                .createInstance(Components.interfaces.nsIMutableArray);
  this.mMessages = new Object();
  this.mMessageQueue = new Array();
  this.mTotalMessages = aTotalMessages;
  this.mProcessedMessages = 0;
  this.firstMessage = true;
  this.lastStatusTime = Date.now();
}

MessageClassifier.prototype =
{
  /**
   * analyzeMessage
   *
   * Starts the message classification process for a message. If the message
   * sender's address is in the address book specified by aWhiteListDirectory,
   * the message is skipped.
   *
   * @param aMsgHdr
   *        The header (nsIMsgDBHdr) of the message to classify.
   * @param aWhiteListDirectories
   *        Array of addressbooks (nsIAbDirectory) to use as a whitelist, or zero
   *        length if no whitelisting should be done.
   */
  analyzeMessage: function(aMsgHdr, aWhiteListDirectories)
  {
    var junkscoreorigin = aMsgHdr.getStringProperty("junkscoreorigin");
    if (junkscoreorigin == "user") // don't override user-set junk status
      return;

    // if a whitelist addressbook was specified, check if the email address is in it
    if (aWhiteListDirectories.length)
    {
      var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"]
                                   .getService(Components.interfaces.nsIMsgHeaderParser);
      var authorEmailAddress = headerParser.extractHeaderAddressMailboxes(aMsgHdr.author);
      var abCard = false;
      for (var abCount = 0; abCount < aWhiteListDirectories.length; abCount++)
      {
        try {
          if (aWhiteListDirectories[abCount].cardForEmailAddress(authorEmailAddress))
          {
            // message is ham from whitelist
            var db = aMsgHdr.folder.msgDatabase;
            db.setStringProperty(aMsgHdr.messageKey, "junkscore",
                                 Components.interfaces.nsIJunkMailPlugin.IS_HAM_SCORE);
            db.setStringProperty(aMsgHdr.messageKey, "junkscoreorigin", "whitelist");
            this.mGoodMsgHdrs.appendElement(aMsgHdr, false);
            return;
          }
        } catch (e) {}
      }
    }

    var messageURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey) + "?fetchCompleteMessage=true";
    this.mMessages[messageURI] = aMsgHdr;
    if (this.firstMessage)
    {
      this.firstMessage = false;
      var junkService = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                  .getService(Components.interfaces.nsIJunkMailPlugin);
      junkService.classifyMessage(messageURI, msgWindow, this);
    }
    else
      this.mMessageQueue.push(messageURI);
  },

  /*
   * nsIJunkMailClassificationListener implementation
   * onMessageClassified
   *
   * Callback function from nsIJunkMailPlugin with classification results
   *
   * @param aClassifiedMsgURI
   *        URI of classified message
   * @param aClassification
   *        Junk classification (0: UNCLASSIFIED, 1: GOOD, 2: JUNK)
   * @param aJunkPercent
   *        0 - 100 indicator of junk likelihood, with 100 meaning probably junk
   */
  onMessageClassified: function(aClassifiedMsgURI, aClassification, aJunkPercent)
  {
    var nsIJunkMailPlugin = Components.interfaces.nsIJunkMailPlugin;
    var score = (aClassification == nsIJunkMailPlugin.JUNK) ?
      nsIJunkMailPlugin.IS_SPAM_SCORE : nsIJunkMailPlugin.IS_HAM_SCORE;
    const statusDisplayInterval = 1000; // milliseconds between status updates

    // set these props via the db (instead of the message header
    // directly) so that the nsMsgDBView knows to update the UI
    //
    var msgHdr = this.mMessages[aClassifiedMsgURI];
    var db = msgHdr.folder.msgDatabase;
    db.setStringProperty(msgHdr.messageKey, "junkscore", score);
    db.setStringProperty(msgHdr.messageKey, "junkscoreorigin", "plugin");
    db.setStringProperty(msgHdr.messageKey, "junkpercent", aJunkPercent);

    if (aClassification == nsIJunkMailPlugin.JUNK)
      this.mJunkMsgHdrs.appendElement(msgHdr, false);
    else if (aClassification == nsIJunkMailPlugin.GOOD)
      this.mGoodMsgHdrs.appendElement(msgHdr, false);

    var nextMsgURI = this.mMessageQueue.shift();
    if (nextMsgURI)
    {
      ++this.mProcessedMessages;
      if (Date.now() > this.lastStatusTime + statusDisplayInterval)
      {
        this.lastStatusTime = Date.now();
        var percentDone = 0;
        if (this.mTotalMessages)
          percentDone = Math.round(this.mProcessedMessages * 100 / this.mTotalMessages);
        var percentStr = percentDone + "%";
        window.MsgStatusFeedback.showStatusString(
            gMessengerBundle.getFormattedString("junkAnalysisPercentComplete",
                                                [percentStr]));
      }

      var junkService = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                  .getService(Components.interfaces.nsIJunkMailPlugin);
      junkService.classifyMessage(nextMsgURI, msgWindow, this);
    }
    else
    {
      window.MsgStatusFeedback.showStatusString(
          gMessengerBundle.getString("processingJunkMessages"));
      performActionsOnJunkMsgs(this.mFolder, this.mJunkMsgHdrs, this.mGoodMsgHdrs);
      window.MsgStatusFeedback.showStatusString("");
    }
  }
}

/*
 * filterFolderForJunk
 *
 * Filter all messages in the current folder for junk
 */
function filterFolderForJunk() { processFolderForJunk(true); }

/*
 * analyzeMessagesForJunk
 *
 * Filter selected messages in the current folder for junk
 */
function analyzeMessagesForJunk() { processFolderForJunk(false); }

/*
 * processFolderForJunk
 *
 * Filter messages in the current folder for junk
 *
 * @param aAll: true to filter all messages, else filter selection
 */
function processFolderForJunk(aAll)
{
  MsgJunkMailInfo(true);

  if (aAll)
  {
    // need to expand all threads, so we analyze everything
    gDBView.doCommand(nsMsgViewCommandType.expandAll);
    var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
    var count = treeView.rowCount;
    if (!count)
      return;
  }
  else
  {
    var indices = GetSelectedIndices(gDBView);
    if (!indices || !indices.length)
      return;
  }
  var totalMessages = aAll ? count : indices.length;

  // retrieve server and its spam settings via the header of an arbitrary message
  for (var i = 0; i < totalMessages; i++)
  {
    var index = aAll ? i : indices[i];
    try
    {
      var tmpMsgURI = gDBView.getURIForViewIndex(index);
      break;
    }
    catch (e)
    {
      // dummy headers will fail, so look for another
      continue;
    }
  }
  if (!tmpMsgURI)
    return;

  var tmpMsgHdr = messenger.messageServiceFromURI(tmpMsgURI).messageURIToMsgHdr(tmpMsgURI);
  var spamSettings = tmpMsgHdr.folder.server.spamSettings;

  // if enabled in the spam settings, retrieve whitelist addressbooks
  var whiteListDirectories = [];
  if (spamSettings.useWhiteList && spamSettings.whiteListAbURI)
  {
    var whiteListAbURIs = spamSettings.whiteListAbURI.split(" ");
    abManager = Components.classes["@mozilla.org/abmanager;1"]
                          .getService(Components.interfaces.nsIAbManager);
    for (var abCount = 0; abCount < whiteListAbURIs.length; abCount++)
      whiteListDirectories.push(abManager.getDirectory(whiteListAbURIs[abCount]));
  }

  // create a classifier instance to classify messages in the folder.
  var msgClassifier = new MessageClassifier(tmpMsgHdr.folder, totalMessages);

  for ( i = 0; i < totalMessages; i++)
  {
    var index = aAll ? i : indices[i];
    try
    {
      var msgURI = gDBView.getURIForViewIndex(index);
      var msgHdr = messenger.messageServiceFromURI(msgURI).messageURIToMsgHdr(msgURI);
      msgClassifier.analyzeMessage(msgHdr, whiteListDirectories);
    }
    catch (ex)
    {
      // blow off errors here - dummy headers will fail
      var msgURI = null;
    }
  }
  if (msgClassifier.firstMessage) // the async plugin was not used, maybe all whitelisted?
    performActionsOnJunkMsgs(msgClassifier.mFolder,
                             msgClassifier.mJunkMsgHdrs,
                             msgClassifier.mGoodMsgHdrs);
}

function JunkSelectedMessages(setAsJunk)
{
  MsgJunkMailInfo(true);

  // When the user explicitly marks a message as junk, we can mark it as read,
  // too. This is independent of the "markAsReadOnSpam" pref, which applies
  // only to automatically-classified messages.
  // Note that this behaviour should match the one in the back end for marking
  // as junk via clicking the 'junk' column.

  if (setAsJunk && pref.getBoolPref("mailnews.ui.junk.manualMarkAsJunkMarksRead"))
    MarkSelectedMessagesRead(true);

  gDBView.doCommand(setAsJunk ? nsMsgViewCommandType.junk
                              : nsMsgViewCommandType.unjunk);
}

function deleteJunkInFolder()
{
  MsgJunkMailInfo(true);

  // use direct folder commands if possible so we don't mess with the selection
  if ( !(gMsgFolderSelected.flags & Components.interfaces.nsMsgFolderFlags.Virtual) )
  {
    var junkMsgHdrs = Components.classes["@mozilla.org/array;1"]
                                .createInstance(Components.interfaces.nsIMutableArray);
    var enumerator = gDBView.msgFolder.messages;
    while (enumerator.hasMoreElements())
    {
      var msgHdr = enumerator.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
      var junkScore = msgHdr.getStringProperty("junkscore");
      if (junkScore == Components.interfaces.nsIJunkMailPlugin.IS_SPAM_SCORE)
        junkMsgHdrs.appendElement(msgHdr, false);
    }

    if (junkMsgHdrs.length)
      gDBView.msgFolder.deleteMessages(junkMsgHdrs, msgWindow, false, false, null, true);
    return;
  }

  // Folder is virtual, let the view do the work (but we lose selection)

  // need to expand all threads, so we find everything
  gDBView.doCommand(nsMsgViewCommandType.expandAll);

  var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
  var count = treeView.rowCount;
  if (!count)
    return;

  var treeSelection = treeView.selection;

  var clearedSelection = false;

  // select the junk messages
  var messageUri;
  for (var i = 0; i < count; ++i)
  {
    try {
      messageUri = gDBView.getURIForViewIndex(i);
    }
    catch (ex) {continue;} // blow off errors for dummy rows
    var msgHdr = messenger.messageServiceFromURI(messageUri).messageURIToMsgHdr(messageUri);
    var junkScore = msgHdr.getStringProperty("junkscore");
    var isJunk = (junkScore == Components.interfaces.nsIJunkMailPlugin.IS_SPAM_SCORE);
    // if the message is junk, select it.
    if (isJunk)
    {
      // only do this once
      if (!clearedSelection)
      {
        // clear the current selection
        // since we will be deleting all selected messages
        treeSelection.clearSelection();
        clearedSelection = true;
        treeSelection.selectEventsSuppressed = true;
      }
      treeSelection.rangedSelect(i, i, true /* augment */);
    }
  }

  // if we didn't clear the selection
  // there was no junk, so bail.
  if (!clearedSelection)
    return;

  treeSelection.selectEventsSuppressed = false;
  // delete the selected messages
  //
  // We'll leave no selection after the delete
  gNextMessageViewIndexAfterDelete = nsMsgViewIndex_None;
  gDBView.doCommand(nsMsgViewCommandType.deleteMsg);
  treeSelection.clearSelection();
  ClearMessagePane();
}

