/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

let promise = Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js", {}).Promise;

/**
 * Create the root actor for Thunderbird's debugger implementation.
 *
 * @param aConnection       The debugger connection to create the actor for.
 * @return                  The mail actor for the connection.
 */
function createRootActor(aConnection) {
  let parameters = {
    tabList: new MailTabList(aConnection),
    addonList: new BrowserAddonList(aConnection),
    globalActorFactories: DebuggerServer.globalActorFactories,
    onShutdown: sendShutdownEvent,
  };

  let mailActor = new RootActor(aConnection, parameters);
  mailActor.applicationType = "mail";
  return mailActor;
}

/**
 * Returns the window type of the passed window.
 */
function appShellDOMWindowType(aWindow) {
  /* This is what nsIWindowMediator's enumerator checks. */
  return aWindow.document.documentElement.getAttribute('windowtype');
}

/**
 * Send a debugger shutdown event to all mail windows.
 */
function sendShutdownEvent() {
  for (let win in fixIterator(Services.wm.getEnumerator("mail:3pane"))) {
    let evt = win.document.createEvent("Event");
    evt.initEvent("Debugger:Shutdown", true, false);
    win.document.documentElement.dispatchEvent(evt);
  }
}

/**
 * The live list of tabs for Thunderbird. The term tab is taken from Firefox
 * tabs, where each browser tab shows up as a tab in the debugger. As in
 * Thunderbird all tabs are chrome tabs, we will be iterating the content
 * windows and presenting them as tabs instead.
 *
 * @param aConnection       The connection to create the tab list for.
 */
function MailTabList(aConnection) {
  this._connection = aConnection;
  this._actorByBrowser = new Map();

  // These windows should be checked for browser elements
  this._checkedWindows = new Set(["mail:3pane", "mail:messageWindow"]);
}

MailTabList.prototype = {
  _onListChanged: null,
  _actorByBrowser: null,
  _checkedWindows: null,
  _mustNotify: false,
  _listeningToMediator: false,

  get onListChanged() {
    return this._onListChanged;
  },

  set onListChanged(v) {
    if (v !== null && typeof v !== 'function') {
      throw Error("onListChanged property may only be set to 'null' or a function");
    }
    this._onListChanged = v;
    this._checkListening();
  },

  _checkListening: function() {
    let shouldListenToMediator =
        ((this._onListChanged && this._mustNotify) ||
         this._actorByBrowser.size > 0);

    if (this._listeningToMediator !== shouldListenToMediator) {
      let op = shouldListenToMediator ? "addListener" : "removeListener";
      Services.wm[op](this);
      this._listeningToMediator = shouldListenToMediator;
    }
  },

  _notifyListChanged: function() {
    if (this._onListChanged && this._mustNotify) {
      this._onListChanged();
      this._mustNotify = false;
    }
  },

  _getTopWindow: function() {
    let winIter = Services.wm.getZOrderDOMWindowEnumerator(null, true);
    for (let win in fixIterator(winIter)) {
      if (this._checkedWindows.has(appShellDOMWindowType(win))) {
        // This is one of our windows, return it
        return win;
      }
    }
    return null;
  },

  getList: function() {
    let topWindow = this._getTopWindow();

    // Look for all browser elements in all the windows we care about
    for (let winName of this._checkedWindows) {
      for (let win in fixIterator(Services.wm.getEnumerator(winName))) {
        let foundSelected = false;
        // Check for browser elements and create a tab actor for each.
        // This will catch content tabs, the message reader and the
        // multi-message reader.
        for (let browser of win.document.getElementsByTagName("browser")) {
          if (browser.currentURI.spec == "about:blank") {
            // about:blank is not particularly interesting. Don't
            // add it to the list.
            continue;
          }
          let actor = this._actorByBrowser.get(browser);
          if (!actor) {
            actor = new BrowserTabActor(this._connection,
                                        browser, null);
            this._actorByBrowser.set(browser, actor);
          }

          // Select the first visible browser in the top xul
          // window.
          let bo = browser.boxObject;
          actor.selected = foundSelected =
              win == topWindow &&
              !foundSelected &&
              bo.height > 0 &&
              bo.width > 0;
        }
      }
    }

    this._mustNotify = true;
    this._checkListening();

    return promise.resolve([actor for ([_, actor] of this._actorByBrowser)]);
  },

  onOpenWindow: makeInfallible(function(aWindow) {
    let handleLoad = makeInfallible(() => {
      aWindow.removeEventListener("load", handleLoad, false);

      if (this._checkedWindows.has(appShellDOMWindowType(aWindow))) {
        // This is one of our windows, we need to check for browser
        // elements. Notify is enough, iterate will do the actual actor
        // creation.
        this._notifyListChanged();
      }
    });

    // You can hardly do anything at all with a XUL window at this point; it
    // doesn't even have its document yet. Wait until its document has
    // loaded, and then see what we've got. This also avoids
    // nsIWindowMediator enumeration from within listeners (bug 873589).
    aWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);
    aWindow.addEventListener("load", handleLoad, false);
  }, "MailTabList.prototype.onOpenWindow"),

  onCloseWindow: makeInfallible(function(aWindow) {
    aWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);

    // Only handle our window types
    if (this._checkedWindows.has(appShellDOMWindowType(aWindow))) {
      return;
    }

    // nsIWindowMediator deadlocks if you call its GetEnumerator method from
    // a nsIWindowMediatorListener's onCloseWindow hook (bug 873589), so
    // handle the close in a different tick.
    Services.tm.currentThread.dispatch(makeInfallible(() => {
      let shouldNotify = false;

      // Scan the whole map for browsers that were in this window.
      for (let [browser, actor] of this._actorByBrowser) {
        // The browser document of a closed window has no default view.
        if (!browser.ownerDocument.defaultView) {
          this._actorByBrowser.delete(browser);
          actor.exit();
          shouldNotify = true;
        }
      }

      if (shouldNotify) {
        this._notifyListChanged();
      }
      this._checkListening();
    }, "MailTabList.prototype.onCloseWindow's delayed body"), 0);
  }, "MailTabList.prototype.onCloseWindow"),

  onWindowTitleChange: function() {}
};
