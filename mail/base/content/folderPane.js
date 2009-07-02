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
 * The Original Code is mail folder tree code.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/folderUtils.jsm");

/**
 * This file contains the controls and functions for the folder pane.
 * The following definitions will be useful to know:
 *
 * gFolderTreeView - the controller for the folder tree.
 * ftvItem  - folder tree view item, representing a row in the tree
 * mode - folder view type, e.g., all folders, favorite folders, MRU...
 */

/**
 * This is our controller for the folder-tree. It includes our nsITreeView
 * implementation, as well as other control functions.
 */
let gFolderTreeView = {
  /**
   * Called when the window is initially loaded.  This function initializes the
   * folder-pane to the view last shown before the application was closed.
   */
  load: function ftv_load(aTree, aJSONFile) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    this._treeElement = aTree;

    let smartName = document.getElementById("bundle_messenger")
                            .getString("folderPaneHeader_smart");
    this.registerMode("smart", this._smartFoldersGenerator, smartName);
    // the folder pane can be used for other trees which may not have these elements.
    if (document.getElementById("folderpane_splitter"))
      document.getElementById("folderpane_splitter").collapsed = false;
    if (document.getElementById("folderPaneBox"))
      document.getElementById("folderPaneBox").collapsed = false;

    try {
      // Normally our tree takes care of keeping the last selected by itself.
      // However older versions of TB stored this in a preference, which we need
      // to migrate
      let prefB = Cc["@mozilla.org/preferences-service;1"]
                     .getService(Ci.nsIPrefBranch);
      let modeIndex = prefB.getIntPref("mail.ui.folderpane.view");
      this._mode = this._modeNames[modeIndex];
      prefB.deleteBranch("mail.ui.folderpane");
    } catch(ex) {
      // This is ok.  If we've already migrated we'll end up here
    }

    if (document.getElementById('folderpane-title')) {
      let string;
        if (this._mode in this._modeDisplayNames)
          string = this._modeDisplayNames;
        else {
          let key = "folderPaneHeader_" + this.mode;
          string = document.getElementById("bundle_messenger").getString(key);
        }
      document.getElementById('folderpane-title').value = string;
    }

    if (aJSONFile) {
      // Parse our persistent-open-state json file
      let file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
      file.append(aJSONFile);

      if (file.exists()) {
        let data = "";
        let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                         .createInstance(Ci.nsIFileInputStream);
        let sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                         .createInstance(Ci.nsIScriptableInputStream);
        fstream.init(file, -1, 0, 0);
        sstream.init(fstream);

        while (sstream.available())
          data += sstream.read(4096);

        sstream.close();
        fstream.close();
        let JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
        this._persistOpenMap = JSON.decode(data);
      }
    }

    // Load our data
    this._rebuild();
    // And actually draw the tree
    aTree.view = this;

    // Add this listener so that we can update the tree when things change
    let session = Cc["@mozilla.org/messenger/services/session;1"]
                     .getService(Ci.nsIMsgMailSession);
    session.AddFolderListener(this, Ci.nsIFolderListener.all);
  },

  /**
   * Called when the window is being torn down.  Here we undo everything we did
   * onload.  That means removing our listener and serializing our JSON.
   */
  unload: function ftv_unload(aJSONFile) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    // Remove our listener
    let session = Cc["@mozilla.org/messenger/services/session;1"]
                     .getService(Ci.nsIMsgMailSession);
    session.RemoveFolderListener(this);

    if (aJSONFile) {
      // Write out our json file...
      let JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
      let data = JSON.encode(this._persistOpenMap);
      let file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
      file.append("folderTree.json");
      let foStream = Cc["@mozilla.org/network/file-output-stream;1"]
                        .createInstance(Ci.nsIFileOutputStream);

      foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
      foStream.write(data, data.length);
      foStream.close();
    }
  },

  /**
   * Extensions can use this function to add a new mode to the folder pane.
   *
   * @param aCommonName  an internal name to identify this mode. Must be unique
   * @param aGenerator  a function that will return objects corresponding to the
   *                    the rows that will be displayed. See ftvItem for more
   *                    info on how these row-objects should look. See this
   *                    object's _mapGenerators for examples.
   * @param aDisplayName  a localized name for this mode
   */
  registerMode: function ftv_registerMode(aCommonName, aGenerator, aDisplayName) {
    this._modeNames.push(aCommonName);
    this._mapGenerators[aCommonName] = aGenerator;
    this._modeDisplayNames[aCommonName] = aDisplayName;
  },

  /**
   * Unregisters a previously registered mode. Since common-names must be unique
   * this is all that need be provided to unregister.
   * @param aCommonName  the common-name with which the mode was previously
   *                     registered
   */
  unregisterMode: function ftv_unregisterMode(aCommonName) {
    this._modeNames.splice(this._modeNames.indexOf(aCommonName), 1);
    delete this._mapGenerators[aCommonName];
    delete this._modeDisplayNames[aCommonName];
    if (this._mode == aCommonName)
      this.mode = "all";
  },

  /**
   * Called to move to the next/prev folder-mode in the list
   *
   * @param aForward  whether or not we should move forward in the list
   */
  cycleMode: function ftv_cycleMode(aForward) {
    let index = this._modeNames.indexOf(this.mode);
    let offset = aForward ? 1 : this._modeNames.length - 1;
    index = (index + offset) % this._modeNames.length;

    this.mode = this._modeNames[index];
  },

  /**
   * If the hidden pref is set, then double-clicking on a folder should open it
   *
   * @param event  the double-click event
   */
  onDoubleClick: function ftv_onDoubleClick(aEvent) {
    if (pref.getBoolPref("mailnews.reuse_thread_window2") ||
        aEvent.button != 0 || aEvent.originalTarget.localName == "twisty" ||
        aEvent.originalTarget.localName == "slider" ||
        aEvent.originalTarget.localName == "scrollbarbutton")
      return;

    let row = gFolderTreeView._treeElement.treeBoxObject.getRowAt(aEvent.clientX,
                                                                  aEvent.clientY);
    let folderItem = gFolderTreeView._rowMap[row];
    if (folderItem)
      folderItem.command();

    // Don't let the double-click toggle the open state of the folder here
    aEvent.stopPropagation();
  },

  getFolderAtCoords: function ftv_getFolderAtCoords(aX, aY) {
    let row = gFolderTreeView._treeElement.treeBoxObject.getRowAt(aX, aY);
    if (row in gFolderTreeView._rowMap)
      return gFolderTreeView._rowMap[row]._folder;
    return null;
  },

  /**
   * A string representation for the current display-mode.  Each value here must
   * correspond to an entry in _mapGenerators
   */
  _mode: null,
  get mode() {
    if (!this._mode) {
      this._mode = this._treeElement.getAttribute("mode");
      // this can happen when an extension is removed
      if (!(this._mode in this._mapGenerators))
        this._mode = "all";
    }
    return this._mode;
  },
  set mode(aMode) {
    this._mode = aMode;

    let string;
    if (this._mode in this._modeDisplayNames)
      string = this._modeDisplayNames[this._mode];
    else {
      let key = "folderPaneHeader_" + aMode;
      string = document.getElementById("bundle_messenger").getString(key);
    }
    document.getElementById('folderpane-title').value = string;

    this._treeElement.setAttribute("mode", aMode);
    this._rebuild();
  },

  /**
   * Selects a given nsIMsgFolder in the tree.  This function will also ensure
   * that the folder is actually being displayed (that is, that none of its
   * ancestors are collapsed.
   *
   * @param aFolder  the nsIMsgFolder to select
   */
  selectFolder: function ftv_selectFolder(aFolder) {
    // "this" inside the nested function refers to the function...
    // Also note that openIfNot is recursive.
    let tree = this;
    function openIfNot(aFolderToOpen) {
      let index = tree.getIndexOfFolder(aFolderToOpen);
      if (index) {
        if (!tree._rowMap[index].open)
          tree._toggleRow(index, false);
        return;
      }

      // not found, so open the parent
      if (aFolderToOpen.parent)
        openIfNot(aFolderToOpen.parent);

      // now our parent is open, so we can open ourselves
      index = tree.getIndexOfFolder(aFolderToOpen);
      if (index)
        tree._toggleRow(index, false);
    }
    if (aFolder.parent)
      openIfNot(aFolder.parent);
    this.selection.select(tree.getIndexOfFolder(aFolder));
  },

  /**
   * Returns the index of a folder in the current display.
   *
   * @param aFolder  the folder whose index should be returned.
   * @note If the folder is not in the display (perhaps because one of its
   *       anscetors is collapsed), this function returns null.
   */
  getIndexOfFolder: function ftv_getIndexOfFolder(aFolder) {
    for (let i in this._rowMap) {
      if (this._rowMap[i].id == aFolder.URI)
        return i;
    }
    return null;
  },

  /**
   * Returns an array of nsIMsgFolders corresponding to the current selection
   * in the tree
   */
  getSelectedFolders: function ftv_getSelectedFolders() {
    let folderArray = [];
    let selection = this._treeElement.view.selection;
    let rangeCount = selection.getRangeCount();
    for (let i = 0; i < rangeCount; i++) {
      let startIndex = {};
      let endIndex = {};
      selection.getRangeAt(i, startIndex, endIndex);
      for (let j = startIndex.value; j <= endIndex.value; j++) {
        folderArray.push(this._rowMap[j]._folder);
      }
    }
    return folderArray;
  },

  // ****************** Start of nsITreeView implementation **************** //

  get rowCount() {
    return this._rowMap.length;
  },

  /**
   * drag drop interfaces
   */
  canDrop: function ftv_canDrop(aRow, aOrientation) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    let targetFolder = gFolderTreeView._rowMap[aRow]._folder;
    if (!targetFolder)
      return false;
    let dt = this._currentTransfer;
    let types = dt.mozTypesAt(0);
    if (Array.indexOf(types, "text/x-moz-message") != -1) {
      if (aOrientation != Ci.nsITreeView.DROP_ON)
        return false;
      // Don't allow drop onto server itself.
      if (targetFolder.isServer)
        return false;
      // Don't allow drop into a folder that cannot take messages.
      if (!targetFolder.canFileMessages)
        return false;
      let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
      for (let i = 0; i < dt.mozItemCount; i++) {
        let msgHdr = messenger.msgHdrFromURI(dt.mozGetDataAt("text/x-moz-message", i));
        // Don't allow drop onto original folder.
        if (msgHdr.folder == targetFolder)
          return false;
      }
      return true;
    }
    else if (Array.indexOf(types, "text/x-moz-folder") != -1) {
      if (aOrientation != Ci.nsITreeView.DROP_ON)
        return false;
      // If cannot create subfolders then don't allow drop here.
      if (!targetFolder.canCreateSubfolders)
        return false;
      for (let i = 0; i < dt.mozItemCount; i++) {
        let folder = dt.mozGetDataAt("text/x-moz-folder", i)
                       .QueryInterface(Ci.nsIMsgFolder);
        // Don't allow to drop on itself.
        if (targetFolder == folder)
          return false;
        // Don't copy within same server.
        if ((folder.server == targetFolder.server) &&
             (dt.dropEffect == 'copy'))
          return false;
        // Don't allow immediate child to be dropped onto its parent.
        if (targetFolder == folder.parent)
          return false;
        // Don't allow dragging of virtual folders across accounts.
        if ((folder.flags & Ci.nsMsgFolderFlags.Virtual) &&
            folder.server != targetFolder.server)
          return false;
        // Don't allow parent to be dropped on its ancestors.
        if (folder.isAncestorOf(targetFolder))
          return false;
        // If there is a folder that can't be renamed, don't allow it to be
        // dropped if it is not to "Local Folders" or is to the same account.
        if (!folder.canRename && (targetFolder.server.type != "none" ||
                                  folder.server == targetFolder.server))
          return false;
      }
      return true;
    }
    else if (Array.indexOf(types, "text/x-moz-newsfolder") != -1) {
      // Don't allow dragging onto element.
      if (aOrientation == Ci.nsITreeView.DROP_ON)
        return false;
      // Don't allow drop onto server itself.
      if (targetFolder.isServer)
        return false;
      for (let i = 0; i < dt.mozItemCount; i++) {
        let folder = dt.mozGetDataAt("text/x-moz-newsfolder", i)
                       .QueryInterface(Ci.nsIMsgFolder);
        // Don't allow dragging newsgroup to other account.
        if (targetFolder.rootFolder != folder.rootFolder)
          return false;
        // Don't allow dragging newsgroup to before/after itself.
        if (targetFolder == folder)
          return false;
        // Don't allow dragging newsgroup to before item after or
        // after item before.
        let row = aRow + aOrientation;
        if (row in gFolderTreeView._rowMap &&
            (gFolderTreeView._rowMap[row]._folder == folder))
          return false;
      }
      return true;
    }
    // allow subscribing to feeds by dragging an url to a feed account
    else if (Array.indexOf(types, "text/x-moz-url") != -1 &&
             targetFolder.server.type == "rss")
      return true;
    else if (Array.indexOf(types, "application/x-moz-file") != -1) {
      if (aOrientation != Ci.nsITreeView.DROP_ON)
        return false;
      // Don't allow drop onto server itself.
      if (targetFolder.isServer)
        return false;
      // Don't allow drop into a folder that cannot take messages.
      if (!targetFolder.canFileMessages)
        return false;
      for (let i = 0; i < dt.mozItemCount; i++) {
        let extFile = dt.mozGetDataAt("application/x-moz-file", i)
                        .QueryInterface(Ci.nsILocalFile);
        return extFile.isFile();
      }
    }
    return false;
  },
  drop: function ftv_drop(aRow, aOrientation) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    let targetFolder = gFolderTreeView._rowMap[aRow]._folder;

    let dt = this._currentTransfer;
    let count = dt.mozItemCount;
    let cs = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                .getService(Ci.nsIMsgCopyService);

    // we only support drag of a single flavor at a time.
    let types = dt.mozTypesAt(0);
    if (Array.indexOf(types, "text/x-moz-folder") != -1) {
      for (let i = 0; i < count; i++) {
        let folders = new Array;
        folders.push(dt.mozGetDataAt("text/x-moz-folder", i)
                       .QueryInterface(Ci.nsIMsgFolder));
        let array = toXPCOMArray(folders, Ci.nsIMutableArray);
        cs.CopyFolders(array, targetFolder,
                      (folders[0].server == targetFolder.server), null,
                       msgWindow);
      }
    }
    else if (Array.indexOf(types, "text/x-moz-newsfolder") != -1) {
      // Start by getting folders into order.
      let folders = new Array;
      for (let i = 0; i < count; i++) {
        let folder = dt.mozGetDataAt("text/x-moz-newsfolder", i)
                       .QueryInterface(Ci.nsIMsgFolder);
        folders[this.getIndexOfFolder(folder)] = folder;
      }
      let newsFolder = targetFolder.rootFolder
                                   .QueryInterface(Ci.nsIMsgNewsFolder);
      // When moving down, want to insert first one last.
      // When moving up, want to insert first one first.
      let i = (aOrientation == 1) ? folders.length - 1 : 0;
      while (i >= 0 && i < folders.length) {
        let folder = folders[i];
        if (folder) {
          newsFolder.moveFolder(folder, targetFolder, aOrientation);
          this.selection.toggleSelect(this.getIndexOfFolder(folder));
        }
        i -= aOrientation;
      }
    }
    else if (Array.indexOf(types, "text/x-moz-message") != -1) {
      let array = Cc["@mozilla.org/array;1"]
                    .createInstance(Ci.nsIMutableArray);
      let sourceFolder;
      let messenger = Cc["@mozilla.org/messenger;1"].createInstance(Ci.nsIMessenger);
      for (let i = 0; i < count; i++) {
        let msgHdr = messenger.msgHdrFromURI(dt.mozGetDataAt("text/x-moz-message", i));
        if (!i)
          sourceFolder = msgHdr.folder;
        array.appendElement(msgHdr, false);
      }
      let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefService).getBranch("mail.");
      let isMove = Cc["@mozilla.org/widget/dragservice;1"]
                      .getService(Ci.nsIDragService).getCurrentSession()
                      .dragAction == Ci.nsIDragService.DRAGDROP_ACTION_MOVE;

      prefBranch.setCharPref("last_msg_movecopy_target_uri", targetFolder.URI);
      prefBranch.setBoolPref("last_msg_movecopy_was_move", isMove);
      // ### ugh, so this won't work with cross-folder views. We would
      // really need to partition the messages by folder.
      cs.CopyMessages(sourceFolder, array, targetFolder, isMove, null,
                        msgWindow, true);
    }
    else if (Array.indexOf(types, "application/x-moz-file") != -1) {
      for (let i = 0; i < count; i++) {
        let extFile = dt.mozGetDataAt("application/x-moz-file", i)
                        .QueryInterface(Ci.nsILocalFile);
        if (extFile.isFile()) {
          let len = extFile.leafName.length;
          if (len > 4 && extFile.leafName.substr(len - 4).toLowerCase() == ".eml")
            cs.CopyFileMessage(extFile, targetFolder, null, false, 1, "", null, msgWindow);
        }
      }
    }
    else if (Array.indexOf(types, "text/x-moz-url") != -1) {
      // This is a potential rss feed to subscribe to
      // and there's only one, so just get the 0th element.
      let url = dt.mozGetDataAt("text/x-moz-url", 0);
      let uri = Cc["@mozilla.org/network/io-service;1"]
                   .getService(Ci.nsIIOService).newURI(url, null, null);
      if (!(uri.schemeIs("http") || uri.schemeIs("https")) ||
             targetFolder.server.type != "rss")
        return;

      Cc["@mozilla.org/newsblog-feed-downloader;1"]
         .getService(Ci.nsINewsBlogFeedDownloader)
         .subscribeToFeed(url, targetFolder, msgWindow);
    }
  },

  _onDragStart: function ftv_dragStart(aEvent) {
    // Ugh, this is ugly but necessary
    let view = gFolderTreeView;

    if (aEvent.originalTarget.localName != "treechildren")
      return;

    let folders = view.getSelectedFolders();
    folders = folders.filter(function(f) { return !f.isServer; });
    for (let i in folders) {
      let flavor = folders[i].server.type == "nntp" ? "text/x-moz-newsfolder" :
                                                      "text/x-moz-folder";
      aEvent.dataTransfer.mozSetDataAt(flavor, folders[i], i);
    }
    aEvent.dataTransfer.effectAllowed = "copyMove";
    aEvent.dataTransfer.addElement(aEvent.originalTarget);
    return;
  },

  _onDragOver: function ftv_onDragOver(aEvent) {
    this._currentTransfer = aEvent.dataTransfer;
  },

  /**
   * CSS files will cue off of these.  Note that we reach into the rowMap's
   * items so that custom data-displays can define their own properties
   */
  getCellProperties: function ftv_getCellProperties(aRow, aCol, aProps) {
    this._rowMap[aRow].getProperties(aProps, aCol);
  },

  /**
   * The actual text to display in the tree
   */
  getCellText: function ftv_getCellText(aRow, aCol) {
    if (aCol.id == "folderNameCol")
      return this._rowMap[aRow].text;
  },

  /**
   * The ftvItems take care of assigning this when building children lists
   */
  getLevel: function ftv_getLevel(aIndex) {
    return this._rowMap[aIndex].level;
  },

  /**
   * This is easy since the ftv items assigned the _parent property when making
   * the child lists
   */
  getParentIndex: function ftv_getParentIndex(aIndex) {
    for (let i = 0; i < this._rowMap.length; i++) {
      if (this._rowMap[i] == this._rowMap[aIndex]._parent)
        return i;
    }
    return -1;
  },

  /**
   * This is duplicative for our normal ftv views, but custom data-displays may
   * want to do something special here
   */
  getRowProperties: function ftv_getRowProperties(aIndex, aProps) {
    this._rowMap[aIndex].getProperties(aProps);
  },

  /**
   * Check whether there are any more rows with our level before the next row
   * at our parent's level
   */
  hasNextSibling: function ftv_hasNextSibling(aIndex, aNextIndex) {
    var currentLevel = this._rowMap[aIndex].level;
    for (var i = aNextIndex + 1; i < this._rowMap.length; i++) {
      if (this._rowMap[i].level == currentLevel)
        return true;
      if (this._rowMap[i].level < currentLevel)
        return false;
    }
    return false;
  },

  /**
   * All folders are containers, so we can drag drop messages to them.
   */
  isContainer: function ftv_isContainer(aIndex) {
    return true;
  },

  isContainerEmpty: function ftv_isContainerEmpty(aIndex) {
    // If the folder has no children, the container is empty.
    return !this._rowMap[aIndex].children.length;
  },

  /**
   * Just look at the ftvItem here
   */
  isContainerOpen: function ftv_isContainerOpen(aIndex) {
    return this._rowMap[aIndex].open;
  },
  isEditable: function ftv_isEditable(aRow, aCol) {
    // We don't support editing rows in the tree yet.  We may want to later as
    // an easier way to rename folders.
    return false;
  },
  isSeparator: function ftv_isSeparator(aIndex) {
    // There are no separators in our trees
    return false;
  },
  isSorted: function ftv_isSorted() {
    // We do our own customized sorting
    return false;
  },
  setTree: function ftv_setTree(aTree) {
    this._tree = aTree;
  },

  /**
   * Opens or closes a folder with children.  The logic here is a bit hairy, so
   * be very careful about changing anything.
   */
  toggleOpenState: function ftv_toggleOpenState(aIndex) {
    this._toggleRow(aIndex, true);
  },

  _toggleRow: function toggleRow(aIndex, aExpandServer)
  {
    // Ok, this is a bit tricky.
    this._rowMap[aIndex].open = !this._rowMap[aIndex].open;
    if (!this._rowMap[aIndex].open) {
      // We're closing the current container.  Remove the children

      // Note that we can't simply splice out children.length, because some of
      // them might have children too.  Find out how many items we're actually
      // going to splice
      let count = 0;
      let i = aIndex + 1;
      let row = this._rowMap[i];
      while (row && row.level > this._rowMap[aIndex].level) {
        count++;
        row = this._rowMap[++i];
      }
      this._rowMap.splice(aIndex + 1, count);

      // Remove us from the persist map
      let index = this._persistOpenMap[this.mode]
                      .indexOf(this._rowMap[aIndex].id);
      if (index != -1)
        this._persistOpenMap[this.mode].splice(index, 1);

      // Notify the tree of changes
      if (this._tree) {
        this._tree.rowCountChanged(aIndex + 1, (-1) * count);
        this._tree.invalidateRow(aIndex);
      }
    } else {
      // We're opening the container.  Add the children to our map

      // Note that these children may have been open when we were last closed,
      // and if they are, we also have to add those grandchildren to the map
      let tree = this;
      let oldCount = this._rowMap.length;
      function recursivelyAddToMap(aChild, aNewIndex) {
        // When we add sub-children, we're going to need to increase our index
        // for the next add item at our own level
        let count = 0;
        if (aChild.children.length && aChild.open) {
          for (let [i, child] in Iterator(tree._rowMap[aNewIndex].children)) {
            count++;
            var index = Number(aNewIndex) + Number(i) + 1;
            tree._rowMap.splice(index, 0, child);

            let kidsAdded = recursivelyAddToMap(child, index);
            count += kidsAdded;
            // Somehow the aNewIndex turns into a string without this
            aNewIndex = Number(aNewIndex) + kidsAdded;
          }
        }
        return count;
      }
      recursivelyAddToMap(this._rowMap[aIndex], aIndex);

      // Add this folder to the persist map
      if (!this._persistOpenMap[this.mode])
        this._persistOpenMap[this.mode] = [];
      let id = this._rowMap[aIndex].id;
      if (this._persistOpenMap[this.mode].indexOf(id) == -1)
        this._persistOpenMap[this.mode].push(id);

      // Notify the tree of changes
      if (this._tree)
        this._tree.rowCountChanged(aIndex + 1, this._rowMap.length - oldCount);
      // if this was a server that was expanded, let it update its counts
      let folder = this._rowMap[aIndex]._folder;
      if (aExpandServer) {
        if (folder.isServer)
          folder.server.performExpand(msgWindow);
        else if (folder instanceof Components.interfaces.nsIMsgImapMailFolder)
          folder.performExpand(msgWindow);
      }
    }
  },

  _allFoldersWithFlag: function ftv_getAllFolders(accounts, aFolderFlag, deep)
  {
    let nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    let folders = [];
    for each (acct in accounts) {
     let folderWithFlag = acct.incomingServer.rootFolder.getFolderWithFlags(aFolderFlag);
     if (folderWithFlag) {
       folders.push(folderWithFlag);
      // add sub-folders of Sent and Archive to the result.
      if (deep && (aFolderFlag & (nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Archive)))
        this.addSubFolders(folderWithFlag, folders);
      }
    }
    return folders;
  },

  _smartFoldersGenerator: function ftv_smartFoldersGenerator(ftv)
  {
    let map = [];
    let acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                    .getService(Components.interfaces.nsIMsgAccountManager);
    let smartServer;
    try {
      smartServer = acctMgr.FindServer("nobody", "smart mailboxes", "none");
    } catch (ex) {
      smartServer = acctMgr.createIncomingServer("nobody", "smart mailboxes", "none");
      // We don't want the "smart" server/account leaking out into the ui in
      // other places, so set it as hidden.
      smartServer.hidden = true;
      let account = acctMgr.createAccount();
      account.incomingServer = smartServer;
    }
    smartServer.prettyName = document.getElementById("bundle_messenger")
                             .getString("smartAccountName");

    let accounts = gFolderTreeView._sortedAccounts();

    let smartRoot = smartServer.rootFolder;
    let nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    let smartChildren = new Array;
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Inbox, "Inbox");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Drafts, "Drafts");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.SentMail, "Sent");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Trash, "Trash");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Templates, "Templates");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Archive, "Archives");
    gFolderTreeView._addSmartFoldersForFlag(smartChildren, accounts, smartRoot,
                                            nsMsgFolderFlags.Junk, "Junk");

    sortFolderItems(smartChildren);
    for each (smartChild in smartChildren)
      map.push(smartChild);
      
    for each (acct in accounts) {
      // Bug 466311 Sometimes this can throw file not found, we're unsure
      // why, but catch it and log the fact.
      try {
        acct.incomingServer.rootFolder.subFolders;
      }
      catch (ex) {
        Components.classes["@mozilla.org/consoleservice;1"]
                  .getService(Components.interfaces.nsIConsoleService)
                  .logStringMessage("Discovering folders for account failed with exception: " + ex);
      }
    }
    for each (acct in accounts)
      map.push(new ftv_SmartItem(acct.incomingServer.rootFolder));

    return map;
  },

  _addSmartFoldersForFlag: function ftv_addSmartFoldersForFlag(map, accounts, smartRootFolder,
                                                               flag, folderName)
  {
    let smartFolder;
    try {
      let folderUri = smartRootFolder.URI + "/" + folderName;
      smartFolder = smartRootFolder.getChildWithURI(folderUri, false, true);
    } catch (ex) {
        smartFolder = null;
    };
    if (!smartFolder) {
      let searchFolders = gFolderTreeView._allFoldersWithFlag(accounts, flag, true);
      let searchFolderURIs = "";
      for each (searchFolder in searchFolders) {
        if (searchFolderURIs.length)
          searchFolderURIs += '|';
        searchFolderURIs +=  searchFolder.URI;
      }
      if (!searchFolderURIs.length)
        return;
      smartFolder = gFolderTreeView._createVFFolder(folderName, smartRootFolder,
                                                    searchFolderURIs, flag);
    }

    let smartFolderItem = new ftvItem(smartFolder);
    smartFolderItem._level = 0;
    map.push(smartFolderItem);
    let subFolders = gFolderTreeView._allFoldersWithFlag(accounts, flag, false);
    // now add the actual inboxes as sub-folders of the saved search.
    // By setting _children directly, we bypass the normal calculation
    // of subfolders.
    smartFolderItem._children = [new ftvItem(f) for each (f in subFolders)];

    // sortFolderItems(this._children);
    // Each child is a level one below the smartFolder
    for each (let child in smartFolderItem._children) {
      child._level = smartFolderItem._level + 1;
      child._parent = smartFolderItem;
      // don't show sub-folders of the inbox, but I think Archives/Sent, etc
      // should have the sub-folders.
      if (flag & Components.interfaces.nsMsgFolderFlags.Inbox)
        child.__defineGetter__("children", function() []);
      child.useServerNameOnly = true;
      child.getProperties = function (aProps) {
        // From folderUtils.jsm
        setPropertyAtoms(this._folder, aProps);
        aProps.AppendElement(Components.classes["@mozilla.org/atom-service;1"]
                            .getService(Components.interfaces.nsIAtomService)
                            .getAtom("specialFolder-Smart"));
       };
     }
  },
  _createVFFolder: function ftv_createVFFolder(newName, parentFolder,
                                               searchFolderURIs, folderFlag)
  {
    let newFolder;
    try {
      newFolder = parentFolder.addSubfolder(newName);
      newFolder.setFlag(Components.interfaces.nsMsgFolderFlags.Virtual);
      let vfdb = newFolder.msgDatabase;
      let dbFolderInfo = vfdb.dBFolderInfo;
      // set the view string as a property of the db folder info
      // set the original folder name as well.
      dbFolderInfo.setCharProperty("searchStr", "ALL");
      dbFolderInfo.setCharProperty("searchFolderUri", searchFolderURIs);
      dbFolderInfo.setUint32Property("searchFolderFlag", folderFlag);
      dbFolderInfo.setBooleanProperty("searchOnline", true);
      vfdb.summaryValid = true;
      vfdb.Close(true);
      parentFolder.NotifyItemAdded(newFolder);
      Components.classes["@mozilla.org/messenger/account-manager;1"]
        .getService(Components.interfaces.nsIMsgAccountManager)
        .saveVirtualFolders();
    }
    catch(e) {
       throw(e);
       dump ("Exception : creating virtual folder \n");
    }
    return newFolder;
  },

  // We don't implement any of these at the moment
  performAction: function ftv_performAction(aAction) {},
  performActionOnCell: function ftv_performActionOnCell(aAction, aRow, aCol) {},
  performActionOnRow: function ftv_performActionOnRow(aAction, aRow) {},
  selectionChanged: function ftv_selectionChanged() {},
  setCellText: function ftv_setCellText(aRow, aCol, aValue) {},
  setCellValue: function ftv_setCellValue(aRow, aCol, aValue) {},
  getCellValue: function ftv_getCellValue(aRow, aCol) {},
  getColumnProperties: function ftv_getColumnProperties(aCol, aProps) {},
  getImageSrc: function ftv_getImageSrc(aRow, aCol) {},
  getProgressMode: function ftv_getProgressMode(aRow, aCol) {},
  cycleCell: function ftv_cycleCell(aRow, aCol) {},
  cycleHeader: function ftv_cycleHeader(aCol) {},

  // ****************** End of nsITreeView implementation **************** //

  //
  // WARNING: Everything below this point is considered private.  Touch at your
  //          own risk.

  /**
   * This is an array of all possible modes for the folder tree. You should not
   * modify this directly, but rather use registerMode.
   */
  _modeNames: ["all", "unread", "favorite", "recent"],
  _modeDisplayNames: {},

  /**
   * This is a javaascript map of which folders we had open, so that we can
   * persist their state over-time.  It is designed to be used as a JSON object.
   */
  _persistOpenMap: {},

  _restoreOpenStates: function ftv__persistOpenStates() {
    if (!(this.mode in this._persistOpenMap))
      return;

    let curLevel = 0;
    let tree = this;
    function openLevel() {
      let goOn = false;
      // We can't use a js iterator because we're changing the array as we go.
      // So fallback on old trick of going backwards from the end, which
      // doesn't care when you add things at the end.
      for (let i = tree._rowMap.length - 1; i >= 0; i--) {
        let row = tree._rowMap[i];
        if (row.level != curLevel)
          continue;

        let map = tree._persistOpenMap[tree.mode];
        if (map && map.indexOf(row.id) != -1) {
          tree._toggleRow(i, false);
          goOn = true;
        }
      }

      // If we opened up any new kids, we need to check their level as well.
      curLevel++;
      if (goOn)
        openLevel();
    }
    openLevel();
  },

  _tree: null,

  /**
   * An array of ftvItems, where each item corresponds to a row in the tree
   */
  _rowMap: null,

  /**
   * Completely discards the current tree and rebuilds it based on current
   * settings
   */
  _rebuild: function ftv__rebuild() {
    let oldCount = this._rowMap ? this._rowMap.length : null;
    this._rowMap = this._mapGenerators[this.mode](this);
    let evt = document.createEvent("Events");
    evt.initEvent("mapRebuild", true, false);
    this._treeElement.dispatchEvent(evt);

    if (this._tree)
    {
      if (oldCount !== null)
          this._tree.rowCountChanged(0, this._rowMap.length - oldCount);
      this._tree.invalidate();
    }
    this._restoreOpenStates();
  },

  _sortedAccounts: function ftv_getSortedAccounts()
  {
      const Cc = Components.classes;
      const Ci = Components.interfaces;
      let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                       .getService(Ci.nsIMsgAccountManager);
      let accounts = [a for each
                      (a in fixIterator(acctMgr.accounts, Ci.nsIMsgAccount))];
      // Bug 41133 workaround
      accounts = accounts.filter(function fix(a) { return a.incomingServer; });

      // Don't show deferred pop accounts
      accounts = accounts.filter(function isNotDeferred(a) {
        let server = a.incomingServer;
        return !(server instanceof Ci.nsIPop3IncomingServer &&
                 server.deferredToAccount);
      });

      function sortAccounts(a, b) {
        if (a.key == acctMgr.defaultAccount.key)
          return -1;
        if (b.key == acctMgr.defaultAccount.key)
          return 1;
        let aIsNews = a.incomingServer.type == "nntp";
        let bIsNews = b.incomingServer.type == "nntp";
        if (aIsNews && !bIsNews)
          return 1;
        if (bIsNews && !aIsNews)
          return -1;

        let aIsLocal = a.incomingServer.type == "none";
        let bIsLocal = b.incomingServer.type == "none";
        if (aIsLocal && !bIsLocal)
          return 1;
        if (bIsLocal && !aIsLocal)
          return -1;
        return 0;
      }
      accounts.sort(sortAccounts);
      return accounts;
  },
  /**
   * This object holds the functions that actually build the tree for each mode.
   * When the tree must be rebuilt, we call the function here for the current
   * mode.  That function should return an array of ftvItems that should be
   * displayed.
   *
   * Extensions should feel free to plug in here!
   */
  _mapGenerators: {

    /**
     * The all mode returns all folders, arranged in a hierarchy
     */
    all: function ftv__mg_all() {
      let accounts = gFolderTreeView._sortedAccounts();
      // force each root folder to do its local subfolder discovery.
      for each (acct in accounts) {
        // Bug 466311 Sometimes this can throw file not found, we're unsure
        // why, but catch it and log the fact.
        try {
          acct.incomingServer.rootFolder.subFolders;
        }
        catch (ex) {
          Components.classes["@mozilla.org/consoleservice;1"]
                    .getService(Components.interfaces.nsIConsoleService)
                    .logStringMessage("Discovering folders for account failed with exception: " + ex);
        }
      }

      return [new ftvItem(acct.incomingServer.rootFolder)
              for each (acct in accounts)];
    },

    /**
     * The unread mode returns all folders that are not root-folders and that
     * have unread items.  Also always keep the currently selected folder
     * so it doesn't disappear under the user.
     */
    unread: function ftv__mg_unread(ftv) {
      let map = [];
      let currentFolder = gFolderTreeView.getSelectedFolders()[0];
      const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
      const outFolderFlagMask = nsMsgFolderFlags.SentMail |
        nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue |
        nsMsgFolderFlags.Templates;
      for each (let folder in ftv._enumerateFolders) {
        if (!IsSpecialFolder(folder, outFolderFlagMask, true) &&
            (!folder.isServer && folder.getNumUnread(false) > 0) ||
            (folder == currentFolder))
          map.push(new ftvItem(folder));
      }

      // There are no children in this view!
      for each (let folder in map) {
        folder.__defineGetter__("children", function() []);
        folder.addServerName = true;
      }
      sortFolderItems(map);
      return map;
    },

    /**
     * The favorites mode returns all folders whose flags are set to include
     * the favorite flag
     */
    favorite: function ftv__mg_favorite(ftv) {
      let faves = [];
      for each (let folder in ftv._enumerateFolders) {
        if (folder.flags & Components.interfaces.nsMsgFolderFlags.Favorite)
          faves.push(new ftvItem(folder));
      }

      // There are no children in this view!
      // And we want to display the account name to distinguish folders w/
      // the same name.
      for each (let folder in faves) {
        folder.__defineGetter__("children", function() []);
        folder.addServerName = true;
      }
      sortFolderItems(faves);
      return faves;
    },

    /**
     * The recent mode is a flat view of the 15 most recently used folders
     */
    recent: function ftv__mg_recent(ftv) {
      const MAXRECENT = 15;

      /**
       * Sorts our folders by their recent-times.
       */
      function sorter(a, b) {
        return Number(a.getStringProperty("MRUTime")) <
          Number(b.getStringProperty("MRUTime"));
      }

      /**
       * This function will add a folder to the recentFolders array if it
       * is among the 15 most recent.  If we exceed 15 folders, it will pop
       * the oldest folder, ensuring that we end up with the right number
       *
       * @param aFolder the folder to check
       */
      let recentFolders = [];
      let oldestTime = 0;
      function addIfRecent(aFolder) {
      let time;
        try {
          time = Number(aFolder.getStringProperty("MRUTime")) || 0;
        } catch (ex) {return;}
        if (time <= oldestTime)
          return;

        if (recentFolders.length == MAXRECENT) {
          recentFolders.sort(sorter);
          recentFolders.pop();
          let oldestFolder = recentFolders[recentFolders.length - 1];
          oldestTime = Number(oldestFolder.getStringProperty("MRUTime"));
        }
        recentFolders.push(aFolder);
      }

      for each (let folder in ftv._enumerateFolders)
        addIfRecent(folder);

      recentFolders.sort(sorter);

      let items = [new ftvItem(f) for each (f in recentFolders)];

      // There are no children in this view!
      // And we want to display the account name to distinguish folders w/
      // the same name.
      for each (let folder in items) {
        folder.__defineGetter__("children", function() []);
        folder.addServerName = true;
      }

      return items;
    }
  },

  /**
   * This is a helper attribute that simply returns a flat list of all folders
   */
  get _enumerateFolders() {
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    let folders = [];

    let acctMgr = Cc["@mozilla.org/messenger/account-manager;1"]
                     .getService(Ci.nsIMsgAccountManager);
    for each (let acct in fixIterator(acctMgr.accounts, Ci.nsIMsgAccount)) {
      // Skip deferred accounts
      if (acct.incomingServer instanceof Ci.nsIPop3IncomingServer &&
          acct.incomingServer.deferredToAccount)
        continue;
      folders.push(acct.incomingServer.rootFolder);
      this.addSubFolders(acct.incomingServer.rootFolder, folders);
    }
    return folders;
  },

  /**
   * This is a recursive function to add all subfolders to the array. It
   * assumes that the passed in folder itself has already been added.
   *
   * @param aFolder  the folder whose subfolders should be added
   * @param folders  the array to add the folders to.
   */
  addSubFolders : function ftv_addSubFolders (folder, folders) {
    for each (let f in fixIterator(folder.subFolders, Components.interfaces.nsIMsgFolder)) {
      folders.push(f);
      this.addSubFolders(f, folders);
    }
  },

  /**
   * This is our implementation of nsIMsgFolderListener to watch for changes
   */
  OnItemAdded: function ftl_add(aParentItem, aItem) {
    // Only rebuild if we didn't know about the folder
    if (!(aItem instanceof Components.interfaces.nsIMsgFolder) ||
        this.getIndexOfFolder(aItem))
      return;

    // if no parent, this is an account, so let's rebuild.
    if (!aParentItem) {
      if (!aItem.server.hidden) // ignore hidden server items
        this._rebuild();
      return;
    }
    let parentIndex = this.getIndexOfFolder(aParentItem);
    let parent = this._rowMap[parentIndex];
    if (!parent)
       return;

    // Getting these children might have triggered our parent to build its
    // array just now, in which case the added item will already exist
    let children = parent.children;
    var newChild;
    for each (let child in children) {
      if (child._folder == aItem) {
        newChild = child;
        break;
      }
    }
    if (!newChild) {
      newChild = new ftvItem(aItem);
      parent.children.push(newChild);
      newChild._level = parent._level + 1;
      newChild._parent = parent;
      sortFolderItems(parent._children);
    }

    // If the parent is open, add the new child into the folder pane. Otherwise,
    // just invalidate the parent row.
    if (parent.open) {
      let newChildIndex;
      let newChildNum = parent._children.indexOf(newChild);
      // only child - go right after our parent
      if (newChildNum == 0)
      {
        newChildIndex = Number(parentIndex) + 1
      }
      // if we're not the last child, insert ourselves before the next child.
      else if (newChildNum < parent._children.length - 1)
      {
        newChildIndex = this.getIndexOfFolder(parent._children[Number(newChildNum) + 1]._folder);
      }
      // otherwise, go after the last child
      else
      {
        let lastChild = parent._children[newChildNum - 1];
        let lastChildIndex = this.getIndexOfFolder(lastChild._folder);
        newChildIndex = Number(lastChildIndex) + 1;
        while (newChildIndex < this.rowCount &&
               this._rowMap[newChildIndex].level > this._rowMap[lastChildIndex].level)
          newChildIndex++;
      }
      this._rowMap.splice(newChildIndex, 0, newChild);
      this._tree.rowCountChanged(newChildIndex, 1);
    } else {
      this._tree.invalidateRow(parentIndex);
    }
  },

  OnItemRemoved: function ftl_remove(aRDFParentItem, aItem) {
    if (!(aItem instanceof Components.interfaces.nsIMsgFolder))
      return;

    let persistMapIndex = this._persistOpenMap[this.mode].indexOf(aItem.URI);
    if (persistMapIndex != -1)
      this._persistOpenMap[this.mode].splice(persistMapIndex, 1);

    let index = this.getIndexOfFolder(aItem);
    if (!index)
      return;
    // forget our parent's children; they'll get rebuilt
    if (aRDFParentItem)
      this._rowMap[index]._parent._children = null;
    let kidCount = 1;
    let walker = Number(index) + 1;
    while (walker < this.rowCount &&
           this._rowMap[walker].level > this._rowMap[index].level) {
      walker++;
      kidCount++;
    }
    this._rowMap.splice(index, kidCount);
    this._tree.rowCountChanged(index, -1 * kidCount);
    this._tree.invalidateRow(index);
  },

  OnItemPropertyChanged: function(aItem, aProperty, aOld, aNew) {},
  OnItemIntPropertyChanged: function(aItem, aProperty, aOld, aNew) {
    // we want to rebuild only if we're in unread mode, and we have a
    // newly unread folder, and we didn't already have the folder.
    if (this._mode == "unread" &&
        aProperty == "TotalUnreadMessages" && aOld == 0 &&
        !this.getIndexOfFolder(aItem)) {
      this._rebuild();
      return;
    }

    if (aItem instanceof Components.interfaces.nsIMsgFolder)
    {
      let index = this.getIndexOfFolder(aItem);
      if (index)
        this._tree.invalidateRow(index);
    }
  },

  OnItemBoolPropertyChanged: function(aItem, aProperty, aOld, aNew) {},
  OnItemUnicharPropertyChanged: function(aItem, aProperty, aOld, aNew) {},
  OnItemPropertyFlagChanged: function(aItem, aProperty, aOld, aNew) {},
  OnItemEvent: function(aFolder, aEvent) {
    let index = this.getIndexOfFolder(aFolder);
    if (index)
      this._tree.invalidateRow(index);
  }
};

