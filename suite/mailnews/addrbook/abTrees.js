/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains our implementation for various addressbook trees.  It
 * depends on jsTreeView.js being loaded before this script is loaded.
 */

/**
 * Each abDirTreeItem corresponds to one row in the tree view.
 */
function abDirTreeItem(aDirectory)
{
  this._directory = aDirectory;
}

abDirTreeItem.prototype =
{
  getText: function atv_getText()
  {
    return this._directory.dirName;
  },

  get id()
  {
    return this._directory.URI;
  },

  _open: false,
  get open()
  {
    return this._open;
  },

  _level: 0,
  get level()
  {
    return this._level;
  },

  _children: null,
  get children()
  {
    if (!this._children)
    {
      this._children = [];
      var myEnum = this._directory.childNodes;
      while (myEnum.hasMoreElements())
      {
        var abItem = new abDirTreeItem(
          myEnum.getNext().QueryInterface(Components.interfaces.nsIAbDirectory));
        abItem._level = this._level + 1;
        abItem._parent = this;
        this._children.push(abItem);
      }

      // We sort children based on their names.
      function nameSort(a, b)
      {
        return a._directory.dirName.localeCompare(b._directory.dirName);
      }
      this._children.sort(nameSort);
    }
    return this._children;
  },

  getProperties: function atv_getProps()
  {
    var properties = []
    if (this._directory.isMailList)
      properties.push("IsMailList-true");
    if (this._directory.isRemote)
      properties.push("IsRemote-true");
    if (this._directory.isSecure)
      properties.push("IsSecure-true");
    return properties.join(" ");
  }
};

/**
 * Our actual implementation of nsITreeView.
 */
