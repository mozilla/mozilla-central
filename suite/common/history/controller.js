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
 * The Original Code is the Places Command Controller.
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <beng@google.com>
 *   Myk Melez <myk@mozilla.org>
 *   Asaf Romano <mano@mozilla.com>
 *   Marco Bonardo <mak77@bonardo.net>
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

// XXXmano: we should move most/all of these constants to PlacesUtils
const ORGANIZER_ROOT_BOOKMARKS = "place:folder=BOOKMARKS_MENU&excludeItems=1&queryType=1";
const ORGANIZER_SUBSCRIPTIONS_QUERY = "place:annotation=livemark%2FfeedURI";

// when removing a bunch of pages we split them in chunks to avoid passing
// a too big array to RemovePages
// 300 is the best choice with an history of about 150000 visits
// smaller chunks could cause a Slow Script warning with a huge history
const REMOVE_PAGES_CHUNKLEN = 300;
// if we are removing less than this pages we will remove them one by one
// since it will be reflected faster on the UI
// 10 is a good compromise, since allows the user to delete a little amount of
// urls for privacy reasons, but does not cause heavy disk access
const REMOVE_PAGES_MAX_SINGLEREMOVES = 10;

/**
 * Places Controller
 */

function PlacesController(aView) {
  this._view = aView;
}

