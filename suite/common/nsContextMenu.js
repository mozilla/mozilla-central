/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   William A. ("PowerGUI") Law <law@netscape.com>
 *   Blake Ross <blakeross@telocity.com>
 *   Gervase Markham <gerv@gerv.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/*------------------------------ nsContextMenu ---------------------------------
|   This JavaScript "class" is used to implement the browser's content-area    |
|   context menu.                                                              |
|                                                                              |
|   For usage, see references to this class in navigator.xul.                  |
|                                                                              |
|   Currently, this code is relatively useless for any other purpose.  In the  |
|   longer term, this code will be restructured to make it more reusable.      |
------------------------------------------------------------------------------*/

function nsContextMenu( xulMenu ) {
    this.target            = null;
    this.menu              = null;
    this.popupURL          = null;
    this.onTextInput       = false;
    this.onImage           = false;
    this.onLoadedImage     = false;
    this.onCanvas          = false;
    this.onVideo           = false;
    this.onAudio           = false;
    this.onLink            = false;
    this.onMailtoLink      = false;
    this.onSaveableLink    = false;
    this.onMetaDataItem    = false;
    this.onMathML          = false;
    this.link              = false;
    this.inFrame           = false;
    this.hasBGImage        = false;
    this.isTextSelected    = false;
    this.isContentSelected = false;
    this.inDirList         = false;
    this.shouldDisplay     = true;
    this.autoDownload      = false;

    // Initialize new menu.
    this.initMenu( xulMenu );
}

