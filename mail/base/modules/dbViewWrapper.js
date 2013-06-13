/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['DBViewWrapper', 'IDBViewWrapperListener'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/mailServices.js");
Cu.import("resource:///modules/mailViewManager.js");
Cu.import("resource:///modules/searchSpec.js");
Cu.import("resource:///modules/virtualFolderWrapper.js");

const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
const nsMsgViewType = Ci.nsMsgViewType;
const nsMsgViewFlagsType = Ci.nsMsgViewFlagsType;
const nsMsgViewSortType = Ci.nsMsgViewSortType;
const nsMsgViewSortOrder = Ci.nsMsgViewSortOrder;
const nsMsgMessageFlags = Ci.nsMsgMessageFlags;

const MSG_VIEW_FLAG_DUMMY = 0x20000000;

const nsMsgViewIndex_None = 0xffffffff;

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
   * Array of wrappers that are interested in all folders, used for
   * search results wrappers.
   */
   _curiousWrappers: [],

  /**
   * Initialize our listeners.  We currently don't bother cleaning these up
   *  because we are a singleton and if anyone imports us, they probably want
   *  us for as long as their application so shall live.
   */
  _init: function FolderNotificationHelper__init() {
    // register with the session for our folded loaded notifications
    MailServices.mailSession.AddFolderListener(this,
                                               Ci.nsIFolderListener.event |
                                               Ci.nsIFolderListener.intPropertyChanged);

    // register with the notification service for deleted folder notifications
    MailServices.mfn.addListener(this,
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
    let folders = aFolders ? aFolders.concat() : [];
    if (aNotherFolder && folders.indexOf(aNotherFolder) == -1)
      folders.push(aNotherFolder);
    for each (let [, folder] in Iterator(folders)) {
      let wrappers = this._interestedWrappers[folder.URI];
      if (wrappers == null)
        wrappers = this._interestedWrappers[folder.URI] = [];
      wrappers.push(aViewWrapper);
    }
  },

  /**
   * Request notification of every little thing every folder does.
   *
   * @param aViewWrapper - the viewWrapper interested in every notification.
   *                       This will be a search results view of some sort.
   */
  noteCuriosity: function FolderNotificationHelper_noteCuriosity(aViewWrapper) {
    this._curiousWrappers.push(aViewWrapper);
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
    if (!aFolders) {
      this._curiousWrappers.splice(this._curiousWrappers.indexOf(aViewWrapper), 1);
      return;
    }
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
    return this._curiousWrappers.length != 0;
  },

  /* ***** Notifications ***** */
  _notifyHelper: function FolderNotificationHelper__notifyHelper(aFolder,
                                                                 aHandlerName) {
    let wrappers = this._interestedWrappers[aFolder.URI];
    if (wrappers) {
      // clone the list to avoid confusing mutation by listeners
      for each (let [, wrapper] in Iterator(wrappers.concat())) {
        wrapper[aHandlerName](aFolder);
      }
    }
    for each (let wrapper in this._curiousWrappers)
      wrapper[aHandlerName](aFolder);
  },

  OnItemEvent: function FolderNotificationHelper_OnItemEvent(
      aFolder, aEvent) {
    let eventType = aEvent.toString();
    if (eventType == "FolderLoaded") {
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
            if (ex.stack)
              dump("STACK: " + ex.stack + "\n");
            Cu.reportError(ex);
          }
        }
        delete this._pendingFolderUriToViewWrapperLists[folderURI];
      }
    }
    else if (eventType == "AboutToCompact") {
      this._notifyHelper(aFolder, "_aboutToCompactFolder");
    }
    else if (eventType == "CompactCompleted") {
      this._notifyHelper(aFolder, "_compactedFolder");
    }
    else if (eventType == "DeleteOrMoveMsgCompleted") {
      this._notifyHelper(aFolder, "_deleteCompleted");
    }
    else if (eventType == "DeleteOrMoveMsgFailed") {
      this._notifyHelper(aFolder, "_deleteFailed");
    }

  },

  OnItemIntPropertyChanged: function(aFolder, aProperty, aOldValue, aNewValue) {
    let propertyString = aProperty.toString();
    if ((propertyString == "TotalMessages") ||
        (propertyString == "TotalUnreadMessages"))
      this._notifyHelper(aFolder, "_messageCountsChanged");
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
      // if the folder is deleted, it's not going to ever do anything again
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
   * This event is generated just before we close/destroy a message view.
   *
   * @param aFolderIsComingBack Indicates whether we are planning to create a
   *     new view to display the same folder after we destroy this view.  This
   *     will be the case unless we are switching to display a new folder or
   *     closing the view wrapper entirely.
   */
  onDestroyingView: function(aFolderIsComingBack) {
  },

  /**
   * Generated when we are loading information about the folder from its
   *  dbFolderInfo.  The dbFolderInfo object is passed in.
   * The DBViewWrapper has already restored its state when this function is
   *  called, but has not yet created the dbView.  A view update is in process,
   *  so the view settings can be changed and will take effect when the update
   *  is closed.
   * |onDisplayingFolder| is the next expected notification following this
   *  notification.
   */
  onLoadingFolder: function(aDbFolderInfo) {
  },

  /**
   * Generated when the folder is being entered for display.  This is the chance
   *  for the listener to affect any UI-related changes to the folder required.
   *  Currently, this just means setting the header cache size (which needs to
   *  be proportional to the number of lines in the tree view, and is thus a
   *  UI issue.)
   * The dbView has already been created and is valid when this function is
   *  called.
   * |onLoadingFolder| is called before this notification.
   */
  onDisplayingFolder: function() {
  },

  /**
   * Generated when we are leaving a folder.
   */
  onLeavingFolder: function() {
  },

  /**
   * Things to do once all the messages that should show up in a folder have
   *  shown up.  For a real folder, this happens when the folder is entered.
   *  For a (multi-folder) virtual folder, this happens when the search
   *  completes.
   * You may get onMessagesLoaded called with aAll false immediately after
   * the view is opened. You will definitely get onMessagesLoaded(true)
   * when we've finished getting the headers for the view.
   */
  onMessagesLoaded: function(aAll) {
  },

  /**
   * The mail view changed.  The mail view widget is likely to care about this.
   */
  onMailViewChanged: function() {
  },

  /**
   * The active sort changed, and that is all that changed.  If the sort is
   *  changing because the view is being destroyed and re-created, this event
   *  will not be generated.
   */
  onSortChanged: function() {
  },

  /**
   * This event is generated when messages in one of the folders backing the
   *  view have been removed by message moves / deletion.  If there is a search
   *  in effect, it is possible that the removed messages were not visible in
   *  the view in the first place.
   */
  onMessagesRemoved: function () {
  },

  /**
   * Like onMessagesRemoved, but something went awry in the move/deletion and
   *  it failed.  Although this is not a very interesting event on its own,
   *  it is useful in cases where the listener was expecting an
   *  onMessagesRemoved and might need to clean some state up.
   */
  onMessageRemovalFailed: function () {
  },

  /**
   * The total message count or total unread message counts changed.
   */
  onMessageCountsChanged: function () {
  },
};

