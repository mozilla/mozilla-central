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
 * The Original Code is Mail Addressbook code.
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

/**
 * This file contains our implementation for various addressbook trees.  It
 * depends on jsTreeView.js being loaded before this script is loaded.
 */

Components.utils.import("resource:///modules/mailServices.js");

/**
 * Each abDirTreeItem corresponds to one row in the tree view.
 */
function abDirTreeItem(aDirectory) {
  this._directory = aDirectory;
}

abDirTreeItem.prototype = {
  getText: function atv_getText() {
    return this._directory.dirName;
  },

  get id() {
    return this._directory.URI;
  },

  _open: false,
  get open() {
    return this._open;
  },

  _level: 0,
  get level() {
    return this._level;
  },

  _children: null,
  get children() {
    if (!this._children) {
      this._children = [];
      const Ci = Components.interfaces;
      var myEnum = this._directory.childNodes;
      while (myEnum.hasMoreElements()) {
        var abItem = new abDirTreeItem(myEnum.getNext()
                                      .QueryInterface(Ci.nsIAbDirectory));
        this._children.push(abItem);
        this._children[this._children.length - 1]._level = this._level + 1;
        this._children[this._children.length - 1]._parent = this;
      }

      // We sort children based on their names
      function nameSort(a, b) {
        return a._directory.dirName.localeCompare(b._directory.dirName);
      }
      this._children.sort(nameSort);
    }
    return this._children;
  },

  getProperties: function atv_getProps(aProps) {
    var atomSvc = Components.classes["@mozilla.org/atom-service;1"]
                            .getService(Components.interfaces.nsIAtomService);
    if (this._directory.isMailList)
      aProps.AppendElement(atomSvc.getAtom("IsMailList-true"));
    if (this._directory.isRemote)
      aProps.AppendElement(atomSvc.getAtom("IsRemote-true"));
    if (this._directory.isSecure)
      aProps.AppendElement(atomSvc.getAtom("IsSecure-true"));
  }
};

/**
 * Our actual implementation of nsITreeView.
 */
function directoryTreeView() {}
directoryTreeView.prototype = {
  __proto__: new PROTO_TREE_VIEW(),

  init: function dtv_init(aTree, aJSONFile) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

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
        this._persistOpenMap = JSON.parse(data);
      }
    }

    this._rebuild();
    aTree.view = this;
  },

  shutdown: function dtv_shutdown(aJSONFile) {
    const Cc = Components.classes;
    const Ci = Components.interfaces;

    // Write out the persistOpenMap to our JSON file
    if (aJSONFile) {
      // Write out our json file...
      let data = JSON.stringify(this._persistOpenMap);
      let file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
      file.append(aJSONFile);
      let foStream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
                    .createInstance(Ci.nsIFileOutputStream);

      foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
      foStream.write(data, data.length);
      foStream.QueryInterface(Ci.nsISafeOutputStream).finish();
      foStream.close();
    }
  },

  // Override the dnd methods for those functions in abDragDrop.js
  canDrop: function dtv_canDrop(aIndex, aOrientation) {
    return abDirTreeObserver.canDrop(aIndex, aOrientation);
  },

  drop: function dtv_drop(aRow, aOrientation) {
    abDirTreeObserver.onDrop(aRow, aOrientation);
  },

  getDirectoryAtIndex: function dtv_getDirForIndex(aIndex) {
    return this._rowMap[aIndex]._directory;
  },

  // Override jsTreeView's isContainer, since we want to be able
  // to react to drag-drop events for all items in the directory
  // tree.
  isContainer: function dtv_isContainer(aIndex) {
    return true;
  },

  /**
   * NOTE: This function will result in indeterminate rows being selected.
   *       Callers should take care to re-select a desired row after calling
   *       this function.
   */
  _rebuild: function dtv__rebuild() {
    var oldCount = this._rowMap.length;
    this._rowMap = [];

    const Cc = Components.classes;
    const Ci = Components.interfaces;

    var dirEnum = MailServices.ab.directories;

    while (dirEnum.hasMoreElements()) {
      this._rowMap.push(new abDirTreeItem(dirEnum.getNext().QueryInterface(Ci.nsIAbDirectory)));
    }

    // Sort our addressbooks now

    const AB_ORDER = ["pab", "mork", "ldap", "mapi+other", "cab"];

    function getDirectoryValue(aDir, aKey) {
      if (aKey == "ab_type") {
        if (aDir._directory.URI == kPersonalAddressbookURI)
          return "pab";
        if (aDir._directory.URI == kCollectedAddressbookURI)
          return "cab";
        if (aDir._directory instanceof Ci.nsIAbMDBDirectory)
          return "mork";
        if (aDir._directory instanceof Ci.nsIAbLDAPDirectory)
          return "ldap";
        return "mapi+other";
      } else if (aKey == "ab_name") {
        return aDir._directory.dirName;
      }
    }

    function abNameCompare(a, b) {
      return a.localeCompare(b);
    }

    function abTypeCompare(a, b) {
      return (AB_ORDER.indexOf(a) - AB_ORDER.indexOf(b));
    }

    const SORT_PRIORITY = ["ab_type", "ab_name"];
    const SORT_FUNCS = [abTypeCompare, abNameCompare];

    function abSort(a, b) {
      for (let i = 0; i < SORT_FUNCS.length; i++) {
        let sortBy = SORT_PRIORITY[i];
        let aValue = getDirectoryValue(a, sortBy);
        let bValue = getDirectoryValue(b, sortBy);

        if (!aValue && !bValue)
          return 0;
        if (!aValue)
          return -1;
        if (!bValue)
          return 1;
        if (aValue != bValue) {
          let result = SORT_FUNCS[i](aValue, bValue);

          if (result != 0)
            return result;
        }
      }
      return 0;
    }

    this._rowMap.sort(abSort);

    if (this._tree)
      this._tree.rowCountChanged(0, this._rowMap.length - oldCount);

    this._restoreOpenStates();
  },

  // nsIAbListener interfaces
  onItemAdded: function dtv_onItemAdded(aParent, aItem) {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;
    //xxx we can optimize this later
    this._rebuild();

    if (!this._tree)
      return;

    // Now select this new item
    for (var [i, row] in Iterator(this._rowMap)) {
      if (row.id == aItem.URI) {
        this.selection.select(i);
        break;
      }
    }
  },

  onItemRemoved: function dtv_onItemRemoved(aParent, aItem) {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;
    //xxx we can optimize this later
    this._rebuild();

    if (!this._tree)
      return;

    // If we're deleting a top-level address-book, just select the first book
    if (aParent.URI == "moz-abdirectory://") {
      this.selection.select(0);
      return;
    }

    // Now select this parent item
    for (var [i, row] in Iterator(this._rowMap)) {
      if (row.id == aParent.URI) {
        this.selection.select(i);
        break;
      }
    }
  },

  onItemPropertyChanged: function dtv_onItemProp(aItem, aProp, aOld, aNew) {
    if (!(aItem instanceof Components.interfaces.nsIAbDirectory))
      return;

    for (var i in this._rowMap)  {
      if (this._rowMap[i]._directory == aItem) {
        this._tree.invalidateRow(i);
        break;
      }
    }
  }
};

var gDirectoryTreeView = new directoryTreeView();