/**
 * The ftvItem object represents a single row in the tree view. Because I'm lazy
 * I'm just going to define the expected interface here.  You are free to return
 * an alternative object in a _mapGenerator, provided that it matches this
 * interface:
 *
 * id (attribute) - a unique string for this object. Must persist over sessions
 * text (attribute) - the text to display in the tree
 * level (attribute) - the level in the tree to display the item at
 * open (rw, attribute) - whether or not this container is open
 * children (attribute) - an array of child items also conforming to this spec
 * getProperties (function) - a call from getRowProperties or getCellProperties
 *                            for this item will be passed into this function
 * command (function) - this function will be called when the item is double-
 *                      clicked
 */
function ftvItem(aFolder) {
  this._folder = aFolder;
  this._level = 0;
}

ftvItem.prototype = {
  open: false,
  addServerName: false,
  useServerNameOnly: false,

  get id() {
    return this._folder.URI;
  },
  get text() {
    let text;
    if (this.useServerNameOnly) {
      text = this._folder.server.prettyName;
    }
    else {
      text = this._folder.abbreviatedName;
      if (this.addServerName)
        text += " - " + this._folder.server.prettyName;
    }
    // Yeah, we hard-code this, but so did the old code...
    let unread = this._folder.getNumUnread(false);
    if (unread > 0)
      text += " (" + unread + ")";
    return text;
  },

  get level() {
    return this._level;
  },

  getProperties: function ftvItem_getProperties(aProps) {
    // From folderUtils.jsm
    setPropertyAtoms(this._folder, aProps);
  },

  command: function fti_command() {
    MsgOpenNewWindowForFolder(this._folder.URI, -1 /* key */);
  },

  _children: null,
  get children() {
    const Ci = Components.interfaces;
    // We're caching our child list to save perf.
    if (!this._children) {
      let iter = fixIterator(this._folder.subFolders, Ci.nsIMsgFolder);
      this._children = [new ftvItem(f) for each (f in iter)];

      sortFolderItems(this._children);
      // Each child is a level one below us
      for each (let child in this._children) {
        child._level = this._level + 1;
        child._parent = this;
      }
    }
    return this._children;
  }
};

