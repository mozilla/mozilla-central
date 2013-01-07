/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gChatContextMenu = null;

function imContextMenu(aXulMenu) {
  this.target            = null;
  this.menu              = null;
  this.onLink            = false;
  this.onMailtoLink      = false;
  this.onSaveableLink    = false;
  this.link              = false;
  this.linkURL           = "";
  this.linkURI           = null;
  this.linkProtocol      = null;
  this.isTextSelected    = false;
  this.isContentSelected = false;
  this.shouldDisplay     = true;
  this.ellipsis = "\u2026";

  try {
    this.ellipsis =
      Services.prefs.getComplexValue("intl.ellipsis",
                                     Ci.nsIPrefLocalizedString).data;
  } catch (e) { }

  // Initialize new menu.
  this.initMenu(aXulMenu);
}

// Prototype for nsContextMenu "class."
imContextMenu.prototype = {
  cleanup: function() {
    let elt = document.getElementById("context-sep-messageactions").nextSibling;
    // remove the action menuitems added last time we opened the popup
    while (elt && elt.localName != "menuseparator") {
      let tmp = elt.nextSibling;
      elt.parentNode.removeChild(elt);
      elt = tmp;
    }
  },

  // Initialize context menu.
  initMenu: function CM_initMenu(aPopup) {
    this.menu = aPopup;

    // Get contextual info.
    let node = document.popupNode;
    this.setTarget(node);

    let actions = [];
    while (node) {
      if (node._originalMsg) {
        let msg = node._originalMsg;
        actions = msg.getActions();
        break;
      }
      node = node.parentNode;
    }

    this.isTextSelected = this.isTextSelection();
    this.isContentSelected = this.isContentSelection();

    // Initialize (disable/remove) menu items.
    // Open/Save/Send link depends on whether we're in a link.
    var shouldShow = this.onSaveableLink;
    this.showItem("context-openlink", shouldShow);
    this.showItem("context-sep-open", shouldShow);
    this.showItem("context-savelink", shouldShow);

    // Copy depends on whether there is selected text.
    // Enabling this context menu item is now done through the global
    // command updating system
    goUpdateGlobalEditMenuItems();

    this.showItem("context-copy", this.isContentSelected);
    this.showItem("context-selectall", !this.onLink || this.isContentSelected);
    this.showItem("context-sep-messageactions", actions.length);

    // Copy email link depends on whether we're on an email link.
    this.showItem("context-copyemail", this.onMailtoLink);

    // Copy link location depends on whether we're on a non-mailto link.
    this.showItem("context-copylink", this.onLink && !this.onMailtoLink);
    this.showItem("context-sep-copylink", this.onLink && this.isContentSelected);

    // Display action menu items.
    let sep = document.getElementById("context-sep-messageactions");
    for each (let action in actions) {
      let menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", action.label);
      menuitem.setAttribute("oncommand", "this.action.run();");
      menuitem.action = action;
      sep.parentNode.appendChild(menuitem);
    }
  },

  // Set various context menu attributes based on the state of the world.
  setTarget: function (aNode) {

    // Initialize contextual info.
    this.onLink            = false;
    this.linkURL           = "";
    this.linkURI           = null;
    this.linkProtocol      = "";

    // Remember the node that was clicked.
    this.target = aNode;

    // First, do checks for nodes that never have children.
    // Second, bubble out, looking for items of interest that can have childen.
    // Always pick the innermost link, background image, etc.
    const XMLNS = "http://www.w3.org/XML/1998/namespace";
    var elem = this.target;
    while (elem) {
      if (elem.nodeType == Node.ELEMENT_NODE) {
        // Link?
        if (!this.onLink &&
             ((elem instanceof HTMLAnchorElement && elem.href) ||
              (elem instanceof HTMLAreaElement && elem.href) ||
              elem instanceof HTMLLinkElement ||
              elem.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple")) {

          // Target is a link or a descendant of a link.
          this.onLink = true;

          // xxxmpc: this is kind of a hack to work around a Gecko bug (see bug 266932)
          // we're going to walk up the DOM looking for a parent link node,
          // this shouldn't be necessary, but we're matching the existing behaviour for left click
          var realLink = elem;
          var parent = elem;
          while ((parent = parent.parentNode) &&
                 (parent.nodeType == Node.ELEMENT_NODE)) {
            try {
              if ((parent instanceof HTMLAnchorElement && parent.href) ||
                  (parent instanceof HTMLAreaElement && parent.href) ||
                  parent instanceof HTMLLinkElement ||
                  parent.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple")
                realLink = parent;
            } catch (e) { }
          }

          // Remember corresponding element.
          this.link = realLink;
          this.linkURL = this.getLinkURL();
          this.linkURI = this.getLinkURI();
          this.linkProtocol = this.getLinkProtocol();
          this.onMailtoLink = (this.linkProtocol == "mailto");
          this.onSaveableLink = this.isLinkSaveable(this.link);
        }
      }

      elem = elem.parentNode;
    }
  },

  // Returns true if clicked-on link targets a resource that can be saved.
  isLinkSaveable: function(aLink) {
    return this.linkProtocol && !(
             this.linkProtocol == "mailto"     ||
             this.linkProtocol == "javascript" ||
             this.linkProtocol == "news"       ||
             this.linkProtocol == "snews"      );
  },

  // Open linked-to URL in a new window.
  openLink: function (aURI) {
    Cc["@mozilla.org/uriloader/external-protocol-service;1"].
    getService(Ci.nsIExternalProtocolService).
    loadURI(aURI || this.linkURI, window);
  },

  // Generate email address and put it on clipboard.
  copyEmail: function() {
    // Copy the comma-separated list of email addresses only.
    // There are other ways of embedding email addresses in a mailto:
    // link, but such complex parsing is beyond us.
    var url = this.linkURL;
    var qmark = url.indexOf("?");
    var addresses;

    // 7 == length of "mailto:"
    addresses = qmark > 7 ? url.substring(7, qmark) : url.substr(7);

    // Let's try to unescape it using a character set
    // in case the address is not ASCII.
    try {
      var characterSet = this.target.ownerDocument.characterSet;
      const textToSubURI = Cc["@mozilla.org/intl/texttosuburi;1"].
                           getService(Ci.nsITextToSubURI);
      addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
    }
    catch(ex) {
      // Do nothing.
    }

    var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].
                    getService(Ci.nsIClipboardHelper);
    clipboard.copyString(addresses);
  },

  ///////////////
  // Utilities //
  ///////////////

  // Show/hide one item (specified via name or the item element itself).
  showItem: function(aItemOrId, aShow) {
    var item = aItemOrId.constructor == String ?
      document.getElementById(aItemOrId) : aItemOrId;
    if (item)
      item.hidden = !aShow;
  },

  // Temporary workaround for DOM api not yet implemented by XUL nodes.
  cloneNode: function(aItem) {
    // Create another element like the one we're cloning.
    var node = document.createElement(aItem.tagName);

    // Copy attributes from argument item to the new one.
    var attrs = aItem.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs.item(i);
      node.setAttribute(attr.nodeName, attr.nodeValue);
    }

    // Voila!
    return node;
  },

  // Generate fully qualified URL for clicked-on link.
  getLinkURL: function() {
    var href = this.link.href;
    if (href)
      return href;

    href = this.link.getAttributeNS("http://www.w3.org/1999/xlink",
                                    "href");

    if (!href || (href.trim() == "")) {
      // Without this we try to save as the current doc,
      // for example, HTML case also throws if empty
      throw "Empty href";
    }

    return makeURLAbsolute(this.link.baseURI, href);
  },

  getLinkURI: function() {
    try {
      return Services.io.newURI(this.linkURL, null, null);
    }
    catch (ex) {
     // e.g. empty URL string
    }

    return null;
  },

  getLinkProtocol: function() {
    if (this.linkURI)
      return this.linkURI.scheme; // can be |undefined|

    return null;
  },

  // Get text of link.
  linkText: function() {
    var text = gatherTextUnder(this.link);
    if (text == "") {
      text = this.link.getAttribute("title");
      if (!text || (text.trim() == "")) {
        text = this.link.getAttribute("alt");
        if (!text || (text.trim() == ""))
          text = this.linkURL;
      }
    }

    return text;
  },

  // Get selected text. Only display the first 15 chars.
  isTextSelection: function() {
    // Get 16 characters, so that we can trim the selection if it's greater
    // than 15 chars
    var selectedText = getBrowserSelection(16);

    if (!selectedText)
      return false;

    if (selectedText.length > 15)
      selectedText = selectedText.substr(0,15) + this.ellipsis;

    return true;
  },

  // Returns true if anything is selected.
  isContentSelection: function() {
    return !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
  }
};

/**
 * Gets the selected text in the active browser. Leading and trailing
 * whitespace is removed, and consecutive whitespace is replaced by a single
 * space. A maximum of 150 characters will be returned, regardless of the value
 * of aCharLen.
 *
 * @param aCharLen
 *        The maximum number of characters to return.
 */
function getBrowserSelection(aCharLen) {
  // selections of more than 150 characters aren't useful
  const kMaxSelectionLen = 150;
  const charLen = Math.min(aCharLen || kMaxSelectionLen, kMaxSelectionLen);

  var focusedWindow = document.commandDispatcher.focusedWindow;
  var selection = focusedWindow.getSelection().toString();

  if (selection) {
    if (selection.length > charLen) {
      // only use the first charLen important chars. see bug 221361
      var pattern = new RegExp("^(?:\\s*.){0," + charLen + "}");
      pattern.test(selection);
      selection = RegExp.lastMatch;
    }

    selection = selection.trim().replace(/\s+/g, " ");

    if (selection.length > charLen)
      selection = selection.substr(0, charLen);
  }
  return selection;
}