PlacesController.prototype = {
  /**
   * The places view.
   */
  _view: null,

  supportsCommand: function PC_supportsCommand(aCommand) {
    //LOG("supportsCommand: " + command);
    // Non-Places specific commands that we also support
    switch (aCommand) {
    case "cmd_cut":
    case "cmd_copy":
    case "cmd_delete":
    case "cmd_selectAll":
      return true;
    }

    // All other Places Commands are prefixed with "placesCmd_" ... this
    // filters out other commands that we do _not_ support (see 329587).
    return (/^placesCmd_/.test(aCommand));
  },

  isCommandEnabled: function PC_isCommandEnabled(aCommand) {
    switch (aCommand) {
    case "cmd_cut":
    case "cmd_delete":
      return true; // history items can always be deleted
    case "cmd_copy":
    case "placesCmd_open:window":
    case "placesCmd_open:tab":
      return this._view.hasSelection;
    case "cmd_selectAll":
      if (this._view.selType != "single") {
        var result = this._view.getResult();
        if (result) {
          var container = asContainer(result.root);
          if (container.containerOpen && container.childCount > 0)
            return true;
        }
      }
      return false;
    case "placesCmd_open":
      var selectedNode = this._view.selectedNode;
      return selectedNode && PlacesUtils.nodeIsURI(selectedNode);
    case "placesCmd_delete:hostname":
      gDeleteByHostname.setAttribute("accesskey",
                                     PlacesUIUtils.getString("delete.hostname.accesskey"));
      if (gLastHostname) {
        gDeleteByHostname.setAttribute("label",
                                       PlacesUIUtils.getFormattedString("delete.hostname.true",
                                                                        [gLastHostname]));
        return true;
      }
      gDeleteByHostname.setAttribute("label",
                                     PlacesUIUtils.getString("delete.hostname.false"));
      return false;
    case "placesCmd_delete:domain":
      gDeleteByDomain.setAttribute("accesskey",
                                   PlacesUIUtils.getString("delete.domain.accesskey"));
      if (gLastDomain) {
        gDeleteByDomain.setAttribute("label",
                                     PlacesUIUtils.getFormattedString("delete.domain.true",
                                                                      [gLastDomain]));
        return true;
      }
      gDeleteByDomain.setAttribute("label",
                                   PlacesUIUtils.getString("delete.domain.false"));
      return false;
    default:
      return false;
    }
  },

  doCommand: function PC_doCommand(aCommand) {
    switch (aCommand) {
    case "cmd_cut":
      this.cut();
      break;
    case "cmd_copy":
      this.copy();
      break;
    case "cmd_delete":
      this._removeRowsFromHistory();
      break;
    case "cmd_selectAll":
      this.selectAll();
      break;
    case "placesCmd_open":
      PlacesUIUtils.openNodeIn(this._view.selectedNode, "current");
      break;
    case "placesCmd_open:window":
      PlacesUIUtils.openSelectionIn(this._view.getSelectionNodes(), "window");
      break;
    case "placesCmd_open:tab":
      PlacesUIUtils.openSelectionIn(this._view.getSelectionNodes(), "tab");
      break;
    case "placesCmd_delete:hostname":
      PlacesUtils.history
                 .QueryInterface(Components.interfaces.nsIBrowserHistory)
                 .removePagesFromHost(gLastHostname, false);
      break;
    case "placesCmd_delete:domain":
      PlacesUtils.history
                 .QueryInterface(Components.interfaces.nsIBrowserHistory)
                 .removePagesFromHost(gLastDomain, true);
      break;
    }
  },

  onEvent: function PC_onEvent(eventName) { },

  /**
   * Gathers information about the selected nodes according to the following
   * rules:
   *    "link"              node is a URI
   *    "query"             node is a query
   *    "host"              node is a host
   *    "day"               node is a date query
   *
   * @returns an array of objects corresponding the selected nodes. Each
   *          object has each of the properties above set if its corresponding
   *          node matches the rule.
   * Notes:
   *   1) This can be slow, so don't call it anywhere performance critical!
   *   2) A single-object array corresponding the root node is returned if
   *      there's no selection.
   */
  _buildSelectionMetadata: function PC__buildSelectionMetadata() {
    var metadata = [];
    var root = this._view.getResult().root;
    var nodes = this._view.getSelectionNodes();
    if (nodes.length == 0)
      nodes.push(root); // See the second note above

    for (var i = 0; i < nodes.length; i++) {
      var nodeData = {};
      var node = nodes[i];
      var nodeType = node.type;
      var uri = null;

      if (node.type == Components.interfaces.nsINavHistoryResultNode.RESULT_TYPE_URI)
        nodeData["link"] = true;
      else {
        nodeData["query"] = true;
        if (node.parent) {
          if (asQuery(node.parent).queryOptions.resultType ==
              Components.interfaces.nsINavHistoryQueryOptions.RESULTS_AS_SITE_QUERY)
            nodeData["host"] = true;
          else
            nodeData["day"] = true;
        }
      }

      metadata.push(nodeData);
    }

    return metadata;
  },

  /**
   * Determines if a context-menu item should be shown
   * @param   aMenuItem
   *          the context menu item
   * @param   aMetaData
   *          meta data about the selection
   * @returns true if the conditions (see buildContextMenu) are satisfied
   *          and the item can be displayed, false otherwise.
   */
  _shouldShowMenuItem: function PC__shouldShowMenuItem(aMenuItem, aMetaData) {
    var selectiontype = aMenuItem.getAttribute("selectiontype");
    if (selectiontype == "multiple" && aMetaData.length == 1)
      return false;
    if (selectiontype == "single" && aMetaData.length != 1)
      return false;

    var selectionAttr = aMenuItem.getAttribute("selection");
    if (selectionAttr) {
      if (selectionAttr == "any")
        return true;

      var showRules = selectionAttr.split("|");
      var anyMatched = false;
      function metaDataNodeMatches(metaDataNode, rules) {
        for (var i=0; i < rules.length; i++) {
          if (rules[i] in metaDataNode)
            return true;
        }

        return false;
      }
      for (var i = 0; i < aMetaData.length; ++i) {
        if (metaDataNodeMatches(aMetaData[i], showRules))
          anyMatched = true;
        else
          return false;
      }
      return anyMatched;
    }

    return !aMenuItem.hidden;
  },

  /**
   * Detects information (meta-data rules) about the current selection in the
   * view (see _buildSelectionMetadata) and sets the visibility state for each
   * of the menu-items in the given popup with the following rules applied:
   *  1) The "selectiontype" attribute may be set on a menu-item to "single"
   *     if the menu-item should be visible only if there is a single node
   *     selected, or to "multiple" if the menu-item should be visible only if
   *     multiple nodes are selected. If the attribute is not set or if it is
   *     set to an invalid value, the menu-item may be visible for both types of
   *     selection.
   *  2) The "selection" attribute may be set on a menu-item to the various
   *     meta-data rules for which it may be visible. The rules should be
   *     separated with the | character.
   *  3) A menu-item may be visible only if at least one of the rules set in
   *     its selection attribute apply to each of the selected nodes in the
   *     view.
   *  4) The visibility state of a menu-item is unchanged if none of this
   *     attribute is set.
   *  5) This attribute should not be set on separators for which the
   *     visibility state is "auto-detected."
   * @param   aPopup
   *          The menupopup to build children into.
   * @return true if at least one item is visible, false otherwise.
   */
  buildContextMenu: function PC_buildContextMenu(aPopup) {
    var metadata = this._buildSelectionMetadata();

    var separator = null;
    var visibleItemsBeforeSep = false;
    var anyVisible = false;
    for (var i = 0; i < aPopup.childNodes.length; ++i) {
      var item = aPopup.childNodes[i];
      if (item.localName != "menuseparator") {
        item.hidden = !this._shouldShowMenuItem(item, metadata);

        if (!item.hidden) {
          visibleItemsBeforeSep = true;
          anyVisible = true;

          // Show the separator above the menu-item if any
          if (separator) {
            separator.hidden = false;
            separator = null;
          }
        }
      }
      else { // menuseparator
        // Initially hide it. It will be unhidden if there will be at least one
        // visible menu-item above and below it.
        item.hidden = true;

        // We won't show the separator at all if no items are visible above it
        if (visibleItemsBeforeSep)
          separator = item;

        // New separator, count again:
        visibleItemsBeforeSep = false;
      }
    }

    return anyVisible;
  },

  /**
   * Select all links in the current view.
   */
  selectAll: function PC_selectAll() {
    this._view.selectAll();
  },

  /**
   * Gives the user a chance to cancel loading lots of tabs at once
   */
  _confirmOpenTabs: function(numTabsToOpen) {
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch);

    const kWarnOnOpenPref = "browser.tabs.warnOnOpen";
    var reallyOpen = true;
    if (pref.getBoolPref(kWarnOnOpenPref)) {
      if (numTabsToOpen >= pref.getIntPref("browser.tabs.maxOpenBeforeWarn")) {
        var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                      .getService(Components.interfaces.nsIPromptService);

        // default to true: if it were false, we wouldn't get this far
        var warnOnOpen = { value: true };

        var messageKey = "tabs.openWarningMultipleBranded";
        var openKey = "tabs.openButtonMultiple";
        var strings = document.getElementById("placeBundle");
        const BRANDING_BUNDLE_URI = "chrome://branding/locale/brand.properties";
        var brandShortName = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                       .getService(Components.interfaces.nsIStringBundleService)
                                       .createBundle(BRANDING_BUNDLE_URI)
                                       .GetStringFromName("brandShortName");

        var buttonPressed = promptService.confirmEx(window,
          PlacesUIUtils.getString("tabs.openWarningTitle"),
          PlacesUIUtils.getFormattedString(messageKey,
            [numTabsToOpen, brandShortName]),
          (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0)
          + (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
          PlacesUIUtils.getString(openKey),
          null, null,
          PlacesUIUtils.getFormattedString("tabs.openWarningPromptMeBranded",
            [brandShortName]),
          warnOnOpen);

         reallyOpen = (buttonPressed == 0);
         // don't set the pref unless they press OK and it's false
         if (reallyOpen && !warnOnOpen.value)
           pref.setBoolPref(kWarnOnOpenPref, false);
      }
    }
    return reallyOpen;
  },

  /**
   * Walk the list of folders we're removing in this delete operation, and
   * see if the selected node specified is already implicitly being removed
   * because it is a child of that folder.
   * @param   node
   *          Node to check for containment.
   * @param   pastFolders
   *          List of folders the calling function has already traversed
   * @returns true if the node should be skipped, false otherwise.
   */
  _shouldSkipNode: function PC_shouldSkipNode(node, pastFolders) {
    /**
     * Determines if a node is contained by another node within a resultset.
     * @param   node
     *          The node to check for containment for
     * @param   parent
     *          The parent container to check for containment in
     * @returns true if node is a member of parent's children, false otherwise.
     */
    function isContainedBy(node, parent) {
      var cursor = node.parent;
      while (cursor) {
        if (cursor == parent)
          return true;
        cursor = cursor.parent;
      }
      return false;
    }

      for (var j = 0; j < pastFolders.length; ++j) {
        if (isContainedBy(node, pastFolders[j]))
          return true;
      }
      return false;
  },

  /**
   * Removes the set of selected ranges from history.
   */
  _removeRowsFromHistory: function PC__removeRowsFromHistory() {
    // Other containers are history queries, just delete from history
    // history deletes are not undoable.
    var nodes = this._view.getSelectionNodes();
    var URIs = [];
    var bhist = PlacesUtils.history.QueryInterface(Components.interfaces.nsIBrowserHistory);
    var resultView = this._view.getResultView();
    var root = this._view.getResultNode();

    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      if (PlacesUtils.nodeIsHost(node))
        bhist.removePagesFromHost(node.title, true);
      else if (PlacesUtils.nodeIsURI(node)) {
        var uri = PlacesUtils._uri(node.uri);
        // avoid trying to delete the same url twice
        if (URIs.indexOf(uri) < 0) {
          URIs.push(uri);
        }
      }
      else if (PlacesUtils.nodeIsDay(node)) {
        // this is the oldest date
        // for the last node endDate is end of epoch
        var beginDate = 0;
        // this is the newest date
        // day nodes have time property set to the last day in the interval
        var endDate = node.time;

        var nodeIdx = 0;
        var cc = root.childCount;

        // Find index of current day node
        while (nodeIdx < cc && root.getChild(nodeIdx) != node)
          ++nodeIdx;

        // We have an older day
        if (nodeIdx+1 < cc)
          beginDate = root.getChild(nodeIdx+1).time;

        // we want to exclude beginDate from the removal
        bhist.removePagesByTimeframe(beginDate+1, endDate);
      }
    }

    // if we have to delete a lot of urls RemovePage will be slow, it's better
    // to delete them in bunch and rebuild the full treeView
    if (URIs.length > REMOVE_PAGES_MAX_SINGLEREMOVES) {
      // do removal in chunks to avoid passing a too big array to removePages
      for (var i = 0; i < URIs.length; i += REMOVE_PAGES_CHUNKLEN) {
        var URIslice = URIs.slice(i, i + REMOVE_PAGES_CHUNKLEN);
        // set DoBatchNotify (third param) only on the last chunk, so we update
        // the treeView when we are done.
        bhist.removePages(URIslice, URIslice.length,
                          (i + REMOVE_PAGES_CHUNKLEN) >= URIs.length);
      }
    }
    else {
      // if we have to delete fewer urls, removepage will allow us to avoid
      // rebuilding the full treeView
      for (var i = 0; i < URIs.length; ++i)
        bhist.removePage(URIs[i]);
    }
  },

  /**
   * Fills a DataTransfer object with the content of the selection that can be
   * dropped elsewhere.
   * @param   aEvent
   *          The dragstart event.
   */
  setDataTransfer: function PC_setDataTransfer(aEvent) {
    var dt = aEvent.dataTransfer;
    var doCopy = dt.effectAllowed == "copyLink" || dt.effectAllowed == "copy";

    var result = this._view.getResult();
    var oldViewer = result.viewer;
    try {
      result.viewer = null;
      var nodes = this._view.getDragableSelection();

      for (var i = 0; i < nodes.length; ++i) {
        var node = nodes[i];

        function addData(type, index, overrideURI) {
          var wrapNode = PlacesUtils.wrapNode(node, type, overrideURI, doCopy);
          dt.mozSetDataAt(type, wrapNode, index);
        }

        function addURIData(index, overrideURI) {
          addData(PlacesUtils.TYPE_X_MOZ_URL, index, overrideURI);
          addData(PlacesUtils.TYPE_UNICODE, index, overrideURI);
          addData(PlacesUtils.TYPE_HTML, index, overrideURI);
        }

        // This order is _important_! It controls how this and other
        // applications select data to be inserted based on type.
        addData(PlacesUtils.TYPE_X_MOZ_PLACE, i);

        if (node.uri)
          addURIData(i);
      }
    }
    finally {
      if (oldViewer)
        result.viewer = oldViewer;
    }
  },

  /**
   * Copy Bookmarks and Folders to the clipboard
   */
  copy: function PC_copy() {
    var result = this._view.getResult();
    var oldViewer = result.viewer;
    try {
      result.viewer = null;
      var nodes = this._view.getSelectionNodes();

      var xferable = Components.classes["@mozilla.org/widget/transferable;1"]
                               .createInstance(Components.interfaces.nsITransferable);
      var foundFolder = false, foundLink = false;
      var copiedFolders = [];
      var placeString, mozURLString, htmlString, unicodeString;
      placeString = mozURLString = htmlString = unicodeString = "";

      for (var i = 0; i < nodes.length; ++i) {
        var node = nodes[i];
        if (this._shouldSkipNode(node, copiedFolders))
          continue;
        if (PlacesUtils.nodeIsFolder(node))
          copiedFolders.push(node);

        function generateChunk(type, overrideURI) {
          var suffix = i < (nodes.length - 1) ? NEWLINE : "";
          var uri = overrideURI;

          mozURLString += (PlacesUtils.wrapNode(node, PlacesUtils.TYPE_X_MOZ_URL,
                                                 uri) + suffix);
          unicodeString += (PlacesUtils.wrapNode(node, PlacesUtils.TYPE_UNICODE,
                                                 uri) + suffix);
          htmlString += (PlacesUtils.wrapNode(node, PlacesUtils.TYPE_HTML,
                                                 uri) + suffix);

          var placeSuffix = i < (nodes.length - 1) ? "," : "";
          var resolveShortcuts = false; // !PlacesControllerDragHelper.canMoveNode(node);
          return PlacesUtils.wrapNode(node, type, overrideURI, resolveShortcuts) + placeSuffix;
        }

        // all items wrapped as TYPE_X_MOZ_PLACE
        placeString += generateChunk(PlacesUtils.TYPE_X_MOZ_PLACE);
      }

      function addData(type, data) {
        xferable.addDataFlavor(type);
        xferable.setTransferData(type, PlacesUIUtils._wrapString(data), data.length * 2);
      }
      // This order is _important_! It controls how this and other applications
      // select data to be inserted based on type.
      if (placeString)
        addData(PlacesUtils.TYPE_X_MOZ_PLACE, placeString);
      if (mozURLString)
        addData(PlacesUtils.TYPE_X_MOZ_URL, mozURLString);
      if (unicodeString)
        addData(PlacesUtils.TYPE_UNICODE, unicodeString);
      if (htmlString)
        addData(PlacesUtils.TYPE_HTML, htmlString);

      if (placeString || unicodeString || htmlString || mozURLString) {
        PlacesUIUtils.clipboard.setData(xferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
      }
    }
    catch(e) {
      dump(e);
    }
    finally {
      if (oldViewer)
        result.viewer = oldViewer;
    }
  },

  /**
   * Cut Bookmarks and Folders to the clipboard
   */
  cut: function PC_cut() {
    this.copy();
    this._removeRowsFromHistory();
  },
};
