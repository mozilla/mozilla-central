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
 * The Original Code is the Places Browser Integration
 *
 * The Initial Developer of the Original Code is Google Inc.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <beng@google.com>
 *   Annie Sullivan <annie.sullivan@gmail.com>
 *   Joe Hughes <joe@retrovirus.com>
 *   Asaf Romano <mano@mozilla.com>
 *   Ehsan Akhgari <ehsan.akhgari@gmail.com>
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

var PlacesCommandHook = {
  /**
   * Adds a bookmark to the page loaded in the given browser.
   *
   * @param aBrowser
   *        a <browser> element.
   * @param [optional] aParent
   *        The folder in which to create a new bookmark if the page loaded in
   *        aBrowser isn't bookmarked yet, defaults to the unfiled root.
   * @param [optional] aShowEditUI
   *        whether or not to show the edit-bookmark UI for the bookmark item
   */
  bookmarkPage: function PCH_bookmarkPage(aBrowser, aParent, aShowEditUI) {
    var uri = aBrowser.currentURI;
    var itemId = PlacesUtils.getMostRecentBookmarkForURI(uri);
    if (itemId == -1) {
      // Copied over from addBookmarkForBrowser:
      // Bug 52536: We obtain the URL and title from the nsIWebNavigation
      // associated with a <browser/> rather than from a DOMWindow.
      // This is because when a full page plugin is loaded, there is
      // no DOMWindow (?) but information about the loaded document
      // may still be obtained from the webNavigation.
      var webNav = aBrowser.webNavigation;
      var url = webNav.currentURI;
      var title;
      var description;
      var charset;
      try {
        title = webNav.document.title || url.spec;
        description = PlacesUIUtils.getDescriptionFromDocument(webNav.document);
        charset = webNav.document.characterSet;
      }
      catch (e) { }

      if (aShowEditUI) {
        // If we bookmark the page here (i.e. page was not "starred" already)
        // but open right into the "edit" state, start batching here, so
        // "Cancel" in that state removes the bookmark.
        StarUI.beginBatch();
      }

      var parent = aParent != undefined ?
                   aParent : PlacesUtils.unfiledBookmarksFolderId;
      var descAnno = { name: PlacesUIUtils.DESCRIPTION_ANNO, value: description };
      var txn = PlacesUIUtils.ptm.createItem(uri, parent, -1,
                                             title, null, [descAnno]);
      PlacesUIUtils.ptm.doTransaction(txn);
      // Set the character-set
      if (charset)
        PlacesUtils.history.setCharsetForURI(uri, charset);
      itemId = PlacesUtils.getMostRecentBookmarkForURI(uri);
    }

    // dock the panel to the star icon when possible, otherwise dock
    // it to the content area
    if (aBrowser.contentWindow == window.content) {
      let ubIcons = aBrowser.ownerDocument.getElementById("urlbar-icons");
      if (ubIcons) {
        // Make sure the bookmark properties dialog hangs toward the middle of
        // the location bar in RTL builds
        let position = (getComputedStyle(gNavToolbox, "").direction == "rtl") ? 'after_start' : 'after_end';
        if (aShowEditUI)
          StarUI.showEditBookmarkPopup(itemId, ubIcons, position);
        return;
      }
    }

    StarUI.showEditBookmarkPopup(itemId, aBrowser, "overlap");
  },

  /**
   * Adds a bookmark to the page loaded in the current tab.
   */
  bookmarkCurrentPage: function PCH_bookmarkCurrentPage(aShowEditUI, aParent) {
    this.bookmarkPage(gBrowser.selectedBrowser, aParent, aShowEditUI);
  },

  /**
   * Adds a bookmark to the page targeted by a link.
   * @param aParent
   *        The folder in which to create a new bookmark if aURL isn't
   *        bookmarked.
   * @param aURL (string)
   *        the address of the link target
   * @param aTitle
   *        The link text
   */
  bookmarkLink: function PCH_bookmarkLink(aParent, aURL, aTitle) {
    var linkURI = makeURI(aURL);
    var itemId = PlacesUtils.getMostRecentBookmarkForURI(linkURI);
    if (itemId == -1)
      PlacesUIUtils.showMinimalAddBookmarkUI(linkURI, aTitle);
    else {
      PlacesUIUtils.showItemProperties(itemId,
                                       PlacesUtils.bookmarks.TYPE_BOOKMARK);
    }
  },

  /**
   * This function returns a list of nsIURI objects characterizing the
   * tabs currently open in the browser.  The URIs will appear in the
   * list in the order in which their corresponding tabs appeared.  However,
   * only the first instance of each URI will be returned.
   *
   * @returns a list of nsIURI objects representing unique locations open
   */
  _getUniqueTabInfo: function BATC__getUniqueTabInfo() {
    var tabList = [];
    var seenURIs = {};

    var browsers = gBrowser.browsers;
    for (var i = 0; i < browsers.length; ++i) {
      let uri = browsers[i].currentURI;

      // skip redundant entries
      if (uri.spec in seenURIs)
        continue;

      // add to the set of seen URIs
      seenURIs[uri.spec] = null;
      tabList.push(uri);
    }
    return tabList;
  },

  /**
   * Adds a folder with bookmarks to all of the currently open tabs in this
   * window.
   */
  bookmarkCurrentPages: function PCH_bookmarkCurrentPages() {
    var tabURIs = this._getUniqueTabInfo();
    PlacesUIUtils.showMinimalAddMultiBookmarkUI(tabURIs);
  },


  /**
   * Adds a Live Bookmark to a feed associated with the current page.
   * @param     url
   *            The nsIURI of the page the feed was attached to
   * @title     title
   *            The title of the feed. Optional.
   * @subtitle  subtitle
   *            A short description of the feed. Optional.
   */
  addLiveBookmark: function PCH_addLiveBookmark(url, feedTitle, feedSubtitle) {
    var feedURI = makeURI(url);

    var doc = gBrowser.contentDocument;
    var title = (arguments.length > 1) ? feedTitle : doc.title;

    var description;
    if (arguments.length > 2)
      description = feedSubtitle;
    else
      description = PlacesUIUtils.getDescriptionFromDocument(doc);

    var toolbarIP =
      new InsertionPoint(PlacesUtils.bookmarks.toolbarFolder, -1);
    PlacesUIUtils.showMinimalAddLivemarkUI(feedURI, gBrowser.currentURI,
                                           title, description, toolbarIP, true);
  },

  /**
   * Opens the bookmarks manager.
   * @param   aLeftPaneRoot
   *          The query to select in the organizer window - options
   *          are: AllBookmarks, BookmarksMenu, BookmarksToolbar,
   *          UnfiledBookmarks and Tags.
   */
  showBookmarksManager: function PCH_showBookmarksManager(aLeftPaneRoot) {
    var manager = Services.wm.getMostRecentWindow("bookmarks:manager");
    if (!manager) {
      // No currently open places window, so open one with the specified mode.
      openDialog("chrome://communicator/content/bookmarks/bookmarksManager.xul",
                 "", "chrome,toolbar=yes,dialog=no,resizable", aLeftPaneRoot);
    }
    else {
      manager.PlacesOrganizer.selectLeftPaneQuery(aLeftPaneRoot);
      manager.focus();
    }
  }
};

