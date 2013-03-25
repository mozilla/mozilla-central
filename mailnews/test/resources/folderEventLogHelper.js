/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Hook up folder notifications to logHelper.js.  This is for the benefit of
 *  gloda but others can benefit too.  Cramming it in gloda's file structure
 *  for now.
 */

Components.utils.import("resource:///modules/mailServices.js");

function registerFolderEventLogHelper() {
  // Bail if there's no one on the other end who cares about our very
  //  expensive log additions.
  // This stuff might be useful for straight console debugging, but it'll
  //  be costly in the success case, so no go for now.
  if (!logHelperHasInterestedListeners())
    return;

  MailServices.mailSession.AddFolderListener(_folderEventLogHelper_folderListener,
                                             Ci.nsIFolderListener.propertyFlagChanged |
                                             Ci.nsIFolderListener.event);
  MailServices.mfn.addListener(_folderEventLogHelper_msgFolderListener,
        Ci.nsIMsgFolderNotificationService.msgAdded |
        Ci.nsIMsgFolderNotificationService.msgsClassified |
        Ci.nsIMsgFolderNotificationService.msgsDeleted |
        Ci.nsIMsgFolderNotificationService.msgsMoveCopyCompleted |
        Ci.nsIMsgFolderNotificationService.msgKeyChanged |
        Ci.nsIMsgFolderNotificationService.folderAdded |
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
    for (let msgHdr in fixIterator(aMsgs, Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    mark_action("msgEvent", "msgsClassified", args);
  },

  msgsDeleted: function felh_msgsDeleted(aMsgs) {
    let args = [];
    for (let msgHdr in fixIterator(aMsgs, Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    mark_action("msgEvent", "msgsDeleted", args);
  },

  msgsMoveCopyCompleted: function felh_msgsMoveCopyCompleted(aMove, aSrcMsgs,
                                                             aDestFolder,
                                                             aDestMsgs) {
    let args = [aMove ? "moved" : "copied"];
    for (let msgHdr in fixIterator(aSrcMsgs, Components.interfaces.nsIMsgDBHdr)) {
      args.push(msgHdr);
    }
    args.push("to");
    args.push(aDestFolder);
    if (aDestMsgs) {
      args.push("dest headers:");
      for (let msgHdr in fixIterator(aDestMsgs, Components.interfaces.nsIMsgDBHdr)) {
        args.push(msgHdr);
      }
    }
    mark_action("msgEvent", "msgsMoveCopyCompleted", args);
  },

  msgKeyChanged: function felh_msgKeyChanged(aOldMsgKey, aNewMsgHdr) {
    let args = ["old key", aOldMsgKey, "new header", aNewMsgHdr];
    mark_action("msgEvent", "msgKeyChanged", args);
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

