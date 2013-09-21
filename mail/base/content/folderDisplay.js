/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/dbViewWrapper.js");
Components.utils.import("resource:///modules/jsTreeSelection.js");
Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var gFolderDisplay = null;
var gMessageDisplay = null;

var nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
var nsMsgMessageFlags = Components.interfaces.nsMsgMessageFlags;

/**
 * Maintains a list of listeners for all FolderDisplayWidget instances in this
 *  window.  The assumption is that because of our multiplexed tab
 *  implementation all consumers are effectively going to care about all such
 *  tabs.
 *
 * We are not just a global list so that we can add brains about efficiently
 *  building lists, provide try-wrapper convenience, etc.
 */
let FolderDisplayListenerManager = {
  _listeners: [],

  /**
   * Register a listener that implements one or more of the methods defined on
   *  |IDBViewWrapperListener|.  Note that a change from those interface
   *  signatures is that the first argument is always a reference to the
   *  FolderDisplayWidget generating the notification.
   *
   * We additionally support the following notifications:
   * - onMakeActive.  Invoked when makeActive is called on the
   *   FolderDisplayWidget.  The second argument (after the folder display) is
   *   aWasInactive.
   *
   * - onActiveCreatedView.  onCreatedView deferred to when the tab is actually
   *   made active.
   *
   * - onActiveMessagesLoaded.  onMessagesLoaded deferred to when the
   *   tab is actually made active.  Use this if the actions you need to take
   *   are based on the folder display actually being visible, such as updating
   *   some UI widget, etc. Not all messages may have been loaded, but some.
   *
   */
  registerListener: function FDLM_registerListener(aListener) {
    this._listeners.push(aListener);
  },

  /**
   * Unregister a previously registered event listener.
   */
  unregisterListener: function FDLM_unregisterListener(aListener) {
    let idx = this._listeners.indexOf(aListener);
    if (idx >= 0) {
      this._listeners.splice(idx, 1);
    }
  },

  /**
   * For use by FolderDisplayWidget to trigger listener invocation.
   */
  _fireListeners: function FDBLM__fireListeners(aEventName, aArgs) {
    for each (let [, listener] in Iterator(this._listeners)) {
      if (aEventName in listener) {
        try {
          listener[aEventName].apply(listener, aArgs);
        }
        catch(e) {
          Components.utils.reportError(aEventName + " event listener FAILED; " +
                                       e + " at: " + e.stack);
        }
      }
    }
  },
};

/**
 * Abstraction for a widget that (roughly speaking) displays the contents of
 *  folders.  The widget belongs to a tab and has a lifetime as long as the tab
 *  that contains it.  This class is strictly concerned with the UI aspects of
 *  this; the DBViewWrapper class handles the view details (and is exposed on
 *  the 'view' attribute.)
 *
 * The search window subclasses this into the SearchFolderDisplayWidget rather
 *  than us attempting to generalize everything excessively.  This is because
 *  we hate the search window and don't want to clutter up this code for it.
 * The standalone message display window also subclasses us; we do not hate it,
 *  but it's not invited to our birthday party either.
 * For reasons of simplicity and the original order of implementation, this
 *  class does alter its behavior slightly for the benefit of the standalone
 *  message window.  If no tab info is provided, we avoid touching tabmail
 *  (which is good, because it won't exist!)  And now we guard against treeBox
 *  manipulations...
 */
