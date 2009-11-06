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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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
 * Hook up folder notifications to logHelper.js.  This is for the benefit of
 *  gloda but others can benefit too.  Cramming it in gloda's file structure
 *  for now.
 */

function registerFolderEventLogHelper() {
  // Bail if there's no one on the other end who cares about our very
  //  expensive log additions.
  // This stuff might be useful for straight console debugging, but it'll
  //  be costly in the success case, so no go for now.
  if (!logHelperHasInterestedListeners())
    return;

  let mailSession = Cc["@mozilla.org/messenger/services/session;1"].
    getService(Ci.nsIMsgMailSession);
  mailSession.AddFolderListener(_folderEventLogHelper_folderListener,
                                Ci.nsIFolderListener.propertyFlagChanged |
                                Ci.nsIFolderListener.event);
  let notificationService =
    Cc["@mozilla.org/messenger/msgnotificationservice;1"]
      .getService(Ci.nsIMsgFolderNotificationService);
  notificationService.addListener(_folderEventLogHelper_msgFolderListener,
        Ci.nsIMsgFolderNotificationService.msgAdded |
        Ci.nsIMsgFolderNotificationService.msgsClassified |
        Ci.nsIMsgFolderNotificationService.msgsDeleted |
        Ci.nsIMsgFolderNotificationService.msgsMoveCopyCompleted |
        Ci.nsIMsgFolderNotificationService.folderDeleted |
        Ci.nsIMsgFolderNotificationService.folderMoveCopyCompleted |
        Ci.nsIMsgFolderNotificationService.folderRenamed |
        Ci.nsIMsgFolderNotificationService.itemEvent);
}

/**
 * nsIMsgFolderListener implementation to logHelper events that gloda cares
 *  about.
 */
let _folderEventLogHelper_msgFolderListener = {
  msgAdded: function felh_msgAdded(aMsg) {
    mark_action("msgEvent", "msgAdded", [aMsg]);
  },

  msgsClassified: function felh_msgsClassified(aMsgs, aJunkProcessed,
                                               aTraitProcessed) {
    let args = [
      aJunkProcessed ? "junk processed" : "did not junk process",
      aTraitProcessed ? "trait processed" : "did not trait process"
    ];
    for each (let msgHdr in fixIterator(aMsgs.enumerate(),
                                        Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    mark_action("msgEvent", "msgsClassified", args);
  },

  msgsDeleted: function felh_msgsDeleted(aMsgs) {
    let args = [];
    for each (let msgHdr in fixIterator(aMsgs.enumerate(),
                                        Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    mark_action("msgEvent", "msgsDeleted", args);
  },

  msgsMoveCopyCompleted: function felh_msgsMoveCopyCompleted(aMove, aSrcMsgs,
                                                             aDestFolder,
                                                             aDestMsgs) {
    let args = [aMove ? "moved" : "copied"];
    for each (let msgHdr in fixIterator(aSrcMsgs.enumerate(),
                                        Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    args.push("to");
    args.push(aDestFolder);
    if (aDestMsgs) {
      args.push("dest headers:");
      for each (let msgHdr in fixIterator(aDestMsgs.enumerate(),
                                          Components.interfaces.nsIMsgDBHdr)) {
        args.push(msgHdr);
      }
    }
    mark_action("msgEvent", "msgsMoveCopyCompleted", args);
  },

  folderAdded: function felh_folderAdded(aFolder) {
    mark_action("msgEvent", "folderAdded", [aFolder]);
  },

  folderDeleted: function felh_folderDeleted(aFolder) {
    mark_action("msgEvent", "folderDeleted", [aFolder]);
  },

  folderMoveCopyCompleted: function felh_folderMoveCopyCompleted(aMove,
                                                                 aSrcFolder,
                                                                 aDestFolder) {
    mark_action("msgEvent", "folderMoveCopyCompleted",
                [aMove ? "move" : "copy",
                 aSrcFolder, "to", aDestFolder]);
  },

  folderRenamed: function felh_folderRenamed(aOrigFolder, aNewFolder) {
    mark_action("msgEvent", "folderRenamed", [aOrigFolder, "to", aNewFolder]);
  },

  itemEvent: function felh_itemEvent(aItem, aEvent, aData) {
    mark_action("msgEvent", "itemEvent", [aItem, aEvent, aData]);
  }
};


/**
 * nsIFolderListener implementation to logHelper stuff that gloda cares about.
 */
let _folderEventLogHelper_folderListener = {
  OnItemAdded: function felh_OnItemAdded(aParentItem, aItem) {
  },
  OnItemRemoved: function felh_OnItemRemoved(aParentItem, aItem) {
  },
  OnItemPropertyChanged: function felh_OnItemPropertyChanged(
    aItem, aProperty, aOldValue, aNewValue) {
  },
  OnItemIntPropertyChanged: function felh_OnItemIntPropertyChanged(
    aItem, aProperty, aOldValue, aNewValue) {
  },
  OnItemBoolPropertyChanged: function felh_OnItemBoolPropertyChanged(
    aItem, aProperty, aOldValue, aNewValue) {
  },
  OnItemUnicharPropertyChanged: function felh_OnItemUnicharPropertyChanged(
    aItem, aProperty, aOldValue, aNewValue) {
  },
  /**
   * Notice when user activity adds/removes tags or changes a message's
   *  status.
   */
  OnItemPropertyFlagChanged: function felh_OnItemPropertyFlagChanged(
      aMsgHdr, aProperty, aOldValue, aNewValue) {
    mark_action("msgEvent", "OnItemPropertyFlagChanged",
                ["Header", aMsgHdr,
                 "had property " + aProperty.toString() + " have the " +
                 "following bits change: " +
                 _explode_flags(aOldValue ^ aNewValue,
                                Components.interfaces.nsMsgMessageFlags)]);
  },

  /**
   * Get folder loaded notifications for folders that had to do some
   *  (asynchronous) processing before they could be opened.
   */
  OnItemEvent: function felh_OnItemEvent(aFolder, aEvent) {
    mark_action("msgEvent", "OnItemEvent",
                [aFolder, aEvent.toString()]);
  },
};

