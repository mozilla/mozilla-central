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
  *   MsgJunkMailInfo(aCheckFirstUse)
  *   SetNextMessageAfterDelete()
  *   pref
  */
 
const NS_BAYESIANFILTER_CONTRACTID = "@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter";
const nsIJunkMailPlugin = Components.interfaces.nsIJunkMailPlugin;
var gJunkmailComponent;

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
  if (spamSettings.moveOnSpam && !(aFolder.flags & MSG_FOLDER_FLAG_JUNK))
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
 * @param aMsgHdrs
 *        nsIArray containing headers (nsIMsgDBHdr) of new junk messages
 *
 */
 function performActionsOnJunkMsgs(aFolder, aMsgHdrs)
{
  if (!aMsgHdrs.length)
    return;
  var actionParams = determineActionsForJunkMsgs(aFolder);
  if (actionParams.markRead)
    aFolder.markMessagesRead(aMsgHdrs, true);

  if (actionParams.junkTargetFolder)
  {
    var copyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"].
                        getService(Components.interfaces.nsIMsgCopyService);
    copyService.CopyMessages(aFolder, aMsgHdrs, actionParams.junkTargetFolder, true /* isMove */, null,
                             msgWindow, true /* allow undo */);
  }
}

function getJunkmailComponent()
{
  if (!gJunkmailComponent)
    gJunkmailComponent = Components.classes[NS_BAYESIANFILTER_CONTRACTID].getService(nsIJunkMailPlugin);
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
  this.mJunkMsgHdrs = Components.classes["@mozilla.org/array;1"].
                        createInstance(Components.interfaces.nsIMutableArray);
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
   * @param aWhiteListDirectory
   *        The addressbook (nsIAbMDBDirectory) to use as a whitelist, or null
   *        if no whitelisting should be done.
   */
  analyzeMessage: function(aMsgHdr, aWhiteListDirectory)
  { 
    var junkscoreorigin = aMsgHdr.getStringProperty("junkscoreorigin");
    if (junkscoreorigin == "user") // don't override user-set junk status
      return;

    // if a whitelist addressbook was specified, check if the email address is in it
    if (aWhiteListDirectory)
    {
      var headerParser = Components.classes["@mozilla.org/messenger/headerparser;1"].
                         getService(Components.interfaces.nsIMsgHeaderParser);
      var authorEmailAddress = headerParser.extractHeaderAddressMailboxes(null, aMsgHdr.author);
      if (aWhiteListDirectory.cardForEmailAddress(authorEmailAddress))
      {
        // message is ham from whitelist
        {
          var db = aMsgHdr.folder.getMsgDatabase(msgWindow);
          db.setStringProperty(aMsgHdr.messageKey, "junkscore", nsIJunkMailPlugin.IS_HAM_SCORE);
          db.setStringProperty(aMsgHdr.messageKey, "junkscoreorigin", "whitelist");
        }
        return;
      }
    }

    var messageURI = aMsgHdr.folder.generateMessageURI(aMsgHdr.messageKey) + "?fetchCompleteMessage=true";
    this.mMessages[messageURI] = aMsgHdr;
    if (this.firstMessage)
    {
      this.firstMessage = false;
      gJunkmailComponent.classifyMessage(messageURI, msgWindow, this);
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
    var score = (aClassification == nsIJunkMailPlugin.JUNK) ?
      nsIJunkMailPlugin.IS_SPAM_SCORE : nsIJunkMailPlugin.IS_HAM_SCORE;
    const statusDisplayInterval = 1000; // milliseconds between status updates

    // set these props via the db (instead of the message header
    // directly) so that the nsMsgDBView knows to update the UI
    //
    var msgHdr = this.mMessages[aClassifiedMsgURI];
    var db = msgHdr.folder.getMsgDatabase(msgWindow);
    db.setStringProperty(msgHdr.messageKey, "junkscore", score);
    db.setStringProperty(msgHdr.messageKey, "junkscoreorigin", "plugin");
    db.setStringProperty(msgHdr.messageKey, "junkpercent", aJunkPercent);

    if (aClassification == nsIJunkMailPlugin.JUNK)
      this.mJunkMsgHdrs.appendElement(msgHdr, false);

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
        window.MsgStatusFeedback.showStatusString(gMessengerBundle.
               getFormattedString("junkAnalysisPercentComplete", [percentStr]));
      }

      gJunkmailComponent.classifyMessage(nextMsgURI, msgWindow, this);
    }
    else
    {
      window.MsgStatusFeedback.showStatusString(gMessengerBundle.
             getString("processingJunkMessages"));
      performActionsOnJunkMsgs(this.mFolder, this.mJunkMsgHdrs);
      // empty the processed array in case more messages are added
      this.mJunkMsgHdrs.clear();
      window.MsgStatusFeedback.showStatusString("");
    }
  }
}

/*
 * filterFolderForJunk
 *
 * Filter all messages in the current folder for junk
 */
function filterFolderForJunk()
{ processFolderForJunk(true);}

/*
 * analyzeMessagesForJunk
 *
 * Filter selected messages in the current folder for junk
 */
function analyzeMessagesForJunk()
{ processFolderForJunk(false);}

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
  getJunkmailComponent();

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

  // retrieve server and its spam settings via the header of an arbitrary message
  var tmpMsgURI = gDBView.getURIForViewIndex(0);
  var tmpMsgHdr = messenger.messageServiceFromURI(tmpMsgURI).messageURIToMsgHdr(tmpMsgURI);
  var spamSettings = tmpMsgHdr.folder.server.spamSettings;

  // if enabled in the spam settings, retrieve whitelist addressbook
  var whiteListDirectory = null;
  if (spamSettings.useWhiteList && spamSettings.whiteListAbURI)
    whiteListDirectory = RDF.GetResource(spamSettings.whiteListAbURI).QueryInterface(Components.interfaces.nsIAbMDBDirectory);

  var totalMessages = aAll ? count : indices.length;
  // create a classifier instance to classify messages in the folder.
  var msgClassifier = new MessageClassifier(tmpMsgHdr.folder, totalMessages);

  for ( i = 0; i < totalMessages; i++)
  {
    var index = aAll ? i : indices[i];

    try
    {
      var msgURI = gDBView.getURIForViewIndex(index);
    }
    catch (ex)
    {
      // blow off errors here - dummy headers will fail
      var msgURI = null;
    }
    if (msgURI)
    {
      var msgHdr = messenger.messageServiceFromURI(msgURI).messageURIToMsgHdr(msgURI);
      msgClassifier.analyzeMessage(msgHdr, whiteListDirectory);
    }
  }
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
    var isJunk = ((junkScore != "") && (junkScore != nsIJunkMailPlugin.IS_HAM_SCORE));
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
  // XXX todo
  // Should we try to set next message after delete
  // to the message selected before we did all this, if it was not junk?
  SetNextMessageAfterDelete();
  gDBView.doCommand(nsMsgViewCommandType.deleteMsg);
  treeSelection.clearSelection();
}

