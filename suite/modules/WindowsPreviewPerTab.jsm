/* vim: se cin sw=2 ts=2 et filetype=javascript :
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/*
 * This module implements the front end behavior for AeroPeek. Starting in
 * Windows Vista, the taskbar began showing live thumbnail previews of windows
 * when the user hovered over the window icon in the taskbar. Starting with
 * Windows 7, the taskbar allows an application to expose its tabbed interface
 * in the taskbar by showing thumbnail previews rather than the default window
 * preview. Additionally, when a user hovers over a thumbnail (tab or window),
 * they are shown a live preview of the window (or tab + its containing window).
 *
 * In Windows 7, a title, icon, close button and optional toolbar are shown for
 * each preview. This feature does not make use of the toolbar. For window
 * previews, the title is the window title and the icon the window icon. For
 * tab previews, the title is the page title and the page's favicon. In both
 * cases, the close button "does the right thing."
 *
 * The primary objects behind this feature are nsITaskbarTabPreview and
 * nsITaskbarPreviewController. Each preview has a controller. The controller
 * responds to the user's interactions on the taskbar and provides the required
 * data to the preview for determining the size of the tab and thumbnail. The
 * PreviewController class implements this interface. The preview will request
 * the controller to provide a thumbnail or preview when the user interacts with
 * the taskbar. To reduce the overhead of drawing the tab area, the controller
 * implementation caches the tab's contents in a <canvas> element. If no
 * previews or thumbnails have been requested for some time, the controller will
 * discard its cached tab contents.
 *
 * Screen real estate is limited so when there are too many thumbnails to fit
 * on the screen, the taskbar stops displaying thumbnails and instead displays
 * just the title, icon and close button in a similar fashion to previous
 * versions of the taskbar. If there are still too many previews to fit on the
 * screen, the taskbar resorts to a scroll up and scroll down button pair to let
 * the user scroll through the list of tabs. Since this is undoubtedly
 * inconvenient for users with many tabs, the AeroPeek objects turns off all of
 * the tab previews. This tells the taskbar to revert to one preview per window.
 * If the number of tabs falls below this magic threshold, the preview-per-tab
 * behavior returns. There is no reliable way to determine when the scroll
 * buttons appear on the taskbar, so a magic pref-controlled number determines
 * when this threshold has been crossed.
 */
