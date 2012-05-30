/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* 
 * LinkToolbarItem and its subclasses represent the buttons, menuitems, 
 * and menus that handle the various link types.
 */
function LinkToolbarItem (linkType) {
  this.linkType = linkType;
  this.xulElementId = "link-" + linkType;
  this.xulPopupId = this.xulElementId + "-popup";
  this.parentMenuButton = null;

  this.getXULElement = function() {
    return document.getElementById(this.xulElementId);
  }

  this.clear = function() {
    this.disableParentMenuButton();
    this.getXULElement().setAttribute("disabled", "true");
    this.getXULElement().removeAttribute("href");
  }

  this.displayLink = function(linkElement) {
    if (this.getXULElement().hasAttribute("href")) return false;

    this.setItem(linkElement);
    this.enableParentMenuButton();
    return true;
  }

  this.setItem = function(linkElement) {
    this.getXULElement().setAttribute("href", linkElement.href);
    this.getXULElement().removeAttribute("disabled");
  }

  this.enableParentMenuButton = function() {
    if(this.getParentMenuButton())
      this.getParentMenuButton().removeAttribute("disabled");
  }

  this.disableParentMenuButton = function() {
    if (!this.parentMenuButton) return;

    this.parentMenuButton.setAttribute("disabled", "true");
    this.parentMenuButton = null;
  }

  this.getParentMenuButton = function() {
    if (!this.parentMenuButton)
      this.parentMenuButton = getParentMenuButtonRecursive(
          this.getXULElement());

    return this.parentMenuButton;
  }

  function getParentMenuButtonRecursive(xulElement) {
    if (!xulElement) return null;

    if (xulElement.tagName == "toolbarbutton") 
      return xulElement;

    return getParentMenuButtonRecursive(xulElement.parentNode)
  }
}


function LinkToolbarButton (linkType) {
  this.constructor(linkType);

  this.clear = function() {
    this.__proto__.clear.apply(this);

    this.getXULElement().removeAttribute("tooltiptext");
  }

  this.setItem = function(linkElement) {
    this.__proto__.setItem.apply(this, [linkElement]);

    this.getXULElement().setAttribute("tooltiptext", linkElement.getTooltip());
  }

  this.enableParentMenuButton = function() { /* do nothing */ }
  this.disableParentMenuButton = function() { /* do nothing */ }
}
LinkToolbarButton.prototype = new LinkToolbarItem;


function LinkToolbarMenu (linkType) {
  this.constructor(linkType);

  this.clear = function() {
    this.disableParentMenuButton();
    this.getXULElement().setAttribute("disabled", "true");
    clearPopup(this.getPopup());
  }

  function clearPopup(popup) {
    while (popup.hasChildNodes())
      popup.removeChild(popup.lastChild);
  }

  this.getPopup = function() {
    return document.getElementById(this.xulPopupId);
  }

  this.displayLink = function(linkElement) {
    this.addMenuItem(linkElement);
    this.getXULElement().removeAttribute("disabled");
    this.enableParentMenuButton();
    return true;
  }

  function match(first, second) {
    if (!first && !second) return true;
    if (!first || !second) return false;

    return first == second;
  }

  this.addMenuItem = function(linkElement) {
    this.getPopup().appendChild(this.createMenuItem(linkElement));
  }

  this.createMenuItem = function(linkElement) {
    // XXX: clone a prototypical XUL element instead of hardcoding these
    //   attributes
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", linkElement.getLabel());
    menuitem.setAttribute("href", linkElement.href);
    menuitem.setAttribute("class", "menuitem-iconic bookmark-item");
    menuitem.setAttribute("rdf:type", 
        "rdf:http://www.w3.org/1999/02/22-rdf-syntax-ns#linkType");

    return menuitem;
  }
}
LinkToolbarMenu.prototype = new LinkToolbarItem;


function LinkToolbarTransientMenu (linkType) {
  this.constructor(linkType);

  this.getXULElement = function() {
    if (this.__proto__.getXULElement.apply(this)) 
      return this.__proto__.getXULElement.apply(this);
    else
      return this.createXULElement();
  }

  this.createXULElement = function() {
    // XXX: clone a prototypical XUL element instead of hardcoding these
    //   attributes
    var menu = document.createElement("menu");
    menu.setAttribute("id", this.xulElementId);
    menu.setAttribute("label", this.linkType);
    menu.setAttribute("disabled", "true");
    menu.setAttribute("class", "menu-iconic bookmark-item");
    menu.setAttribute("container", "true");
    menu.setAttribute("type", "rdf:http://www.w3.org/1999/02/22-rdf-syntax-ns#type");

    document.getElementById("more-menu-popup").appendChild(menu);

    return menu;
  }

  this.getPopup = function() {
    if (!this.__proto__.getPopup.apply(this))
      this.getXULElement().appendChild(this.createPopup());

    return this.__proto__.getPopup.apply(this) 
  }

  this.createPopup = function() {
    var popup = document.createElement("menupopup");
    popup.setAttribute("id", this.xulPopupId);

    return popup;
  }

  this.clear = function() {
    this.__proto__.clear.apply(this);

    // XXX: we really want to use this instead of removeXULElement
    //this.hideXULElement();
    this.removeXULElement();
  }

  this.hideXULElement = function() {
    /*
     * XXX: using "hidden" or "collapsed" leads to a crash when you 
     *        open the More menu under certain circumstances.  Maybe
     *        related to bug 83906.  As of 0.9.2 I it doesn't seem
     *        to crash anymore.
     */
    this.getXULElement().setAttribute("collapsed", "true");
  }

  this.removeXULElement = function() {
    // XXX: stop using this method once it's safe to use hideXULElement
    if (this.__proto__.getXULElement.apply(this))
      this.__proto__.getXULElement.apply(this).parentNode.removeChild(
          this.__proto__.getXULElement.apply(this));
  }

  this.displayLink = function(linkElement) {
    if(!this.__proto__.displayLink.apply(this, [linkElement])) return false;

    this.getXULElement().removeAttribute("collapsed");

    // Show the 'miscellaneous' separator
    document.getElementById("misc-separator").removeAttribute("collapsed");
    return true;
  }
}

LinkToolbarTransientMenu.prototype = new LinkToolbarMenu;

