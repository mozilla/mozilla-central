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
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Wei Xian Woo <wei0@gmx.com>
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

/*
 * Session Storage Tests. Session Restoration Tests are currently implemented in
 * folder-display/test-message-pane-visibility.js.
 */

var MODULE_NAME = "test-session-store";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var controller = {};
Cu.import("resource://mozmill/modules/controller.js", controller);
var jumlib = {};
Cu.import("resource://mozmill/modules/jum.js", jumlib);

Cu.import("resource:///modules/IOUtils.js");
Cu.import("resource:///modules/sessionStoreManager.js");

// the windowHelper module
var windowHelper;

var folderA, folderB;

/* ........ Helper Functions ................*/

/**
 * Reads the contents of the session file into a JSON object.
 */
function readFile() {
  try {
    let data = IOUtils.loadFileToString(sessionStoreManager.sessionFile);
    if (data)
      return JSON.parse(data);
  }
  catch (ex) {
    // fall through and return null if the session file cannot be read
    // or is bad
  }

  return null;
}

function waitForFileRefresh() {
  controller.sleep(sessionStoreManager._sessionAutoSaveTimerIntervalMS);
  jumlib.assert(sessionStoreManager.sessionFile.exists(),
                "file should exist");
}

function open3PaneWindow(windowWatcher) {
  windowHelper.plan_for_new_window("mail:3pane");
  windowWatcher.openWindow(null,
                           "chrome://messenger/content/messenger.xul", "",
                           "all,chrome,dialog=no,status,toolbar",
                           null);
  return windowHelper.wait_for_new_window("mail:3pane");
}

function openAddressBook(windowWatcher) {
  windowHelper.plan_for_new_window("mail:addressbook");
  windowWatcher.openWindow(
                      null,
                      "chrome://messenger/content/addressbook/addressbook.xul", "",
                      "all,chrome,dialog=no,status,toolbar",
                      null);
  return windowHelper.wait_for_new_window("mail:addressbook");
}

/* :::::::: The Tests ::::::::::::::: */

function setupModule(module) {
  let folderDisplayHelper = collector.getModule('folder-display-helpers');
  folderDisplayHelper.installInto(module);
  windowHelper = collector.getModule('window-helpers');
  windowHelper.installInto(module);

  folderA = create_folder("SessionStoreA");
  make_new_sets_in_folder(folderA, [{count: 3}]);

  folderB = create_folder("SessionStoreB");
  make_new_sets_in_folder(folderB, [{count: 3}]);

  // clobber the default interval used by the session autosave timer so the
  // unit tests end up being as close to instantaneous as possible
  sessionStoreManager._sessionAutoSaveTimerIntervalMS = 10;

  sessionStoreManager.stopPeriodicSave();
}

function teardownTest(test) {
  sessionStoreManager.stopPeriodicSave();
}

function teardownModule(module) {
  // reset the interval used by the session autosave timer to the default
  // value
  sessionStoreManager._sessionAutoSaveTimerIntervalMS =
                              sessionStoreManager.SESSION_AUTO_SAVE_DEFAULT_MS;
}

function test_periodic_session_persistence_simple() {
  // delete the session file if it exists
  let sessionFile = sessionStoreManager.sessionFile;
  if (sessionFile.exists())
    sessionFile.remove(false);

  jumlib.assert(!sessionFile.exists(), "file should not exist");

  // change some state to guarantee the file will be recreated
  // if periodic session persistence works
  be_in_folder(folderA);

  // if periodic session persistence is working, the file should be
  // re-created
  sessionStoreManager.startPeriodicSave();
  waitForFileRefresh();
}

function test_periodic_nondirty_session_persistence() {
  be_in_folder(folderB);

  sessionStoreManager.startPeriodicSave();
  waitForFileRefresh();

  // delete the session file
  let sessionFile = sessionStoreManager.sessionFile;
  sessionFile.remove(false);

  // since we didn't change the state of the session, the session file
  // should not be re-created
  controller.sleep(sessionStoreManager._sessionAutoSaveTimerIntervalMS);
  jumlib.assert(!sessionFile.exists(), "file should not exist");
}

