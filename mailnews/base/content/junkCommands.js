/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 /* functions use for junk processing commands
  *
  * TODO: These functions make the false assumption that a view only contains
  *       a single folder. This is not true for XF saved searches.
  *
  * globals prerequisites used:
  *
  *   window.MsgStatusFeedback
  *
  *   One of:
  *     GetSelectedIndices(view) (in suite)
  *     gFolderDisplay (in mail)
  *
  *   messenger
  *   gMessengerBundle
  *   gDBView
  *   either gMsgFolderSelected or gFolderDisplay
  *   MsgJunkMailInfo(aCheckFirstUse)
  *   SetNextMessageAfterDelete()
  *   pref
  *   msgWindow
  */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");

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
      actions.junkTargetFolder = MailUtils.getFolderForURI(spamFolderURI);
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
      MailServices.copy
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
   * sender's address is whitelisted, the message is skipped.
   *
   * @param aMsgHdr
   *        The header (nsIMsgDBHdr) of the message to classify.
   * @param aSpamSettings
   *        nsISpamSettings object with information about whitelists
   */
  analyzeMessage: function(aMsgHdr, aSpamSettings)
  {
    var junkscoreorigin = aMsgHdr.getStringProperty("junkscoreorigin");
    if (junkscoreorigin == "user") // don't override user-set junk status
      return;

    // check whitelisting
    if (aSpamSettings.checkWhiteList(aMsgHdr))
    {
      // message is ham from whitelist
      var db = aMsgHdr.folder.msgDatabase;
      db.setStringProperty(aMsgHdr.messageKey, "junkscore",
                           Components.interfaces.nsIJunkMailPlugin.IS_HAM_SCORE);
      db.setStringProperty(aMsgHdr.messageKey, "junkscoreorigin", "whitelist");
      this.mGoodMsgHdrs.appendElement(aMsgHdr, false);
      return;
    }

    var messageURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey) + "?fetchCompleteMessage=true";
    this.mMessages[messageURI] = aMsgHdr;
    if (this.firstMessage)
    {
      this.firstMessage = false;
      MailServices.junk.classifyMessage(messageURI, msgWindow, this);
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
    if (!aClassifiedMsgURI)
      return; // ignore end of batch
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
            document.getElementById("bundle_messenger")
            .getFormattedString("junkAnalysisPercentComplete",
            [percentStr]));
      }

      MailServices.junk.classifyMessage(nextMsgURI, msgWindow, this);
    }
    else
    {
      window.MsgStatusFeedback.showStatusString(
          document.getElementById("bundle_messenger")
          .getString("processingJunkMessages"));
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
    // suite uses GetSelectedIndices, mail uses gFolderDisplay.selectedMessages
    var indices = typeof GetSelectedIndices != "undefined" ?
                    GetSelectedIndices(gDBView) :
                    gFolderDisplay.selectedIndices;
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

  // create a classifier instance to classify messages in the folder.
  var msgClassifier = new MessageClassifier(tmpMsgHdr.folder, totalMessages);

  for ( i = 0; i < totalMessages; i++)
  {
    var index = aAll ? i : indices[i];
    try
    {
      var msgURI = gDBView.getURIForViewIndex(index);
      var msgHdr = messenger.messageServiceFromURI(msgURI).messageURIToMsgHdr(msgURI);
      msgClassifier.analyzeMessage(msgHdr, spamSettings);
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

  if (setAsJunk && Services.prefs.getBoolPref("mailnews.ui.junk.manualMarkAsJunkMarksRead"))
    MarkSelectedMessagesRead(true);

  gDBView.doCommand(setAsJunk ? nsMsgViewCommandType.junk
                              : nsMsgViewCommandType.unjunk);
}

/**
 * Delete junk messages in the current folder. This provides the guarantee that
 * the method will be synchronous if no messages are deleted.
 *
 * @returns The number of messages deleted.
 */
function deleteJunkInFolder()
{
  MsgJunkMailInfo(true);

  // use direct folder commands if possible so we don't mess with the selection
  let selectedFolder = gFolderDisplay.displayedFolder;
  if ( !(selectedFolder.flags & Components.interfaces.nsMsgFolderFlags.Virtual) )
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
    return junkMsgHdrs.length;
  }

  // Folder is virtual, let the view do the work (but we lose selection)

  // need to expand all threads, so we find everything
  gDBView.doCommand(nsMsgViewCommandType.expandAll);

  var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
  var count = treeView.rowCount;
  if (!count)
    return 0;

  var treeSelection = treeView.selection;

  var clearedSelection = false;

  // select the junk messages
  var messageUri;
  let numMessagesDeleted = 0;
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
      numMessagesDeleted++;
    }
  }

  // if we didn't clear the selection
  // there was no junk, so bail.
  if (!clearedSelection)
    return 0;

  treeSelection.selectEventsSuppressed = false;
  // delete the selected messages
  //
  // We'll leave no selection after the delete
  gNextMessageViewIndexAfterDelete = nsMsgViewIndex_None;
  gDBView.doCommand(nsMsgViewCommandType.deleteMsg);
  treeSelection.clearSelection();
  ClearMessagePane();
  return numMessagesDeleted;
}