function FolderDisplayWidget(aTabInfo, aMessageDisplayWidget) {
  this._tabInfo = aTabInfo;

  /// If the folder does not get handled by the DBViewWrapper, stash it here.
  ///  ex: when isServer is true.
  this._nonViewFolder = null;

  this.view = new DBViewWrapper(this);
  this.messageDisplay = aMessageDisplayWidget;
  this.messageDisplay.folderDisplay = this;

  /**
   * The XUL tree node, as retrieved by getDocumentElementById.  The caller is
   *  responsible for setting this.
   */
  this.tree = null;
  /**
   * The nsITreeBoxObject on the XUL tree node, accessible from this.tree as
   *  this.tree.boxObject and QueryInterfaced as such.  The caller is
   *  responsible for setting this.
   */
  this.treeBox = null;

  /**
   * The nsIMsgWindow corresponding to the window that holds us.  There is only
   *  one of these per tab.  The caller is responsible for setting this.
   */
  this.msgWindow = null;
  /**
   * The nsIMessenger instance that corresponds to our tab/window.  We do not
   *  use this ourselves, but are responsible for using it to update the
   *  global |messenger| object so that our tab maintains its own undo and
   *  navigation history.  At some point we might touch it for those reasons.
   */
  this.messenger = null;
  this.threadPaneCommandUpdater = this;

  /**
   * Flag to expose whether all messages are loaded or not.  Set by
   *  onMessagesLoaded() when aAll is true.
   */
  this._allMessagesLoaded = false;

  /**
   * Save the top row displayed when we go inactive, restore when we go active,
   *  nuke it when we destroy the view.
   */
  this._savedFirstVisibleRow = null;
  /** the next view index to select once the delete completes */
  this._nextViewIndexAfterDelete = null;
  /**
   * Track when a mass move is in effect (we get told by hintMassMoveStarting,
   *  and hintMassMoveCompleted) so that we can avoid deletion-triggered
   *  moving to _nextViewIndexAfterDelete until the mass move completes.
   */
  this._massMoveActive = false;

  /**
   * Used by pushNavigation to queue a navigation request for when we enter the
   *  next folder; onMessagesLoaded(true) is the one that processes it.
   */
  this._pendingNavigation = null;

  this._active = false;
  /**
   * A list of methods to call on 'this' object when we are next made active.
   *  This list is populated by calls to |_notifyWhenActive| when we are
   *  not active at the moment.
   */
  this._notificationsPendingActivation = [];

  // Create a DOM node for the fake tree box below.
  let domNode = document.createElementNS(
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "vbox");

  // We care about onselect events, so add a listener for that.
  let self = this;
  domNode.addEventListener("select", function () {
    self.view.dbView.selectionChanged();
  }, false);

  /**
   * Create a fake tree box object for if/when this folder is in the background.
   * We need to give it a DOM object to send events to, including the onselect
   * event we care about and for which we added a handler above, and all the
   * other events we don't care about.
   */
  this._fakeTreeBox = new FakeTreeBoxObject(domNode);

  /**
   * Create a fake tree selection for cases where we have opened a background
   * tab. We'll get rid of this as soon as we've switched to the tab for the
   * first time, and have a real tree selection.
   */
  this._fakeTreeSelection = new JSTreeSelection(this._fakeTreeBox);

  this._mostRecentSelectionCounts = [];
  this._mostRecentCurrentIndices = [];
}
FolderDisplayWidget.prototype = {
  /**
   * @return the currently displayed folder.  This is just proxied from the
   *     view wrapper.
   * @groupName Displayed
   */
  get displayedFolder() {
    return this._nonViewFolder || this.view.displayedFolder;
  },

  /**
   * @return true if the selection should be summarized for this folder. This
   *     is based on the mail.operate_on_msgs_in_collapsed_threads pref and
   *     if we are in a newsgroup folder. XXX When bug 478167 is fixed, this
   *     should be limited to being disabled for newsgroups that are not stored
   *     offline.
   */
  get summarizeSelectionInFolder() {
    return Services.prefs.getBoolPref("mail.operate_on_msgs_in_collapsed_threads") &&
      !(this.displayedFolder instanceof Components.interfaces.nsIMsgNewsFolder);
  },

  /**
   * @return the nsITreeSelection object for our tree view.  This exists for
   *     the benefit of message tabs that haven't been switched to yet.
   *     We provide a fake tree selection in those cases.
   * @protected
   */
  get treeSelection() {
    // If we haven't switched to this tab yet, dbView will exist but
    // dbView.selection won't, so use the fake tree selection instead.
    if (this._fakeTreeSelection)
      return this._fakeTreeSelection;
    if (this.view.dbView)
      return this.view.dbView.selection;
    else
      return null;
  },

  /**
   * Determine which pane currently has focus (one of the folder pane, thread
   * pane, or message pane). The message pane node is the common ancestor of
   * the single- and multi-message content windows. When changing focus to the
   * message pane, be sure to focus the appropriate content window in addition
   * to the messagepanebox (doing both is required in order to blur the
   * previously-focused chrome element).
   *
   * @return the focused pane
   */
  get focusedPane() {
    let panes = [document.getElementById(id) for each (id in [
      "threadTree", "folderTree", "messagepanebox"
    ])];

    let currentNode = top.document.activeElement;

    while (currentNode) {
      if (panes.indexOf(currentNode) != -1)
        return currentNode;

      currentNode = currentNode.parentNode;
    }
    return null;
  },


  /**
   * Number of headers to tell the message database to cache when we enter a
   *  folder.  This value is being propagated from legacy code which provided
   *  no explanation for its choice.
   *
   * We definitely want the header cache size to be larger than the number of
   *  rows that can be displayed on screen simultaneously.
   *
   * @private
   */
  PERF_HEADER_CACHE_SIZE: 100,

  /**
   * @name Selection Persistence
   * @private
   */
  //@{

  /**
   * An optional object, with the following properties:
   * - messages: This is a list where each item is an object with the following
   *       attributes sufficient to re-establish the selected items even in the
   *       face of folder renaming.
   *   - messageId: The value of the message's message-id header.
   *
   * That's right, we only save the message-id header value.  This is arguably
   *  overkill and ambiguous in the face of duplicate messages, but it's the
   *  most persistent/reliable thing we have without gloda.
   * Using the view index was ruled out because it is hardly stable.  Using the
   *  message key alone is insufficient for cross-folder searches.  Using a
   *  folder identifier and message key is insufficent for local folders in the
   *  face of compaction, let alone complexities where the folder name may
   *  change due to renaming/moving.  Which means we eventually need to fall
   *  back to message-id anyways.  Feel free to add in lots of complexity if
   *  you actually write unit tests for all the many possible cases.
   * Additional justification is that selection saving/restoration should not
   *  happen all that frequently.  A nice freebie is that message-id is
   *  definitely persistable.
   *
   * - forceSelect: Whether we are allowed to drop all filters in our quest to
   *       select messages.
   */
  _savedSelection: null,

  /**
   * Save the current view selection for when we the view is getting destroyed
   *  or otherwise re-ordered in such a way that the nsITreeSelection will lose
   *  track of things (because it just has a naive view-index 'view' of the
   *  world.)  We just save each message's message-id header.  This is overkill
   *  and ambiguous in the face of duplicate messages (and expensive to
   *  restore), but is also the most reliable option for this use case.
   */
  _saveSelection: function FolderDisplayWidget_saveSelection() {
    this._savedSelection = {messages:
                            [{messageId: msgHdr.messageId} for each
                             ([, msgHdr] in Iterator(this.selectedMessages))],
                            forceSelect: false};
  },

  /**
   * Clear the saved selection.
   */
  _clearSavedSelection: function FolderDisplayWidget_clearSavedSelection() {
    this._savedSelection = null;
  },

  /**
   * Restore the view selection if we have a saved selection.  We must be
   *  active!
   *
   * @return true if we were able to restore the selection and there was
   *     a selection, false if there was no selection (anymore).
   */
  _restoreSelection: function FolderDisplayWidget_restoreSelection() {
    if (!this._savedSelection || !this._active)
      return false;

    // translate message IDs back to messages.  this is O(s(m+n)) where:
    // - s is the number of messages saved in the selection
    // - m is the number of messages in the view (from findIndexOfMsgHdr)
    // - n is the number of messages in the underlying folders (from
    //   DBViewWrapper.getMsgHdrForMessageID).
    // which ends up being O(sn)
    var msgHdr;
    let messages =
      [msgHdr for each
        ([, savedInfo] in Iterator(this._savedSelection.messages)) if
        ((msgHdr = this.view.getMsgHdrForMessageID(savedInfo.messageId)))];

    this.selectMessages(messages, this._savedSelection.forceSelect, true);
    this._savedSelection = null;

    return this.selectedCount != 0;
  },
  //@}

  /**
   * @name Columns
   * @protected Folder Display
   */
  //@{

  /**
   * The set of potential default columns in their default display order.  Each
   *  column in this list is checked against |COLUMN_DEFAULT_TESTERS| to see if
   *  it is actually an appropriate default for the folder type.
   */
  DEFAULT_COLUMNS: [
    "threadCol",
    "attachmentCol",
    "flaggedCol",
    "subjectCol",
    "unreadButtonColHeader",
    "senderCol", // incoming folders
    "recipientCol", // outgoing folders
    "junkStatusCol",
    "dateCol",
    "locationCol", // multiple-folder backed folders
  ],

  /**
   * Maps column ids to functions that test whether the column is a good default
   *  for display for the folder.  Each function should expect a DBViewWrapper
   *  instance as its argument.  The intent is that the various helper
   *  properties like isMailFolder/isIncomingFolder/isOutgoingFolder allow the
   *  constraint to be expressed concisely.  If a helper does not exist, add
   *  one! (If doing so is out of reach, than access viewWrapper.displayedFolder
   *  to get at the nsIMsgFolder.)
   * If a column does not have a function, it is assumed that it should be
   *  displayed by default.
   */
  COLUMN_DEFAULT_TESTERS: {
    // senderCol = From.  You only care in incoming folders.
    senderCol: function (viewWrapper) {
      return viewWrapper.isIncomingFolder;
    },
    // recipient = To. You only care in outgoing folders.
    recipientCol: function (viewWrapper) {
      return viewWrapper.isOutgoingFolder;
    },
    // Only show the location column for non-single-folder results
    locationCol: function(viewWrapper) {
      return !viewWrapper.isSingleFolder;
    },
    // core UI does not provide an ability to mark newsgroup messages as spam
    junkStatusCol: function(viewWrapper) {
      return !viewWrapper.isNewsFolder;
    },
  },

  /**
   * The property name we use to store the column states on the
   *  dbFolderInfo.
   */
  PERSISTED_COLUMN_PROPERTY_NAME: "columnStates",

  /**
   * Given a dbFolderInfo, extract the persisted state from it if there is any.
   *
   * @return null if there was no persisted state, the persisted state in object
   *     form otherwise.  (Ideally the state conforms to the documentation on
   *     |_savedColumnStates| but we can't stop people from doing bad things.)
   */
  _depersistColumnStatesFromDbFolderInfo:
      function FolderDisplayWidget__depersistColumnStatesFromDBFolderInfo(
        aDbFolderInfo) {
    let columnJsonString =
      aDbFolderInfo.getCharProperty(this.PERSISTED_COLUMN_PROPERTY_NAME);
    if (!columnJsonString)
      return null;

    return JSON.parse(columnJsonString);
  },

  /**
   * Persist the column state for the currently displayed folder.  We are
   *  assuming that the message database is already open when we are called and
   *  therefore that we do not need to worry about cleaning up after the message
   *  database.
   * The caller should only call this when they have reason to suspect that the
   *  column state has been changed.  This could be because there was no
   *  persisted state so we figured out a default one and want to save it.
   *  Otherwise this should be because the user explicitly changed up the column
   *  configurations.  You should not call this willy-nilly.
   *
   * @param aState State to persist.
   */
  _persistColumnStates: function FolderDisplayWidget__persistColumnStates(aState) {
    if (!this.view.displayedFolder || !this.view.displayedFolder.msgDatabase)
      return;
    let msgDatabase = this.view.displayedFolder.msgDatabase;
    let dbFolderInfo = msgDatabase.dBFolderInfo;
    dbFolderInfo.setCharProperty(this.PERSISTED_COLUMN_PROPERTY_NAME,
                                 JSON.stringify(aState));
    msgDatabase.Commit(Components.interfaces.nsMsgDBCommitType.kLargeCommit);
  },

  /**
   * Let us know that the state of the columns has changed.  This is either due
   *  to a re-ordering or hidden-ness being toggled.
   *
   * This method should only be called on (the active) gFolderDisplay.
   */
  hintColumnsChanged: function FolderDisplayWidget_hintColumnsChanged() {
    // ignore this if we are the ones doing things
    if (this._touchingColumns)
      return;
    this._persistColumnStates(this.getColumnStates());
  },

  /**
   * Either inherit the column state of another folder or use heuristics to
   *  figure out the best column state for the current folder.
   */
  _getDefaultColumnsForCurrentFolder:
      function FolderDisplayWidget__getDefaultColumnsForCurrentFolder() {
    const InboxFlag = Components.interfaces.nsMsgFolderFlags.Inbox;

    // do not inherit from the inbox if:
    // - It's an outgoing folder; these have a different use-case and there
    //    should be a small number of these, so it's okay to have no defaults.
    // - It's a virtual folder (single or multi-folder backed).  Who knows what
    //    the intent of the user is in this case.  This should also be bounded
    //    in number and our default heuristics should be pretty good.
    // - News folders.  There is no inbox so there's nothing to inherit from.
    //    (Although we could try and see if they have opened any other news
    //    folders in the same account.  But it's not all that important to us.)
    // - It's an inbox!
    let doNotInherit =
      this.view.isOutgoingFolder ||
      this.view.isVirtual ||
      this.view.isNewsFolder ||
      this.displayedFolder.flags & InboxFlag;

    // Try and grab the inbox for this account's settings.  we may not be able
    //  to, in which case we just won't inherit.  (It ends up the same since the
    //  inbox is obviously not customized in this case.)
    if (!doNotInherit) {
      let inboxFolder =
        this.displayedFolder.rootFolder.getFolderWithFlags(InboxFlag);
      if (inboxFolder) {
        let state = this._depersistColumnStatesFromDbFolderInfo(
                      inboxFolder.msgDatabase.dBFolderInfo);
        // inbox message databases don't get closed as a matter of policy.

        if (state)
          return state;
      }
    }

    // if we are still here, use the defaults and helper functions
    let state = {};
    for (let [, colId] in Iterator(this.DEFAULT_COLUMNS)) {
      let shouldShowColumn = true;
      if (colId in this.COLUMN_DEFAULT_TESTERS) {
        // This is potentially going to be used by extensions; avoid them
        //  killing us.
        try {
          shouldShowColumn = this.COLUMN_DEFAULT_TESTERS[colId](this.view);
        }
        catch (ex) {
          shouldShowColumn = false;
          Components.utils.reportError(ex);
        }
      }
      state[colId] = {visible: shouldShowColumn};
    }
    return state;
  },

  /**
   * Is setColumnStates messing with the columns' DOM?  This is used by
   *  hintColumnsChanged to avoid wasteful state persistence.
   */
  _touchingColumns: false,

  /**
   * Set the column states of this FolderDisplay to the provided state.
   *
   * @param aColumnStates an object of the form described on
   *     |_savedColumnStates|.  If ordinal attributes are omitted then no
   *     re-ordering will be performed.  This is intentional, but potentially a
   *     bad idea.  (Right now only gloda search underspecifies ordinals.)
   * @param [aPersistChanges=false] Should we persist the changes to the view?
   *     This only has an effect if we are active.
   *
   * @public
   */
  setColumnStates: function(aColumnStates, aPersistChanges) {
    // If we are not active, just overwrite our current state with the provided
    //  state and bail.
    if (!this._active) {
      this._savedColumnStates = aColumnStates;
      return;
    }

    this._touchingColumns = true;

    try {
      let cols = document.getElementById("threadCols");
      let colChildren = cols.children;

      for (let iKid = 0; iKid < colChildren.length; iKid++) {
        let colChild = colChildren[iKid];
        if (colChild == null)
          continue;

        // We only care about treecols.  The splitters do not need to be marked
        //  hidden or un-hidden.
        if (colChild.tagName == "treecol") {
          // if it doesn't have preserved state it should be hidden
          let shouldBeHidden = true;
          // restore state
          if (colChild.id in aColumnStates) {
            let colState = aColumnStates[colChild.id];
            if ("visible" in colState)
              shouldBeHidden = !colState.visible;
            if (("ordinal" in colState) &&
                colChild.getAttribute("ordinal") != colState.ordinal)
              colChild.setAttribute("ordinal", colState.ordinal);
          }
          let isHidden = colChild.getAttribute("hidden") == "true";
          if (isHidden != shouldBeHidden) {
            if (shouldBeHidden)
              colChild.setAttribute("hidden", "true");
            else
              colChild.removeAttribute("hidden");
          }
        }
      }
    }
    finally {
      this._touchingColumns = false;
    }

    if (aPersistChanges)
      this.hintColumnsChanged();
  },

  /**
   * A dictionary that maps column ids to dictionaries where each dictionary
   *  has the following fields:
   * - visible: Is the column visible.
   * - ordinal: The 1-based XUL 'ordinal' value assigned to the column.  This
   *    corresponds to the position but is not something you want to manipulate.
   *    See the documentation in _saveColumnStates for more information.
   */
  _savedColumnStates: null,

  /**
   * Return a dictionary in the form of |_savedColumnStates| representing the
   *  current column states.
   *
   * @public
   */
  getColumnStates: function FolderDisplayWidget_getColumnStates() {
    if (!this._active)
      return this._savedColumnStates;

    let columnStates = {};

    let cols = document.getElementById("threadCols");
    let colChildren = cols.children;
    for (let iKid = 0; iKid < colChildren.length; iKid++) {
      let colChild = colChildren[iKid];
      if (colChild.tagName != "treecol")
        continue;
      columnStates[colChild.id] = {
        visible: colChild.getAttribute("hidden") != "true",
        ordinal: colChild.getAttribute("ordinal"),
      };
    }

    return columnStates;
  },

  /**
   * For now, just save the visible columns into a dictionary for use in a
   *  subsequent call to |setColumnStates|.
   */
  _saveColumnStates: function FolderDisplayWidget__saveColumnStates() {
    // In the actual nsITreeColumn, the index property indicates the column
    //  number.  This column number is a 0-based index with no gaps; it only
    //  increments the number each time it sees a column.
    // However, this is subservient to the 'ordinal' property which
    //  defines the _apparent content sequence_ provided by GetNextSibling.
    //  The underlying content ordering is still the same, which is how
    //  restoreNaturalOrder can reset things to their XUL definition sequence.
    //  The 'ordinal' stuff works because nsBoxFrame::RelayoutChildAtOrdinal
    //  messes with the sibling relationship.
    // Ordinals are 1-based.  restoreNaturalOrder apparently is dumb and does
    //  not know this, although the ordering is relative so it doesn't actually
    //  matter.  The annoying splitters do have ordinals, and live between
    //  tree columns.  The splitters adjacent to a tree column do not need to
    //  have any 'ordinal' relationship, although it would appear user activity
    //  tends to move them around in a predictable fashion with oddness involved
    //  at the edges.
    // Changes to the ordinal attribute should take immediate effect in terms of
    //  sibling relationship, but will merely invalidate the columns rather than
    //  cause a re-computation of column relationships every time.
    // restoreNaturalOrder invalidates the tree when it is done re-ordering; I'm
    //  not sure that's entirely necessary...
    this._savedColumnStates = this.getColumnStates();
  },

  /**
   * Restores the visible columns saved by |_saveColumnStates|.
   */
  _restoreColumnStates: function FolderDisplayWidget__restoreColumnStates() {
    if (this._savedColumnStates) {
      this.setColumnStates(this._savedColumnStates);
      this._savedColumnStates = null;
    }
  },
  //@}

  /**
   * @name What To Display
   * @protected
   */
  //@{
  showFolderUri: function FolderDisplayWidget_showFolderUri(aFolderURI) {
    return this.show(MailUtils.getFolderForURI(aFolderURI));
  },

  /**
   * Invoked by showFolder when it turns out the folder is in fact a server.
   * @private
   */
  _showServer: function FolderDisplayWidget__showServer() {
    // currently nothing to do.  makeActive handles everything for us (because
    //  what is displayed needs to be re-asserted each time we are activated
    //  too.)
  },

  /**
   * Select a folder for display.
   *
   * @param aFolder The nsIMsgDBFolder to display.
   */
  show: function FolderDisplayWidget_show(aFolder) {
    if (aFolder == null) {
      this._nonViewFolder = null;
      this.view.close();
    }
    else if (aFolder instanceof Components.interfaces.nsIMsgFolder) {
      if (aFolder.isServer) {
        this._nonViewFolder = aFolder;
        this._showServer();
        this.view.close();
        // A server is fully loaded immediately, for now.  (When we have the
        //  account summary, we might want to change this to wait for the page
        //  load to complete.)
        this._allMessagesLoaded = true;
      }
      else {
        this._nonViewFolder = null;
        this.view.open(aFolder);
      }
    }
    // it must be a synthetic view
    else {
      this.view.openSynthetic(aFolder);
    }
    if (this._active)
      this.makeActive();

    if (this._tabInfo)
      document.getElementById('tabmail').setTabTitle(this._tabInfo);
  },

  /**
   * Clone an existing view wrapper as the basis for our display.
   */
  cloneView: function FolderDisplayWidget_cloneView(aViewWrapper) {
    this.view = aViewWrapper.clone(this);
    // generate a view created notification; this will cause us to do the right
    //  thing in terms of associating the view with the tree and such.
    this.onCreatedView();
    if (this._active)
      this.makeActive();
  },

  /**
   * Close resources associated with the currently displayed folder because you
   *  no longer care about this FolderDisplayWidget.
   */
  close: function FolderDisplayWidget_close() {
    // Mark ourselves as inactive without doing any of the hard work of becoming
    //  inactive.  This saves us from trying to update things as they go away.
    this._active = false;
    // Tell the message display to close itself too.  We do this before we do
    //  anything else because closing the view could theoretically propagate
    //  down to the message display and we don't want it doing anything it
    //  doesn't have to do.
    this.messageDisplay._close();

    this.view.close();
    this.messenger.setWindow(null, null);
    this.messenger = null;
    this._fakeTreeBox = null;
    this._fakeTreeSelection = null;
  },
  //@}

  /*   ===============================   */
  /* ===== IDBViewWrapper Listener ===== */
  /*   ===============================   */

  /**
   * @name IDBViewWrapperListener Interface
   * @private
   */
  //@{

  /**
   * @return true if the mail view picker is visible.  This affects whether the
   *     DBViewWrapper will actually use the persisted mail view or not.
   */
  get shouldUseMailViews() {
    return ViewPickerBinding.isVisible;
  },

  /**
   * Let the viewWrapper know if we should defer message display because we
   *  want the user to connect to the server first so password authentication
   *  can occur.
   *
   * @return true if the folder should be shown immediately, false if we should
   *     wait for updateFolder to complete.
   */
  get shouldDeferMessageDisplayUntilAfterServerConnect() {
    let passwordPromptRequired = false;

    if (Services.prefs.getBoolPref("mail.password_protect_local_cache"))
      passwordPromptRequired =
        this.view.displayedFolder.server.passwordPromptRequired;

    return passwordPromptRequired;
  },

  /**
   * Let the viewWrapper know if it should mark the messages read when leaving
   *  the provided folder.
   *
   * @return true if the preference is set for the folder's server type.
   */
  shouldMarkMessagesReadOnLeavingFolder:
    function FolderDisplayWidget_crazyMarkOnReadChecker (aMsgFolder) {
      return Services.prefs.getBoolPref("mailnews.mark_message_read." +
                                        aMsgFolder.server.type);
  },

  /**
   * The view wrapper tells us when it starts loading a folder, and we set the
   *  cursor busy.  Setting the cursor busy on a per-tab basis is us being
   *  nice to the future. Loading a folder is a blocking operation that is going
   *  to make us unresponsive and accordingly make it very hard for the user to
   *  change tabs.
   */
  onFolderLoading: function(aFolderLoading) {
    if (this._tabInfo)
      document.getElementById("tabmail").setTabBusy(this._tabInfo,
                                                    aFolderLoading);

    FolderDisplayListenerManager._fireListeners("onFolderLoading",
                                                [this, aFolderLoading]);
  },

  /**
   * The view wrapper tells us when a search is active, and we mark the tab as
   *  thinking so the user knows something is happening.  'Searching' in this
   *  case is more than just a user-initiated search.  Virtual folders / saved
   *  searches, mail views, plus the more obvious quick search are all based off
   *  of searches and we will receive a notification for them.
   */
  onSearching: function(aIsSearching) {
    if (this._tabInfo) {
      let searchBundle = document.getElementById("bundle_search");
      document.getElementById("tabmail").setTabThinking(
        this._tabInfo,
        aIsSearching && searchBundle.getString("searchingMessage"));
    }

    FolderDisplayListenerManager._fireListeners("onSearching",
                                                [this, aIsSearching]);
  },

  /**
   * Things we do on creating a view:
   * - notify the observer service so that custom column handler providers can
   *   add their custom columns to our view.
   */
  onCreatedView: function FolderDisplayWidget_onCreatedView() {
    // All of our messages are not displayed if the view was just created.  We
    //  will get an onMessagesLoaded(true) nearly immediately if this is a local
    //  folder where view creation is synonymous with having all messages.
    this._allMessagesLoaded = false;
    this.messageDisplay.onCreatedView();

    FolderDisplayListenerManager._fireListeners("onCreatedView",
                                                [this]);

    this._notifyWhenActive(this._activeCreatedView);
  },
  _activeCreatedView: function() {
    gDBView = this.view.dbView;

    // A change in view may result in changes to sorts, the view menu, etc.
    // Do this before we 'reroot' the dbview.
    this._updateThreadDisplay();

    // this creates a new selection object for the view.
    if (this.treeBox)
      this.treeBox.view = this.view.dbView;

    FolderDisplayListenerManager._fireListeners("onActiveCreatedView",
                                                [this]);

    // The data payload used to be viewType + ":" + viewFlags.  We no longer
    //  do this because we already have the implied contract that gDBView is
    //  valid at the time we generate the notification.  In such a case, you
    //  can easily get that information from the gDBView.  (The documentation
    //  on creating a custom column assumes gDBView.)
    Services.obs.notifyObservers(this.displayedFolder, "MsgCreateDBView", "");
  },

  /**
   * If our view is being destroyed and it is coming back, we want to save the
   *  current selection so we can restore it when the view comes back.
   */
  onDestroyingView: function FolderDisplayWidget_onDestroyingView(
      aFolderIsComingBack) {
    // try and persist the selection's content if we can
    if (this._active) {
      // If saving the selection throws an exception, we still want continue
      // destroying the view. Saving the selection can fail if an underlying
      // local folder has been compacted, invalidating the message keys.
      // See bug 536676 for more info.
      try {
        // If a new selection is coming up, there's no point in trying to
        // persist any selections.
        if (aFolderIsComingBack && !this._aboutToSelectMessage)
          this._saveSelection();
        else
          this._clearSavedSelection();
      }
      catch (ex) {
        logException(ex);
      }
      gDBView = null;
    }

    FolderDisplayListenerManager._fireListeners("onDestroyingView",
                                                [this, aFolderIsComingBack]);

    // if we have no view, no messages could be loaded.
    this._allMessagesLoaded = false;

    // but the actual tree view selection (based on view indicies) is a goner no
    //  matter what, make everyone forget.
    this.view.dbView.selection = null;
    this._savedFirstVisibleRow = null;
    this._nextViewIndexAfterDelete = null;
    // although the move may still be active, its relation to the view is moot.
    this._massMoveActive = false;

    // Anything pending needs to get cleared out; the new view and its related
    //  events will re-schedule anything required or simply run it when it
    //  has its initial call to makeActive compelled.
    this._notificationsPendingActivation = [];

    // and the message display needs to forget
    this.messageDisplay.onDestroyingView(aFolderIsComingBack);
  },

  /**
   * Restore persisted information about what columns to display for the folder.
   *  If we have no persisted information, we leave/set _savedColumnStates null.
   *  The column states will be set to default values in onDisplayingFolder in
   *  that case.
   */
  onLoadingFolder: function FolderDisplayWidget_onLoadingFolder(aDbFolderInfo) {
    this._savedColumnStates =
      this._depersistColumnStatesFromDbFolderInfo(aDbFolderInfo);

    FolderDisplayListenerManager._fireListeners("onLoadingFolder",
                                                [this, aDbFolderInfo]);
  },

  /**
   * We are entering the folder for display:
   * - set the header cache size.
   * - Setup the columns if we did not already depersist in |onLoadingFolder|.
   */
  onDisplayingFolder: function FolderDisplayWidget_onDisplayingFolder() {
    let msgDatabase = this.view.displayedFolder.msgDatabase;
    if (msgDatabase) {
      msgDatabase.resetHdrCacheSize(this.PERF_HEADER_CACHE_SIZE);
    }

    // makeActive will restore the folder state
    if (!this._savedColumnStates) {
      // get the default for this folder
      this._savedColumnStates = this._getDefaultColumnsForCurrentFolder();
      // and save it so it doesn't wiggle if the inbox/prototype changes
      this._persistColumnStates(this._savedColumnStates);
    }

    FolderDisplayListenerManager._fireListeners("onDisplayingFolder",
                                                [this]);

    if (this.active)
      this.makeActive();
  },

  /**
   * Notification from DBViewWrapper that it is closing the folder.  This can
   *  happen for reasons other than our own 'close' method closing the view.
   *  For example, user deletion of the folder or underlying folder closes it.
   */
  onLeavingFolder: function FolderDisplayWidget_onLeavingFolder() {
    FolderDisplayListenerManager._fireListeners("onLeavingFolder",
                                                [this]);

    // Keep the msgWindow's openFolder up-to-date; it powers nsMessenger's
    //  concept of history so that it can bring you back to the actual folder
    //  you were looking at, rather than just the underlying folder.
    if (this._active)
      msgWindow.openFolder = null;
  },

  /**
   * Indictes whether we are done loading the messages that should be in this
   *  folder.  This is being surfaced for testing purposes, but could be useful
   *  to other code as well.  But don't poll this property; ask for an event
   *  that you can hook.
   */
  get allMessagesLoaded() {
    return this._allMessagesLoaded;
  },

  /**
   * Things to do once some or all the messages that should show up in a folder
   *  have shown up.  For a real folder, this happens when the folder is
   *  entered. For a virtual folder, this happens when the search completes.
   *
   * What we do:
   * - Any scrolling required!
   */
  onMessagesLoaded: function FolderDisplayWidget_onMessagesLoaded(aAll) {
    this._allMessagesLoaded = aAll;

    FolderDisplayListenerManager._fireListeners("onMessagesLoaded",
                                                [this, aAll]);

    this._notifyWhenActive(this._activeMessagesLoaded);
  },
  _activeMessagesLoaded:
      function FolderDisplayWidget__activeMessagesLoaded() {
    FolderDisplayListenerManager._fireListeners("onActiveMessagesLoaded",
                                                [this]);

    // - if a selectMessage's coming up, get out of here
    if (this._aboutToSelectMessage)
      return;

    // - restore selection
    // Attempt to restore the selection (if we saved it because the view was
    //  being destroyed or otherwise manipulated in a fashion that the normal
    //  nsTreeSelection would be unable to handle.)
    if (this._restoreSelection()) {
      this.ensureRowIsVisible(this.view.dbView.viewIndexForFirstSelectedMsg);
      return;
    }

    // - pending navigation from pushNavigation (probably spacebar triggered)
    // Need to have all messages loaded first.
    if (this._pendingNavigation) {
      // Move it to a local and clear the state in case something bad happens.
      //  (We don't want to swallow the exception.)
      let pendingNavigation = this._pendingNavigation;
      this._pendingNavigation = null;
      this.navigate.apply(this, pendingNavigation);
      return;
    }

    // - if something's already selected (e.g. in a message tab), scroll to the
    //   first selected message and get out
    if (this.view.dbView.numSelected > 0) {
      this.ensureRowIsVisible(this.view.dbView.viewIndexForFirstSelectedMsg);
      return;
    }

    // - new messages
    // if configured to scroll to new messages, try that
    if (Services.prefs.getBoolPref("mailnews.scroll_to_new_message") &&
        this.navigate(nsMsgNavigationType.firstNew, /* select */ false))
      return;

    // - last selected message
    // if configured to load the last selected message (this is currently more
    //  persistent than our saveSelection/restoreSelection stuff), and the view
    //  is backed by a single underlying folder (the only way having just a
    //  message key works out), try that
    if (Services.prefs.getBoolPref("mailnews.remember_selected_message") &&
        this.view.isSingleFolder) {
      // use the displayed folder; nsMsgDBView goes to the effort to save the
      //  state to the viewFolder, so this is the correct course of action.
      let lastLoadedMessageKey = this.view.displayedFolder.lastMessageLoaded;
      if (lastLoadedMessageKey != nsMsgKey_None) {
        this.view.dbView.selectMsgByKey(lastLoadedMessageKey);
        // The message key may not be present in the view for a variety of
        //  reasons.  Beyond message deletion, it simply may not match the
        //  active mail view or quick search, for example.
        if (this.view.dbView.numSelected > 0) {
          this.ensureRowIsVisible(
            this.view.dbView.viewIndexForFirstSelectedMsg);
          return;
        }
      }
    }

    // - towards the newest messages, but don't select
    if (this.view.isSortedAscending && this.view.sortImpliesTemporalOrdering &&
      this.navigate(nsMsgNavigationType.lastMessage, /* select */ false))
      return;

    // - to the top, the coliseum
    this.ensureRowIsVisible(0);
  },

  /**
   * The DBViewWrapper tells us when someone (possibly the wrapper itself)
   *  changes the active mail view so that we can kick the UI to update.
   */
  onMailViewChanged: function FolderDisplayWidget_onMailViewChanged() {
    // only do this if we're currently active.  no need to queue it because we
    //  always update the mail view whenever we are made active.
    if (this.active) {
      let event = document.createEvent("datacontainerevents");
      // you cannot cancel a view change!
      event.initEvent("MailViewChanged", false, false);
      //event.setData("folderDisplay", this);
      window.dispatchEvent(event);
    }
  },

  /**
   * Just the sort or threading was changed, without changing other things.  We
   *  will not get this notification if the view was re-created, for example.
   */
  onSortChanged: function FolderDisplayWidget_onSortChanged() {
    if (this.active)
      UpdateSortIndicators(this.view.primarySortType,
                           this.view.primarySortOrder);

    FolderDisplayListenerManager._fireListeners("onSortChanged",
                                                [this]);
  },

  /**
   * Messages (that may have been displayed) have been removed; this may impact
   * our message selection. We might know it's coming; if we do then
   * this._nextViewIndexAfterDelete should know what view index to select next.
   * For the imap mark-as-deleted we won't know beforehand.
   */
  onMessagesRemoved: function FolderDisplayWidget_onMessagesRemoved() {
    FolderDisplayListenerManager._fireListeners("onMessagesRemoved",
                                                [this]);

    if (this.messageDisplay.onMessagesRemoved())
      return;

    // - we saw this coming
    let rowCount = this.view.dbView.rowCount;
    if (!this._massMoveActive && (this._nextViewIndexAfterDelete != null)) {
      // adjust the index if it is after the last row...
      // (this can happen if the "mail.delete_matches_sort_order" pref is not
      //  set and the message is the last message in the view.)
      if (this._nextViewIndexAfterDelete >= rowCount)
        this._nextViewIndexAfterDelete = rowCount - 1;
      // just select the index and get on with our lives
      this.selectViewIndex(this._nextViewIndexAfterDelete);
      this._nextViewIndexAfterDelete = null;
      return;
    }

    // - we didn't see it coming

    // A deletion happened to our folder.
    let treeSelection = this.treeSelection;
    // we can't fix the selection if we have no selection
    if (!treeSelection)
      return;

    // For reasons unknown (but theoretically knowable), sometimes the selection
    //  object will be invalid.  At least, I've reliably seen a selection of
    //  [0, 0] with 0 rows.  If that happens, we need to fix up the selection
    //  here.
    if (rowCount == 0 && treeSelection.count)
      // nsTreeSelection doesn't generate an event if we use clearRange, so use
      //  that to avoid spurious events, given that we are going to definitely
      //  trigger a change notification below.
      treeSelection.clearRange(0, 0);

    // Check if we now no longer have a selection, but we had exactly one
    //  message selected previously.  If we did, then try and do some
    //  'persistence of having a thing selected'.
    if (treeSelection.count == 0 &&
        this._mostRecentSelectionCounts.length > 1 &&
        this._mostRecentSelectionCounts[1] == 1 &&
        this._mostRecentCurrentIndices[1] != -1) {
      let targetIndex = this._mostRecentCurrentIndices[1];
      if (targetIndex >= rowCount)
        targetIndex = rowCount - 1;
      this.selectViewIndex(targetIndex);
      return;
    }

    // Otherwise, just tell the view that things have changed so it can update
    //  itself to the new state of things.
    // tell the view that things have changed so it can update itself suitably.
    if (this.view.dbView)
      this.view.dbView.selectionChanged();
  },

  /**
   * Messages were not actually removed, but we were expecting that they would
   *  be.  Clean-up what onMessagesRemoved would have cleaned up, namely the
   *  next view index to select.
   */
  onMessageRemovalFailed:
      function FolderDisplayWidget_onMessageRemovalFailed() {
    this._nextViewIndexAfterDelete = null;
    FolderDisplayListenerManager._fireListeners("onMessagesRemovalFailed",
                                                [this]);
  },

  /**
   * Update the status bar to reflect our exciting message counts.
   */
  onMessageCountsChanged: function FolderDisplayWidget_onMessageCountsChaned() {
    if (this.active)
      UpdateStatusMessageCounts(this.displayedFolder);
    FolderDisplayListenerManager._fireListeners("onMessageCountsChanged",
                                                [this]);
  },
  //@}
  /* ===== End IDBViewWrapperListener ===== */

  /*   ==================================   */
  /* ===== nsIMsgDBViewCommandUpdater ===== */
  /*   ==================================   */

  /**
   * @name nsIMsgDBViewCommandUpdater Interface
   * @private
   */
  //@{

  /**
   * This gets called when the selection changes AND !suppressCommandUpdating
   *  AND (we're not removing a row OR we are now out of rows).
   * In response, we update the toolbar.
   */
  updateCommandStatus: function FolderDisplayWidget_updateCommandStatus() {
    // Do this only if we're active. If we aren't, we're going to take care of
    // this when we switch back to the tab.
    if (this._active)
      UpdateMailToolbar("FolderDisplayWidget command updater notification");
  },

  /**
   * This gets called by nsMsgDBView::UpdateDisplayMessage following a call
   *  to nsIMessenger.OpenURL to kick off message display OR (UDM gets called)
   *  by nsMsgDBView::SelectionChanged in lieu of loading the message because
   *  mSupressMsgDisplay.
   * In other words, we get notified immediately after the process of displaying
   *  a message triggered by the nsMsgDBView happens.  We get some arguments
   *  that are display optimizations for historical reasons (as usual).
   *
   * Things this makes us want to do:
   * - Set the tab title, perhaps.  (If we are a message display.)
   * - Update message counts, because things might have changed, why not.
   * - Update some toolbar buttons, why not.
   *
   * @param aFolder The display/view folder, as opposed to the backing folder.
   * @param aSubject The subject with "Re: " if it's got one, which makes it
   *     notably different from just directly accessing the message header's
   *     subject.
   * @param aKeywords The keywords, which roughly translates to message tags.
   */
  displayMessageChanged: function FolderDisplayWidget_displayMessageChanged(
      aFolder, aSubject, aKeywords) {
    // Hide previous stale message to prevent brief threadpane selection and
    // content displayed mismatch, on both folder and tab changes.
    let browser = getBrowser();
    if (browser && browser.contentDocument && browser.contentDocument.body)
      browser.contentDocument.body.hidden = true;

    UpdateMailToolbar("FolderDisplayWidget displayed message changed");
    let viewIndex = this.view.dbView.currentlyDisplayedMessage;
    let msgHdr = (viewIndex != nsMsgViewIndex_None) ?
                   this.view.dbView.getMsgHdrAt(viewIndex) : null;

    if (this._tabInfo && !FeedMessageHandler.shouldShowSummary(msgHdr, false)) {
      // Load a web page if we have a tabInfo (i.e. 3pane), but not for a
      // standalone window instance; it has its own method.
      FeedMessageHandler.setContent(msgHdr, false);
    }

    this.messageDisplay.onDisplayingMessage(msgHdr);

    // Although deletes should now be so fast that the user has no time to do
    //  anything, treat the user explicitly choosing to display a different
    //  message as invalidating the choice we automatically made for them when
    //  they initiated the message delete / move. (bug 243532)
    // Note: legacy code used to check whether the message being displayed was
    //  the one being deleted, so it didn't erroneously clear the next message
    //  to display (bug 183394).  This is not a problem for us because we hook
    //  our notification when the message load is initiated, rather than when
    //  the message completes loading.
    this._nextViewIndexAfterDelete = null;
  },

  /**
   * This gets called as a hint that the currently selected message is junk and
   *  said junked message is going to be moved out of the current folder, or
   *  right before a header is removed from the db view.  The legacy behaviour
   *  is to retrieve the msgToSelectAfterDelete attribute off the db view,
   *  stashing it for benefit of the code that gets called when a message
   *  move/deletion is completed so that we can trigger its display.
   */
  updateNextMessageAfterDelete:
      function FolderDisplayWidget_updateNextMessageAfterDelete() {
    this.hintAboutToDeleteMessages();
  },

  /**
   * The most recent currentIndexes on the selection (from the last time
   *  summarizeSelection got called).  We use this in onMessagesRemoved if
   *  we get an unexpected notification.
   * We keep a maximum of 2 entries in this list.
   */
  _mostRecentCurrentIndices: undefined, // initialized in constructor
  /**
   * The most recent counts on the selection (from the last time
   *  summarizeSelection got called).  We use this in onMessagesRemoved if
   *  we get an unexpected notification.
   * We keep a maximum of 2 entries in this list.
   */
  _mostRecentSelectionCounts: undefined, // initialized in constructor

  /**
   * Always called by the db view when the selection changes in
   *  SelectionChanged.  This event will come after the notification to
   *  displayMessageChanged (if one happens), and before the notification to
   *  updateCommandStatus (if one happens).
   */
  summarizeSelection: function FolderDisplayWidget_summarizeSelection() {
    // save the current index off in case the selection gets deleted out from
    //  under us and we want to have persistence of actually-having-something
    //  selected.
    let treeSelection = this.treeSelection;
    if (treeSelection) {
      this._mostRecentCurrentIndices.unshift(treeSelection.currentIndex);
      this._mostRecentCurrentIndices.splice(2);
      this._mostRecentSelectionCounts.unshift(treeSelection.count);
      this._mostRecentSelectionCounts.splice(2);
    }
    return this.messageDisplay.onSelectedMessagesChanged();
  },
  //@}
  /* ===== End nsIMsgDBViewCommandUpdater ===== */

  /* ===== Hints from the command infrastructure ===== */
  /**
   * @name Command Infrastructure Hints
   * @protected
   */
  //@{

  /**
   * doCommand helps us out by telling us when it is telling the view to delete
   *  some messages.  Ideally it should go through us / the DB View Wrapper to
   *  kick off the delete in the first place, but that's a thread I don't want
   *  to pull on right now.
   * We use this hint to figure out the next message to display once the
   *  deletion completes.  We do this before the deletion happens because the
   *  selection is probably going away (except in the IMAP delete model), and it
   *  might be too late to figure this out after the deletion happens.
   * Our automated complement (that calls us) is updateNextMessageAfterDelete.
   */
  hintAboutToDeleteMessages:
      function FolderDisplayWidget_hintAboutToDeleteMessages() {
    // save the value, even if it is nsMsgViewIndex_None.
    this._nextViewIndexAfterDelete = this.view.dbView.msgToSelectAfterDelete;
  },

  /**
   * The archive code tells us when it is starting to archive messages.  This
   *  is different from hinting about deletion because it will also tell us
   *  when it has completed its mass move.
   * The UI goal is that we do not immediately jump beyond the selected messages
   *  to the next message until all of the selected messages have been
   *  processed (moved).  Ideally we would also do this when deleting messages
   *  from a multiple-folder backed message view, but we don't know when the
   *  last job completes in that case (whereas in this case we do because of the
   *  call to hintMassMoveCompleted.)
   */
  hintMassMoveStarting:
      function FolderDisplayWidget_hintMassMoveStarting() {
    this.hintAboutToDeleteMessages();
    this._massMoveActive = true;
  },

  /**
   * The archival has completed, we can finally let onMessagseRemoved run to
   *  completion.
   */
  hintMassMoveCompleted:
      function FolderDisplayWidget_hintMassMoveCompleted() {
    this._massMoveActive = false;
    this.onMessagesRemoved();
  },

  /**
   * When a right-click on the thread pane is going to alter our selection, we
   *  get this notification (currently from |ChangeSelectionWithoutContentLoad|
   *  in msgMail3PaneWindow.js), which lets us save our state.
   * This ends one of two ways: we get made inactive because a new tab popped up
   *  or we get a call to |hintRightClickSelectionPerturbationDone|.
   *
   * Ideally, we could just save off our current nsITreeSelection and restore it
   *  when this is all over.  This assumption would rely on the underlying view
   *  not having any changes to its rows before we restore the selection.  I am
   *  not confident we can rule out background processes making changes, plus
   *  the right-click itself may mutate the view (although we could try and get
   *  it to restore the selection before it gets to the mutation part).  Our
   *  only way to resolve this would be to create a 'tee' like fake selection
   *  that would proxy view change notifications to both sets of selections.
   *  That is hard.
   * So we just use the existing _saveSelection/_restoreSelection mechanism
   *  which is potentially very costly.
   */
  hintRightClickPerturbingSelection:
      function FolderDisplayWidget_hintRightClickPerturbingSelect() {
    this._saveSelection();
  },

  /**
   * When a right-click on the thread pane altered our selection (which we
   *  should have received a call to |hintRightClickPerturbingSelection| for),
   *  we should receive this notification from
   *  |RestoreSelectionWithoutContentLoad| when it wants to put things back.
   */
  hintRightClickSelectionPerturbationDone:
      function FolderDisplayWidget_hintRightClickSelectionPerturbationDone() {
    this._restoreSelection();
  },
  //@}
  /* ===== End hints from the command infrastructure ==== */

  _updateThreadDisplay: function FolderDisplayWidget__updateThreadDisplay() {
    if (this.active) {
      if (this.view.dbView) {
        UpdateSortIndicators(this.view.dbView.sortType,
                             this.view.dbView.sortOrder);
        SetNewsFolderColumns();
      }
    }
  },

  /**
   * Update the UI display apart from the thread tree because the folder being
   *  displayed has changed.  This can be the result of changing the folder in
   *  this FolderDisplayWidget, or because this FolderDisplayWidget is being
   *  made active.  _updateThreadDisplay handles the parts of the thread tree
   *  that need updating.
   */
  _updateContextDisplay: function FolderDisplayWidget__updateContextDisplay() {
    if (this.active) {
      UpdateMailToolbar("FolderDisplayWidget updating context");
      UpdateStatusQuota(this.displayedFolder);
      UpdateStatusMessageCounts(this.displayedFolder);

      // - mail view combo-box.
      this.onMailViewChanged();
    }
  },

  /**
   * @name Activation Control
   * @protected
   */
  //@{

  /**
   * Run the provided notification function right now if we are 'active' (the
   *  currently displayed tab), otherwise queue it to be run when we become
   *  active.  We do this because our tabbing model uses multiplexed (reused)
   *  widgets, and extensions likewise depend on these global/singleton things.
   * If the requested notification function is already queued, it will not be
   *  added a second time, and the original call ordering will be maintained.
   *  If a new call ordering is required, the list of notifications should
   *  probably be reset by the 'big bang' event (new view creation?).
   */
  _notifyWhenActive:
      function FolderDisplayWidget__notifyWhenActive(aNotificationFunc) {
    if (this._active) {
      aNotificationFunc.call(this);
    }
    else {
      if (this._notificationsPendingActivation.indexOf(aNotificationFunc) == -1)
        this._notificationsPendingActivation.push(aNotificationFunc);
    }
  },

  /**
   * Some notifications cannot run while the FolderDisplayWidget is inactive
   *  (presumbly because it is in a background tab).  We accumulate those in
   *  _notificationsPendingActivation and then this method runs them when we
   *  become active again.
   */
  _runNotificationsPendingActivation:
      function FolderDisplayWidget__runNotificationsPendingActivation() {
    if (!this._notificationsPendingActivation.length)
      return;

    let pendingNotifications = this._notificationsPendingActivation;
    this._notificationsPendingActivation = [];
    for each (let [, notif] in Iterator(pendingNotifications)) {
      notif.call(this);
    }
  },

  /// This is not guaranteed to be up to date if the folder display is active
  _folderPaneVisible: null,

  /**
   * Whether the folder pane is visible. When we're inactive, we stash the value
   * in |this._folderPaneVisible|.
   */
  get folderPaneVisible() {
    if (this._active) {
      let folderPaneBox = document.getElementById("folderPaneBox");
      if (folderPaneBox)
        return !folderPaneBox.collapsed;
    }
    else {
      return this._folderPaneVisible;
    }

    return null;
  },

  /**
   * Sets the visibility of the folder pane. This should reflect reality and
   * not define it (for active tabs at least).
   */
  set folderPaneVisible(aVisible) {
    this._folderPaneVisible = aVisible;
  },

  get active() {
    return this._active;
  },

  /**
   * Make this FolderDisplayWidget the 'active' widget by updating globals and
   *  linking us up to the UI widgets.  This is intended for use by the tabbing
   *  logic.
   */
  makeActive: function FolderDisplayWidget_makeActive(aWasInactive) {
    let wasInactive = !this._active;

    // -- globals
    // update per-tab globals that we own
    gFolderDisplay = this;
    gMessageDisplay = this.messageDisplay;
    gDBView = this.view.dbView;
    messenger = this.messenger;

    // update singleton globals' state
    msgWindow.openFolder = this.view.displayedFolder;

    // This depends on us being active, so get it before we're marked active.
    // We don't get this._folderPaneActive directly for idempotence's sake.
    let folderPaneVisible = this.folderPaneVisible;

    this._active = true;
    this._runNotificationsPendingActivation();

    // Make sure we get rid of this._fakeTreeSelection, whether we use it below
    // or not.
    let fakeTreeSelection = this._fakeTreeSelection;
    this._fakeTreeSelection = null;

    FolderDisplayListenerManager._fireListeners("onMakeActive",
                                                [this, aWasInactive]);

    // -- UI

    // We're going to set this to true if we've already caused a
    // selectionChanged event, so that the message display doesn't cause
    // another, or if a select message is coming up shortly.
    let dontReloadMessage = this._aboutToSelectMessage;
    // thread pane if we have a db view
    if (this.view.dbView) {
      // Make sure said thread pane is visible.  If we do this after we re-root
      //  the tree, the thread pane may not actually replace the account central
      //  pane.  Concerning...
      this._showThreadPane();

      // some things only need to happen if we are transitioning from inactive
      //  to active
      if (wasInactive) {
        if (this.treeBox) {
          // We might have assigned our JS tree selection to
          //  this.view.dbView.selection back in _hookUpFakeTreeBox. If we've
          //  done so, null the selection out so that the line after this
          //  causes a real selection to be created.
          // If we haven't done so, we're fine as selection would be null here
          //  anyway. (The fake tree selection should persist only till the
          //  first time the tab is switched to.)
          if (fakeTreeSelection)
            this.view.dbView.selection = null;

          // Setting the 'view' attribute on treeBox results in the following
          //  effective calls, noting that in makeInactive we made sure to null
          //  out its view so that it won't try and clean up any views or their
          //  selections.  (The actual actions happen in
          //  nsTreeBodyFrame::SetView)
          // - this.view.dbView.selection.tree = this.treeBox
          // - this.view.dbView.setTree(this.treeBox)
          // - this.treeBox.view = this.view.dbView (in
          //   nsTreeBodyObject::SetView)
          this.treeBox.view = this.view.dbView;

          if (fakeTreeSelection) {
            fakeTreeSelection.duplicateSelection(this.view.dbView.selection);
            // Since duplicateSelection will fire a selectionChanged event,
            // which will try to reload the message, we shouldn't do the same.
            dontReloadMessage = true;
          }
          if (this._savedFirstVisibleRow != null)
            this.treeBox.scrollToRow(this._savedFirstVisibleRow);
        }
      }

      // Always restore the column state if we have persisted state.  We restore
      //  state on folder entry, in which case we were probably not inactive.
      this._restoreColumnStates();

      // the tab mode knows whether we are folder or message display, which
      //  impacts the legal modes
      if (this._tabInfo)
        mailTabType._setPaneStates(this._tabInfo.mode.legalPanes,
          {folder: folderPaneVisible,
           message: this.messageDisplay.visible});

      // update the columns and such that live inside the thread pane
      this._updateThreadDisplay();

      this.messageDisplay.makeActive(dontReloadMessage);
    }
    // account central stuff when we don't have a dbview
    else {
      this._showAccountCentral();
      if (this._tabInfo)
        mailTabType._setPaneStates(this._tabInfo.mode.accountCentralLegalPanes,
          {folder: folderPaneVisible});
    }

    this._updateContextDisplay();
  },

  /**
   * Cause the displayDeck to display the thread pane.
   */
  _showThreadPane: function FolderDisplayWidget__showThreadPane() {
    document.getElementById("displayDeck").selectedPanel =
      document.getElementById("threadPaneBox");
  },

  /**
   * Cause the displayDeck to display the (preference configurable) account
   *  central page.
   */
  _showAccountCentral: function FolderDisplayWidget__showAccountCentral() {
    var accountBox = document.getElementById("accountCentralBox");
    document.getElementById("displayDeck").selectedPanel = accountBox;
    var prefName = "mailnews.account_central_page.url";
    // oh yeah, 'pref' is a global all right.
    var acctCentralPage =
      Services.prefs.getComplexValue(prefName,
                                     Components.interfaces.nsIPrefLocalizedString).data;
    window.frames["accountCentralPane"].location.href = acctCentralPage;
  },

  /**
   * Call this when the tab using us is being hidden.
   */
  makeInactive: function FolderDisplayWidget_makeInactive() {
    // - things to do before we mark ourselves inactive (because they depend on
    //   us being active)

    // getColumnStates returns _savedColumnStates when we are inactive (and is
    //  used by _saveColumnStates) so we must do this before marking inactive.
    this._saveColumnStates();

    // - mark us inactive
    this._active = false;

    // - (everything after this point doesn't care that we are marked inactive)
    // save the folder pane's state always
    this._folderPaneVisible =
      !document.getElementById("folderPaneBox").collapsed;

    if (this.view.dbView) {
      if (this.treeBox)
        this._savedFirstVisibleRow = this.treeBox.getFirstVisibleRow();

      // save the message pane's state only when it is potentially visible
      this.messagePaneCollapsed =
        document.getElementById("messagepaneboxwrapper").collapsed;

      this.hookUpFakeTreeBox(true);
    }

    this.messageDisplay.makeInactive();
  },
  //@}

  /**
   * Called when we want to "disable" the real treeBox for a while and hook up
   * the fake tree box to the db view. This also takes care of our
   * treeSelection object.
   *
   * @param aNullRealTreeBoxView true if we want to null out the real tree box.
   *          We don't want to null out the view if we're opening a background
   *          tab, for example.
   * @private
   */
  hookUpFakeTreeBox: function FolderDisplayWidget_hookUpFakeTreeBox(
                         aNullRealTreeBoxView) {
    // save off the tree selection object.  the nsTreeBodyFrame will make the
    //  view forget about it when our view is removed, so it's up to us to
    //  save it.
    // We use this.treeSelection instead of this.view.dbView.selection here,
    //  so that we get the fake tree selection if we have it.
    let treeSelection = this.treeSelection;
    // if we want to, make the tree forget about the view right now so we can
    //  tell the db view about its selection object so it can try and keep it
    //  up-to-date even while hidden in the background
    if (aNullRealTreeBoxView && this.treeBox)
      this.treeBox.view = null;
    // (and tell the db view about its selection again...)
    this.view.dbView.selection = treeSelection;

    // hook the dbview up to the fake tree box
    this._fakeTreeBox.view = this.view.dbView;
    this.view.dbView.setTree(this._fakeTreeBox);
    treeSelection.tree = this._fakeTreeBox;
  },

  /**
   * @name Command Support
   */
  //@{

  /**
   * @return true if there is a db view and the command is enabled on the view.
   *  This function hides some of the XPCOM-odditities of the getCommandStatus
   *  call.
   */
  getCommandStatus: function FolderDisplayWidget_getCommandStatus(
      aCommandType, aEnabledObj, aCheckStatusObj) {
    // no view means not enabled
    if (!this.view.dbView)
      return false;
    let enabledObj = {}, checkStatusObj = {};
    this.view.dbView.getCommandStatus(aCommandType, enabledObj, checkStatusObj);
    return enabledObj.value;
  },

  /**
   * Make code cleaner by allowing peoples to call doCommand on us rather than
   *  having to do folderDisplayWidget.view.dbView.doCommand.
   *
   * @param aCommandName The command name to invoke.
   */
  doCommand: function FolderDisplayWidget_doCommand(aCommandName) {
    return this.view.dbView && this.view.dbView.doCommand(aCommandName);
  },

  /**
   * Make code cleaner by allowing peoples to call doCommandWithFolder on us
   *  rather than having to do:
   *  folderDisplayWidget.view.dbView.doCommandWithFolder.
   *
   * @param aCommandName The command name to invoke.
   * @param aFolder The folder context for the command.
   */
  doCommandWithFolder: function FolderDisplayWidget_doCommandWithFolder(
      aCommandName, aFolder) {
    return this.view.dbView &&
           this.view.dbView.doCommandWithFolder(aCommandName, aFolder);
  },
  //@}

  /**
   * @return true when account central is being displayed.
   * @groupName Displayed
   */
  get isAccountCentralDisplayed() {
    return (this.view.dbView == null);
  },

  /**
   * @name Navigation
   * @protected
   */
  //@{

  /**
   * Navigate using nsMsgNavigationType rules and ensuring the resulting row is
   *  visible.  This is trickier than it used to be because we now support
   *  treating collapsed threads as the set of all the messages in the collapsed
   *  thread rather than just the root message in that thread.
   *
   * @param {nsMsgNavigationType} aNavType navigation command.
   * @param {Boolean} [aSelect=true] should we select the message if we find
   *     one?
   *
   * @return true if the navigation constraint matched anything, false if not.
   *     We will have navigated if true, we will have done nothing if false.
   */
  navigate: function FolderDisplayWidget_navigate(aNavType, aSelect) {
    if (aSelect === undefined)
      aSelect = true;
    let resultKeyObj = {}, resultIndexObj = {}, threadIndexObj = {};

    let summarizeSelection = this.summarizeSelectionInFolder;

    let treeSelection = this.treeSelection; // potentially magic getter
    let currentIndex = treeSelection ? treeSelection.currentIndex : 0;

    let viewIndex;
    // if we're doing next unread, and a collapsed thread is selected, and
    // the top level message is unread, just set the result manually to
    // the top level message, without using viewNavigate.
    if (summarizeSelection &&
        aNavType == nsMsgNavigationType.nextUnreadMessage &&
        currentIndex != -1 &&
        this.view.isCollapsedThreadAtIndex(currentIndex) &&
        !(this.view.dbView.getFlagsAt(currentIndex) &
          nsMsgMessageFlags.Read)) {
      viewIndex = currentIndex;
    }
    else {
      // always 'wrap' because the start index is relative to the selection.
      // (keep in mind that many forms of navigation do not care about the
      //  starting position or 'wrap' at all; for example, firstNew just finds
      //  the first new message.)
      // allegedly this does tree-expansion for us.
      this.view.dbView.viewNavigate(aNavType, resultKeyObj, resultIndexObj,
                                    threadIndexObj, true);
      viewIndex = resultIndexObj.value;
    }

    if (viewIndex == nsMsgViewIndex_None)
      return false;

    // - Expand if required.
    // (The nsMsgDBView isn't really aware of the varying semantics of
    //  collapsed threads, so viewNavigate might tell us about the root message
    //  and leave it collapsed, not realizing that it needs to be expanded.)
    if (summarizeSelection &&
        this.view.isCollapsedThreadAtIndex(viewIndex))
      this.view.dbView.toggleOpenState(viewIndex);

    if (aSelect)
      this.selectViewIndex(viewIndex);
    else
      this.ensureRowIsVisible(viewIndex);
    return true;
  },

  /**
   * Push a call to |navigate| to be what we do once we successfully open the
   *  next folder.  This is intended to be used by cross-folder navigation
   *  code.  It should call this method before triggering the folder change.
   */
  pushNavigation: function FolderDisplayWidget_navigate(aNavType, aSelect) {
    this._pendingNavigation = [aNavType, aSelect];
  },

  /**
   * @return true if we are able to navigate using the given navigation type at
   *  this time.
   */
  navigateStatus: function FolderDisplayWidget_navigateStatus(aNavType) {
    if (!this.view.dbView)
      return false;
    return this.view.dbView.navigateStatus(aNavType);
  },
  //@}

  /**
   * @name Selection
   */
  //@{

  /**
   * @returns the message header for the first selected message, or null if
   *  there is no selected message.
   *
   * If the user has right-clicked on a message, this method will return that
   *  message and not the 'current index' (the dude with the dotted selection
   *  rectangle around him.)  If you instead always want the currently
   *  displayed message (which is not impacted by right-clicking), then you
   *  would want to access the displayedMessage property on the
   *  MessageDisplayWidget.  You can get to that via the messageDisplay
   *  attribute on this object or (potentially) via the gMessageDisplay object.
   */
  get selectedMessage() {
    // there are inconsistencies in hdrForFirstSelectedMessage between
    //  nsMsgDBView and nsMsgSearchDBView in whether they use currentIndex,
    //  do it ourselves.  (nsMsgDBView does not use currentIndex, search does.)
    let treeSelection = this.treeSelection;
    if (!treeSelection || !treeSelection.count)
      return null;
    let minObj = {}, maxObj = {};
    treeSelection.getRangeAt(0, minObj, maxObj);
    return this.view.dbView.getMsgHdrAt(minObj.value);
  },

  /**
   * @return true if there is a selected message and it's an RSS feed message;
   *  a feed message does not have to be in an rss account folder if stored in
   *  Tb15 and later.
   */
  get selectedMessageIsFeed() {
    return FeedMessageHandler.isFeedMessage(this.selectedMessage);
  },

  /**
   * @return true if there is a selected message and it's an IMAP message.
   */
  get selectedMessageIsImap() {
    let message = this.selectedMessage;
    return Boolean(message && message.folder &&
                   message.folder.flags & nsMsgFolderFlags.ImapBox);
  },

  /**
   * @return true if there is a selected message and it's a news message.  It
   *  would be great if messages knew this about themselves, but they don't.
   */
  get selectedMessageIsNews() {
    let message = this.selectedMessage;
    return Boolean(message && message.folder &&
                   (message.folder.flags & nsMsgFolderFlags.Newsgroup));
  },

  /**
   * @return true if there is a selected message and it's an external message,
   *  meaning it is loaded from an .eml file on disk or is an rfc822 attachment
   *  on a message.
   */
  get selectedMessageIsExternal() {
    let message = this.selectedMessage;
    // Dummy messages currently lack a folder.  This is not a great heuristic.
    // I have annotated msgHdrViewOverlay.js which provides the dummy header to
    //  express this implementation dependency.
    // (Currently, since external mails can only be opened in standalone windows
    //  which subclass us, we could always return false, and have the subclass
    //  return true using its own heuristics.  But since we are moving to a tab
    //  model more heavily, at some point the 3-pane will need this.)
    return Boolean(message && !message.folder);
  },

  /**
   * @return true if there is a selected message and the message belongs to an
   *              ignored thread.
   */
  get selectedMessageThreadIgnored() {
    let message = this.selectedMessage;
    return Boolean(message && message.folder &&
                   message.folder.msgDatabase.IsIgnored(message.messageKey));
  },

  /**
   * @return true if there is a selected message and the message is the base
   *              message for an ignored subthread.
   */
  get selectedMessageSubthreadIgnored() {
    let message = this.selectedMessage;
    return Boolean(message && message.folder &&
                   (message.flags & nsMsgMessageFlags.Ignored));
  },

  /**
   * @return true if there is a selected message and the message belongs to a
   *              watched thread.
   */
  get selectedMessageThreadWatched() {
    let message = this.selectedMessage;
    return Boolean(message && message.folder &&
                   message.folder.msgDatabase.IsWatched(message.messageKey));
  },

  /**
   * @return the number of selected messages.  If summarizeSelectionInFolder is
   *  true, then any collapsed thread roots that are selected will also
   *  conceptually have all of the messages in that thread selected.
   */
  get selectedCount() {
    if (!this.view.dbView)
      return 0;
    return this.view.dbView.numSelected;
  },

  /**
   * Provides a list of the view indices that are selected which is *not* the
   *  same as the rows of the selected messages.  When
   *  summarizeSelectionInFolder is true, messages may be selected but not
   *  visible (because the thread root is selected.)
   * You probably want to use the |selectedMessages| attribute instead of this
   *  one.  (Or selectedMessageUris in some rare cases.)
   *
   * If the user has right-clicked on a message, this will return that message
   *  and not the selection prior to the right-click.
   *
   * @return a list of the view indices that are currently selected
   */
  get selectedIndices() {
    if (!this.view.dbView)
      return [];

    return this.view.dbView.getIndicesForSelection({});
  },

  /**
   * Provides a list of the message headers for the currently selected messages.
   *  If summarizeSelectionInFolder is true, then any collapsed thread roots
   *  that are selected will also (conceptually) have all of the messages in
   *  that thread selected and they will be included in the returned list.
   *
   * If the user has right-clicked on a message, this will return that message
   *  (and any collapsed children if so enabled) and not the selection prior to
   *  the right-click.
   *
   * @return a list of the message headers for the currently selected messages.
   *     If there are no selected messages, the result is an empty list.
   */
  get selectedMessages() {
    if (!this.view.dbView)
      return [];
    // getMsgHdrsForSelection returns an nsIMutableArray.  We want our callers
    //  to have a user-friendly JS array and not have to worry about
    //  QueryInterfacing the values (or needing to know to use fixIterator).
    return [msgHdr for
              (msgHdr in fixIterator(
                          this.view.dbView.getMsgHdrsForSelection(),
                          Components.interfaces.nsIMsgDBHdr))];
  },

  /**
   * @return a list of the URIs for the currently selected messages or null
   *     (instead of a list) if there are no selected messages.  Do not
   *     pass around URIs unless you have a good reason.  Legacy code is an
   *     ok reason.
   *
   * If the user has right-clicked on a message, this will return that message's
   *  URI and not the selection prior to the right-click.
   */
  get selectedMessageUris() {
    if (!this.view.dbView)
      return null;

    let messageArray = this.view.dbView.getURIsForSelection({});
    return messageArray.length ? messageArray : null;
  },

  /**
   * @return true if all the selected messages can be archived, false otherwise.
   */
  get canArchiveSelectedMessages() {
    if (!this.view.dbView || this.messageDisplay.isDummy)
      return false;

    if (this.selectedCount == 0)
      return false;
    return this.selectedMessages.every(function(msg) {
      let identity = getIdentityForHeader(msg);
      return Boolean(identity && identity.archiveEnabled);
    });
  },

  /**
   * @return true if all the selected messages can be deleted from their
   * folders, false otherwise.
   */
  get canDeleteSelectedMessages() {
    if (!this.view.dbView)
      return false;

    let selectedMessages = this.selectedMessages;
    for (let i = 0; i < selectedMessages.length; ++i) {
      if (selectedMessages[i].folder &&
          !selectedMessages[i].folder.canDeleteMessages) {
        return false;
      }
    }
    return true;
  },

  /**
   * Clear the tree selection, making sure the message pane is cleared and
   *  the context display (toolbars, etc.) are updated.
   */
  clearSelection: function FolderDisplayWidget_clearSelection() {
    let treeSelection = this.treeSelection; // potentially magic getter
    if (!treeSelection)
      return;
    treeSelection.clearSelection();
    this.messageDisplay.clearDisplay();
    this._updateContextDisplay();
  },

  /// Whether we're about to select a message
  _aboutToSelectMessage: false,

  /**
   * This needs to be called to let us know that a selectMessage or equivalent
   * is coming  up right after a show() call, so that we know that a double
   * message load won't be happening.
   *
   * This can be assumed to be idempotent.
   */
  selectMessageComingUp: function FolderDisplayWidget_selectMessageComingUp() {
    this._aboutToSelectMessage = true;
  },

  /**
   * Select a message for display by header.  Attempt to select the message
   *  right now.  If we were unable to find it, update our saved selection
   *  to want to display the message.  Threads are expanded to find the header.
   *
   * @param aMsgHdr The message header to select for display.
   * @param [aForceSelect] If the message is not in the view and this is true,
   *                       we will drop any applied view filters to look for the
   *                       message. The dropping of view filters is persistent,
   *                       so use with care. Defaults to false.
   */
  selectMessage: function FolderDisplayWidget_selectMessage(aMsgHdr,
      aForceSelect) {
    let viewIndex = this.view.getViewIndexForMsgHdr(aMsgHdr, aForceSelect);
    if (viewIndex != nsMsgViewIndex_None) {
      this._savedSelection = null;
      this.selectViewIndex(viewIndex);
    }
    else {
      this._savedSelection = {messages: [{messageId: aMsgHdr.messageId}],
                              forceSelect: aForceSelect};
      // queue the selection to be restored once we become active if we are not
      //  active.
      if (!this.active)
        this._notifyWhenActive(this._restoreSelection);
    }

    // Do this here instead of at the beginning to prevent reentrancy issues
    this._aboutToSelectMessage = false;
  },

  /**
   * Select all of the provided nsIMsgDBHdrs in the aMessages array, expanding
   *  threads as required.  If we were not able to find all of the messages,
   *  update our saved selection to want to display the messages.  The messages
   *  will then be selected when we are made active or all messages in the
   *  folder complete loading.  This is to accomodate the use-case where we
   *  are backed by an in-progress search and no
   *
   * @param aMessages An array of nsIMsgDBHdr instances.
   * @param [aForceSelect] If a message is not in the view and this is true,
   *                       we will drop any applied view filters to look for the
   *                       message. The dropping of view filters is persistent,
   *                       so use with care. Defaults to false.
   * @param aDoNotNeedToFindAll If true (can be omitted and left undefined), we
   *     do not attempt to save the selection for future use.  This is intended
   *     for use by the _restoreSelection call which is the end-of-the-line for
   *     restoring the selection.  (Once it gets called all of our messages
   *     should have already been loaded.)
   */
  selectMessages: function FolderDisplayWidget_selectMessages(
      aMessages, aForceSelect, aDoNotNeedToFindAll) {
    let treeSelection = this.treeSelection; // potentially magic getter
    let foundAll = true;
    if (treeSelection) {
      let minRow = null, maxRow = null;

      treeSelection.selectEventsSuppressed = true;
      treeSelection.clearSelection();

      for each (let [, msgHdr] in Iterator(aMessages)) {
        let viewIndex = this.view.getViewIndexForMsgHdr(msgHdr, aForceSelect);

        if (viewIndex != nsMsgViewIndex_None) {
          if (minRow == null || viewIndex < minRow)
            minRow = viewIndex;
          if (maxRow == null || viewIndex > maxRow )
            maxRow = viewIndex;
          // nsTreeSelection is actually very clever about doing this
          //  efficiently.
          treeSelection.rangedSelect(viewIndex, viewIndex, true);
        }
        else {
          foundAll = false;
        }

        // make sure the selection is as visible as possible
        if (minRow != null)
          this.ensureRowRangeIsVisible(minRow, maxRow);
      }

      treeSelection.selectEventsSuppressed = false;

      // If we haven't selected every message, we'll set |this._savedSelection|
      // below, so it's fine to null it out at this point.
      this._savedSelection = null;
    }

    // Do this here instead of at the beginning to prevent reentrancy issues
    this._aboutToSelectMessage = false;

    // Two cases.
    // 1. The tree selection isn't there at all.
    // 2. The tree selection is there, and we needed to find all messages, but
    //    we didn't.
    if (!treeSelection || (!aDoNotNeedToFindAll && !foundAll)) {
      this._savedSelection = {messages:
                              [{messageId: msgHdr.messageId} for each
                              ([, msgHdr] in Iterator(aMessages))],
                              forceSelect: aForceSelect};
      if (!this.active)
        this._notifyWhenActive(this._restoreSelection);
    }
  },

  /**
   * Select the message at view index.
   *
   * @param aViewIndex The view index to select.  This will be bounds-checked
   *     and if it is outside the bounds, we will clear the selection and
   *     bail.
   */
  selectViewIndex: function FolderDisplayWidget_selectViewIndex(aViewIndex) {
    let treeSelection = this.treeSelection;
    // if we have no selection, we can't select something
    if (!treeSelection)
      return;
    let rowCount = this.view.dbView.rowCount;
    if ((aViewIndex == nsMsgViewIndex_None) ||
        (aViewIndex < 0) || (aViewIndex >= rowCount)) {
      this.clearSelection();
      return;
    }

    // Check whether the index is already selected/current.  This can be the
    //  case when we are here as the result of a deletion.  Assuming
    //  nsMsgDBView::NoteChange ran and was not suppressing change
    //  notifications, then it's very possible the selection is already where
    //  we want it to go.  However, in that case, nsMsgDBView::SelectionChanged
    //  bailed without doing anything because m_deletingRows...
    // So we want to generate a change notification if that is the case. (And
    //  we still want to call ensureRowIsVisible, as there may be padding
    //  required.)
    if ((treeSelection.count == 1) &&
        ((treeSelection.currentIndex == aViewIndex) ||
         treeSelection.isSelected(aViewIndex))) {
      // Make sure the index we just selected is also the current index.
      //  This can happen when the tree selection adjusts itself as a result of
      //  changes to the tree as a result of deletion.  This will not trigger
      //  a notification.
      treeSelection.select(aViewIndex);
      this.view.dbView.selectionChanged();
    }
    // Previous code was concerned about avoiding updating commands on the
    //  assumption that only the selection count mattered.  We no longer
    //  make this assumption.
    // Things that may surprise you about the call to treeSelection.select:
    // 1) This ends up calling the onselect method defined on the XUL 'tree'
    //    tag.  For the 3pane this is the ThreadPaneSelectionChanged method in
    //    threadPane.js.  That code checks a global to see if it is dealing
    //    with a right-click, and ignores it if so.
    else {
      treeSelection.select(aViewIndex);
    }

    if (this._active)
      this.ensureRowIsVisible(aViewIndex);

    // The saved selection is invalidated, since we've got something newer
    this._savedSelection = null;

    // Do this here instead of at the beginning to prevent reentrancy issues
    this._aboutToSelectMessage = false;
  },

  /**
   * For every selected message in the display that is part of a (displayed)
   *  thread and is not the root message, de-select it and ensure that the
   *  root message of the thread is selected.
   * This is primarily intended to be used when collapsing visible threads.
   *
   * We do nothing if we are not in a threaded display mode.
   */
  selectSelectedThreadRoots:
      function FolderDisplayWidget_selectSelectedThreadRoots() {
    if (!this.view.showThreaded)
      return;

    // There are basically two implementation strategies available to us:
    // 1) For each selected view index with a level > 0, keep walking 'up'
    //    (numerically smaller) until we find a message with level 0.
    //    The inefficiency here is the potentially large number of JS calls
    //    into XPCOM space that will be required.
    // 2) Ask for the thread that each view index belongs to, use that to
    //    efficiently retrieve the thread root, then find the root using
    //    the message header.  The inefficiency here is that the view
    //    currently does a linear scan, albeit a relatively efficient one.
    // And the winner is... option 2, because the code is simpler because we
    //  can reuse selectMessages to do most of the work.
    let selectedIndices = this.selectedIndices;
    let newSelectedMessages = [];
    let dbView = this.view.dbView;
    for each (let [, index] in Iterator(selectedIndices)) {
      let thread = dbView.getThreadContainingIndex(index);
      // We use getChildHdrAt instead of getRootHdr because getRootHdr has
      //  a useless out-param and just calls getChildHdrAt anyways.
      newSelectedMessages.push(thread.getChildHdrAt(0));
    }
    this.selectMessages(newSelectedMessages);
  },

  //@}

  /**
   * @name Ensure Visibility
   */
  //@{

  /**
   * Number of padding messages before the 'focused' message when it is at the
   *  top of the thread pane.
   * @private
   */
  TOP_VIEW_PADDING: 1,
  /**
   * Number of padding messages after the 'focused' message when it is at the
   *  bottom of the thread pane and lip padding does not apply.
   * @private
   */
  BOTTOM_VIEW_PADDING: 1,

  /**
   * Ensure the given view index is visible, preferably with some padding.
   * By padding, we mean that the index will not be the first or last message
   *  displayed, but rather have messages on either side.
   * If we get near the end of the list of messages, we 'snap' to the last page
   *  of messages.  The intent is that we later implement a
   * We have the concept of a 'lip' when we are at the end of the message
   *  display.  If we are near the end of the display, we want to show an
   *  empty row (at the bottom) so the user knows they are at the end.  Also,
   *  if a message shows up that is new and things are sorted ascending, this
   *  turns out to be useful.
   */
  ensureRowIsVisible: function FolderDisplayWidget_ensureRowIsVisible(
      aViewIndex, aBounced) {
    // Dealing with the tree view layout is a nightmare, let's just always make
    //  sure we re-schedule ourselves.  The most particular rationale here is
    //  that the message pane may be toggling its state and it's much simpler
    //  and reliable if we ensure that all of FolderDisplayWidget's state
    //  change logic gets to run to completion before we run ourselves.
    if (!aBounced) {
      let dis = this;
      window.setTimeout(function() {
          dis.ensureRowIsVisible(aViewIndex, true);
        }, 0);
    }

    let treeBox = this.treeBox;
    if (!treeBox)
      return;

    // try and trigger a reflow...
    treeBox.height;

    let maxIndex = this.view.dbView.rowCount - 1;

    let first = treeBox.getFirstVisibleRow();
    // Assume the bottom row is half-visible and should generally be ignored.
    // (We could actually do the legwork to see if there is a partial one...)
    const halfVisible = 1;
    let last  = treeBox.getLastVisibleRow() - halfVisible;
    let span = treeBox.getPageLength() - halfVisible;

    let target;
    // If the index is near the end, try and latch on to the bottom.
    if (aViewIndex + span - this.TOP_VIEW_PADDING > maxIndex)
      target = maxIndex - span;
    // If the index is after the last visible guy (with padding), move down
    //  so that the target index is padded in 1 from the bottom.
    else if (aViewIndex >= last - this.BOTTOM_VIEW_PADDING)
      target = Math.min(maxIndex, aViewIndex + this.BOTTOM_VIEW_PADDING) -
                 span;
    // If the index is before the first visible guy (with padding), move up
    else if (aViewIndex <= first + this.TOP_VIEW_PADDING)  // move up
      target = Math.max(0, aViewIndex - this.TOP_VIEW_PADDING);
    else // it is already visible
      return;

    // this sets the first visible row
    treeBox.scrollToRow(target);
  },

  /**
   * Ensure that the given range of rows is visible maximally visible in the
   *  thread pane.  If the range is larger than the number of rows that can be
   *  displayed in the thread pane, we bias towards showing the min row (with
   *  padding).
   *
   * @param aMinRow The numerically smallest row index defining the start of
   *     the inclusive range.
   * @param aMaxRow The numberically largest row index defining the end of the
   *     inclusive range.
   */
  ensureRowRangeIsVisible:
      function FolderDisplayWidget_ensureRowRangeIsVisible(aMinRow, aMaxRow,
                                                           aBounced) {
    // Dealing with the tree view layout is a nightmare, let's just always make
    //  sure we re-schedule ourselves.  The most particular rationale here is
    //  that the message pane may be toggling its state and it's much simpler
    //  and reliable if we ensure that all of FolderDisplayWidget's state
    //  change logic gets to run to completion before we run ourselves.
    if (!aBounced) {
      let dis = this;
      window.setTimeout(function() {
          dis.ensureRowRangeIsVisible(aMinRow, aMaxRow, true);
        }, 0);
    }

    let treeBox = this.treeBox;
    if (!treeBox)
      return;
    let first = treeBox.getFirstVisibleRow();
    const halfVisible = 1;
    let last  = treeBox.getLastVisibleRow() - halfVisible;
    let span = treeBox.getPageLength() - halfVisible;

    // bail if the range is already visible with padding constraints handled
    if ((first + this.TOP_VIEW_PADDING <= aMinRow) &&
        (last - this.BOTTOM_VIEW_PADDING >= aMaxRow))
      return;

    let target;
    // if the range is bigger than we can fit, optimize position for the min row
    //  with padding to make it obvious the range doesn't extend above the row.
    if (aMaxRow - aMinRow > span)
      target = Math.max(0, aMinRow - this.TOP_VIEW_PADDING);
    // So the range must fit, and it's a question of how we want to position it.
    // For now, the answer is we try and center it, why not.
    else {
      let rowSpan = aMaxRow - aMinRow + 1;
      let halfSpare = parseInt((span - rowSpan - this.TOP_VIEW_PADDING -
                                this.BOTTOM_VIEW_PADDING) / 2);
      target = aMinRow - halfSpare - this.TOP_VIEW_PADDING;
    }
    treeBox.scrollToRow(target);
  },

  /**
   * Ensure that the selection is visible to the extent possible.
   */
  ensureSelectionIsVisible:
      function FolderDisplayWidget_ensureSelectionIsVisible() {
    let treeSelection = this.treeSelection; // potentially magic getter
    if (!treeSelection || !treeSelection.count)
      return;

    let minRow = null, maxRow = null;

    let rangeCount = treeSelection.getRangeCount();
    for (let iRange = 0; iRange < rangeCount; iRange++) {
      let rangeMinObj = {}, rangeMaxObj = {};
      treeSelection.getRangeAt(iRange, rangeMinObj, rangeMaxObj);
      let rangeMin = rangeMinObj.value, rangeMax = rangeMaxObj.value;
      if (minRow == null || rangeMin < minRow)
        minRow = rangeMin;
      if (maxRow == null || rangeMax > maxRow )
        maxRow = rangeMax;
    }

    this.ensureRowRangeIsVisible(minRow, maxRow);
  }
  //@}
};

