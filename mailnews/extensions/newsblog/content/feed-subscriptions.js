# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Thunderbird RSS Subscription Manager
#
# The Initial Developer of the Original Code is
# The Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#  Scott MacGregor <mscott@mozilla.org>
#  Ian Neal <iann_bugzilla@blueyonder.co.uk>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK ******

var gFeedSubscriptionsWindow = {
  get mTree() { return document.getElementById("rssSubscriptionsList"); },

  mFeedContainers: [],
  mRSSServer     : null,
  mActionMode    : null,
  kSubscribeMode : 1,
  kUpdateMode    : 2,
  kMoveMode      : 3,

  onLoad: function ()
  {
    // Extract the folder argument.
    let folder;
    if (window.arguments && window.arguments[0].folder)
      folder = window.arguments[0].folder;

    this.refreshSubscriptionView(folder)

    let win = Services.wm.getMostRecentWindow("mail:3pane");
    if (win)
    {
      win.FeedFolderNotificationService =
        Cc["@mozilla.org/messenger/msgnotificationservice;1"].
        getService(Ci.nsIMsgFolderNotificationService);
      win.FeedFolderNotificationService.addListener(this.FolderListener,
        Ci.nsIMsgFolderNotificationService.folderAdded |
        Ci.nsIMsgFolderNotificationService.folderDeleted |
        Ci.nsIMsgFolderNotificationService.folderRenamed |
        Ci.nsIMsgFolderNotificationService.folderMoveCopyCompleted);
    }
  },

  onUnload: function ()
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
      let win = Services.wm.getMostRecentWindow("mail:3pane");
      if (win)
        delete win.FeedFolderNotificationService;
    }

    return dismissDialog;
  },

  refreshSubscriptionView: function(aSelectFolder)
  {
    let item = this.mView.currentItem;
    let firstVisRow, lastVisRow, curFirstVisRow;
    if (this.mView.treeBox)
      firstVisRow = this.mView.treeBox.getFirstVisibleRow();
    this.loadSubscriptions();
    this.mTree.view = this.mView;
    if (aSelectFolder)
      // Ensure dialog is fully loaded before selecting, to get visible row.
      setTimeout(function() {
        gFeedSubscriptionsWindow.selectFolder(aSelectFolder);
      }, 0);
    else
    {
      // If no folder to select, try to select the pre rebuild selection, in
      // an existing window.  For folderpane changes in a feed account.
      if (item)
      {
        if (item.container)
        {
          if (!this.selectFolder(item.folder))
            // The item no longer exists, an ancestor folder was deleted or
            // renamed/moved.
            this.selectFolder(item.folder.rootFolder);
        }
        else
        {
          // If selecting a prior selected feed, get its folder from the db
          // in case an ancestor folder was renamed/moved.
          let itemResource = rdf.GetResource(item.url);
          let ds = getSubscriptionsDS(item.parentFolder.server);
          let itemFolder = ds.GetTarget(itemResource, FZ_DESTFOLDER, true);
          if (itemFolder)
          {
            itemFolder = itemFolder.QueryInterface(Ci.nsIMsgFolder);
            this.selectFeed({folder: itemFolder, url: item.url}, null);
          }
          else
            // The item no longer exists, an ancestor folder was deleted.
            this.selectFolder(item.parentFolder.rootFolder);
        }

        curFirstVisRow = this.mView.treeBox.getFirstVisibleRow();
        lastVisRow = this.mView.treeBox.getLastVisibleRow();
        if (firstVisRow >= 0 && //firstVisRow >= curFirstVisRow &&
            this.mView.rowCount - lastVisRow > firstVisRow - curFirstVisRow)
          this.mView.treeBox.scrollToRow(firstVisRow);
        else
          this.mView.treeBox.ensureRowIsVisible(this.mView.rowCount - 1);
        FeedUtils.log.debug("refreshSubscriptionView: curIndex:curFirstVisRow:" +
                            "firstVisRow:lastVisRow:rowCount - " +
                            this.mView.selection.currentIndex+":"+
                            curFirstVisRow+":"+
                            firstVisRow+":"+lastVisRow+":"+this.mView.rowCount);
      }
    }
  },

  mView:
  {
    _atoms: [],
    _getAtomFor: function(aName) {
      if (!this._atoms[aName])
        this._atoms[aName] = this._makeAtom(aName);
      return this._atoms[aName];
    },
  
    _makeAtom: function(aString) {
      return Cc["@mozilla.org/atom-service;1"].
             getService(Ci.nsIAtomService).
             getAtom(aString);
    },

    kRowIndexUndefined: -1,

    get currentItem() {
      // Get the current selection, if any.
      let seln = this.selection;
      let currentSelectionIndex =  seln ? seln.currentIndex : null;
      let item;
      if (currentSelectionIndex)
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
    getRowProperties: function(aRow, aProperties)      {},
    getColumnProperties: function(aCol, aProperties)   {},
    getCellValue: function (aRow, aColumn)             {},
    setCellValue: function (aRow, aColumn, aValue)     {},
    setCellText: function (aRow, aColumn, aValue)      {},

    getCellProperties: function (aRow, aColumn, aProperties) {
//      aProperties.AppendElement(this._getAtomFor("folderNameCol"));
      let item = this.getItemAtIndex(aRow);
      let folder = item && item.folder ? item.folder : null;
      if (folder)
      {
        if (folder.isServer)
        {
          aProperties.AppendElement(this._getAtomFor("serverType-rss"));
          aProperties.AppendElement(this._getAtomFor("isServer-true"));
        }
        else
          // It's a feed folder.
          aProperties.AppendElement(this._getAtomFor("livemark"));
      }
      else
        // It's a feed.
        aProperties.AppendElement(this._getAtomFor("serverType-rss"));
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
      if (aRow < 0 || aRow >= gFeedSubscriptionsWindow.mFeedContainers.length)
        return null;

      return gFeedSubscriptionsWindow.mFeedContainers[aRow];
    },

    removeItemAtIndex: function (aRow, aNoSelect)
    {
      let itemToRemove = this.getItemAtIndex(aRow);
      if (!itemToRemove)
        return;

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
      gFeedSubscriptionsWindow.mFeedContainers.splice(aRow, 1);

      // Now invalidate the correct tree rows.
      this.mRowCount--;
      this.treeBox.rowCountChanged(aRow, -1);

      // Now update the selection position, unless noSelect (selection is
      // done later or not at all).  If the item is the last child, select the
      // parent.  Otherwise select the next sibling.
      if (!aNoSelect) {
        if (aRow <= gFeedSubscriptionsWindow.mFeedContainers.length)
          this.selection.select(hasNextSibling ? aRow : aRow - 1);
        else
          this.selection.clearSelection();
      }

      // Now refocus the tree.
      gFeedSubscriptionsWindow.mTree.focus();
    },

    getCellText: function (aRow, aColumn)
    {
      let item = this.getItemAtIndex(aRow);
      return (item && aColumn.id == "folderNameCol") ? item.name : "";
    },

    canDrop: function (aRow, aOrientation)
    { 
      let dropResult = this.extractDragData();
      return (aOrientation == Ci.nsITreeView.DROP_ON) &&
             dropResult.canDrop &&
             (dropResult.url || dropResult.index != this.kRowIndexUndefined);
    },

    drop: function (aRow, aOrientation)
    {
      let win = gFeedSubscriptionsWindow;
      let results = this.extractDragData();
      if (!results.canDrop)
        return;

      // Preselect the drop folder.
      this.selection.select(aRow);

      if (results.url)
      {
        // Don't freeze the app that initiated the drop just because we are
        // in a loop waiting for the user to dimisss the add feed dialog.
        setTimeout(function() {
          win.addFeed(results.url, null, true, win.kSubscribeMode);
        }, 0);
        let folderItem = this.getItemAtIndex(aRow);
        FeedUtils.log.debug("drop: folder, url - " +
                            folderItem.folder.name+", "+results.url);
      }
      else if (results.index != this.kRowIndexUndefined)
      {
        win.moveFeed(results.index, aRow);
      }
    },

    // Helper function for drag and drop.
    extractDragData: function()
    {
      let canDrop = false;
      let urlToDrop, sourceUri;
      let sourceIndex = this.kRowIndexUndefined;
      let dragService = Cc["@mozilla.org/widget/dragservice;1"].
                        getService().QueryInterface(Ci.nsIDragService);
      let dragSession = dragService.getCurrentSession();

      let transfer = Cc["@mozilla.org/widget/transferable;1"].
                     createInstance(Ci.nsITransferable);
      transfer.addDataFlavor("text/x-moz-url");
      transfer.addDataFlavor("text/x-moz-feed-index");

      dragSession.getData(transfer, 0);
      let dataObj = new Object();
      let flavor = new Object();
      let len = new Object();

      try {
        transfer.getAnyTransferData(flavor, dataObj, len);
      }
      catch (ex) {
        return { canDrop: false, url: "" };
      }

      if (dataObj.value)
      {
        dataObj = dataObj.value.QueryInterface(Ci.nsISupportsString);
        // Pull the URL out of the data object.
        sourceUri = dataObj.data.substring(0, len.value);

        if (flavor.value == "text/x-moz-url")
        {
          let uri = Cc["@mozilla.org/network/standard-url;1"].
                    createInstance(Ci.nsIURI);
          uri.spec = sourceUri.split("\n")[0];

          if (uri.schemeIs("http") || uri.schemeIs("https"))
          {
            urlToDrop = uri.spec;
            canDrop = true;
          }
        }
        else if (flavor.value == "text/x-moz-feed-index")
        {
          sourceIndex = parseInt(sourceUri);
          canDrop = true;
        }
      }  // if dataObj.value

      return { canDrop: canDrop, url: urlToDrop, index: sourceIndex };
    },

    getParentIndex: function (aRow)
    {
      let item = this.getItemAtIndex(aRow);

      if (item)
      {
        for (let index = aRow; index >= 0; index--)
          if (gFeedSubscriptionsWindow.mFeedContainers[index].level < item.level)
            return index;
      }

      return this.kRowIndexUndefined;
    },

    hasNextSibling: function(aRow, aAfterIndex) {
      let targetLevel = this.getItemAtIndex(aRow).level;
      let rows = gFeedSubscriptionsWindow.mFeedContainers;
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

      let rows = gFeedSubscriptionsWindow.mFeedContainers;
      let rowCount = 0;
      let multiplier;

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
    let folderObject =  { children : [],
                          folder   : aFolder,
                          name     : aFolder.prettiestName,
                          level    : aCurrentLevel,
                          url      : aFolder.URI,
                          //QueryInterface(Ci.nsIRDFResource).Value,
                          quickMode: defaultQuickMode,
                          open     : false,
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

    function sorter(a, b)
    {
      let sortKey = a.folder.compareSortKeys(b.folder);
      if (sortKey)
        return sortKey;
      return a.name.toLowerCase() > b.name.toLowerCase();
    }
 
    folderObject.children.sort(sorter);

    let feeds = this.getFeedsInFolder(aFolder);
    for (let feed in feeds)
    {
      // Special case, if a folder only has a single feed associated with it,
      // then just use the feed in the view and don't show the folder at all.
      // Note: split always adds an empty element to the array...
//      if (feedUrlArray.length <= 2 && !aFolder.hasSubFolders)
//        this.mFeedContainers[aCurrentLength] =
//            this.makeFeedObject(feed, aCurrentLevel);
//      else
        // Now add any feed urls for the folder.
        folderObject.children.push(this.makeFeedObject(feeds[feed],
                                                       aFolder,
                                                       aCurrentLevel + 1));
    }

    return folderObject;
  },

  getFeedsInFolder: function (aFolder)
  {
    let feeds = new Array();
    let feedUrlArray = getFeedUrlsInFolder(aFolder);
    if (!feedUrlArray)
      // No feedUrls in this folder.
      return;

    for (let url in feedUrlArray)
    {
      if (!feedUrlArray[url])
        continue;
      let feedResource = rdf.GetResource(feedUrlArray[url]);
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
    let feedRootFolders = [];
    let feedContainers = [];

    // Get all the feed account folders.
    let allServers = MailServices.accounts.allServers;
    for (let i = 0; i < allServers.Count(); i++)
    {
      let currentServer = allServers.QueryElementAt(i, Ci.nsIMsgIncomingServer);
      if (currentServer && currentServer.type == "rss")
        feedRootFolders.push(currentServer.rootFolder);
    }

    feedRootFolders.forEach(function(rootFolder) {
      feedContainers.push(this.makeFolderObject(rootFolder, 0));
      numFolders++;
    }, this);

    this.mFeedContainers = feedContainers;
    this.mView.mRowCount = numFolders;

    gFeedSubscriptionsWindow.mTree.focus();
  },

  /**
   * Find the folder in the tree.  The search may be limited to subfolders of
   * a known folder, or expanded to include the entire tree.  The first
   * occurence of a folder URI will be selected.
   * 
   * @param  aFolder nsIMsgFolder - the folder to find.
   * @param  [aSelect] boolean    - if true (default) the folder's ancestors
   *                                will be opened and the folder selected.
   * @param  [aParentIndex] int   - index of folder to start the search.
   * @param  [aOpen] boolean      - if true (default) the folder is opened.
   * 
   * @return bool found - true if found, false if not.
   */
  selectFolder: function(aFolder, aSelect, aParentIndex, aOpen)
  {
    let folderURI = aFolder.URI;
    let selectIt = aSelect == null ? true : aSelect;
    let openIt = aOpen == null ? true : aOpen;
    let startIndex, startItem;
    let found = false;

    if (aFolder.isServer || aParentIndex != null)
      // For a server, the aParentIndex doesn't matter, they are always visible.
      startIndex = aParentIndex;
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
    }

    if (!aFolder.isServer)
      startItem = this.mView.getItemAtIndex(startIndex);

    function containsFolder(aItem)
    {
      // Search for the folder.  If it's found, set the open state on all
      // ancestor folders.  A toggle() rebuilds the view rows to match the map.
      if (aItem.url == folderURI)
        return true;

      for (let i = 0; i < aItem.children.length; i++) {
        if (aItem.children[i].container && containsFolder(aItem.children[i]))
          return aItem.children[i].open = true;
      }

      return false;
    }

    if (startItem)
    {
      // Find a folder with a specific parent.
      found = containsFolder(startItem);
      if (!found)
        return false;

      if (!selectIt)
        return true;

      if (startItem.open)
        this.mView.toggle(startIndex);
      this.mView.toggle(startIndex);
    }

    for (let index = 0; index < this.mView.rowCount && selectIt; index++)
    {
      // The desired folder is now in the view.
      let item = this.mView.getItemAtIndex(index);
      if (!item.container)
        continue;
      if (item.url == folderURI)
      {
        if (item.children.length && !item.open && openIt)
          this.mView.toggle(index);
        this.mView.selection.select(index);
        this.mView.treeBox.ensureRowIsVisible(index);
        found = true;
        break;
      }
    }

    if (this.mView.selection.selectEventsSuppressed)
      this.mView.selection.selectEventsSuppressed = false;
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
    let found = false;
    if (this.selectFolder(aFeed.folder, true, aParentIndex))
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
    let selectFolder = document.getElementById("selectFolder");
    let rssAccountMenuItem = document.getElementById("rssAccountMenuItem");
    let server, rootFolder, displayFolder;

    if (!aItem.container)
    {
      // A feed item.  Set the feed location and title info.
      nameValue.value = aItem.name;
      locationValue.value = aItem.url;

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

      server = aItem.folder.server;
      rootFolder = aItem.folder.rootFolder;
      displayFolder = aItem.folder;
    }

    // Common to both folder and feed items.
    nameValue.disabled = aItem.container;

    selectFolder.setAttribute("ref", rootFolder.URI);
    selectFolder.selectedIndex = -1;
    selectFolder.disabled = aItem.container;
    this.setFolderPicker(displayFolder.URI);

    rssAccountMenuItem.label = server.prettyName;
    rssAccountMenuItem.value = server.serverURI;
    // A feed can't be added to the account folder.
    rssAccountMenuItem.setAttribute("disabled", true);

    // Set quick mode value.
    document.getElementById("quickMode").checked = aItem.quickMode;
  },

  setFolderPicker: function(aFolderURI)
  {
    let selectFolder = document.getElementById("selectFolder");
    let msgFolder = GetMsgFolderFromUri(aFolderURI, true);
    if (!msgFolder)
      return;

    selectFolder.setAttribute("label", msgFolder.name);
    selectFolder.setAttribute("uri", msgFolder.URI);
  },

  onKeyPress: function(aEvent)
  {
    if (aEvent.keyCode == aEvent.DOM_VK_DELETE)
      this.removeFeed(true);

    this.clearStatusInfo();
  },

  onSelect: function ()
  {
    let item = this.mView.currentItem;
    let isServer = item && item.folder && item.folder.isServer;
    let disable;
    this.updateFeedData(item);
    disable = !item || (!item.container || this.mActionMode == this.kMoveMode);
    document.getElementById("addFeed").disabled = disable;
    disable = !item || (item.container && this.mActionMode != this.kMoveMode);
    document.getElementById("removeFeed").disabled = disable;
    document.getElementById("editFeed").disabled = disable;
    document.getElementById("importOPML").disabled = !item || !isServer;
    document.getElementById("exportOPML").disabled = !item || !isServer;
  },

  onClick: function (aEvent)
  {
    if (aEvent.button != 0)
      return;

    this.clearStatusInfo();
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

    deleteFeed(rdf.GetResource(itemToRemove.url),
               itemToRemove.parentFolder.server,
               itemToRemove.parentFolder);

    // Now that we have removed the feed from the datasource, it is time to
    // update our view layer.  Start by removing the child from its parent
    // folder object.
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
   * @param  [aMode] integer           - action mode (default is kSubscribeMode)
   *                                     of the add.
   * 
   * @return success boolean           - true if edit checks passed and an
   *                                     async download has been initiated.
   */
  addFeed: function(aFeedLocation, aFolder, aParse, aMode)
  {
    let message;
    let parse = aParse == null ? true : aParse;
    let mode = aMode == null ? this.kSubscribeMode : aMode;
    let locationValue = document.getElementById("locationValue");

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
    if (feedAlreadyExists(feedLocation, addFolder.server))
    {
      message = FeedUtils.strings.GetStringFromName(
                  "subscribe-feedAlreadySubscribed");
      this.updateStatusItem("statusText", message);
      return false;
    }

    let name = document.getElementById("nameValue").value;
    let quickMode = document.getElementById("quickMode").checked;
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
    let itemResource = rdf.GetResource(feedProperties.feedLocation);
    let feed = new Feed(itemResource, feedProperties.server);

    // If the user specified a folder to add the feed to, then set it here.
    if (feedProperties.folderURI)
    {
      let folderResource = rdf.GetResource(feedProperties.folderURI);
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

    let resource = rdf.GetResource(itemToEdit.url);
    let currentFolderServer = itemToEdit.parentFolder.server;
    let ds = getSubscriptionsDS(currentFolderServer);
    let currentFolder = ds.GetTarget(resource, FZ_DESTFOLDER, true);
    let currentFolderURI = currentFolder.QueryInterface(Ci.nsIRDFResource).Value;
    let feed = new Feed(resource, currentFolderServer);

    let editNameValue = document.getElementById("nameValue").value;
    let editFeedLocation = document.getElementById("locationValue").value.trim();
    let editQuickMode = document.getElementById("quickMode").checked;

    if (feed.url != editFeedLocation)
    {
      // Updating a url.  We need to add the new url and delete the old, to
      // ensure everything is cleaned up correctly.
      this.addFeed(null, itemToEdit.parentFolder, false, this.kUpdateMode)
      return;
    }

    let updated = false;
    // Check to see if the title value changed.
    if (feed.title != editNameValue)
    {
      feed.title = editNameValue;
      itemToEdit.name = editNameValue;
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
    let editFolderURI =
      document.getElementById("selectFolder").getAttribute("uri");
    if (currentFolderURI != editFolderURI)
    {
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
        this.moveFeed(seln.currentIndex, newParentIndex)

      updated = true;
    }

    if (!updated)
      return;

    ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();

    let message = FeedUtils.strings.GetStringFromName("subscribe-feedUpdated");
    this.updateStatusItem("statusText", message);
  },

  // Moves the feed located at aOldFeedIndex to a child of aNewParentIndex.
  moveFeed: function(aOldFeedIndex, aNewParentIndex)
  {
    let currentItem = this.mView.getItemAtIndex(aOldFeedIndex);
    if (!currentItem ||
        this.mView.getParentIndex(aOldFeedIndex) == aNewParentIndex)
      // If the new parent is the same as the current parent, then do nothing.
      return false;

    let currentParentIndex = this.mView.getParentIndex(aOldFeedIndex);
    let currentParentItem = this.mView.getItemAtIndex(currentParentIndex);
    let currentParentResource = rdf.GetResource(currentParentItem.url);
    let currentFolder = currentParentResource.QueryInterface(Ci.nsIMsgFolder);

    let newParentItem = this.mView.getItemAtIndex(aNewParentIndex);
    let newParentResource = rdf.GetResource(newParentItem.url);
    let newFolder = newParentResource.QueryInterface(Ci.nsIMsgFolder);

    let ds = getSubscriptionsDS(currentItem.parentFolder.server);
    let resource = rdf.GetResource(currentItem.url);

    let accountMove = false;
    if (currentFolder.rootFolder.URI == newFolder.rootFolder.URI)
    {
      // Moving within the same account/feeds db.
      if (newFolder.isServer)
        // No moving to account folder if already in the account.
        return false;

      // Unassert the older URI, add an assertion for the new parent URI.
      ds.Change(resource, FZ_DESTFOLDER,
                currentParentResource, newParentResource);
      ds.QueryInterface(Ci.nsIRDFRemoteDataSource).Flush();
      // Update the feed url attributes on the databases for each folder:
      // Remove our feed url property from the current folder.
      updateFolderFeedUrl(currentFolder, currentItem.url, true);
      // Add our feed url property to the new folder.
      updateFolderFeedUrl(newFolder, currentItem.url, false);
    }
    else
    {
      // Moving to a new account.  If dropping on the account folder, a new
      // subfolder is created if necessary.
      accountMove = true;
      // Subscribe to the new folder first.  If it already exists in the
      // account or on error, return.
      if (!this.addFeed(currentItem.url, newFolder, false, this.kMoveMode))
        return;
      // Unsubscribe the feed from the old folder, if add to the new folder
      // is successfull.
      deleteFeed(rdf.GetResource(currentItem.url),
                 currentItem.parentFolder.server,
                 currentItem.parentFolder);
    }

    // Finally, update our view layer.  Remove the old row.
    this.mView.removeItemAtIndex(aOldFeedIndex, true);
    if (aNewParentIndex > aOldFeedIndex)
      aNewParentIndex--;

    if (accountMove)
    {
      // If a cross account move, download callback will update the view with
      // the new location.  Preselect folder/mode for callback.
      this.selectFolder(newFolder, true, aNewParentIndex);
      return true;
    }

    // Add the new row location to the view.
    currentItem.level = newParentItem.level + 1;
    currentItem.parentFolder = newFolder;
    newParentItem.children.push(currentItem);

    if (newParentItem.open)
      // Close the container, selecting the feed will rebuild the view rows.
      this.mView.toggle(aNewParentIndex);

    this.selectFeed({folder: newParentItem.folder, url: currentItem.url},
                    aNewParentIndex);

    let message = FeedUtils.strings.GetStringFromName("subscribe-feedMoved");
    this.updateStatusItem("statusText", message);
  },

  beginDrag: function (aEvent)
  {
    // Get the selected feed article (if there is one).
    let seln = this.mView.selection;
    if (seln.count != 1)
      return;

    // Only initiate a drag if the item is a feed (ignore folders/containers).
    let item = this.mView.getItemAtIndex(seln.currentIndex);
    if (!item || item.container)
      return;

    aEvent.dataTransfer.setData("text/x-moz-feed-index",
                                seln.currentIndex.toString());
    aEvent.dataTransfer.effectAllowed = "move";
  },

  mFeedDownloadCallback:
  {
    downloaded: function(feed, aErrorCode)
    {
      // Feed is null if our attempt to parse the feed failed.
      let message = "";
      let win = gFeedSubscriptionsWindow;
      if (aErrorCode == FeedUtils.kNewsBlogSuccess)
      {
        win.updateStatusItem("progressMeter", 100);

        // If we get here we should always have a folder by now, either in
        // feed.folder or FeedItems created the folder for us.
        updateFolderFeedUrl(feed.folder, feed.url, false);

        // Add feed adds the feed to the subscriptions db and flushes the
        // datasource.
        addFeed(feed.url, feed.name, feed.folder); 

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
            let folderExists = win.selectFolder(feed.folder, true, curIndex);
            if (!folderExists) //curItem.folder.isServer && 
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

          parentItem.children.push(newItem);

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

          win.selectFeed(feed, parentIndex);
        }
      }
      else
      {
        // Non success.  Remove intermediate traces from the feeds database.
        if (feed && feed.url && feed.server)
          deleteFeed(rdf.GetResource(feed.url),
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

      win.clearStatusInfo();
      win.updateStatusItem("statusText", message, aErrorCode);
    },

    // This gets called after the RSS parser finishes storing a feed item to
    // disk.  aCurrentFeedItems is an integer corresponding to how many feed
    // items have been downloaded so far.  aMaxFeedItems is an integer
    // corresponding to the total number of feed items to download.
    onFeedItemStored: function (feed, aCurrentFeedItems, aMaxFeedItems)
    {
      let message = FeedUtils.strings.formatStringFromName(
                      "subscribe-gettingFeedItems",
                      [aCurrentFeedItems, aMaxFeedItems], 2);
      gFeedSubscriptionsWindow.updateStatusItem("statusText", message);
      this.onProgress(feed, aCurrentFeedItems, aMaxFeedItems);
    },

    onProgress: function(feed, aProgress, aProgressMax)
    {
      gFeedSubscriptionsWindow.updateStatusItem("progressMeter",
                                                (aProgress * 100) / aProgressMax);
    }
  },

  // Status routines.
  updateStatusItem: function(aID, aValue, aErrorCode)
  {
    let el = document.getElementById(aID);
    if (el.getAttribute("collapsed"))
      el.removeAttribute("collapsed");

    el.value = aValue;

    el = document.getElementById("validationText");
    if (aErrorCode == FeedUtils.kNewsBlogInvalidFeed)
      el.removeAttribute("collapsed");
    else
      el.setAttribute("collapsed", true);
  },

  clearStatusInfo: function()
  {
    this.mActionMode = null;
    document.getElementById("statusText").value = "";
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
        let url = validationQuery + feedLocation;

        win.focus();
        win.openContentTab(url, "tab", "^" + validationSite);
        FeedUtils.log.debug("checkValidation: query url - "+url);
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
        return this._feedWindow = subscriptionsWindow.gFeedSubscriptionsWindow;
      return null;
    },

    get currentSelectedItem() {
      return this.feedWindow ? this.feedWindow.mView.currentItem : null;
    },

    folderAdded: function(aFolder)
    {
      if (aFolder.server.type != "rss")
        return;
      FeedUtils.log.debug("folderAdded: folder - "+ aFolder.name);
      this.feedWindow.refreshSubscriptionView();
    },

    folderDeleted: function(aFolder)
    {
      if (aFolder.server.type != "rss")
        return;
      FeedUtils.log.debug("folderDeleted: folder - "+ aFolder.name);
      let curSelItem = this.currentSelectedItem;
      let feedWindow = this.feedWindow;
      if (curSelItem && curSelItem.container && curSelItem.folder == aFolder)
      {
        let curSelIndex = this.feedWindow.mView.selection.currentIndex;
        this.feedWindow.mView.removeItemAtIndex(curSelIndex);
      }
      else
        setTimeout(function() {
          feedWindow.refreshSubscriptionView();
        }, 20);
    },

    folderRenamed: function(aOrigFolder, aNewFolder)
    {
      if (aNewFolder.server.type != "rss")
        return;
      FeedUtils.log.debug("folderRenamed: old:new - "+
                          aOrigFolder.name+":"+aNewFolder.name);
      let curSelItem = this.currentSelectedItem;
      let feedWindow = this.feedWindow;
      setTimeout(function() {
        feedWindow.refreshSubscriptionView();
        if (curSelItem && curSelItem.container &&
            curSelItem.folder == aOrigFolder)
          feedWindow.selectFolder(aNewFolder, true, null, false);
      }, 20);
    },

    folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
    {
      if (aDestFolder.server.type != "rss")
        return;
      FeedUtils.log.debug("folderMoveCopyCompleted: move:src:dest - "+
                          aMove+":"+aSrcFolder.name+":"+aDestFolder.name);
      let curSelItem = this.currentSelectedItem;
      let feedWindow = this.feedWindow;
      if (aMove && aDestFolder.getFlag(Ci.nsMsgFolderFlags.Trash))
        return this.folderDeleted(aSrcFolder);

      setTimeout(function() {
        feedWindow.refreshSubscriptionView();
        if (curSelItem && curSelItem.container &&
            curSelItem.folder == aSrcFolder)
          feedWindow.selectFolder(aDestFolder);
      }, 20);
    }
  },

  /* *************************************************************** */
  /* OPML Functions                                                  */
  /* *************************************************************** */
  exportOPML: function()
  {
    // Account folder must be selected.
    let item = this.mView.currentItem;
    if (!item || !item.folder || !item.folder.isServer)
      return;

    this.mRSSServer = item.folder.server;
    let SPACES2 = "  ";
    let SPACES4 = "    ";

    if (this.mRSSServer.rootFolder.hasSubFolders)
    {
      let opmlDoc = document.implementation.createDocument("", "opml", null);
      let opmlRoot = opmlDoc.documentElement;
      opmlRoot.setAttribute("version","1.0");

      this.generatePPSpace(opmlRoot, SPACES2);

      let brandBundle = document.getElementById("bundle_brand");

      // Make the <head> element.
      let head = opmlDoc.createElement("head");
      this.generatePPSpace(head, SPACES4);
      let titleText = FeedUtils.strings.formatStringFromName(
                        "subscribe-OPMLExportFileDialogTitle",
                        [brandBundle.getString("brandShortName")], 1);
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
      this.generateOutline(this.mRSSServer.rootFolder, body, SPACES4.length);
      this.generatePPSpace(body, SPACES2);
      opmlRoot.appendChild(body);

      this.generatePPSpace(opmlRoot, "");

      let serial=new XMLSerializer();
      let omplFileName = FeedUtils.strings.formatStringFromName(
                           "subscribe-OPMLExportDefaultFileName",
                           [brandBundle.getString("brandShortName")], 1);
      let pTitle = FeedUtils.strings.GetStringFromName(
                     "subscribe-OPMLExportTitle");
      let rv = pickSaveAs(pTitle, "$all", omplFileName);
      if (rv.reason == PICK_CANCEL)
        return;
      else if (rv)
      {
        //debug("opml:\n"+serial.serializeToString(opmlDoc)+"\n");
        let file = new LocalFile(rv.file,
                                 MODE_WRONLY | MODE_CREATE | MODE_TRUNCATE);
        serial.serializeToStream(opmlDoc,file.outputStream, "utf-8");
        file.close();
      }
    }
  },

  generatePPSpace: function(aNode, indentString)
  {
    aNode.appendChild(aNode.ownerDocument.createTextNode("\n"));
    aNode.appendChild(aNode.ownerDocument.createTextNode(indentString));
  },

  generateOutline: function(baseFolder, parent, indentLevel)
  {
    let folderEnumerator = baseFolder.subFolders;

    // Pretty printing.
    let indentString = "";
    for (let i = 0; i < indentLevel; i++)
      indentString = indentString + " ";

    while (folderEnumerator.hasMoreElements())
    {
      let folder = folderEnumerator.getNext();
      if ((folder instanceof Ci.nsIMsgFolder) &&
          !folder.getFlag(Ci.nsMsgFolderFlags.Trash) &&
          !folder.getFlag(Ci.nsMsgFolderFlags.Virtual))
      {
        let outline;
        if (folder.hasSubFolders)
        {
          // Make a mostly empty outline element.
          outline = parent.ownerDocument.createElement("outline");
          outline.setAttribute("text", folder.prettiestName);
          // Recurse.
          this.generateOutline(folder, outline, indentLevel + 2);
          this.generatePPSpace(parent, indentString);
          this.generatePPSpace(outline, indentString);
          parent.appendChild(outline);
        }
        else
        {
          // Add outline elements with xmlUrls.
          let feeds = this.getFeedsInFolder(folder);
          for (let feed in feeds)
          {
            outline = this.opmlFeedToOutline(feeds[feed], parent.ownerDocument);
            this.generatePPSpace(parent, indentString);
            parent.appendChild(outline);
          }
        }
      }
    }
  },

  opmlFeedToOutline: function(aFeed, aDoc)
  {
    let outRv = aDoc.createElement("outline");
    outRv.setAttribute("title", aFeed.title);
    outRv.setAttribute("text", aFeed.title);
    outRv.setAttribute("type", "rss");
    outRv.setAttribute("version", "RSS");
    outRv.setAttribute("xmlUrl", aFeed.url);
    outRv.setAttribute("htmlUrl", aFeed.link);
    return outRv;
  },

  importOPML: function()
  {
    // Account folder must be selected.
    let item = this.mView.currentItem;
    if (!item || !item.folder || !item.folder.isServer)
      return;

    this.mRSSServer = item.folder.server;

    let pTitle = FeedUtils.strings.GetStringFromName(
                   "subscribe-OPMLImportTitle");
    let rv = pickOpen(pTitle, "$opml $xml $all");
    if(rv.reason == PICK_CANCEL)
      return;

    let opmlDom = null;
    let statusReport;
    let feedsAdded = 0;
    let stream = Cc["@mozilla.org/network/file-input-stream;1"].
                 createInstance(Ci.nsIFileInputStream);

    // Read in file as raw bytes, so Expat can do the decoding for us.
    try {
      stream.init(rv.file, MODE_RDONLY, PERM_IROTH, 0);
      let parser = new DOMParser();
      opmlDom = parser.parseFromStream(stream, null, stream.available(),
                                       "application/xml");
    }
    catch(e) {
      statusReport = FeedUtils.strings.GetStringFromName(
                       "subscribe-errorOpeningFile");
      Services.prompt.alert(window, null, statusReport);
      return;
    }
    finally {
      stream.close();
    }

    // Return if the user didn't give us an OPML file.
    if(!opmlDom || opmlDom.documentElement.tagName != "opml")
    {
      statusReport = FeedUtils.strings.formatStringFromName(
                       "subscribe-OPMLImportInvalidFile", [rv.file.leafName], 1);
      Services.prompt.alert(window, null, statusReport);
      return;
    }
    else
    {
      let outlines = opmlDom.getElementsByTagName("body")[0].
                             getElementsByTagName("outline");
      // Try to import records if there are any.
      for (let index = 0; index < outlines.length; index++)
      {
        if (this.importOutline(outlines[index]) == 1)
          feedsAdded++;
      }

      if (outlines.length > feedsAdded)
        statusReport = FeedUtils.strings.formatStringFromName(
                         "subscribe-OPMLImportTotalFeeds",
                         [feedsAdded, outlines.length], 2);
      else
        statusReport = FeedUtils.strings.formatStringFromName(
                         "subscribe-OPMLImportNewFeeds", [feedsAdded], 1);
    }

    this.clearStatusInfo();
    this.updateStatusItem("statusText", statusReport);

    // Add the new feeds to our view.
    if (feedsAdded)
      this.refreshSubscriptionView(this.mRSSServer.rootFolder);
  },

  importOutline: function(aOutline)
  {
    // XXX only dealing with flat OPML files for now.
    // We still need to add support for grouped files.
    let newFeedUrl = aOutline.getAttribute("xmlUrl") ||
                     aOutline.getAttribute("url");
    if (!newFeedUrl)
      return -1;

    // Silently skip feeds that are already subscribed.
    if (feedAlreadyExists(newFeedUrl, this.mRSSServer))
    {
      FeedUtils.log.debug("importOutline: already subscribed in account "+
                          this.mRSSServer.prettyName+", url - "+ newFeedUrl);
      return 0;
    }

    let feedName = aOutline.getAttribute("text") ||
                   aOutline.getAttribute("title") ||
                   aOutline.getAttribute("xmlUrl");

    let defaultQuickMode = this.mRSSServer.getBoolValue("quickMode");
    let feedProperties = { feedName     : feedName,
                           feedLocation : newFeedUrl,
                           server       : this.mRSSServer,
                           folderURI    : "",
                           quickMode    : defaultQuickMode};

    FeedUtils.log.debug("importOutline: importing feed: name, url - "+
                        feedName+", "+newFeedUrl);

    let feed = this.storeFeed(feedProperties);
    feed.title = feedProperties.feedName;
    if (aOutline.hasAttribute("htmlUrl"))
      feed.link = aOutline.getAttribute("htmlUrl");

    feed.createFolder();
    updateFolderFeedUrl(feed.folder, feed.url, false);

    // addFeed adds the feed we have validated and downloaded to
    // our datasource, it also flushes the subscription datasource.
    addFeed(feed.url, feed.name, feed.folder);
    // Feed correctly added.
    return 1;
  }
};