/**
 * Encapsulates everything related to working with our nsIMsgDBView
 *  implementations.
 *
 * Things we do not do and why we do not do them:
 * - Selection.  This depends on having an nsITreeSelection object and we choose
 *   to avoid entanglement with XUL/layout code.  Selection accordingly must be
 *   handled a layer up in the FolderDisplayWidget.
 */
function DBViewWrapper(aListener) {
  this.displayedFolder = null;
  this.listener = aListener;

  this._underlyingData = this.kUnderlyingNone;
  this._underlyingFolders = null;
  this._syntheticView = null;

  this._viewUpdateDepth = 0;

  this._mailViewIndex = MailViewConstants.kViewItemAll;
  this._mailViewData = null;

  this._specialView = null;

  this._sort = [];
  // see the _viewFlags getter and setter for info on our use of __viewFlags.
  this.__viewFlags = null;

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
   *  results into us.  This is different from a search view.
   */
  kUnderlyingSynthetic: 3,
  /**
   * We are a search view, which translates into a search that has underlying
   *  folders, just like kUnderlyingMultipleFolder, but we have no
   *  displayedFolder.  We differ from kUnderlyingSynthetic in that we are
   *  not just a bunch of message headers randomly crammed in.
   */
  kUnderlyingSearchView: 4,

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
   *     multiple 'real' folders or a search view.  This corresponds to a
   *     cross-folder saved search.
   */
  get isMultiFolder() {
    return (this._underlyingData == this.kUnderlyingMultipleFolder) ||
           (this._underlyingData == this.kUnderlyingSearchView);;
  },

  /**
   * @return true if the folder being displayed is not a real folder at all,
   *     but rather the result of an un-scoped search, such as a gloda search.
   */
  get isSynthetic() {
    return this._underlyingData == this.kUnderlyingSynthetic;
  },

  /**
   * Check if the folder in question backs the currently displayed folder.  For
   *  a virtual folder, this is a test of whether the virtual folder includes
   *  messages from the given folder.  For a 'real' single folder, this is
   *  effectively a test against displayedFolder.
   * If you want to see if the displayed folder is a folder, just compare
   *  against the displayedFolder attribute.
   */
  isUnderlyingFolder: function DBViewWrapper_isUnderlyingFolder(aFolder) {
    for each (let [i,underlyingFolder] in Iterator(this._underlyingFolders)) {
      if (aFolder == underlyingFolder)
        return true;
    }
    return false;
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
   * Null out the folder's database to avoid memory bloat if we don't have a
   *  reason to keep the database around.  Currently, we keep all Inboxes
   *  around and null out everyone else.  This is a standard stopgap measure
   *  until we have something more clever going on.
   * In general, there is little potential downside to nulling out the message
   *  database reference when it is in use.  As long as someone is holding onto
   *  a message header from the database, the database will be kept open, and
   *  therefore the database service will still have a reference to the db.
   *  When the folder goes to ask for the database again, the service will have
   *  it, and it will not need to be re-opened.
   *
   * Another heuristic we could theoretically use is use the mail session's
   *  isFolderOpenInWindow call, except that uses the outmoded concept that each
   *  window will have at most one folder open.  So nuts to that.
   *
   * Note: regrettably a unit test cannot verify that we did this; msgDatabase
   *  is a getter that will always try and load the message database!
   */
  _releaseFolderDatabase: function DBViewWrapper__nullFolderDatabase(aFolder) {
    if (!aFolder.isSpecialFolder(nsMsgFolderFlags.Inbox, false))
      aFolder.msgDatabase = null;
  },

  /**
   * Clone this DBViewWrapper and its underlying nsIMsgDBView.
   *
   * @param aListener {IDBViewWrapperListener} The listener to use on the new view.
   */
  clone: function DBViewWrapper_clone(aListener) {
    let doppel = new DBViewWrapper(aListener);

    // -- copy attributes
    doppel.displayedFolder = this.displayedFolder;
    doppel._underlyingData = this._underlyingData;
    doppel._underlyingFolders = this._underlyingFolders ?
                                  this._underlyingFolders.concat() : null;
    doppel._syntheticView = this._syntheticView;

    // _viewUpdateDepth should stay at its initial value of zero
    doppel._mailViewIndex = this._mailViewIndex;
    doppel._mailViewData = this._mailViewData;

    doppel._specialView = this._specialView;
    // a shallow copy is all that is required for sort; we do not mutate entries
    doppel._sort = this._sort.concat();

    // -- register listeners...
    // note: this does not get us a folder loaded notification.  Our expected
    //  use case for cloning is displaying a single message already visible in
    //  the original view, which implies we don't need to hang about for folder
    //  loaded notification messages.
    FolderNotificationHelper.stalkFolders(doppel._underlyingFolders,
                                          doppel.displayedFolder,
                                          doppel);

    // -- clone the view
    if (this.dbView)
      doppel.dbView = this.dbView.cloneDBView(aListener.messenger,
                                              aListener.msgWindow,
                                              aListener.threadPaneCommandUpdater)
                          .QueryInterface(Components.interfaces.nsITreeView);
    // -- clone the search
    if (this.search)
      doppel.search = this.search.clone(doppel);

    if (doppel._underlyingData == this.kUnderlyingSearchView ||
        doppel._underlyingData == this.kUnderlyingSynthetic)
      FolderNotificationHelper.noteCuriosity(doppel);

    return doppel;
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
    if (this.displayedFolder != null) {
      // onLeavingFolder does all the application-level stuff related to leaving
      //  the folder (marking as read, etc.)  We only do this when the folder
      //  is not dead (for obvious reasons).
      if (!aFolderIsDead) {
        // onLeavingFolder must be called before we potentially null out its
        //  msgDatabase, which we will do in the upcoming underlyingFolders loop
        this.onLeavingFolder(); // application logic
        this.listener.onLeavingFolder(); // display logic
      }
      // (potentially) zero out the display folder if we are dealing with a
      //  virtual folder and so the next loop won't take care of it.
      if (this.isVirtual) {
        FolderNotificationHelper.removeNotifications([this.displayedFolder],
                                                     this);
        this._releaseFolderDatabase(this.displayedFolder);
      }

      this.folderLoading = false;
      this.displayedFolder = null;
    }

    FolderNotificationHelper.removeNotifications(this._underlyingFolders,
                                                 this);
    if (this._underlyingFolders) {
      // (potentially) zero out the underlying msgDatabase references
      for each (let [, folder] in Iterator(this._underlyingFolders))
        this._releaseFolderDatabase(folder);
    }

    // kill off the view and its search association
    if (this.dbView) {
      this.listener.onDestroyingView(false);
      this.search.dissociateView(this.dbView);
      this.dbView.setTree(null);
      this.dbView.selection = null;
      this.dbView.close();
      this.dbView = null;
    }

    // zero out the view update depth here.  We don't do it on open because it's
    //  theoretically be nice to be able to start a view update before you open
    //  something so you can defer the open.  In practice, that is not yet
    //  tested.
    this._viewUpdateDepth = 0;

    this._underlyingData = this.kUnderlyingNone;
    this._underlyingFolders = null;
    this._syntheticView = null;

    this._mailViewIndex = MailViewConstants.kViewItemAll;
    this._mailViewData = null;

    this._specialView = null;

    this._sort = [];
    this.__viewFlags = null;

    this.search = null;
  },

  /**
   * Open the passed-in nsIMsgFolder folder.  Use openSynthetic for synthetic
   *  view providers.
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
    let msgDatabase;
    try {
      // This will throw an exception if the .msf file is missing,
      // out of date (e.g., the local folder has changed), or corrupted.
      msgDatabase = this.displayedFolder.msgDatabase;
    } catch (e) {}
    if (msgDatabase)
      this._prepareToLoadView(msgDatabase, aFolder);

    if (!this.isVirtual) {
      this.folderLoading = true;
      FolderNotificationHelper.updateFolderAndNotifyOnLoad(
        this.displayedFolder, this, this.listener.msgWindow);
    }

    // we do this after kicking off the update because this could initiate a
    //  search which could fight our explicit updateFolder call if the search
    //  is already outstanding.
    if (this.shouldShowMessagesForFolderImmediately())
      this._enterFolder();
  },

  /**
   * Open a synthetic view provider as backing our view.
   */
  openSynthetic: function DBViewWrapper_openSynthetic(aSyntheticView) {
    this.close();

    this._underlyingData = this.kUnderlyingSynthetic;
    this._syntheticView = aSyntheticView;

    this.search = new SearchSpec(this);
    this._sort = this._syntheticView.defaultSort.concat();

    this._applyViewChanges();
    FolderNotificationHelper.noteCuriosity(this);
  },

  /**
   * Makes us irrevocavbly be a search view, for use in search windows.
   *  Once you call this, you are not allowed to use us for anything
   *  but a search view!
   * We add a 'searchFolders' property that allows you to control what
   *  folders we are searching over.
   */
  openSearchView: function DBViewWrapper_openSearchView() {
    this.close();

    this._underlyingData = this.kUnderlyingSearchView;
    this._underlyingFolders = [];

    let dis = this;
    this.__defineGetter__('searchFolders', function() {
                            return dis._underlyingFolders;
                          });
    this.__defineSetter__('searchFolders', function(aSearchFolders) {
                            dis._underlyingFolders = aSearchFolders;
                            dis._applyViewChanges();
                          });

    this.search = new SearchSpec(this);
    // the search view uses the order in which messages are added as the
    //  order by default.
    this._sort = [[nsMsgViewSortType.byNone, nsMsgViewSortOrder.ascending]];

    FolderNotificationHelper.noteCuriosity(this);
    this._applyViewChanges();
  },

  get folderLoading() {
    return this._folderLoading;
  },
  set folderLoading(aFolderLoading) {
    if (this._folderLoading == aFolderLoading)
      return;
    this._folderLoading = aFolderLoading;
    // tell the folder about what is going on so it can remove its db change
    //  listener and restore it, respectively.
    if (aFolderLoading)
      this.displayedFolder.startFolderLoading();
    else
      this.displayedFolder.endFolderLoading();
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
    // notify that all messages are loaded if searching has concluded
    if (!aSearching)
      this.listener.onMessagesLoaded(true);
  },

   /**
   * Do we want to show the messages immediately, or should we wait for
   *  updateFolder to complete?  The historical heuristic is:
   * - Virtual folders get shown immediately (and updateFolder has no
   *   meaning for them anyways.)
   * - If _underlyingFolders == null, we failed to open the database,
   *   so we need to wait for UpdateFolder to reparse the folder (in the
   *   local folder case).
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
            !(this._underlyingFolders == null ||
              this.listener.shouldDeferMessageDisplayUntilAfterServerConnect));
  },
  /**
   * Extract information about the view from the dbFolderInfo (e.g., sort type,
   * sort order, current view flags, etc), and save in the view wrapper.
   */
  _prepareToLoadView:
      function DBViewWrapper_prepareToLoadView(msgDatabase, aFolder) {
    let dbFolderInfo = msgDatabase.dBFolderInfo;
    // - retrieve persisted sort information
    this._sort = [[dbFolderInfo.sortType, dbFolderInfo.sortOrder]];

    // - retrieve persisted display settings
    this.__viewFlags = dbFolderInfo.viewFlags;
    // Make sure the threaded bit is set if group-by-sort is set.  The views
    //  encode 3 states in 2-bits, and we want to avoid that odd-man-out
    //  state.
    if (this.__viewFlags & nsMsgViewFlagsType.kGroupBySort) {
      this.__viewFlags |= nsMsgViewFlagsType.kThreadedDisplay;
      this._ensureValidSort();
    }

    // See if the last-used view was one of the special views.  If so, put us in
    //  that special view mode.  We intentionally do this after restoring the
    //  view flags because _setSpecialView enforces threading.
    // The nsMsgDBView is the one who persists this information for us.  In this
    //  case the nsMsgThreadedDBView superclass of the special views triggers it
    //  when opened.
    let viewType = dbFolderInfo.viewType;
    if ((viewType == nsMsgViewType.eShowThreadsWithUnread) ||
        (viewType == nsMsgViewType.eShowWatchedThreadsWithUnread))
      this._setSpecialView(viewType);

    // - retrieve virtual folder configuration
    if (aFolder.flags & nsMsgFolderFlags.Virtual) {
      let virtFolder = VirtualFolderHelper.wrapVirtualFolder(aFolder);
      // Filter out the server roots; they only exist for UI reasons.
      this._underlyingFolders =
        [folder for each ([, folder] in Iterator(virtFolder.searchFolders))
                if (!folder.isServer)];
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
      // "0" and "1" are all and unread views, respectively, from 2.0
      if (mailViewTag && mailViewTag != "0" && mailViewTag != "1") {
        // the tag gets stored with a ":" on the front, presumably done
        //  as a means of name-spacing that was never subsequently leveraged.
        if (mailViewTag.startsWith(":"))
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

    this.listener.onLoadingFolder(dbFolderInfo);
  },

  /**
   * Creates a view appropriate to the current settings of the folder display
   *  widget, returning it.  The caller is responsible to assign the result to
   *  this.dbView (or whatever it wants to do with it.)
   */
  _createView: function DBViewWrapper__createView() {
    let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=";

    // we will have saved these off when closing our view
    let viewFlags = this.__viewFlags || 0;

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
    else { // kUnderlyingSynthetic or kUnderlyingSearchView
      dbviewContractId += "search";
    }

    // and now zero the saved-off flags.
    this.__viewFlags = null;

    let dbView = Cc[dbviewContractId]
                   .createInstance(Ci.nsIMsgDBView);
    dbView.init(this.listener.messenger, this.listener.msgWindow,
                this.listener.threadPaneCommandUpdater);
    // use the least-specific sort so we can clock them back through to build up
    //  the correct sort order...
    let [sortType, sortOrder, sortCustomCol] =
      this._getSortDetails(this._sort.length-1);
    let outCount = {};
    // when the underlying folder is a single real folder (virtual or no), we
    //  tell the view about the underlying folder.
    if (this.isSingleFolder) {
      dbView.open(this._underlyingFolders[0], sortType, sortOrder, viewFlags,
                  outCount);
      // If there are any search terms, we need to tell the db view about the
      //  the display (/virtual) folder so it can store all the view-specific
      //  data there (things like the active mail view and such that go in
      //  dbFolderInfo.)  This also goes for cases where the quick search is
      //  active; the C++ code explicitly nulls out the view folder for no
      //  good/documented reason, so we need to set it again if we want changes
      //  made with the quick filter applied.  (We don't just change the C++
      //  code because there could be SeaMonkey fallout.)  See bug 502767 for
      //  info about the quick-search part of the problem.
      if (this.search.hasSearchTerms)
        dbView.viewFolder = this.displayedFolder;
    }
    // when we're dealing with a multi-folder virtual folder, we just tell the
    //  db view about the display folder.  (It gets its own XFVF view, so it
    //  knows what to do.)
    // and for a synthetic folder, displayedFolder is null anyways
    else {
      dbView.open(this.displayedFolder, sortType, sortOrder, viewFlags,
                  outCount);
    }
    if (sortCustomCol)
      dbView.curCustomColumn = sortCustomCol;

    // we all know it's a tree view, make sure the interface is available
    //  so no one else has to do this.
    dbView.QueryInterface(Ci.nsITreeView);

    // clock through the rest of the sorts, if there are any
    for (let iSort = this._sort.length - 2; iSort >=0; iSort--) {
      [sortType, sortOrder, sortCustomCol] = this._getSortDetails(iSort);
      if (sortCustomCol)
        dbView.curCustomColumn = sortCustomCol;
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
      // If _underlyingFolders is null, DBViewWrapper_open probably got
      // an exception trying to open the db, but after reparsing the local
      // folder, we should have a db, so set up the view based on info
      // from the db.
      if (this._underlyingFolders == null) {
        this._prepareToLoadView(aFolder.msgDatabase, aFolder);
      }
      this._enterFolder();
      this.listener.onMessagesLoaded(true);
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

    // we definitely want a view at this point; force the view.
    this._viewUpdateDepth = 0;
    this._applyViewChanges();

    this.listener.onDisplayingFolder();

    this._enteredFolder = true;
  },

  /**
   * Renames, moves to the trash, it's all crazy.  We have to update all our
   *  references when this happens.
   */
  _folderMoved: function DBViewWrapper__folderMoved(aOldFolder, aNewFolder) {
    if (aOldFolder == this.displayedFolder)
      this.displayedFolder = aNewFolder;

    // indexOf doesn't work for this (reliably)
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
    // XXX When we empty the trash, we're actually sending a folder deleted
    // notification around. This check ensures we don't think we've really
    // deleted the trash folder in the DBViewWrapper, and that stops nasty
    // things happening, like forgetting we've got the trash folder selected.
    if (aFolder.isSpecialFolder(nsMsgFolderFlags.Trash, false))
      return;

    if (aFolder == this.displayedFolder) {
      this.close();
      return;
    }

    // indexOf doesn't work for this (reliably)
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
   * Compacting a local folder nukes its message keys, requiring the view to be
   *  rebuilt.  If the folder is IMAP, it doesn't matter because the UIDs are
   *  the message keys and we can ignore it.  In the local case we want to
   *  notify our listener so they have a chance to save the selected messages.
   */
  _aboutToCompactFolder: function DBViewWrapper__aboutToCompactFolder(aFolder) {
    // IMAP compaction does not affect us unless we are holding headers
    if (aFolder.server.type == "imap")
      return;

    // we will have to re-create the view, so nuke the view now.
    if (this.dbView) {
      this.listener.onDestroyingView(true);
      this.search.dissociateView(this.dbView);
      this.dbView.close();
      this.dbView = null;
    }
  },

  /**
   * Compaction is all done, let's re-create the view!  (Unless the folder is
   *  IMAP, in which case we are ignoring this event sequence.)
   */
  _compactedFolder: function DBViewWrapper__compactedFolder(aFolder) {
    // IMAP compaction does not affect us unless we are holding headers
    if (aFolder.server.type == "imap")
      return;

    this.refresh();
  },

  /**
   * DB Views need help to know when their move / deletion operations complete.
   *  This happens in both single-folder and multiple-folder backed searches.
   *  In the latter case, there is potential danger that we tell a view that did
   *  not initiate the move / deletion but has kicked off its own about the
   *  completion and confuse it.  However, that's on the view code.
   */
  _deleteCompleted: function DBViewWrapper__deleteCompleted(aFolder) {
    if (this.dbView)
      this.dbView.onDeleteCompleted(true);
    this.listener.onMessagesRemoved();
  },

  /**
   * See _deleteCompleted for an explanation of what is going on.
   */
  _deleteFailed: function DBViewWrapper__deleteFailed(aFolder) {
    if (this.dbView)
      this.dbView.onDeleteCompleted(false);
    this.listener.onMessageRemovalFailed();
  },

  /**
   * If the displayed folder had its total message count or total unread message
   *  count change, notify the listener.  (Note: only for the display folder;
   *  not the underlying folders!)
   */
  _messageCountsChanged: function DBViewWrapper__messageCountsChanged(aFolder) {
    if (aFolder == this.displayedFolder)
      this.listener.onMessageCountsChanged();
  },

  /**
   * @return the current set of viewFlags.  This may be:
   * - A modified set of flags that are pending application because a view
   *    update is in effect and we don't want to modify the view when it's just
   *    going to get destroyed.
   * - The live set of flags from the current dbView.
   * - The 'limbo' set of flags because we currently lack a view but will have
   *    one soon (and then we will apply the flags).
   */
  get _viewFlags() {
    if (this.__viewFlags != null)
      return this.__viewFlags;
    if (this.dbView)
      return this.dbView.viewFlags;
    return 0;
  },
  /**
   * Update the view flags to use on the view.  If we are in a view update or
   *  currently don't have a view, we save the view flags for later usage when
   *  the view gets (re)built.  If we have a view, depending on what's happening
   *  we may re-create the view or just set the bits.  The rules/reasons are:
   * - XFVF views can handle the flag changes, just set the flags.
   * - Single-folder threaded/unthreaded can handle a change to/from unthreaded/
   *    threaded, so set it.
   * - Single-folder can _not_ handle a change between grouped and not-grouped,
   *    so re-generate the view. Also it can't handle a change involving
   *    kUnreadOnly or kShowIgnored.
   */
  set _viewFlags(aViewFlags) {
    if (this._viewUpdateDepth || !this.dbView)
      this.__viewFlags = aViewFlags;
    else {
      let oldFlags = this.dbView.viewFlags;
      let changedFlags = oldFlags ^ aViewFlags;
      if ((this.isVirtual && this.isMultiFolder) ||
          (this.isSingleFolder &&
           !(changedFlags & (nsMsgViewFlagsType.kGroupBySort |
                             nsMsgViewFlagsType.kUnreadOnly |
                             nsMsgViewFlagsType.kShowIgnored)))) {
        this.dbView.viewFlags = aViewFlags;
        // ugh, and the single folder case needs us to re-apply his sort...
        if (this.isSingleFolder)
          this.dbView.sort(this.dbView.sortType, this.dbView.sortOrder);
        this.listener.onSortChanged();
      }
      else {
        this.__viewFlags = aViewFlags;
        this._applyViewChanges();
      }
    }
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
      // save the view's flags if it has any and we haven't already overridden
      //  them.
      if (this.__viewFlags == null)
        this.__viewFlags = this.dbView.viewFlags;
      this.listener.onDestroyingView(true); // we will re-create it!
      this.search.dissociateView(this.dbView);
      this.dbView.close();
      this.dbView = null;
    }

    this.dbView = this._createView();
    // if the synthetic view defines columns, add those for it
    if (this.isSynthetic) {
      for (let [, customCol] in Iterator(this._syntheticView.customColumns)) {
        customCol.bindToView(this.dbView);
        this.dbView.addColumnHandler(customCol.id, customCol);
      }
    }
    this.listener.onCreatedView();

    // this ends up being a no-op if there are no search terms
    this.search.associateView(this.dbView);

    // If we are searching, then the search will generate the all messages
    //  loaded notification.  Although in some cases the search may have
    //  completed by now, that is not a guarantee.  The search logic is
    //  time-slicing, which is why this can vary.  (If it uses up its time
    //  slices, it will re-schedule itself, returning to us before completing.)
    //  Which is why we always defer to the search if one is active.
    // If we are loading the folder, the load completion will also notify us,
    //  so we should not generate all messages loaded right now.
    if (!this.searching && !this.folderLoading)
      this.listener.onMessagesLoaded(true);
    else if (this.dbView.numMsgsInView > 0)
      this.listener.onMessagesLoaded(false);
  },

  get isMailFolder() {
    return this.displayedFolder &&
           (this.displayedFolder.flags & nsMsgFolderFlags.Mail);
  },

  get isNewsFolder() {
    return this.displayedFolder &&
           (this.displayedFolder.flags & nsMsgFolderFlags.Newsgroup);
  },

  OUTGOING_FOLDER_FLAGS: nsMsgFolderFlags.SentMail |
                         nsMsgFolderFlags.Drafts |
                         nsMsgFolderFlags.Queue |
                         nsMsgFolderFlags.Templates,
  /**
   * @return true if the folder is not known to be a special outgoing folder
   *     or the descendent of a special outgoing folder.
   */
  get isIncomingFolder() {
    return !this.displayedFolder.isSpecialFolder(this.OUTGOING_FOLDER_FLAGS,
                                                 true);
  },
  /**
   * @return true if the folder is an outgoing folder by virtue of being a
   *     sent mail folder, drafts folder, queue folder, or template folder,
   *     or being a sub-folder of one of those types of folders.
   */
  get isOutgoingFolder() {
    return this.displayedFolder.isSpecialFolder(this.OUTGOING_FOLDER_FLAGS,
                                                true);
  },

  get isVirtual() {
    return Boolean(this.displayedFolder &&
                   (this.displayedFolder.flags & nsMsgFolderFlags.Virtual));
  },

  /**
   * Prevent view updates from running until a paired |endViewUpdate| call is
   *  made.  This is an advisory method intended to aid us in performing
   *  redundant view re-computations and does not forbid us from building the
   *  view earlier if we have a good reason.
   * Since calling endViewUpdate will compel a view update when the update
   *  depth reaches 0, you should only call this method if you are sure that
   *  you will need the view to be re-built.  If you are doing things like
   *  changing to/from threaded mode that do not cause the view to be rebuilt,
   *  you should just set those attributes directly.
   */
  beginViewUpdate: function DBViewWrapper_beginViewUpdate() {
    this._viewUpdateDepth++;
  },

  /**
   * Conclude a paired call to |beginViewUpdate|.  Assuming the view depth has
   *  reached 0 with this call, the view will be re-created with the current
   *  settings.
   */
  endViewUpdate: function DBViewWrapper_endViewUpdate(aForceLevel) {
    if (--this._viewUpdateDepth == 0)
      this._applyViewChanges();
    // Avoid pathological situations.
    if (this._viewUpdateDepth < 0)
      this._viewUpdateDepth = 0;
  },

  /**
   * @return the primary sort type (as one of the numeric constants from
   *      nsMsgViewSortType).
   */
  get primarySortType() {
    return this._sort[0][0];
  },

  /**
   * @return the primary sort order (as one of the numeric constants from
   *     nsMsgViewSortOrder.)
   */
  get primarySortOrder() {
    return this._sort[0][1];
  },

  /**
   * @return true if the dominant sort is ascending.
   */
  get isSortedAscending() {
    return this._sort.length &&
           this._sort[0][1] == nsMsgViewSortOrder.ascending;
  },
  /**
   * @return true if the dominant sort is descending.
   */
  get isSortedDescending() {
    return this._sort.length &&
           this._sort[0][1] == nsMsgViewSortOrder.descending;
  },
  /**
   * Indicate if we are sorting by time or something correlated with time.
   *
   * @return true if the dominant sort is by time.
   */
  get sortImpliesTemporalOrdering() {
    if (!this._sort.length)
      return false;
    let sortType = this._sort[0][0];
    return sortType == nsMsgViewSortType.byDate ||
           sortType == nsMsgViewSortType.byReceived ||
           sortType == nsMsgViewSortType.byId ||
           sortType == nsMsgViewSortType.byThread;
  },

  sortAscending: function() {
    if (!this.isSortedAscending)
      this.magicSort(this._sort[0][0], nsMsgViewSortOrder.ascending);
  },
  sortDescending: function() {
    if (!this.isSortedDescending)
      this.magicSort(this._sort[0][0], nsMsgViewSortOrder.descending);
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
    // make sure the sort won't make the view angry...
    this._ensureValidSort();
    // if we are not in a view update, invoke the sort.
    if ((this._viewUpdateDepth == 0) && this.dbView) {
      for (let iSort = this._sort.length - 1; iSort >=0; iSort--) {
        // apply them in the reverse order
        let [sortType, sortOrder] = this._sort[iSort];
        this.dbView.sort(sortType, sortOrder);
      }
      // (only generate the event since we're not in a update batch)
      this.listener.onSortChanged();
    }
    // (if we are in a view update, then a new view will be created when the
    //  update ends, and it will just use the new sort order anyways.)
  },

  /**
   * Logic that compensates for custom column identifiers being provided as
   *  sort types.
   *
   * @return [sort type, sort order, sort custom column name]
   */
  _getSortDetails: function(aIndex) {
    let [sortType, sortOrder] = this._sort[aIndex];
    let sortCustomColumn = null;
    let sortTypeType = typeof(sortType);
    if (sortTypeType != "number") {
      sortCustomColumn = (sortTypeType == "string") ? sortType : sortType.id;
      sortType = nsMsgViewSortType.byCustom;
    }

    return [sortType, sortOrder, sortCustomColumn];
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
      // so, the thing we just set obviously will be there
      this._sort = [[aSortType, aSortOrder]];
      // (make sure it is valid...)
      this._ensureValidSort();
      // apply the sort to see what happens secondary-wise
      this.dbView.sort(this._sort[0][0], this._sort[0][1]);
      // there is only a secondary sort if it's not none and not the same.
      if (this.dbView.secondarySortType != nsMsgViewSortType.byNone &&
          this.dbView.secondarySortType != this._sort[0][0])
        this._sort.push([this.dbView.secondarySortType,
                         this.dbView.secondarySortOrder]);
      // only tell our listener if we're not in a view update batch
      if (this._viewUpdateDepth == 0)
        this.listener.onSortChanged();
    }
  },

  /**
   * Make sure the current sort is valid under our other constraints, make it
   *  safe if it is not.  Most specifically, some sorts are illegal when
   *  grouping by sort, and we reset the sort to date in those cases.
   *
   * @param aViewFlags Optional set of view flags to consider instead of the
   *     potentially live view flags.
   */
  _ensureValidSort: function DBViewWrapper_ensureValidSort(aViewFlags) {
    if ((aViewFlags != null ? aViewFlags : this._viewFlags) &
        nsMsgViewFlagsType.kGroupBySort) {
      // We cannot be sorting by thread, id, none, or size.  If we are, switch
      //  to sorting by date.
      for each (let [, sortPair] in Iterator(this._sort)) {
        let sortType = sortPair[0];
        if (sortType == nsMsgViewSortType.byThread ||
            sortType == nsMsgViewSortType.byId ||
            sortType == nsMsgViewSortType.byNone ||
            sortType == nsMsgViewSortType.bySize) {
          this._sort = [[nsMsgViewSortType.byDate, this._sort[0][1]]];
          break;
        }
      }
    }
  },

  /**
   * @return true if we are grouped-by-sort, false if not.  If we are not
   *     grouped by sort, then we are either threaded or unthreaded; check
   *     the showThreaded property to find out which of those it is.
   */
  get showGroupedBySort() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kGroupBySort);
  },
  /**
   * Enable grouped-by-sort which is mutually exclusive with threaded display
   *  (as controlled/exposed by showThreaded).  Grouped-by-sort is not legal
   *  for sorts by thread/id/size/none and enabling this will cause us to change
   *  our sort to by date in those cases.
   */
  set showGroupedBySort(aShowGroupBySort) {
    if (this.showGroupedBySort != aShowGroupBySort) {
      if (aShowGroupBySort) {
        // do not apply the flag change until we have made the sort safe
        let viewFlags = this._viewFlags |
                        nsMsgViewFlagsType.kGroupBySort |
                         nsMsgViewFlagsType.kThreadedDisplay;
        this._ensureValidSort(viewFlags);
        this._viewFlags = viewFlags;
      }
      // maybe we shouldn't do anything in this case?
      else
        this._viewFlags &= ~(nsMsgViewFlagsType.kGroupBySort |
                             nsMsgViewFlagsType.kThreadedDisplay);
    }
  },

  /**
   * Are we showing ignored/killed threads?
   */
  get showIgnored() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kShowIgnored);
  },
  /**
   * Set whether we are showing ignored/killed threads.
   */
  set showIgnored(aShowIgnored) {
    if (this.showIgnored == aShowIgnored)
      return;

    if (aShowIgnored)
      this._viewFlags |= nsMsgViewFlagsType.kShowIgnored;
    else
      this._viewFlags &= ~nsMsgViewFlagsType.kShowIgnored;
  },

  /**
   * @return true if we are in threaded display (as opposed to grouped or
   *     unthreaded.)
   */
  get showThreaded() {
    return (this._viewFlags & nsMsgViewFlagsType.kThreadedDisplay) &&
           !(this._viewFlags & nsMsgViewFlagsType.kGroupBySort);
  },
  /**
   * Set us to threaded display mode when set to true.  If we are already in
   *  threaded display mode, we do nothing.  If you want to set us to unthreaded
   *  mode, set |showUnthreaded| to true.  (Because we have three modes of
   *  operation: unthreaded, threaded, and grouped-by-sort, we are a tri-state
   *  and setting us to false is ambiguous.  We should probably be using a
   *  single attribute with three constants...)
   */
  set showThreaded(aShowThreaded) {
    if (this.showThreaded != aShowThreaded) {
      let viewFlags = this._viewFlags;
      if (aShowThreaded)
        viewFlags |= nsMsgViewFlagsType.kThreadedDisplay;
      // maybe we shouldn't do anything in this case?
      else
        viewFlags &= ~nsMsgViewFlagsType.kThreadedDisplay;
      // lose the group bit...
      viewFlags &= ~nsMsgViewFlagsType.kGroupBySort;
      this._viewFlags = viewFlags;
    }
  },

  /**
   * @return true if we are in unthreaded mode (which means not threaded and
   *     not grouped by sort).
   */
  get showUnthreaded() {
    return Boolean(!(this._viewFlags & (nsMsgViewFlagsType.kGroupBySort |
                                        nsMsgViewFlagsType.kThreadedDisplay)));
  },
  /**
   * Set to true to put us in unthreaded mode (which means not threaded and
   *  not grouped by sort).
   */
  set showUnthreaded(aShowUnthreaded) {
    if (this.showUnthreaded != aShowUnthreaded) {
      if (aShowUnthreaded)
        this._viewFlags &= ~(nsMsgViewFlagsType.kGroupBySort |
                             nsMsgViewFlagsType.kThreadedDisplay);
      // maybe we shouldn't do anything in this case?
      else
        this._viewFlags = (this._viewFlags & ~nsMsgViewFlagsType.kGroupBySort) |
                            nsMsgViewFlagsType.kThreadedDisplay;
    }
  },

  /**
   * @return true if we are showing only unread messages.
   */
  get showUnreadOnly() {
    return Boolean(this._viewFlags & nsMsgViewFlagsType.kUnreadOnly);
  },
  /**
   * Enable/disable showing only unread messages using the view's flag-based
   *  mechanism.  This functionality can also be approximated using a mail
   *  view (or other search) for unread messages.  There also exist special
   *  views for showing messages with unread threads which is different and
   *  has serious limitations because of its nature.
   * Setting anything to this value clears any active special view because the
   *  actual UI use case (the "View... Threads..." menu) uses this setter
   *  intentionally as a mutually exclusive UI choice from the special views.
   */
  set showUnreadOnly(aShowUnreadOnly) {
    if (this._specialView || (this.showUnreadOnly != aShowUnreadOnly)) {
      let viewRebuildRequired = (this._specialView != null);
      this._specialView = null;
      if (viewRebuildRequired)
        this.beginViewUpdate();

      if (aShowUnreadOnly)
        this._viewFlags |= nsMsgViewFlagsType.kUnreadOnly;
      else
        this._viewFlags &= ~nsMsgViewFlagsType.kUnreadOnly;

      if (viewRebuildRequired)
        this.endViewUpdate();
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
    // We clear the search for paranoia/correctness reasons.  However, the UI
    //  layer is currently responsible for making sure these are already zeroed
    //  out.
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

    // - update the search terms
    // (this triggers a view update if we are not in a batch)
    this.search.viewTerms = mailViewDef.makeTerms(this.search.session,
                                                  aData);

    // - persist the view to the folder.
    if (!aDoNotPersist && this.displayedFolder) {
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

    // we don't need to notify the view picker to update because the makeActive
    //  that cascades out of the view update will do it for us.
  },

  /**
   * @return true if the row at the given index contains a collapsed thread,
   *     false if the row is a collapsed group or anything else.
   */
  isCollapsedThreadAtIndex:
      function DBViewWrapper_isCollapsedThreadAtIndex(aViewIndex) {
    let flags = this.dbView.getFlagsAt(aViewIndex);
    return (flags & nsMsgMessageFlags.Elided) &&
           !(flags & MSG_VIEW_FLAG_DUMMY) &&
           this.dbView.isContainer(aViewIndex);
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
    // Suppress useless InvalidateRange calls to the tree by the dbView.
    if (this.dbView)
      this.dbView.suppressChangeNotifications = true;
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
          this.listener.shouldMarkMessagesReadOnLeavingFolder(
            this.displayedFolder))
        this.dbView.doCommand(Ci.nsMsgViewCommandType.markAllRead);
    }
    catch(e){/* ignore */}
  },

  /**
   * Returns the view index for this message header in this view.
   *
   * - If this is a single folder view, we first check whether the folder is the
   *   right one. If it is, we call the db view's findIndexOfMsgHdr. We do the
   *   first check because findIndexOfMsgHdr only checks for whether the message
   *   key matches, which might lead to false positives.
   *
   * - If this isn't, we trust findIndexOfMsgHdr to do the right thing.
   *
   * @param aMsgHdr The message header for which the view index should be
   *                returned.
   * @param [aForceFind] If the message is not in the view and this is true, we
   *                     will drop any applied view filters to look for the
   *                     message. The dropping of view filters is persistent, so
   *                     use with care. Defaults to false.
   *
   * @returns the view index for this header, or nsMsgViewIndex_None if it isn't
   *          found.
   *
   * @public
   */
  getViewIndexForMsgHdr: function DBViewWrapper_getViewIndexForMsgHdr(aMsgHdr,
      aForceFind) {
    if (this.dbView) {
      if (this.isSingleFolder && aMsgHdr.folder != this.dbView.msgFolder)
        return nsMsgViewIndex_None;

      let viewIndex = this.dbView.findIndexOfMsgHdr(aMsgHdr, true);

      if (aForceFind && viewIndex == nsMsgViewIndex_None) {
        // Consider dropping view filters.
        // - If we're not displaying all messages, switch to All
        if (viewIndex == nsMsgViewIndex_None &&
            this.mailViewIndex != MailViewConstants.kViewItemAll) {
          this.setMailView(MailViewConstants.kViewItemAll, null);
          viewIndex = this.dbView.findIndexOfMsgHdr(aMsgHdr, true);
        }

        // - Don't just show unread only
        if (viewIndex == nsMsgViewIndex_None) {
          this.showUnreadOnly = false;
          viewIndex = this.dbView.findIndexOfMsgHdr(aMsgHdr, true);
        }
      }

      // We've done all we can.
      return viewIndex;
    }

    // No db view, so we can't do anything
    return nsMsgViewIndex_None;
  },

  /**
   * Convenience function to retrieve the first nsIMsgDBHdr in any of the
   *  folders backing this view with the given message-id header.  This
   *  is for the benefit of FolderDisplayWidget's selection logic.
   * When thinking about using this, please keep in mind that, currently, this
   *  is O(n) for the total number of messages across all the backing folders.
   *  Since the folder database should already be in memory, this should
   *  ideally not involve any disk I/O.
   * Additionally, duplicate message-ids can and will happen, but since we
   *  are using the message database's getMsgHdrForMessageID method to be fast,
   *  our semantics are limited to telling you about only the first one we find.
   *
   * @param aMessageId The message-id of the message you want.
   * @return The first nsIMsgDBHdr found in any of the underlying folders with
   *     the given message header, null if none are found.  The fact that we
   *     return something does not guarantee that it is actually visible in the
   *     view.  (The search may be filtering it out.)
   */
  getMsgHdrForMessageID: function DBViewWrapper_getMsgHdrForMessageID(
      aMessageId) {
    if (this._syntheticView)
      return this._syntheticView.getMsgHdrForMessageID(aMessageId);
    if (!this._underlyingFolders)
      return null;
    for (let [, folder] in Iterator(this._underlyingFolders)) {
      let msgHdr = folder.msgDatabase.getMsgHdrForMessageID(aMessageId);
      if (msgHdr)
        return msgHdr;
    }
    return null;
  },
};
