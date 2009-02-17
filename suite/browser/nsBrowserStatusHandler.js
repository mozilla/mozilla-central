/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Ross <blakeross@telocity.com>
 *   Peter Annema <disttsc@bart.nl>
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

function nsBrowserStatusHandler()
{
  this.init();
}

nsBrowserStatusHandler.prototype =
{
  // Stored Status, Link and Loading values
  status : "",
  defaultStatus : "",
  jsStatus : "",
  jsDefaultStatus : "",
  overLink : "",
  feeds : [],

  QueryInterface : function(aIID)
  {
    if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
        aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
        aIID.equals(Components.interfaces.nsIXULBrowserWindow) ||
        aIID.equals(Components.interfaces.nsISupports))
      return this;
    throw Components.results.NS_NOINTERFACE;
  },

  init : function()
  {
    this.urlBar          = document.getElementById("urlbar");
    this.throbberElement = document.getElementById("navigator-throbber");
    this.statusMeter     = document.getElementById("statusbar-icon");
    this.statusPanel     = document.getElementById("statusbar-progresspanel");
    this.stopButton      = document.getElementById("stop-button");
    this.stopMenu        = document.getElementById("menuitem-stop");
    this.stopContext     = document.getElementById("context-stop");
    this.statusTextField = document.getElementById("statusbar-display");
    this.isImage         = document.getElementById("isImage");
    this.securityButton  = document.getElementById("security-button");
    this.feedsMenu       = document.getElementById("feedsMenu");
    this.feedsButton     = document.getElementById("feedsButton");

    // Initialize the security button's state and tooltip text
    const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;
    this.onSecurityChange(null, null, nsIWebProgressListener.STATE_IS_INSECURE);
  },

  destroy : function()
  {
    // XXXjag to avoid leaks :-/, see bug 60729
    this.urlBar          = null;
    this.throbberElement = null;
    this.statusMeter     = null;
    this.statusPanel     = null;
    this.stopButton      = null;
    this.stopMenu        = null;
    this.stopContext     = null;
    this.statusTextField = null;
    this.isImage         = null;
    this.securityButton  = null;
    this.feedsButton     = null;
    this.feedsMenu       = null;
  },

  setJSStatus : function(status)
  {
    this.jsStatus = status;
    this.updateStatusField();
  },

  setJSDefaultStatus : function(status)
  {
    this.jsDefaultStatus = status;
    this.updateStatusField();
  },

  setDefaultStatus : function(status)
  {
    this.defaultStatus = status;
    this.updateStatusField();
  },

  setOverLink : function(link, context)
  {
    this.overLink = link;
    // clear out 'Done' (or other message) on first hover
    if (this.defaultStatus)
      this.defaultStatus = "";
    this.updateStatusField();
    if (link)
      this.statusTextField.setAttribute('crop', 'center');
    else
      this.statusTextField.setAttribute('crop', 'end');
  },

  updateStatusField : function()
  {
    var text = this.overLink || this.status || this.jsStatus || this.jsDefaultStatus || this.defaultStatus;

    // check the current value so we don't trigger an attribute change
    // and cause needless (slow!) UI updates
    if (this.statusTextField.label != text)
      this.statusTextField.label = text;
  },

  mimeTypeIsTextBased : function(contentType)
  {
    return /^text\/|\+xml$/.test(contentType) ||
           contentType == "application/x-javascript" ||
           contentType == "application/javascript" ||
           contentType == "application/xml" ||
           contentType == "mozilla.application/cached-xul";
  },

  populateFeeds : function(popup)
  {
    // First clear out any old items
    while (popup.firstChild)
      popup.removeChild(popup.lastChild);

    for (var i = 0; i < this.feeds.length; i++) {
      var link = this.feeds[i];
      var menuitem = document.createElement("menuitem");
      menuitem.className = "menuitem-iconic bookmark-item";
      menuitem.statusText = link.href;
      menuitem.setAttribute("label", link.title || link.href);
      popup.appendChild(menuitem);
    }
  },

  onFeedAvailable : function(aLink)
  {
    this.feeds.push(aLink);
    this.feedsMenu.removeAttribute("disabled");
    this.feedsButton.hidden = false;
  },

  onLinkIconAvailable : function(aHref)
  {
    if (gProxyFavIcon && pref.getBoolPref("browser.chrome.site_icons")) {
      var browser = getBrowser();
      if (browser.userTypedValue === null)
        gProxyFavIcon.setAttribute("src", aHref);
    }
  },

  onProgressChange : function (aWebProgress, aRequest,
                               aCurSelfProgress, aMaxSelfProgress,
                               aCurTotalProgress, aMaxTotalProgress)
  {
    if (aMaxTotalProgress > 0) {
      // This is highly optimized.  Don't touch this code unless
      // you are intimately familiar with the cost of setting
      // attrs on XUL elements. -- hyatt
      var percentage = (aCurTotalProgress * 100) / aMaxTotalProgress;
      this.statusMeter.value = percentage;
    } 
  },

  onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
  {  
    const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;
    const nsIChannel = Components.interfaces.nsIChannel;
    var ctype;
    if (aStateFlags & nsIWebProgressListener.STATE_START) {
      // This (thanks to the filter) is a network start or the first
      // stray request (the first request outside of the document load),
      // initialize the throbber and his friends.

      // Call start document load listeners (only if this is a network load)
      if (aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK &&
          aRequest && aWebProgress.DOMWindow == content)
        this.startDocumentLoad(aRequest);

      // Show the progress meter
      this.statusPanel.collapsed = false;
      // Turn the throbber on.
      this.throbberElement.setAttribute("busy", "true");

      // XXX: These need to be based on window activity...
      this.stopButton.disabled = false;
      this.stopMenu.removeAttribute('disabled');
      this.stopContext.removeAttribute('disabled');
    }
    else if (aStateFlags & nsIWebProgressListener.STATE_STOP) {
      if (aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
        if (aRequest) {
          if (aWebProgress.DOMWindow == content)
            this.endDocumentLoad(aRequest, aStatus);
        }
      }

      // This (thanks to the filter) is a network stop or the last
      // request stop outside of loading the document, stop throbbers
      // and progress bars and such
      if (aRequest) {
        var msg = "";
        // Get the channel if the request is a channel
        if (aRequest instanceof nsIChannel) {
          var location = aRequest.URI.spec;
          if (location != "about:blank") {
            const kErrorBindingAborted = 0x804B0002;
            const kErrorNetTimeout = 0x804B000E;
            switch (aStatus) {
              case kErrorBindingAborted:
                msg = gNavigatorBundle.getString("nv_stopped");
                break;
              case kErrorNetTimeout:
                msg = gNavigatorBundle.getString("nv_timeout");
                break;
            }
          }
        }
        // If msg is false then we did not have an error (channel may have
        // been null, in the case of a stray image load).
        if (!msg) {
          msg = gNavigatorBundle.getString("nv_done");
        }
        this.status = "";
        this.setDefaultStatus(msg);
        
        // Disable menu entries for images, enable otherwise
        if (content.document && this.mimeTypeIsTextBased(content.document.contentType))
          this.isImage.removeAttribute('disabled');
        else
          this.isImage.setAttribute('disabled', 'true');
      }

      // Turn the progress meter and throbber off.
      this.statusPanel.collapsed = true;
      this.statusMeter.value = 0;  // be sure to clear the progress bar
      this.throbberElement.removeAttribute("busy");

      // XXX: These need to be based on window activity...
      // XXXjag: <command id="cmd_stop"/> ?
      this.stopButton.disabled = true;
      this.stopMenu.setAttribute('disabled', 'true');
      this.stopContext.setAttribute('disabled', 'true');
    }
  },

  onLocationChange : function(aWebProgress, aRequest, aLocation)
  {
    if (gContextMenu) {
      // Optimise for the common case
      if (aWebProgress.DOMWindow == content)
        gContextMenu.menu.hidePopup();
      else {
        for (var contextWindow = gContextMenu.target.ownerDocument.defaultView;
             contextWindow != contextWindow.parent;
             contextWindow = contextWindow.parent) {
          if (contextWindow == aWebProgress.DOMWindow) {
            gContextMenu.menu.hidePopup();
            break;
          }
        }
      }
    }

   if (document.tooltipNode) {
     // Optimise for the common case
     if (aWebProgress.DOMWindow == content) {
       document.getElementById("aHTMLTooltip").hidePopup();
       document.tooltipNode = null;
     } else {
       for (var tooltipWindow = document.tooltipNode.ownerDocument.defaultView;
            tooltipWindow != tooltipWindow.parent;
            tooltipWindow = tooltipWindow.parent) {
         if (tooltipWindow == aWebProgress.DOMWindow) {
           document.getElementById("aHTMLTooltip").hidePopup();
           document.tooltipNode = null;
           break;
         }
       }
     }
   }

    // XXX temporary hack for bug 104532.
    // Depends heavily on setOverLink implementation
    if (!aRequest)
      this.status = this.jsStatus = this.jsDefaultStatus = "";

    this.setOverLink("");

    // Disable menu entries for images, enable otherwise
    if (content.document && this.mimeTypeIsTextBased(content.document.contentType))
      this.isImage.removeAttribute('disabled');
    else
      this.isImage.setAttribute('disabled', 'true');

    // We should probably not do this if the value has changed since the user
    // searched
    // Update urlbar only if a new page was loaded on the primary content area
    // Do not update urlbar if there was a subframe navigation

    var browser = getBrowser().selectedBrowser;
    if (aWebProgress.DOMWindow == content) {
      var userTypedValue = browser.userTypedValue;
      if (userTypedValue === null) {
        URLBarSetURI(aLocation, true);
      } else {
        this.urlBar.value = userTypedValue;
        SetPageProxyState("invalid", null);
      }

      this.feedsMenu.setAttribute("disabled", "true");
      this.feedsButton.hidden = true;
      this.feeds = [];
    }
    UpdateBackForwardButtons();

    UpdateStatusBarPopupIcon();
  },

  onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage)
  {
    this.status = aMessage;
    this.updateStatusField();
  },

  onSecurityChange : function(aWebProgress, aRequest, aState)
  {
    const wpl = Components.interfaces.nsIWebProgressListener;
    const wpl_security_bits = wpl.STATE_IS_SECURE |
                              wpl.STATE_IS_BROKEN |
                              wpl.STATE_IS_INSECURE |
                              wpl.STATE_SECURE_HIGH |
                              wpl.STATE_SECURE_MED |
                              wpl.STATE_SECURE_LOW;

    /* aState is defined as a bitmask that may be extended in the future.
     * We filter out any unknown bits before testing for known values.
     */
    switch (aState & wpl_security_bits) {
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH:
        this.securityButton.setAttribute("level", "high");
        this.urlBar.setAttribute("level", "high");
        break;
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_MED:
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_LOW:
        this.securityButton.setAttribute("level", "low");
        this.urlBar.setAttribute("level", "low");
        break;
      case wpl.STATE_IS_BROKEN:
        this.securityButton.setAttribute("level", "broken");
        this.urlBar.setAttribute("level", "broken");
        break;
      case wpl.STATE_IS_INSECURE:
      default:
        this.securityButton.removeAttribute("level");
        this.urlBar.removeAttribute("level");
        break;
    }

    var securityUI = getBrowser().securityUI;
    if (securityUI)
      this.securityButton.setAttribute("tooltiptext", securityUI.tooltipText);
    else
      this.securityButton.removeAttribute("tooltiptext");
  },

  startDocumentLoad : function(aRequest)
  {
    var uri = aRequest.QueryInterface(Components.interfaces.nsIChannel).URI;
    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);

    if (gURLBar.value && getWebNavigation().currentURI.spec == "about:blank")
      URLBarSetURI(uri);

    try {
      observerService.notifyObservers(content, "StartDocumentLoad", uri.spec);
    } catch (e) {
    }
  },

  endDocumentLoad : function(aRequest, aStatus)
  {
    const nsIChannel = Components.interfaces.nsIChannel;
    var urlStr = aRequest.QueryInterface(nsIChannel).originalURI.spec;

    if (Components.isSuccessCode(aStatus))
      dump("Document "+urlStr+" loaded successfully\n"); // per QA request
    else {
      // per QA request
      var e = new Components.Exception("", aStatus);
      var name = e.name;
      dump("Error loading URL "+urlStr+" : "+
           Number(aStatus).toString(16));
      if (name)
           dump(" ("+name+")");
      dump('\n'); 
    }

    var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                    .getService(Components.interfaces.nsIObserverService);

    var notification = Components.isSuccessCode(aStatus) ? "EndDocumentLoad" : "FailDocumentLoad";
    try {
      observerService.notifyObservers(content, notification, urlStr);
    } catch (e) {
    }
  }
}