/**
 * Functions for handling events in the Bookmarks Toolbar and menu.
 */
var BookmarksEventHandler = {
  /**
   * Handler for click event for an item in the bookmarks toolbar or menu.
   * Menus and submenus from the folder buttons bubble up to this handler.
   * Left-click is handled in the onCommand function.
   * When items are middle-clicked (or clicked with modifier), open in tabs.
   * If the click came through a menu, close the menu.
   * @param aEvent
   *        DOMEvent for the click
   */
  onClick: function BEH_onClick(aEvent) {
    // Only handle middle-click or left-click with modifiers.
    if (aEvent.button == 2 || (aEvent.button == 0 && !aEvent.shiftKey &&
                               !aEvent.ctrlKey && !aEvent.metaKey))
      return;

    var target = aEvent.originalTarget;
    // If this event bubbled up from a menu or menuitem, close the menus.
    // Do this before opening tabs, to avoid hiding the open tabs confirm-dialog.
    if (target.localName == "menu" || target.localName == "menuitem") {
      for (node = target.parentNode; node; node = node.parentNode) {
        if (node.localName == "menupopup")
          node.hidePopup();
        else if (node.localName != "menu")
          break;
      }
    }

    if (target._placesNode && PlacesUtils.nodeIsContainer(target._placesNode)) {
      // Don't open the root folder in tabs when the empty area on the toolbar
      // is middle-clicked or when a non-bookmark item except for Open in Tabs)
      // in a bookmarks menupopup is middle-clicked.
      if (target.localName == "menu" || target.localName == "toolbarbutton")
        PlacesUIUtils.openContainerNodeInTabs(target._placesNode, aEvent);
    }
    else if (aEvent.button == 1) {
      // left-clicks with modifier are already served by onCommand
      this.onCommand(aEvent);
    }
  },

  /**
   * Handler for command event for an item in the bookmarks toolbar.
   * Menus and submenus from the folder buttons bubble up to this handler.
   * Opens the item.
   * @param aEvent
   *        DOMEvent for the command
   */
  onCommand: function BEH_onCommand(aEvent) {
    var target = aEvent.originalTarget;
    if (target._placesNode)
      PlacesUIUtils.openNodeWithEvent(target._placesNode, aEvent);
  },

  fillInBHTooltip: function BEH_fillInBHTooltip(aDocument, aEvent) {
    var node;
    var cropped = false;
    var targetURI;

    if (aDocument.tooltipNode.localName == "treechildren") {
      var tree = aDocument.tooltipNode.parentNode;
      var row = {}, column = {};
      var tbo = tree.treeBoxObject;
      tbo.getCellAt(aEvent.clientX, aEvent.clientY, row, column, {});
      if (row.value == -1)
        return false;
      node = tree.view.nodeForTreeIndex(row.value);
      cropped = tbo.isCellCropped(row.value, column.value);
    }
    else {
      // Check whether the tooltipNode is a Places node.
      // In such a case use it, otherwise check for targetURI attribute.
      var tooltipNode = aDocument.tooltipNode;
      if (tooltipNode._placesNode)
        node = tooltipNode._placesNode;
      else {
        // This is a static non-Places node.
        targetURI = tooltipNode.getAttribute("targetURI");
      }
    }

    if (!node && !targetURI)
      return false;

    // Show node.label as tooltip's title for non-Places nodes.
    var title = node ? node.title : tooltipNode.label;

    // Show URL only for Places URI-nodes or nodes with a targetURI attribute.
    var url;
    if (targetURI || PlacesUtils.nodeIsURI(node))
      url = targetURI || node.uri;

    // Show tooltip for containers only if their title is cropped.
    if (!cropped && !url)
      return false;

    var tooltipTitle = aDocument.getElementById("bhtTitleText");
    tooltipTitle.hidden = (!title || (title == url));
    if (!tooltipTitle.hidden)
      tooltipTitle.textContent = title;

    var tooltipUrl = aDocument.getElementById("bhtUrlText");
    tooltipUrl.hidden = !url;
    if (!tooltipUrl.hidden)
      tooltipUrl.value = url;

    // Show tooltip.
    return true;
  }
};