var EXPORTED_SYMBOLS = ["AeroPeek"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

// Pref to enable/disable preview-per-tab
const TOGGLE_PREF_NAME = "browser.taskbar.previews.enable";
// Pref to determine the magic auto-disable threshold
const DISABLE_THRESHOLD_PREF_NAME = "browser.taskbar.previews.max";
// Pref to control the time in seconds that tab contents live in the cache
const CACHE_EXPIRATION_TIME_PREF_NAME = "browser.taskbar.previews.cachetime";

const WINTASKBAR_CONTRACTID = "@mozilla.org/windows-taskbar;1";

////////////////////////////////////////////////////////////////////////////////
//// Various utility properties
XPCOMUtils.defineLazyServiceGetter(this, "imgTools",
                                   "@mozilla.org/image/tools;1",
                                   "imgITools");
XPCOMUtils.defineLazyServiceGetter(this, "faviconSvc",
                                   "@mozilla.org/browser/favicon-service;1",
                                   "nsIFaviconService");

// nsIURI -> imgIContainer
function _imageFromURI(uri, privateMode, callback) {
  let channel = Services.io.newChannelFromURI(uri);
  if (channel instanceof Components.interfaces.nsIPrivateBrowsingChannel)
    channel.setPrivate(privateMode);

  NetUtil.asyncFetch(channel, function(inputStream, resultCode) {
    if (!Components.isSuccessCode(resultCode))
      return;
    try {
      callback(imgTools.decodeImage(inputStream, channel.contentType));
    } catch (e) {
      // We failed, so use the default favicon (only if this wasn't the default
      // favicon).
      let defaultURI = faviconSvc.defaultFavicon;
      if (!defaultURI.equals(uri))
        _imageFromURI(defaultURI, privateMode, callback);
    }
  });
}

// string? -> imgIContainer
function getFaviconAsImage(iconurl, privateMode, callback) {
  if (iconurl)
    _imageFromURI(NetUtil.newURI(iconurl), privateMode, callback);
  else
    _imageFromURI(faviconSvc.defaultFavicon, privateMode, callback);
}

// Snaps the given rectangle to be pixel-aligned at the given scale
function snapRectAtScale(r, scale) {
  let x = Math.floor(r.x * scale);
  let y = Math.floor(r.y * scale);
  let width = Math.ceil((r.x + r.width) * scale) - x;
  let height = Math.ceil((r.y + r.height) * scale) - y;

  r.x = x / scale;
  r.y = y / scale;
  r.width = width / scale;
  r.height = height / scale;
}

////////////////////////////////////////////////////////////////////////////////
//// PreviewController

/*
 * This class manages the behavior of the preview.
 *
 * To give greater performance when drawing, the dirty areas of the content
 * window are tracked and drawn on demand into a canvas of the same size.
 * This provides a great increase in responsiveness when drawing a preview
 * for unchanged (or even only slightly changed) tabs.
 *
 * @param win
 *        The TabWindow (see below) that owns the preview that this controls
 * @param tab
 *        The <tab> that this preview is associated with
 */
function PreviewController(win, tab) {
  this.win = win;
  this.tab = tab;
  this.linkedBrowser = tab.linkedBrowser;

  this.linkedBrowser.addEventListener("MozAfterPaint", this, false);
  this.linkedBrowser.addEventListener("DOMTitleChanged", this, false);
}

PreviewController.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsITaskbarPreviewController,
                                         Components.interfaces.nsIDOMEventListener]),
  _canvasPreview: null,
  _dirtyRegion: null,

  destroy: function () {
    this.linkedBrowser.removeEventListener("DOMTitleChanged", this, false);
    this.linkedBrowser.removeEventListener("MozAfterPaint", this, false);
  },

  get canvasPreview() {
    if (!this._canvasPreview) {
      this._canvasPreview = this.tab.ownerDocument.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
      this._canvasPreview.mozOpaque = true;
    }
    return this._canvasPreview;
  },

  get dirtyRegion() {
    if (!this._dirtyRegion) {
      this._dirtyRegion = Components.classes["@mozilla.org/gfx/region;1"]
                                    .createInstance(Components.interfaces.nsIScriptableRegion);
      this._dirtyRegion.init();
    }
    return this._dirtyRegion;
  },

  get dirtyRects() {
    let rectstream = this.dirtyRegion.getRects();
    if (!rectstream)
      return [];
    let rects = [];
    for (let i = 0; i < rectstream.length; i+= 4) {
      let r = {x:      rectstream[i],
               y:      rectstream[i+1],
               width:  rectstream[i+2],
               height: rectstream[i+3]};
      rects.push(r);
    }
    return rects;
  },

  // Resizes the canvasPreview to 0x0, essentially freeing its memory.
  // updateCanvasPreview() will detect the size mismatch as a resize event
  // the next time it is called.
  resetCanvasPreview: function () {
    if (this._canvasPreview) {
      this._canvasPreview.width = 0;
      this._canvasPreview.height = 0;
    }
  },

  get zoom() {
    // We use this property instead of the fullZoom property because this
    // accurately reflects the actual zoom factor used when drawing.
    return this.linkedBrowser.contentWindow
               .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIDOMWindowUtils)
               .screenPixelsPerCSSPixel;
  },

  // Updates the controller's canvas with the parts of the <browser> that need
  // to be redrawn.
  updateCanvasPreview: function () {
    let win = this.linkedBrowser.contentWindow;
    let bx = this.linkedBrowser.boxObject;
    // Check for resize
    if (bx.width != this.canvasPreview.width ||
        bx.height != this.canvasPreview.height) {
      // Invalidate the entire area and repaint
      this.onTabPaint({left:0, top:0, right:win.innerWidth, bottom:win.innerHeight});
      this.canvasPreview.width = bx.width;
      this.canvasPreview.height = bx.height;
    }

    // Draw dirty regions
    let ctx = this.canvasPreview.getContext("2d");
    const canvasPreviewFlags = ctx.DRAWWINDOW_DRAW_VIEW |
                               ctx.DRAWWINDOW_DRAW_CARET |
                               ctx.DRAWWINDOW_ASYNC_DECODE_IMAGES |
                               ctx.DRAWWINDOW_DO_NOT_FLUSH;
    let scale = this.zoom;

    // The dirty region may include parts that are offscreen so we clip to the
    // canvas area.
    this.dirtyRegion.intersectRect(0, 0, win.innerWidth, win.innerHeight);
    this.dirtyRects.forEach(function (r) {
      // We need to snap the rectangle to be pixel aligned in the destination
      // coordinate space. Otherwise natively themed widgets might not draw.
      snapRectAtScale(r, scale);
      let x = r.x;
      let y = r.y;
      let width = r.width;
      let height = r.height;

      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(x, y);
      ctx.drawWindow(win, x, y, width, height, "white", canvasPreviewFlags);
      ctx.restore();
    });
    this.dirtyRegion.setToRect(0, 0, 0, 0);

    // If we're updating the canvas, then we're in the middle of a peek so
    // don't discard the cache of previews.
    AeroPeek.resetCacheTimer();
  },

  onTabPaint: function (rect) {
    let x = Math.floor(rect.left),
        y = Math.floor(rect.top),
        width = Math.ceil(rect.right) - x,
        height = Math.ceil(rect.bottom) - y;
    this.dirtyRegion.unionRect(x, y, width, height);
  },

  updateTitleAndTooltip: function () {
    let title = this.win.tabbrowser.getWindowTitleForBrowser(this.linkedBrowser);
    this.tab._preview.title = title;
    this.tab._preview.tooltip = title;
  },

  //////////////////////////////////////////////////////////////////////////////
  //// nsITaskbarPreviewController

  get width() {
    return this.win.width;
  },

  get height() {
    return this.win.height;
  },

  get thumbnailAspectRatio() {
    let boxObject = this.tab.linkedBrowser.boxObject;
    // Avoid returning 0
    let tabWidth = boxObject.width || 1;
    // Avoid divide by 0
    let tabHeight = boxObject.height || 1;
    return tabWidth / tabHeight;
  },

  drawPreview: function (ctx) {
    let win = this.win;
    let tabbrowser = win.tabbrowser;
    tabbrowser.mAeroPeek = true;
    let tab = tabbrowser.selectedTab;
    tabbrowser.selectedTab = this.tab;
    ctx.drawWindow(win.win, 0, 0, win.width, win.height, "white");
    tabbrowser.selectedTab = tab;
    tabbrowser.mAeroPeek = false;

    // We must avoid having the frame drawn around the window. See bug 520807
    return false;
  },

  drawThumbnail: function (ctx, width, height) {
    this.updateCanvasPreview();

    let scale = width / this.linkedBrowser.boxObject.width;
    ctx.scale(scale, scale);
    ctx.drawImage(this.canvasPreview, 0, 0);

    // Don't draw a frame around the thumbnail
    return false;
  },

  onClose: function () {
    this.win.tabbrowser.removeTab(this.tab);
  },

  onActivate: function () {
    this.win.tabbrowser.selectedTab = this.tab;

    // Accept activation - this will restore the browser window
    // if it's minimized
    return true;
  },

  //// nsIDOMEventListener
  handleEvent: function (evt) {
    switch (evt.type) {
      case "MozAfterPaint":
        if (evt.originalTarget === this.linkedBrowser.contentWindow) {
          let clientRects = evt.clientRects;
          let length = clientRects.length;
          for (let i = 0; i < length; i++) {
            let r = clientRects.item(i);
            this.onTabPaint(r);
          }
        }
        if (this.tab._preview.visible)
          this.tab._preview.invalidate();
        break;
      case "DOMTitleChanged":
        this.updateTitleAndTooltip();
        break;
    }
  }
};

