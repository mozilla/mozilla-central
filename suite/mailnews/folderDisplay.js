/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gFolderDisplay =
{
  nsMsgFolderFlags: Components.interfaces.nsMsgFolderFlags,

  get selectedCount()
  {
    return gDBView ? gDBView.numSelected : 0;
  },

  get selectedMessage()
  {
    if (!this.selectedIndices.length)
      return null;
    return gDBView.hdrForFirstSelectedMessage;
  },

  get selectedMessageUri()
  {
    if (!this.selectedIndices.length)
      return null;
    return gDBView.URIForFirstSelectedMessage;
  },

  get selectedMessageIsFeed()
  {
    var message = this.selectedMessage;
    return message && message.folder &&
           message.folder.server.type == "rss";
  },

  get selectedMessageIsImap()
  {
    var message = this.selectedMessage;
    return message && message.folder &&
           (message.folder.flags & this.nsMsgFolderFlags.ImapBox) != 0;
  },

  get selectedMessageIsNews()
  {
    var message = this.selectedMessage;
    return message && message.folder &&
           (message.folder.flags & this.nsMsgFolderFlags.Newsgroup) != 0;
  },

  get selectedMessageIsExternal()
  {
    var message = this.selectedMessage;
    return message && !message.folder;
  },

  get selectedIndices()
  {
    return gDBView ? gDBView.getIndicesForSelection({}) : [];
  },

  get selectedMessages()
  {
    var msgHdrs = [];
    if (gDBView)
    {
      var array = gDBView.getMsgHdrsForSelection();
      for (let i = 0; i < array.length; i++)
      {
        msgHdrs.push(array.queryElementAt(i, Components.interfaces.nsIMsgDBHdr));
      }
    }
    return msgHdrs;
  },

  get selectedMessageUris()
  {
    if (!gDBView)
      return null;
    var messageArray = gDBView.getURIsForSelection({});
    return messageArray.length ? messageArray : null;
  },

  get canArchiveSelectedMessages()
  {
    if (!gDBView)
      return false;
    var selectedMessages = this.selectedMessages;
    if (selectedMessages.length == 0)
      return false;
    return selectedMessages.every(function(aMsg) GetIdentityForHeader(aMsg).archiveEnabled);
  },

  get displayedFolder()
  {
    return gMsgFolderSelected;
  }

}

var gMessageDisplay =
{
  get displayedMessage()
  {
    if (!gDBView)
      return null;
    var viewIndex = gDBView.currentlyDisplayedMessage;
    return viewIndex == nsMsgViewIndex_None ? null :
                                              gDBView.getMsgHdrAt(viewIndex);
  },

  get isDummy()
  {
    return gDBView && gDBView.keyForFirstSelectedMessage == nsMsgKey_None;
  },

  get visible()
  {
    return !GetMessagePane().collapsed;
  },

  set visible(aVisible)
  {
    return aVisible; // Fake setter for the time being.
  }
}

gFolderDisplay.messageDisplay = gMessageDisplay;
