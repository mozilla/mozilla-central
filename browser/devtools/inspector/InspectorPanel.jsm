/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Cu = Components.utils;
const Ci = Components.interfaces;
const Cr = Components.results;

this.EXPORTED_SYMBOLS = ["InspectorPanel"];

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/devtools/MarkupView.jsm");
Cu.import("resource:///modules/devtools/EventEmitter.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/devtools/gDevTools.jsm");
Cu.import("resource:///modules/devtools/Selection.jsm");
Cu.import("resource:///modules/devtools/Breadcrumbs.jsm");
Cu.import("resource:///modules/devtools/Highlighter.jsm");
Cu.import("resource:///modules/devtools/Sidebar.jsm");

/**
 * Represents an open instance of the Inspector for a tab.
 * The inspector controls the highlighter, the breadcrumbs,
 * the markup view, and the sidebar (computed view, rule view
 * and layout view).
 */
this.InspectorPanel = function InspectorPanel(iframeWindow, toolbox) {
  this._target = toolbox._target;

  if (this.target.isRemote) {
    throw "Unsupported target";
  }

  this.tabTarget = (this.target.tab != null);
  this.chromeTarget = (this.target.chromeWindow != null);

  new EventEmitter(this);

  this.panelDoc = iframeWindow.document;
  this.panelWin = iframeWindow;
  this.panelWin.inspector = this;

  this.nodemenu = this.panelDoc.getElementById("inspector-node-popup");
  this.lastNodemenuItem = this.nodemenu.lastChild;
  this._setupNodeMenu = this._setupNodeMenu.bind(this);
  this._resetNodeMenu = this._resetNodeMenu.bind(this);
  this.nodemenu.addEventListener("popupshowing", this._setupNodeMenu, true);
  this.nodemenu.addEventListener("popuphiding", this._resetNodeMenu, true);

  // Create an empty selection
  this._selection = new Selection();
  this.onNewSelection = this.onNewSelection.bind(this);
  this.selection.on("new-node", this.onNewSelection);

  this.breadcrumbs = new HTMLBreadcrumbs(this);

  if (this.tabTarget) {
    this.highlighter = new Highlighter(this.target, this);
    let button = this.panelDoc.getElementById("inspector-inspect-toolbutton");
    button.hidden = false;
    this.updateInspectorButton = function() {
      if (this.highlighter.locked) {
        button.removeAttribute("checked");
      } else {
        button.setAttribute("checked", "true");
      }
    }.bind(this);
    this.highlighter.on("locked", this.updateInspectorButton);
    this.highlighter.on("unlocked", this.updateInspectorButton);
  }

  this._initMarkup();
  this.isReady = false;

  this.once("markuploaded", function() {
    this.isReady = true;

    // All the components are initialized. Let's select a node.
    if (this.tabTarget) {
      let browser = this.target.tab.linkedBrowser;
      let root = browser.contentDocument.documentElement;
      this._selection.setNode(root);
    }
    if (this.chromeTarget) {
      let root = this.target.chromeWindow.document.documentElement;
      this._selection.setNode(root);
    }

    if (this.highlighter) {
      this.highlighter.unlock();
    }

    this.emit("ready");
  }.bind(this));

  let tabbox = this.panelDoc.querySelector("#inspector-sidebar");
  this.sidebar = new InspectorSidebar(tabbox, this);

  this.sidebar.addView("chrome://browser/content/devtools/cssruleview.xul");
  this.sidebar.addView("chrome://browser/content/devtools/csshtmltree.xul");
  this.sidebar.addView("chrome://browser/content/devtools/layoutview/view.xhtml");

  this.sidebar.show();
}

