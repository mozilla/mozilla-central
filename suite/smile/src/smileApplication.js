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
 * The Original Code is FUEL.
 *
 * The Initial Developer of the Original Code is Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Mark Finkle <mfinkle@mozilla.com> (Original Author)
 *  John Resig  <jresig@mozilla.com> (Original Author)
 *  Jorge Villalobos <jorge.villalobos@gmail.com> (SeaMonkey port)
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

const Ci = Components.interfaces;
const Cc = Components.classes;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

//=================================================
// Singleton that holds services and utilities
var Utilities = {
  _bookmarks : null,
  get bookmarks() {
    if (!this._bookmarks) {
      this._bookmarks =
        Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                  .getService(Components.interfaces.nsINavBookmarksService);
    }
    return this._bookmarks;
  },

  _livemarks : null,
  get livemarks() {
    if (!this._livemarks) {
      this._livemarks =
        Components.classes["@mozilla.org/browser/livemark-service;2"]
                  .getService(Components.interfaces.nsILivemarkService);
    }
    return this._livemarks;
  },

  _annotations : null,
  get annotations() {
    if (!this._annotations) {
      this._annotations =
        Components.classes["@mozilla.org/browser/annotation-service;1"]
                  .getService(Components.interfaces.nsIAnnotationService);
    }
    return this._annotations;
  },

  _history : null,
  get history() {
    if (!this._history) {
      this._history =
        Components.classes["@mozilla.org/browser/nav-history-service;1"]
                  .getService(Components.interfaces.nsINavHistoryService);
    }
    return this._history;
  },

  _windowMediator : null,
  get windowMediator() {
    if (!this._windowMediator) {
      this._windowMediator =
        Components.classes["@mozilla.org/appshell/window-mediator;1"]
                  .getService(Components.interfaces.nsIWindowMediator);
    }
    return this._windowMediator;
  },

  makeURI : function(aSpec) {
    if (!aSpec)
      return null;
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    return ios.newURI(aSpec, null, null);
  },

  free : function() {
    this._bookmarks = null;
    this._livemarks = null;
    this._annotations = null;
    this._history = null;
    this._windowMediator = null;
  }
};


//=================================================
// Window implementation
function Window(aWindow) {
  this._window = aWindow;
  this._tabbrowser = aWindow.getBrowser();
  this._events = new Events();
  this._cleanup = {};

  this._watch("TabOpen");
  this._watch("TabMove");
  this._watch("TabClose");
  this._watch("TabSelect");

  var self = this;
  gShutdown.push(function() { self._shutdown(); });
}

Window.prototype = {
  get events() {
    return this._events;
  },

  /*
   * Helper used to setup event handlers on the XBL element. Note that the events
   * are actually dispatched to tabs, so we capture them.
   */
  _watch : function win_watch(aType) {
    var self = this;
    this._tabbrowser.addEventListener(aType,
      this._cleanup[aType] = function(e){ self._event(e); },
      true);
  },

  /*
   * Helper event callback used to redirect events made on the XBL element
   */
  _event : function win_event(aEvent) {
    this._events.dispatch(aEvent.type, new BrowserTab(this, aEvent.originalTarget));
  },

  get tabs() {
    var tabs = [];
    var mTabs = this._tabbrowser.mTabs;
    for (var i = 0; i < mTabs.length; i++)
      tabs.push(new BrowserTab(this, mTabs[i]));
    return tabs;
  },

  get activeTab() {
    return new BrowserTab(this, this._tabbrowser.selectedTab);
  },

  open : function win_open(aURI) {
    return new BrowserTab(this, this._tabbrowser.addTab(aURI.spec));
  },

  _shutdown : function win_shutdown() {
    for (var type in this._cleanup)
      this._tabbrowser.removeEventListener(type, this._cleanup[type], true);
    this._cleanup = null;

    this._window = null;
    this._tabbrowser = null;
    this._events = null;
  },

  QueryInterface : XPCOMUtils.generateQI([Components.interfaces.smileIWindow])
};


//=================================================
// BrowserTab implementation
function BrowserTab(aSMILEWindow, aTab) {
  this._window = aSMILEWindow;
  this._tabbrowser = aSMILEWindow._tabbrowser;
  this._browser = aTab.linkedBrowser;
  this._tab = aTab;
  this._events = new Events();
  this._cleanup = {};

  this._watch("load");

  var self = this;
  gShutdown.push(function() { self._shutdown(); });
}