////////////////////////////////////////////////////////////////////////////////
//// TabWindow

/*
 * This class monitors a browser window for changes to its tabs
 *
 * @param win
 *        The nsIDOMWindow browser window
 */
function TabWindow(win) {
  this.win = win;
  this.tabbrowser = win.getBrowser();

  for (let i = 0; i < this.tabEvents.length; i++)
    this.tabbrowser.tabContainer.addEventListener(this.tabEvents[i], this, false);
  this.tabbrowser.addTabsProgressListener(this);

  let tabs = this.tabbrowser.tabs;
  for (let i = 0; i < tabs.length; i++)
    this.newTab(tabs[i]);

  this.updateTabOrdering();
}

TabWindow.prototype = {
  _enabled: false,
  tabEvents: ["TabOpen", "TabClose", "TabSelect", "TabMove"],

  destroy: function () {
    this.tabbrowser.removeTabsProgressListener(this);
    for (let i = 0; i < this.tabEvents.length; i++)
      this.tabbrowser.tabContainer.removeEventListener(this.tabEvents[i], this, false);

    let tabs = this.tabbrowser.tabs;
    for (let i = 0; i < tabs.length; i++)
      this.removeTab(tabs[i]);
  },

  get width () {
    return this.win.innerWidth;
  },

  get height () {
    return this.win.innerHeight;
  },

  // Invoked when the given tab is added to this window
  newTab: function (tab) {
    tab._controller = new PreviewController(this, tab);
    let docShell = this.win
                       .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                       .getInterface(Components.interfaces.nsIWebNavigation)
                       .QueryInterface(Components.interfaces.nsIDocShell);
    tab._preview = AeroPeek.taskbar.createTaskbarTabPreview(docShell, tab._controller);
    tab._preview.visible = AeroPeek.enabled;
    tab._preview.active = this.tabbrowser.selectedTab == tab;
    // Grab the default favicon
    getFaviconAsImage(null, PrivateBrowsingUtils.isWindowPrivate(this.win), function (img) {
      // It is possible that we've already gotten the real favicon, so make sure
      // we have not set one before setting this default one.
      if (!tab._preview.icon)
        tab._preview.icon = img;
    });

    tab._controller.updateTitleAndTooltip();
    AeroPeek.addController(tab._controller);
  },

  // Invoked when the given tab is closed
  removeTab: function (tab) {
    tab._preview.active = false;
    tab._preview.visible = false;
    tab._preview.move(null);
    delete tab._preview;
    AeroPeek.removeController(tab._controller);
    tab._controller.destroy();
    delete tab._controller;
  },

  get enabled () {
    return this._enabled;
  },

  set enabled (enable) {
    this._enabled = enable;
    // Because making a tab visible requires that the tab it is next to be
    // visible, it is far simpler to unset the 'next' tab and recreate them all
    // at once.
    let tabs = this.tabbrowser.tabs;
    for (let i = 0; i < tabs.length; i++) {
      tabs[i]._preview.move(null);
      tabs[i]._preview.visible = enable;
    }
    this.updateTabOrdering();
  },

  updateTabOrdering: function (aIgnoreTab) {
    // Since the internal taskbar array has not yet been updated we must force
    // on it the sorting order of our local array.  To do so we must walk
    // the local array backwards, otherwise we would send move requests in the
    // wrong order.  See bug 522610 for details.
    let tabs = this.tabbrowser.tabs;
    let next = null;
    for (let i = tabs.length - 1; i >= 0; i--) {
      if (tabs[i] != aIgnoreTab) {
        let p = tabs[i]._preview;
        p.move(next);
        next = p;
      }
    }
  },

  //// nsIDOMEventListener
  handleEvent: function (evt) {
    let tab = evt.originalTarget;
    switch (evt.type) {
      case "TabOpen":
        this.newTab(tab);
        this.updateTabOrdering();
        break;
      case "TabClose":
        this.removeTab(tab);
        this.updateTabOrdering(tab);
        break;
      case "TabSelect":
        tab._preview.active = true;
        break;
      case "TabMove":
        this.updateTabOrdering();
        break;
    }
  },

  //// Browser progress listener
  onLinkIconAvailable: function (aBrowser, aIconURL) {
    let self = this;
    getFaviconAsImage(aIconURL, PrivateBrowsingUtils.isWindowPrivate(this.win), function (img) {
      let index = self.tabbrowser.browsers.indexOf(aBrowser);
      // Only add it if we've found the index.  The tab could have closed!
      if (index != -1)
        self.tabbrowser.tabs[index]._preview.icon = img;
    });
  }
}