InspectorPanel.prototype = {
  /**
   * Selection object (read only)
   */
  get selection() {
    return this._selection;
  },

  /**
   * Target getter.
   */
  get target() {
    return this._target;
  },

  /**
   * Target setter.
   */
  set target(value) {
    this._target = value;
  },

  /**
   * Indicate that a tool has modified the state of the page.  Used to
   * decide whether to show the "are you sure you want to navigate"
   * notification.
   */
  markDirty: function InspectorPanel_markDirty() {
    this.isDirty = true;
  },

  /**
   * When a new node is selected.
   */
  onNewSelection: function InspectorPanel_onNewSelection() {
    // Nothing yet.
  },

  /**
   * Returns true if a given sidebar panel is currently visible.
   * @param string aPanelName
   *        The panel name as registered with registerSidebar
   */
  isSidePanelVisible: function InspectorPanel_isPanelVisible(aPanelName) {
    return this.sidebar.visible &&
           this.sidebar.activePanel === aPanelName;
  },

  /**
   * Destroy the inspector.
   */
  destroy: function InspectorPanel__destroy() {
    if (this.highlighter) {
      this.highlighter.off("locked", this.updateInspectorButton);
      this.highlighter.off("unlocked", this.updateInspectorButton);
      this.highlighter.destroy();
    }

    this.nodemenu.removeEventListener("popupshowing", this._setupNodeMenu, true);
    this.nodemenu.removeEventListener("popuphiding", this._resetNodeMenu, true);
    this.breadcrumbs.destroy();
    this.selection.off("new-node", this.onNewSelection);
    this._destroyMarkup();
    this._selection.destroy();
    this._selection = null;
    this.panelWin.inspector = null;
    this.target = null;
    this.panelDoc = null;
    this.panelWin = null;
    this.breadcrumbs = null;
    this.lastNodemenuItem = null;
    this.nodemenu = null;
    this.highlighter = null;
  },

  /**
   * Show the node menu.
   */
  showNodeMenu: function InspectorPanel_showNodeMenu(aButton, aPosition, aExtraItems) {
    if (aExtraItems) {
      for (let item of aExtraItems) {
        this.nodemenu.appendChild(item);
      }
    }
    this.nodemenu.openPopup(aButton, aPosition, 0, 0, true, false);
  },

  hideNodeMenu: function InspectorPanel_hideNodeMenu() {
    this.nodemenu.hidePopup();
  },

  /**
   * Disable the delete item if needed. Update the pseudo classes.
   */
  _setupNodeMenu: function InspectorPanel_setupNodeMenu() {
    // Set the pseudo classes
    for (let name of ["hover", "active", "focus"]) {
      let menu = this.panelDoc.getElementById("node-menu-pseudo-" + name);
      let checked = DOMUtils.hasPseudoClassLock(this.selection.node, ":" + name);
      menu.setAttribute("checked", checked);
    }

    // Disable delete item if needed
    let deleteNode = this.panelDoc.getElementById("node-menu-delete");
    if (this.selection.isRoot()) {
      deleteNode.setAttribute("disabled", "true");
    } else {
      deleteNode.removeAttribute("disabled");
    }
  },

  _resetNodeMenu: function InspectorPanel_resetNodeMenu() {
    // Remove any extra items
    while (this.lastNodemenuItem.nextSibling) {
      let toDelete = this.lastNodemenuItem.nextSibling;
      toDelete.parentNode.removeChild(toDelete);
    }
  },

  _initMarkup: function InspectorPanel_initMarkup() {
    let doc = this.panelDoc;

    this._markupBox = doc.getElementById("markup-box");

    // create tool iframe
    this._markupFrame = doc.createElement("iframe");
    this._markupFrame.setAttribute("flex", "1");
    this._markupFrame.setAttribute("tooltip", "aHTMLTooltip");
    this._markupFrame.setAttribute("context", "inspector-node-popup");

    // This is needed to enable tooltips inside the iframe document.
    this._boundMarkupFrameLoad = function InspectorPanel_initMarkupPanel_onload() {
      this._markupFrame.contentWindow.focus();
      this._onMarkupFrameLoad();
    }.bind(this);
    this._markupFrame.addEventListener("load", this._boundMarkupFrameLoad, true);

    this._markupBox.setAttribute("hidden", true);
    this._markupBox.appendChild(this._markupFrame);
    this._markupFrame.setAttribute("src", "chrome://browser/content/devtools/markup-view.xhtml");
  },

  _onMarkupFrameLoad: function InspectorPanel__onMarkupFrameLoad() {
    this._markupFrame.removeEventListener("load", this._boundMarkupFrameLoad, true);
    delete this._boundMarkupFrameLoad;

    this._markupBox.removeAttribute("hidden");

    let controllerWindow;
    if (this.tabTarget) {
      controllerWindow = this.target.tab.ownerDocument.defaultView;
    } else if (this.chromeTarget) {
      controllerWindow = this.target.chromeWindow;
    }
    this.markup = new MarkupView(this, this._markupFrame, controllerWindow);

    this.emit("markuploaded");
  },

  _destroyMarkup: function InspectorPanel__destroyMarkup() {
    if (this._boundMarkupFrameLoad) {
      this._markupFrame.removeEventListener("load", this._boundMarkupFrameLoad, true);
      delete this._boundMarkupFrameLoad;
    }

    if (this.markup) {
      this.markup.destroy();
      delete this.markup;
    }

    if (this._markupFrame) {
      delete this._markupFrame;
    }
  },

  /**
   * Toggle a pseudo class.
   */
  togglePseudoClass: function togglePseudoClass(aPseudo) {
    if (this.selection.isElementNode()) {
      if (DOMUtils.hasPseudoClassLock(this.selection.node, aPseudo)) {
        this.breadcrumbs.nodeHierarchy.forEach(function(crumb) {
          DOMUtils.removePseudoClassLock(crumb.node, aPseudo);
        });
      } else {
        let hierarchical = aPseudo == ":hover" || aPseudo == ":active";
        let node = this.selection.node;
        do {
          DOMUtils.addPseudoClassLock(node, aPseudo);
          node = node.parentNode;
        } while (hierarchical && node.parentNode)
      }
    }
    this.selection.emit("pseudoclass");
  },

  /**
   * Copy the innerHTML of the selected Node to the clipboard.
   */
  copyInnerHTML: function InspectorPanel_copyInnerHTML()
  {
    if (!this.selection.isNode()) {
      return;
    }
    let toCopy = this.selection.node.innerHTML;
    if (toCopy) {
      clipboardHelper.copyString(toCopy);
    }
  },

  /**
   * Copy the outerHTML of the selected Node to the clipboard.
   */
  copyOuterHTML: function InspectorPanel_copyOuterHTML()
  {
    if (!this.selection.isNode()) {
      return;
    }
    let toCopy = this.selection.node.outerHTML;
    if (toCopy) {
      clipboardHelper.copyString(toCopy);
    }
  },

  /**
   * Delete the selected node.
   */
  deleteNode: function IUI_deleteNode() {
    if (!this.selection.isNode() ||
         this.selection.isRoot()) {
      return;
    }

    let toDelete = this.selection.node;

    let parent = this.selection.node.parentNode;

    // If the markup panel is active, use the markup panel to delete
    // the node, making this an undoable action.
    if (this.markup) {
      this.markup.deleteNode(toDelete);
    } else {
      // remove the node from content
      parent.removeChild(toDelete);
    }
  },
}

/////////////////////////////////////////////////////////////////////////
//// Initializers

XPCOMUtils.defineLazyGetter(InspectorPanel.prototype, "strings",
  function () {
    return Services.strings.createBundle(
            "chrome://browser/locale/devtools/inspector.properties");
  });

XPCOMUtils.defineLazyGetter(this, "clipboardHelper", function() {
  return Cc["@mozilla.org/widget/clipboardhelper;1"].
    getService(Ci.nsIClipboardHelper);
});


XPCOMUtils.defineLazyGetter(this, "DOMUtils", function () {
  return Cc["@mozilla.org/inspector/dom-utils;1"].getService(Ci.inIDOMUtils);
});
