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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philip Chee <philip.chee@gmail.com>
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

var gFolderDisplay =
{
  nsMsgFolderFlags: Components.interfaces.nsMsgFolderFlags,

  get selectedCount()
  {
    return gDBView ? gDBView.numSelected : 0;
  },

  get selectedMessage()
  {
    if (!this.selectedCount)
      return null;
    return gDBView.hdrForFirstSelectedMessage;
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