function test_single_3pane_periodic_session_persistence() {
  be_in_folder(folderA);

  // get the state object. this assumes there is one and only one
  // 3pane window.
  let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                       getService(Ci.nsIWindowMediator);
  let mail3PaneWindow = windowMediator.getMostRecentWindow("mail:3pane");
  let state = mail3PaneWindow.getWindowStateForSessionPersistence();

  sessionStoreManager.startPeriodicSave();
  waitForFileRefresh();

  // load the saved state from disk
  let loadedState = readFile();
  jumlib.assert(loadedState, "previously saved state should be non-null");

  // get the state object for the one and only one 3pane window
  let windowState = loadedState.windows[0];
  jumlib.assert(JSON.stringify(windowState) == JSON.stringify(state),
                "saved state and loaded state should be equal");
}

function test_multiple_3pane_periodic_session_persistence() {
  // open a few more 3pane windows
  let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                      getService(Ci.nsIWindowWatcher);
  for (var i = 0; i < 3; ++i)
    open3PaneWindow(windowWatcher);

  // then get the state objects for each window
  let state = [];
  let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                       getService(Ci.nsIWindowMediator);
  let enumerator = windowMediator.getEnumerator("mail:3pane");
  while (enumerator.hasMoreElements())
    state.push(enumerator.getNext().getWindowStateForSessionPersistence());

  sessionStoreManager.startPeriodicSave();
  waitForFileRefresh();
  sessionStoreManager.stopPeriodicSave();

  // load the saved state from disk
  let loadedState = readFile();
  jumlib.assert(loadedState, "previously saved state should be non-null");

  jumlib.assert(loadedState.windows.length == state.length,
          "number of windows in saved state and loaded state should be equal");

  for (var i = 0; i < state.length; ++i)
    jumlib.assert(
            JSON.stringify(loadedState.windows[i]) == JSON.stringify(state[i]),
            "saved state and loaded state should be equal");

  // close all but one 3pane window
  enumerator = windowMediator.getEnumerator("mail:3pane");
  while (enumerator.hasMoreElements()) {
    let window = enumerator.getNext();
    if (enumerator.hasMoreElements())
      window.close();
  }
}

function test_bad_session_file_simple() {
  // forcefully write a bad session file
  let data = "BAD SESSION FILE";
  let foStream = Cc["@mozilla.org/network/file-output-stream;1"].
                 createInstance(Ci.nsIFileOutputStream);
  foStream.init(sessionStoreManager.sessionFile, -1, -1, 0);
  foStream.write(data, data.length);
  foStream.close();

  // tell the session store manager to try loading the bad session file.
  // NOTE: periodic session persistence is not enabled in this test
  sessionStoreManager._loadSessionFile();

  // since the session file is bad, the session store manager's state field
  // should be null
  jumlib.assert(!sessionStoreManager._initialState,
                "saved state is bad so state object should be null");

  // the bad session file should have also been deleted
  jumlib.assert(!sessionStoreManager.sessionFile.exists(),
                "file should not exist");
}

function test_clean_shutdown_session_persistence_simple() {
  // open a few more 3pane windows
  let windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].
                      getService(Ci.nsIWindowWatcher);
  for (var i = 0; i < 3; ++i)
    open3PaneWindow(windowWatcher);

  // make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook(windowWatcher);

  // close all the 3pane windows
  let lastWindowState = null;
  let windowMediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                       getService(Ci.nsIWindowMediator);
  enumerator = windowMediator.getEnumerator("mail:3pane");
  while (enumerator.hasMoreElements()) {
    let window = enumerator.getNext();
    if (!enumerator.hasMoreElements())
      lastWindowState = window.getWindowStateForSessionPersistence();

    window.close();
  }

  // load the saved state from disk
  let loadedState = readFile();
  jumlib.assert(loadedState, "previously saved state should be non-null");

  jumlib.assert(1 == loadedState.windows.length,
          "only the state of the last 3pane window should have been saved");

  // get the state object for the one and only one 3pane window
  let windowState = loadedState.windows[0];
  jumlib.assert(JSON.stringify(windowState) == JSON.stringify(lastWindowState),
                "saved state and loaded state should be equal");

  // XXX we force the session store manager to think it's not initialized
  // so that it'll load the session file and restore the state of the last
  // open window 3pane window.
  sessionStoreManager._initialized = false;

  open3PaneWindow(windowWatcher);

  // we don't need the search window any more
  plan_for_window_close(abwc);
  abwc.window.close();
  wait_for_window_close();
}

// XXX todo
// - crash test: not sure if this test should be here. restoring a crashed
//               session depends on periodically saved session data (there is
//               already a test for this). session restoration tests do not
//               belong here. see test-message-pane-visibility.
//               when testing restoration in test-message-pane-visibility, also
//               include test of bad session file.
//...............maybe we should move all session restoration related tests
//...............here.
