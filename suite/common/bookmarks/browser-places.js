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

var StarUI = {
  _itemId: -1,
  uri: null,
  _batching: false,

  _element: function(aID) {
    return document.getElementById(aID);
  },

  // Edit-bookmark panel
  get panel() {
    delete this.panel;
    var element = this._element("editBookmarkPanel");
    // initially the panel is hidden
    // to avoid impacting startup / new window performance
    element.hidden = false;
    element.addEventListener("popuphidden", this, false);
    element.addEventListener("keypress", this, false);
    return this.panel = element;
  },

  // Array of command elements to disable when the panel is opened.
  get _blockedCommands() {
    delete this._blockedCommands;
    return this._blockedCommands =
      ["cmd_close", "cmd_closeWindow"].map(function (id) this._element(id), this);
  },

  _blockCommands: function SU__blockCommands() {
    this._blockedCommands.forEach(function (elt) {
      // make sure not to permanently disable this item (see bug 409155)
      if (elt.hasAttribute("wasDisabled"))
        return;
      if (elt.getAttribute("disabled") == "true") {
        elt.setAttribute("wasDisabled", "true");
      } else {
        elt.setAttribute("wasDisabled", "false");
        elt.setAttribute("disabled", "true");
      }
    });
  },

  _restoreCommandsState: function SU__restoreCommandsState() {
    this._blockedCommands.forEach(function (elt) {
      if (elt.getAttribute("wasDisabled") != "true")
        elt.removeAttribute("disabled");
      elt.removeAttribute("wasDisabled");
    });
  },

  // nsIDOMEventListener
  handleEvent: function SU_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "popuphidden":
        if (aEvent.originalTarget == this.panel) {
          if (!this._element("editBookmarkPanelContent").hidden)
            this.quitEditMode();

          this._restoreCommandsState();
          this._itemId = -1;
          if (this._batching) {
            PlacesUIUtils.ptm.endBatch();
            this._batching = false;
          }

          switch (this._actionOnHide) {
            case "cancel": {
              PlacesUIUtils.ptm.undoTransaction();
              break;
            }
            case "remove": {
              // Remove all bookmarks for the bookmark's url, this also removes
              // the tags for the url.
              PlacesUIUtils.ptm.beginBatch();
              let itemIds = PlacesUtils.getBookmarksForURI(this._uriForRemoval);
              for (let i = 0; i < itemIds.length; i++) {
                let txn = PlacesUIUtils.ptm.removeItem(itemIds[i]);
                PlacesUIUtils.ptm.doTransaction(txn);
              }
              PlacesUIUtils.ptm.endBatch();
              this._uriForRemoval = null;
              break;
            }
          }
          this._actionOnHide = "";
        }
        break;
      case "keypress":
        if (aEvent.getPreventDefault()) {
          // The event has already been consumed inside of the panel.
          break;
        }
        switch (aEvent.keyCode) {
          case KeyEvent.DOM_VK_ESCAPE:
            if (!this._element("editBookmarkPanelContent").hidden)
              this.cancelButtonOnCommand();
            break;
          case KeyEvent.DOM_VK_RETURN:
            if (aEvent.target.className == "expander-up" ||
                aEvent.target.className == "expander-down" ||
                aEvent.target.id == "editBMPanel_newFolderButton") {
              //XXX Why is this necessary? The getPreventDefault() check should
              //    be enough.
              break;
            }
            this.panel.hidePopup();
            break;
        }
        break;
    }
  },

  _overlayLoaded: false,
  _overlayLoading: false,
  showEditBookmarkPopup:
  function SU_showEditBookmarkPopup(aItemId, aAnchorElement, aPosition) {
    // Performance: load the overlay the first time the panel is opened
    // (see bug 392443).
    if (this._overlayLoading)
      return;

    if (this._overlayLoaded) {
      this._doShowEditBookmarkPanel(aItemId, aAnchorElement, aPosition);
      return;
    }

    var loadObserver = {
      _self: this,
      _itemId: aItemId,
      _anchorElement: aAnchorElement,
      _position: aPosition,
      observe: function (aSubject, aTopic, aData) {
        this._self._overlayLoading = false;
        this._self._overlayLoaded = true;
        this._self._doShowEditBookmarkPanel(this._itemId, this._anchorElement,
                                            this._position);
      }
    };
    this._overlayLoading = true;
    document.loadOverlay("chrome://communicator/content/bookmarks/editBookmarkOverlay.xul",
                         loadObserver);
  },

  _doShowEditBookmarkPanel:
  function SU__doShowEditBookmarkPanel(aItemId, aAnchorElement, aPosition) {
    if (this.panel.state != "closed")
      return;

    this._blockCommands(); // un-done in the popuphiding handler

    // Move the header (star, title, possibly a button) into the grid,
    // so that it aligns nicely with the other items (bug 484022).
    var rows = this._element("editBookmarkPanelGrid").lastChild;
    var header = this._element("editBookmarkPanelHeader");
    rows.insertBefore(header, rows.firstChild);
    header.hidden = false;

    // Set panel title:
    // if we are batching, i.e. the bookmark has been added now,
    // then show Page Bookmarked, else if the bookmark did already exist,
    // we are about editing it, then use Edit This Bookmark.
    this._element("editBookmarkPanelTitle").value =
      this._batching ?
        gNavigatorBundle.getString("editBookmarkPanel.pageBookmarkedTitle") :
        gNavigatorBundle.getString("editBookmarkPanel.editBookmarkTitle");

    this._element("editBookmarkPanelBottomButtons").hidden = false;
    this._element("editBookmarkPanelContent").hidden = false;

    // The remove button is shown only if we're not already batching, i.e.
    // if the cancel button/ESC does not remove the bookmark.
    this._element("editBookmarkPanelRemoveButton").hidden = this._batching;

    // The label of the remove button differs if the URI is bookmarked
    // multiple times.
    var bookmarks = PlacesUtils.getBookmarksForURI(gBrowser.currentURI);
    var forms = gNavigatorBundle.getString("editBookmark.removeBookmarks.label");
    var label = PluralForm.get(bookmarks.length, forms).replace("#1", bookmarks.length);
    this._element("editBookmarkPanelRemoveButton").label = label;

    this._itemId = aItemId !== undefined ? aItemId : this._itemId;
    this.beginBatch();

    // Consume dismiss clicks, see bug 400924
    this.panel.popupBoxObject
        .setConsumeRollupEvent(Components.interfaces.nsIPopupBoxObject.ROLLUP_CONSUME);
    this.panel.openPopup(aAnchorElement, aPosition);

    gEditItemOverlay.initPanel(this._itemId,
                               { hiddenRows: ["description", "location",
                                              "loadInSidebar", "keyword"] });
  },

  panelShown:
  function SU_panelShown(aEvent) {
    if (aEvent.target == this.panel) {
      if (!this._element("editBookmarkPanelContent").hidden) {
        let fieldToFocus = "editBMPanel_" +
          Services.prefs.getCharPref("browser.bookmarks.editDialog.firstEditField");
        var elt = this._element(fieldToFocus);
        elt.focus();
        elt.select();
      }
      else {
        // Note this isn't actually used anymore, we should remove this
        // once we decide not to bring back the page bookmarked notification
        this.panel.focus();
      }
    }
  },

  quitEditMode: function SU_quitEditMode() {
    this._element("editBookmarkPanelContent").hidden = true;
    this._element("editBookmarkPanelBottomButtons").hidden = true;
    gEditItemOverlay.uninitPanel(true);
  },

  editButtonCommand: function SU_editButtonCommand() {
    this.showEditBookmarkPopup();
  },

  cancelButtonOnCommand: function SU_cancelButtonOnCommand() {
    this._actionOnHide = "cancel";
    this.panel.hidePopup();
  },

  removeBookmarkButtonCommand: function SU_removeBookmarkButtonCommand() {
    this._uriForRemoval = PlacesUtils.bookmarks.getBookmarkURI(this._itemId);
    this._actionOnHide = "remove";
    this.panel.hidePopup();
  },

  beginBatch: function SU_beginBatch() {
    if (!this._batching) {
      PlacesUIUtils.ptm.beginBatch();
      this._batching = true;
    }
  }
}

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

      var parent = aParent || PlacesUtils.unfiledBookmarksFolderId;
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
        let position = (getComputedStyle(gNavToolbox, "").direction == "rtl") ?
          'bottomcenter topleft' : 'bottomcenter topright';
        if (aShowEditUI)
          StarUI.showEditBookmarkPopup(itemId, ubIcons, position);
        return;
      }
    }

    StarUI.showEditBookmarkPopup(itemId, aBrowser, "overlap");
  },

  /**
   * Adds a bookmark to the page loaded in the given browser using the
   * properties dialog.
   *
   * @param aBrowser
   *        a <browser> element.
   * @param [optional] aParent
   *        The folder in which to create a new bookmark if the page loaded in
   *        aBrowser isn't bookmarked yet, defaults to the unfiled root.
   */
  bookmarkPageAs: function PCH_bookmarkPageAs(aBrowser, aParent) {
    var uri = aBrowser.currentURI;
    var webNav = aBrowser.webNavigation;
    var url = webNav.currentURI;
    var title;
    var description;
    try {
      title = webNav.document.title || url.spec;
      description = PlacesUIUtils.getDescriptionFromDocument(webNav.document);
    }
    catch (e) { }

    var parent = aParent || PlacesUtils.bookmarksMenuFolderId;

    var insertPoint = new InsertionPoint(parent,
                                         PlacesUtils.bookmarks.DEFAULT_INDEX);
    var hiddenRows = ["loadInSidebar"];
    PlacesUIUtils.showAddBookmarkUI(uri, title, description, insertPoint, true,
                                    null, null, null, null, hiddenRows);
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
                 "", "all,dialog=no", aLeftPaneRoot);
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
   * Handles dragexit on the <menu> element.
   * @returns true if the element is a container element (menu or
   *          menu-toolbarbutton), false otherwise.
   */
  onDragExit: function PMDH_onDragExit(event) {
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


var PlacesStarButton = {
  init: function PSB_init() {
    try {
      PlacesUtils.bookmarks.addObserver(this, false);
    } catch(ex) {
      Components.utils.reportError("PlacesStarButton.init(): error adding bookmark observer: " + ex);
    }
  },

  uninit: function PSB_uninit() {
    try {
      PlacesUtils.bookmarks.removeObserver(this);
    } catch(ex) {}
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsINavBookmarkObserver]),

  _starred: false,
  _batching: false,

  updateState: function PSB_updateState() {
    var starIcon = document.getElementById("star-button");

    var uri = gBrowser.currentURI;
    this._starred = PlacesUtils.getMostRecentBookmarkForURI(uri) != -1 ||
                    PlacesUtils.getMostRecentFolderForFeedURI(uri) != -1;
    if (this._starred) {
      starIcon.setAttribute("starred", "true");
      starIcon.setAttribute("tooltiptext", gNavigatorBundle.getString("starButtonOn.tooltip"));
    }
    else {
      starIcon.removeAttribute("starred");
      starIcon.setAttribute("tooltiptext", gNavigatorBundle.getString("starButtonOff.tooltip"));
    }
  },

  onClick: function PSB_onClick(aEvent) {
    if (aEvent.button == 0)
      PlacesCommandHook.bookmarkCurrentPage(this._starred);

    // don't bubble to the textbox so that the address won't be selected
    aEvent.stopPropagation();
  },

  // nsINavBookmarkObserver
  onBeginUpdateBatch: function PSB_onBeginUpdateBatch() {
    this._batching = true;
  },

  onEndUpdateBatch: function PSB_onEndUpdateBatch() {
    this.updateState();
    this._batching = false;
  },

  onItemAdded: function PSB_onItemAdded(aItemId, aFolder, aIndex, aItemType,
                                        aURI) {
    if (!this._batching && !this._starred)
      this.updateState();
  },

  onBeforeItemRemoved: function() {},

  onItemRemoved: function PSB_onItemRemoved(aItemId, aFolder, aIndex,
                                            aItemType) {
    if (!this._batching && this._starred)
      this.updateState();
  },

  onItemChanged: function PSB_onItemChanged(aItemId, aProperty,
                                            aIsAnnotationProperty, aNewValue,
                                            aLastModified, aItemType) {
    if (!this._batching && aProperty == "uri")
      this.updateState();
  },

  onItemVisited: function() {},
  onItemMoved: function() {}
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