BrowserTab.prototype = {
  get uri() {
    return this._browser.currentURI;
  },

  get index() {
    try {
      return this._tabbrowser.getTabIndex(this._tab);
    }
    catch (e) {
      return -1;
    }
  },

  get events() {
    return this._events;
  },

  get window() {
    return this._window;
  },

  get document() {
    return this._browser.contentDocument;
  },

  /*
   * Helper used to setup event handlers on the XBL element
   */
  _watch : function bt_watch(aType) {
    var self = this;
    this._browser.addEventListener(aType,
      this._cleanup[aType] = function(e){ self._event(e); },
      true);
  },

  /*
   * Helper event callback used to redirect events made on the XBL element
   */
  _event : function bt_event(aEvent) {
    if (aEvent.type == "load") {
      if (!(aEvent.originalTarget instanceof Components.interfaces.nsIDOMDocument))
        return;

      if (aEvent.originalTarget.defaultView instanceof Components.interfaces.nsIDOMWindowInternal &&
          aEvent.originalTarget.defaultView.frameElement)
        return;
    }
    this._events.dispatch(aEvent.type, this);
  },

  load : function bt_load(aURI) {
    this._browser.loadURI(aURI.spec, null, null);
  },

  focus : function bt_focus() {
    this._tabbrowser.selectedTab = this._tab;
    this._tabbrowser.focus();
  },

  close : function bt_close() {
    this._tabbrowser.removeTab(this._tab);
  },

  moveBefore : function bt_movebefore(aBefore) {
    this._tabbrowser.moveTabTo(this._tab, aBefore.index);
  },

  moveToEnd : function bt_moveend() {
    this._tabbrowser.moveTabTo(this._tab, this._tabbrowser.browsers.length);
  },

  _shutdown : function bt_shutdown() {
    for (var type in this._cleanup)
      this._browser.removeEventListener(type, this._cleanup[type], true);
    this._cleanup = null;

    this._window = null;
    this._tabbrowser = null;
    this._browser = null;
    this._tab = null;
    this._events = null;
  },

  QueryInterface : XPCOMUtils.generateQI([Components.interfaces.smileIBrowserTab])
};


//=================================================
// Factory - Treat Application as a singleton
// XXX This is required, because we're registered for the 'JavaScript global
// privileged property' category, whose handler always calls createInstance.
// See bug 386535.
var gSingleton = null;
var ApplicationFactory = {
  createInstance: function af_ci(aOuter, aIID) {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    if (gSingleton == null) {
      gSingleton = new Application();
    }

    return gSingleton.QueryInterface(aIID);
  }
};



//=================================================
// Application constructor
function Application() {
  this.initToolkitHelpers();
  this._bookmarks = null;
}

//=================================================
// Application implementation
Application.prototype = {
  // for nsIClassInfo + XPCOMUtils
  classDescription: "Application",
  classID:          Components.ID("c9ba8f65-c936-4ac6-a859-8936832b0c12"),
  contractID:       "@mozilla.org/smile/application;1",

  // redefine the default factory for XPCOMUtils
  _xpcom_factory: ApplicationFactory,

  // for nsISupports
  QueryInterface : XPCOMUtils.generateQI(
                     [Components.interfaces.smileIApplication,
                      Components.interfaces.extIApplication,
                      Components.interfaces.nsIObserver,
                      Components.interfaces.nsIClassInfo]),

  getInterfaces : function app_gi(aCount) {
   var interfaces = [Components.interfaces.smileIApplication,
                     Components.interfaces.extIApplication,
                     Components.interfaces.nsIObserver,
                     Components.interfaces.nsIClassInfo];
    aCount.value = interfaces.length;
    return interfaces;
  },

  // for nsIObserver
  observe: function app_observe(aSubject, aTopic, aData) {
    // Call the extApplication version of this function first
    this.__proto__.__proto__.observe.call(this, aSubject, aTopic, aData);
    if (aTopic == "xpcom-shutdown") {
      this._bookmarks = null;
      Utilities.free();
    }
  },

  /*
   Uncomment once Places Bookmarks migration is complete.
   get bookmarks() {

     if (this._bookmarks == null)
      this._bookmarks = new BookmarkRoots();

    return this._bookmarks;
  },*/

  get windows() {
    var win = [];
    var enum = Utilities.windowMediator.getEnumerator("navigator:browser");

    while (enum.hasMoreElements())
      win.push(new Window(enum.getNext()));

    return win;
  },

  get activeWindow() {
    return new Window(Utilities.windowMediator.getMostRecentWindow("navigator:browser"));
  }
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) {
  // set the proto, defined in extApplication.js
  Application.prototype.__proto__ = extApplication.prototype;
  return XPCOMUtils.generateModule([Application]);
}

#include ../../../mozilla/toolkit/components/exthelper/extApplication.js
