/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mozilla History System
 *
 * The Initial Developer of the Original Code is
 * Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Brett Wilson <brettw@gmail.com> (original author)
 *   Asaf Romano <mano@mozilla.com> (Javascript version)
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

function PlacesTreeView() {
  this._tree = null;
  this._result = null;
  this._selection = null;
  this._visibleElements = [];
}

PlacesTreeView.prototype = {
  _makeAtom: function PTV__makeAtom(aString) {
    return Components.classes["@mozilla.org/atom-service;1"]
                     .getService(Components.interfaces.nsIAtomService)
                     .getAtom(aString);
  },

  _atoms: [],
  _getAtomFor: function PTV__getAtomFor(aName) {
    if (!this._atoms[aName])
      this._atoms[aName] = this._makeAtom(aName);

    return this._atoms[aName];
  },

  _ensureValidRow: function PTV__ensureValidRow(aRow) {
    if (aRow < 0 || aRow >= this._visibleElements.length)
      throw Components.results.NS_ERROR_INVALID_ARG;
  },

  __dateService: null,
  get _dateService() {
    if (!this.__dateService) {
      this.__dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                                     .getService(Components.interfaces.nsIScriptableDateFormat);
    }
    return this.__dateService;
  },

  QueryInterface: function PTV_QueryInterface(aIID) {
    if (aIID.equals(Components.interfaces.nsITreeView) ||
        aIID.equals(Components.interfaces.nsINavHistoryResultViewer) ||
        aIID.equals(Components.interfaces.nsINavHistoryResultTreeViewer) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /**
   * This is called when the result or tree may have changed.
   * It reinitializes everything. Result and/or tree can be null
   * when calling.
   */
  _finishInit: function PTV__finishInit() {
    if (this._tree && this._result)
      this.sortingChanged(this._result.sortingMode);

    var qoInt = Components.interfaces.nsINavHistoryQueryOptions;
    var options = asQuery(this._result.root).queryOptions;

    // if there is no tree, BuildVisibleList will clear everything for us
    this._buildVisibleList();
  },

  /**
   * Call to completely rebuild the list of visible items. Note if there is no
   * tree or root this will just clear out the list, so you can also call this
   * when a tree is detached to clear the list.
   */
  _buildVisibleList: function PTV__buildVisibleList() {
    var selection = this.selection;
    if (selection)
      selection.selectEventsSuppressed = true;

    if (this._result) {
      // Any current visible elements need to be marked as invisible.
      for (var i = 0; i < this._visibleElements.length; i++) {
        this._visibleElements[i].node.viewIndex = -1;
      }
    }

    var rootNode = this._result.root;
    if (rootNode && this._tree) {
      asContainer(rootNode);
      if (!rootNode.containerOpen) {
        // this triggers containerOpened which then builds the visible
        // section
        rootNode.containerOpen = true;
      }
      else
        this.invalidateContainer(rootNode);
    }
    if (selection)
      selection.selectEventsSuppressed = false;
  },

  /**
   * This takes a container and recursively appends visible elements to the
   * given array. This is used to build the visible element list (with
   * this._visibleElements passed as the array), or portions thereof (with
   * a separate array that is merged with the main list later.
   *
   * aVisibleStartIndex is the visible index of the beginning of the 'aVisible'
   * array. When aVisible is this._visibleElements, this is 0. This is non-zero
   * when we are building up a sub-region for insertion. Then, this is the
   * index where the new array will be inserted into this._visibleElements.
   * It is used to compute each node's viewIndex.
   */
  _buildVisibleSection:
  function PTV__buildVisibleSection(aContainer, aVisible, aToOpen, aVisibleStartIndex)
  {
    if (!aContainer.containerOpen)
      return;  // nothing to do

    const openLiteral = PlacesUIUtils.RDF.GetResource("http://home.netscape.com/NC-rdf#open");
    const trueLiteral = PlacesUIUtils.RDF.GetLiteral("true");

    var cc = aContainer.childCount;
    for (var i=0; i < cc; i++) {
      var curChild = aContainer.getChild(i);
      var curChildType = curChild.type;

      // add item
      curChild.viewIndex = aVisibleStartIndex + aVisible.length;
      aVisible.push({ node: curChild, properties: null });

      // recursively do containers
      if (PlacesUtils.containerTypes.indexOf(curChildType) != -1) {
        asContainer(curChild);

        var resource = this._getResourceForNode(curChild);
        var isopen = resource != null &&
                     PlacesUIUtils.localStore.HasAssertion(resource, openLiteral,
                                                           trueLiteral, true);
        if (isopen != curChild.containerOpen)
          aToOpen.push(curChild);
        else if (curChild.containerOpen && curChild.childCount > 0)
          this._buildVisibleSection(curChild, aVisible, aToOpen, aVisibleStartIndex);
      }
    }
  },

  /**
   * This counts how many rows an item takes in the tree, that is, the
   * item itself plus any nodes following it with an increased indent.
   * This allows you to figure out how many rows an item (=1) or a
   * container with all of its children takes.
   */
  _countVisibleRowsForItem: function PTV__countVisibleRowsForItem(aNode) {
    if (aNode == this._result.root)
      return this._visibleElements.length;

    var viewIndex = aNode.viewIndex;
    NS_ASSERT(viewIndex >= 0, "Item is not visible, no rows to count");
    var outerLevel = aNode.indentLevel;
    for (var i = viewIndex + 1; i < this._visibleElements.length; i++) {
      if (this._visibleElements[i].node.indentLevel <= outerLevel)
        return i - viewIndex;
    }
    // this node plus its children occupy the bottom of the list
    return this._visibleElements.length - viewIndex;
  },

  /**
   * This is called by containers when they change and we need to update
   * everything about the container. We build a new visible section with
   * the container as a separate object so we first know how the list
   * changes. This way we only have to do one realloc/memcpy to update
   * the list.
   *
   * We also try to be smart here about redrawing the screen.
   */
  _refreshVisibleSection: function PTV__refreshVisibleSection(aContainer) {
    NS_ASSERT(this._result, "Need to have a result to update");
    if (!this._tree)
      return;

    // aContainer must be visible
    if (aContainer != this._result.root) {
      if (aContainer.viewIndex < 0 ||
          aContainer.viewIndex > this._visibleElements.length)
        throw "Trying to expand a node that is not visible";

      NS_ASSERT(this._visibleElements[aContainer.viewIndex].node == aContainer,
                "Visible index is out of sync!");
    }

    var startReplacement = aContainer.viewIndex + 1;
    var replaceCount = this._countVisibleRowsForItem(aContainer);

    // We don't replace the container item itself so we decrease the
    // replaceCount by 1. We don't do so though if there is no visible item
    // for the container. This happens when aContainer is the root node
    if (aContainer.viewIndex != -1)
      replaceCount-=1;

    // Persist selection state
    var previouslySelectedNodes = [];
    var selection = this.selection;
    var rc = selection.getRangeCount();
    for (var rangeIndex = 0; rangeIndex < rc; rangeIndex++) {
      var min = { }, max = { };
      selection.getRangeAt(rangeIndex, min, max);
      var lastIndex = Math.min(max.value, startReplacement + replaceCount -1);
      if (min.value < startReplacement || min.value > lastIndex)
        continue;

      for (var nodeIndex = min.value; nodeIndex <= lastIndex; nodeIndex++)
        previouslySelectedNodes.push(
          { node: this._visibleElements[nodeIndex].node, oldIndex: nodeIndex });
    }

    // Mark the removes as invisible
    for (var i = 0; i < replaceCount; i++)
      this._visibleElements[startReplacement + i].node.viewIndex = -1;

    // Building the new list will set the new elements' visible indices.
    var newElements = [];
    var toOpenElements = [];
    this._buildVisibleSection(aContainer, newElements, toOpenElements, startReplacement);

    // actually update the visible list
    this._visibleElements =
      this._visibleElements.slice(0, startReplacement).concat(newElements)
          .concat(this._visibleElements.slice(startReplacement + replaceCount,
                                              this._visibleElements.length));

    // If the new area has a different size, we'll have to renumber the
    // elements following the area.
    if (replaceCount != newElements.length) {
      for (i = startReplacement + newElements.length;
           i < this._visibleElements.length; i ++) {
        this._visibleElements[i].node.viewIndex = i;
      }
    }

    // now update the number of elements
    selection.selectEventsSuppressed = true;
    this._tree.beginUpdateBatch();

    if (replaceCount)
      this._tree.rowCountChanged(startReplacement, -replaceCount);
    if (newElements.length)
      this._tree.rowCountChanged(startReplacement, newElements.length);

    // now, open any containers that were persisted
    for (var i = 0; i < toOpenElements.length; i++) {
      var item = toOpenElements[i];
      var parent = item.parent;
      // avoid recursively opening containers
      while (parent) {
        if (parent.uri == item.uri)
          break;
        parent = parent.parent;
      }
      // if we don't have a parent, we made it all the way to the root
      // and didn't find a match, so we can open our item
      if (!parent && !item.containerOpen)
        item.containerOpen = true;
    }

    this._tree.endUpdateBatch();

    // restore selection
    if (previouslySelectedNodes.length > 0) {
      for (var i = 0; i < previouslySelectedNodes.length; i++) {
        var nodeInfo = previouslySelectedNodes[i];
        var index = nodeInfo.node.viewIndex;

        // if the same node was used (happens on sorting-changes),
        // just use viewIndex
        if (index == -1) { // otherwise, try to find an equal node
          var itemId = PlacesUtils.getConcreteItemId(nodeInfo.node);
          if (itemId != 1) { // bookmark-nodes in queries case
            for (var j = 0; j < newElements.length && index == -1; j++) {
              if (PlacesUtils.getConcreteItemId(newElements[j]) == itemId)
                index = newElements[j].viewIndex;
            }
          }
          else { // history nodes
            var uri = nodeInfo.node.uri;
            if (uri) {
              for (var j = 0; j < newElements.length && index == -1; j++) {
                if (newElements[j].uri == uri)
                  index = newElements[j].viewIndex;
              }
            }
          }
        }
        if (index != -1)
          selection.rangedSelect(index, index, true);
      }

      // if only one node was previously selected and there's no selection now,
      // select the node at its old-viewIndex, if any
      if (previouslySelectedNodes.length == 1 &&
          selection.getRangeCount() == 0 &&
          this._visibleElements.length > previouslySelectedNodes[0].oldIndex) {
        selection.rangedSelect(previouslySelectedNodes[0].oldIndex,
                               previouslySelectedNodes[0].oldIndex, true);
      }
    }
    selection.selectEventsSuppressed = false;
  },

  _convertPRTimeToString: function PTV__convertPRTimeToString(aTime) {
    var timeInMilliseconds = aTime / 1000; // PRTime is in microseconds
    var timeObj = new Date(timeInMilliseconds);

    // Check if it is today and only display the time.  Only bother
    // checking for today if it's within the last 24 hours, since
    // computing midnight is not really cheap. Sometimes we may get dates
    // in the future, so always show those.
    var ago = new Date(Date.now() - timeInMilliseconds);
    var dateFormat = Components.interfaces.nsIScriptableDateFormat.dateFormatShort;
    if (ago > -10000 && ago < (1000 * 24 * 60 * 60)) {
      var midnight = new Date(timeInMilliseconds);
      midnight.setHours(0);
      midnight.setMinutes(0);
      midnight.setSeconds(0);
      midnight.setMilliseconds(0);

      if (timeInMilliseconds > midnight.getTime())
        dateFormat = Components.interfaces.nsIScriptableDateFormat.dateFormatNone;
    }

    return (this._dateService.FormatDateTime("", dateFormat,
      Components.interfaces.nsIScriptableDateFormat.timeFormatNoSeconds,
      timeObj.getFullYear(), timeObj.getMonth() + 1,
      timeObj.getDate(), timeObj.getHours(),
      timeObj.getMinutes(), timeObj.getSeconds()));
  },

  // nsINavHistoryResultViewer
  itemInserted: function PTV_itemInserted(aParent, aItem, aNewIndex) {
    if (!this._tree)
      return;
    if (!this._result)
      throw Components.results.NS_ERROR_UNEXPECTED;

    // update parent when inserting the first item because twisty may
    // have changed
    if (aParent.childCount == 1)
      this.itemChanged(aParent);

    // compute the new view index of the item
    var newViewIndex = -1;
    if (aNewIndex == 0) {
      // item is the first thing in our child list, it takes our index +1. Note
      // that this computation still works if the parent is an invisible root
      // node, because root_index + 1 = -1 + 1 = 0
      newViewIndex = aParent.viewIndex + 1;
    }
    else {
      // Here, we try to find the next visible element in the child list so we
      // can set the new visible index to be right before that. Note that we
      // have to search DOWN instead of up, because some siblings could have
      // children themselves that would be in the way.
      for (var i = aNewIndex + 1; i < aParent.childCount; i ++) {
        var viewIndex = aParent.getChild(i).viewIndex;
        if (viewIndex >= 0) {
          // the view indices of subsequent children have not been shifted so
          // the next item will have what should be our index
          newViewIndex = viewIndex;
          break;
        }
      }
      if (newViewIndex < 0) {
        // At the end of the child list without finding a visible sibling: This
        // is a little harder because we don't know how many rows the last item
        // in our list takes up (it could be a container with many children).
        var prevChild = aParent.getChild(aNewIndex - 1);
        newViewIndex = prevChild.viewIndex + this._countVisibleRowsForItem(prevChild);
      }
    }

    aItem.viewIndex = newViewIndex;
    this._visibleElements.splice(newViewIndex, 0,
                                 { node: aItem, properties: null });
    for (var i = newViewIndex + 1;
         i < this._visibleElements.length; i ++) {
      this._visibleElements[i].node.viewIndex = i;
    }
    this._tree.rowCountChanged(newViewIndex, 1);

    if (PlacesUtils.nodeIsContainer(aItem) && asContainer(aItem).containerOpen)
      this._refreshVisibleSection(aItem);
  },

  // this is used in itemRemoved and itemMoved to fix viewIndex values
  // throw if the item has an invalid viewIndex
  _fixViewIndexOnRemove: function PTV_fixViewIndexOnRemove(aItem, aParent) {
    var oldViewIndex = aItem.viewIndex;
    // this may have been a container, in which case it has a lot of rows
    var count = this._countVisibleRowsForItem(aItem);

    if (oldViewIndex > this._visibleElements.length)
      throw("Trying to remove an item with an invalid viewIndex");

    this._visibleElements.splice(oldViewIndex, count);
    for (var i = oldViewIndex; i < this._visibleElements.length; i++)
      this._visibleElements[i].node.viewIndex = i;

    this._tree.rowCountChanged(oldViewIndex, -count);

    // redraw parent because twisty may have changed
    if (!aParent.hasChildren)
      this.itemChanged(aParent);

    return;
  },

  /**
   * THIS FUNCTION DOES NOT HANDLE cases where a collapsed node is being
   * removed but the node it is collapsed with is not being removed (this then
   * just swap out the removee with its collapsing partner). The only time
   * when we really remove things is when deleting URIs, which will apply to
   * all collapsees. This function is called sometimes when resorting items.
   * However, we won't do this when sorted by date because dates will never
   * change for visits, and date sorting is the only time things are collapsed.
   */
  itemRemoved: function PTV_itemRemoved(aParent, aItem, aOldIndex) {
    NS_ASSERT(this._result, "Got a notification but have no result!");
    if (!this._tree)
      return; // nothing to do

    var oldViewIndex = aItem.viewIndex;
    if (oldViewIndex < 0)
      return; // item was already invisible, nothing to do

    // if the item was exclusively selected, the node next to it will be
    // selected
    var selectNext = false;
    var selection = this.selection;
    if (selection.getRangeCount() == 1) {
      var min = { }, max = { };
      selection.getRangeAt(0, min, max);
      if (min.value == max.value &&
          this.nodeForTreeIndex(min.value) == aItem)
        selectNext = true;
    }

    // remove the item and fix viewIndex values
    this._fixViewIndexOnRemove(aItem, aParent);

    // restore selection if the item was exclusively selected
    if (!selectNext)
      return;
    // restore selection
    if (this._visibleElements.length > oldViewIndex)
      selection.rangedSelect(oldViewIndex, oldViewIndex, true);
    else if (this._visibleElements.length > 0) {
      // if we removed the last child, we select the new last child if exists
      selection.rangedSelect(this._visibleElements.length - 1,
                             this._visibleElements.length - 1, true);
    }
  },

  /**
   * Be careful, aOldIndex and aNewIndex specify the index in the
   * corresponding parent nodes, not the visible indexes.
   */
  itemMoved:
  function PTV_itemMoved(aItem, aOldParent, aOldIndex, aNewParent, aNewIndex) {
    NS_ASSERT(this._result, "Got a notification but have no result!");
    if (!this._tree)
      return; // nothing to do

    var oldViewIndex = aItem.viewIndex;
    if (oldViewIndex < 0)
      return; // item was already invisible, nothing to do

    // this may have been a container, in which case it has a lot of rows
    var count = this._countVisibleRowsForItem(aItem);

    // Persist selection state
    var nodesToSelect = [];
    var selection = this.selection;
    var rc = selection.getRangeCount();
    for (var rangeIndex = 0; rangeIndex < rc; rangeIndex++) {
      var min = { }, max = { };
      selection.getRangeAt(rangeIndex, min, max);
      var lastIndex = Math.min(max.value, oldViewIndex + count -1);
      if (min.value < oldViewIndex || min.value > lastIndex)
        continue;

      for (var nodeIndex = min.value; nodeIndex <= lastIndex; nodeIndex++)
        nodesToSelect.push(this._visibleElements[nodeIndex].node);
    }
    if (nodesToSelect.length > 0)
      selection.selectEventsSuppressed = true;

    // remove item from the old position
    this._fixViewIndexOnRemove(aItem, aOldParent);

    // insert the item into the new position
    this.itemInserted(aNewParent, aItem, aNewIndex);

    // restore selection
    if (nodesToSelect.length > 0) {
      for (var i = 0; i < nodesToSelect.length; i++) {
        var node = nodesToSelect[i];
        var index = node.viewIndex;
        selection.rangedSelect(index, index, true);
      }
      selection.selectEventsSuppressed = false;
    }
  },

  /**
   * Be careful, the parameter 'aIndex' here specifies the index in the parent
   * node of the item, not the visible index.
   *
   * This is called from the result when the item is replaced, but this object
   * calls this function internally also when duplicate collapsing changes. In
   * this case, aIndex will be 0, so we should be careful not to use the value.
   */
  itemReplaced:
  function PTV_itemReplaced(aParent, aOldItem, aNewItem, aIndexDoNotUse) {
    if (!this._tree)
      return;

    var viewIndex = aOldItem.viewIndex;
    aNewItem.viewIndex = viewIndex;
    if (viewIndex >= 0 &&
        viewIndex < this._visibleElements.length) {
      this._visibleElements[viewIndex].node = aNewItem;
      this._visibleElements[viewIndex].properties = null;
    }
    aOldItem.viewIndex = -1;
    this._tree.invalidateRow(viewIndex);
  },

  itemChanged: function PTV_itemChanged(aItem) {
    NS_ASSERT(this._result, "Got a notification but have no result!");
    var viewIndex = aItem.viewIndex;
    if (this._tree && viewIndex >= 0)
      this._tree.invalidateRow(viewIndex);
  },

  containerOpened: function PTV_containerOpened(aItem) {
    this.invalidateContainer(aItem);
  },

  containerClosed: function PTV_containerClosed(aItem) {
    this.invalidateContainer(aItem);
  },

  invalidateContainer: function PTV_invalidateContainer(aItem) {
    NS_ASSERT(this._result, "Got a notification but have no result!");
    if (!this._tree)
      return; // nothing to do, container is not visible
    var viewIndex = aItem.viewIndex;
    if (viewIndex >= this._visibleElements.length) {
      // be paranoid about visible indices since others can change it
      throw Components.results.NS_ERROR_UNEXPECTED;
    }
    this._refreshVisibleSection(aItem);
  },

  invalidateAll: function PTV_invalidateAll() {
    NS_ASSERT(this._result, "Got message but don't have a result!");
    if (!this._tree)
      return;

    var oldRowCount = this._visibleElements.length;

    this._buildVisibleList();
  },

  sortingChanged: function PTV__sortingChanged(aSortingMode) {
    if (!this._tree || !this._result)
      return;

    // depending on the sort mode, certain commands may be disabled
    window.updateCommands("sort");

    var columns = this._tree.columns;

    // clear old sorting indicator
    var sortedColumn = columns.getSortedColumn();
    if (sortedColumn)
      sortedColumn.element.removeAttribute("sortDirection");

    switch (aSortingMode) {
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_TITLE_ASCENDING:
        columns.Name.element.setAttribute("sortDirection", "ascending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_TITLE_DESCENDING:
        columns.Name.element.setAttribute("sortDirection", "descending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_DATE_ASCENDING:
        columns.Date.element.setAttribute("sortDirection", "ascending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_DATE_DESCENDING:
        columns.Date.element.setAttribute("sortDirection", "descending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_URI_ASCENDING:
        columns.URL.element.setAttribute("sortDirection", "ascending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_URI_DESCENDING:
        columns.URL.element.setAttribute("sortDirection", "descending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_ASCENDING:
        columns.VisitCount.element.setAttribute("sortDirection", "ascending");
        break;
      case Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING:
        columns.VisitCount.element.setAttribute("sortDirection", "descending");
        break;
    }
  },

  get result() {
    return this._result;
  },

  set result(val) {
    // some methods (e.g. getURLsFromContainer) temporarily null out the
    // viewer when they do temporary changes to the view, this does _not_
    // call setResult(null), but then, we're called again with the result
    // object which is already set for this viewer. At that point,
    // we should do nothing.
    if (this._result != val) {
      this._result = val;
      this._finishInit();
    }
    return val;
  },

  nodeForTreeIndex: function PTV_nodeForTreeIndex(aIndex) {
    if (aIndex > this._visibleElements.length)
      throw Components.results.NS_ERROR_INVALID_ARG;

    return this._visibleElements[aIndex].node;
  },

  treeIndexForNode: function PTV_treeNodeForIndex(aNode) {
    var viewIndex = aNode.viewIndex;
    if (viewIndex < 0)
      return Components.interfaces.nsINavHistoryResultTreeViewer.INDEX_INVISIBLE;

    NS_ASSERT(this._visibleElements[viewIndex].node == aNode,
              "Node's visible index and array out of sync");
    return viewIndex;
  },

  _getResourceForNode: function PTV_getResourceForNode(aNode)
  {
    var uri = aNode.uri;
    NS_ASSERT(uri, "if there is no uri, we can't persist the open state");
    return uri ? PlacesUIUtils.RDF.GetResource(uri) : null;
  },

  // nsITreeView
  get rowCount() {
    return this._visibleElements.length;
  },

  get selection() {
    return this._selection;
  },

  set selection(val) {
    return this._selection = val;
  },

  getRowProperties: function PTV_getRowProperties(aRow, aProperties) { },

  getCellProperties: function PTV_getCellProperties(aRow, aColumn, aProperties) {
    this._ensureValidRow(aRow);

    if (aColumn.id != "Name")
      return;

    var node = this._visibleElements[aRow].node;
    var properties = this._visibleElements[aRow].properties;

    if (!properties) {
      properties = [];
      if (node.type == Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_QUERY) {
        properties.push(this._getAtomFor("query"));
        if (PlacesUtils.nodeIsDay(node))
          properties.push(this._getAtomFor("dayContainer"));
        else if (PlacesUtils.nodeIsHost(node))
          properties.push(this._getAtomFor("hostContainer"));
      }

      this._visibleElements[aRow].properties = properties;
    }
    for (var i = 0; i < properties.length; i++)
      aProperties.AppendElement(properties[i]);
  },

  getColumnProperties: function(aColumn, aProperties) { },

  isContainer: function PTV_isContainer(aRow) {
    this._ensureValidRow(aRow);

    var node = this._visibleElements[aRow].node;
    if (PlacesUtils.nodeIsContainer(node)) {
      // the root node is always expandable
      if (!node.parent)
        return true;

      // treat non-expandable childless queries as non-containers
      if (PlacesUtils.nodeIsQuery(node)) {
        var parent = node.parent;
        if((PlacesUtils.nodeIsQuery(parent) ||
            PlacesUtils.nodeIsFolder(parent)) &&
           !node.hasChildren)
          return asQuery(parent).queryOptions.expandQueries;
      }
      return true;
    }
    return false;
  },

  isContainerOpen: function PTV_isContainerOpen(aRow) {
    this._ensureValidRow(aRow);
    if (!PlacesUtils.nodeIsContainer(this._visibleElements[aRow].node))
      throw Components.results.NS_ERROR_INVALID_ARG;

    return this._visibleElements[aRow].node.containerOpen;
  },

  isContainerEmpty: function PTV_isContainerEmpty(aRow) {
    this._ensureValidRow(aRow);

    if (!PlacesUtils.nodeIsContainer(this._visibleElements[aRow].node))
      throw Components.results.NS_ERROR_INVALID_ARG;

    return !this._visibleElements[aRow].node.hasChildren;
  },

  isSeparator: function PTV_isSeparator(aRow) { return false; },

  isSorted: function PTV_isSorted() {
    return this._result.sortingMode !=
           Components.interfaces.nsINavHistoryQueryOptions.SORT_BY_NONE;
  },

  canDrop: function PTV_canDrop(aRow, aOrientation) { return false; },
  drop: function PTV_drop(aRow, aOrientation) { return; },

  getParentIndex: function PTV_getParentIndex(aRow) {
    this._ensureValidRow(aRow);
    var parent = this._visibleElements[aRow].node.parent;
    if (!parent || parent.viewIndex < 0)
      return -1;

    return parent.viewIndex;
  },

  hasNextSibling: function PTV_hasNextSibling(aRow, aAfterIndex) {
    this._ensureValidRow(aRow);
    if (aRow == this._visibleElements.length -1) {
      // this is the last thing in the list -> no next sibling
      return false;
    }

    var thisLevel = this._visibleElements[aRow].node.indentLevel;
    for (var i = aAfterIndex + 1; i < this._visibleElements.length; ++i) {
      var nextLevel = this._visibleElements[i].node.indentLevel;
      if (nextLevel == thisLevel)
        return true;
      if (nextLevel < thisLevel)
        break;
    }
    return false;
  },

  getLevel: function PTV_getLevel(aRow) {
    this._ensureValidRow(aRow);

    return this._visibleElements[aRow].node.indentLevel;
  },

  getImageSrc: function PTV_getImageSrc(aRow, aColumn) {
    this._ensureValidRow(aRow);

    // only the title column has an image
    if (aColumn.id != "Name")
      return "";

    var node = this._visibleElements[aRow].node;
    var icon = node.icon;
    if (icon)
      return icon.spec;
    return "";
  },

  getProgressMode: function(aRow, aColumn) { },
  getCellValue: function(aRow, aColumn) { },

  getCellText: function PTV_getCellText(aRow, aColumn) {
    this._ensureValidRow(aRow);

    var node = this._visibleElements[aRow].node;
    switch (aColumn.id) {
      case "Name":
        // normally, this is just the title, but we don't want empty items in
        // the tree view so return a special string if the title is empty.
        // Do it here so that callers can still get at the 0 length title
        // if they go through the "result" API.
        return PlacesUIUtils.getBestTitle(node);
      case "URL":
        if (PlacesUtils.nodeIsURI(node))
          return node.uri;
        return "";
      case "Date":
        if (node.time == 0 || !PlacesUtils.nodeIsURI(node)) {
          // hosts and days shouldn't have a value for the date column.
          // Actually, you could argue this point, but looking at the
          // results, seeing the most recently visited date is not what
          // I expect, and gives me no information I know how to use.
          // Only show this for URI-based items.
          return "";
        }
        if (this._getRowSessionStatus(aRow) != this.SESSION_STATUS_CONTINUE)
          return this._convertPRTimeToString(node.time);
        return "";
      case "VisitCount":
        return node.accessCount || "";
    }
    return "";
  },

  setTree: function PTV_setTree(aTree) {
    var hasOldTree = this._tree != null;
    this._tree = aTree;

    // do this before detaching from result when there is no tree.
    // This ensures that the visible indices of the elements in the
    // result have been set to -1
    this._finishInit();

    if (!aTree && hasOldTree && this._result) {
      // detach from result when we are detaching from the tree.
      // This breaks the reference cycle between us and the result.
      this._result.viewer = null;
    }
  },

  toggleOpenState: function PTV_toggleOpenState(aRow) {
    if (!this._result)
      throw Components.results.NS_ERROR_UNEXPECTED;
    this._ensureValidRow(aRow);

    var node = this._visibleElements[aRow].node;
    if (!PlacesUtils.nodeIsContainer(node))
      return; // not a container, nothing to do

    var resource = this._getResourceForNode(node);
    if (resource) {
      const openLiteral = PlacesUIUtils.RDF.GetResource("http://home.netscape.com/NC-rdf#open");
      const trueLiteral = PlacesUIUtils.RDF.GetLiteral("true");

      if (node.containerOpen)
        PlacesUIUtils.localStore.Unassert(resource, openLiteral, trueLiteral);
      else
        PlacesUIUtils.localStore.Assert(resource, openLiteral, trueLiteral, true);
    }

    node.containerOpen = !node.containerOpen;
  },

  cycleHeader: function PTV_cycleHeader(aColumn) {
    if (!this._result)
      throw Components.results.NS_ERROR_UNEXPECTED;

    var oldSort = this._result.sortingMode;
    const NHQO = Components.interfaces.nsINavHistoryQueryOptions;
    var newSort = NHQO.SORT_BY_NONE;
    switch (aColumn.id) {
      case "SortAscending":
        // this bit-twiddling only subtracts one from even numbers
        newSort = (oldSort - 1) | 1;
        break;

      case "SortDescending":
        // add one to odd numbers (ascending sorts are all odd)
        newSort = oldSort + (oldSort & 1);
        break;

      case "SortByName":
      case "Name":
        if (oldSort == NHQO.SORT_BY_TITLE_ASCENDING)
          newSort = NHQO.SORT_BY_TITLE_DESCENDING;
        else
          newSort = NHQO.SORT_BY_TITLE_ASCENDING;
        break;

      case "SortByURL":
      case "URL":
        if (oldSort == NHQO.SORT_BY_URI_ASCENDING)
          newSort = NHQO.SORT_BY_URI_DESCENDING;
        else
          newSort = NHQO.SORT_BY_URI_ASCENDING;
        break;

        // date default is unusual because we sort by descending
        // by default because you are most likely to be looking for
        // recently visited sites when you click it
      case "SortByDate":
      case "Date":
        if (oldSort == NHQO.SORT_BY_DATE_DESCENDING)
          newSort = NHQO.SORT_BY_DATE_ASCENDING;
        else
          newSort = NHQO.SORT_BY_DATE_DESCENDING;
        break;

      case "SortByVisitCount":
      case "VisitCount":
        // visit count default is unusual because we sort by descending
        // by default because you are most likely to be looking for
        // highly visited sites when you click it
        if (oldSort == NHQO.SORT_BY_VISITCOUNT_DESCENDING)
          newSort = NHQO.SORT_BY_VISITCOUNT_ASCENDING;
        else
          newSort = NHQO.SORT_BY_VISITCOUNT_DESCENDING;
        break;

      default:
        if (oldSort == newSort)
          return;
    }
    this._result.sortingMode = newSort;
  },

  isEditable: function(aRow, aColumn) { return false; },
  setCellText: function(aRow, aColumn, aText) { },
  selectionChanged: function() { },
  cycleCell: function(aRow, aColumn) { },
  isSelectable: function(aRow, aColumn) { return false; },
  performAction: function(aAction) { },
  performActionOnRow: function(aAction, aRow) { },
  performActionOnCell: function(aAction, aRow, aColumn) { }
};