////////////////////////////////////////////////////////////////////////////////
//// AeroPeek

/*
 * This object acts as global storage and external interface for this feature.
 * It maintains the values of the prefs.
 */
var AeroPeek = {
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver,
                                         Components.interfaces.nsISupportsWeakReference]),
  available: false,
  cacheTimer: null,
  // Does the pref say we're enabled?
  _prefenabled: true,

  _enabled: true,

  // nsITaskbarPreviewController set
  controllers: new Set(),

  // TabWindow map
  windows: new Map(),

  // nsIWinTaskbar service
  taskbar: null,

  // Maximum number of previews
  maxpreviews: 20,

  // Length of time in seconds that previews are cached
  cacheLifespan: 5,

  initialize: function () {
    if (!(WINTASKBAR_CONTRACTID in Components.classes))
      return;

    this.taskbar = Components.classes[WINTASKBAR_CONTRACTID]
                             .getService(Components.interfaces.nsIWinTaskbar);
    this.available = this.taskbar.available;
    if (!this.available)
      return;

    Services.prefs.addObserver(TOGGLE_PREF_NAME, this, true);
    Services.prefs.addObserver(DISABLE_THRESHOLD_PREF_NAME, this, true);
    Services.prefs.addObserver(CACHE_EXPIRATION_TIME_PREF_NAME, this, true);

    this.cacheLifespan = Services.prefs.getIntPref(CACHE_EXPIRATION_TIME_PREF_NAME);

    this.maxpreviews = Services.prefs.getIntPref(DISABLE_THRESHOLD_PREF_NAME);

    this.enabled = this._prefenabled = Services.prefs.getBoolPref(TOGGLE_PREF_NAME);
  },

  get enabled() {
    return this._enabled;
  },

  set enabled(enable) {
    if (this._enabled == enable)
      return;

    this._enabled = enable;

    for (let [, win] of this.windows)
      win.enabled = enable;
  },

  addController: function (controller) {
    this.controllers.add(controller);
    this.checkPreviewCount();
  },

  removeController: function (controller) {
    this.controllers.delete(controller);
    this.checkPreviewCount();
  },

  checkPreviewCount: function () {
    this.enabled = this._prefenabled && this.controllers.size <= this.maxpreviews;
  },

  onOpenWindow: function (win) {
    // This occurs when the taskbar service is not available (xp, vista)
    if (!this.available)
      return;

    this.windows.set(win, new TabWindow(win));
    this.checkPreviewCount();
  },

  onCloseWindow: function (win) {
    // This occurs when the taskbar service is not available (xp, vista)
    if (!this.available)
      return;

    this.windows.get(win).destroy();
    this.windows.delete(win);
    this.checkPreviewCount();
  },

  resetCacheTimer: function () {
    if (this.cacheTimer)
      this.cacheTimer.cancel();
    else
      this.cacheTimer = Components.classes["@mozilla.org/timer;1"]
                                  .createInstance(Components.interfaces.nsITimer);
    this.cacheTimer.init(this, 1000 * this.cacheLifespan,
                         Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },

  //// nsIObserver
  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
      case "nsPref:changed":
        if (aData == CACHE_EXPIRATION_TIME_PREF_NAME)
          break;

        if (aData == TOGGLE_PREF_NAME)
          this._prefenabled = Services.prefs.getBoolPref(TOGGLE_PREF_NAME);
        else if (aData == DISABLE_THRESHOLD_PREF_NAME)
          this.maxpreviews = Services.prefs.getIntPref(DISABLE_THRESHOLD_PREF_NAME);
        // Might need to enable/disable ourselves
        this.checkPreviewCount();
        break;
      case "timer-callback":
        for (let controller of this.controllers)
          controller.resetCanvasPreview();
        break;
    }
  }
};

AeroPeek.initialize();