function directoryTreeView() {}
directoryTreeView.prototype =
{
  __proto__: new PROTO_TREE_VIEW(),

  init: function dtv_init(aTree, aJSONFile)
  {
    if (aJSONFile) {
      // Parse our persistent-open-state json file
      let file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
      file.append(aJSONFile);

      if (file.exists())
      {
        let data = "";
        let fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                .createInstance(Components.interfaces.nsIFileInputStream);
        let sstream = Components.classes["@mozilla.org/scriptableinputstream;1"]
                                .createInstance(Components.interfaces.nsIScriptableInputStream);
        fstream.init(file, -1, 0, 0);
        sstream.init(fstream);

        while (sstream.available())
          data += sstream.read(4096);

        sstream.close();
        fstream.close();
        this._persistOpenMap = JSON.parse(data);
      }
    }

    this._rebuild();
    aTree.view = this;
  },

  shutdown: function dtv_shutdown(aJSONFile)
  {
    // Write out the persistOpenMap to our JSON file.
    if (aJSONFile)
    {
      // Write out our json file...
      let data = JSON.stringify(this._persistOpenMap);
      let file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
      file.append(aJSONFile);
      let foStream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
                               .createInstance(Components.interfaces.nsIFileOutputStream);
      foStream.init(file, 0x02 | 0x08 | 0x20, parseInt("0666", 8), 0);
      foStream.write(data, data.length);
      foStream.QueryInterface(Components.interfaces.nsISafeOutputStream).finish();
      foStream.close();
    }
  },

  // Override the dnd methods for those functions in abDragDrop.js
  canDrop: function dtv_canDrop(aIndex, aOrientation)
  {
    return abDirTreeObserver.canDrop(aIndex, aOrientation);
  },

  drop: function dtv_drop(aRow, aOrientation)
  {
    abDirTreeObserver.onDrop(aRow, aOrientation);
  },

  getDirectoryAtIndex: function dtv_getDirForIndex(aIndex)
  {
    return this._rowMap[aIndex]._directory;
  },

  getIndexOfDirectory: function dtv_getIndexOfDir(aItem)
  {
    for (var i = 0; i < this._rowMap.length; i++)
      if (this._rowMap[i]._directory == aItem)
        return i;

    return -1;
  },

  // Override jsTreeView's isContainer, since we want to be able
  // to react to drag-drop events for all items in the directory
  // tree.
  isContainer: function dtv_isContainer(aIndex)
  {
    return true;
  },

  /**
   * NOTE: This function will result in indeterminate rows being selected.
   *       Callers should take care to re-select a desired row after calling
   *       this function.
   */
  _rebuild: function dtv__rebuild() {
    this._rowMap = [];

    var dirEnum = MailServices.ab.directories;
    while (dirEnum.hasMoreElements())
      this._rowMap.push(new abDirTreeItem(
        dirEnum.getNext().QueryInterface(Components.interfaces.nsIAbDirectory)));

    // Sort our addressbooks now.

    const AB_ORDER = ["pab", "mork", "ldap", "mapi+other", "cab"];

    function getDirectoryValue(aDir, aKey)
    {
      if (aKey == "ab_type")
      {
        if (aDir._directory.URI == kPersonalAddressbookURI)
          return "pab";
        if (aDir._directory.URI == kCollectedAddressbookURI)
          return "cab";
        if (aDir._directory instanceof Components.interfaces.nsIAbMDBDirectory)
          return "mork";
        if ("nsIAbLDAPDirectory" in Components.interfaces &&
            aDir._directory instanceof Components.interfaces.nsIAbLDAPDirectory)
          return "ldap";
        return "mapi+other";
      }
      else if (aKey == "ab_name")
      {
        return aDir._directory.dirName;
      }
    }

    function abNameCompare(a, b)
    {
      return a.localeCompare(b);
    }

    function abTypeCompare(a, b)
    {
      return (AB_ORDER.indexOf(a) - AB_ORDER.indexOf(b));
    }

    const SORT_PRIORITY = ["ab_type", "ab_name"];
    const SORT_FUNCS = [abTypeCompare, abNameCompare];

    function abSort(a, b)
    {
      for (let i = 0; i < SORT_FUNCS.length; i++)
      {
        let sortBy = SORT_PRIORITY[i];
        let aValue = getDirectoryValue(a, sortBy);
        let bValue = getDirectoryValue(b, sortBy);

        if (!aValue && !bValue)
          continue;
        if (!aValue)
          return -1;
        if (!bValue)
          return 1;
        if (aValue != bValue)
        {
          let result = SORT_FUNCS[i](aValue, bValue);
          if (result != 0)
            return result;
        }
      }
      return 0;
    }

    this._rowMap.sort(abSort);

    this._restoreOpenStates();
  },

  // nsIAbListener interfaces
  onItemAdded: function dtv_onItemAdded(aParent, aItem)
  {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;

    var oldCount = this._rowMap.length;
    var tree = this._tree;
    this._tree = null;
    this._rebuild();
    if (!tree)
      return;

    this._tree = tree;
    var itemIndex = this.getIndexOfDirectory(aItem);
    tree.rowCountChanged(itemIndex, this._rowMap.length - oldCount);
    var parentIndex = this.getIndexOfDirectory(aParent);
    if (parentIndex > -1)
      tree.invalidateRow(parentIndex);
  },

  onItemRemoved: function dtv_onItemRemoved(aParent, aItem)
  {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;

    var itemIndex = this.getIndexOfDirectory(aItem);
    var oldCount = this._rowMap.length;
    var tree = this._tree;
    this._tree = null;
    this._rebuild();
    if (!tree)
      return;

    this._tree = tree;
    tree.rowCountChanged(itemIndex, this._rowMap.length - oldCount);
    var parentIndex = this.getIndexOfDirectory(aParent);
    if (parentIndex > -1)
      tree.invalidateRow(parentIndex);

    if (!this.selection.count)
    {
      // The previously selected item was a member of the deleted subtree.
      // Select the parent of the subtree.
      // If there is no parent, select the next item.
      // If there is no next item, select the first item.
      var newIndex = parentIndex;
      if (newIndex < 0)
        newIndex = itemIndex;
      if (newIndex >= this._rowMap.length)
        newIndex = 0;

      this.selection.select(newIndex);
    }
  },

  onItemPropertyChanged: function dtv_onItemProp(aItem, aProp, aOld, aNew)
  {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;

    var index = this.getIndexOfDirectory(aItem);
    var current = this.getDirectoryAtIndex(this.selection.currentIndex);
    var tree = this._tree;
    this._tree = null;
    this._rebuild();
    this._tree = tree;
    this.selection.select(this.getIndexOfDirectory(current));

    if (index > -1) {
      var newIndex = this.getIndexOfDirectory(aItem);
      if (newIndex >= index)
        this._tree.invalidateRange(index, newIndex);
      else
        this._tree.invalidateRange(newIndex, index);
    }
  }
};

var gDirectoryTreeView = new directoryTreeView();
