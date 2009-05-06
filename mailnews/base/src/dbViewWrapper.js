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

EXPORTED_SYMBOLS = ['DBViewWrapper', 'IDBViewWrapperListener'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/mailViewManager.js");
Cu.import("resource://app/modules/searchSpec.js");
Cu.import("resource://app/modules/virtualFolderWrapper.js");

const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
const nsMsgViewType = Ci.nsMsgViewType;
const nsMsgViewFlagsType = Ci.nsMsgViewFlagsType;
const nsMsgViewSortType = Ci.nsMsgViewSortType;

/**
 * Helper singleton for DBViewWrapper that tells instances when something
 *  interesting is happening to the folder(s) they care about.  The rationale
 *  for this is to:
 * - reduce listener overhead (although arguably the events we listen to are
 *     fairly rare)
 * - make testing / verification easier by centralizing and exposing listeners.
 *
 */
var FolderNotificationHelper = {
  /**
   * Maps URIs of pending folder loads to the DBViewWrapper instances that
   *  are waiting on the loads.  The value is a list of instances in case
   *  a quick-clicking user is able to do something unexpected.
   */
  _pendingFolderUriToViewWrapperLists: {},

  /**
   * Map URIs of folders to view wrappers interested in hearing about their
   *  deletion.
   */
  _interestedWrappers: {},

  /**
   * Initialize our listeners.  We currently don't bother cleaning these up
   *  because we are a singleton and if anyone imports us, they probably want
   *  us for as long as their application so shall live.
   */
  _init: function FolderNotificationHelper__init() {
    let atomService =
      Cc["@mozilla.org/atom-service;1"]
        .getService(Ci.nsIAtomService);
      this._kFolderLoadedAtom = atomService.getAtom("FolderLoaded");

    // register with the session for our folded loaded notifications
    let mailSession =
      Cc["@mozilla.org/messenger/services/session;1"]
        .getService(Ci.nsIMsgMailSession);
    mailSession.AddFolderListener(this,
                                  Ci.nsIFolderListener.event);

    // register with the notification service for deleted folder notifications
    let notificationService =
      Cc["@mozilla.org/messenger/msgnotificationservice;1"]
        .getService(Ci.nsIMsgFolderNotificationService);
    notificationService.addListener(this,
      Ci.nsIMsgFolderNotificationService.folderDeleted |
      // we need to track renames because we key off of URIs. frick.
      Ci.nsIMsgFolderNotificationService.folderRenamed |
      Ci.nsIMsgFolderNotificationService.folderMoveCopyCompleted);
  },

  /**
   * Call updateFolder, and assuming all goes well, request that the provided
   *  FolderDisplayWidget be notified when the folder is loaded.  This method
   *  performs the updateFolder call for you so there is less chance of leaking.
   * In the event the updateFolder call fails, we will propagate the exception.
   */
  updateFolderAndNotifyOnLoad:
      function FolderNotificationHelper_notifyOnLoad(aFolder,
                                                     aFolderDisplay,
                                                     aMsgWindow) {
    // set up our datastructure first in case of wacky event sequences
    let folderURI = aFolder.URI;
    let wrappers = this._pendingFolderUriToViewWrapperLists[folderURI];
    if (wrappers == null)
      wrappers = this._pendingFolderUriToViewWrapperLists[folderURI] = [];
    wrappers.push(aFolderDisplay);
    try {
      aFolder.updateFolder(aMsgWindow);
    }
    catch (ex) {
      // uh-oh, that didn't work.  tear down the data structure...
      wrappers.pop();
      if (wrappers.length == 0)
        delete this._pendingFolderUriToViewWrapperLists[folderURI];
      throw ex;
    }
  },

  /**
   * Request notification of every little thing these folders do.
   *
   * @param aFolders The folders.
   * @param aNotherFolder A folder that may or may not be in aFolders.
   * @param aViewWrapper The view wrapper that is up to no good.
   */
  stalkFolders: function FolderNotificationHelper_stalkFolders(
      aFolders, aNotherFolder, aViewWrapper) {
    let folders = aFolders.concat();
    if (aNotherFolder && folders.indexOf(aNotherFolder) == -1)
      folders.push(aNotherFolder);
    for each (let [, folder] in Iterator(aFolders)) {
      let wrappers = this._interestedWrappers[folder.URI];
      if (wrappers == null)
        wrappers = this._interestedWrappers[folder.URI] = [];
      wrappers.push(aViewWrapper);
    }
  },

  /**
   * Removal helper for use by removeNotifications.
   *
   * @param aTable The table mapping URIs to list of view wrappers.
   * @param aFolder The folder we care about.
   * @param aViewWrapper The view wrapper of interest.
   */
  _removeWrapperFromListener: function(aTable, aFolder, aViewWrapper) {
    let wrappers = aTable[aFolder.URI];
    if (wrappers) {
      let index = wrappers.indexOf(aViewWrapper);
      if (index >= 0)
      wrappers.splice(index, 1);
      if (wrappers.length == 0)
        delete aTable[aFolder.URI];
    }
  },
  /**
   * Remove notification requests on the provided folders by the given view
   *  wrapper.
   */
  removeNotifications: function FolderNotificationHelper_removeNotifications(
      aFolders, aViewWrapper) {
    for each (let [, folder] in Iterator(aFolders)) {
      this._removeWrapperFromListener(
        this._interestedWrappers, folder, aViewWrapper);
      this._removeWrapperFromListener(
        this._pendingFolderUriToViewWrapperLists, folder, aViewWrapper);
    }
  },

  /**
   * @return true if there are any listeners still registered.  This is intended
   *     to support debugging code.  If you are not debug code, you are a bad
   *     person/code.
   */
  haveListeners: function FolderNotificationHelper_haveListeners() {
    for each (let [folderURI, wrappers] in
              Iterator(this._pendingFolderUriToViewWrapperLists)) {
      return true;
    }
    for each (let [folderURI, wrappers] in
              Iterator(this._interestedWrappers)) {
      return true;
    }
    return false;
  },

  /* ***** Notifications ***** */

  OnItemEvent: function FolderNotificationHelper_OnItemEvent(
      aFolder, aEvent) {
    if (aEvent == this._kFolderLoadedAtom) {
      let folderURI = aFolder.URI;
      let widgets = this._pendingFolderUriToViewWrapperLists[folderURI];
      if (widgets) {
        for each (let [, widget] in Iterator(widgets)) {
          // we are friends, this is an explicit relationship.
          // (we don't use a generic callback mechanism because the 'this' stuff
          //  gets ugly and no one else should be hooking in at this level.)
          try {
            widget._folderLoaded(aFolder);
          }
          catch (ex) {
            dump("``` EXCEPTION DURING NOTIFY: " + ex.fileName + ":" +
                 ex.lineNumber + ": " + ex + "\n");
          }
        }
        delete this._pendingFolderUriToViewWrapperLists[folderURI];
      }
    }
  },

  _folderMoveHelper: function(aOldFolder, aNewFolder) {
    let oldURI = aOldFolder.URI;
    let newURI = aNewFolder.URI;
    // fix up our listener tables.
    if (oldURI in this._pendingFolderUriToViewWrapperLists) {
      this._pendingFolderUriToViewWrapperLists[newURI] =
        this._pendingFolderUriToViewWrapperLists[oldURI];
      delete this._pendingFolderUriToViewWrapperLists[oldURI];
    }
    if (oldURI in this._interestedWrappers) {
      this._interestedWrappers[newURI] =
        this._interestedWrappers[oldURI];
      delete this._interestedWrappers[oldURI];
    }

    let wrappers = this._interestedWrappers[newURI];
    if (wrappers) {
      // clone the list to avoid confusing mutation by listeners
      for each (let [, wrapper] in Iterator(wrappers.concat())) {
        wrapper._folderMoved(aOldFolder, aNewFolder);
      }
      // if the folder is deleted, it's not going to get deleted again.
      delete this._interestedWrappers[aFolder.URI];
    }

  },

  /**
   * Update our URI mapping tables when renames happen.
   */
  folderRenamed: function FolderNotificationHelper_folderRenamed(aOrigFolder,
                                                                 aNewFolder) {
    this._folderMoveHelper(aOrigFolder, aNewFolder);
  },

  folderMoveCopyCompleted:
      function FolderNotificationHelper_folderMoveCopyCompleted(aMove,
                                                                aSrcFolder,
                                                                aDestFolder) {
     if (aMove) {
       let aNewFolder = aDestFolder.getChildNamed(aSrcFolder.prettyName);
       this._folderMoveHelper(aSrcFolder, aNewFolder);
     }
  },

  folderDeleted: function FolderNotificationHelper_folderDeleted(aFolder) {
    let wrappers = this._interestedWrappers[aFolder.URI];
    if (wrappers) {
      // clone the list to avoid confusing mutation by listeners
      for each (let [, wrapper] in Iterator(wrappers.concat())) {
        wrapper._folderDeleted(aFolder);
      }
      // if the folder is deleted, it's not going to get deleted again.
      delete this._interestedWrappers[aFolder.URI];
    }
  },
};
FolderNotificationHelper._init();


/**
 * Defines the DBViewWrapper listener interface.  This class exists exclusively
 *  for documentation purposes and should never be instantiated.
 */
function IDBViewWrapperListener() {
}
IDBViewWrapperListener.prototype = {
  // uh, this is secretly exposed for debug purposes.  DO NOT LOOK AT ME!
  _FNH: FolderNotificationHelper,

  /* ===== Exposure of UI Globals ===== */
  messenger: null,
  msgWindow: null,
  threadPaneCommandUpdater: null,

  /* ===== Guidance ===== */
  /**
   * Indicate whether mail view settings should be used/honored.  A UI oddity
   *  is that we only have mail views be sticky if its combo box UI is visible.
   *  (Without the view combobox, it may not be obvious that the mail is
   *  filtered.)
   */
  get shouldUseMailViews() {
    return false;
  },

  /**
   * Should we defer displaying the messages in this folder until after we have
   *  talked to the server?  This is for our poor man's password protection
   *  via the "mail.password_protect_local_cache" pref.  We add this specific
   *  check rather than internalizing the logic in the wrapper because the
   *  password protection is a shoddy UI-only protection.
   */
  get shouldDeferMessageDisplayUntilAfterServerConnect() {
    return false;
  },

  /**
   * Should we mark all messages in a folder as read on exit?
   * This is nominally controlled by the "mailnews.mark_message_read.SERVERTYPE"
   *  preference (on a per-server-type basis).
   * For the record, this functionality should not remotely be in the core.
   *
   * @param aMsgFolder The folder we are leaving and are unsure if we should
   *     mark all its messages read.  I pass the folder instead of the server
   *     type because having a crazy feature like this will inevitably lead to
   *     a more full-featured crazy feature (why not on a per-folder basis, eh?)
   * @return true if we should mark all the dudes as read, false if not.
   */
  shouldMarkMessagesReadOnLeavingFolder: function (aMsgFolder) {
    return false;
  },

  /* ===== Event Notifications ===== */
  /* === Status Changes === */
  /**
   * We tell you when we start and stop loading the folder.  This is a good
   *  time to mess with the hour-glass cursor machinery if you are inclined to
   *  do so.
   */
  onFolderLoading: function (aIsFolderLoading) {

  },

  /**
   * We tell you when we start and stop searching.  This is a good time to mess
   *  with progress spinners (meteors) and the like, if you are so inclined.
   */
  onSearching: function (aIsSearching) {

  },

  /**
   * This event is generated when a new view has been created.  It is intended
   *  to be used to provide the MsgCreateDBView notification so that custom
   *  columns can add themselves to the view.
   * The notification is not generated by the DBViewWrapper itself because this
   *  is fundamentally a UI issue.  Additionally, because the MsgCreateDBView
   *  notification consumers assume gDBView whose exposure is affected by tabs,
   *  the tab logic needs to be involved.
   */
  onCreatedView: function() {
  },

  /**
   * Generated when the folder is being entered for display.  This is the chance
   *  for the listener to affect any UI-related changes to the folder required.
   *  Currently, this just means setting the header cache size (which needs to
   *  be proportional to the number of lines in the tree view, and is thus a
   *  UI issue.)
   */
  onDisplayingFolder: function() {
  },

  /**
   * Things to do once all the messages that should show up in a folder have
   *  shown up.  For a real folder, this happens when the folder is entered.
   *  For a (multi-folder) virtual folder, this happens when the search
   *  completes.
   */
  onAllMessagesLoaded: function() {
  },

  /**
   * The mail view changed.  The mail view widget is likely to care about this.
   */
  onMailViewChanged: function () {

  },


};

/**
 * Encapsulates everything related to working with our nsIMsgDBView
 *  implementations.
 */
function DBViewWrapper(aListener) {
  this.displayedFolder = null;
  this.listener = aListener;

  this._underlyingData = this.kUnderlyingNone;
  this._underlyingFolders = null;

  this._viewUpdateDepth = 0;

  this._mailViewIndex = MailViewConstants.kViewItemAll;
  this._mailViewData = null;

  this._specialView = null;

  this._sort = [];
  this._viewFlags = 0;

  this.dbView = null;
  this.search = null;

  this._folderLoading = false;
  this._searching = false;
}
DBViewWrapper.prototype = {
  /* = constants explaining the nature of the underlying data = */
  /**
   * We currently don't have any underlying data.
   */
  kUnderlyingNone: 0,
  /**
   * The underlying data source is a single folder.
   */
  kUnderlyingRealFolder: 1,
  /**
   * The underlying data source is a virtual folder that is operating over
   *  multiple underlying folders.
   */
  kUnderlyingMultipleFolder: 2,
  /**
   * Our data source is transient, most likely a gloda search that crammed the
   *  results into us.
   */
  kUnderlyingSynthetic: 3,

  /**
   * @return true if the folder being displayed is backed by a single 'real'
   *     folder.  This folder can be a saved search on that folder or just
   *     an outright un-filtered display of that folder.
   */
  get isSingleFolder() {
    return this._underlyingData == this.kUnderlyingRealFolder;
  },

  /**
   * @return true if the folder being displayed is a virtual folder backed by
   *     multiple 'real' folders.  This corresponds to a cross-folder saved
   *     search.
   */
  get isMultiFolder() {
    return this._underlyingData == this.kUnderlyingMultipleFolder;
  },

  /**
   * @return true if the folder being displayed is not a real folder at all,
   *     but rather the result of an un-scoped search, such as a gloda search.
   */
  get isSynthetic() {
    return this._underlyingData == this.kUnderlyingSynthetic;
  },

  /**
   * Refresh the view by re-creating the view.  You would do this to get rid of
   *  messages that no longer match the view but are kept around for view
   *  stability reasons.  (In other words, in an unread-messages view, you would
   *  go insane if when you clicked on a message it immediately disappeared
   *  because it no longer matched.)
   * This method was adding for testing purposes and does not have a (legacy) UI
   *  reason for existing.  (The 'open' method is intended to behave identically
   *  to the legacy UI if you click on the currently displayed folder.)
   */
  refresh: function DBViewWrapper_refresh() {
    this._applyViewChanges();
  },

  /**
   * Close the current view.  You would only do this if you want to clean up all
   *  the resources associated with this view wrapper.  You would not do this
   *  for UI reasons like the user de-selecting the node in the tree; we should
   *  always be displaying something when used in a UI context!
   *
   * @param aFolderIsDead If true, tells us not to try and tidy up on our way
   *     out by virtue of the fact that the folder is dead and should not be
   *     messed with.
   */
  close: function DBViewWrapper_close(aFolderIsDead) {
    if (this._underlyingFolders)
      FolderNotificationHelper.removeNotifications(this._underlyingFolders,
                                                   this);

    if (this.displayedFolder != null) {
      // onLeavingFolder does all the application-level stuff related to leaving
      //  the folder (marking as read, etc.)  We only do this when the folder
      //  is not dead (for obvious reasons).
      if (!aFolderIsDead)
        this.onLeavingFolder();
      this.displayedFolder = null;
      this.folderLoading = false;
    }

    // kill off the view and its search association
    if (this.dbView) {
      this.search.dissociateView(this.dbView);
      this.dbView.close();
      this.dbView = null;
    }

    this._underlyingData = this.kUnderlyingNone;
    this._underlyingFolders = null;

    this._mailViewIndex = MailViewConstants.kViewItemAll;
    this._mailViewData = null;

    this._specialView = null;

    this._sort = [];
    this._viewFlags = 0;

    this.search = null;
  },

  /**
   * Open the passed-in folder.
   */
  open: function DBViewWrapper_open(aFolder) {
    if (aFolder == null) {
      this.close();
      return;
    }

    // If we are in the same folder, there is nothing to do unless we are a
    //  virtual folder.  Virtual folders apparently want to try and get updated.
    if (this.displayedFolder == aFolder) {
      if (!this.isVirtual)
        return;
      // note: we intentionally (for consistency with old code, not that the
      //  code claimed to have a good reason) fall through here and call
      //  onLeavingFolder via close even though that's debatable in this case.
    }
    this.close();

    this.displayedFolder = aFolder;
    this._enteredFolder = false;

    this.search = new SearchSpec(this);
    this._sort = [];

    if (aFolder.isServer) {
      this._showServer();
      return;
    }

    this.beginViewUpdate();
    let msgDatabase = this.displayedFolder.msgDatabase;
    if (msgDatabase) {
      let dbFolderInfo = msgDatabase.dBFolderInfo;
      // - retrieve persisted sort information
      this._sort = [[dbFolderInfo.sortType, dbFolderInfo.sortOrder]];

      // - retrieve persisted display settings
      this._viewFlags = dbFolderInfo.viewFlags;

      // - retrieve virtual folder configuration
      if (aFolder.flags & nsMsgFolderFlags.Virtual) {
        let virtFolder = VirtualFolderHelper.wrapVirtualFolder(aFolder);
        this._underlyingFolders = virtFolder.searchFolders;
        this._underlyingData = (this._underlyingFolders.length > 1) ?
                               this.kUnderlyingMultipleFolder :
                               this.kUnderlyingRealFolder;

        // figure out if we are using online IMAP searching
        this.search.onlineSearch = virtFolder.onlineSearch;

        // retrieve and chew the search query
        this.search.virtualFolderTerms = virtFolder.searchTerms;
      }
      else {
        this._underlyingData = this.kUnderlyingRealFolder;
        this._underlyingFolders = [this.displayedFolder];
      }

      FolderNotificationHelper.stalkFolders(this._underlyingFolders,
                                            this.displayedFolder,
                                            this);

      // - retrieve mail view configuration
      if (this.listener.shouldUseMailViews) {
        // if there is a view tag (basically ":tagname"), then it's a
        //  mailview tag.  clearly.
        let mailViewTag = dbFolderInfo.getCharProperty(
                            MailViewConstants.kViewCurrentTag);
        if (mailViewTag && mailViewTag != "0") {
          // the tag gets stored with a ":" on the front, presumably done
          //  as a means of name-spacing that was never subsequently leveraged.
          if (mailViewTag[0] == ":")
            mailViewTag = mailViewTag.substr(1);
          // (the true is so we don't persist)
          this.setMailView(MailViewConstants.kViewItemTags, mailViewTag, true);
        }
        // otherwise it's just an index. we kinda-sorta migrate from old-school
        //  $label tags, except someone reused one of the indices for
        //  kViewItemNotDeleted, which means that $label2 can no longer be
        //  migrated.
        else {
          let mailViewIndex = dbFolderInfo.getUint32Property(
                                MailViewConstants.kViewCurrent,
                                MailViewConstants.kViewItemAll);
          // label migration per above
          if ((mailViewIndex == MailViewConstants.kViewItemTags) ||
              ((MailViewConstants.kViewItemTags + 2 <= mailViewIndex) &&
               (mailViewIndex < MailViewConstants.kViewItemVirtual)))
            this.setMailView(MailViewConstants.kViewItemTags,
                             "$label" + (mailViewIndex-1));
          else
            this.setMailView(mailViewIndex);
        }
      }
    }

    if (this.shouldShowMessagesForFolderImmediately())
      this._enterFolder();

    this.folderLoading = true;
    if (!this.isVirtual)
      FolderNotificationHelper.updateFolderAndNotifyOnLoad(
        this.displayedFolder, this, this.listener.msgWindow);
  },

  get folderLoading() {
    return this._folderLoading;
  },
  set folderLoading(aFolderLoading) {
    if (this._folderLoading == aFolderLoading)
      return;
    this._folderLoading = aFolderLoading;
    this.listener.onFolderLoading(aFolderLoading);
  },

  get searching() {
    return this._searching;
  },
  set searching(aSearching) {
    if (aSearching == this._searching)
      return;
    this._searching = aSearching;
    this.listener.onSearching(aSearching);
    // If we were searching but now are not, send an onAllMessagesLoaded
    //  notification.  This is the first time a virtual folder will see
    //  this message if this search is a result of opening the folder.
    if (!aSearching)
      this.listener.onAllMessagesLoaded();
  },

   /**
   * Do we want to show the messages immediately, or should we wait for
   *  updateFolder to complete?  The historical heuristic is:
   * - Virtual folders get shown immediately (and updateFolder has no
   *   meaning for them anyways.)
   * - A folder for which "manyHeadersToDownload" is true waits on
   *   updateFolder.  It will return true if the database does not yet exist
   *   (presumably because the user has never looked in the folder), or if the
   *   database exists and the number of total messages (current and pending)
   *   is <= 0 (which I presume means no messages or a bunch pending
   *   deletion?)
   * - Wait on updateFolder if our poor man's security via
   *   "mail.password_protect_local_cache" preference is enabled and the
   *   server requires a password to login.  This is accomplished by asking our
   *   listener via shouldDeferMessageDisplayUntilAfterServerConnect.  Note that
   *   there is an obvious hole in this logic because of the virtual folder case
   *   above.
   *
   * @pre this.folderDisplayed is the folder we are talking about.
   *
   * @return true if the folder should be shown immediately, false if we should
   *     wait for updateFolder to complete.
   */
  shouldShowMessagesForFolderImmediately:
      function DBViewWrapper_showShowMessagesForFolderImmediately() {
    return (this.isVirtual ||
            !(this.displayedFolder.manyHeadersToDownload ||
              this.listener.shouldDeferMessageDisplayUntilAfterServerConnect));
  },


  /**
   * Creates a view appropriate to the current settings of the folder display
   *  widget, returning it.  The caller is responsible to assign the result to
   *  this.dbView (or whatever it wants to do with it.)
   */
  _createView: function DBViewWrapper__createView() {
    let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=";

    let viewFlags = this._viewFlags;

    // real folders are subject to the most interest set of possibilities...
    if (this._underlyingData == this.kUnderlyingRealFolder) {
      // quick-search inherits from threaded which inherits from group, so this
      //  is right to choose it first.
      if (this.search.hasSearchTerms)
        dbviewContractId += "quicksearch";
      else if (this.showGroupedBySort)
        dbviewContractId += "group";
      else if (this.specialViewThreadsWithUnread)
        dbviewContractId += "threadswithunread";
      else if (this.specialViewWatchedThreadsWithUnread)
        dbviewContractId += "watchedthreadswithunread";
      else
        dbviewContractId += "threaded";
    }
    // if we're dealing with virtual folders, the answer is always an xfvf
    else if (this._underlyingData == this.kUnderlyingMultipleFolder) {
      dbviewContractId += "xfvf";
    }
    else if (this._underlyingData == this.kUnderlyingSynthetic) {
      dbviewContractId += "search";
    }

    let dbView = Cc[dbviewContractId]
                   .createInstance(Ci.nsIMsgDBView);
    dbView.init(this.listener.messenger, this.listener.msgWindow,
                this.listener.threadPaneCommandUpdater);
    // use the least-specific sort so we can clock them back through to build up
    //  the correct sort order...
    let [sortType, sortOrder] = this._sort[this._sort.length-1];
    let outCount = {};
    // when the underlying folder is a single real folder (virtual or no), we
    //  tell the view about the underlying folder.
    if (this.isSingleFolder) {
      dbView.open(this._underlyingFolders[0], sortType, sortOrder, viewFlags,
                  outCount);
      // but if it's a virtual folder, we need to tell the db view about the
      //  the display (virtual) folder so it can store all the view-specific
      //  data there (things like the active mail view and such that go in
      //  dbFolderInfo.)
      if (this.isVirtual)
        dbView.viewFolder = this.displayedFolder;
    }
    // when we're dealing with a multi-folder virtual folder, we just tell the
    //  db view about the display folder.  (It gets its own XFVF view, so it
    //  knows what to do.)
    else {
      dbView.open(this.displayedFolder, sortType, sortOrder, viewFlags,
                  outCount);
    }

    // clock through the rest of the sorts, if there are any
    for (let iSort = this._sort.length - 2; iSort >=0; iSort--) {
      [sortType, sortOrder] = this._sort[iSort];
      dbView.sort(sortType, sortOrder);
    }

    return dbView;
  },

  /**
   * Callback method invoked by FolderNotificationHelper when our folder is
   *  loaded.  Assuming we are still interested in the folder, we enter the
   *  folder via _enterFolder.
   */
  _folderLoaded: function DBViewWrapper__folderLoaded(aFolder) {
    if (aFolder == this.displayedFolder) {
      this.folderLoading = false;
      this._enterFolder();
    }
  },

  /**
   * Enter this.displayedFolder if we have not yet entered it.
   *
   * Things we do on entering a folder:
   * - clear the folder's biffState!
   * - set the message database's header cache size
   */
  _enterFolder: function DBViewWrapper__enterFolder() {
    if (this._enteredFolder)
      return;

    this.displayedFolder.biffState =
      Ci.nsIMsgFolder.nsMsgBiffState_NoMail;

    this.listener.onDisplayingFolder();

    this.endViewUpdate();

    this._enteredFolder = true;
  },

  /**
   * Renames, moves to the trash, it's all crazy.  We have to update all our
   *  references when this happens.
   */
  _folderMoved: function DBViewWrapper__folderMoved(aOldFolder, aNewFolder) {
    if (aOldFolder == this.displayedFolder)
      this.displayedFolder = aNewFolder;

    // indexOf does't work for this (reliably)
    for each (let [i,underlyingFolder] in Iterator(this._underlyingFolders)) {
      if (aOldFolder == underlyingFolder) {
        this._underlyingFolders[i] = aNewFolder;
        break;
      }
    }

    // re-populate the view.
    this._applyViewChanges();
  },

  /**
   * FolderNotificationHelper tells us when folders we care about are deleted
   *  (because we asked it to in |open|).  If it was the folder we were
   *  displaying (real or virtual), this closes it.  If we are virtual and
   *  backed by a single folder, this closes us.  If we are backed by multiple
   *  folders, we just update ourselves.  (Currently, cross-folder views are
   *  not clever enough to purge the mooted messages, so we need to do this to
   *  help them out.)
   * We do not update virtual folder definitions as a result of deletion; we are
   *  a display abstraction.  That (hopefully) happens elsewhere.
   */
  _folderDeleted: function DBViewWrapper__folderDeleted(aFolder) {
    if (aFolder == this.displayedFolder) {
      this.close();
      return;
    }

    // indexOf does't work for this (reliably)
    for each (let [i,underlyingFolder] in Iterator(this._underlyingFolders)) {
      if (aFolder == underlyingFolder) {
        this._underlyingFolders.splice(i,1);
        break;
      }
    }

    if (this._underlyingFolders.length == 0) {
      this.close();
      return;
    }
    // if we are virtual, this will update the search session which draws its
    //  search scopes from this._underlyingFolders anyways.
    this._applyViewChanges();
  },

  /**
   * Apply accumulated changes to the view.  If we are in a batch, we do
   *  nothing, relying on endDisplayUpdate to call us.
   */
  _applyViewChanges: function DBViewWrapper__applyViewChanges() {
    // if we are in a batch, wait for endDisplayUpdate to be called to get us
    //  out to zero.
    if (this._viewUpdateDepth)
      return;
    // make the dbView stop being a search listener if it is one
    if (this.dbView) {
      this.search.dissociateView(this.dbView);
      this.dbView.close();
    }

    this.dbView = this._createView();
    this.listener.onCreatedView();

    // this ends up being a no-op if there are no search terms
    this.search.associateView(this.dbView);

    // If we are searching, then the search will generate the all messages
    //  loaded notification.  Although in some cases the search may have
    //  completed by now, that is not a guarantee.  The search logic is
    //  time-slicing, which is why this can vary.  (If it uses up its time
    //  slices, it will re-schedule itself, returning to us before completing.)
    //  Which is why we always defer to the search if one is active.
    if (!this.searching)
      this.listener.onAllMessagesLoaded();
  },


  /**
   * Check if the folder or (optionally) one of its ancestors has any one of the
   *  provided flags set.
   *
   * In the event there is a folder with both the SentMail and Inbox flags set,
   *  it will be treated as an Inbox, and not as a SentMail folder.
   *
   * @param {nsIMsgFolder} aMsgFolder The folder whose flags you want to check.
   * @param {Number} aFlags A set of nsMsgFolderFlags you want to check for.
   * @param {bool} aCheckAncestors Whether we should check the folder's ancestor
   *     if the folder itself does not posess the flags.
   *
   * @return true if msgFolder has any of the provided flags set.  If msgFolder
   *     does not, but checkAncestors is true, we will check the ancestors too.
   */
  _isSpecialFolder: function DBViewWrapper_isSpecialFolder(
      aMsgFolder, aFlags, aCheckAncestors)
  {
    if (!aMsgFolder)
      return false;
    else if ((aMsgFolder.flags & aFlags) == 0) {
      let parentMsgFolder = aMsgFolder.parentMsgFolder;

      if (parentMsgFolder && aCheckAncestors)
        return this._isSpecialFolder(parentMsgFolder, aFlags, true);
      else
        return false;
    }
    else {
      // the user can set their INBOX to be their SENT folder.
      // in that case, we want this folder to act like an INBOX,
      // and not a SENT folder
      const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
      return !((aFlags & nsMsgFolderFlags.SentMail) &&
               (aMsgFolder.flags & nsMsgFolderFlags.Inbox));
    }
  },


  OUTGOING_FOLDER_FLAGS: nsMsgFolderFlags.SentMail |
                         nsMsgFolderFlags.Drafts |
                         nsMsgFolderFlags.Queue |
                         nsMsgFolderFlags.Template,
  /**
   * @return true if the folder is not known to be a special outgoing folder
   *     or the descendent of a special outgoing folder.
   */
  get isIncomingFolder() {
    return !this._isSpecialFolder(this.displayedFolder,
                                  this.OUTGOING_FOLDER_FLAGS,
                                  true);
  },
  /**
   * @return true if the folder is an outgoing folder by virtue of being a
   *     sent mail folder, drafts folder, queue folder, or template folder,
   *     or being a sub-folder of one of those types of folders.
   */
  get isOutgoingFolder() {
    return !this._isSpecialFolder(this.displayedFolder,
                                  this.OUTGOING_FOLDER_FLAGS,
                                  true);
  },

  get isVirtual() {
    return Boolean(this.displayedFolder &&
                   (this.displayedFolder.flags & nsMsgFolderFlags.Virtual));
  },

  beginViewUpdate: function DBViewWrapper_beginViewUpdate() {
    this._viewUpdateDepth++;
  },

  endViewUpdate: function DBViewWrapper_endViewUpdate() {
    if (--this._viewUpdateDepth == 0) {
      this._applyViewChanges();
    }
  },

  /**
   * Explicit sort command.  We ignore all previous sort state and only apply
   *  what you tell us.  If you want implied secondary sort, use |magicSort|.
   * You must use this sort command, and never directly call the sort commands
   *  on the underlying db view!  If you do not, make sure to fight us every
   *   step of the way, because we will keep clobbering your manually applied
   *   sort.
   */
  sort: function DBViewWrapper_sort(aSortType, aSortOrder,
                                    aSecondaryType, aSecondaryOrder) {
    this._sort = [[aSortType, aSortOrder]];
    if (aSecondaryType != null && aSecondaryOrder != null)
      this._sort.push([aSecondaryType, aSecondaryOrder]);
    // if we are not in a view update, invoke the sort.
    if ((this._viewUpdateDepth == 0) && this.dbView) {
      for (let iSort = this._sort.length - 1; iSort >=0; iSort--) {
        // apply them in the reverse order
        let [sortType, sortOrder] = this._sort[iSort];
        this.dbView.sort(sortType, sortOrder);
      }
    }
    // (if we are in a view update, then a new view will be created when the
    //  update ends, and it will just use the new sort order anyways.)
  },

  /**
   * Accumulates implied secondary sorts based on multiple calls to this method.
   *  This is intended to be hooked up to be controlled by the UI.
   * Because we are lazy, we actually just poke the view's sort method and save
   *  the apparent secondary sort.  This also allows perfect compliance with the
   *  way this used to be implemented!
   */
  magicSort: function DBViewWrapper_magicSort(aSortType, aSortOrder) {
    if (this.dbView) {
      this.dbView.sort(aSortType, aSortOrder);
      // so, the thing we just set obviously will be there
      this._sort = [[aSortType, aSortOrder]];
      // there is only a secondary sort if it's not none and not the same.
      if (this.dbView.secondarySortType != nsMsgViewSortType.byNone &&
          this.dbView.secondarySortType != aSortType)
        this._sort.push([this.dbView.secondarySortType,
                         this.dbView.secondarySortOrder]);
    }
  },

  get showGroupedBySort() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kGroupBySort);
  },
  set showGroupedBySort(aShowGroupBySort) {
    if (this.showGroupedBySort != aShowGroupBySort) {
      if (aShowGroupBySort)
        this._viewFlags |= nsMsgViewFlagsType.kGroupBySort;
      else
        this._viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
      // lose the threading bit...
      this._viewFlags &= ~nsMsgViewFlagsType.kThreadedDisplay;
      this._applyViewChanges();
    }
  },

  get showIgnored() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kShowIgnored);
  },
  set showIgnored(aShowIgnored) {
    if (this.showIgnored != aShowIgnored) {
      if (aShowIgnored)
        this._viewFlags |= nsMsgViewFlagsType.kShowIgnored;
      else
        this._viewFlags &= ~nsMsgViewFlagsType.kShowIgnored;
      this._applyViewChanges();
    }
  },

  get showThreaded() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kThreadedDisplay);
  },
  set showThreaded(aShowThreaded) {
    if (this.showThreaded != aShowThreaded) {
      if (aShowThreaded)
        this._viewFlags |= nsMsgViewFlagsType.kThreadedDisplay;
      else
        this._viewFlags &= ~nsMsgViewFlagsType.kThreadedDisplay;
      // lose the group bit...
      this._viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
      this._applyViewChanges();
    }
  },

  get showUnreadOnly() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kUnreadOnly);
  },
  set showUnreadOnly(aShowUnreadOnly) {
    if (this.showUnreadOnly != aShowUnreadOnly) {
      if (aShowUnreadOnly)
        this._viewFlags |= nsMsgViewFlagsType.kUnreadOnly;
      else
        this._viewFlags &= ~nsMsgViewFlagsType.kUnreadOnly;
      this._applyViewChanges();
    }
  },

  /**
   * Read-only attribute indicating if a 'special view' is in use.  There are
   *  two special views in existence, both of which are concerned about
   *  showing you threads that have any unread messages in them.  They are views
   *  rather than search predicates because the search mechanism is not capable
   *  of expressing such a thing.  (Or at least it didn't use to be?  We might
   *  be able to whip something up these days...)
   */
  get specialView() {
    return this._specialView != null;
  },
  /**
   * Private helper for use by the specialView* setters that handles the common
   *  logic.  We don't want this method to be public because we want it to be
   *  feasible for the view hierarchy and its enumerations to go away without
   *  code outside this class having to care so much.
   */
  _setSpecialView: function DBViewWrapper__setSpecialView(aViewEnum) {
    // special views simply cannot work for virtual folders.  explode.
    if (this.isVirtual)
      throw new Exception("Virtual folders cannot use special views!");
    this.beginViewUpdate();
    // all special views imply a threaded view
    this.showThreaded = true;
    this._specialView = aViewEnum;
    this.search.clear();
    this.endViewUpdate();
  },
  /**
   * @return true if the special view that shows threads with unread messages
   *     in them is active.
   */
  get specialViewThreadsWithUnread() {
    return this._specialView == nsMsgViewType.eShowThreadsWithUnread;
  },
  /**
   * If true is assigned, attempts to enable the special view that shows threads
   *  with unread messages in them.  This will not work on virtual folders
   *  because of the inheritance hierarchy.
   * Any mechanism that requires search terms (quick search, mailviews) will be
   *  reset/disabled when enabling this view.
   */
  set specialViewThreadsWithUnread(aSpecial) {
    this._setSpecialView(nsMsgViewType.eShowThreadsWithUnread);
  },
  /**
   * @return true if the special view that shows watched threads with unread
   *     messages in them is active.
   */
  get specialViewWatchedThreadsWithUnread() {
    return this._specialView == nsMsgViewType.eShowWatchedThreadsWithUnread;
  },
  /**
   * If true is assigned, attempts to enable the special view that shows watched
   *  threads with unread messages in them.  This will not work on virtual
   *  folders because of the inheritance hierarchy.
   * Any mechanism that requires search terms (quick search, mailviews) will be
   *  reset/disabled when enabling this view.
   */
  set specialViewWatchedThreadsWithUnread(aSpecial) {
    this._setSpecialView(nsMsgViewType.eShowWatchedThreadsWithUnread);
  },

  get mailViewIndex() {
    return this._mailViewIndex;
  },

  get mailViewData() {
    return this._mailViewData;
  },

  /**
   * Set the current mail view to the given mail view index with the provided
   *  data (normally only used for the 'tag' mail views.)  We persist the state
   *  change
   *
   * @param aMailViewIndex The view to use, one of the kViewItem* constants from
   *     msgViewPickerOverlay.js OR the name of a custom view.  (It's really up
   *     to MailViewManager.getMailViewByIndex...)
   * @param aData Some piece of data appropriate to the mail view, currently
   *     this is only used for the tag name for kViewItemTags (sans the ":").
   * @param aDoNotPersist If true, we don't save this change to the db folder
   *     info.  This is intended for internal use only.
   */
  setMailView: function DBViewWrapper_setMailView(aMailViewIndex, aData,
                                                  aDoNotPersist) {
    let mailViewDef = MailViewManager.getMailViewByIndex(aMailViewIndex);

    this._mailViewIndex = aMailViewIndex;
    this._mailViewData = aData;

    // - update the search terms (this triggers the view update)
    this.search.viewTerms = mailViewDef.makeTerms(this.search.session,
                                                  aData);

    // - persist the view to the folder.
    if (!aDoNotPersist) {
      let msgDatabase = this.displayedFolder.msgDatabase;
      if (msgDatabase) {
        let dbFolderInfo = msgDatabase.dBFolderInfo;
        dbFolderInfo.setUint32Property(MailViewConstants.kViewCurrent,
                                       this._mailViewIndex);
        // _mailViewData attempts to be sane and be the tag name, as opposed to
        //  magic-value ":"-prefixed value historically stored on disk.  Because
        //  we want to be forwards and backwards compatible, we put this back on
        //  when we persist it.  It's not like the property is really generic
        //  anyways.
        dbFolderInfo.setCharProperty(
          MailViewConstants.kViewCurrentTag,
          this._mailViewData ? (":" + this._mailViewData) : "");
      }
    }

    // we don't need to notify the view picker to update because the makeActive that
    //  cascades out of the view update will do it for us.
  },


  /**
   * Perform application-level behaviors related to leaving a folder that have
   *  nothing to do with our abstraction.
   *
   * Things we do on leaving a folder:
   * - Mark the folder's messages as no longer new
   * - Mark all messages read in the folder _if so configured_.
   */
  onLeavingFolder: function DBViewWrapper_onLeavingFolder() {
    this.displayedFolder.clearNewMessages();
    this.displayedFolder.hasNewMessages = false;
    try {
      // For legacy reasons, we support marking all messages as read when we
      //  leave a folder based on the server type.  It's this listener's job
      //  to do the legwork to figure out if this is desired.
      //
      // Mark all messages of aFolder as read:
      // We can't use the command controller, because it is already tuned in to
      // the new folder, so we just mimic its behaviour wrt
      // goDoCommand('cmd_markAllRead').
      if (this.dbView &&
          this.listener.shouldDeferMessageDisplayUntilAfterServerConnect(
            this.displayedFolder.server.type))
        this.dbView.doCommand(nsMsgViewCommandType.markAllRead);
    }
    catch(e){/* ignore */}
  },
};