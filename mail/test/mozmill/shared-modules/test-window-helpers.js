/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var frame = {};
Cu.import('resource://mozmill/modules/frame.js', frame);

Cu.import('resource://app/modules/iteratorUtils.jsm');

const MODULE_NAME = 'window-helpers';

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

function setupModule() {
  // do nothing
}

function installInto(module) {
  module.plan_for_new_window = plan_for_new_window;
  module.wait_for_new_window = wait_for_new_window;
  module.plan_for_modal_dialog = plan_for_modal_dialog;
  module.wait_for_modal_dialog = wait_for_modal_dialog;
  module.plan_for_window_close = plan_for_window_close;
  module.wait_for_window_close = wait_for_window_close;
  module.wait_for_existing_window = wait_for_existing_window;

  module.augment_controller = augment_controller;
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
  waitingList: {},
  /**
   * Note that we will be looking for a window with the given window type
   *  (ex: "mailnews:search").  This allows us to be ready if an event shows
   *  up before waitForWindow is called.
   */
  planForWindowOpen: function WindowWatcher_planForWindowOpen(aWindowType) {
    this.waitingList[aWindowType] = null;
  },

  /**
   * Like planForWindowOpen but we check for already-existing windows.
   */
  planForAlreadyOpenWindow:
      function WindowWatcher_planForAlreadyOpenWindow(aWindowType) {
    this.waitingList[aWindowType] = null;
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
    controller.waitForEval(
      'subject.monitorizeOpen()',
      this._firstWindowOpened ? WINDOW_OPEN_TIMEOUT_MS
                              : FIRST_WINDOW_EVER_TIMEOUT_MS,
      this._firstWindowOpened ? WINDOW_OPEN_CHECK_INTERVAL_MS
                              : FIRST_WINDOW_CHECK_INTERVAL_MS,
      this);
    this.waitingForOpen = null;
    let xulWindow = this.waitingList[aWindowType];
dump("### XUL window: " + xulWindow + "\n");
    let domWindow = xulWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                      .getInterface(Ci.nsIDOMWindowInternal);
dump("domWindow: " + domWindow + "\n");
    delete this.waitingList[aWindowType];
    // spin the event loop to make sure any setTimeout 0 calls have gotten their
    //  time in the sun.
    controller.sleep(0);
    this._firstWindowOpened = true;
    return new controller.MozMillController(domWindow);
  },

  /**
   * Because the modal dialog spins its own event loop, the mozmill idiom of
   *  spinning your own event-loop as performed by waitForEval is no good.  We
   *  use this timer to generate our events so that we can have a waitForEval
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
    this.waitingList[aWindowType] = null;

    this._timerRuntimeSoFar = 0;
    this._timer.initWithCallback(this, WINDOW_OPEN_CHECK_INTERVAL_MS,
                                 Ci.nsITimer.TYPE_REPEATING_SLACK);
  },

  /**
   * This is the nsITimer notification we receive...
   */
  notify: function WindowWatcher_notify() {
dump("Timer check!\n");
    if (this.monitorizeOpen()) {
      // okay, the window is opened, and we should be in its event loop now.
dump("  THIS IS IT!\n");
      let xulWindow = this.waitingList[this.waitingForOpen];
dump(" xul window: " + xulWindow + "\n");
      let domWindow = xulWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                        .getInterface(Ci.nsIDOMWindowInternal);
dump(" dom window: " + domWindow + "\n");
      let troller = new controller.MozMillController(domWindow);
      augment_controller(troller, this.waitingForOpen);

dump(" cleanup!\n");
      delete this.waitingList[this.waitingForOpen];
      this._timer.cancel();
dump("canceled!\n");
      try {
        dump("::: calling\n");
        try {
          let runner = new frame.Runner(collector);
          runner.wrapper(this.subTestFunc, troller);
        }
        catch (ex) {
          dump("problem running: " + ex.fileName + ":" + ex.lineNumber + ": " + ex + "\n");
        }
        dump("::: called\n");
      }
      finally {
        this.subTestFunc = null;
      }
      // now we are waiting for it to close...
      this.waitingForClose = this.waitingForOpen;
      this.waitingForOpen = null;

      // if the test failed, make sure we force the window closed...
      // except I'm not sure how to easily figure that out...
      // so just close it no matter what.
      troller.window.close();
    }
    // notify is only used for modal dialogs, which are never the first window,
    //  so we can always just use this set of timeouts/intervals.
    this._timerRuntimeSoFar += WINDOW_OPEN_CHECK_INTERVAL_MS;
    if (this._timerRuntimeSoFar >= WINDOW_OPEN_TIMEOUT_MS) {
      dump("!!! TIMEOUT WHILE WAITING FOR MODAL DIALOG !!!\n");
      this._timer.cancel();
      throw new Error("Timeout while waiting for modal dialog.\n");
    }
  },

  /**
   * Symmetry for planForModalDialog; conceptually provides the waiting.  In
   *  reality, all we do is potentially soak up the event loop a little to
   */
  waitForModalDialog: function WindowWatcher_waitForModalDialog(aWindowType) {
    // did the window already come and go?
    if (this.subTestFunc == null)
      return;
    // spin the event loop until we the window has come and gone.
    controller.waitForEval(
      'subject.waitingForOpen == null && subject.waitingForClose == null',
      WINDOW_OPEN_TIMEOUT_MS, WINDOW_OPEN_CHECK_INTERVAL_MS, this);
    this.waitingForClose = null;
  },

  planForWindowClose: function WindowWatcher_planForWindowClose(aXULWindow) {
    let windowType =
      aXULWindow.document.documentElement.getAttribute("windowtype");
    this.waitingList[windowType] = aXULWindow;
    this.waitingForClose = windowType;
  },

  /**
   * The current windowType we are waiting to close.  Same deal as
   *  waitingForOpen, this makes the eval less crazy.
   */
  waitingForClose: null,
  waitForWindowClose: function WindowWatcher_waitForWindowClose() {
    controller.waitForEval('subject.monitorizeClose()',
                           WINDOW_CLOSE_TIMEOUT_MS,
                           WINDOW_CLOSE_CHECK_INTERVAL_MS, this);
    let didDisappear = this.waitingList[this.waitingForClose] == null;
    delete this.waitingList[windowType];
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

    return this.waitingList[this.waitingForOpen] != null;
  },

  /**
   * Used by waitForWindowClose to check if the window we are waiting to close
   *  actually closed yet.
   *
   * @return true if it closed.
   */
  monitorizeClose: function () {
    return this.waitingList[this.waitingForClose] == null;
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
dump("### considering: " + aXULWindow + "\n");
    let docshell = aXULWindow.docShell;
    // we need the docshell to exist...
    if (!docshell)
      return false;
dump("### has docshell\n");
    // we can't know if it's the right document until it's not busy
    if (docshell.busyFlags)
      return false;
dump("### not busy\n");
    // it also needs to have content loaded (it starts out not busy with no
    //  content viewer.)
    if (docshell.contentViewer == null)
      return false;
dump("### has contentViewer\n");
    // now we're cooking! let's get the document...
    let outerDoc = docshell.contentViewer.DOMDocument;
    // and make sure it's not blank.  that's also an intermediate state.
    if (outerDoc.location.href == "about:blank")
      return false;
dump("has href: " + outerDoc.location.href + "\n");
    // finally, we can now have a windowtype!
    let windowType = outerDoc.documentElement.getAttribute("windowtype");
dump("has windowtype: " + windowType + "\n");
dump("this: " + this + "\n");
dump("waitingList: " + this.waitingList + "\n");
    // stash the window if we were watching for it
    if (windowType in this.waitingList) {
      dump("It's there! setting...\n");
      this.waitingList[windowType] = aXULWindow;
    }
    else {
      dump("Not there! :( SCREWED\n");
    }

    return true;
  },

  /**
   * Closing windows have the advantage of having to already have been loaded,
   *  so things like their windowtype are immediately available.
   */
  onCloseWindow: function WindowWatcher_onCloseWindow(aXULWindow) {
    dump("!!! CLOSE EVENT: " + aXULWindow + "\n");
    let domWindow = aXULWindow.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                       .getInterface(Ci.nsIDOMWindowInternal);
    let windowType =
      domWindow.document.documentElement.getAttribute("windowtype");
    // XXX because of how we dance with things, equivalence is not gonna
    //  happen for us.  This is most pragmatic.
    if (this.waitingList[windowType] !== null)
      this.waitingList[windowType] = null;
    dump("close end proc\n");
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
  return augment_controller(WindowWatcher.waitForWindowOpen(aWindowType),
                            aWindowType);
}

/**
 * Plan for the imminent display of a modal dialog.  Modal dialogs spin their
 *  own event loop which means that either that control flow will not return
 *  to the caller until the modal dialog finishes running.  This means that
 *  you need to provide a sub-test function to be run inside the modal dialog
 *  (and it should not start with "test" or mozmill will also try and run it.)
 *
 * @param aWindowType The window type that you expect the modal dialog to have.
 * @param aSubTestFunction The sub-test function that will be run once the modal
 *     dialog appears and is loaded.  This function should take one argument,
 *     a MozmillController against the modal dialog.
 */
function plan_for_modal_dialog(aWindowType, aSubTestFunction) {
  WindowWatcher.ensureInited();
  WindowWatcher.planForModalDialog(aWindowType, aSubTestFunction);
}
function wait_for_modal_dialog(aWindowType) {
  WindowWatcher.waitForModalDialog(aWindowType);
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
  WindowWatcher.ensureInited();
  WindowWatcher.planForWindowClose(aController.window);
}

/**
 * Wait for the closure of the window you noted you would listen for its close
 *  in plan_for_window_close.
 */
function wait_for_window_close() {
  WindowWatcher.waitForWindowClose();
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
          let elems = Array.slice.call(
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
     *  a("threadTree", {tagName: treechildren})
     *
     * @return the anonymous element determined by the query found in the
     *  anonymous sub-tree of the element with the given id.
     */
    a: function _get_anon_element_by_id_and_query(aId, aQuery) {
      let realElem = this.window.document.getElementById(aId);
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
          let named = node.getElementsByTagName(aQuery.tagName);
          if (named.length)
            return named[0];
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
  },
};

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
        return this.threadTree.view.QueryInterface(Ci.nsIMsgDBView);
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
    }
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
    globalsToExposeAtStartup: {
      folderDisplay: "gFolderDisplay",
    }
  }
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

  if (aAugmentDef.onAugment) {
    aAugmentDef.onAugment(aController);
  }
}

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
  return aController;
}