/**
 * This handles the invocation of most commmands dealing with folders, based off
 * of the current selection, or a passed in folder.
 */
let gFolderTreeController = {
  /**
   * Opens the dialog to create a new sub-folder, and creates it if the user
   * accepts
   *
   * @param aParent (optional)  the parent for the new subfolder
   */
  newFolder: function ftc_newFolder(aParent) {
    let folder = aParent || gFolderTreeView.getSelectedFolders()[0];

    // Make sure we actually can create subfolders
    if (!folder.canCreateSubfolders) {
      // Check if we can create them at the root
      let rootMsgFolder = folder.server.rootMsgFolder;
      if (rootMsgFolder.canCreateSubfolders)
        folder = rootMsgFolder;
      else // just use the default account
        folder = GetDefaultAccountRootFolder();
    }

    let dualUseFolders = true;
    if (folder.server instanceof Components.interfaces.nsIImapIncomingServer)
      dualUseFolders = folder.server.dualUseFolders;

    function newFolderCallback(aName, aFolder) {
      if (aName)
        aFolder.createSubfolder(aName, msgWindow);
    }

    window.openDialog("chrome://messenger/content/newFolderDialog.xul",
                      "", "chrome,titlebar,modal",
                      {folder: folder, dualUseFolders: dualUseFolders,
                       okCallback: newFolderCallback});
  },

  /**
   * Opens the dialog to edit the properties for a folder
   *
   * @param aTabID  (optional) the tab to show in the dialog
   * @param aFolder (optional) the folder to edit, if not the selected one
   */
  editFolder: function ftc_editFolder(aTabID, aFolder) {
    let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];

    // If this is actually a server, send it off to that controller
    if (folder.isServer) {
      MsgAccountManager(null);
      return;
    }

    if (folder.flags & Components.interfaces.nsMsgFolderFlags.Virtual) {
      this.editVirtualFolder(folder);
      return;
    }

    let title = document.getElementById("bundle_messenger")
                        .getString("folderProperties");

    //xxx useless param
    function editFolderCallback(aNewName, aOldName, aUri) {
      if (aNewName != aOldName)
        folder.rename(aNewName, msgWindow);
    }

    //xxx useless param
    function rebuildSummary(aFolder) {
      let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];
      if (folder.locked) {
        folder.throwAlertMsg("operationFailedFolderBusy", msgWindow);
        return;
      }
      folder.msgDatabase.summaryValid = false;

      var msgDB = folder.msgDatabase;
      msgDB.summaryValid = false;
      try {
        folder.closeAndBackupFolderDB("");
      }
      catch(e) {
        // In a failure, proceed anyway since we're dealing with problems
        folder.ForceDBClosed();
      }
      folder.updateFolder(msgWindow);
    }

    window.openDialog("chrome://messenger/content/folderProps.xul", "",
                      "chrome,centerscreen,titlebar,modal",
                      {folder: folder, serverType: folder.server.type,
                       msgWindow: msgWindow, title: title,
                       okCallback: editFolderCallback,
                       tabID: aTabID, name: folder.prettyName,
                       rebuildSummaryCallback: rebuildSummary});
  },

  /**
   * Opens the dialog to rename a particular folder, and does the renaming if
   * the user clicks OK in that dialog
   *
   * @param aFolder (optional)  the folder to rename, if different than the
   *                            currently selected one
   */
  renameFolder: function ftc_rename(aFolder) {
    let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];

    //xxx no need for uri now
    let controller = this;
    function renameCallback(aName, aUri) {
      if (aUri != folder.URI)
        Components.utils.reportError("got back a different folder to rename!");

      controller._tree.view.selection.clearSelection();

      // Actually do the rename
      folder.rename(aName, msgWindow);
    }
    window.openDialog("chrome://messenger/content/renameFolderDialog.xul",
                      "newFolder", "chrome,titlebar,modal",
                      {preselectedURI: folder.URI,
                       okCallback: renameCallback, name: folder.prettyName});
  },

  /**
   * Deletes a folder from its parent. Also handles unsubscribe from newsgroups
   * if the selected folder/s happen to be nntp.
   *
   * @param aFolder (optional) the folder to delete, if not the selected one
   */
  deleteFolder: function ftc_delete(aFolder) {
    const Ci = Components.interfaces;
    let folders = aFolder ? [aFolder] : gFolderTreeView.getSelectedFolders();
    let folder = folders[0];

    // For newsgroups, "delete" means "unsubscribe".
    if (folder.server.type == "nntp") {
      MsgUnsubscribe(folders);
      return;
    }

    const FLAGS = Ci.nsMsgFolderFlags;
    if (folder.flags & FLAGS.Inbox || folder.flags & FLAGS.Trash)
      return;

    let prefix = "@mozilla.org/messenger/protocol/info;1?type=";
    let info = Components.classes[prefix + folder.server.type]
                          .getService(Ci.nsIMsgProtocolInfo);

    // do not allow deletion of special folders on imap accounts
    let bundle = document.getElementById("bundle_messenger");
    if ((folder.flags & FLAGS.Sent || folder.flags & FLAGS.Draft ||
         folder.flags & FLAGS.Template ||
         ((folder.flags & FLAGS.Junk) && CanRenameDeleteJunkMail(folder))) &&
        !info.specialFoldersDeletionAllowed) {
      let specialFolderString = getSpecialFolderString(folder);
      let errorMessage = bundle.getFormattedString("specialFolderDeletionErr",
                                                    [specialFolderString]);
      let errorTitle = bundle.getString("specialFolderDeletionErrTitle");
      Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                         .getService(Ci.nsIPromptService)
                         .alert(window, errorTitle, errorMessage);
      return;
    }

    if (folder.flags & FLAGS.Virtual) {
      let confirmation = bundle.getString("confirmSavedSearchDeleteMessage");
      let title = bundle.getString("confirmSavedSearchTitle");
      let IPS = Components.interfaces.nsIPromptService;
      if (Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(IPS)
            .confirmEx(window, title, confirmation, IPS.STD_YES_NO_BUTTONS + IPS.BUTTON_POS_1_DEFAULT,
                       "", "", "", "", {}) != 0) /* the yes button is in position 0 */
        return;
    }

    let array = toXPCOMArray([folder], Ci.nsIMutableArray);
    folder.parent.deleteSubFolders(array, msgWindow);
  },

  /**
   * Prompts the user to confirm and empties the trash for the selected folder
   *
   * @param aFolder (optional)  the trash folder to empty
   * @note Calling this function on a non-trash folder will result in strange
   *       behavior!
   */
  emptyTrash: function ftc_emptyTrash(aFolder) {
    let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];

    if (this._checkConfirmationPrompt("emptyTrash"))
      folder.emptyTrash(msgWindow, null);
  },

  /**
   * Deletes everything (folders and messages) in this folder
   *
   * @param aFolder (optional)  the folder to empty
   */
  emptyJunk: function ftc_emptyJunk(aFolder) {
    const Ci = Components.interfaces;
    let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];

    if (!this._checkConfirmationPrompt("emptyJunk"))
      return;

    // Delete any subfolders this folder might have
    let iter = folder.subFolders;
    while (iter.hasMoreElements())
      folder.propagateDelete(iter.getNext(), true, msgWindow);

    // Now delete the messages
    let iter = fixIterator(folder.messages);
    let messages = [m for each (m in iter)];
    let children = toXPCOMArray(messages, Ci.nsIMutableArray);
    folder.deleteMessages(children, msgWindow, true, false, null, false);
  },

  /**
   * Compacts either particular folder/s, or selected folders.
   *
   * @param aFolders (optional) the folders to compact, if different than the
   *                            currently selected ones
   */
  compactFolders: function ftc_compactFolders(aFolders) {
    let folders = aFolders || gFolderTreeView.getSelectedFolders();
    for (let i = 0; i < folders.length; i++) {
      // Can't compact folders that have just been compacted.
      if (folders[i].server.type != "imap" && !folders[i].expungedBytes)
        continue;

      folders[i].compact(null, msgWindow);
    }
  },

  /**
   * Compacts all folders for accounts that the given folders belong
   * to, or all folders for accounts of the currently selected folders.
   *
   * @param aFolders (optional) the folders for whose accounts we should compact
   *                            all folders, if different than the currently
   *                            selected ones
   */
  compactAllFoldersForAccount: function ftc_compactAllFoldersOfAccount(aFolders) {
    let folders = aFolders || gFolderTreeView.getSelectedFolders();
    for (let i = 0; i < folders.length; i++) {
      folders[i].compactAll(null, msgWindow, folders[i].server.type == "imap" ||
                                             folders[i].server.type == "nntp");
      // Reset thread pane for non-imap folders.
      if (gDBView && folders[i].server.type != "imap")
        this._resetThreadPane();
    }
  },

  /**
   * Opens the dialog to create a new virtual folder
   *
   * @param aName - the default name for the new folder
   * @param aSearchTerms - the search terms associated with the folder
   * @param aParent - the folder to run the search terms on
   */
  newVirtualFolder: function ftc_newVFolder(aName, aSearchTerms, aParent) {
    let folder = aParent || gFolderTreeView.getSelectedFolders()[0];
    let name = folder.prettyName;
    if (aName)
      name += "-" + aName;

    window.openDialog("chrome://messenger/content/virtualFolderProperties.xul",
                      "", "chrome,titlebar,modal,centerscreen",
                      {folder: folder, searchTerms: aSearchTerms,
                       newFolderName: name});
  },

  editVirtualFolder: function ftc_editVirtualFolder(aFolder) {
    let folder = aFolder || gFolderTreeView.getSelectedFolders()[0];

    //xxx should pass the folder object
    function editVirtualCallback(aURI) {
      // we need to reload the folder if it is the currently loaded folder...
      if (gFolderDisplay.displayedFolder &&
          aURI == gFolderDisplay.displayedFolder.URI)
        FolderPaneSelectionChange();
    }
    window.openDialog("chrome://messenger/content/virtualFolderProperties.xul",
                      "", "chrome,titlebar,modal,centerscreen",
                      {folder: folder, editExistingFolder: true,
                       onOKCallback: editVirtualCallback,
                       msgWindow: msgWindow});
  },

  /**
   * Prompts for confirmation, if the user hasn't already chosen the "don't ask
   * again" option.
   *
   * @param aCommand - the command to prompt for
   */
  _checkConfirmationPrompt: function ftc_confirm(aCommand) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;
    let showPrompt = true;
    try {
      let pref = Cc["@mozilla.org/preferences-service;1"]
                    .getService(Ci.nsIPrefBranch);
      showPrompt = !pref.getBoolPref("mail." + aCommand + ".dontAskAgain");
    } catch (ex) {}

    if (showPrompt) {
      let checkbox = {value:false};
      let promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                             .getService(Ci.nsIPromptService);
      let bundle = document.getElementById("bundle_messenger");
      let ok = promptService.confirmEx(window,
                                       bundle.getString(aCommand + "Title"),
                                       bundle.getString(aCommand + "Message"),
                                       promptService.STD_YES_NO_BUTTONS,
                                       null, null, null,
                                       bundle.getString(aCommand + "DontAsk"),
                                       checkbox) == 0;
      if (checkbox.value)
        pref.setBoolPref("mail." + aCommand + ".dontAskAgain", true);
      if (!ok)
        return false;
    }
    return true;
  },

  get _tree() {
    let tree = document.getElementById("folderTree");
    delete this._tree;
    return this._tree = tree;
  }
};