/**
 * Implement a fake nsITreeBoxObject so that we can keep the view
 *  nsITreeSelection selections 'live' when they are in the background.  We need
 *  to do this because nsTreeSelection changes its behaviour (and gets ornery)
 *  if it does not have a box object.
 * This does not need to exist once we abandon multiplexed tabbing.
 *
 * Sometimes, nsTreeSelection tries to turn us into an nsIBoxObject and then in
 *  turn get the associated element, and then create DOM events on that. The
 *  only event that we care about is onselect, so we get a DOM node here (with
 *  an event listener for onselect already attached), and pass its boxObject in
 *  whenever nsTreeSelection QIs us to nsIBoxObject.
 */
function FakeTreeBoxObject(aDOMNode) {
  this.domNode = aDOMNode;
  this.view = null;
}
FakeTreeBoxObject.prototype = {
  view: null,
  ensureRowIsVisible: function FakeTreeBoxObject_ensureRowIsVisible() {
    // NOP
  },
  /**
   * No need to actually invalidate, as when we re-root the view this will
   *  happen.
   */
  invalidate: function FakeTreeBoxObject_invalidate() {
    // NOP
  },
  invalidateRange: function FakeTreeBoxObject_invalidateRange() {
    // NOP
  },
  invalidateRow: function FakeTreeBoxObject_invalidateRow() {
    // NOP
  },
  beginUpdateBatch: function FakeTreeBoxObject_beginUpdateBatch() {

  },
  endUpdateBatch: function FakeTreeBoxObject_endUpdateBatch() {

  },
  /**
   * We're going to make an exception to our NOP rule here, as this is rather
   * important for us to pass on. The db view calls this if a row's been
   * inserted or deleted. Without this, the selection's going to be out of sync
   * with the view.
   *
   * @param aIndex the index where the rows have been inserted or deleted
   * @param aCount the number of rows inserted or deleted (negative for
   *               deleted)
   */
  rowCountChanged: function FakeTreeBoxObject_rowCountChanged(aIndex, aCount) {
    if (aCount == 0 || !this.view)
      // Nothing to do
      return;

    let selection = this.view.selection;
    if (selection)
      selection.adjustSelection(aIndex, aCount);
  },
  get element() {return this.domNode;},
  get x() {return this.domNode.boxObject.x},
  get y() {return this.domNode.boxObject.y},
  get screenX() {return this.domNode.boxObject.screenX},
  get screenY() {return this.domNode.boxObject.screenY},
  get width() {return this.domNode.boxObject.width},
  get height()  {return this.domNode.boxObject.height},
  get parentBox() {return this.domNode.boxObject.parentBox},
  get firstChild() {return this.domNode.boxObject.firstChild},
  get lastChild() {return this.domNode.boxObject.lastChild},
  get nextSibling() {return this.domNode.boxObject.nextSibling},
  get previousSibling() {return this.domNode.boxObject.previousSibling},
  getPropertyAsSupports : function FakeTreeBoxObject_getPropertyAsSupports(propertyName) {
    return this.domNode.boxObject.getPropertyAsSupports(propertyName);
  },
  setPropertyAsSupports : function FakeTreeBoxObject_setPropertyAsSupports(propertyName, value) {
    this.domNode.boxObject.setPropertyAsSupports(propertyName, value);
  },
  getProperty : function FakeTreeBoxObject_getProperty(propertyName) {
    return this.domNode.boxObject.getProperty(propertyName);
  },
  setProperty : function FakeTreeBoxObject_setProperty(propertyName, value) {
    return this.domNode.boxObject.setProperty(propertyName, value);
  },
  removeProperty : function FakeTreeBoxObject_removeProperty(propertyName) {
    return this.domNode.boxObject.removeProperty(propertyName);
  },
  QueryInterface: function FakeTreeBoxObject_QueryInterface(aIID) {
    if (!aIID.equals(Components.interfaces.nsISupports) &&
        !aIID.equals(Components.interfaces.nsIBoxObject) &&
        !aIID.equals(Components.interfaces.nsITreeBoxObject))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};
/*
 * Provide attribute and function implementations that complain very loudly if
 *  they are used.  Now, XPConnect will return an error to callers if we don't
 *  implement part of the interface signature, but this is unlikely to provide
 *  the visibility we desire.  In fact, since it is a simple nsresult error,
 *  it may make things completely crazy.  So this way we can yell via dump,
 *  throw an exception, etc.
 */
function FTBO_stubOutAttributes(aObj, aAttribNames) {
  for (let [, attrName] in Iterator(aAttribNames)) {
    let myAttrName = attrName;
    aObj.__defineGetter__(attrName,
      function() {
        let msg = "Read access to stubbed attribute " + myAttrName;
        dump(msg + "\n");
        debugger;
        throw new Error(msg);
      });
    aObj.__defineSetter__(attrName,
      function() {
        let msg = "Write access to stubbed attribute " + myAttrName;
        dump(msg + "\n");
        debugger;
        throw new Error(msg);
      });
  }
}
function FTBO_stubOutMethods(aObj, aMethodNames) {
  for (let [, methodName] in Iterator(aMethodNames)) {
    let myMethodName = methodName;
    aObj[myMethodName] = function() {
      let msg = "Call to stubbed method " + myMethodName;
      dump(msg + "\n");
      debugger;
      throw new Error(msg);
    };
  }
}
FTBO_stubOutAttributes(FakeTreeBoxObject.prototype, [
  "columns",
  "focused",
  "treeBody",
  "rowHeight",
  "rowWidth",
  "horizontalPosition",
  "selectionRegion",
  ]);
FTBO_stubOutMethods(FakeTreeBoxObject.prototype, [
  "getFirstVisibleRow",
  "getLastVisibleRow",
  "getPageLength",
  "ensureCellIsVisible",
  "scrollToRow",
  "scrollByLines",
  "scrollByPages",
  "scrollToCell",
  "scrollToColumn",
  "scrollToHorizontalPosition",
  "invalidateColumn",
  "invalidateCell",
  "invalidateColumnRange",
  "getRowAt",
  "getCellAt",
  "getCoordsForCellItem",
  "isCellCropped",
  "clearStyleAndImageCaches",
  ]);