// Prototype for nsContextMenu "class."
nsContextMenu.prototype = {
    // onDestroy is a no-op at this point.
    onDestroy : function () {
    },
    // Initialize context menu.
    initMenu : function ( popup ) {
        // Save menu.
        this.menu = popup;

        // Get contextual info.
        this.setTarget( document.popupNode, document.popupRangeParent,
                        document.popupRangeOffset );

        this.isTextSelected = this.isTextSelection();
        this.isContentSelected = this.isContentSelection();

        this.initPopupURL();

        // Initialize (disable/remove) menu items.
        this.initItems();
    },
    initItems : function () {
        this.initOpenItems();
        this.initNavigationItems();
        this.initViewItems();
        this.initMiscItems();
        this.initSpellingItems();
        this.initSaveItems();
        this.initClipboardItems();
        this.initMetadataItems();
        this.initMediaPlayerItems();
    },
    initOpenItems : function () {
        var showOpen = this.onSaveableLink || ( this.inDirList && this.onLink );

        this.showItem( "context-openlink", showOpen );
        this.showItem( "context-openlinkintab", showOpen );

        this.showItem( "context-sep-open", showOpen );
    },
    initNavigationItems : function () {
        // Back determined by canGoBack broadcaster.
        this.setItemAttrFromNode( "context-back", "disabled", "canGoBack" );

        // Forward determined by canGoForward broadcaster.
        this.setItemAttrFromNode( "context-forward", "disabled", "canGoForward" );

        var showNav = !( this.isContentSelected || this.onLink || this.onImage ||
                         this.onCanvas || this.onVideo || this.onAudio || this.onTextInput );
        
        this.showItem( "context-back", showNav );
        this.showItem( "context-forward", showNav );

        this.showItem( "context-reload", showNav );
        
        this.showItem( "context-stop", showNav );
        this.showItem( "context-sep-stop", showNav );

        // XXX: Stop is determined in navigator.js; the canStop broadcaster is broken
        //this.setItemAttrFromNode( "context-stop", "disabled", "canStop" );
    },
    initSaveItems : function () {
        var showSave = !( this.inDirList || this.isContentSelected || this.onTextInput ||
                          this.onStandaloneImage || this.onCanvas || this.onVideo || this.onAudio ||
                       ( this.onLink && this.onImage ) );
        if (showSave)
          goSetMenuValue( "context-savepage", this.autoDownload ? "valueSave" : "valueSaveAs" );
        this.showItem( "context-savepage", showSave );

        // Save/send link depends on whether we're in a link.
        if (this.onSaveableLink)
          goSetMenuValue( "context-savelink", this.autoDownload ? "valueSave" : "valueSaveAs" );
        this.showItem( "context-savelink", this.onSaveableLink );
        this.showItem( "context-sendlink", this.onSaveableLink );

        // Save image depends on having loaded its content, video and audio don't.
        showSave = this.onLoadedImage || this.onStandaloneImage || this.onCanvas;
        if (showSave)
          goSetMenuValue( "context-saveimage", this.autoDownload ? "valueSave" : "valueSaveAs" );
        this.showItem( "context-saveimage", showSave );
        this.showItem( "context-savevideo", this.onVideo );
        this.showItem( "context-saveaudio", this.onAudio );
        if (this.onVideo)
          this.setItemAttr( "context-savevideo", "disabled", !this.mediaURL );
        if (this.onAudio)
          this.setItemAttr( "context-saveaudio", "disabled", !this.mediaURL );
        // Send media URL (but not for canvas, since it's a big data: URL)
        this.showItem( "context-sendimage", showSave );
        this.showItem( "context-sendvideo", this.onVideo );
        this.showItem( "context-sendaudio", this.onAudio );
        if (this.onVideo)
          this.setItemAttr( "context-sendvideo", "disabled", !this.mediaURL );
        if (this.onAudio)
          this.setItemAttr( "context-sendaudio", "disabled", !this.mediaURL );
    },
    initViewItems : function () {
        // View source is always OK, unless in directory listing.
        this.showItem( "context-viewpartialsource-selection", this.isContentSelected && !this.onTextInput );
        this.showItem( "context-viewpartialsource-mathml", this.onMathML && !this.isContentSelected );

        var showView = !( this.inDirList || this.onImage || this.isContentSelected || this.onCanvas ||
                          this.onVideo || this.onAudio || this.onLink || this.onTextInput );

        this.showItem( "context-viewsource", showView );
        this.showItem( "context-viewinfo", showView );

        this.showItem( "context-sep-properties", !( this.inDirList || this.isContentSelected || this.onTextInput ||
                                                    this.onCanvas || this.onVideo || this.onAudio ) );
        // Set As Wallpaper depends on whether an image was clicked on,
        // and requires the shell service.
        var hasShell = "@mozilla.org/suite/shell-service;1" in Components.classes;
        this.showItem( "context-setWallpaper", hasShell && (this.onLoadedImage || this.onStandaloneImage));

        this.showItem( "context-sep-image", this.onLoadedImage || this.onStandaloneImage);

        if( hasShell && this.onLoadedImage )
            // Disable the Set As Wallpaper menu item if we're still trying to load the image
          this.setItemAttr( "context-setWallpaper", "disabled", (("complete" in this.target) && !this.target.complete) ? "true" : null );

        this.showItem( "context-fitimage", this.onStandaloneImage && content.document.imageResizingEnabled );
        if ( this.onStandaloneImage && content.document.imageResizingEnabled ) {
          this.setItemAttr( "context-fitimage", "disabled", content.document.imageIsOverflowing ? null : "true");
          this.setItemAttr( "context-fitimage", "checked", content.document.imageIsResized ? "true" : null);
        }

        this.showItem( "context-reloadimage", this.onImage);

        // View Image depends on whether an image was clicked on.
        this.showItem( "context-viewimage", this.onImage &&
                      ( !this.onStandaloneImage || this.inFrame ) || this.onCanvas );

        this.showItem( "context-viewvideo", this.onVideo && (this.inFrame ||
                      this.mediaURL != this.target.ownerDocument.location.href));
        this.setItemAttr( "context-viewvideo", "disabled", !this.mediaURL);

        // View background image depends on whether there is one.
        this.showItem( "context-viewbgimage", showView && !this.onStandaloneImage);
        this.showItem( "context-sep-viewbgimage", showView && !this.onStandaloneImage);
        this.setItemAttr( "context-viewbgimage", "disabled", this.hasBGImage ? null : "true");
    },
    initMiscItems : function () {
        // Use "Bookmark This Link" if on a link.
        this.showItem( "context-bookmarkpage", !( this.isContentSelected || this.onTextInput ||
                                                  this.onStandaloneImage || this.onVideo || this.onAudio ) );
        this.showItem( "context-bookmarklink", this.onLink && !this.onMailtoLink );
        this.showItem( "context-searchselect", this.isTextSelected && !this.onTextInput );
        this.showItem( "frame", this.inFrame );
        this.showItem( "frame-sep", this.inFrame );
        if (this.inFrame)
          goSetMenuValue( "saveframeas", this.autoDownload ? "valueSave" : "valueSaveAs" );
        var blocking = true;
        if (this.popupURL)
          try {
            const PM = Components.classes["@mozilla.org/PopupWindowManager;1"]
                       .getService(Components.interfaces.nsIPopupWindowManager);
            blocking = PM.testPermission(this.popupURL) ==
                       Components.interfaces.nsIPopupWindowManager.DENY_POPUP;
          } catch (e) {
          }

        this.showItem( "popupwindow-reject", this.popupURL && !blocking);
        this.showItem( "popupwindow-allow", this.popupURL && blocking);
        this.showItem( "context-sep-popup", this.popupURL);

        // BiDi UI
        this.showItem( "context-sep-bidi", gShowBiDi);
        this.showItem( "context-bidi-text-direction-toggle", this.onTextInput && gShowBiDi);
        this.showItem( "context-bidi-page-direction-toggle", !this.onTextInput && gShowBiDi);
    },
    initSpellingItems : function () {
        var canSpell = InlineSpellCheckerUI.canSpellCheck;
        var onMisspelling = InlineSpellCheckerUI.overMisspelling;
        this.showItem("spell-check-enabled", canSpell);
        this.showItem("spell-separator", canSpell || this.possibleSpellChecking);
        if (canSpell)
            document.getElementById("spell-check-enabled").setAttribute("checked",
                                                                        InlineSpellCheckerUI.enabled);
        this.showItem("spell-add-to-dictionary", onMisspelling);
        this.showItem("spell-ignore-word", onMisspelling);

        // suggestion list
        this.showItem("spell-add-separator", onMisspelling);
        this.showItem("spell-suggestions-separator", onMisspelling);
        if (onMisspelling) {
            var menu = document.getElementById("contentAreaContextMenu");
            var suggestionsSeparator = document.getElementById("spell-add-separator");
            var numsug = InlineSpellCheckerUI.addSuggestionsToMenu(menu, suggestionsSeparator, 5);
            this.showItem("spell-no-suggestions", numsug == 0);
        } else {
            this.showItem("spell-no-suggestions", false);
        }

        // dictionary list
        this.showItem("spell-dictionaries", InlineSpellCheckerUI.enabled);
        if (canSpell) {
            var dictMenu = document.getElementById("spell-dictionaries-menu");
            var dictSep = document.getElementById("spell-language-separator");
            InlineSpellCheckerUI.addDictionaryListToMenu(dictMenu, dictSep);
        }

        // when there is no spellchecker but we might be able to spellcheck
        // add the add to dictionaries item. This will ensure that people
        // with no dictionaries will be able to download them
        this.showItem("spell-add-dictionaries-main", !canSpell && this.possibleSpellChecking);
    },
    initClipboardItems : function () {

        // Copy depends on whether there is selected text.
        // Enabling this context menu item is now done through the global
        // command updating system
        // this.setItemAttr( "context-copy", "disabled", !this.isTextSelected() );

        goUpdateGlobalEditMenuItems();

        this.showItem( "context-undo", this.onTextInput );
        this.showItem( "context-redo", this.onTextInput );
        this.showItem( "context-sep-undo", this.onTextInput );
        this.showItem( "context-cut", this.onTextInput );
        this.showItem( "context-copy", this.isContentSelected || this.onTextInput);
        this.showItem( "context-paste", this.onTextInput );
        this.showItem( "context-delete", this.onTextInput );
        this.showItem( "context-sep-paste", this.onTextInput );
        this.showItem( "context-selectall", !( this.onLink || this.onImage || this.onVideo || this.onAudio ) );
        this.showItem( "context-sep-selectall", this.isContentSelected && !this.onTextInput );
        // In a text area there will be nothing after select all, so we don't want a sep
        // Otherwise, if there's text selected then there are extra menu items
        // (search for selection and view selection source), so we do want a sep

        // XXX dr
        // ------
        // nsDocumentViewer.cpp has code to determine whether we're
        // on a link or an image. we really ought to be using that...

        // Copy email link depends on whether we're on an email link.
        this.showItem( "context-copyemail", this.onMailtoLink );

        // Copy link location depends on whether we're on a link.
        this.showItem( "context-copylink", this.onLink );
        this.showItem( "context-sep-copylink", this.onLink );

        // Copy image location depends on whether we're on an image.
        this.showItem( "context-copyimage", this.onImage );
        // Copy Image Location (regression fix for bug 469481)
        this.showItem( "context-copyimageurl", this.onImage );
        this.showItem( "context-copyvideourl", this.onVideo );
        this.showItem( "context-copyaudiourl", this.onAudio );
        if (this.onVideo)
          this.setItemAttr( "context-copyvideourl", "disabled", !this.mediaURL );
        if (this.onAudio)
          this.setItemAttr( "context-copyaudiourl", "disabled", !this.mediaURL );
        this.showItem( "context-sep-copyimage", this.onImage || this.onVideo || this.onAudio );
    },
    initMetadataItems : function () {
        // Show if user clicked on something which has metadata.
        this.showItem( "context-metadata", this.onMetaDataItem );
    },
    initMediaPlayerItems : function () {
        var onMedia = ( this.onVideo || this.onAudio );
        // Several mutually exclusive items... play/pause, mute/unmute, show/hide
        this.showItem( "context-media-play", onMedia && (this.target.paused || this.target.ended) );
        this.showItem( "context-media-pause", onMedia && !this.target.paused && !this.target.ended );
        this.showItem( "context-media-mute", onMedia && !this.target.muted );
        this.showItem( "context-media-unmute", onMedia && this.target.muted );
        this.showItem( "context-media-showcontrols", onMedia && !this.target.controls );
        this.showItem( "context-media-hidecontrols", onMedia && this.target.controls );
        // Disable them when there isn't a valid media source loaded.
        if (onMedia) {
          var hasError = this.target.error != null;
          this.setItemAttr( "context-media-play", "disabled", hasError );
          this.setItemAttr( "context-media-pause", "disabled", hasError );
          this.setItemAttr( "context-media-mute", "disabled", hasError );
          this.setItemAttr( "context-media-unmute", "disabled", hasError );
          this.setItemAttr( "context-media-showcontrols", "disabled", hasError );
          this.setItemAttr( "context-media-hidecontrols", "disabled", hasError );
        }
        this.showItem( "context-media-sep-commands", onMedia );
    },
    // Set various context menu attributes based on the state of the world.
    setTarget : function ( node, rangeParent, rangeOffset ) {
        const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        if ( node.namespaceURI == xulNS ) {
          this.shouldDisplay = false;
          return;
        }
        // Initialize contextual info.
        this.onImage    = false;
        this.onLoadedImage = false;
        this.onStandaloneImage = false;
        this.onCanvas          = false;
        this.onVideo           = false;
        this.onAudio           = false;
        this.onMetaDataItem = false;
        this.onTextInput = false;
        this.mediaURL   = "";
        this.onLink     = false;
        this.onMathML   = false;
        this.inFrame    = false;
        this.hasBGImage = false;
        this.bgImageURL = "";
        this.possibleSpellChecking = false;

        // Remember the node that was clicked.
        this.target = node;

        this.autoDownload = Components.classes["@mozilla.org/preferences-service;1"]
                                      .getService(Components.interfaces.nsIPrefBranch)
                                      .getBoolPref("browser.download.useDownloadDir");

        // Clear any old spellchecking items from the menu, this used to
        // be in the menu hiding code but wasn't getting called in all
        // situations. Here, we can ensure it gets cleaned up any time the
        // menu is shown. Note: must be before uninit because that clears the
        // internal vars
        InlineSpellCheckerUI.clearSuggestionsFromMenu();
        InlineSpellCheckerUI.clearDictionaryListFromMenu();

        InlineSpellCheckerUI.uninit();

        // if the document is editable, show context menu like in text inputs
        var win = this.target.ownerDocument.defaultView;
        if (win) {
          var editingSession = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                  .getInterface(Components.interfaces.nsIWebNavigation)
                                  .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                  .getInterface(Components.interfaces.nsIEditingSession);
          if (editingSession.windowIsEditable(win) && this.isTargetEditable()) {
            this.onTextInput           = true;
            this.possibleSpellChecking = true;
            InlineSpellCheckerUI.init(editingSession.getEditorForWindow(win));
            var canSpell = InlineSpellCheckerUI.canSpellCheck;
            InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
            this.showItem("spell-check-enabled", canSpell);
            this.showItem("spell-separator", canSpell);
            return;
          }
        }

        // See if the user clicked on an image.
        if ( this.target.nodeType == Node.ELEMENT_NODE ) {
            if ( this.target instanceof Components.interfaces.nsIImageLoadingContent && this.target.currentURI  ) {
                this.onImage = true;
                var request = this.target.getRequest( Components.interfaces.nsIImageLoadingContent.CURRENT_REQUEST );
                if (request && (request.imageStatus & request.STATUS_SIZE_AVAILABLE))
                    this.onLoadedImage = true;
                this.mediaURL = this.target.currentURI.spec;

                if ( this.target.ownerDocument instanceof ImageDocument )
                   this.onStandaloneImage = true;
            } else if (this.target instanceof HTMLCanvasElement) {
                this.onCanvas = true;
            } else if ( this.target instanceof HTMLVideoElement ) {
                this.onVideo = true;
                this.mediaURL = this.target.currentSrc || this.target.src;
            } else if ( this.target instanceof HTMLAudioElement ) {
                this.onAudio = true;
                this.mediaURL = this.target.currentSrc || this.target.src;
            } else if ( this.target instanceof HTMLInputElement ) {
                this.onTextInput = this.isTargetATextBox(this.target);
                // allow spellchecking UI on all writable text boxes except passwords
                if (!this.target.readOnly && !this.target.disabled && this.target.type == "text") {
                    this.possibleSpellChecking = true;
                    InlineSpellCheckerUI.init(this.target.QueryInterface(Components.interfaces.nsIDOMNSEditableElement).editor);
                    InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
                }
            } else if ( this.target instanceof HTMLTextAreaElement ) {
                this.onTextInput = true;
                if (!this.target.readOnly && !this.target.disabled) {
                    this.possibleSpellChecking = true;
                    InlineSpellCheckerUI.init(this.target.QueryInterface(Components.interfaces.nsIDOMNSEditableElement).editor);
                    InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
                }
            } else if ( this.target instanceof HTMLHtmlElement ) {
               // pages with multiple <body>s are lame. we'll teach them a lesson.
               var bodyElt = this.target.ownerDocument.getElementsByTagName("body")[0];
               if ( bodyElt ) {
                 var computedURL = this.getComputedURL( bodyElt, "background-image" );
                 if ( computedURL ) {
                   this.hasBGImage = true;
                   this.bgImageURL = this.makeURLAbsolute( bodyElt.baseURI,
                                                           computedURL );
                 }
               }
            } else if ( "HTTPIndex" in content &&
                        content.HTTPIndex instanceof Components.interfaces.nsIHTTPIndex ) {
                this.inDirList = true;
                // Bubble outward till we get to an element with URL attribute
                // (which should be the href).
                var root = this.target;
                while ( root && !this.link ) {
                    if ( root.tagName == "tree" ) {
                        // Hit root of tree; must have clicked in empty space;
                        // thus, no link.
                        break;
                    }
                    if ( root.getAttribute( "URL" ) ) {
                        // Build pseudo link object so link-related functions work.
                        this.onLink = true;
                        this.link = { href : root.getAttribute("URL"),
                                      getAttribute: function (attr) {
                                          if (attr == "title") {
                                              return root.firstChild.firstChild.getAttribute("label");
                                          } else {
                                              return "";
                                          }
                                      }
                                    };
                        // If element is a directory, then you can't save it.
                        if ( root.getAttribute( "container" ) == "true" ) {
                            this.onSaveableLink = false;
                        } else {
                            this.onSaveableLink = true;
                        }
                    } else {
                        root = root.parentNode;
                    }
                }
            }
        }

        // We have meta data on images.
        this.onMetaDataItem = this.onImage;
        
        // See if the user clicked on MathML
        const NS_MathML = "http://www.w3.org/1998/Math/MathML";
        if ((this.target.nodeType == Node.TEXT_NODE &&
             this.target.parentNode.namespaceURI == NS_MathML)
             || (this.target.namespaceURI == NS_MathML))
          this.onMathML = true;

        // See if the user clicked in a frame.
        if ( this.target.ownerDocument != window.content.document ) {
            this.inFrame = true;
        }
        
        // Bubble out, looking for items of interest
        const XMLNS = "http://www.w3.org/XML/1998/namespace";
        var elem = this.target;
        while ( elem ) {
            if ( elem.nodeType == Node.ELEMENT_NODE ) {
                // Link?
                if ( !this.onLink && 
                    ( (elem instanceof HTMLAnchorElement && elem.href) ||
                      elem instanceof HTMLAreaElement ||
                      elem instanceof HTMLLinkElement ||
                      elem.getAttributeNS( "http://www.w3.org/1999/xlink", "type") == "simple" ) ) {
                    // Clicked on a link.
                    this.onLink = true;
                    this.onMetaDataItem = true;
                    // Remember corresponding element.
                    this.link = elem;
                    this.onMailtoLink = this.isLinkType( "mailto:", this.link );
                    // Remember if it is saveable.
                    this.onSaveableLink = this.isLinkSaveable( this.link );
                }
                
                // Text input?
                if ( !this.onTextInput ) {
                    // Clicked on a link.
                    this.onTextInput = this.isTargetATextBox(elem);
                }
                
                // Metadata item?
                if ( !this.onMetaDataItem ) {
                    // We currently display metadata on anything which fits
                    // the below test.
                    if ( ( elem instanceof HTMLQuoteElement && elem.cite)    ||
                         ( elem instanceof HTMLTableElement && elem.summary) ||
                         ( elem instanceof HTMLModElement &&
                             ( elem.cite || elem.dateTime ) )                ||
                         ( elem instanceof HTMLElement &&
                             ( elem.title || elem.lang ) )                   ||
                         elem.getAttributeNS(XMLNS, "lang") ) {
                        dump("On metadata item.\n");
                        this.onMetaDataItem = true;
                    }
                }

                // Background image?  Don't bother if we've already found a 
                // background image further down the hierarchy.  Otherwise,
                // we look for the computed background-image style.
                if ( !this.hasBGImage ) {
                    var bgImgUrl = this.getComputedURL( elem, "background-image" );
                    if ( bgImgUrl ) {
                        this.hasBGImage = true;
                        this.bgImageURL = this.makeURLAbsolute( elem.baseURI,
                                                                bgImgUrl );
                    }
                }
            }
            elem = elem.parentNode;    
        }
    },
    initPopupURL: function() {
      // quick check: if no opener, it can't be a popup
      if (!window.content.opener)
        return;
      try {
        var show = false;
        // is it a popup window?
        const CI = Components.interfaces;
        var xulwin = window
                    .QueryInterface(CI.nsIInterfaceRequestor)
                    .getInterface(CI.nsIWebNavigation)
                    .QueryInterface(CI.nsIDocShellTreeItem)
                    .treeOwner
                    .QueryInterface(CI.nsIInterfaceRequestor)
                    .getInterface(CI.nsIXULWindow);
        if (xulwin.contextFlags &
            CI.nsIWindowCreator2.PARENT_IS_LOADING_OR_RUNNING_TIMEOUT) {
          // do the pref settings allow site-by-site popup management?
          const PB = Components.classes["@mozilla.org/preferences-service;1"]
                     .getService(CI.nsIPrefBranch);
          show = !PB.getBoolPref("dom.disable_open_during_load");
        }
        if (show) {
          // initialize popupURL
          const IOS = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(CI.nsIIOService);
          this.popupURL = IOS.newURI(window.content.opener.location.href, null, null);

          // but cancel if it's an unsuitable URL
          const PM = Components.classes["@mozilla.org/PopupWindowManager;1"]
                     .getService(CI.nsIPopupWindowManager);
        }
      } catch(e) {
      }
    },
    // Returns the computed style attribute for the given element.
    getComputedStyle: function( elem, prop ) {
         return elem.ownerDocument.defaultView.getComputedStyle( elem, '' ).getPropertyValue( prop );
    },
    // Returns a "url"-type computed style attribute value, with the url() stripped.
    getComputedURL: function( elem, prop ) {
         var url = elem.ownerDocument.defaultView.getComputedStyle( elem, '' ).getPropertyCSSValue( prop );
         return ( url.primitiveType == CSSPrimitiveValue.CSS_URI ) ? url.getStringValue() : null;
    },
    // Returns true iff clicked on link is saveable.
    isLinkSaveable : function ( link ) {
        // We don't do the Right Thing for news/snews yet, so turn them off
        // until we do.
        return !(this.isLinkType( "mailto:" , link )     ||
                 this.isLinkType( "javascript:" , link ) ||
                 this.isLinkType( "news:", link )        || 
                 this.isLinkType( "snews:", link ) ); 
    },
    // Returns true iff clicked on link is of type given.
    isLinkType : function ( linktype, link ) {        
        try {
            // Test for missing protocol property.
            if ( !link.protocol ) {
                // We must resort to testing the URL string :-(.
                var protocol;
                if ( link.href ) {
                    protocol = link.href.substr( 0, linktype.length );
                } else {
                    protocol = link.getAttributeNS("http://www.w3.org/1999/xlink","href");
                    if ( protocol ) {
                        protocol = protocol.substr( 0, linktype.length );
                    }
                }
                return protocol.toLowerCase() === linktype;        
            } else {
                // Presume all but javascript: urls are saveable.
                return link.protocol.toLowerCase() === linktype;
            }
        } catch (e) {
            // something was wrong with the link,
            // so we won't be able to save it anyway
            return false;
        }
    },
    // Block popup windows
    rejectPopupWindows: function(andClose) {
      const PM = Components.classes["@mozilla.org/PopupWindowManager;1"]
                 .getService(Components.interfaces.nsIPopupWindowManager);
      PM.add(this.popupURL, false);
      if (andClose) {
        const OS = Components.classes["@mozilla.org/observer-service;1"]
                   .getService(Components.interfaces.nsIObserverService);
        OS.notifyObservers(window, "popup-perm-close", this.popupURL.spec);
      }
    },
    // Unblock popup windows
    allowPopupWindows: function() {
      const PM = Components.classes["@mozilla.org/PopupWindowManager;1"]
                 .getService(Components.interfaces.nsIPopupWindowManager);
      PM.add(this.popupURL, true);
    },
    // Open linked-to URL in a new window.
    openLink : function () {
        // Determine linked-to URL.
        openNewWindowWith( this.linkURL(), this.target.ownerDocument );
    },
    // Open linked-to URL in a new tab.
    openLinkInTab : function ( reverseBackgroundPref ) {
        // Determine linked-to URL.
        openNewTabWith( this.linkURL(), this.target.ownerDocument, reverseBackgroundPref );
    },
    // Open frame in a new tab.
    openFrameInTab : function ( reverseBackgroundPref ) {
        // Determine linked-to URL.
        openNewTabWith( this.target.ownerDocument.location.href, this.target.ownerDocument, reverseBackgroundPref );
    },
    // Reload clicked-in frame.
    reloadFrame : function () {
        this.target.ownerDocument.location.reload();
    },
    // Open clicked-in frame in its own window.
    openFrame : function () {
        openNewWindowWith( this.target.ownerDocument.location.href );
    },
    // Open clicked-in frame in the same window
    showOnlyThisFrame : function () {
        openTopWin( this.target.ownerDocument.location.href, this.target.ownerDocument.defaultView );
    },
    // View Partial Source
    viewPartialSource : function ( context ) {
        var focusedWindow = document.commandDispatcher.focusedWindow;
        if (focusedWindow == window)
          focusedWindow = content;
        var docCharset = null;
        if (focusedWindow)
          docCharset = "charset=" + focusedWindow.document.characterSet;

        // "View Selection Source" and others such as "View MathML Source"
        // are mutually exclusive, with the precedence given to the selection
        // when there is one
        var reference = null;
        if (context == "selection")
          reference = focusedWindow.getSelection();
        else if (context == "mathml")
          reference = this.target;
        else
          throw "not reached";

        var docUrl = null; // unused (and play nice for fragments generated via XSLT too)
        window.openDialog("chrome://navigator/content/viewPartialSource.xul",
                          "_blank", "scrollbars,resizable,chrome,dialog=no",
                          docUrl, docCharset, reference, context);
    },
    // Open new "view source" window with the frame's URL.
    viewFrameSource : function () {
        BrowserViewSourceOfDocument(this.target.ownerDocument);
    },
    viewInfo : function () {
        BrowserPageInfo();
    },
    viewFrameInfo : function () {
        BrowserPageInfo(this.target.ownerDocument);
    },
    toggleImageSize : function () {
        content.document.toggleImageSize();
    },
    // Reload image
    reloadImage : function () {
        urlSecurityCheck( this.mediaURL, this.target.nodePrincipal,
                          Components.interfaces.nsIScriptSecurityManager.ALLOW_CHROME );
        if (this.target instanceof Components.interfaces.nsIImageLoadingContent)
          this.target.forceReload();
    },
    // Change current window to the URL of the image, video, or audio.
    viewMedia : function () {
        var viewURL;
        if (this.onCanvas)
          viewURL = this.target.toDataURL();
        else {
          viewURL = this.mediaURL;
          urlSecurityCheck( viewURL, this.target.nodePrincipal,
                            Components.interfaces.nsIScriptSecurityManager.ALLOW_CHROME );
        }
        openTopWin( viewURL, this.target.ownerDocument.defaultView );
    },
    // Change current window to the URL of the background image.
    viewBGImage : function () {
        urlSecurityCheck( this.bgImageURL, this.target.nodePrincipal,
                          Components.interfaces.nsIScriptSecurityManager.ALLOW_CHROME );
        openTopWin( this.bgImageURL, this.target.ownerDocument.defaultView );
    },
    setWallpaper: function() {
      // Confirm since it's annoying if you hit this accidentally.
      var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                    .getService(Components.interfaces.nsIPromptService);
      var navigatorBundle = document.getElementById("bundle_navigator");
      var promptTitle = navigatorBundle.getString("wallpaperConfirmTitle");
      var promptMsg = navigatorBundle.getString("wallpaperConfirmMsg");
      var promptConfirmButton = navigatorBundle.getString("wallpaperConfirmButton");

      var buttonPressed = promptService.confirmEx(window, promptTitle, promptMsg,
                                                   (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0) +
                                                   (promptService.BUTTON_TITLE_CANCEL    * promptService.BUTTON_POS_1),
                                                   promptConfirmButton, null, null, null, {value:0});
 
      if (buttonPressed != 0)
        return;

      const nsIShellService = Components.interfaces.nsIShellService;

      Components.classes["@mozilla.org/suite/shell-service;1"]
                .getService(nsIShellService)
                .setDesktopBackground(this.target,
                                      nsIShellService.BACKGROUND_STRETCH);
    },    
    // Save URL of clicked-on frame.
    saveFrame : function () {
        saveDocument( this.target.ownerDocument );
    },
    // Save URL of clicked-on link.
    saveLink : function () {
        // canonical def in nsURILoader.h
        const NS_ERROR_SAVE_LINK_AS_TIMEOUT = 0x805d0020;

        var doc = this.target.ownerDocument;
        urlSecurityCheck(this.linkURL(), this.target.nodePrincipal);
        var linkText = this.linkText();
        var linkURL = this.linkURL();

        // an object to proxy the data through to
        // nsIExternalHelperAppService.doContent, which will wait for the
        // appropriate MIME-type headers and then prompt the user with a
        // file picker
        function SaveAsListener() {}
        SaveAsListener.prototype = {
          extListener: null,

          onStartRequest: function onStartRequest(aRequest, aContext) {
            // If the timer fired, the error status will have been caused by that,
            // and we'll be restarting in onStopRequest, so no reason to notify
            // the user.
            if (aRequest.status == NS_ERROR_SAVE_LINK_AS_TIMEOUT)
              return;

            clearTimeout(timer);

            // some other error occured; notify the user...
            if (!Components.isSuccessCode(aRequest.status)) {
              try {
                const sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                      .getService(Components.interfaces.nsIStringBundleService);
                const bundle = sbs.createBundle(
                        "chrome://mozapps/locale/downloads/downloads.properties");

                const title = bundle.GetStringFromName("downloadErrorAlertTitle");
                const msg = bundle.GetStringFromName("downloadErrorGeneric");

                const promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                            .getService(Components.interfaces.nsIPromptService);
                promptSvc.alert(doc.defaultView, title, msg);
              } catch (ex) {}
              return;
            }

            var extHelperAppSvc =
              Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
                        .getService(Components.interfaces.nsIExternalHelperAppService);
            var channel = aRequest.QueryInterface(Components.interfaces.nsIChannel);
            this.extListener =
              extHelperAppSvc.doContent(channel.contentType, aRequest,
                                        doc.defaultView, true);
            this.extListener.onStartRequest(aRequest, aContext);
          },

          onStopRequest: function onStopRequest(aRequest, aContext,
                                                aStatusCode) {
            if (aStatusCode == NS_ERROR_SAVE_LINK_AS_TIMEOUT) {
              // Do it the old fashioned way, which will pick the best filename
              // it can without waiting.
              saveURL(linkURL, linkText, null, true, false, doc.documentURIObject);
            }
            if (this.extListener)
              this.extListener.onStopRequest(aRequest, aContext, aStatusCode);
          },

          onDataAvailable: function onDataAvailable(aRequest, aContext,
                                                    aInputStream, aOffset,
                                                    aCount) {
            this.extListener.onDataAvailable(aRequest, aContext, aInputStream,
                                             aOffset, aCount);
          }
        }

        // in case we need to prompt the user for authentication
        function Callbacks() {}
        Callbacks.prototype = {
          getInterface: function getInterface(aIID) {
            if (aIID.equals(Components.interfaces.nsIAuthPrompt) ||
                aIID.equals(Components.interfaces.nsIAuthPrompt2)) {
              var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                 .getService(Components.interfaces.nsIPromptFactory);
              return ww.getPrompt(doc.defaultView, aIID);
            }
            throw Components.results.NS_ERROR_NO_INTERFACE;
          }
        }

        // If we don't have the headers after a short time the user won't have
        // received any feedback from the click. That's bad, so we give up
        // waiting for the filename.
        function timerCallback() {
          channel.cancel(NS_ERROR_SAVE_LINK_AS_TIMEOUT);
        }

        // set up a channel to do the saving
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                  .getService(Components.interfaces.nsIIOService);
        var channel = ioService.newChannel(linkURL, null, null);
        channel.notificationCallbacks = new Callbacks();
        channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE |
                             Components.interfaces.nsIChannel.LOAD_CALL_CONTENT_SNIFFERS;
        if (channel instanceof Components.interfaces.nsIHttpChannel)
          channel.referrer = doc.documentURIObject;

        // fallback to the old way if we don't see the headers quickly
        var timeToWait =
                Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch)
                          .getIntPref("browser.download.saveLinkAsFilenameTimeout");
        var timer = setTimeout(timerCallback, timeToWait);

        // kick off the channel with our proxy object as the listener
        channel.asyncOpen(new SaveAsListener(), null);
    },
    // Save URL of clicked-on image, video, or audio.
    saveMedia : function () {
        if (this.onCanvas)
          // Bypass cache, since it's a data: URL.
          saveImageURL( this.target.toDataURL(), "canvas.png", "SaveImageTitle",
                        true, null );
        else if (this.onImage)
          saveImageURL( this.mediaURL, null, "SaveImageTitle", false,
                        this.target.ownerDocument.documentURIObject );
        else if (this.onVideo || this.onAudio) {
          var dialogTitle = this.onVideo ? "SaveVideoTitle" : "SaveAudioTitle";
          saveURL( this.mediaURL, null, dialogTitle, false,
                   this.target.ownerDocument.documentURIObject );
        }
    },
    // Backwards-compatability wrapper
    saveImage : function () {
        if (this.onCanvas || this.onImage)
          this.saveMedia();
    },
    // Generate email address.
    getEmail : function () {
        // Get the comma-separated list of email addresses only.
        // There are other ways of embedding email addresses in a mailto:
        // link, but such complex parsing is beyond us.
        var addresses;
        try {
          // Let's try to unescape it using a character set
          var characterSet = this.target.ownerDocument.characterSet;
          const textToSubURI = Components.classes["@mozilla.org/intl/texttosuburi;1"]
                                         .getService(Components.interfaces.nsITextToSubURI);
          addresses = this.linkURL().match(/^mailto:([^?]+)/)[1];
          addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
        }
        catch(ex) {
          // Do nothing.
        }
        return addresses;
    },
    // Copy email to clipboard
    copyEmail : function () {
        var clipboard = this.getService( "@mozilla.org/widget/clipboardhelper;1",
                                         Components.interfaces.nsIClipboardHelper );
        clipboard.copyString(this.getEmail());
    },    
    addBookmark : function() {
      var docshell = document.getElementById( "content" ).webNavigation;
      BookmarksUtils.addBookmark( docshell.currentURI.spec,
                                  docshell.document.title,
                                  docshell.document.characterSet,
                                  false );
    },
    addBookmarkForFrame : function() {
      var doc = this.target.ownerDocument;
      var uri = doc.location.href;
      var title = doc.title;
      if ( !title )
        title = uri;
      BookmarksUtils.addBookmark( uri,
                                  title,
                                  doc.characterSet,
                                  false );
    },
    // Open Metadata window for node
    showMetadata : function () {
        window.openDialog(  "chrome://navigator/content/metadata.xul",
                            "_blank",
                            "scrollbars,resizable,chrome,dialog=no",
                            this.target);
    },

    ///////////////
    // Utilities //
    ///////////////

    // Create instance of component given contractId and iid (as string).
    createInstance : function ( contractId, iidName ) {
        var iid = Components.interfaces[ iidName ];
        return Components.classes[ contractId ].createInstance( iid );
    },
    // Get service given contractId and iid (as string).
    getService : function ( contractId, iidName ) {
        var iid = Components.interfaces[ iidName ];
        return Components.classes[ contractId ].getService( iid );
    },
    // Show/hide one item (specified via name or the item element itself).
    showItem : function ( itemOrId, show ) {
        var item = itemOrId.constructor == String ? document.getElementById(itemOrId) : itemOrId;
        if (item) 
          item.hidden = !show;
    },
    // Set given attribute of specified context-menu item.  If the
    // value is null, then it removes the attribute (which works
    // nicely for the disabled attribute).
    setItemAttr : function ( id, attr, val ) {
        var elem = document.getElementById( id );
        if ( elem ) {
            if ( val == null ) {
                // null indicates attr should be removed.
                elem.removeAttribute( attr );
            } else {
                // Set attr=val.
                elem.setAttribute( attr, val );
            }
        }
    },
    // Set context menu attribute according to like attribute of another node
    // (such as a broadcaster).
    setItemAttrFromNode : function ( item_id, attr, other_id ) {
        var elem = document.getElementById( other_id );
        if ( elem && elem.getAttribute( attr ) == "true" ) {
            this.setItemAttr( item_id, attr, "true" );
        } else {
            this.setItemAttr( item_id, attr, null );
        }
    },
    // Temporary workaround for DOM api not yet implemented by XUL nodes.
    cloneNode : function ( item ) {
        // Create another element like the one we're cloning.
        var node = document.createElement( item.tagName );

        // Copy attributes from argument item to the new one.
        var attrs = item.attributes;
        for ( var i = 0; i < attrs.length; i++ ) {
            var attr = attrs.item( i );
            node.setAttribute( attr.nodeName, attr.nodeValue );
        }

        // Voila!
        return node;
    },
    // Generate fully-qualified URL for clicked-on link.
    linkURL : function () {
        if (this.link.href) {
          return this.link.href;
        }
        var href = this.link.getAttributeNS("http://www.w3.org/1999/xlink","href");
        if (!href || !href.match(/\S/)) {
          throw "Empty href"; // Without this we try to save as the current doc, for example, HTML case also throws if empty
        }
        href = this.makeURLAbsolute(this.link.baseURI,href);
        return href;
    },
    // Get text of link.
    linkText : function () {
        var text = gatherTextUnder( this.link );
        if (!text || !text.match(/\S/)) {
          text = this.link.getAttribute("title");
          if (!text || !text.match(/\S/)) {
            text = this.link.getAttribute("alt");
            if (!text || !text.match(/\S/)) {
              if (this.link.href) {                
                text = this.link.href;
              } else {
                text = getAttributeNS("http://www.w3.org/1999/xlink", "href");
                if (text && text.match(/\S/)) {
                  text = this.makeURLAbsolute(this.link.baseURI, text);
                }
              }
            }
          }
        }

        return text;
    },

    /**
     * Determines whether the focused window has selected text, and if so
     * formats the first 15 characters for the label of the context-searchselect
     * element according to the searchText string.
     * @return true if there is selected text, false if not
     */
    isTextSelection : function isTextSelection() {
      var searchSelectText = this.searchSelected(16);
      if (!searchSelectText)
        return false;

      if (searchSelectText.length > 15)
        searchSelectText = searchSelectText.substr(0, 15) + "...";

      // Format "Search for <selection>" string to show in menu.
      const bundle = document.getElementById("contentAreaCommandsBundle");
      searchSelectText = bundle.getFormattedString("searchText",
                                                   [searchSelectText]);
      this.setItemAttr("context-searchselect", "label", searchSelectText);
      this.setItemAttr("context-searchselect", "accesskey",
                       bundle.getString("searchText.accesskey"));

      return true;
    },
    
    searchSelected : function( charlen ) {
        var focusedWindow = document.commandDispatcher.focusedWindow;
        var searchStr = focusedWindow.getSelection();
        searchStr = searchStr.toString();
        // searching for more than 150 chars makes no sense
        if (!charlen)
            charlen = 150;
        if (charlen < searchStr.length) {
            // only use the first charlen important chars. see bug 221361
            var pattern = new RegExp("^(?:\\s*.){0," + charlen + "}");
            pattern.test(searchStr);
            searchStr = RegExp.lastMatch;
        }

        return searchStr.trim().replace(/\s+/g, " ");
    },

    // Returns true if anything is selected.
    isContentSelection: function() {
        return !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
    },
    
    // Returns true if the target is editable
    isTargetEditable: function() {
        if (this.target.ownerDocument.designMode == "on")
            return true;

        for (var node = this.target; node; node = node.parentNode)
            if (node instanceof Components.interfaces.nsIDOMNSHTMLElement)
                switch (node.contentEditable) {
                    case "true":
                        return true;
                    case "false":
                        return false;
                    // case "inherit": continue;
                }

        return false;
    },

    // Convert relative URL to absolute, using document's <base>.
    makeURLAbsolute : function ( base, url ) {
        // Construct nsIURL.
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);
        var baseURI  = ioService.newURI(base, null, null);
        
        return ioService.newURI(baseURI.resolve(url), null, null).spec;
    },

    toString : function () {
        return "contextMenu.target     = " + this.target + "\n" +
               "contextMenu.onImage    = " + this.onImage + "\n" +
               "contextMenu.onLink     = " + this.onLink + "\n" +
               "contextMenu.link       = " + this.link + "\n" +
               "contextMenu.inFrame    = " + this.inFrame + "\n" +
               "contextMenu.hasBGImage = " + this.hasBGImage + "\n";
    },

    // Returns true if aNode is a from control (except text boxes and images).
    isTargetAFormControl : function( aNode )
    {
      if (aNode instanceof HTMLInputElement)
        return (aNode.type != "text" && aNode.type != "password" &&
                aNode.type != "image");

      return (aNode instanceof HTMLButtonElement) ||
             (aNode instanceof HTMLSelectElement) ||
             (aNode instanceof HTMLOptionElement) ||
             (aNode instanceof HTMLOptGroupElement);
    },

    isTargetATextBox : function ( node )
    {
      if (node instanceof HTMLInputElement)
        return (node.type == "text" || node.type == "password")

      return (node instanceof HTMLTextAreaElement);
    },

    // Determines whether or not the separator with the specified ID should be 
    // shown or not by determining if there are any non-hidden items between it
    // and the previous separator. 
    shouldShowSeparator : function ( aSeparatorID )
    {
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

    addDictionaries : function()
    {
      try {
        var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                      .getService(Components.interfaces.nsIURLFormatter);
        var url = formatter.formatURLPref("spellchecker.dictionaries.download.url");
        window.openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", url);
      }
      catch (ex) {}
    },

    mediaCommand : function (command) {
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
          case "hidecontrols":
            media.removeAttribute("controls");
            break;
          case "showcontrols":
            media.setAttribute("controls", "true");
            break;
        }
    },
    copyMediaLocation : function () {
        var clipboard = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                        .getService(Components.interfaces.nsIClipboardHelper);
        clipboard.copyString(this.mediaURL);
    },

    get imageURL() {
        if (this.onImage)
            return this.mediaURL;
        return "";
    }
};
/*************************************************************************
 *
 *   nsDefaultEngine : nsIObserver
 *
 *************************************************************************/
