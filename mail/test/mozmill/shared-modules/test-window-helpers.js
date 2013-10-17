/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "window-helpers";

Cu.import('resource:///modules/iteratorUtils.jsm');
Cu.import('resource://gre/modules/NetUtil.jsm');
Cu.import("resource://gre/modules/Services.jsm");

var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var frame = {};
Cu.import('resource://mozmill/modules/frame.js', frame);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

/**
 * Timeout to use when waiting for the first window ever to load.  This is
 *  long because we are basically waiting for the entire app startup process.
 */
const FIRST_WINDOW_EVER_TIMEOUT_MS = 30000;
/**
 * Interval to check if the window has shown up for the first window ever to
 *  load.  The check interval is longer because it's less likely the window
 *  is going to show up quickly and there is a cost to the check.
 */
const FIRST_WINDOW_CHECK_INTERVAL_MS = 300;

/**
 * Timeout for opening a window.
 */
const WINDOW_OPEN_TIMEOUT_MS = 10000;
/**
 * Check interval for opening a window.
 */
const WINDOW_OPEN_CHECK_INTERVAL_MS = 100;

/**
 * Timeout for closing a window.
 */
const WINDOW_CLOSE_TIMEOUT_MS = 10000;
/**
 * Check interval for closing a window.
 */
const WINDOW_CLOSE_CHECK_INTERVAL_MS = 100;

/**
 * Timeout for focusing a window.  Only really an issue on linux.
 */
const WINDOW_FOCUS_TIMEOUT_MS = 10000;

const hiddenWindow = Services.appShell.hiddenDOMWindow;

// Have a dummy mark_action function in case test-folder-display-helpers does
// not provide us with one.
var mark_action = function dummy_mark_action() {};
var mark_failure = function dummy_mark_failure() {};
var normalize_for_json = function dummy_normalize_for_json() {};
/**
 * This is used by test-folder-display-helpers to provide us with a reference
 * to logHelper's mark_action because of ugliness in the module system.
 */
function hereIsMarkAction(mark_action_impl, mark_failure_impl,
                          normalize_for_json_impl) {
  mark_action = mark_action_impl;
  mark_failure = mark_failure_impl;
  normalize_for_json = normalize_for_json_impl;
}

function installInto(module) {
  module.plan_for_new_window = plan_for_new_window;
  module.wait_for_new_window = wait_for_new_window;
  module.plan_for_modal_dialog = plan_for_modal_dialog;
  module.wait_for_modal_dialog = wait_for_modal_dialog;
  module.plan_for_window_close = plan_for_window_close;
  module.wait_for_window_close = wait_for_window_close;
  module.close_window = close_window;
  module.wait_for_existing_window = wait_for_existing_window;
  module.wait_for_window_focused = wait_for_window_focused;

  module.wait_for_browser_load = wait_for_browser_load;
  module.wait_for_frame_load = wait_for_frame_load;

  module.plan_for_observable_event = plan_for_observable_event;
  module.wait_for_observable_event = wait_for_observable_event;

  module.augment_controller = augment_controller;
}

/**
 * Return the "windowtype" or "id" for the given xul window if it is available.
 * If not, return null.
 */
function getWindowTypeForXulWindow(aXULWindow, aBusyOk) {
  // Sometimes we are given HTML windows, for which the logic below will
  //  bail.  So we use a fast-path here that should work for HTML and should
  //  maybe also work with XUL.  I'm not going to go into it...
  if (aXULWindow.document &&
      aXULWindow.document.documentElement &&
      aXULWindow.document.documentElement.hasAttribute("windowtype"))
    return aXULWindow.document.documentElement.getAttribute("windowtype");

  let docshell = aXULWindow.docShell;
  // we need the docshell to exist...
  if (!docshell)
    return null;

  // we can't know if it's the right document until it's not busy
  if (!aBusyOk && docshell.busyFlags)
    return null;

  // it also needs to have content loaded (it starts out not busy with no
  //  content viewer.)
  if (docshell.contentViewer == null)
    return null;

  // now we're cooking! let's get the document...
  let outerDoc = docshell.contentViewer.DOMDocument;
  // and make sure it's not blank.  that's also an intermediate state.
  if (outerDoc.location.href == "about:blank")
    return null;

  // finally, we can now have a windowtype!
  let windowType = outerDoc.documentElement.getAttribute("windowtype") ||
                   outerDoc.documentElement.getAttribute("id");

  if (windowType)
    return windowType;

  // As a last resort, use the name given to the DOM window.
  let domWindow = aXULWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                     .getInterface(Ci.nsIDOMWindow);

  return domWindow.name;
}

/**
 * Return the unique id we annotated onto this XUL window during
 *  augment_controller.
 */
function getUniqueIdForXulWindow(aXULWindow) {
  // html case
  if (aXULWindow.document &&
      aXULWindow.document.documentElement) {
    if (!(UNIQUE_WINDOW_ID_ATTR in aXULWindow.document.defaultView))
      return "no attr html";
    return aXULWindow.document.defaultView[UNIQUE_WINDOW_ID_ATTR];
  }

  // XUL case
  let docshell = aXULWindow.docShell;
  // we need the docshell to exist...
  if (!docshell)
    return "no docshell";

  // it also needs to have content loaded (it starts out not busy with no
  //  content viewer.)
  if (docshell.contentViewer == null)
    return "no contentViewer";

  // now we're cooking! let's get the document...
  let outerDoc = docshell.contentViewer.DOMDocument;
  // and make sure it's not blank.  that's also an intermediate state.
  if (outerDoc.location.href == "about:blank")
    return "about:blank";

  // finally, we can now have a windowtype!
  let win = outerDoc.defaultView;
  if (UNIQUE_WINDOW_ID_ATTR in win)
    return win[UNIQUE_WINDOW_ID_ATTR];
  return "no attr xul";
}

