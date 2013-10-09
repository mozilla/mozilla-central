/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/PluralForm.jsm");

var FeedSubscriptions = {
  get mTree() { return document.getElementById("rssSubscriptionsList"); },

  mFeedContainers: [],
  mRSSServer     : null,
  mActionMode    : null,
  kSubscribeMode : 1,
  kUpdateMode    : 2,
  kMoveMode      : 3,
  kCopyMode      : 4,
  kImportingOPML : 5,

  get FOLDER_ACTIONS()
  {
    return Ci.nsIMsgFolderNotificationService.folderAdded |
           Ci.nsIMsgFolderNotificationService.folderDeleted |
           Ci.nsIMsgFolderNotificationService.folderRenamed |
           Ci.nsIMsgFolderNotificationService.folderMoveCopyCompleted;
  },

  onLoad: function ()
  {
    // Extract the folder argument.
    let folder;
    if (window.arguments && window.arguments[0].folder)
      folder = window.arguments[0].folder;

    // Ensure dialog is fully loaded before selecting, to get visible row.
    setTimeout(function() {
      FeedSubscriptions.refreshSubscriptionView(folder)
    }, 100);
    let message = FeedUtils.strings.GetStringFromName("subscribe-loading");
    this.updateStatusItem("statusText", message);

    let win = Services.wm.getMostRecentWindow("mail:3pane");
    if (win)
    {
      win.FeedFolderNotificationService = MailServices.mfn;
      win.FeedFolderNotificationService.addListener(this.FolderListener,
                                                    this.FOLDER_ACTIONS);
    }
  },

  onClose: function ()
  {
    let dismissDialog = true;

    // If we are in the middle of subscribing to a feed, inform the user that
    // dismissing the dialog right now will abort the feed subscription.
    if (this.mActionMode == this.kSubscribeMode)
    {
      let pTitle = FeedUtils.strings.GetStringFromName(
                     "subscribe-cancelSubscriptionTitle");
      let pMessage = FeedUtils.strings.GetStringFromName(
                       "subscribe-cancelSubscription");
      dismissDialog =
        !(Services.prompt.confirmEx(window, pTitle, pMessage,
                                    Ci.nsIPromptService.STD_YES_NO_BUTTONS,
                                    null, null, null, null, { }));
    }

    if (dismissDialog)
    {
      FeedUtils.CANCEL_REQUESTED = true;
      let win = Services.wm.getMostRecentWindow("mail:3pane");
      if (win)
        {
          win.FeedFolderNotificationService.removeListener(this.FolderListener,
                                                           this.FOLDER_ACTIONS);
          delete win.FeedFolderNotificationService;
        }
    }

    return dismissDialog;
  },

  refreshSubscriptionView: function(aSelectFolder)
  {
    let item = this.mView.currentItem;
    this.loadSubscriptions();
    this.mTree.view = this.mView;

    document.getElementById("selectFolderPopup")._ensureInitialized();

    if (aSelectFolder)
      this.selectFolder(aSelectFolder);
    else
    {
      // If no folder to select, try to select the pre rebuild selection, in
      // an existing window.  For folderpane changes in a feed account.
      if (item)
      {
        let rootFolder = item.container ? item.folder.rootFolder :
                                          item.parentFolder.rootFolder;
        if (item.container)
        {
          if (!this.selectFolder(item.folder, { open: item.open }))
            // The item no longer exists, an ancestor folder was deleted or
            // renamed/moved.
            this.selectFolder(rootFolder);
        }
        else
          this.selectFeed({ folder: rootFolder, url: item.url }, null);
      }
    }

    this.mView.treeBox.ensureRowIsVisible(this.mView.selection.currentIndex);
    this.clearStatusInfo();
  },

  mView:
  {
    kRowIndexUndefined: -1,

    get currentItem() {
      // Get the current selection, if any.
      let seln = this.selection;
      let currentSelectionIndex = seln ? seln.currentIndex : null;
      let item;
      if (currentSelectionIndex != null)
        item = this.getItemAtIndex(currentSelectionIndex);

      return item;
    },

    /* nsITreeView */
    treeBox: null,

    mRowCount: 0,
    get rowCount()                         { return this.mRowCount; },

    _selection: null,
    get selection ()                       { return this._selection; },
    set selection (val)                    { return this._selection = val; },

    setTree: function(aTreebox)            { this.treeBox = aTreebox; },
    isSeparator: function(aRow)            { return false; },
    isSorted: function()                   { return false; },
    isSelectable: function(aRow, aColumn)  { return false; },
    isEditable: function (aRow, aColumn)   { return false; },

    getImageSrc: function(aRow, aCol)      { return null; },
    getProgressMode : function(aRow, aCol) {},
    cycleHeader: function(aCol)            {},
    cycleCell: function(aRow, aCol)        {},
    selectionChanged: function()           {},
    performAction: function(aAction)       {},
    performActionOnRow: function (aAction, aRow)       {},
    performActionOnCell: function(aAction, aRow, aCol) {},
    getRowProperties: function(aRow)                   { return ""; },
    getColumnProperties: function(aCol)                { return ""; },
    getCellValue: function (aRow, aColumn)             {},
    setCellValue: function (aRow, aColumn, aValue)     {},
    setCellText: function (aRow, aColumn, aValue)      {},

    getCellProperties: function (aRow, aColumn) {
      let item = this.getItemAtIndex(aRow);
      let folder = item && item.folder ? item.folder : null;
#ifdef MOZ_THUNDERBIRD
      let properties = ["folderNameCol"];
      let hasFeeds = folder ? FeedUtils.getFeedUrlsInFolder(folder) : false;
      let prop = !folder ? "isFeed-true" :
                 hasFeeds ? "isFeedFolder-true" :
                 folder.isServer ? "serverType-rss isServer-true" : null;
      if (prop)
        properties.push(prop);
      return properties.join(" ");
#else
      return !folder ? "serverType-rss" :
             folder.isServer ? "serverType-rss isServer-true" : "livemark";
#endif
    },

    isContainer: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);
      return item ? item.container : false;
    },

    isContainerOpen: function (aRow)
    { 
      let item = this.getItemAtIndex(aRow);
      return item ? item.open : false;
    },

    isContainerEmpty: function (aRow)
    { 
      let item = this.getItemAtIndex(aRow);
      if (!item) 
        return false;

      return item.children.length == 0;
    },

    getItemAtIndex: function (aRow)
    {
      if (aRow < 0 || aRow >= FeedSubscriptions.mFeedContainers.length)
        return null;

      return FeedSubscriptions.mFeedContainers[aRow];
    },

    getItemInViewIndex: function(aFolder)
    {
      if (!aFolder || !(aFolder instanceof Ci.nsIMsgFolder))
        return null;

      for (let index = 0; index < this.rowCount; index++)
      {
        // Find the visible folder in the view.
        let item = this.getItemAtIndex(index);
        if (item && item.container && item.url == aFolder.URI)
          return index;
      }

      return null;
    },

    removeItemAtIndex: function (aRow, aNoSelect)
    {
      let itemToRemove = this.getItemAtIndex(aRow);
      if (!itemToRemove)
        return;

      if (itemToRemove.container && itemToRemove.open)
        // Close it, if open container.
        this.toggleOpenState(aRow);

      let parentIndex = this.getParentIndex(aRow);
      let hasNextSibling = this.hasNextSibling(aRow, aRow);
      if (parentIndex != this.kRowIndexUndefined)
      {
        let parent = this.getItemAtIndex(parentIndex);
        if (parent)
        {
          for (let index = 0; index < parent.children.length; index++)
            if (parent.children[index] == itemToRemove)
            {
              parent.children.splice(index, 1);
              break;
            }
        }
      }

      // Now remove it from our view.
      FeedSubscriptions.mFeedContainers.splice(aRow, 1);

      // Now invalidate the correct tree rows.
      this.mRowCount--;
      this.treeBox.rowCountChanged(aRow, -1);

      // Now update the selection position, unless noSelect (selection is
      // done later or not at all).  If the item is the last child, select the
      // parent.  Otherwise select the next sibling.
      if (!aNoSelect) {
        if (aRow <= FeedSubscriptions.mFeedContainers.length)
          this.selection.select(hasNextSibling ? aRow : aRow - 1);
        else
          this.selection.clearSelection();
      }

      // Now refocus the tree.
      FeedSubscriptions.mTree.focus();
    },

    getCellText: function (aRow, aColumn)
    {
      let item = this.getItemAtIndex(aRow);
      return (item && aColumn.id == "folderNameCol") ? item.name : "";
    },

    canDrop: function (aRow, aOrientation)
    { 
      let dropResult = this.extractDragData(aRow);
      return aOrientation == Ci.nsITreeView.DROP_ON && dropResult.canDrop &&
             (dropResult.dropUrl || dropResult.dropOnIndex != this.kRowIndexUndefined);
    },

    drop: function (aRow, aOrientation)
    {
      let win = FeedSubscriptions;
      let results = this.extractDragData(aRow);
      if (!results.canDrop)
        return;

      // Preselect the drop folder.
      this.selection.select(aRow);

      if (results.dropUrl)
      {
        // Don't freeze the app that initiated the drop just because we are
        // in a loop waiting for the user to dimisss the add feed dialog.
        setTimeout(function() {
          win.addFeed(results.dropUrl, null, true, null, win.kSubscribeMode);
        }, 0);
        let folderItem = this.getItemAtIndex(aRow);
        FeedUtils.log.debug("drop: folder, url - " +
                            folderItem.folder.name + ", " + results.dropUrl);
      }
      else if (results.dropOnIndex != this.kRowIndexUndefined)
      {
        win.moveCopyFeed(results.dropOnIndex, aRow, results.dropEffect);
      }
    },

    // Helper function for drag and drop.
    extractDragData: function(aRow)
    {
      let dt = this._currentDataTransfer;
      let dragDataResults = { canDrop:     false,
                              dropUrl:     null,
                              dropOnIndex: this.kRowIndexUndefined,
                              dropEffect:  dt.dropEffect };

      if (dt.getData("text/x-moz-feed-index"))
      {
        // Dragging a feed in the tree.
        if (this.selection)
        {
          dragDataResults.dropOnIndex = this.selection.currentIndex;

          let curItem = this.getItemAtIndex(this.selection.currentIndex);
          let newItem = this.getItemAtIndex(aRow);
          let curServer = curItem && curItem.parentFolder ?
                            curItem.parentFolder.server : null;
          let newServer = newItem && newItem.folder ?
                            newItem.folder.server : null;

          // No copying within the same account and no moving to the account
          // folder in the same account.
          if (!(curServer == newServer &&
                (dragDataResults.dropEffect == "copy" ||
                 newItem.folder == curItem.parentFolder ||
                 newItem.folder.isServer)))
            dragDataResults.canDrop = true;
        }
      }
      else
      {
        // Try to get a feed url.
        let validUri = FeedUtils.getFeedUriFromDataTransfer(dt);

        if (validUri)
        {
          dragDataResults.canDrop = true;
          dragDataResults.dropUrl = validUri.spec;
        }
      }

      return dragDataResults;
    },

    getParentIndex: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);

      if (item)
      {
        for (let index = aRow; index >= 0; index--)
          if (FeedSubscriptions.mFeedContainers[index].level < item.level)
            return index;
      }

      return this.kRowIndexUndefined;
    },

    isIndexChildOfParentIndex: function (aRow, aChildRow)
    {
      // For visible tree rows, not if items are children of closed folders.
      let item = this.getItemAtIndex(aRow);
      if (!item || aChildRow <= aRow)
        return false;

      let targetLevel = this.getItemAtIndex(aRow).level;
      let rows = FeedSubscriptions.mFeedContainers;

      for (let i = aRow + 1; i < rows.length; i++) {
        if (this.getItemAtIndex(i).level <= targetLevel)
          break;
        if (aChildRow == i)
          return true;
      }

      return false;
    },

    hasNextSibling: function(aRow, aAfterIndex) {
      let targetLevel = this.getItemAtIndex(aRow).level;
      let rows = FeedSubscriptions.mFeedContainers;
      for (let i = aAfterIndex + 1; i < rows.length; i++) {
        if (this.getItemAtIndex(i).level == targetLevel)
          return true;
        if (this.getItemAtIndex(i).level < targetLevel)
          return false;
      }

      return false;
    },

    hasPreviousSibling: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);
      if (item && aRow)
        return this.getItemAtIndex(aRow - 1).level == item.level;
      else
        return false;
    },

    getLevel: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);
      if (!item)
        return 0;

      return item.level;
    },

    toggleOpenState: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);
      if (!item)
        return;

      // Save off the current selection item.
      let seln = this.selection;
      let currentSelectionIndex = seln.currentIndex;

      let rowsChanged = this.toggle(aRow)

      // Now restore selection, ensuring selection is maintained on toggles.
      if (currentSelectionIndex > aRow)
        seln.currentIndex = currentSelectionIndex + rowsChanged;
      else
        seln.select(currentSelectionIndex);

      seln.selectEventsSuppressed = false;
    },

    toggle: function (aRow)
    {
      // Collapse the row, or build sub rows based on open states in the map.
      let item = this.getItemAtIndex(aRow);
      if (!item)
        return null;

      let rows = FeedSubscriptions.mFeedContainers;
      let rowCount = 0;
      let multiplier;

      function addDescendants(aItem)
      {
        for (let i = 0; i < aItem.children.length; i++)
        {
          rowCount++;
          let child = aItem.children[i];
          rows.splice(aRow + rowCount, 0, child);
          if (child.open)
            addDescendants(child);
        }
      }

      if (item.open)
      {
        // Close the container.  Add up all subfolders and their descendants
        // who may be open.
        multiplier = -1;
        let nextRow = aRow + 1;
        let nextItem = rows[nextRow];
        while (nextItem && nextItem.level > item.level)
        {
          rowCount++;
          nextItem = rows[++nextRow];
        }

        rows.splice(aRow + 1, rowCount);
      }
      else
      {
        // Open the container.  Restore the open state of all subfolder and
        // their descendants.
        multiplier = 1;
        addDescendants(item);
      }

      let delta = multiplier * rowCount;
      this.mRowCount += delta;

      item.open = !item.open;
      // Suppress the select event caused by rowCountChanged.
      this.selection.selectEventsSuppressed = true;
      // Add or remove the children from our view.
      this.treeBox.rowCountChanged(aRow, delta);
      return delta;
    }
  },

  makeFolderObject: function (aFolder, aCurrentLevel)
  {
    let defaultQuickMode = aFolder.server.getBoolValue("quickMode");
    let open = !aFolder.isServer &&
               aFolder.server == this.mRSSServer &&
               this.mActionMode == this.kImportingOPML ? true : false
    let folderObject =  { children : [],
                          folder   : aFolder,
                          name     : aFolder.prettyName,
                          level    : aCurrentLevel,
                          url      : aFolder.URI,
                          quickMode: defaultQuickMode,
                          open     : open,
                          container: true };

    // If a feed has any sub folders, add them to the list of children.
    let folderEnumerator = aFolder.subFolders;

    while (folderEnumerator.hasMoreElements())
    {
      let folder = folderEnumerator.getNext();
      if ((folder instanceof Ci.nsIMsgFolder) &&
          !folder.getFlag(Ci.nsMsgFolderFlags.Trash) &&
          !folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
      {
        folderObject.children
                    .push(this.makeFolderObject(folder, aCurrentLevel + 1));
      }
    }

    let feeds = this.getFeedsInFolder(aFolder);
    for (let feed in feeds)
    {
      // Now add any feed urls for the folder.
      folderObject.children.push(this.makeFeedObject(feeds[feed],
                                                     aFolder,
                                                     aCurrentLevel + 1));
    }

    // Finally, set the folder's quickMode based on the its first feed's
    // quickMode, since that is how the view determines summary mode, and now
    // quickMode is updated to be the same for all feeds in a folder.
    if (feeds && feeds[0])
      folderObject.quickMode = feeds[0].quickMode;

    folderObject.children = this.folderItemSorter(folderObject.children);

    return folderObject;
  },

  folderItemSorter: function (aArray)
  {
    return aArray.sort(function(a, b) { return a.name.toLowerCase() >
                                               b.name.toLowerCase() }).
                  sort(function(a, b) { return a.container < b.container });
  },

  getFeedsInFolder: function (aFolder)
  {
    let feeds = new Array();
    let feedUrlArray = FeedUtils.getFeedUrlsInFolder(aFolder);
    if (!feedUrlArray)
      // No feedUrls in this folder.
      return feeds;

    for (let url in feedUrlArray)
    {
      if (!feedUrlArray[url])
        continue;
      let feedResource = FeedUtils.rdf.GetResource(feedUrlArray[url]);
      let feed = new Feed(feedResource, aFolder.server);
      feeds.push(feed);
    }

    return feeds;
  },

  makeFeedObject: function (aFeed, aFolder, aLevel)
  {
    // Look inside the data source for the feed properties.
    let feed = { children    : [],
                 parentFolder: aFolder,
                 name        : aFeed.title || aFeed.description || aFeed.url,
                 url         : aFeed.url,
                 quickMode   : aFeed.quickMode,
                 level       : aLevel,
                 open        : false,
                 container   : false };
    return feed;
  },

  loadSubscriptions: function ()
  {
    // Put together an array of folders.  Each feed account level folder is
    // included as the root.
    let numFolders = 0;
    let feedContainers = [];
    // Get all the feed account folders.
    let feedRootFolders = FeedUtils.getAllRssServerRootFolders();

    feedRootFolders.forEach(function(rootFolder) {
      feedContainers.push(this.makeFolderObject(rootFolder, 0));
      numFolders++;
    }, this);

    this.mFeedContainers = feedContainers;
    this.mView.mRowCount = numFolders;

    FeedSubscriptions.mTree.focus();
  },

  /**
   * Find the folder in the tree.  The search may be limited to subfolders of
   * a known folder, or expanded to include the entire tree. This function is
   * also used to insert/remove folders without rebuilding the tree view cache
   * (to avoid position/toggle state loss).
   * 
   * @param  aFolder nsIMsgFolder - the folder to find.
   * @param  [aParams] object     - params object, containing:
   * 
   * [parentIndex] int        - index of folder to start the search; if
   *                            null (default), the index of the folder's
   *                            rootFolder will be used.
   * [select] boolean         - if true (default) the folder's ancestors
   *                            will be opened and the folder selected.
   * [open] boolean           - if true (default) the folder is opened.
   * [remove] boolean         - delete the item from tree row cache if true,
   *                            false (default) otherwise.
   * [newFolder] nsIMsgFolder - if not null (default) the new folder,
   *                            for add or rename.
   * 
   * @return bool found - true if found, false if not.
   */
  selectFolder: function(aFolder, aParms)
  {
    let folderURI = aFolder.URI;
    let parentIndex = aParms && ("parentIndex" in aParms) ? aParms.parentIndex : null;
    let selectIt = aParms && ("select" in aParms) ? aParms.select : true;
    let openIt = aParms && ("open" in aParms) ? aParms.open : true;
    let removeIt = aParms && ("remove" in aParms) ? aParms.remove : false;
    let newFolder = aParms && ("newFolder" in aParms) ? aParms.newFolder : null;
    let startIndex, startItem;
    let found = false;

    let firstVisRow, curFirstVisRow, curLastVisRow;
    if (this.mView.treeBox)
      firstVisRow = this.mView.treeBox.getFirstVisibleRow();

    if (parentIndex != null)
    {
      // Use the parentIndex if given.
      startIndex = parentIndex;
      if (aFolder.isServer)
        // Fake item for account root folder.
        startItem = { name: "AccountRoot",
                      children: [this.mView.getItemAtIndex(startIndex)],
                      container: true, open: false, url: null, level: -1};
      else
        startItem = this.mView.getItemAtIndex(startIndex);
    }
    else
    {
      // Get the folder's root parent index.
      let index = 0;
      for (index; index < this.mView.rowCount; index++)
      {
        let item = this.mView.getItemAtIndex(index);
        if (item.url == aFolder.server.rootFolder.URI)
          break;
      }
      startIndex = index;
      if (aFolder.isServer)
        // Fake item for account root folder.
        startItem = { name: "AccountRoot",
                      children: [this.mView.getItemAtIndex(startIndex)],
                      container: true, open: false, url: null, level: -1};
      else
        startItem = this.mView.getItemAtIndex(startIndex);
    }

    function containsFolder(aItem)
    {
      // Search for the folder.  If it's found, set the open state on all
      // ancestor folders.  A toggle() rebuilds the view rows to match the map.
      if (aItem.url == folderURI)
        return found = true;

      for (let i = 0; i < aItem.children.length; i++) {
        if (aItem.children[i].container && containsFolder(aItem.children[i]))
        {
          if (removeIt && aItem.children[i].url == folderURI)
          {
            // Get all occurences in the tree cache arrays.
            FeedUtils.log.debug("selectFolder: delete in cache, " +
                                "parent:children:item:index - "+
                                aItem.name + ":" + aItem.children.length + ":" +
                                aItem.children[i].name + ":" + i);
            aItem.children.splice(i, 1);
            FeedUtils.log.debug("selectFolder: deleted in cache, " +
                                "parent:children - " +
                                aItem.name + ":" + aItem.children.length);
            removeIt = false;
            return true;
          }
          if (newFolder)
          {
            let newItem = FeedSubscriptions.makeFolderObject(newFolder,
                                                             aItem.level + 1);
            newItem.open = aItem.children[i].open;
            if (newFolder.isServer)
              FeedSubscriptions.mFeedContainers[startIndex] = newItem;
            else
            {
              aItem.children[i] = newItem;
              aItem.children = FeedSubscriptions.folderItemSorter(aItem.children);
            }
            FeedUtils.log.debug("selectFolder: parentName:newFolderName:newFolderItem - " +
                                aItem.name + ":" + newItem.name + ":" + newItem.toSource());
            newFolder = null;
            return true;
          }
          if (!found)
          {
            // For the folder to find.
            found = true;
            aItem.children[i].open = openIt;
          }
          else
          {
            // For ancestor folders.
            if (selectIt || openIt)
              aItem.children[i].open = true;
          }

          return true;
        }
      }

      return false;
    }

    if (startItem)
    {
      // Find a folder with a specific parent.
      containsFolder(startItem);
      if (!found)
        return false;

      if (!selectIt)
        return true;

      if (startItem.open)
        this.mView.toggle(startIndex);
      this.mView.toggleOpenState(startIndex);
    }

    for (let index = 0; index < this.mView.rowCount && selectIt; index++)
    {
      // The desired folder is now in the view.
      let item = this.mView.getItemAtIndex(index);
      if (!item.container)
        continue;
      if (item.url == folderURI)
      {
        if (item.children.length &&
            ((!item.open && openIt) || (item.open && !openIt)))
          this.mView.toggleOpenState(index);
        this.mView.selection.select(index);
        found = true;
        break;
      }
    }

    // Ensure tree position does not jump unnecessarily.
    curFirstVisRow = this.mView.treeBox.getFirstVisibleRow();
    curLastVisRow = this.mView.treeBox.getLastVisibleRow();
    if (firstVisRow >= 0 &&
        this.mView.rowCount - curLastVisRow > firstVisRow - curFirstVisRow)
      this.mView.treeBox.scrollToRow(firstVisRow);
    else
      this.mView.treeBox.ensureRowIsVisible(this.mView.rowCount - 1);

    FeedUtils.log.debug("selectFolder: curIndex:firstVisRow:" +
                        "curFirstVisRow:curLastVisRow:rowCount - " +
                        this.mView.selection.currentIndex + ":" +
                        firstVisRow + ":" +
                        curFirstVisRow + ":" + curLastVisRow + ":" + this.mView.rowCount);

    return found;
  },

  /**
   * Find the feed in the tree.  The search first gets the feed's folder,
   * then selects the child feed.
   * 
   * @param  aFeed {Feed object}    - the feed to find.
   * @param  [aParentIndex] integer - index to start the folder search.
   * 
   * @return found bool - true if found, false if not.
   */
  selectFeed: function(aFeed, aParentIndex)
  {
    let folder = aFeed.folder;
    let found = false;

    if (aFeed.folder.isServer) {
      // If passed the root folder, the caller wants to get the feed's folder
      // from the db (for cases of an ancestor folder rename/move).
      let itemResource = FeedUtils.rdf.GetResource(aFeed.url);
      let ds = FeedUtils.getSubscriptionsDS(aFeed.folder.server);
      folder = ds.GetTarget(itemResource, FeedUtils.FZ_DESTFOLDER, true);
    }

    if (this.selectFolder(folder, { parentIndex: aParentIndex }))
    {
      let seln = this.mView.selection;
      let item = this.mView.currentItem;
      if (item) {
        for (let i = seln.currentIndex + 1; i < this.mView.rowCount; i++) {
          if (this.mView.getItemAtIndex(i).url == aFeed.url) {
            this.mView.selection.select(i);
            this.mView.treeBox.ensureRowIsVisible(i);
            found = true;
            break;
          }
        }
      }
    }

    return found;
  },

  updateFeedData: function (aItem)
  {
    if (!aItem)
      return;

    let nameValue = document.getElementById("nameValue");
    let locationValue = document.getElementById("locationValue");
    let locationValidate = document.getElementById("locationValidate");
    let selectFolder = document.getElementById("selectFolder");
    let selectFolderValue = document.getElementById("selectFolderValue");
    let server, rootFolder, displayFolder;

    if (!aItem.container)
    {
      // A feed item.  Set the feed location and title info.
      nameValue.value = aItem.name;
      locationValue.value = aItem.url;
      locationValidate.removeAttribute("collapsed");

      // Root the location picker to the news & blogs server.
      server = aItem.parentFolder.server;
      rootFolder = aItem.parentFolder.rootFolder;
      displayFolder = aItem.parentFolder;
    }
    else
    {
      // A folder/container item.
      nameValue.value = "";
      nameValue.disabled = true;
      locationValue.value = "";
      locationValidate.setAttribute("collapsed", true);

      server = aItem.folder.server;
      rootFolder = aItem.folder.rootFolder;
      displayFolder = aItem.folder;
    }

    // Common to both folder and feed items.
    nameValue.disabled = aItem.container;
    selectFolder.setAttribute("hidden", aItem.container);
    selectFolderValue.setAttribute("hidden", !aItem.container);
    selectFolderValue.setAttribute("showfilepath", false);
    this.setFolderPicker(displayFolder);

    // Set quick mode value.
    document.getElementById("quickMode").checked = aItem.quickMode;
  },

  setFolderPicker: function(aFolder)
  {
    let editFeed = document.getElementById("editFeed");
    let folderPrettyPath = FeedUtils.getFolderPrettyPath(aFolder);
    if (!folderPrettyPath)
      return editFeed.disabled = true;

    let selectFolder = document.getElementById("selectFolder");
    let selectFolderValue = document.getElementById("selectFolderValue");

    try {
      document.getElementById("selectFolderPopup").selectFolder(aFolder);
    }
    catch (ex) {}

    selectFolder._folder = aFolder;
    selectFolder.setAttribute("label", folderPrettyPath);
    selectFolder.setAttribute("uri", aFolder.URI);
    selectFolderValue.value = folderPrettyPath;
    selectFolderValue.setAttribute("prettypath", folderPrettyPath);
    selectFolderValue.setAttribute("filepath", aFolder.filePath.path);

    return editFeed.disabled = false;
  },

  onClickSelectFolderValue: function(aEvent)
  {
    let target = aEvent.target;
    if ((("button" in aEvent) &&
         (aEvent.button != 0 ||
          aEvent.originalTarget.localName != "div" ||
          target.selectionStart != target.selectionEnd)) ||
        (aEvent.keyCode && aEvent.keyCode != aEvent.DOM_VK_RETURN))
      return;

    // Toggle between showing prettyPath and absolute filePath.
    if (target.getAttribute("showfilepath") == "true")
    {
      target.setAttribute("showfilepath", false);
      target.value = target.getAttribute("prettypath");
    }
    else
    {
      target.setAttribute("showfilepath", true);
      target.value = target.getAttribute("filepath");
    }
  },

  setSummary: function(aChecked)
  {
    let item = this.mView.currentItem;
    if (!item || !item.folder)
      // Not a folder.
      return;

    if (item.folder.isServer)
    {
      if (document.getElementById("locationValue").value)
        // Intent is to add a feed/folder to the account, so return.
        return;

      // An account folder.  If it changes, all non feed containing subfolders
      // need to be updated with the new default.
      item.folder.server.setBoolValue("quickMode", aChecked);
      this.FolderListener.folderAdded(item.folder);
    }
    else if (!FeedUtils.getFeedUrlsInFolder(item.folder))
      // Not a folder with feeds.
      return;
    else
    {
      let feedsInFolder = this.getFeedsInFolder(item.folder);
      // Update the feeds database, for each feed in the folder.
      feedsInFolder.forEach(function(feed) { feed.quickMode = aChecked; });
      // Update the folder's feeds properties in the tree map.
      item.children.forEach(function(feed) { feed.quickMode = aChecked; });
    }

    // Update the folder in the tree map.
    item.quickMode = aChecked;
    let message = FeedUtils.strings.GetStringFromName("subscribe-feedUpdated");
    this.updateStatusItem("statusText", message);
  },

  onKeyPress: function(aEvent)
  {
    if (aEvent.keyCode == aEvent.DOM_VK_DELETE &&
        aEvent.target.id == "rssSubscriptionsList")
      this.removeFeed(true);

    this.clearStatusInfo();
  },

  onSelect: function ()
  {
    let item = this.mView.currentItem;
    this.updateFeedData(item);
    this.setSummaryFocus();
    this.updateButtons(item);
  },

  updateButtons: function (aSelectedItem)
  {
    let item = aSelectedItem;
    let isServer = item && item.folder && item.folder.isServer;
    let disable = !item || !item.container ||
                  this.mActionMode == this.kImportingOPML;
    document.getElementById("addFeed").disabled = disable;
    disable = !item || item.container ||
              this.mActionMode == this.kImportingOPML;
    document.getElementById("editFeed").disabled = disable;
    document.getElementById("removeFeed").disabled = disable;
    disable = !item || !isServer ||
              this.mActionMode == this.kImportingOPML;
    document.getElementById("importOPML").disabled = disable;
    document.getElementById("exportOPML").disabled = disable;
  },

  onMouseDown: function (aEvent)
  {
    if (aEvent.button != 0 || aEvent.target.id == "validationText")
      return;

    this.clearStatusInfo();
  },

  setSummaryFocus: function ()
  {
    let item = this.mView.currentItem;
    let locationValue = document.getElementById("locationValue");
    let quickMode = document.getElementById("quickMode");

    if (item && item.folder &&
        (locationValue.hasAttribute("focused") || locationValue.value ||
         item.folder.isServer || FeedUtils.getFeedUrlsInFolder(item.folder)))
    {
      // Enable summary for account folder or folder with feeds or focus/value
      // in the feed url field of empty folders prior to add.
      quickMode.disabled = false;
    }
    else
    {
      quickMode.disabled = true;
    }
  },

  removeFeed: function (aPrompt)
  {
    let seln = this.mView.selection;
    if (seln.count != 1)
      return;

    let itemToRemove = this.mView.getItemAtIndex(seln.currentIndex);

    if (!itemToRemove || itemToRemove.container)
      return;

    if (aPrompt)
    {
      // Confirm unsubscribe prompt.
      let pTitle = FeedUtils.strings.GetStringFromName(
                     "subscribe-confirmFeedDeletionTitle");
      let pMessage = FeedUtils.strings.formatStringFromName(
                       "subscribe-confirmFeedDeletion", [itemToRemove.name], 1);
      if (Services.prompt.confirmEx(window, pTitle, pMessage,
                                    Ci.nsIPromptService.STD_YES_NO_BUTTONS,
                                    null, null, null, null, { }))
        return;
    }

    FeedUtils.deleteFeed(FeedUtils.rdf.GetResource(itemToRemove.url),
                         itemToRemove.parentFolder.server,
                         itemToRemove.parentFolder);

    // Now that we have removed the feed from the datasource, it is time to
    // update our view layer.  Update parent folder's quickMode if necessary
    // and remove the child from its parent folder object.
    let parentIndex = this.mView.getParentIndex(seln.currentIndex);
    let parentItem = this.mView.getItemAtIndex(parentIndex);
    this.updateFolderQuickModeInView(itemToRemove, parentItem, true);
    this.mView.removeItemAtIndex(seln.currentIndex, false);
    let message = FeedUtils.strings.GetStringFromName("subscribe-feedRemoved");
    this.updateStatusItem("statusText", message);
  },


  /**
   * This addFeed is used by 1) Add button, 1) Update button, 3) Drop of a
   * feed url on a folder (which can be an add or move).  If Update, the new
   * url is added and the old removed; thus aParse is false and no new messages
   * are downloaded, the feed is only validated and stored in the db.  If dnd,
   * the drop folder is selected and the url is prefilled, so proceed just as
   * though the url were entered manually.  This allows a user to see the dnd
   * url better in case of errors.
   * 
   * @param  [aFeedLocation] string    - the feed url; get the url from the
   *                                     input field if null.
   * @param  [aFolder] nsIMsgFolder    - folder to subscribe, current selected
   *                                     folder if null.
   * @param  [aParse] boolean          - if true (default) parse and download
   *                                     the feed's articles.
   * @param  [aParams] object          - additional params.
   * @param  [aMode] integer           - action mode (default is kSubscribeMode)
   *                                     of the add.
   * 
   * @return success boolean           - true if edit checks passed and an
   *                                     async download has been initiated.
   */
  addFeed: function(aFeedLocation, aFolder, aParse, aParams, aMode)
  {
    let message;
    let parse = aParse == null ? true : aParse;
    let mode = aMode == null ? this.kSubscribeMode : aMode;
    let locationValue = document.getElementById("locationValue");
    let quickMode = aParams && ("quickMode" in aParams) ?
        aParams.quickMode : document.getElementById("quickMode").checked;

    if (aFeedLocation)
      locationValue.value = aFeedLocation;
    let feedLocation = locationValue.value.trim();

    if (!feedLocation)
    {
      message = locationValue.getAttribute("placeholder");
      this.updateStatusItem("statusText", message);
      return false;
    }

    let addFolder;
    if (aFolder)
    {
      // For Update or if passed a folder.
      if (aFolder instanceof Ci.nsIMsgFolder)
        addFolder = aFolder;
    }
    else
    {
      // A folder must be selected for Add and Drop.
      let index = this.mView.selection.currentIndex;
      let item = this.mView.getItemAtIndex(index);
      if (item && item.container)
        addFolder = item.folder;
    }

    // Shouldn't happen.  Or else not passed an nsIMsgFolder.
    if (!addFolder)
      return false;

    // Before we go any further, make sure the user is not already subscribed
    // to this feed.
    if (FeedUtils.feedAlreadyExists(feedLocation, addFolder.server))
    {
      message = FeedUtils.strings.GetStringFromName(
                  "subscribe-feedAlreadySubscribed");
      this.updateStatusItem("statusText", message);
      return false;
    }

    let name = document.getElementById("nameValue").value;
    let folderURI = addFolder.isServer ? null : addFolder.URI;
    let feedProperties = { feedName     : name,
                           feedLocation : feedLocation,
                           folderURI    : folderURI,
                           server       : addFolder.server,
                           quickMode    : quickMode };

    let feed = this.storeFeed(feedProperties);
    if (!feed)
      return false;

    // Now validate and start downloading the feed.
    message = FeedUtils.strings.GetStringFromName("subscribe-validating-feed");
    this.updateStatusItem("statusText", message);
    this.updateStatusItem("progressMeter", 0);
    document.getElementById("addFeed").setAttribute("disabled", true);
    this.mActionMode = mode;
    feed.download(parse, this.mFeedDownloadCallback);
    return true;
  },

  // Helper routine used by addFeed and importOPMLFile.
  storeFeed: function(feedProperties)
  {
    let itemResource = FeedUtils.rdf.GetResource(feedProperties.feedLocation);
    let feed = new Feed(itemResource, feedProperties.server);

    // If the user specified a folder to add the feed to, then set it here.
    if (feedProperties.folderURI)
    {
      let folderResource = FeedUtils.rdf.GetResource(feedProperties.folderURI);
      if (folderResource)
      {
        let folder = folderResource.QueryInterface(Ci.nsIMsgFolder);
        if (folder && !folder.isServer)
          feed.folder = folder;
      }
    }

    feed.title = feedProperties.feedName;
    feed.quickMode = feedProperties.quickMode;
    return feed;
  },

  editFeed: function()
  {
    let seln = this.mView.selection;
    if (seln.count != 1)
      return;

    let itemToEdit = this.mView.getItemAtIndex(seln.currentIndex);
    if (!itemToEdit || itemToEdit.container || !itemToEdit.parentFolder)
      return;

    let resource = FeedUtils.rdf.GetResource(itemToEdit.url);
    let currentFolderServer = itemToEdit.parentFolder.server;
    let ds = FeedUtils.getSubscriptionsDS(currentFolderServer);
    let currentFolder = ds.GetTarget(resource, FeedUtils.FZ_DESTFOLDER, true);
    let currentFolderURI = currentFolder.QueryInterface(Ci.nsIRDFResource).Value;
    let feed = new Feed(resource, currentFolderServer);
    feed.folder = itemToEdit.parentFolder;

    let editNameValue = document.getElementById("nameValue").value;
    let editFeedLocation = document.getElementById("locationValue").value.trim();
    let selectFolder = document.getElementById("selectFolder");
    let editQuickMode = document.getElementById("quickMode").checked;

    if (feed.url != editFeedLocation)
    {
      // Updating a url.  We need to add the new url and delete the old, to
      // ensure everything is cleaned up correctly.
      this.addFeed(null, itemToEdit.parentFolder, false, null, this.kUpdateMode)
      return;
    }

    let updated = false;
    // Check to see if the title value changed.
    if (feed.title != editNameValue)
    {
      feed.title = editNameValue;
      itemToEdit.name = editNameValue;
      seln.tree.invalidateRow(seln.currentIndex);
      updated = true;
    }

    // Check to see if the quickMode value changed.
    if (feed.quickMode != editQuickMode)
    {
      feed.quickMode = editQuickMode;
      itemToEdit.quickMode = editQuickMode;
      updated = true;
    }

    // Did the user change the folder URI for storing the feed?
    let editFolderURI = selectFolder.getAttribute("uri");
    if (currentFolderURI != editFolderURI)
    {
      // Make sure the new folderpicked folder is visible.
      this.selectFolder(selectFolder._folder);
      // Now go back to the feed item.
      this.selectFeed(feed, null);
      // We need to find the index of the new parent folder.
      let newParentIndex = this.mView.kRowIndexUndefined;
      for (let index = 0; index < this.mView.rowCount; index++)
      {
        let item = this.mView.getItemAtIndex(index);
        if (item && item.container && item.url == editFolderURI)
        {
          newParentIndex = index;
          break;
        }
      }

      if (newParentIndex != this.mView.kRowIndexUndefined)
        this.moveCopyFeed(seln.currentIndex, newParentIndex, "move");
    }

    if (!updated)
      return;

    ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();

    let message = FeedUtils.strings.GetStringFromName("subscribe-feedUpdated");
    this.updateStatusItem("statusText", message);
  },

/**
 * Moves or copies a feed to another folder or account.
 * 
 * @param  int aOldFeedIndex    - index in tree of target feed item.
 * @param  int aNewParentIndex  - index in tree of target parent folder item.
 * @param  string aMoveCopy     - either "move" or "copy".
 */
  moveCopyFeed: function(aOldFeedIndex, aNewParentIndex, aMoveCopy)
  {
    let moveFeed = aMoveCopy == "move";
    let currentItem = this.mView.getItemAtIndex(aOldFeedIndex);
    if (!currentItem ||
        this.mView.getParentIndex(aOldFeedIndex) == aNewParentIndex)
      // If the new parent is the same as the current parent, then do nothing.
      return;

    let currentParentIndex = this.mView.getParentIndex(aOldFeedIndex);
    let currentParentItem = this.mView.getItemAtIndex(currentParentIndex);
    let currentParentResource = FeedUtils.rdf.GetResource(currentParentItem.url);
    let currentFolder = currentParentResource.QueryInterface(Ci.nsIMsgFolder);

    let newParentItem = this.mView.getItemAtIndex(aNewParentIndex);
    let newParentResource = FeedUtils.rdf.GetResource(newParentItem.url);
    let newFolder = newParentResource.QueryInterface(Ci.nsIMsgFolder);

    let ds = FeedUtils.getSubscriptionsDS(currentItem.parentFolder.server);
    let resource = FeedUtils.rdf.GetResource(currentItem.url);

    let accountMoveCopy = false;
    if (currentFolder.rootFolder.URI == newFolder.rootFolder.URI)
    {
      // Moving within the same account/feeds db.
      if (newFolder.isServer || !moveFeed)
        // No moving to account folder if already in the account; can only move,
        // not copy, to folder in the same account.
        return;

      // Unassert the older URI, add an assertion for the new parent URI.
      ds.Change(resource, FeedUtils.FZ_DESTFOLDER,
                currentParentResource, newParentResource);
      ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
      // Update the feed url attributes on the databases for each folder:
      // Remove our feed url property from the current folder.
      FeedUtils.updateFolderFeedUrl(currentFolder, currentItem.url, true);
      // Add our feed url property to the new folder.
      FeedUtils.updateFolderFeedUrl(newFolder, currentItem.url, false);
    }
    else
    {
      // Moving/copying to a new account.  If dropping on the account folder,
      // a new subfolder is created if necessary.
      accountMoveCopy = true;
      let mode = moveFeed ? this.kMoveMode : this.kCopyMode;
      let params = {quickMode: currentItem.quickMode};
      // Subscribe to the new folder first.  If it already exists in the
      // account or on error, return.
      if (!this.addFeed(currentItem.url, newFolder, false, params, mode))
        return;
      // Unsubscribe the feed from the old folder, if add to the new folder
      // is successfull, and doing a move.
      if (moveFeed)
        FeedUtils.deleteFeed(FeedUtils.rdf.GetResource(currentItem.url),
                             currentItem.parentFolder.server,
                             currentItem.parentFolder);
    }

    // Finally, update our view layer.  Update old parent folder's quickMode
    // and remove the old row, if move.  Otherwise no change to the view.
    if (moveFeed)
    {
      this.updateFolderQuickModeInView(currentItem, currentParentItem, true);
      this.mView.removeItemAtIndex(aOldFeedIndex, true);
      if (aNewParentIndex > aOldFeedIndex)
        aNewParentIndex--;
    }

    if (accountMoveCopy)
    {
      // If a cross account move/copy, download callback will update the view
      // with the new location.  Preselect folder/mode for callback.
      this.selectFolder(newFolder, { parentIndex: aNewParentIndex });
      return;
    }

    // Add the new row location to the view.
    currentItem.level = newParentItem.level + 1;
    currentItem.parentFolder = newFolder;
    this.updateFolderQuickModeInView(currentItem, newParentItem, false);
    newParentItem.children.push(currentItem);

    if (newParentItem.open)
      // Close the container, selecting the feed will rebuild the view rows.
      this.mView.toggle(aNewParentIndex);

    this.selectFeed({folder: newParentItem.folder, url: currentItem.url},
                    aNewParentIndex);

    let message = FeedUtils.strings.GetStringFromName("subscribe-feedMoved");
    this.updateStatusItem("statusText", message);
  },

  updateFolderQuickModeInView: function (aFeedItem, aParentItem, aRemove)
  {
    let feedItem = aFeedItem;
    let parentItem = aParentItem;
    let feedUrlArray = FeedUtils.getFeedUrlsInFolder(feedItem.parentFolder);
    let feedsInFolder = feedUrlArray ? feedUrlArray.length : 0;

    if (aRemove && feedsInFolder < 1)
      // Removed only feed in folder; set quickMode to server default.
      parentItem.quickMode = parentItem.folder.server.getBoolValue("quickMode");

    if (!aRemove)
    {
      // Just added a feed to a folder.  If there are already feeds in the
      // folder, the feed must reflect the parent's quickMode.  If it is the
      // only feed, update the parent folder to the feed's quickMode.
      if (feedsInFolder > 1)
      {
        let feedResource = FeedUtils.rdf.GetResource(feedItem.url);
        let feed = new Feed(feedResource, feedItem.parentFolder.server);
        feed.quickMode = parentItem.quickMode;
        feedItem.quickMode = parentItem.quickMode;
      }
      else
        parentItem.quickMode = feedItem.quickMode;
    }
  },

  onDragStart: function (aEvent)
  {
    // Get the selected feed article (if there is one).
    let seln = this.mView.selection;
    if (seln.count != 1)
      return;

    // Only initiate a drag if the item is a feed (ignore folders/containers).
    let item = this.mView.getItemAtIndex(seln.currentIndex);
    if (!item || item.container)
      return;

    aEvent.dataTransfer.setData("text/x-moz-feed-index", seln.currentIndex);
    aEvent.dataTransfer.effectAllowed = "copyMove";
  },

  onDragOver: function (aEvent)
  {
    this.mView._currentDataTransfer = aEvent.dataTransfer;
  },

  mFeedDownloadCallback:
  {
    mSubscribeMode: true,
    downloaded: function(feed, aErrorCode)
    {
      // Offline check is done in the context of 3pane, return to the subscribe
      // window once the modal prompt is dispatched.
      window.focus();
      // Feed is null if our attempt to parse the feed failed.
      let message = "";
      let win = FeedSubscriptions;
      if (aErrorCode == FeedUtils.kNewsBlogSuccess)
      {
        win.updateStatusItem("progressMeter", 100);

        // If we get here we should always have a folder by now, either in
        // feed.folder or FeedItems created the folder for us.
        FeedUtils.updateFolderFeedUrl(feed.folder, feed.url, false);

        // Add feed adds the feed to the subscriptions db and flushes the
        // datasource.
        FeedUtils.addFeed(feed.url, feed.name, feed.folder); 

        // Now add the feed to our view.  If adding, the current selection will
        // be a folder; if updating it will be a feed.  No need to rebuild the
        // entire view, that is too jarring.
        let curIndex = win.mView.selection.currentIndex;
        let curItem = win.mView.getItemAtIndex(curIndex);
        if (curItem)
        {
          let parentIndex, parentItem, newItem, level;
          let rows = win.mFeedContainers;
          if (curItem.container)
          {
            // Open the container, if it exists.
            let folderExists = win.selectFolder(feed.folder,
                                                { parentIndex: curIndex });
            if (!folderExists)
            {
              // This means a new folder was created.
              parentIndex = curIndex;
              parentItem = curItem;
              level = curItem.level + 1;
              newItem = win.makeFolderObject(feed.folder, level);
            }
            else
            {
              // If a folder happens to exist which matches one that would
              // have been created, the feed system reuses it.  Get the
              // current item again if reusing a previously unselected folder.
              curIndex = win.mView.selection.currentIndex;
              curItem = win.mView.getItemAtIndex(curIndex);
              parentIndex = curIndex;
              parentItem = curItem;
              level = curItem.level + 1;
              newItem = win.makeFeedObject(feed, feed.folder, level);
            }
          }
          else
          {
            parentIndex = win.mView.getParentIndex(curIndex);
            parentItem = win.mView.getItemAtIndex(parentIndex);
            level = curItem.level;
            newItem = win.makeFeedObject(feed, feed.folder, level);
          }

          if (!newItem.container)
            win.updateFolderQuickModeInView(newItem, parentItem, false);
          parentItem.children.push(newItem);
          parentItem.children = win.folderItemSorter(parentItem.children)

          if (win.mActionMode == win.kSubscribeMode)
            message = FeedUtils.strings.GetStringFromName(
                        "subscribe-feedAdded");
          if (win.mActionMode == win.kUpdateMode)
          {
            win.removeFeed(false);
            message = FeedUtils.strings.GetStringFromName(
                        "subscribe-feedUpdated");
          }
          if (win.mActionMode == win.kMoveMode)
            message = FeedUtils.strings.GetStringFromName(
                        "subscribe-feedMoved");
          if (win.mActionMode == win.kCopyMode)
            message = FeedUtils.strings.GetStringFromName(
                        "subscribe-feedCopied");

          win.selectFeed(feed, parentIndex);
        }
      }
      else
      {
        // Non success.  Remove intermediate traces from the feeds database.
        if (feed && feed.url && feed.server)
          FeedUtils.deleteFeed(FeedUtils.rdf.GetResource(feed.url),
                               feed.server,
                               feed.server.rootFolder);

        if (aErrorCode == FeedUtils.kNewsBlogInvalidFeed)
          message = FeedUtils.strings.GetStringFromName(
                      "subscribe-feedNotValid");
        if (aErrorCode == FeedUtils.kNewsBlogRequestFailure)
          message = FeedUtils.strings.GetStringFromName(
                      "subscribe-networkError");

        if (win.mActionMode != win.kUpdateMode)
          // Re-enable the add button if subscribe failed.
          document.getElementById("addFeed").removeAttribute("disabled");
      }

      win.mActionMode = null;
      win.clearStatusInfo();
      let code = feed.url.startsWith("http") ? aErrorCode : null;
      win.updateStatusItem("statusText", message, code);
    },

    // This gets called after the RSS parser finishes storing a feed item to
    // disk.  aCurrentFeedItems is an integer corresponding to how many feed
    // items have been downloaded so far.  aMaxFeedItems is an integer
    // corresponding to the total number of feed items to download.
    onFeedItemStored: function (feed, aCurrentFeedItems, aMaxFeedItems)
    {
      window.focus();
      let message = FeedUtils.strings.formatStringFromName(
                      "subscribe-gettingFeedItems",
                      [aCurrentFeedItems, aMaxFeedItems], 2);
      FeedSubscriptions.updateStatusItem("statusText", message);
      this.onProgress(feed, aCurrentFeedItems, aMaxFeedItems);
    },

    onProgress: function(feed, aProgress, aProgressMax, aLengthComputable)
    {
      FeedSubscriptions.updateStatusItem("progressMeter",
                                         (aProgress * 100) / aProgressMax);
    }
  },

  // Status routines.
  updateStatusItem: function(aID, aValue, aErrorCode)
  {
    let el = document.getElementById(aID);
    if (el.getAttribute("collapsed"))
      el.removeAttribute("collapsed");

    if (aID == "progressMeter")
      el.setAttribute("mode", aValue == "?" ? "undetermined" : "determined");

    if (aID == "statusText")
      el.textContent = aValue;
    else
      el.value = aValue;

    el = document.getElementById("validationText");
    if (aErrorCode == FeedUtils.kNewsBlogInvalidFeed)
      el.removeAttribute("collapsed");
    else
      el.setAttribute("collapsed", true);
  },

  clearStatusInfo: function()
  {
    document.getElementById("statusText").textContent = "";
    document.getElementById("progressMeter").collapsed = true;
    document.getElementById("validationText").collapsed = true;
  },

  checkValidation: function(aEvent)
  {
    if (aEvent.button != 0)
      return;

    let validationSite = "http://validator.w3.org";
    let validationQuery = "http://validator.w3.org/feed/check.cgi?url=";

    let win = Services.wm.getMostRecentWindow("mail:3pane");
    if (win && win instanceof Ci.nsIDOMWindow)
    {
      let tabmail = win.document.getElementById("tabmail");
      if (tabmail)
      {
        let feedLocation = document.getElementById("locationValue").value;
        let url = validationQuery + encodeURIComponent(feedLocation);

        win.focus();
        win.openContentTab(url, "tab", "^" + validationSite);
        FeedUtils.log.debug("checkValidation: query url - " + url);
      }
    }
    aEvent.stopPropagation();
  },

  // Listener for folder pane changes.
  FolderListener: {
    get feedWindow() {
      if (this._feedWindow)
        return this._feedWindow;
      let subscriptionsWindow =
        Services.wm.getMostRecentWindow("Mail:News-BlogSubscriptions");
      if (subscriptionsWindow)
        return this._feedWindow = subscriptionsWindow.FeedSubscriptions;
      return null;
    },

    get currentSelectedIndex() {
      return this.feedWindow ? this.feedWindow.mView.selection.currentIndex : -1;
    },

    get currentSelectedItem() {
      return this.feedWindow ? this.feedWindow.mView.currentItem : null;
    },

    folderAdded: function(aFolder)
    {
      if (aFolder.server.type != "rss" ||
          FeedUtils.isInTrash(aFolder))
        return;

      let parentFolder = aFolder.isServer ? aFolder : aFolder.parent;
      FeedUtils.log.debug("folderAdded: folder:parent - " + aFolder.name + ":" +
                          (parentFolder ? parentFolder.filePath.path : "(null)"));
      let feedWindow = this.feedWindow;

      if (!parentFolder)
        return;

      let curSelIndex = this.currentSelectedIndex;
      let curSelItem = this.currentSelectedItem;
      let firstVisRow = feedWindow.mView.treeBox.getFirstVisibleRow();
      let indexInView = feedWindow.mView.getItemInViewIndex(parentFolder);
      let open = indexInView != null;

      if (aFolder.isServer)
      {
        if (indexInView != null)
          // Existing account root folder in the view.
          open = feedWindow.mView.getItemAtIndex(indexInView).open;
        else
        {
          // Add the account root folder to the view.
          feedWindow.mFeedContainers.push(feedWindow.makeFolderObject(parentFolder, 0));
          feedWindow.mView.mRowCount++;
          feedWindow.mTree.view = feedWindow.mView;
          feedWindow.mView.treeBox.scrollToRow(firstVisRow);
          return;
        }
      }

      // Rebuild the added folder's parent item in the tree row cache.
      feedWindow.selectFolder(parentFolder, { select: false,
                                              open: open,
                                              newFolder: parentFolder });

      if (indexInView == null || !curSelItem)
        // Folder isn't in the tree view, no need to update the view.
        return;

      let parentIndex = feedWindow.mView.getParentIndex(indexInView);
      if (parentIndex == feedWindow.mView.kRowIndexUndefined)
        // Root folder is its own parent.
        parentIndex = indexInView;
      if (open)
      {
        // Close an open parent (or root) folder.
        feedWindow.mView.toggle(parentIndex);
        feedWindow.mView.toggleOpenState(parentIndex);
      }
      feedWindow.mView.treeBox.scrollToRow(firstVisRow);

      if (curSelItem.container)
        feedWindow.selectFolder(curSelItem.folder, { open: curSelItem.open });
      else
        feedWindow.selectFeed({ folder: curSelItem.parentFolder,
                                url: curSelItem.url }, parentIndex);
    },

    folderDeleted: function(aFolder)
    {
      if (aFolder.server.type != "rss" || FeedUtils.isInTrash(aFolder))
        return;

      FeedUtils.log.debug("folderDeleted: folder - " + aFolder.name);
      let feedWindow = this.feedWindow;
      let curSelIndex = this.currentSelectedIndex;
      let indexInView = feedWindow.mView.getItemInViewIndex(aFolder);
      let open = indexInView != null;

      // Delete the folder from the tree row cache.
      feedWindow.selectFolder(aFolder, { select: false, open: false, remove: true });

      if (!open || curSelIndex < 0)
        // Folder isn't in the tree view, no need to update the view.
        return;

      let select =
        indexInView == curSelIndex ||
        feedWindow.mView.isIndexChildOfParentIndex(indexInView, curSelIndex);
      feedWindow.mView.removeItemAtIndex(indexInView, !select);
    },

    folderRenamed: function(aOrigFolder, aNewFolder)
    {
      if (aNewFolder.server.type != "rss" || FeedUtils.isInTrash(aNewFolder))
        return;

      FeedUtils.log.debug("folderRenamed: old:new - " +
                          aOrigFolder.name + ":" + aNewFolder.name);
      let feedWindow = this.feedWindow;
      let curSelIndex = this.currentSelectedIndex;
      let curSelItem = this.currentSelectedItem;
      let firstVisRow = feedWindow.mView.treeBox.getFirstVisibleRow();
      let indexInView = feedWindow.mView.getItemInViewIndex(aOrigFolder);
      let open = indexInView != null;

      // Rebuild the renamed folder's item in the tree row cache.
      feedWindow.selectFolder(aOrigFolder, { select: false,
                                             open: open,
                                             newFolder: aNewFolder });

      if (!open || !curSelItem)
        // Folder isn't in the tree view, no need to update the view.
        return;

      let select =
        indexInView == curSelIndex ||
        feedWindow.mView.isIndexChildOfParentIndex(indexInView, curSelIndex);
      let parentIndex = feedWindow.mView.getParentIndex(indexInView);
      if (parentIndex == feedWindow.mView.kRowIndexUndefined)
        // Root folder is its own parent.
        parentIndex = indexInView;
      feedWindow.mView.toggle(parentIndex);
      feedWindow.mView.toggleOpenState(parentIndex);
      feedWindow.mView.treeBox.scrollToRow(firstVisRow);

      if (curSelItem.container) {
        if (curSelItem.folder == aOrigFolder)
          feedWindow.selectFolder(aNewFolder, { open: curSelItem.open });
        else if (select)
          feedWindow.mView.selection.select(indexInView);
        else
          feedWindow.selectFolder(curSelItem.folder, { open: curSelItem.open });
      }
      else
        feedWindow.selectFeed({ folder: curSelItem.parentFolder.rootFolder,
                                url: curSelItem.url }, parentIndex);
    },

    folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
    {
      if (aDestFolder.server.type != "rss")
        return;

      FeedUtils.log.debug("folderMoveCopyCompleted: move:src:dest - " +
                          aMove + ":" + aSrcFolder.name + ":" + aDestFolder.name);
      let feedWindow = this.feedWindow;
      let curSelIndex = this.currentSelectedIndex;
      let curSelItem = this.currentSelectedItem;
      let firstVisRow = feedWindow.mView.treeBox.getFirstVisibleRow();
      let indexInView = feedWindow.mView.getItemInViewIndex(aSrcFolder);
      let destIndexInView = feedWindow.mView.getItemInViewIndex(aDestFolder);
      let open = indexInView != null || destIndexInView != null;
      let parentIndex = feedWindow.mView.getItemInViewIndex(aDestFolder.parent);
      let select =
        indexInView == curSelIndex ||
        feedWindow.mView.isIndexChildOfParentIndex(indexInView, curSelIndex);

      if (aMove)
      {
        this.folderDeleted(aSrcFolder);
        if (aDestFolder.getFlag(Ci.nsMsgFolderFlags.Trash))
          return;
      }

      setTimeout(function() {
        // State on disk needs to settle before a folder object can be rebuilt.
        feedWindow.selectFolder(aDestFolder, { select: false,
                                               open: open || select,
                                               newFolder: aDestFolder });

        if (!open || !curSelItem)
          // Folder isn't in the tree view, no need to update the view.
          return;

        feedWindow.mView.toggle(parentIndex);
        feedWindow.mView.toggleOpenState(parentIndex);
        feedWindow.mView.treeBox.scrollToRow(firstVisRow);

        if (curSelItem.container) {
          if (curSelItem.folder == aSrcFolder || select)
            feedWindow.selectFolder(aDestFolder, { open: true });
          else
            feedWindow.selectFolder(curSelItem.folder, { open: curSelItem.open });
        }
        else
          feedWindow.selectFeed({ folder: curSelItem.parentFolder.rootFolder,
                                  url: curSelItem.url }, null);
      }, 50);
    }
  },

  /* *************************************************************** */
  /* OPML Functions                                                  */
  /* *************************************************************** */

  get brandShortName() {
    let brandBundle = document.getElementById("bundle_brand");
    return brandBundle ? brandBundle.getString("brandShortName") : "";
  },

/**
 * Export feeds as opml file Save As filepicker function.
 * 
 * @param  bool aList - if true, exporting as list; if false (default)
 *                      exporting feeds in folder structure - used for title.
 * @return nsILocalFile or null.
 */
  opmlPickSaveAsFile: function(aList)
  {
    let accountName = this.mRSSServer.rootFolder.prettyName;
    let fileName = FeedUtils.strings.formatStringFromName(
                     "subscribe-OPMLExportDefaultFileName",
                     [this.brandShortName, accountName], 2);
    let title = aList ? FeedUtils.strings.formatStringFromName(
                          "subscribe-OPMLExportTitleList", [accountName], 1) :
                        FeedUtils.strings.formatStringFromName(
                          "subscribe-OPMLExportTitleStruct", [accountName], 1);
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    fp.defaultString = fileName;
    fp.defaultExtension = "opml";
    if (this.opmlLastSaveAsDir && (this.opmlLastSaveAsDir instanceof Ci.nsILocalFile))
      fp.displayDirectory = this.opmlLastSaveAsDir;

    let opmlFilterText = FeedUtils.strings.GetStringFromName(
                           "subscribe-OPMLExportOPMLFilesFilterText");
    fp.appendFilter(opmlFilterText, "*.opml");
    fp.appendFilters(Ci.nsIFilePicker.filterAll);
    fp.filterIndex = 0;
    fp.init(window, title, Ci.nsIFilePicker.modeSave);

    if (fp.show() != Ci.nsIFilePicker.returnCancel && fp.file)
    {
      this.opmlLastSaveAsDir = fp.file.parent;
      return fp.file;
    }

    return null;
  },

/**
 * Import feeds opml file Open filepicker function.
 * 
 * @return nsILocalFile or null.
 */
  opmlPickOpenFile: function()
  {
    let title = FeedUtils.strings.GetStringFromName("subscribe-OPMLImportTitle");
    let fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);

    fp.defaultString = "";
    if (this.opmlLastOpenDir && (this.opmlLastOpenDir instanceof Ci.nsILocalFile))
      fp.displayDirectory = this.opmlLastOpenDir;

    let opmlFilterText = FeedUtils.strings.GetStringFromName(
                           "subscribe-OPMLExportOPMLFilesFilterText");
    fp.appendFilter(opmlFilterText, "*.opml");
    fp.appendFilters(Ci.nsIFilePicker.filterXML);
    fp.appendFilters(Ci.nsIFilePicker.filterAll);
    fp.init(window, title, Ci.nsIFilePicker.modeOpen);

    if (fp.show() != Ci.nsIFilePicker.returnCancel && fp.file)
    {
      this.opmlLastOpenDir = fp.file.parent;
      return fp.file;
    }

    return null;
  },

  exportOPML: function(aEvent)
  {
    // Account folder must be selected.
    let item = this.mView.currentItem;
    if (!item || !item.folder || !item.folder.isServer)
      return;

    this.mRSSServer = item.folder.server;
    let rootFolder = this.mRSSServer.rootFolder;
    let exportAsList = aEvent.ctrlKey;
    let SPACES2 = "  ";
    let SPACES4 = "    ";

    if (this.mRSSServer.rootFolder.hasSubFolders)
    {
      let opmlDoc = document.implementation.createDocument("", "opml", null);
      let opmlRoot = opmlDoc.documentElement;
      opmlRoot.setAttribute("version", "1.0");
      opmlRoot.setAttribute("xmlns:fz", "urn:forumzilla:");

      this.generatePPSpace(opmlRoot, SPACES2);

      // Make the <head> element.
      let head = opmlDoc.createElement("head");
      this.generatePPSpace(head, SPACES4);
      let titleText = FeedUtils.strings.formatStringFromName(
                        "subscribe-OPMLExportFileDialogTitle",
                        [this.brandShortName, rootFolder.prettyName], 2);
      let title = opmlDoc.createElement("title");
      title.appendChild(opmlDoc.createTextNode(titleText));
      head.appendChild(title);
      this.generatePPSpace(head, SPACES4);
      let dt = opmlDoc.createElement("dateCreated");
      dt.appendChild(opmlDoc.createTextNode((new Date()).toGMTString()));
      head.appendChild(dt);
      this.generatePPSpace(head, SPACES2);
      opmlRoot.appendChild(head);

      this.generatePPSpace(opmlRoot, SPACES2);

      // Add <outline>s to the <body>.
      let body = opmlDoc.createElement("body");
      if (exportAsList)
        this.generateOutlineList(rootFolder, body, SPACES4.length + 2);
      else
        this.generateOutlineStruct(rootFolder, body, SPACES4.length);

      this.generatePPSpace(body, SPACES2);

      if (!body.childElementCount)
        // No folders/feeds.
        return;

      opmlRoot.appendChild(body);
      this.generatePPSpace(opmlRoot, "");

      let serializer = new XMLSerializer();

      if (FeedUtils.log.level <= Log4Moz.Level.Debug)
        FeedUtils.log.debug("exportOPML: opmlDoc -\n" +
                            serializer.serializeToString(opmlDoc) + "\n");

      // Get file to save from filepicker.
      let saveAsFile = this.opmlPickSaveAsFile(exportAsList);
      if (!saveAsFile)
        return;

      let fos = FileUtils.openSafeFileOutputStream(saveAsFile);
      serializer.serializeToStream(opmlDoc, fos, "utf-8");
      FileUtils.closeSafeFileOutputStream(fos);

      let statusReport = FeedUtils.strings.formatStringFromName(
                           "subscribe-OPMLExportDone", [saveAsFile.path], 1);
      this.updateStatusItem("statusText", statusReport);
    }
  },

  generatePPSpace: function(aNode, indentString)
  {
    aNode.appendChild(aNode.ownerDocument.createTextNode("\n"));
    aNode.appendChild(aNode.ownerDocument.createTextNode(indentString));
  },

  generateOutlineList: function(baseFolder, parent, indentLevel)
  {
    // Pretty printing.
    let indentString = (new Array(indentLevel - 1)).join(" ");

    let feedOutline;
    let folderEnumerator = baseFolder.subFolders;
    while (folderEnumerator.hasMoreElements())
    {
      let folder = folderEnumerator.getNext().QueryInterface(Ci.nsIMsgFolder);
      FeedUtils.log.debug("generateOutlineList: folder - " +
                          folder.filePath.path);
      if (!(folder instanceof Ci.nsIMsgFolder) ||
          folder.getFlag(Ci.nsMsgFolderFlags.Trash) ||
          folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
        continue;

      FeedUtils.log.debug("generateOutlineList: CONTINUE folderName - " +
                          folder.name);

      if (folder.hasSubFolders)
      {
        FeedUtils.log.debug("generateOutlineList: has subfolders - " +
                            folder.name);
        // Recurse.
        this.generateOutlineList(folder, parent, indentLevel);
      }

      // Add outline elements with xmlUrls.
      let feeds = this.getFeedsInFolder(folder);
      for (let feed in feeds)
      {
        FeedUtils.log.debug("generateOutlineList: folder has FEED url - " +
                            folder.name + " : " + feeds[feed].url);
        feedOutline = this.exportOPMLOutline(feeds[feed], parent.ownerDocument);
        this.generatePPSpace(parent, indentString);
        parent.appendChild(feedOutline);
      }
    }
  },

  generateOutlineStruct: function(baseFolder, parent, indentLevel)
  {
    // Pretty printing.
    function indentString(len) { return (new Array(len - 1)).join(" ") };

    let folderOutline, feedOutline;
    let folderEnumerator = baseFolder.subFolders;
    while (folderEnumerator.hasMoreElements())
    {
      let folder = folderEnumerator.getNext().QueryInterface(Ci.nsIMsgFolder);
      FeedUtils.log.debug("generateOutlineStruct: folder - " +
                          folder.filePath.path);
      if (!(folder instanceof Ci.nsIMsgFolder) ||
          folder.getFlag(Ci.nsMsgFolderFlags.Trash) ||
          folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
        continue;

      FeedUtils.log.debug("generateOutlineStruct: CONTINUE folderName - " +
                          folder.name);

      // Make a folder outline element.
      folderOutline = parent.ownerDocument.createElement("outline");
      folderOutline.setAttribute("title", folder.prettyName);
      this.generatePPSpace(parent, indentString(indentLevel + 2));

      if (folder.hasSubFolders)
      {
        FeedUtils.log.debug("generateOutlineStruct: has subfolders - " +
                            folder.name);
        // Recurse.
        this.generateOutlineStruct(folder, folderOutline, indentLevel + 2);
      }

      let feeds = this.getFeedsInFolder(folder);
      for (let feed in feeds)
      {
        // Add feed outline elements with xmlUrls.
        FeedUtils.log.debug("generateOutlineStruct: folder has FEED url - "+
                            folder.name + " : " + feeds[feed].url);
        feedOutline = this.exportOPMLOutline(feeds[feed], parent.ownerDocument);
        this.generatePPSpace(folderOutline, indentString(indentLevel + 4));
        folderOutline.appendChild(feedOutline);
      }

      parent.appendChild(folderOutline);
    }
  },

  exportOPMLOutline: function(aFeed, aDoc)
  {
    let outRv = aDoc.createElement("outline");
    outRv.setAttribute("type", "rss");
    outRv.setAttribute("title", aFeed.title);
    outRv.setAttribute("text", aFeed.title);
    outRv.setAttribute("version", "RSS");
    outRv.setAttribute("fz:quickMode", aFeed.quickMode);
    outRv.setAttribute("xmlUrl", aFeed.url);
    outRv.setAttribute("htmlUrl", aFeed.link);
    return outRv;
  },

  importOPML: function()
  {
    // Account folder must be selected in subscribe dialog.
    let item = this.mView ? this.mView.currentItem : null;
    if (!item || !item.folder || !item.folder.isServer)
      return;

    let server = item.folder.server;
    // Get file to open from filepicker.
    let openFile = this.opmlPickOpenFile();
    if (!openFile)
      return;

    this.mActionMode = this.kImportingOPML;
    this.updateButtons(null);
    this.selectFolder(item.folder, { select: false, open: true });
    let statusReport = FeedUtils.strings.GetStringFromName("subscribe-loading");
    this.updateStatusItem("statusText", statusReport);
    // If there were a getElementsByAttribute in html, we could go determined...
    this.updateStatusItem("progressMeter", "?");

    if (!this.importOPMLFile(openFile, server, this.importOPMLFinished)) {
      this.mActionMode = null;
      this.updateButtons(item);
      this.clearStatusInfo();
    }
  },

/**
 * Import opml file into a feed account.  Used by the Subscribe dialog and
 * the Import wizard.
 * 
 * @param  nsILocalFile aFile           - the opml file.
 * @param  nsIMsgIncomingServer aServer - the account server.
 * @param  func aCallback               - callback function.
 * 
 * @return bool                         - false if error.
 */
  importOPMLFile: function(aFile, aServer, aCallback)
  {
    if (aServer && (aServer instanceof Ci.nsIMsgIncomingServer))
      this.mRSSServer = aServer;

    if (!aFile || !this.mRSSServer || !aCallback)
      return false;

    let opmlDom, statusReport;
    let stream = Cc["@mozilla.org/network/file-input-stream;1"].
                 createInstance(Ci.nsIFileInputStream);

    // Read in file as raw bytes, so Expat can do the decoding for us.
    try {
      stream.init(aFile, FileUtils.MODE_RDONLY, FileUtils.PERMS_FILE, 0);
      let parser = new DOMParser();
      opmlDom = parser.parseFromStream(stream, null, stream.available(),
                                       "application/xml");
    }
    catch(e) {
      statusReport = FeedUtils.strings.GetStringFromName(
                       "subscribe-errorOpeningFile");
      Services.prompt.alert(window, null, statusReport);
      return false;
    }
    finally {
      stream.close();
    }

    let body = opmlDom ? opmlDom.querySelector("body") : null;

    // Return if the OPML file is invalid or empty.
    if (!body || !body.childElementCount ||
      opmlDom.documentElement.tagName != "opml")
    {
      statusReport = FeedUtils.strings.formatStringFromName(
                       "subscribe-OPMLImportInvalidFile", [aFile.leafName], 1);
      Services.prompt.alert(window, null, statusReport);
      return false;
    }

    this.importOPMLOutlines(body, this.mRSSServer, aCallback);
    return true;
  },

  importOPMLOutlines: function(aBody, aRSSServer, aCallback)
  {
    let win = this;
    let rssServer = aRSSServer;
    let callback = aCallback;
    let outline, feedFolder;
    let badTag = false;
    let firstFeedInFolderQuickMode = null;
    let lastFolder;
    let feedsAdded = 0;
    let rssOutlines = 0;
    let folderOutlines = 0;

    function processor(aParentNode, aParentFolder)
    {
      FeedUtils.log.trace("importOPMLOutlines: PROCESSOR tag:name:childs - " +
                          aParentNode.tagName + ":" +
                          aParentNode.getAttribute("text") + ":" +
                          aParentNode.childElementCount);
      while (true)
      {
        if (aParentNode.tagName == "body" && !aParentNode.childElementCount)
        {
          // Finished.
          let statusReport = win.importOPMLStatus(feedsAdded, rssOutlines);
          callback(statusReport, lastFolder, win);
          return;
        }

        outline = aParentNode.firstElementChild;
        if (outline.tagName != "outline")
        {
          FeedUtils.log.info("importOPMLOutlines: skipping, node is not an " +
                             "<outline> - <" + outline.tagName + ">");
          badTag = true;
          break;
        }

        let outlineName = outline.getAttribute("text") ||
                          outline.getAttribute("title") ||
                          outline.getAttribute("xmlUrl");
        let feedUrl, folderURI;

        if (outline.getAttribute("type") == "rss")
        {
          // A feed outline.
          feedUrl = outline.getAttribute("xmlUrl") || outline.getAttribute("url");
          if (!feedUrl)
          {
            FeedUtils.log.info("importOPMLOutlines: skipping, type=rss <outline> " +
                               "has no url - " + outlineName);
            break;
          }

          rssOutlines++;
          feedFolder = aParentFolder;

          if (FeedUtils.feedAlreadyExists(feedUrl, rssServer))
          {
            FeedUtils.log.info("importOPMLOutlines: feed already subscribed in account " +
                               rssServer.prettyName + ", url - " + feedUrl);
            break;
          }

          if (aParentNode.tagName == "outline" &&
              aParentNode.getAttribute("type") != "rss")
            // Parent is a folder, already created.
            folderURI = feedFolder.URI;
          else
          {
            // Parent is not a folder outline, likely the <body> in a flat list.
            // Create feed's folder with feed's name and account rootFolder as
            // parent of feed's folder.
            // NOTE: Assume a type=rss outline must be a leaf and is not a
            // direct parent of another type=rss outline; such a structure
            // may lead to unintended nesting and inaccurate counts.
          }

          // Create the feed.
          let quickMode = outline.hasAttribute("fz:quickMode") ?
                          outline.getAttribute("fz:quickMode") == "true" :
                          rssServer.getBoolValue("quickMode");

          if (firstFeedInFolderQuickMode === null)
            // The summary/web page pref applies to all feeds in a folder,
            // though it is a property of an individual feed.  This can be
            // set (and is obvious) in the subscribe dialog; ensure import
            // doesn't leave mismatches if mismatched in the opml file.
            firstFeedInFolderQuickMode = quickMode;
          else
            quickMode = firstFeedInFolderQuickMode;

          let feedProperties = { feedName     : outlineName,
                                 feedLocation : feedUrl,
                                 server       : rssServer,
                                 folderURI    : folderURI,
                                 quickMode    : quickMode };

          FeedUtils.log.debug("importOPMLOutlines: importing feed: name, url - "+
                              outlineName + ", " + feedUrl);

          let feed = win.storeFeed(feedProperties);
          if (outline.hasAttribute("htmlUrl"))
            feed.link = outline.getAttribute("htmlUrl");

          feed.createFolder();
          FeedUtils.updateFolderFeedUrl(feed.folder, feed.url, false);

          // addFeed() adds the feed to the datasource, it also flushes the
          // subscription datasource.
          FeedUtils.addFeed(feed.url, feed.name, feed.folder);
          // Feed correctly added.
          feedsAdded++;
          lastFolder = feed.folder;
        }
        else
        {
          // A folder outline.
          try {
            feedFolder = aParentFolder.getChildNamed(outlineName);
          }
          catch (ex) {
            // Folder not found, create it.
            FeedUtils.log.debug("importOPMLOutlines: creating folder - '" +
                                outlineName + "' in parent folder " +
                                aParentFolder.filePath.path);
            firstFeedInFolderQuickMode = null;
            try {
              feedFolder = aParentFolder.QueryInterface(Ci.nsIMsgLocalMailFolder).
                                         createLocalSubfolder(outlineName);
              folderOutlines++;
            }
            catch (ex) {
              // An error creating.  This can happen in (rare, if user manually
              // deletes .msf or panacea or such) cases of mismatched folder
              // names and hashed names and files on disk.  Skip it.
              FeedUtils.log.error("importOPMLOutlines: skipping, error creating " +
                                  " folder - '" + outlineName +
                                  "' in parent folder " + aParentFolder.filePath.path);
              badTag = true;
              break;
            }
          }
        }
        break;
      }

      if (!outline.childElementCount || badTag)
      {
        // Remove leaf nodes that are processed or bad tags from the opml dom,
        // and go back to reparse.  This method lets us use setTimeout to
        // prevent UI hang, in situations of both deep and shallow trees.
        // A yield/generator.next() method is fine for shallow trees, but not
        // the true recursion required for deeper trees; both the shallow loop
        // and the recurse should give it up.
        aParentNode.removeChild(outline);
        badTag = false;
        outline = aBody;
        feedFolder = rssServer.rootFolder;
      }

      setTimeout(function() {
        processor(outline, feedFolder);
      }, 0);
    }

    processor(aBody, rssServer.rootFolder);
  },

  importOPMLStatus: function(aFeedsAdded, aRssOutlines, aFolderOutlines)
  {
    let statusReport;
    if (aRssOutlines > aFeedsAdded)
      statusReport = FeedUtils.strings.formatStringFromName("subscribe-OPMLImportStatus",
        [PluralForm.get(aFeedsAdded,
                        FeedUtils.strings.GetStringFromName("subscribe-OPMLImportUniqueFeeds"))
                   .replace("#1", aFeedsAdded),
         PluralForm.get(aRssOutlines,
                        FeedUtils.strings.GetStringFromName("subscribe-OPMLImportFoundFeeds"))
                   .replace("#1", aRssOutlines)], 2);
    else
      statusReport = PluralForm.get(aFeedsAdded,
        FeedUtils.strings.GetStringFromName("subscribe-OPMLImportFeedCount"))
                         .replace("#1", aFeedsAdded);

    return statusReport;
  },

  importOPMLFinished: function(aStatusReport, aLastFolder, aWin)
  {
    if (aLastFolder)
    {
      aWin.selectFolder(aLastFolder, { select: false, newFolder: aLastFolder });
      aWin.selectFolder(aLastFolder.parent);
    }
    aWin.mActionMode = null;
    aWin.updateButtons(aWin.mView.currentItem);
    aWin.clearStatusInfo();
    aWin.updateStatusItem("statusText", aStatusReport);
  }

};
