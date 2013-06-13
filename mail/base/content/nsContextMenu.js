/** ***** BEGIN LICENSE BLOCK *****
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/InlineSpellChecker.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/MailUtils.js");

XPCOMUtils.defineLazyGetter(this, "PageMenu", function() {
  let tmp = {};
  Cu.import("resource://gre/modules/PageMenu.jsm", tmp);
  return new tmp.PageMenu();
});

var gSpellChecker = new InlineSpellChecker();
var gGlodaBundle = null;

function nsContextMenu(aXulMenu, aIsShift) {
  this.target         = null;
  this.menu           = null;
  this.onTextInput    = false;
  this.onImage        = false;
  this.onLoadedImage  = false;
  this.onCanvas       = false;
  this.onVideo        = false;
  this.onAudio        = false;
  this.onPlayableMedia = false;
  this.onLink         = false;
  this.onMailtoLink   = false;
  this.onSaveableLink = false;
  this.onMetaDataItem = false;
  this.onMathML       = false;
  this.link           = false;
  this.linkURL        = "";
  this.linkURI        = null;
  this.linkProtocol   = null;
  this.mediaURL       = "";
  this.isContentSelected = false;
  this.shouldDisplay  = true;

  // Message Related Items
  this.inMessageArea = false;
  this.inThreadPane = false;
  this.inStandaloneWindow = false;
  this.messagepaneIsBlank = false;
  this.numSelectedMessages = 0;
  this.isNewsgroup = false;
  this.hideMailItems = false;

  this.initMenu(aXulMenu, aIsShift);
}

nsContextMenu.prototype = {
  /**
   * Init: set properties based on the clicked-on element and the state of
   * the world, then determine which context menu items to show based on
   * those properties.
   */
  initMenu : function CM_initMenu(aPopup, aIsShift) {
    this.menu = aPopup;

    // Get contextual info.
    this.setTarget(document.popupNode);
    this.setMessageTargets(document.popupNode);

    if (!this.inThreadPane && this.messagepaneIsBlank) {
      this.shouldDisplay = false;
      return;
    }

    this.isContentSelected = this.isContentSelection();

    this.hasPageMenu = false;
    if (!aIsShift) {
      this.hasPageMenu = PageMenu.maybeBuildAndAttachMenu(this.target,
                                                          aPopup);
    }

    this.initItems();
  },
  initItems : function CM_initItems() {
    this.initPageMenuSeparator();
    this.initSaveItems();
    this.initClipboardItems();
    this.initMediaPlayerItems();
    this.initBrowserItems();
    this.initMessageItems();
    this.initSpellingItems();
    this.initSeparators();
  },
  addDictionaries: function CM_addDictionaries() {
    openDictionaryList();
  },
  initPageMenuSeparator: function CM_initPageMenuSeparator() {
    this.showItem("page-menu-separator", this.hasPageMenu);
  },
  initSpellingItems: function CM_initSpellingItems() {
    let canSpell = gSpellChecker.canSpellCheck;
    let onMisspelling = gSpellChecker.overMisspelling;
    this.showItem("mailContext-spell-check-enabled", canSpell);
    this.showItem("mailContext-spell-separator", canSpell || this.onEditableArea);
    if (canSpell) {
      document.getElementById("mailContext-spell-check-enabled")
              .setAttribute("checked", gSpellChecker.enabled);
    }

    this.showItem("mailContext-spell-add-to-dictionary", onMisspelling);

    // suggestion list
    this.showItem("mailContext-spell-suggestions-separator", onMisspelling);
    if (onMisspelling) {
      let addMenuItem =
        document.getElementById("mailContext-spell-add-to-dictionary");
      let suggestionCount =
        gSpellChecker.addSuggestionsToMenu(addMenuItem.parentNode,
                                           addMenuItem, 5);
      this.showItem("mailContext-spell-no-suggestions", suggestionCount == 0);
    } else {
      this.showItem("mailContext-spell-no-suggestions", false);
    }

    // dictionary list
    this.showItem("mailContext-spell-dictionaries", gSpellChecker.enabled);
    if (canSpell) {
      let dictMenu = document.getElementById("mailContext-spell-dictionaries-menu");
      let dictSep = document.getElementById("mailContext-spell-language-separator");
      gSpellChecker.addDictionaryListToMenu(dictMenu, dictSep);
      this.showItem("mailContext-spell-add-dictionaries-main", false);
    } else if (this.onEditableArea) {
      // when there is no spellchecker but we might be able to spellcheck
      // add the add to dictionaries item. This will ensure that people
      // with no dictionaries will be able to download them
      this.showItem("mailContext-spell-add-dictionaries-main", true);
    } else {
      this.showItem("mailContext-spell-add-dictionaries-main", false);
    }
  },
  initSaveItems : function CM_initSaveItems() {
    this.showItem("mailContext-savelink", this.onSaveableLink);
    this.showItem("mailContext-saveimage", this.onLoadedImage);
  },
  initClipboardItems : function CM_initClipboardItems() {
    // Copy depends on whether there is selected text.
    // Enabling this context menu item is now done through the global
    // command updating system.

    goUpdateGlobalEditMenuItems();

    this.showItem("mailContext-cut", !this.inMessageArea && this.onTextInput);
    this.showItem("mailContext-copy",
                  !this.inThreadPane && !this.onPlayableMedia &&
                  (this.isContentSelected || this.onTextInput));
    this.showItem("mailContext-paste", !this.inMessageArea && this.onTextInput);

    this.showItem("mailContext-undo", !this.inMessageArea && this.onTextInput);
    // Select all not available in the thread pane or on playable media.
    this.showItem("mailContext-selectall", !this.inThreadPane && !this.onPlayableMedia);
    this.showItem("mailContext-copyemail", this.onMailtoLink);
    this.showItem("mailContext-copylink", this.onLink && !this.onMailtoLink);
    this.showItem("mailContext-copyimage", this.onImage);

    this.showItem("mailContext-composeemailto", this.onMailtoLink && !this.inThreadPane);
    this.showItem("mailContext-addemail", this.onMailtoLink && !this.inThreadPane);


    let searchTheWeb = document.getElementById("mailContext-searchTheWeb");
    this.showItem(searchTheWeb, !this.inThreadPane && !this.onPlayableMedia &&
                  this.isContentSelected);

    if (!searchTheWeb.hidden) {
      let selection = document.commandDispatcher.focusedWindow.getSelection();
      if (gGlodaBundle === null)
        gGlodaBundle = Services.strings.createBundle(
          "chrome://messenger/locale/glodaComplete.properties");

      let key = "glodaComplete.webSearch1.label";
      let selString = selection.toString();
      if (selString.length > 15) {
        key += ".truncated";
        selString = selString.slice(0, 15);
      }

      searchTheWeb.label = gGlodaBundle.GetStringFromName(key)
                                      .replace("#1", Services.search.currentEngine.name)
                                      .replace("#2", selString);
      searchTheWeb.value = selection.toString();
    }
  },
  initMediaPlayerItems: function CM_initMediaPlayerItems() {
    let onMedia = this.onVideo || this.onAudio;
    // Several mutually exclusive items.... play/pause, mute/unmute, show/hide
    this.showItem("mailContext-media-play", onMedia && this.target.paused);
    this.showItem("mailContext-media-pause", onMedia && !this.target.paused);
    this.showItem("mailContext-media-mute", onMedia && !this.target.muted);
    this.showItem("mailContext-media-unmute", onMedia && this.target.muted);
    if (onMedia) {
      let hasError = this.target.error != null ||
                     this.target.networkState == this.target.NETWORK_NO_SOURCE;
      this.setItemAttr("mailContext-media-play", "disabled", hasError);
      this.setItemAttr("mailContext-media-pause", "disabled", hasError);
      this.setItemAttr("mailContext-media-mute", "disabled", hasError);
      this.setItemAttr("mailContext-media-unmute", "disabled", hasError);
    }
  },
  initBrowserItems: function CM_initBrowserItems() {
    // Work out if we are a context menu on a special item e.g. an image, link
    // etc.
    let notOnSpecialItem = !(this.inMessageArea || this.isContentSelected ||
                             this.onCanvas || this.onLink || this.onImage ||
                             this.onPlayableMedia || this.onTextInput);
    // Ensure these commands are updated with their current status.
    if (notOnSpecialItem) {
      goUpdateCommand("cmd_stop");
      goUpdateCommand("cmd_reload");
    }

    // These only needs showing if we're not on something special.
    this.showItem("mailContext-stop", notOnSpecialItem);
    this.showItem("mailContext-reload", notOnSpecialItem);

    let loadedProtocol = "";
    if (this.target &&
        this.target.ownerDocument.defaultView.top.location)
      loadedProtocol = this.target.ownerDocument.defaultView.top
                           .location.protocol;

    // Only show open in browser if we're not on a special item and we're not
    // on an about: or chrome: protocol - for these protocols the browser is
    // unlikely to show the same thing as we do (if at all), so therefore don't
    // offer the option.
    this.showItem("mailContext-openInBrowser",
                  notOnSpecialItem &&
                  loadedProtocol &&
                  loadedProtocol != "about:" && loadedProtocol != "chrome:");

    // Only show mailContext-openLinkInBrowser if we're on a link and it isn't
    // a mailto link.
    this.showItem("mailContext-openLinkInBrowser",
                  this.onLink && !this.onMailtoLink &&
                  this.linkProtocol != "about" && this.linkProtocol != "chrome");
  },
  initMessageItems: function CM_initMessageItems() {
    // If we're not in a message related tab, we're just going to bulk hide most
    // items as this simplifies the logic below.
    if (!this.inMessageArea) {
      const messageTabSpecificItems = [
        "mailContext-openNewWindow", "threadPaneContext-openNewTab",
        "mailContext-openConversation",
        "mailContext-archive", "mailContext-replySender",
        "mailContext-editAsNew", "mailContext-replyNewsgroup",
        "mailContext-replyAll", "mailContext-replyList",
        "mailContext-forward", "mailContext-forwardAsMenu",
        "mailContext-multiForwardAsAttachment",
        "mailContext-copyMessageUrl", "mailContext-moveMenu",
        "mailContext-copyMenu", "mailContext-moveToFolderAgain",
        "mailContext-tags", "mailContext-mark", "mailContext-saveAs",
        "mailContext-printpreview", "mailContext-print", "mailContext-delete",
        "downloadSelected", "mailContext-reportPhishingURL"
      ];
      for (let i = 0; i < messageTabSpecificItems.length; ++i)
        this.showItem(messageTabSpecificItems[i], false);
      return;
    }

    let canMove = gFolderDisplay.canDeleteSelectedMessages;

    // Show the Open in New Window and New Tab options if there is exactly one
    // message selected.
    this.showItem("mailContext-openNewWindow",
                  this.numSelectedMessages == 1 && this.inThreadPane);
    this.showItem("threadPaneContext-openNewTab",
                  this.numSelectedMessages == 1 && this.inThreadPane);

    this.showItem("mailContext-openConversation",
                  this.numSelectedMessages == 1 && this.inThreadPane &&
                  gConversationOpener.isSelectedMessageIndexed());

    this.setSingleSelection("mailContext-replySender");
    this.setSingleSelection("mailContext-editAsNew");
    this.setSingleSelection("mailContext-replyNewsgroup", this.isNewsgroup);
    this.setSingleSelection("mailContext-replyAll");
    this.setSingleSelection("mailContext-replyList");
    this.setSingleSelection("mailContext-forward");
    this.setSingleSelection("mailContext-forwardAsMenu");

    this.showItem("mailContext-multiForwardAsAttachment",
                  this.numSelectedMessages > 1 && this.inThreadPane &&
                  !this.hideMailItems);

    this.setSingleSelection("mailContext-copyMessageUrl", this.isNewsgroup);

    let msgModifyItems = this.numSelectedMessages > 0 && !this.hideMailItems &&
      !this.onPlayableMedia &&
      !(this.numSelectedMessages == 1 && gMessageDisplay.isDummy);
    let canArchive = gFolderDisplay.canArchiveSelectedMessages;

    this.showItem("mailContext-archive", canMove && msgModifyItems &&
                                         canArchive);

    // Set up the move menu. We can't move from newsgroups.
    this.showItem("mailContext-moveMenu",
                  msgModifyItems && !this.isNewsgroup);

    // disable move if we can't delete message(s) from this folder
    this.enableItem("mailContext-moveMenu", canMove && !this.onPlayableMedia);

    // Copy is available as long as something is selected.
    let canCopy = msgModifyItems || (gMessageDisplay.isDummy &&
                                     window.arguments[0].scheme == "file");
    this.showItem("mailContext-copyMenu", canCopy);

    this.showItem("mailContext-moveToFolderAgain", msgModifyItems);
    if (msgModifyItems) {
      initMoveToFolderAgainMenu(document.getElementById("mailContext-moveToFolderAgain"));
      goUpdateCommand("cmd_moveToFolderAgain");
    }

    this.showItem("mailContext-tags", msgModifyItems);

    this.showItem("mailContext-mark", msgModifyItems);

    this.showItem("mailContext-ignoreThread", !this.inStandaloneWindow &&
                                              this.numSelectedMessages >= 1 &&
                                              !this.hideMailItems &&
                                              !this.onPlayableMedia);

    this.showItem("mailContext-ignoreSubthread", !this.inStandaloneWindow &&
                                                 this.numSelectedMessages >= 1 &&
                                                 !this.hideMailItems &&
                                                 !this.onPlayableMedia);

    this.showItem("mailContext-watchThread", !this.inStandaloneWindow &&
                                             this.numSelectedMessages > 0 &&
                                             !this.hideMailItems &&
                                             !this.onPlayableMedia);

    this.showItem("mailContext-afterWatchThread", !this.inStandaloneWindow);

    this.showItem("mailContext-saveAs", this.numSelectedMessages > 0 &&
                                        !this.hideMailItems &&
                                        !gMessageDisplay.isDummy &&
                                        !this.onPlayableMedia);


    if (Application.platformIsMac)
      this.showItem("mailContext-printpreview", false);
    else
      this.setSingleSelection("mailContext-printpreview");

    // XXX Not quite modifying the message, but the same rules apply at the
    // moment as we can't print non-message content from the message pane yet.
    this.showItem("mailContext-print", msgModifyItems);

    this.showItem("mailContext-delete",
                  msgModifyItems && (this.isNewsgroup || canMove));

    // This function is needed for the case where a folder is just loaded (while
    // there isn't a message loaded in the message pane), a right-click is done
    // in the thread pane. This function will disable enable the 'Delete
    // Message' menu item.
    goUpdateCommand('cmd_delete');

    this.showItem('downloadSelected',
                  this.numSelectedMessages > 1 && !this.hideMailItems);

    this.showItem("mailContext-reportPhishingURL",
                  !this.inThreadPane && this.onLink && !this.onMailtoLink);
  },
  initSeparators: function CM_initSeparators() {
    const mailContextSeparators = [
      "mailContext-sep-open-browser", "mailContext-sep-link",
      "mailContext-sep-open", "mailContext-sep-open2",
      "mailContext-sep-reply", "paneContext-afterMove",
      "mailContext-sep-afterTagAddNew", "mailContext-sep-afterTagRemoveAll",
      "mailContext-sep-afterMarkAllRead", "mailContext-sep-afterMarkFlagged",
      "mailContext-sep-afterMarkMenu", "mailContext-sep-edit",
      "mailContext-sep-copy", "mailContext-sep-reportPhishing",
      "mailContext-sep-undo", "mailContext-sep-clipboard",
      "mailContext-spell-suggestions-separator", "mailContext-spell-separator",
    ];
    mailContextSeparators.forEach(this.hideIfAppropriate, this);

    this.checkLastSeparator(this.menu);
  },

  /**
   * Set the nsContextMenu properties based on the selected node and
   * its ancestors.
   */
  setTarget : function CM_setTarget(aNode) {
    // Clear any old spellchecking items from the menu, this used to
    // be in the menu hiding code but wasn't getting called in all
    // situations. Here, we can ensure it gets cleaned up any time the
    // menu is shown. Note: must be before uninit because that clears the
    // internal vars
    // We also need to do that before we possibly bail because we just clicked
    // on some XUL node. Otherwise, dictionary choices just accumulate until we
    // right-click on some HTML element again.
    gSpellChecker.clearSuggestionsFromMenu();
    gSpellChecker.clearDictionaryListFromMenu();
    gSpellChecker.uninit();

    const xulNS =
      "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    if (aNode.namespaceURI == xulNS) {
      if (aNode.localName == "treecol") {
        // The column header was clicked, show the column picker.
        let treecols = aNode.parentNode;
        let nodeList = document.getAnonymousNodes(treecols);
        let treeColPicker;
        for (let i = 0; i < nodeList.length; i++) {
          if (nodeList.item(i).localName == "treecolpicker") {
            treeColPicker = nodeList.item(i);
            break;
          }
        }
        let popup = document.getAnonymousElementByAttribute(treeColPicker, "anonid", "popup");
        treeColPicker.buildPopup(popup);
        popup.openPopup(aNode, "before_start", 0, 0, true);
        this.shouldDisplay = false;
      }
      return;
    }
    this.onImage        = false;
    this.onLoadedImage  = false;
    this.onMetaDataItem = false;
    this.onTextInput    = false;
    this.imageURL       = "";
    this.onLink         = false;
    this.onVideo        = false;
    this.onAudio        = false;
    this.mediaURL       = "";
    this.linkURL        = "";
    this.linkURI        = null;
    this.linkProtocol   = null;
    this.onMathML       = false;

    this.target = aNode;

    // First, do checks for nodes that never have children.
    if (this.target.nodeType == Node.ELEMENT_NODE) {
      if (this.target instanceof Components.interfaces.nsIImageLoadingContent &&
          this.target.currentURI) {
        this.onImage = true;
        this.onMetaDataItem = true;

        var request = this.target.getRequest(Components.interfaces.nsIImageLoadingContent.CURRENT_REQUEST);
        if (request && (request.imageStatus & request.STATUS_SIZE_AVAILABLE))
          this.onLoadedImage = true;

        this.imageURL = this.target.currentURI.spec;
      } else if (this.target instanceof HTMLInputElement) {
        this.onTextInput = this.isTargetATextBox(this.target);
      } else if (this.target instanceof HTMLTextAreaElement) {
        this.onTextInput = true;
        if (!this.target.readOnly) {
          this.onEditableArea = true;
          gSpellChecker.init(this.target.QueryInterface(Components.interfaces.nsIDOMNSEditableElement).editor);
          gSpellChecker.initFromEvent(document.popupRangeParent, document.popupRangeOffset);
        }
      } else if (this.target instanceof HTMLCanvasElement) {
        this.onCanvas = true;
      } else if (this.target instanceof HTMLVideoElement) {
        this.onVideo = true;
        this.onPlayableMedia = true;
        this.mediaURL = this.target.currentSrc || this.target.src;
      } else if (this.target instanceof HTMLAudioElement) {
        this.onAudio = true;
        this.onPlayableMedia = true;
        this.mediaURL = this.target.currentSrc || this.target.src;
      // Browser supports background images here but we don't need to.
      }
    }

    // Second, bubble out, looking for items of interest that might be
    // parents of the click target, picking the innermost of each.
    const XMLNS = "http://www.w3.org/XML/1998/namespace";
    var elem = this.target;
    while (elem) {
      if (elem.nodeType == Node.ELEMENT_NODE) {
        // Link?
        if (!this.onLink &&
            ((elem instanceof HTMLAnchorElement && elem.href) ||
             elem instanceof HTMLAreaElement && elem.href ||
             elem instanceof HTMLLinkElement ||
             elem.getAttributeNS("http://www.w3.org/1999/xlink", "type") == "simple")) {

          // Target is a link or a descendant of a link.
          this.onLink = true;
          this.onMetaDataItem = true;
          // Remember corresponding element.
          this.link = elem;
          this.linkURL = this.getLinkURL();
          this.linkURI = this.getLinkURI();
          this.linkProtocol = this.getLinkProtocol();
          this.onMailtoLink = (this.linkProtocol == "mailto");
          this.onSaveableLink = this.isLinkSaveable();
        }

        // Text input?
        if (!this.onTextInput) {
          this.onTextInput = this.isTargetATextBox(elem);
        }

        // Metadata item?
        if (!this.onMetaDataItem) {
          if ((elem instanceof HTMLQuoteElement && elem.cite) ||
              (elem instanceof HTMLTableElement && elem.summary) ||
              (elem instanceof HTMLModElement &&
                (elem.cite || elem.dateTime)) ||
              (elem instanceof HTMLElement &&
                (elem.title || elem.lang)) ||
              (elem.getAttributeNS(XMLNS, "lang"))) {
            this.onMetaDataItem = true;
          }
        }

        // Browser supports background images here but we don't need to.
      }
      elem = elem.parentNode;
    }

    // See if the user clicked on MathML.
    const NS_MathML = "http://www.w3.org/1998/Math/MathML";
    if ((this.target.nodeType == Node.TEXT_NODE &&
         this.target.parentNode.namespaceURI == NS_MathML) ||
        (this.target.namespaceURI == NS_MathML))
      this.onMathML = true;
  },

  setMessageTargets: function CM_setMessageTargets(aNode) {
    let tabmail = document.getElementById("tabmail");
    if (tabmail) {
      // Not all tabs are message tabs - if we're in a tab mode that is in
      // mailTabType's list of modes, then we'll assume it is a message related
      // tab.
      this.inMessageArea = tabmail.selectedTab.mode.name in mailTabType.modes;
      this.inStandaloneWindow = false;
    }
    else {
      // Assume that if we haven't got a tabmail item, then we're in standalone
      // window
      this.inMessageArea = true;
      this.inStandaloneWindow = true;
    }

    if (!this.inMessageArea) {
      this.inThreadPane = false;
      this.numSelectedMessages = 1;
      this.isNewsgroup = false;
      this.hideMailItems = true;
      return;
    }

    this.inThreadPane = this.popupNodeIsInThreadPane(aNode);
    this.messagepaneIsBlank = (document.getElementById("messagepane")
      .contentWindow.location.href == "about:blank");

    this.numSelectedMessages = GetNumSelectedMessages();
    this.isNewsgroup = gFolderDisplay.selectedMessageIsNews;
    // Don't show mail items for links/images, just show related items.
    this.hideMailItems = !this.inThreadPane &&
                         (this.onImage || this.onLink);
  },

  /**
   * Get a computed style property for an element.
   * @param  aElem
   *         A DOM node
   * @param  aProp
   *         The desired CSS property
   * @return the value of the property
   */
  getComputedStyle: function CM_getComputedStyle(aElem, aProp) {
    return aElem.ownerDocument.defaultView.getComputedStyle(aElem, "")
                .getPropertyValue(aProp);
  },

  /**
   * Generate a URL string from a computed style property, for things like
   * |style="background-image:url(...)"|
   * @return a "url"-type computed style attribute value, with the "url(" and
   *         ")" stripped.
   */
  getComputedURL: function CM_getComputedURL(aElem, aProp) {
    var url = aElem.ownerDocument.defaultView.getComputedStyle(aElem, "")
                   .getPropertyCSSValue(aProp);
    return (url.primitiveType == CSSPrimitiveValue.CSS_URI) ? url.getStringValue() : null;
  },

  /**
   * Determine whether the clicked-on link can be saved, and whether it
   * may be saved according to the ScriptSecurityManager.
   * @return true if the protocol can be persisted and if the target has
   *         permission to link to the URL, false if not
   */
  isLinkSaveable : function CM_isLinkSaveable() {
    try {
      const nsIScriptSecurityManager =
        Components.interfaces.nsIScriptSecurityManager;
      Services.scriptSecurityManager.checkLoadURIWithPrincipal(this.target.nodePrincipal,
          this.linkURI, nsIScriptSecurityManager.STANDARD);
    } catch (e) {
      // Don't save things we can't link to.
      return false;
    }

    // We don't do the Right Thing for news/snews yet, so turn them off
    // until we do.
    return this.linkProtocol && !(
             this.linkProtocol == "mailto" ||
             this.linkProtocol == "javascript" ||
             this.linkProtocol == "news" ||
             this.linkProtocol == "snews");
  },

  /**
   * Save URL of clicked-on link.
   */
  saveLink : function CM_saveLink() {
    saveURL(this.linkURL, this.linkText(), null, true, null, null, document);
  },

  /**
   * Save a clicked-on image.
   */
  saveImage : function CM_saveImage() {
    saveURL(this.imageURL, null, "SaveImageTitle", false, null, null, document);
  },

  /**
   * Extract email addresses from a mailto: link and put them on the
   * clipboard.
   */
  copyEmail : function CM_copyEmail() {
    // Copy the comma-separated list of email addresses only.
    // There are other ways of embedding email addresses in a mailto:
    // link, but such complex parsing is beyond us.

    const kMailToLength = 7; // length of "mailto:"

    var url = this.linkURL;
    var qmark = url.indexOf("?");
    var addresses;

    if (qmark > kMailToLength) {
      addresses = url.substring(kMailToLength, qmark);
    } else {
      addresses = url.substr(kMailToLength);
    }

    // Let's try to unescape it using a character set.
    try {
      var characterSet = this.target.ownerDocument.characterSet;
      const textToSubURI = Components.classes["@mozilla.org/intl/texttosuburi;1"]
                                     .getService(Components.interfaces.nsITextToSubURI);
      addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
    }
    catch(ex) {
      // Do nothing.
    }

    var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                              .getService(Components.interfaces.nsIClipboardHelper);
    clipboard.copyString(addresses);
  },

  ///////////////
  // Utilities //
  ///////////////

  /**
   * Set a DOM node's hidden property by passing in the node's id or the
   * element itself.
   * @param aItemOrId
   *        a DOM node or the id of a DOM node
   * @param aShow
   *        true to show, false to hide
   */
  showItem : function CM_showItem(aItemOrId, aShow) {
    var item = aItemOrId.constructor == String ? document.getElementById(aItemOrId) : aItemOrId;
    item.hidden = !aShow;
  },

  /**
   * Set a DOM node's disabled property by passing in the node's id or the
   * element itself.
   *
   * @param aItemOrId  A DOM node or the id of a DOM node
   * @param aEnabled   True to enable the element, false to disable.
   */
  enableItem: function CM_enableItem(aItemOrId, aEnabled) {
    var item = aItemOrId.constructor == String ? document.getElementById(aItemOrId) : aItemOrId;
    item.disabled = !aEnabled;
  },

  /**
   * Most menu items are visible if there's 1 or 0 messages selected, and
   * enabled if there's exactly one selected. Handle those here.
   * Exception: playable media is selected, in which case, don't show them.
   *
   * @param aID   the id of the element to display/enable
   * @param aHide (optional)  an additional criteria to evaluate when we
   *              decide whether to display the element. If false, we'll hide
   *              the item no matter what messages are selected
   */
  setSingleSelection: function CM_setSingleSelection(aID, aHide) {
    var hide = aHide != undefined ? aHide : true;
    this.showItem(aID, this.numSelectedMessages == 1 && !this.hideMailItems &&
                  hide && !this.onPlayableMedia);
    this.enableItem(aID, this.numSelectedMessages == 1);
  },

  /**
   * Set given attribute of specified context-menu item. If the
   * value is null, then it removes the attribute (which works
   * nicely for the disabled attribute).
   * @param  aId
   *         The id of an element
   * @param  aAttr
   *         The attribute name
   * @param  aVal
   *         The value to set the attribute to, or null to remove the attribute
   */
  setItemAttr : function CM_setItemAttr(aId, aAttr, aVal) {
    var elem = document.getElementById(aId);
    if (elem) {
      if (aVal == null) {
        // null indicates attr should be removed.
        elem.removeAttribute(aAttr);
      } else {
        // Set attr=val.
        elem.setAttribute(aAttr, aVal);
      }
    }
  },

  /**
   * Get an absolute URL for clicked-on link, from the href property or by
   * resolving an XLink URL by hand.
   * @return the string absolute URL for the clicked-on link
   */
  getLinkURL : function CM_getLinkURL() {
    if (this.link.href) {
      return this.link.href;
    }
    var href = this.link.getAttributeNS("http://www.w3.org/1999/xlink","href");
    if (!href || (href.trim() == "")) {
       // Without this we try to save as the current doc,
       // for example, HTML case also throws if empty.
      throw "Empty href";
    }
    href = this.makeURLAbsolute(this.link.baseURI,href);
    return href;
  },

  /**
   * Generate a URI object from the linkURL spec
   * @return an nsIURI if possible, or null if not
   */
  getLinkURI: function CM_getLinkURI() {
    try {
      return Services.io.newURI(this.linkURL, null, null);
    } catch (ex) {
      // e.g. empty URL string
    }
    return null;
  },

  /**
   * Get the scheme for the clicked-on linkURI, if present.
   * @return a scheme, possibly undefined, or null if there's no linkURI
   */
  getLinkProtocol: function CM_getLinkProtocol() {
    if (this.linkURI)
      return this.linkURI.scheme; // can be |undefined|

    return null;
  },

  /**
   * Get some text, any text, for the clicked-on link.
   * @return the link text, title, alt, href, or "" if everything fails
   */
  linkText : function CM_linkText() {
    var text = gatherTextUnder(this.link);
    if (!text || (text.trim() == "")) {
      text = this.link.getAttribute("title");
      if (!text || (text.trim() == "")) {
        text = this.link.getAttribute("alt");
        if (!text || (text.trim() == "")) {
          if (this.link.href) {
            text = this.link.href;
          } else {
            text = getAttributeNS("http://www.w3.org/1999/xlink", "href");
            if (text && !(text.trim() == "")) {
              text = this.makeURLAbsolute(this.link.baseURI, text);
            }
          }
        }
      }
    }

    return text;
  },

  /**
   * Determines whether the focused window has something selected.
   * @return true if there is a selection, false if not
   */
  isContentSelection : function CM_isContentSelection() {
    return !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
  },

  /**
   * Determines whether the context menu was triggered by a node that's a child
   * of the threadpane by looking for a parent node with id="threadTree".
   * @return true if the popupNode is a child of the threadpane, otherwise false
   */
  popupNodeIsInThreadPane: function CM_popupNodeIsInThreadPane(aNode) {
    var node = aNode;
    while (node)
    {
      if (node.id == "threadTree")
        return true;

      node = node.parentNode;
    }
    return false;
  },

  /**
   * Convert relative URL to absolute, using a provided <base>.
   * @param  aBase
   *         The URL string to use as the base
   * @param  aUrl
   *         The possibly-relative URL string
   * @return The string absolute URL
   */
  makeURLAbsolute : function CM_makeURLAbsolute(aBase, aUrl) {
    // Construct nsIURL.
    var baseURI  = Services.io.newURI(aBase, null, null);

    return Services.io.newURI(baseURI.resolve(aUrl), null, null).spec;
  },

  /**
   * Determine whether a DOM node is a text or password input, or a textarea.
   * @param  aNode
   *         The DOM node to check
   * @return true for textboxes, false for other elements
   */
  isTargetATextBox : function CM_isTargetATextBox(aNode) {
    if (aNode instanceof HTMLInputElement)
      return (aNode.type == "text" || aNode.type == "password");

    return (aNode instanceof HTMLTextAreaElement);
  },

  /**
   * Hide a separator based on whether there are any non-hidden items between
   * it and the previous separator.
   *
   * @param aSeparatorID  The id of the separator element.
   */
  hideIfAppropriate: function CM_hideIfAppropriate(aSeparatorID) {
    this.showItem(aSeparatorID, this.shouldShowSeparator(aSeparatorID));
  },

  /**
   * Determine whether a separator should be shown based on whether
   * there are any non-hidden items between it and the previous separator.
   * @param  aSeparatorID
   *         The id of the separator element
   * @return true if the separator should be shown, false if not
   */
  shouldShowSeparator : function CM_shouldShowSeparator(aSeparatorID) {
    var separator = document.getElementById(aSeparatorID);
    if (separator) {
      var sibling = separator.previousSibling;
      while (sibling && sibling.localName != "menuseparator") {
        if (sibling.getAttribute("hidden") != "true")
          return true;
        sibling = sibling.previousSibling;
      }
    }
    return false;
  },

  /**
   * Ensures that there isn't a separator shown at the bottom of the menu.
   *
   * @param aPopup  The menu to check.
   */
  checkLastSeparator: function CM_checkLastSeparator(aPopup) {
    let sibling = aPopup.lastChild;
    while (sibling) {
      if (sibling.getAttribute("hidden") != "true") {
        if (sibling.localName == "menuseparator") {
          // If we got here then the item is a menuseparator and everything
          // below it hidden.
          sibling.setAttribute("hidden", true);
          return;
        }
        else
          return;
      }
      sibling = sibling.previousSibling;
    }
  },

  openInBrowser: function CM_openInBrowser() {
    let uri = Services.io.newURI(this.target.ownerDocument.defaultView.
                                 top.location.href, null, null);

    Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
              .getService(Components.interfaces.nsIExternalProtocolService)
              .loadURI(uri);
  },

  openLinkInBrowser: function CM_openLinkInBrowser() {
    Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
      .getService(Components.interfaces.nsIExternalProtocolService)
      .loadURI(this.linkURI);
  },

  mediaCommand : function CM_mediaCommand(command) {
    var media = this.target;

    switch (command) {
      case "play":
        media.play();
        break;
      case "pause":
        media.pause();
        break;
      case "mute":
        media.muted = true;
        break;
      case "unmute":
        media.muted = false;
        break;
      // XXX hide controls & show controls don't work in emails as Javascript is
      // disabled. May want to consider later for RSS feeds.
    }
  }
};
