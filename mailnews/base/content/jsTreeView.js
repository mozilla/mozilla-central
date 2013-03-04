/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains a prototype object designed to make the implementation of
 * nsITreeViews in javascript simpler.  This object requires that consumers
 * override the _rebuild function.  This function must set the _rowMap object to
 * an array of objects fitting the following interface:
 *
 * readonly attribute string id - a unique identifier for the row/object
 * readonly attribute integer level - the hierarchy level of the row
 * attribute boolean open - whether or not this item's children are exposed
 * string getText(aColName) - return the text to display for this row in the
 *                            specified column
 * string getProperties() - return the css-selectors
 * attribute array children - return an array of child-objects also meeting this
 *                            interface
 */

function PROTO_TREE_VIEW() {
  this._tree = null;
  this._rowMap = [];
  this._persistOpenMap = [];
}

PROTO_TREE_VIEW.prototype = {
  get rowCount() {
    return this._rowMap.length;
  },

  /**
   * CSS files will cue off of these.  Note that we reach into the rowMap's
   * items so that custom data-displays can define their own properties
   */
  getCellProperties: function jstv_getCellProperties(aRow, aCol) {
    return this._rowMap[aRow].getProperties(aCol);
  },

  /**
   * The actual text to display in the tree
   */
  getCellText: function jstv_getCellText(aRow, aCol) {
    return this._rowMap[aRow].getText(aCol.id);
  },

  /**
   * The jstv items take care of assigning this when building children lists
   */
  getLevel: function jstv_getLevel(aIndex) {
    return this._rowMap[aIndex].level;
  },

  /**
   * This is easy since the jstv items assigned the _parent property when making
   * the child lists
   */
  getParentIndex: function jstv_getParentIndex(aIndex) {
    return this._rowMap.indexOf(this._rowMap[aIndex]._parent);
  },

  /**
   * This is duplicative for our normal jstv views, but custom data-displays may
   * want to do something special here
   */
  getRowProperties: function jstv_getRowProperties(aRow) {
    return this._rowMap[aRow].getProperties();
  },

  /**
   * If an item in our list has the same level and parent as us, it's a sibling
   */
  hasNextSibling: function jstv_hasNextSibling(aIndex, aNextIndex) {
    let targetLevel = this._rowMap[aIndex].level;
    for (let i = aNextIndex + 1; i < this._rowMap.length; i++) {
      if (this._rowMap[i].level == targetLevel)
        return true;
      if (this._rowMap[i].level < targetLevel)
        return false;
    }
    return false;
  },

  /**
   * If we have a child-list with at least one element, we are a container.
   */
  isContainer: function jstv_isContainer(aIndex) {
    return this._rowMap[aIndex].children.length > 0;
  },

  isContainerEmpty: function jstv_isContainerEmpty(aIndex) {
    // If the container has no children, the container is empty.
    return !this._rowMap[aIndex].children.length;
  },

  /**
   * Just look at the jstv item here
   */
  isContainerOpen: function jstv_isContainerOpen(aIndex) {
    return this._rowMap[aIndex].open;
  },

  isEditable: function jstv_isEditable(aRow, aCol) {
    // We don't support editing rows in the tree yet.
    return false;
  },

  isSeparator: function jstv_isSeparator(aIndex) {
    // There are no separators in our trees
    return false;
  },

  isSorted: function jstv_isSorted() {
    // We do our own customized sorting
    return false;
  },

  setTree: function jstv_setTree(aTree) {
    this._tree = aTree;
  },

  recursivelyAddToMap: function jstv_recursivelyAddToMap(aChild, aNewIndex) {
    // When we add sub-children, we're going to need to increase our index
    // for the next add item at our own level.
    let currentCount = this._rowMap.length;
    if (aChild.children.length && aChild.open) {
      for (let [i, child] in Iterator(this._rowMap[aNewIndex].children)) {
        let index = aNewIndex + i + 1;
        this._rowMap.splice(index, 0, child);
        aNewIndex += this.recursivelyAddToMap(child, index);
      }
    }
    return this._rowMap.length - currentCount;
  },

  /**
   * Opens or closes a container with children.  The logic here is a bit hairy, so
   * be very careful about changing anything.
   */
  toggleOpenState: function jstv_toggleOpenState(aIndex) {

    // Ok, this is a bit tricky.
    this._rowMap[aIndex]._open = !this._rowMap[aIndex].open;

    if (!this._rowMap[aIndex].open) {
      // We're closing the current container.  Remove the children

      // Note that we can't simply splice out children.length, because some of
      // them might have children too.  Find out how many items we're actually
      // going to splice
      let level = this._rowMap[aIndex].level;
      let row = aIndex + 1;
      while (row < this._rowMap.length && this._rowMap[row].level > level) {
        row++;
      }
      let count = row - aIndex - 1;
      this._rowMap.splice(aIndex + 1, count);

      // Remove us from the persist map
      let index = this._persistOpenMap.indexOf(this._rowMap[aIndex].id);
      if (index != -1)
        this._persistOpenMap.splice(index, 1);

      // Notify the tree of changes
      if (this._tree) {
        this._tree.rowCountChanged(aIndex + 1, -count);
      }
    } else {
      // We're opening the container.  Add the children to our map

      // Note that these children may have been open when we were last closed,
      // and if they are, we also have to add those grandchildren to the map
      let oldCount = this._rowMap.length;
      this.recursivelyAddToMap(this._rowMap[aIndex], aIndex);

      // Add this container to the persist map
      let id = this._rowMap[aIndex].id;
      if (this._persistOpenMap.indexOf(id) == -1)
        this._persistOpenMap.push(id);

      // Notify the tree of changes
      if (this._tree)
        this._tree.rowCountChanged(aIndex + 1, this._rowMap.length - oldCount);
    }

    // Invalidate the toggled row, so that the open/closed marker changes
    if (this._tree)
      this._tree.invalidateRow(aIndex);
  },

  // We don't implement any of these at the moment
  canDrop: function jstv_canDrop(aIndex, aOrientation) {},
  drop: function jstv_drop(aRow, aOrientation) {},
  performAction: function jstv_performAction(aAction) {},
  performActionOnCell: function jstv_performActionOnCell(aAction, aRow, aCol) {},
  performActionOnRow: function jstv_performActionOnRow(aAction, aRow) {},
  selectionChanged: function jstv_selectionChanged() {},
  setCellText: function jstv_setCellText(aRow, aCol, aValue) {},
  setCellValue: function jstv_setCellValue(aRow, aCol, aValue) {},
  getCellValue: function jstv_getCellValue(aRow, aCol) {},
  getColumnProperties: function jstv_getColumnProperties(aCol) { return ""; },
  getImageSrc: function jstv_getImageSrc(aRow, aCol) {},
  getProgressMode: function jstv_getProgressMode(aRow, aCol) {},
  cycleCell: function jstv_cycleCell(aRow, aCol) {},
  cycleHeader: function jstv_cycleHeader(aCol) {},

  _tree: null,

  /**
   * An array of jstv items, where each item corresponds to a row in the tree
   */
  _rowMap: null,

  /**
   * This is a javascript map of which containers we had open, so that we can
   * persist their state over-time.  It is designed to be used as a JSON object.
   */
  _persistOpenMap: null,

  _restoreOpenStates: function jstv__restoreOpenStates() {
    // Note that as we iterate through here, .length may grow
    for (let i = 0; i < this._rowMap.length; i++) {
      if (this._persistOpenMap.indexOf(this._rowMap[i].id) != -1)
        this.toggleOpenState(i);
    }
  },

  QueryInterface: function QueryInterface(aIID) {
    if (aIID.equals(Components.interfaces.nsITreeView) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;
 
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
};