// Handles special drag and drop functionality for Places menus that are not
// part of a Places view (e.g. the bookmarks menu in the menubar).
var PlacesMenuDNDHandler = {
  _springLoadDelay: 350, // milliseconds
  _loadTimer: null,

  /**
   * Called when the user enters the <menu> element during a drag.
   * @param   event
   *          The DragEnter event that spawned the opening.
   */
  onDragEnter: function PMDH_onDragEnter(event) {
    // Opening menus in a Places popup is handled by the view itself.
    if (!this._isStaticContainer(event.target))
      return;

    this._loadTimer = Components.classes["@mozilla.org/timer;1"]
                                .createInstance(Components.interfaces.nsITimer);
    this._loadTimer.initWithCallback(function() {
      PlacesMenuDNDHandler._loadTimer = null;
      event.target.lastChild.setAttribute("autoopened", "true");
      event.target.lastChild.showPopup(event.target.lastChild);
    }, this._springLoadDelay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    event.preventDefault();
    event.stopPropagation();
  },

  /**
   * Handles dragleave on the <menu> element.
   * @returns true if the element is a container element (menu or
   *          menu-toolbarbutton), false otherwise.
   */
  onDragLeave: function PMDH_onDragLeave(event) {
    // Closing menus in a Places popup is handled by the view itself.
    if (!this._isStaticContainer(event.target))
      return;

    if (this._loadTimer) {
      this._loadTimer.cancel();
      this._loadTimer = null;
    }
    let closeTimer = Components.classes["@mozilla.org/timer;1"]
                               .createInstance(Components.interfaces.nsITimer);
    closeTimer.initWithCallback(function() {
      let node = PlacesControllerDragHelper.currentDropTarget;
      let inHierarchy = false;
      while (node && !inHierarchy) {
        inHierarchy = node == event.target;
        node = node.parentNode;
      }
      if (!inHierarchy && event.target.lastChild &&
          event.target.lastChild.hasAttribute("autoopened")) {
        event.target.lastChild.removeAttribute("autoopened");
        event.target.lastChild.hidePopup();
      }
    }, this._springLoadDelay, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },

  /**
   * Determines if a XUL element represents a static container.
   * @returns true if the element is a container element (menu or
   *          menu-toolbarbutton), false otherwise.
   */
  _isStaticContainer: function PMDH__isContainer(node) {
    let isMenu = node.localName == "menu" ||
                 (node.localName == "toolbarbutton" &&
                  node.getAttribute("type") == "menu");
    let isStatic = !("_placesNode" in node) && node.lastChild &&
                   node.lastChild.hasAttribute("placespopup") &&
                   !node.parentNode.hasAttribute("placespopup");
    return isMenu && isStatic;
  },

  /**
   * Called when the user drags over the <menu> element.
   * @param   event
   *          The DragOver event.
   */
  onDragOver: function PMDH_onDragOver(event) {
    let ip = new InsertionPoint(PlacesUtils.bookmarksMenuFolderId,
                                PlacesUtils.bookmarks.DEFAULT_INDEX,
                                Components.interfaces.nsITreeView.DROP_ON);
    if (ip && PlacesControllerDragHelper.canDrop(ip, event.dataTransfer))
      event.preventDefault();

    event.stopPropagation();
  },

  /**
   * Called when the user drops on the <menu> element.
   * @param   event
   *          The Drop event.
   */
  onDrop: function PMDH_onDrop(event) {
    // Put the item at the end of bookmark menu.
    let ip = new InsertionPoint(PlacesUtils.bookmarksMenuFolderId,
                                PlacesUtils.bookmarks.DEFAULT_INDEX,
                                Components.interfaces.nsITreeView.DROP_ON);
    PlacesControllerDragHelper.onDrop(ip, event.dataTransfer);
    event.stopPropagation();
  }
};


// This object handles the initialization and uninitialization of the bookmarks
// toolbar.  updateState is called when the browser window is opened and
// after closing the toolbar customization dialog.
let PlacesToolbarHelper = {
  _place: "place:folder=TOOLBAR",
  get _viewElt() {
    return document.getElementById("PlacesToolbar");
  },

  init: function PTH_init() {
    if (this._viewElt)
      new PlacesToolbar(this._place);
  },

  customizeStart: function PTH_customizeStart() {
    let viewElt = this._viewElt;
    if (viewElt && viewElt._placesView)
      viewElt._placesView.uninit();
  },

  customizeDone: function PTH_customizeDone() {
    this.init();
  }
};


// Handles the bookmarks menu button shown when the main menubar is hidden.
let BookmarksMenuButton = {
  _popupInitialized: false,
  onPopupShowing: function BMB_onPopupShowing(event) {
    if (!this._popupInitialized) {
      // First popupshowing event, initialize immutable attributes.
      this._popupInitialized = true;

      // Need to set the label on Unsorted Bookmarks menu.
      let unsortedBookmarksElt =
        document.getElementById("BMB_unsortedBookmarksFolderMenu");
      unsortedBookmarksElt.label =
        PlacesUtils.getString("UnsortedBookmarksFolderTitle");
    }
  },
};