var WindowWatcher = {
  _inited: false,
  _firstWindowOpened: false,
  ensureInited: function WindowWatcher_ensureInited() {
    if (this._inited)
      return;

    // Add ourselves as an nsIWindowMediatorListener so we can here about when
    //  windows get registered with the window mediator.  Because this
    //  generally happens
    // Another possible means of getting this info would be to observe
    //  "xul-window-visible", but it provides no context and may still require
    //  polling anyways.
    mozmill.wm.addListener(this);

    this._inited = true;
  },

  /**
   * Track the windowtypes we are waiting on.  Keys are windowtypes.  When
   *  watching for new windows, values are initially null, and are set to an
   *  nsIXULWindow when we actually find the window.  When watching for closing
   *  windows, values are nsIXULWindows.  This symmetry lets us have windows
   *  that appear and dis-appear do so without dangerously confusing us (as
   *  long as another one comes along...)
   */
  waitingList: new Map(),
  /**
   * Note that we will be looking for a window with the given window type
   *  (ex: "mailnews:search").  This allows us to be ready if an event shows
   *  up before waitForWindow is called.
   */
  planForWindowOpen: function WindowWatcher_planForWindowOpen(aWindowType) {
    this.waitingList.set(aWindowType, null);
  },

  /**
   * Like planForWindowOpen but we check for already-existing windows.
   */
  planForAlreadyOpenWindow:
      function WindowWatcher_planForAlreadyOpenWindow(aWindowType) {
    this.waitingList.set(aWindowType, null);
    // We need to iterate over all the XUL windows and consider them all.
    //  We can't pass the window type because the window might not have a
    //  window type yet.
    // because this iterates from old to new, this does the right thing in that
    //  side-effects of consider will pick the most recent window.
    for each (let xulWindow in fixIterator(
                                 mozmill.wm.getXULWindowEnumerator(null),
                                 Ci.nsIXULWindow)) {
      if (!this.consider(xulWindow))
        this.monitoringList.push(xulWindow);
    }
  },

  /**
   * The current windowType we are waiting to open.  This is mainly a means of
   *  communicating the desired window type to monitorize without having to
   *  put the argument in the eval string.
   */
  waitingForOpen: null,
  /**
   * Wait for the given windowType to open and finish loading.
   *
   * @return The window wrapped in a MozMillController.
   */
  waitForWindowOpen: function WindowWatcher_waitForWindowOpen(aWindowType) {
    this.waitingForOpen = aWindowType;
    utils.waitFor(function () this.monitorizeOpen(),
                  "Timed out waiting for window open!",
                  this._firstWindowOpened ? WINDOW_OPEN_TIMEOUT_MS
                    : FIRST_WINDOW_EVER_TIMEOUT_MS,
                  this._firstWindowOpened ? WINDOW_OPEN_CHECK_INTERVAL_MS
                    : FIRST_WINDOW_CHECK_INTERVAL_MS,
                  this);

    this.waitingForOpen = null;
    let xulWindow = this.waitingList.get(aWindowType);
    let domWindow = xulWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                      .getInterface(Ci.nsIDOMWindow);
    this.waitingList.delete(aWindowType);
    // spin the event loop to make sure any setTimeout 0 calls have gotten their
    //  time in the sun.
    controller.sleep(0);
    this._firstWindowOpened = true;
    // wrap the creation because 
    mark_action("winhelp", "new MozMillController()", [aWindowType]);
    let c = new controller.MozMillController(domWindow);
    mark_action("winhelp", "/new MozMillController()", [aWindowType]);
    return c;
  },

  /**
   * Because the modal dialog spins its own event loop, the mozmill idiom of
   *  spinning your own event-loop as performed by waitFor is no good.  We use
   *  this timer to generate our events so that we can have a waitFor
   *  equivalent.
   *
   * We only have one timer right now because modal dialogs that spawn modal
   *  dialogs are not tremendously likely.
   */
  _timer: null,
  _timerRuntimeSoFar: 0,
  /**
   * The test function to run when the modal dialog opens.
   */
  subTestFunc: null,
  planForModalDialog: function WindowWatcher_planForModalDialog(aWindowType,
                                                                aSubTestFunc) {
    if (this._timer == null)
      this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.waitingForOpen = aWindowType;
    this.subTestFunc = aSubTestFunc;
    this.waitingList.set(aWindowType, null);

    this._timerRuntimeSoFar = 0;
    this._timer.initWithCallback(this, WINDOW_OPEN_CHECK_INTERVAL_MS,
                                 Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  /**
   * This is the nsITimer notification we receive...
   */
  notify: function WindowWatcher_notify() {
    if (this.monitorizeOpen()) {
      // okay, the window is opened, and we should be in its event loop now.
      let xulWindow = this.waitingList.get(this.waitingForOpen);
      let domWindow = xulWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                        .getInterface(Ci.nsIDOMWindow);
      let troller = new controller.MozMillController(domWindow);
      augment_controller(troller, this.waitingForOpen);

      this._timer.cancel();

      let self = this;
      function startTest() {
        try {
          let runner = new frame.Runner(collector);
          runner.wrapper(self.subTestFunc, troller);
        }
        finally {
          self.subTestFunc = null;
        }

        // if the test failed, make sure we force the window closed...
        // except I'm not sure how to easily figure that out...
        // so just close it no matter what.
        troller.window.close();

        self.waitingList.delete(self.waitingForOpen);
        // now we are waiting for it to close...
        self.waitingForClose = self.waitingForOpen;
        self.waitingForOpen = null;
      }

      let targetFocusedWindow = {};
      Services.focus.getFocusedElementForWindow(domWindow, true,
                                                targetFocusedWindow);
      targetFocusedWindow = targetFocusedWindow.value;

      let focusedWindow = {};
      if (Services.focus.activeWindow) {
        Services.focus.getFocusedElementForWindow(Services.focus.activeWindow, true,
                                                  focusedWindow);

        focusedWindow = focusedWindow.value;
      }

      if (focusedWindow == targetFocusedWindow) {
        startTest();
      } else {
        function onFocus(event) {
          targetFocusedWindow.removeEventListener("focus", onFocus, true);
          targetFocusedWindow.setTimeout(startTest, 0);
        }
        targetFocusedWindow.addEventListener("focus", onFocus, true);
        targetFocusedWindow.focus();
      }
    }
    // notify is only used for modal dialogs, which are never the first window,
    //  so we can always just use this set of timeouts/intervals.
    this._timerRuntimeSoFar += WINDOW_OPEN_CHECK_INTERVAL_MS;
    if (this._timerRuntimeSoFar >= WINDOW_OPEN_TIMEOUT_MS) {
      this._timer.cancel();
      throw new Error("Timeout while waiting for modal dialog.\n");
    }
  },

  /**
   * Symmetry for planForModalDialog; conceptually provides the waiting.  In
   *  reality, all we do is potentially soak up the event loop a little to
   */
  waitForModalDialog: function WindowWatcher_waitForModalDialog(aWindowType, aTimeout) {
    // did the window already come and go?
    if (this.subTestFunc == null)
      return;
    // spin the event loop until we the window has come and gone.
    utils.waitFor(function () (this.waitingForOpen == null &&
                               this.monitorizeClose()),
                  "Timeout waiting for modal dialog to open.",
                  aTimeout || WINDOW_OPEN_TIMEOUT_MS,
                  WINDOW_OPEN_CHECK_INTERVAL_MS, this);
    this.waitingForClose = null;
  },

  planForWindowClose: function WindowWatcher_planForWindowClose(aXULWindow) {
    let windowType =
      aXULWindow.document.documentElement.getAttribute("windowtype") ||
      aXULWindow.document.documentElement.getAttribute("id");
    this.waitingList.set(windowType, aXULWindow);
    this.waitingForClose = windowType;
  },

  /**
   * The current windowType we are waiting to close.  Same deal as
   *  waitingForOpen, this makes the eval less crazy.
   */
  waitingForClose: null,
  waitForWindowClose: function WindowWatcher_waitForWindowClose() {
    utils.waitFor(function () this.monitorizeClose(),
                  "Timeout waiting for window to close!",
      WINDOW_CLOSE_TIMEOUT_MS, WINDOW_CLOSE_CHECK_INTERVAL_MS, this);
    let didDisappear = (this.waitingList.get(this.waitingForClose) == null);
    this.waitingList.delete(windowType);
    let windowType = this.waitingForClose;
    this.waitingForClose = null;
    if (!didDisappear)
      throw new Error(windowType + " window did not disappear!");
  },

  /**
   * This notification gets called when windows tell the widnow mediator when
   *  the window title gets changed.  In theory, we could use this to be
   *  event driven with less polling (effort), but it is not to be.
   */
  onWindowTitleChange: function WindowWatcher_onWindowTitleChange(
      aXULWindow, aNewTitle) {
    mark_action("winhelp", "onWindowTitleChange",
                [getWindowTypeForXulWindow(aXULWindow, true) +
                   " (" + getUniqueIdForXulWindow(aXULWindow) + ")",
                 "changed title to", aNewTitle]);
  },

  /**
   * Used by waitForWindowOpen to check all of the windows we are monitoring and
   *  then check if we have any results.
   *
   * @return true if we found what we were |waitingForOpen|, false otherwise.
   */
  monitorizeOpen: function () {
    for (let iWin = this.monitoringList.length - 1; iWin >= 0; iWin--) {
      let xulWindow = this.monitoringList[iWin];
      if (this.consider(xulWindow))
        this.monitoringList.splice(iWin, 1);
    }

    return this.waitingList.has(this.waitingForOpen) &&
           (this.waitingList.get(this.waitingForOpen) != null);
  },

  /**
   * Used by waitForWindowClose to check if the window we are waiting to close
   *  actually closed yet.
   *
   * @return true if it closed.
   */
  monitorizeClose: function () {
    return this.waitingList.get(this.waitingForClose) == null;
  },

  /**
   * A list of xul windows to monitor because they are loading and it's not yet
   *  possible to tell whether they are something we are looking for.
   */
  monitoringList: [],
  /**
   * Monitor the given window's loading process until we can determine whether
   *  it is what we are looking for.
   */
  monitorWindowLoad: function(aXULWindow) {
    this.monitoringList.push(aXULWindow);
  },

  /**
   * nsIWindowMediatorListener notification that a XUL window was opened.  We
   *  check out the window, and if we were not able to fully consider it, we
   *  add it to our monitoring list.
   */
  onOpenWindow: function WindowWatcher_onOpenWindow(aXULWindow) {
    // note: we would love to add our window activation/deactivation listeners
    //  and poke our unique id, but there is no contentViewer at this point
    //  and so there's no place to poke our unique id.  (aXULWindow does not
    //  let us put expandos on; it's an XPCWrappedNative and explodes.)
    // There may be nuances about outer window/inner window that make it
    //  feasible, but I have forgotten any such nuances I once knew.

    // It would be great to be able to indicate if the window is modal or not,
    //  but nothing is really jumping out at me to enable that...
    mark_action("winhelp", "onOpenWindow",
                [getWindowTypeForXulWindow(aXULWindow, true) +
                   " (" + getUniqueIdForXulWindow(aXULWindow) + ")",
                   "active?", Services.focus.focusedWindow == aXULWindow]);
    if (!this.consider(aXULWindow))
      this.monitorWindowLoad(aXULWindow);
  },

  /**
   * Consider if the given window is something in our |waitingList|.
   *
   * @return true if we were able to fully consider the object, false if we were
   *     not and need to be called again on the window later.  This has no
   *     relation to whether the window was one in our waitingList or not.
   *     Check the waitingList structure for that.
   */
  consider: function (aXULWindow) {
    let windowType = getWindowTypeForXulWindow(aXULWindow);
    if (windowType == null)
      return false;

    // stash the window if we were watching for it
    if (this.waitingList.has(windowType)) {
      this.waitingList.set(windowType, aXULWindow);
    }

    return true;
  },

  /**
   * Closing windows have the advantage of having to already have been loaded,
   *  so things like their windowtype are immediately available.
   */
  onCloseWindow: function WindowWatcher_onCloseWindow(aXULWindow) {
    let domWindow = aXULWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                       .getInterface(Ci.nsIDOMWindow);
    let windowType =
      domWindow.document.documentElement.getAttribute("windowtype") ||
      domWindow.document.documentElement.getAttribute("id");
    mark_action("winhelp", "onCloseWindow",
                [getWindowTypeForXulWindow(aXULWindow, true) +
                   " (" + getUniqueIdForXulWindow(aXULWindow) + ")"]);
    if (this.waitingList.has(windowType))
      this.waitingList.set(windowType, null);
  },
};

/**
 * Call this if the window you want to get may already be open.  What we
 *  provide above just directly grabbing the window yourself is:
 * - We wait for it to finish loading.
 * - We augment it via the augment_controller mechanism.
 *
 * @param aWindowType the window type that will be created.  This is literally
 *     the value of the "windowtype" attribute on the window.  The values tend
 *     to look like "app:windowname", for example "mailnews:search".
 *
 * @return The loaded window of the given type wrapped in a MozmillController
 *     that is augmented using augment_controller.
 */
function wait_for_existing_window(aWindowType) {
  mark_action("fdh", "wait_for_existing_window", [aWindowType]);
  WindowWatcher.ensureInited();
  WindowWatcher.planForAlreadyOpenWindow(aWindowType);
  return augment_controller(WindowWatcher.waitForWindowOpen(aWindowType),
                            aWindowType);
}

/**
 * Call this just before you trigger the event that will cause a window to be
 *  displayed.
 * In theory, we don't need this and could just do a sweep of existing windows
 *  when you call wait_for_new_window, or we could always just keep track of
 *  the most recently seen window of each type, but this is arguably more
 *  resilient in the face of multiple windows of the same type as long as you
 *  don't try and open them all at the same time.
 *
 * @param aWindowType the window type that will be created.  This is literally
 *     the value of the "windowtype" attribute on the window.  The values tend
 *     to look like "app:windowname", for example "mailnews:search".
 */
function plan_for_new_window(aWindowType) {
  mark_action("fdh", "plan_for_new_window", [aWindowType]);
  WindowWatcher.ensureInited();
  WindowWatcher.planForWindowOpen(aWindowType);
}


/**
 * Wait for the loading of the given window type to complete (that you
 *  previously told us about via |plan_for_new_window|), returning it wrapped
 *  in a MozmillController.
 *
 * @return The loaded window of the given type wrapped in a MozmillController
 *     that is augmented using augment_controller.
 */
function wait_for_new_window(aWindowType) {
  mark_action("fdh", "wait_for_new_window", [aWindowType]);
  let c = augment_controller(WindowWatcher.waitForWindowOpen(aWindowType),
                             aWindowType);
  // A nested event loop can get spun inside the Controller's constructor
  //  (which is arguably not a great idea), so it's important that we denote
  //  when we're actually leaving this function in case something crazy
  //  happens.
  mark_action("fdhb", "/wait_for_new_window", [aWindowType]);
  return c;
}

/**
 * Plan for the imminent display of a modal dialog.  Modal dialogs spin their
 *  own event loop which means that either that control flow will not return
 *  to the caller until the modal dialog finishes running.  This means that
 *  you need to provide a sub-test function to be run inside the modal dialog
 *  (and it should not start with "test" or mozmill will also try and run it.)
 *
 * @param aWindowType The window type that you expect the modal dialog to have
 *                    or the id of the window if there is no window type
 *                    available.
 * @param aSubTestFunction The sub-test function that will be run once the modal
 *     dialog appears and is loaded.  This function should take one argument,
 *     a MozmillController against the modal dialog.
 */
function plan_for_modal_dialog(aWindowType, aSubTestFunction) {
  mark_action("fdh", "plan_for_modal_dialog", [aWindowType]);
  WindowWatcher.ensureInited();
  WindowWatcher.planForModalDialog(aWindowType, aSubTestFunction);
}
/**
 * In case the dialog might be stuck for a long time, you can pass an optional
 *  timeout.
 *
 * @param aTimeout Your custom timeout (default is WINDOW_OPEN_TIMEOUT_MS)
 */
function wait_for_modal_dialog(aWindowType, aTimeout) {
  mark_action("fdh", "wait_for_modal_dialog", [aWindowType, aTimeout]);
  WindowWatcher.waitForModalDialog(aWindowType, aTimeout);
  mark_action("fdhb", "/wait_for_modal_dialog", [aWindowType, aTimeout]);
}

/**
 * Call this just before you trigger the event that will cause the provided
 *  controller's window to disappear.  You then follow this with a call to
 *  |wait_for_window_close| when you want to block on verifying the close.
 *
 * @param aController The MozmillController, potentially returned from a call to
 *     wait_for_new_window, whose window should be disappearing.
 */
function plan_for_window_close(aController) {
  mark_action("fdh", "plan_for_window_close",
              [getWindowTypeForXulWindow(aController.window, true)]);
  WindowWatcher.ensureInited();
  WindowWatcher.planForWindowClose(aController.window);
}

/**
 * Wait for the closure of the window you noted you would listen for its close
 *  in plan_for_window_close.
 */
function wait_for_window_close() {
  mark_action("fdh", "wait_for_window_close",
              ["(using window from plan_for_window_close)"]);
  WindowWatcher.waitForWindowClose();
}

/**
 * Close a window by calling window.close() on the controller.
 *
 * @param aController the controller whose window is to be closed.
 */
function close_window(aController) {
  plan_for_window_close(aController);
  aController.window.close();
  wait_for_window_close();
}

/**
 * Wait for the window to be focused.
 *
 * @param aWindow the window to be focused.
 */
function wait_for_window_focused(aWindow) {
  let targetWindow = {};

  Services.focus.getFocusedElementForWindow(aWindow, true,
                                            targetWindow);
  targetWindow = targetWindow.value;

  let focusedWindow = {};
  if (Services.focus.activeWindow) {
    Services.focus.getFocusedElementForWindow(Services.focus.activeWindow,
                                              true, focusedWindow);
    focusedWindow = focusedWindow.value;
  }

  let focused = false;
  if (focusedWindow == targetWindow) {
    focused = true;
  } else {
    function onFocus(event) {
      targetWindow.removeEventListener("focus", onFocus, true);
      focused = true;
    }
    targetWindow.addEventListener("focus", onFocus, true);
    targetWindow.focus();
  }

  utils.waitFor(function() focused,
      "Timeout waiting for window to be focused.",
      WINDOW_FOCUS_TIMEOUT_MS, 100, this);
}

/**
 * Given a <browser>, waits for it to completely load.
 *
 * @param aBrowser The <browser> element to wait for.
 * @param aURLOrPredicate The URL that should be loaded (string) or a predicate
 *                        for the URL (function).
 * @returns The browser's content window wrapped in a MozMillController.
 */
function wait_for_browser_load(aBrowser, aURLOrPredicate) {
  // aBrowser has all the fields we need already.
  return _wait_for_generic_load(aBrowser, aURLOrPredicate);
}

/**
 * Given an HTML <frame> or <iframe>, waits for it to completely load.
 *
 * @param aFrame The element to wait for.
 * @param aURLOrPredicate The URL that should be loaded (string) or a predicate
 *                        for the URL (function).
 * @returns The frame wrapped in a MozMillController.
 */
function wait_for_frame_load(aFrame, aURLOrPredicate) {
  let details = {
    // Not sure whether all of these really need to be getters, but this is the
    // safest thing to do.
    get webProgress () (aFrame.contentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                              .getInterface(Ci.nsIWebNavigation)
                              .QueryInterface(Ci.nsIWebProgress)),
    get currentURI () (NetUtil.newURI(aFrame.contentDocument.location)),
    get contentWindow () (aFrame.contentWindow),
  };
  return _wait_for_generic_load(details, aURLOrPredicate);
}

/**
 * Generic function to wait for some sort of document to load. We expect
 * aDetails to have three fields:
 * - webProgress: an nsIWebProgress associated with the contentWindow.
 * - currentURI: the currently loaded page (nsIURI). 
 * - contentWindow: the content window.
 */
function _wait_for_generic_load(aDetails, aURLOrPredicate) {
  let predicate;
  if (typeof aURLOrPredicate == "string") {
    let expectedURL = NetUtil.newURI(aURLOrPredicate);
    predicate = function (url) (expectedURL.equals(url));
  }
  else {
    predicate = aURLOrPredicate;
  }

  function isLoadedChecker() {
    if (aDetails.webProgress.isLoadingDocument !== false)
      return false;

    return predicate(aDetails.currentURI);
  }

  try {
    utils.waitFor(isLoadedChecker);
  } catch (e if e instanceof utils.TimeoutError) {
    mark_failure(["Timeout waiting for content page to load. Current URL is:",
                  aDetails.currentURI.spec]);
  }

  // Lie to mozmill to convince it to not explode because these frames never
  // get a mozmillDocumentLoaded attribute (bug 666438).
  let contentWindow = aDetails.contentWindow;
  let windowId = contentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                              .getInterface(Ci.nsIDOMWindowUtils)
                              .outerWindowID;
  controller.windowMap.update(windowId, "loaded", true);
  let cwc = new controller.MozMillController(contentWindow);
  return augment_controller(cwc);
}


let observationWaitFuncs = {};
let observationSaw = {};
/**
 * Plan for a notification to be sent via the observer service.
 *
 * @param aTopic The topic that will be sent via the observer service.
 */
function plan_for_observable_event(aTopic) {
  mark_action("fdh", "plan_for_observable_event", [aTopic]);
  observationSaw[aTopic] = false;
  let waiter = observationWaitFuncs[aTopic] = {
    observe: function() {
      mark_action("winhelp", "observed event", [aTopic]);
      observationSaw[aTopic] = true;
    }
  };
  Services.obs.addObserver(waiter, aTopic, false);
}

/**
 * Wait for a notification (previously planned for via
 *  |plan_for_observable_event|) to fire.
 *
 * @param aTopic The topic sent via the observer service.
 */
function wait_for_observable_event(aTopic) {
  mark_action("fdh", "wait_for_observable_event", [aTopic]);
  try {
    function areWeThereYet() {
      return observationSaw[aTopic];
    }
    utils.waitFor(areWeThereYet,
                  "Timed out waiting for notification: " + aTopic);
  }
  finally {
    Services.obs.removeObserver(observationWaitFuncs[aTopic], aTopic);
    delete observationWaitFuncs[aTopic];
    delete observationSaw[aTopic];
  }
}


/**
 * Methods to augment every controller that passes through augment_controller.
 */
var AugmentEverybodyWith = {
  methods: {
    /**
     * @param aId The element id to use to locate the (initial) element.
     * @param aQuery Optional query to pick a child of the element identified
     *   by the id.  Terms that can be used (and applied in this order):
     * - tagName: Find children with the tagname, if further constraints don't
     *     whittle it down, the first element is chosen.
     * - label: Whittle previous elements by their label.
     *
     * example:
     *  // find the child of bob that is a button with a "+" on it.
     *  e("bob", {tagName: "button", label: "+"});
     *  // example:
     *  e("threadTree", {tagName: "treechildren"});
     *
     * @return the element with the given id on the window's document
     */
    e: function _get_element_by_id_helper(aId, aQuery) {
      let elem = this.window.document.getElementById(aId);
      if (aQuery) {
        if (aQuery.tagName) {
          let elems = Array.prototype.slice.call(
                        elem.getElementsByTagName(aQuery.tagName));
          if (aQuery.label)
            elems = [elem for each (elem in elems)
                          if (elem.label == aQuery.label)];
          elem = elems[0];
        }
      }
      return elem;
    },

    /**
     * @return an elementlib.Elem for the element with the given id on the
     *  window's document.
     */
    eid: function _get_elementid_by_id_helper(aId, aQuery) {
      return new elib.Elem(this.e(aId, aQuery));
    },

    /**
     * Wait for an element with the given id to show up.
     *
     * @param aId The DOM id of the element you want to wait to show up.
     */
    ewait: function _wait_for_element_by_id_helper(aId) {
      this.waitForElement(new elib.ID(this.window.document, aId));
    },

    /**
     * Find an element in the anonymous subtree of an element in the document
     *  identified by its id.  You would use this to dig into XBL bindings that
     *  are not doing what you want.  For example, jerks that don't focus right.
     *
     * Examples:
     *  // by class of the node
     *  a("searchVal0", {class: "search-value-textbox"});
     *  // when the thing is vaguely deck-like
     *  a("searchVal0", {crazyDeck: 0});
     *  // when you want the first descendent with the given tagName
     *  a("threadTree", {tagName: "treechildren"})
     *
     * @param aId The element id or the actual element.
     *
     * @return the anonymous element determined by the query found in the
     *  anonymous sub-tree of the element with the given id.
     */
    a: function _get_anon_element_by_id_and_query(aId, aQuery) {
      let realElem = (typeof(aId) == "string") ?
                       this.window.document.getElementById(aId) : aId;
      if (aQuery["class"]) {
        return this.window.document.getAnonymousElementByAttribute(
          realElem, "class", aQuery["class"]);
      }
      else if(aQuery.crazyDeck != null) {
        let anonNodes = this.window.document.getAnonymousNodes(realElem);
        let index;
        if (realElem.hasAttribute("selectedIndex"))
          index = parseInt(realElem.getAttribute("selectedIndex"));
        else
          index = aQuery.crazyDeck;
        let elem = anonNodes[index];
        return elem;
      }
      else if(aQuery.tagName) {
        let anonNodes = this.window.document.getAnonymousNodes(realElem);
        let index;
        for (let iNode = 0; iNode < anonNodes.length; iNode++) {
          let node = anonNodes[iNode];
          let named = node.querySelector(aQuery.tagName);
          if (named)
            return named;
        }
      }
      else {
        let msg = "Query constraint not implemented, query contained:";
        for (let [key, val] in Iterator(aQuery)) {
          msg += " '" + key + "': " + val;
        }
        throw new Error(msg);
      }
      return null;
    },
    /**
     * Wraps a call to a() in an elib.Elem.
     */
    aid: function _get_anon_elementid(aId, aQuery) {
      return new elib.Elem(this.a(aId, aQuery));
    },

    /**
     * Debug helper that defers a click until the next event loop spin in order
     *  to create situations that are hard to test in isolation.  In order to
     *  fashion reliable failures, we currently use a 1-second delay to make
     *  sure things get sufficiently gummed up.
     * Only use this for locally reproducing tinderbox failures; do not commit
     *  code that uses this!
     *
     * This gets its own method rather than a generic deferring wrapper so we
     *  can strap debug on and because it's meant so you can easily just
     *  prefix on 'defer_' and be done with it.
     */
    defer_click: function _augmented_defer_click(aWhatToClick) {
      let dis = this;
      dis.window.setTimeout(function() {
                              dis.click(aWhatToClick);
                            }, 1000);
    },

    /**
     * Dynamically-built/XBL-defined menus can be hard to work with, this makes it
     *  easier.
     *
     * @param aRootPopup The base popup.  We will open it if it is not open or
     *     wait for it to open if it is in the process.
     * @param aActions A list of objects where each object has a single
     *     attribute with a single value.  We pick the menu option whose DOM
     *     node has an attribute with that name and value.  We click whatever we
     *     find.  We throw if we don't find what you were asking for.
     * @param aKeepOpen  If set to true the popups are not closed after last click.
     *
     * @return  An array of popup elements that were left open. It will be
     *          an empty array if aKeepOpen was set to true.
     */
    click_menus_in_sequence: function _click_menus(aRootPopup, aActions, aKeepOpen) {
      if (aRootPopup.state == "closed")
        aRootPopup.openPopup(null, "", 0, 0, true, true);
      aRootPopup.focus(); // This is a hack that can be removed once the focus issues on Linux are solved.
      if (aRootPopup.state != "open") { // handle "showing"
        utils.waitFor(function() { return aRootPopup.state == "open"; },
                      "Popup never opened! id=" + aRootPopup.id +
                      ", state=" + aRootPopup.state, 5000, 50);
      }
      // These popups sadly do not close themselves, so we need to keep track
      // of them so we can make sure they end up closed.
      let closeStack = [aRootPopup];

      let curPopup = aRootPopup;
      for each (let [iAction, actionObj] in Iterator(aActions)) {
        /**
         * Check if aNode attributes match all those given in actionObj.
         * Nodes that are obvious containers are skipped, and their children
         * will be used to recursively find a match instead.
         */
        let findMatch = function(aNode) {
          // Ignore some elements and just use their children instead.
          if (aNode.localName == "hbox" || aNode.localName == "vbox" ||
              aNode.localName == "splitmenu") {
            for (let i = 0; i < aNode.children.length; i++) {
              let childMatch = findMatch(aNode.children[i]);
              if (childMatch)
                return childMatch;
            }
            return null;
          }

          let matchedAll = true;
          for each (let [name, value] in Iterator(actionObj)) {
            if (!aNode.hasAttribute(name) ||
                aNode.getAttribute(name) != value) {
              matchedAll = false;
              break;
            }
          }
          return (matchedAll) ? aNode : null;
        };

        let matchingNode = null;
        let kids = curPopup.children;
        for (let iKid = 0; iKid < kids.length; iKid++) {
          let node = kids[iKid];
          matchingNode = findMatch(node);
          if (matchingNode)
            break;
        }

        if (!matchingNode)
          throw new Error("Did not find matching menu item for action index " +
                          iAction + ": " + JSON.stringify(actionObj));

        this.click(new elib.Elem(matchingNode));
        matchingNode.focus(); // This is a hack that can be removed once the focus issues on Linux are solved.
        if ("menupopup" in matchingNode) {
          curPopup = matchingNode.menupopup;
          closeStack.push(curPopup);
          utils.waitFor(function() { return curPopup.state == "open"; },
                        "Popup never opened at action depth " + iAction +
                        "; id=" + curPopup.id + ", state=" + curPopup.state,
                        5000, 50);
        }
      }

      if (!aKeepOpen) {
        this.close_popup_sequence(closeStack);
        return [];
      } else {
        return closeStack;
      }
    },

    /**
     * Close given menupopups.
     *
     * @param aCloseStack  An array of menupopup elements that are to be closed.
     *                     The elements are processed from the end of the array
     *                     to the front (a stack).
     */
    close_popup_sequence: function _close_popup_sequence(aCloseStack) {
      while (aCloseStack.length) {
        let curPopup = aCloseStack.pop();
        this.keypress(new elib.Elem(curPopup), "VK_ESCAPE", {});
        utils.waitFor(function() { return curPopup.state == "closed"; },
                      "Popup did not close! id=" + curPopup.id +
                      ", state=" +  curPopup.state, 5000, 50);
      }
    },

    /**
     * mark_action helper method that produces something that can be concat()ed
     *  onto a list being passed to mark_action in order to describe the focus
     *  state of the window.  For now this will be a variable-length list but
     *  could be changed to a single object in the future.
     */
    describeFocus: function() {
      let arr = [
        "in window:",
        getWindowTypeForXulWindow(this.window) + " (" +
          getUniqueIdForXulWindow(this.window) + ")"];
      let focusedWinOut = {}, focusedElement, curWindow = this.window;
      // Use the focus manager to walk down through focused sub-frames so
      //  in the event that there is no focused element but there is a focused
      //  sub-frame, we can know that.
      for (;;) {
        focusedElement = Services.focus.getFocusedElementForWindow(curWindow,
                                                                   false,
                                                                   focusedWinOut);
        arr.push("focused kid:");
        arr.push(focusedElement);

        if (focusedElement && ("contentWindow" in focusedElement)) {
          curWindow = focusedElement.contentWindow;
          continue;
        }
        break;
      }

      return arr;
    },
  },
  getters: {
    focusedElement: function() {
      let ignoredFocusedWindow = {};
      return Services.focus.getFocusedElementForWindow(this.window, true,
                                                       ignoredFocusedWindow);
    },
  },
};

/**
 * Clicks and other mouse operations used to be recognized just outside a curved
 * border but are no longer so (bug 595652), so we need these wrappers to
 * perform the operations at the center when aLeft or aTop aren't passed in.
 */
const MOUSE_OPS_TO_WRAP = [
  "click", "doubleClick", "mouseDown", "mouseOut", "mouseOver", "mouseUp",
  "middleClick", "rightClick",
];

for (let [, mouseOp] in Iterator(MOUSE_OPS_TO_WRAP)) {
  let thisMouseOp = mouseOp;
  let wrapperFunc = function (aElem, aLeft, aTop) {
    let el = aElem.getNode();
    let rect = el.getBoundingClientRect();
    if (aLeft === undefined)
      aLeft = rect.width / 2;
    if (aTop === undefined)
      aTop = rect.height / 2;
    // claim to be folder-display-helper since this is an explicit action
    mark_action("fdh", thisMouseOp,
                [normalize_for_json(el), "x:", aLeft, "y:", aTop]);
    // |this| refers to the window that gets augmented, which is what we want
    this.__proto__[thisMouseOp](aElem, aLeft, aTop);
  };
  AugmentEverybodyWith.methods[thisMouseOp] = wrapperFunc;
}

/**
 * Per-windowtype augmentations.  Please use the documentation and general
 *  example of mail:3pane as your example.
 */
var PerWindowTypeAugmentations = {
  /**
   * The 3pane window is messenger.xul, the default window.
   */
  "mail:3pane": {
    /**
     * DOM elements to expose as attributes (by copying at augmentation time.)
     */
    elementsToExpose: {
      threadTree: "threadTree",
      folderTree: "folderTree",
      tabmail: "tabmail",
    },
    /**
     * DOM elements to expose as elementslib.IDs as attributes (at augmentation
     *  time.)
     */
    elementIDsToExpose: {
      eThreadTree: "threadTree",
    },
    /**
     * Globals from the controller's windows global scope at augmentation time.
     */
    globalsToExposeAtStartup: {
      folderTreeView: "gFolderTreeView",
      folderTreeController: "gFolderTreeController",
    },
    /**
     * Globals from the controller's windows global to retrieve on-demand
     *  through getters.
     */
    globalsToExposeViaGetters: {
      // all of these dudes
      folderDisplay: "gFolderDisplay",
      messageDisplay: "gMessageDisplay",
    },
    /**
     * Custom getters whose |this| is the controller.
     */
    getters: {
      dbView: function () {
        return this.folderDisplay.view.dbView;
      },
      contentPane: function () {
        return this.tabmail.getBrowserForSelectedTab();
      },
    },

    /**
     * Invoked when we are augmenting a controller.  This is a great time to
     *  poke into the global namespace as required.
     */
    onAugment: function(aController) {
      // -- turn off summarization's stabilization logic for now by setting the
      //  timer interval to 0.  We do need to make sure that we drain the event
      //  queue after performing anything that will summarize, but use of
      //  assert_selected_and_displayed in test-folder-display-helpers should
      //  handle that.
      aController.window.MessageDisplayWidget.prototype
                 .SUMMARIZATION_SELECTION_STABILITY_INTERVAL_MS = 0;
    },
    
    /**
     * Used to wrap methods on a class prototype in order to generate
     *  mark_action data about the call.
     */         
    debugTrace: [
      // wrap 3pane unload function to notice when it explodes
      {
        method: "OnUnloadMessenger",
        onGlobal: true,
        reportAs: "OnUnloadMessenger",
      },
      // goDoCommand command gobbling notification
      {
        method: "goDoCommand",
        onGlobal: true,
        doBefore: function(command) {
          let controller = this.top.document
                             .commandDispatcher
                             .getControllerForCommand(command);
          if (controller && !controller.isCommandEnabled(command))
            mark_action("winhelp", "goDoCommand",
                        ["about to ignore command because it's disabled:",
                         command]);
        }
      },
      // DefaultController command gobbling notification
      {
        method: "doCommand",
        onObject: "DefaultController",
        doBefore: function(command) {
          if (!this.isCommandEnabled(command))
            mark_action("winhelp", "DC_doCommand",
                        ["about to ignore command because it's disabled:",
                         command]);
        }
      },
      // FolderDisplayWidget command invocations
      {
        method: "doCommand",
        onConstructor: "FolderDisplayWidget",
        reportAs: "FDW_doCommand",
      },
      {
        method: "doCommandWithFolder",
        onConstructor: "FolderDisplayWidget",
        reportAs: "FDW_doCommandWithFolder",
      },
      // MessageDisplayWidget annotation
      {
        method: "onLoadStarted",
        onConstructor: "MessageDisplayWidget",
        doBefore: function() {
          mark_action("winhelp", "MD_onLoadStarted",
                      ["singleMessageDisplay?", this.singleMessageDisplay]);
        }
      },
      {
        method: "onLoadCompleted",
        onConstructor: "MessageDisplayWidget",
        doBefore: function() {
          mark_action("winhelp", "MD_onLoadCompleted",
                      ["singleMessageDisplay?", this.singleMessageDisplay]);
        }
      },
      // Message summarization annotations
      {
        method: "summarize",
        onConstructor: "MultiMessageSummary",
        reportAs: "MD_MultiMessageSummary_summarize",
        showArgs: false,
      },
      {
        method: "onQueryCompleted",
        onConstructor: "MultiMessageSummary",
        reportAs: "MD_*Summary_onQueryCompleted",
        showArgs: false,
      },
      {
        method: "summarize",
        onConstructor: "ThreadSummary",
        reportAs: "MD_ThreadSummary_summarize",
        showArgs: false,
      },
    ],
  },

  /**
   * Standalone message window.
   */
  "mail:messageWindow": {
    elementsToExpose: {
      contentPane: "messagepane",
    },
    // the load is deferred, so use a getter.
    globalsToExposeViaGetters: {
      folderDisplay: "gFolderDisplay",
      messageDisplay: "gMessageDisplay",
    },
    getters: {
      dbView: function () {
        return this.folderDisplay.view.dbView;
      },
    },
  },

  /**
   * The search window, via control-shift-F.
   */
  "mailnews:search": {
    elementsToExpose: {
      threadTree: "threadTree",
    },
    globalsToExposeAtStartup: {
      folderDisplay: "gFolderDisplay",
    },
    globalsToExposeViaGetters: {
      currentFolder: "gCurrentFolder",
    },
    getters: {
      dbView: function () {
        return this.folderDisplay.view.dbView;
      }
    }
  },
};

function _augment_helper(aController, aAugmentDef) {
  if (aAugmentDef.elementsToExpose) {
    for each (let [key, value] in Iterator(aAugmentDef.elementsToExpose)) {
      aController[key] = aController.window.document.getElementById(value);
    }
  }
  if (aAugmentDef.elementsIDsToExpose) {
    for each (let [key, value] in Iterator(aAugmentDef.elementIDsToExpose)) {
      aController[key] = new elib.ID(
                           aController.window.document, value);
    }
  }
  if (aAugmentDef.globalsToExposeAtStartup) {
    for each (let [key, value] in
              Iterator(aAugmentDef.globalsToExposeAtStartup)) {
      aController[key] = aController.window[value];
    }
  }
  if (aAugmentDef.globalsToExposeViaGetters) {
    for each (let [key, value] in
              Iterator(aAugmentDef.globalsToExposeViaGetters)) {
      let globalName = value;
      aController.__defineGetter__(key, function() {
          return this.window[globalName];
        });
    }
  }
  if (aAugmentDef.getters) {
    for each (let [key, value] in Iterator(aAugmentDef.getters)) {
      aController.__defineGetter__(key, value);
    }
  }
  if (aAugmentDef.methods) {
    for each (let [key, value] in Iterator(aAugmentDef.methods)) {
      aController[key] = value;
    }
  }

  if (aAugmentDef.debugTrace) {
    let win = aController.window;
    for each (let [, traceDef] in Iterator(aAugmentDef.debugTrace)) {
      let baseObj, useThis;
      // - Get the object that actually has the method to wrap
      if (traceDef.hasOwnProperty("onGlobal")) {
        baseObj = win;
        useThis = false;
      }
      else if (traceDef.hasOwnProperty("onConstructor")) {
        baseObj = win[traceDef.onConstructor].prototype;
        useThis = true;
      }
      else if (traceDef.hasOwnProperty("onObject")) {
        baseObj = win[traceDef.onObject];
        useThis = false;
      }
      else // ignore/bail if unsupported type
        continue;

      // - compute/set the wrapped attr, bailing if it's already there
      let wrappedName = "__traceWrapped_" + traceDef.method;
      // bail if we/someone have already wrapped it.
      if (baseObj.hasOwnProperty(wrappedName))
        continue;
      let origFunc = baseObj[traceDef.method];
      let reportAs = traceDef.reportAs; // latch
      let showArgs = ("showArgs" in traceDef) ? traceDef.showArgs : true;
      baseObj[wrappedName] = origFunc;

      // - create the trace func based on the definition and apply
      let traceFunc;
      if (traceDef.hasOwnProperty("doBefore")) {
        let beforeFunc = traceDef.doBefore;
        traceFunc = function() {
          beforeFunc.apply(useThis ? this : baseObj, arguments);
          return origFunc.apply(this, arguments);
        }
      }
      else {
        traceFunc = function() {
          mark_action("winhelp", reportAs,
                      showArgs ? Array.prototype.slice.call(arguments) : []);
          try {
            return origFunc.apply(this, arguments);
          }
          catch(ex) {
            mark_failure(["exception in", reportAs, "ex:", ex]);
            // re-throw it; someone might care!
            throw ex;
          }
        }
      }
      baseObj[traceDef.method] = traceFunc;
    }
  }

  if (aAugmentDef.onAugment) {
    aAugmentDef.onAugment(aController);
  }
}

var INPUT_PEEK_EVENTS = ["click", "keypress"];

var UNIQUE_WINDOW_ID_ATTR = "__winHelper_uniqueId";

var DOM_KEYCODE_TO_NAME = {};
function populateDomKeycodeMap() {
  let nsIDOMKeyEvent = Ci.nsIDOMKeyEvent;

  for (let key in nsIDOMKeyEvent) {

    if (key.startsWith("DOM_VK_")) {
      let val = nsIDOMKeyEvent[key];
      DOM_KEYCODE_TO_NAME[val] = key;
    }
  }
}
populateDomKeycodeMap();

/**
 * Given something you would find on event.target (should be a DOM node /
 *  DOM window), attempt to describe the hierarchy of that thing all the way
 *  to the outermost enclosing window.  This is intended to solve the problem
 *  where our event target can be the "Window" of an iframe, which is not
 *  very enlightening.  We really want to know the frameElement and what
 *  window it lives in.
 *
 * This implementation uses nsIDocShellTreeItem stuff and "frameElement" because
 *  "frameElement" intentionally returns null when crossing from content space
 *  to chrome space, and this will happen for many of Thunderbird's iframes.
 *  In the event we hit this transition case, we traverse up to the parent
 *  and attempt to reverse the mapping by finding all the browser/iframe nodes
 *  and then checking their contentWindows against our desired content window.
 *
 * @returns a list suitable for concatenating with another list to be passed
 *   to mark_action.
 */
function describeEventElementInHierarchy(aNode) {
  let arr = [];
  let win = null;
  // DOM node ?
  if ("ownerDocument" in aNode) {
    arr.push(normalize_for_json(aNode));
    if (aNode.ownerDocument)
      win = aNode.ownerDocument.defaultView;
    else
      win = aNode.defaultView;
  }
  else {
    // Otherwise this should be a window.
    win = aNode;
  }
  let treeItem = win.QueryInterface(Ci.nsIInterfaceRequestor)
                    .getInterface(Ci.nsIWebNavigation)
                    .QueryInterface(Ci.nsIDocShellTreeItem);
  while (treeItem) {
    win = treeItem.QueryInterface(Ci.nsIInterfaceRequestor)
                  .getInterface(Ci.nsIDOMWindow);
    // capture the window itself
    arr.push("in");
    arr.push(normalize_for_json(win));

    let parentTreeItem = treeItem.parent;
    // same-type frame element? (easy case)
    if (win.frameElement) {
      arr.push("frame:");
      arr.push(normalize_for_json(win.frameElement));
    }
    else if (parentTreeItem) {
      let parentWin = parentTreeItem.QueryInterface(Ci.nsIInterfaceRequestor)
                        .getInterface(Ci.nsIDOMWindow);
      let frame = _findFrameElementForWindowInWindow(win, parentWin);
      arr.push("frame:");
      arr.push(normalize_for_json(frame));
    }
    treeItem = parentTreeItem;
  }

  return arr;
}

/**
 * Helper for `describeEventElementInHierarchy` that checks all the
 *  browsers/iframes in `parentWin` for the one that has `win` as its
 *  contentWindow.
 */
function _findFrameElementForWindowInWindow(win, parentWin) {
  let elems = parentWin.document.getElementsByTagName("iframe"), i;
  for (i = 0; i < elems.length; i++) {
    // (Must not use === because XPConnect uses wrapper identicality when
    //  we do that.)
    if (elems[i].contentWindow == win)
      return elems[i];
  }
  elems = parentWin.document.getElementsByTagName("browser");
  for (i = 0; i < elems.length; i++) {
    if (elems[i].contentWindow == win)
      return elems[i];
  }
  return null;
}

/**
 * Given an event, provide a uniquely identifying string that usefully
 *  identifies the window.  We do this by getting the windowtype (an ad hoc
 *  attribute on the document element) if available, or the id on the document
 *  element if there was no windowtype.  (Experience has shown these to be
 *  always present).  Additionally, we annotated a unique counter value onto
 *  the window at augmentation time, and so we tack that on to be able to
 *  tell the difference between otherwise similar windows.
 */
function getWindowDescribeyFromEvent(event) {
  var target = event.target;
  // assume it's a window if there's no ownerDocument attribute
  var win = ("ownerDocument" in target) ? target.ownerDocument.defaultView
                                        : target;
  var owningWin =
    win.QueryInterface(Ci.nsIInterfaceRequestor)
       .getInterface(Ci.nsIWebNavigation)
       .QueryInterface(Ci.nsIDocShellTreeItem)
       .rootTreeItem
       .QueryInterface(Ci.nsIInterfaceRequestor)
       .getInterface(Ci.nsIDOMWindow);
  var docElem = owningWin.document.documentElement;
  return (docElem.getAttribute("windowtype") ||
          docElem.getAttribute("id") || "mysterious") +
         " (" + (UNIQUE_WINDOW_ID_ATTR in owningWin ?
                   owningWin[UNIQUE_WINDOW_ID_ATTR] :
                   "n/a") + ")";
}

function __peek_activate_handler(event) {
  mark_action("winhelp", event.type,
              [getWindowDescribeyFromEvent(event)]);
  return true;
}

function __peek_focus_handler(event) {
  mark_action("winhelp", event.type,
              describeEventElementInHierarchy(event.target));
  return true;
}

function __peek_click_handler(event) {
  var s;
  if (event.button === 0)
    s = "left";
  else if (event.button === 1)
    s = "middle";
  else if (event.button === 2)
    s = "right";
  else
    s = "" + event.button;
  if (event.shiftKey)
    s = "shift-" + s;
  if (event.ctrlKey)
    s = "ctrl-"; + s
  if (event.altKey)
    s = "alt-" + s;
  if (event.metaKey)
    s = "meta-" + s;
  mark_action("winhelp", event.type,
              ["mouse button", s,
               "target:", normalize_for_json(event.target),
               "in", getWindowDescribeyFromEvent(event),
               "original target:", normalize_for_json(event.originalTarget)]);
  return true;
}

function __bubbled_click_handler(event) {
  mark_action("winhelpb", "bubbled " + event.type,
              ["mouse button", event.button,
               "target:", normalize_for_json(event.target),
               "in", getWindowDescribeyFromEvent(event),
               "original target:", normalize_for_json(event.originalTarget)]);
  return true;
}

function describeKeyEvent(event) {
  let s;
  if (event.keyCode) {
    s = DOM_KEYCODE_TO_NAME[event.keyCode];
  }
  else if (event.charCode) {
    s = "'" + String.fromCharCode(event.charCode) + "'";
  }
  else {
    s = "no keyCode/charCode?";
  }

  if (event.shiftKey)
    s = "shift-" + s;
  if (event.ctrlKey)
    s = "ctrl-"; + s
  if (event.altKey)
    s = "alt-" + s;
  if (event.metaKey)
    s = "meta-" + s;

  return s;
}

function __peek_keypress_handler(event) {
  mark_action("winhelp", event.type,
              [describeKeyEvent(event),
               "target:", normalize_for_json(event.target),
               "in", getWindowDescribeyFromEvent(event)]);
  return true;
}

function __bubbled_keypress_handler(event) {
  mark_action("winhelpb", "bubbled " + event.type,
              [describeKeyEvent(event),
               "target:", normalize_for_json(event.target),
               "in", getWindowDescribeyFromEvent(event)]);
  return true;
}


function __popup_showing(event) {
  mark_action("winhelp", "popupShowing",
              [this,
               "target:", normalize_for_json(event.target),
               "current target:", normalize_for_json(event.target)]);
  return true;
}

function __popup_shown(event) {
  mark_action("winhelp", "popupShown",
              [this,
               "target:", normalize_for_json(event.target),
               "current target:", normalize_for_json(event.target)]);
  return true;
}

function __popup_hiding(event) {
  mark_action("winhelp", "popupHiding",
              [this,
               "target:", normalize_for_json(event.target),
               "current target:", normalize_for_json(event.target)]);
  return true;
}

function __popup_hidden(event) {
  mark_action("winhelp", "popupHidden",
              [this,
               "target:", normalize_for_json(event.target),
               "current target:", normalize_for_json(event.target)]);
  return true;
}

var gNextOneUpUniqueID = 0;

/**
 * controller.js in mozmill actually has its own extension mechanism,
 *  controllerAdditions.  Unfortunately, it does not make its stuff public at
 *  this time.  In the future we can change ourselves to just use that
 *  mechanism.
 */
function augment_controller(aController, aWindowType) {
  if (aWindowType === undefined)
    aWindowType =
      aController.window.document.documentElement.getAttribute("windowtype");

  _augment_helper(aController, AugmentEverybodyWith);
  if (PerWindowTypeAugmentations[aWindowType])
    _augment_helper(aController, PerWindowTypeAugmentations[aWindowType]);

  // Add a bunch of listeners to generate mark_action events to provide
  //  context for what is actually going on.
  try {
    let doc = aController.window.document;

    aController.window[UNIQUE_WINDOW_ID_ATTR] = gNextOneUpUniqueID++;

    // - window activation / deactivation
    aController.window.addEventListener("activate", __peek_activate_handler,
                                        true);
    aController.window.addEventListener("deactivate", __peek_activate_handler,
                                        true);

    // - capturing listeners
    // (so we can see the start of the event)
    doc.addEventListener("mousedown", __peek_click_handler, true);
    doc.addEventListener("click", __peek_click_handler, true);
    doc.addEventListener("contextmenu", __peek_click_handler, true);
    doc.addEventListener("mouseup", __peek_click_handler, true);

    doc.addEventListener("keypress", __peek_keypress_handler, true);

    doc.addEventListener("focus", __peek_focus_handler, true);
    doc.addEventListener("blur", __peek_focus_handler, true);

    // - bubbling listeners
    // (so we can see if the event got killed / eaten)
    doc.addEventListener("mousedown", __bubbled_click_handler, false);
    doc.addEventListener("click", __bubbled_click_handler, false);
    doc.addEventListener("contextmenu", __bubbled_click_handler, false);
    doc.addEventListener("mouseup", __bubbled_click_handler, false);

    doc.addEventListener("keypress", __bubbled_keypress_handler, false);

    // - also, add pop-up shown/hidden events....
    // We need to add these directly to the popups themselves in order to
    //  see anything.
    let popups = doc.documentElement.getElementsByTagName("menupopup");
    for (let i = 0; i < popups.length; i++) {
      let popup = popups[i];
      popup.addEventListener("popupshowing", __popup_showing, true);
      popup.addEventListener("popupshown", __popup_shown, true);
      popup.addEventListener("popuphiding", __popup_hiding, true);
      popup.addEventListener("popuphidden", __popup_hidden, true);
    }
    // Now go find the anonymous popups for tree column pickers that the
    //  above selector could not find because they live in anonymous
    //  content pocket universes.
    let treecolses = doc.documentElement.getElementsByTagName("treecols");
    for (let i = 0; i < treecolses.length; i++) {
      let treecols = treecolses[i];
      // The treecolpicker element itself doesn't have an id, so we have to walk
      // down from the parent to find it.
      //  treadCols
      //   |- hbox                item 0
      //   |- treecolpicker   <-- item 1 this is the one we want
      let treeColPicker = doc.getAnonymousNodes(treecols).item(1);
      let popup = doc.getAnonymousElementByAttribute(treeColPicker,
                                                     "anonid", "popup");
      popup.addEventListener("popupshowing", __popup_showing, true);
      popup.addEventListener("popupshown", __popup_shown, true);
      popup.addEventListener("popuphiding", __popup_hiding, true);
      popup.addEventListener("popuphidden", __popup_hidden, true);
    }

  }
  catch(ex) {
    dump("!!!! failure augmenting controller: " + ex + "\n" + ex.stack);
  }


  return aController;
}

/**
 * Render the contents of a window to a data URL.  Every effort is made to
 * make the screenshot as real as possible, but currently this is all done using
 * canvas-based rendering which is not the same thing as a real screenshot.
 *
 * @param aWindow The window to render
 */
function screenshotToDataURL(aWindow) {
  // -- render to canvas
  let win = aWindow;
  let doc = win.document;
  let canvas = doc.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  let width = win.innerWidth;
  let height = win.innerHeight;

  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  // We use the following flags, which appear to avoid us needing to
  // recursively render the contained iframes/browsers.  Or the behaviour
  // changed a while ago and we never noticed.
  //  DRAWWINDOW_DRAW_VIEW = 0x04
  //  DRAWWINDOW_USE_WIDGET_LAYERS = 0x08
  ctx.drawWindow(win, 0, 0, width, height, "rgb(0,0,0)",
                 0x04 | 0x08);

  // As per the note about flags above, we no longer appear to need to do
  // the following, so it is commented out.  It is left around rather than
  // deleted because in the event we do need it again, this has some
  // improvements on the other variations a search might turn up.
  //
  // (We may need to do this for popups...)
  /*
  // - find all the sub-windows and render them

  // function isVisible(aElem) has been moved to test-dom-helpers.js and
  // renamed into element_visible_recursive(). If you resurrect the following
  // function subrenderCandidates, then make sure that you import
  // test-dom-helpers.js.

  function subrenderCandidates(aElements) {
    for (let i = 0; i < aElements.length; i++) {
      let elem = aElements[i];
      if (element_visible_recursive(elem)) {
        let rect = elem.getBoundingClientRect();
        ctx.save();
        ctx.translate(rect.left, rect.top);
        ctx.drawWindow(elem.contentWindow,
                       0, 0,
                       rect.right - rect.left, rect.bottom - rect.top,
                       "rgb(255,255,255)");
        ctx.restore();
      }
    }
  }
  subrenderCandidates(doc.documentElement.getElementsByTagName("iframe"));
  subrenderCandidates(doc.documentElement.getElementsByTagName("browser"));
  */

  return canvas.toDataURL("image/png", "");
}

/**
 * Render the contents of a window to a base64-encoded string.
 */
function screenshotToBase64(aWindow) {
  let dataUrl = screenshotToDataURL(aWindow);
  return dataUrl.substring(dataUrl.indexOf("base64,") + 7);
}

/**
 * Capture general information on the state of all open windows and provide
 *  them in a JSON-serializable object blob.
 *
 * Specific details for each window:
 * - Screen coordinates and dimensions of the window.
 * - Is the window active/focused?
 * - The focused element in the window; we leave this up to logHelper to
 *    describe.
 */
function captureWindowStatesForErrorReporting(normalizeForJsonFunc) {
  let info = {};
  let windows = info.windows = [];

  let enumerator = Services.wm.getEnumerator(null);
  let iWin=0;
  while (enumerator.hasMoreElements()) {
    let win = enumerator.getNext().QueryInterface(Ci.nsIDOMWindow);

    let winId = win.document.documentElement.getAttribute("windowtype") ||
                win.document.documentElement.getAttribute("id") ||
                ("unnamed:" + iWin);

    let openPopups =
      Array.prototype.slice.call(
          win.document.documentElement.getElementsByTagName("menupopup"))
        .filter(function(x) x.state != "closed")
        .map(function (x) normalizeForJsonFunc(x));

    let ignoredFocusedWindow = {};
    let winfo = {
      id: winId,
      title: win.document.title,
      coords: {x: win.screenX, y: win.screenY},
      dims: {width: win.outerWidth, height: win.outerHeight},
      pageOffsets: {x: win.pageXOffset, y: win.pageYOffset},
      screenshotDataUrl: screenshotToDataURL(win),
      isActive: Services.focus.activeWindow == win,
      focusedElem: normalizeForJsonFunc(
        Services.focus.getFocusedElementForWindow(win, true,
                                                  ignoredFocusedWindow)),
      openPopups: openPopups,
    };

    windows.push(winfo);
  }

  return info;
}