function ftv_SmartItem(aFolder)
{
  ftvItem.call(this, aFolder);
  this._level = 0;
}

ftv_SmartItem.prototype =
{  
  get children() {
    const Ci = Components.interfaces;
    const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
    let specialFlags = nsMsgFolderFlags.Inbox | nsMsgFolderFlags.Drafts |
                       nsMsgFolderFlags.Trash | nsMsgFolderFlags.SentMail |
                       nsMsgFolderFlags.Templates |
                       nsMsgFolderFlags.Junk |
                       nsMsgFolderFlags.Archive;

    // We're caching our child list to save perf.
    if (!this._children) {
      this._children = [];
      let iter = fixIterator(this._folder.subFolders, Ci.nsIMsgFolder);
      for (let folder in iter) {
        if (! (folder.flags & specialFlags)) {
          this._children.push(new ftv_SmartItem(folder));
        }
        else if (folder.flags & nsMsgFolderFlags.Inbox) {
          let subIter = fixIterator(folder.subFolders, Ci.nsIMsgFolder);
          for (let subfolder in subIter) {
            if (! (subfolder.flags & specialFlags))
              this._children.push(new ftv_SmartItem(subfolder));
          }
        }
      }
      sortFolderItems(this._children);
      // Each child is a level one below us
      for each (let child in this._children) {
        child._level = this._level + 1;
        child._parent = this;
      }
    }
    return this._children;
  }
}

extend(ftv_SmartItem, ftvItem);

/**
 * Sorts the passed in array of folder items using the folder sort key
 *
 * @param aFolders - the array of ftvItems to sort.
 */
function sortFolderItems (aFtvItems) {
  function sorter(a, b) {
    let sortKey = a._folder.compareSortKeys(b._folder);
    if (sortKey)
      return sortKey;
    return a.text.toLowerCase() > b.text.toLowerCase();
  }
  aFtvItems.sort(sorter);
}

/**
 * Create a subtype - maybe this wants to be in a shared .jsm file somewhere.
 */
function extend(child, supertype)
{
  child.prototype.__proto__ = supertype.prototype;
}