function nsDefaultEngine()
{
    try
    {
        var pb = Components.classes["@mozilla.org/preferences-service;1"].
                   getService(Components.interfaces.nsIPrefBranch);
        var pbi = pb.QueryInterface(
                    Components.interfaces.nsIPrefBranch2);
        pbi.addObserver(this.domain, this, false);

        // reuse code by explicitly invoking initial |observe| call
        // to initialize the |icon| and |name| member variables
        this.observe(pb, "", this.domain);
    }
    catch (ex)
    {
    }
}

nsDefaultEngine.prototype = 
{
    name: "",
    icon: "",
    domain: "browser.search.defaultengine",

    // nsIObserver implementation
    observe: function(aPrefBranch, aTopic, aPrefName)
    {
        try
        {
            var rdf = Components.
                        classes["@mozilla.org/rdf/rdf-service;1"].
                        getService(Components.interfaces.nsIRDFService);
            var ds = rdf.GetDataSource("rdf:internetsearch");
            var defaultEngine = aPrefBranch.getCharPref(aPrefName);
            var res = rdf.GetResource(defaultEngine);

            // get engine ``pretty'' name
            const kNC_Name = rdf.GetResource(
                               "http://home.netscape.com/NC-rdf#Name");
            var engineName = ds.GetTarget(res, kNC_Name, true);
            if (engineName)
            {
                this.name = engineName.QueryInterface(
                              Components.interfaces.nsIRDFLiteral).Value;
            }

            // get URL to engine vendor icon
            const kNC_Icon = rdf.GetResource(
                               "http://home.netscape.com/NC-rdf#Icon");
            var iconURL = ds.GetTarget(res, kNC_Icon, true);
            if (iconURL)
            {
                this.icon = iconURL.QueryInterface(
                  Components.interfaces.nsIRDFLiteral).Value;
            }
        }
        catch (ex)
        {
        }
    }
}
