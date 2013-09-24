/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
Cu.import("resource://gre/modules/Services.jsm");

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

function open3PaneWindow() {
  windowHelper.plan_for_new_window("mail:3pane");
  Services.ww.openWindow(null,
                         "chrome://messenger/content/messenger.xul", "",
                         "all,chrome,dialog=no,status,toolbar",
                         null);
  return windowHelper.wait_for_new_window("mail:3pane");
}

function openAddressBook() {
  windowHelper.plan_for_new_window("mail:addressbook");
  Services.ww.openWindow(null,
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
  let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
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

function test_restore_single_3pane_persistence() {
  be_in_folder(folderA);
  toggle_message_pane();
  assert_message_pane_hidden();

  // get the state object. this assumes there is one and only one
  // 3pane window.
  let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");

  // make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook();

  // close the 3pane window
  mail3PaneWindow.close();

  mc = open3PaneWindow();
  be_in_folder(folderA);
  assert_message_pane_hidden();
  // restore message pane.
  toggle_message_pane();

  // We don't need the address book window any more.
  plan_for_window_close(abwc);
  abwc.window.close();
  wait_for_window_close();
}

function test_restore_single_3pane_persistence_again() {
  // test that repeating the save w/o changing the state restores
  // correctly.
  test_restore_single_3pane_persistence();
}

function test_message_pane_height_persistence() {
  be_in_folder(folderA);
  assert_message_pane_visible();
  assert_pane_layout(kClassicMailLayout);

  // Get the state object. This assumes there is one and only one
  // 3pane window.
  let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");

  let oldHeight = mc.e("messagepaneboxwrapper").boxObject.height;
  let minHeight = Math.floor(mc.e("messagepaneboxwrapper").getAttribute("minheight"));
  let newHeight = Math.floor((minHeight + oldHeight) / 2);
  let diffHeight = oldHeight - newHeight;

  assert_not_equals(oldHeight, newHeight,
    "To really perform a test the new message pane height should be " +
    "should be different from the old one but they are the same: " +
    newHeight);

  _move_splitter(mc.e("threadpane-splitter"), 0, diffHeight);

  // Check that the moving of the threadpane-splitter resulted in the correct height.
  let actualHeight = mc.e("messagepaneboxwrapper").boxObject.height;

  assert_equals(newHeight, actualHeight,
    "The message pane height should be " + newHeight + ", but is actually " +
    actualHeight + ". The oldHeight was: " + oldHeight);

  // Make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed.
  let abwc = openAddressBook();

  // The 3pane window is closed.
  mail3PaneWindow.close();

  mc = open3PaneWindow();
  be_in_folder(folderA);
  assert_message_pane_visible();

  let actualHeight = mc.e("messagepaneboxwrapper").boxObject.height;

  assert_equals(newHeight, actualHeight,
    "The message pane height should be " + newHeight + ", but is actually " +
    actualHeight + ". The oldHeight was: " + oldHeight);

  // The old height is restored.
  _move_splitter(mc.e("threadpane-splitter"), 0, -diffHeight);

  // The 3pane window is closed.
  mail3PaneWindow.close();

  mc = open3PaneWindow();
  be_in_folder(folderA);
  assert_message_pane_visible();

  let actualHeight = mc.e("messagepaneboxwrapper").boxObject.height;
  assert_equals(oldHeight, actualHeight,
    "The message pane height should be " + oldHeight + ", but is actually " +
    actualHeight);

  // We don't need the address book window any more.
  plan_for_window_close(abwc);
  abwc.window.close();
  wait_for_window_close();
}

function test_message_pane_width_persistence() {
  be_in_folder(folderA);
  assert_message_pane_visible();

  // At the beginning we are in classic layout.  We will switch to
  // vertical layout to test the width, and then back to classic layout.
  assert_pane_layout(kClassicMailLayout);
  set_pane_layout(kVerticalMailLayout);
  assert_pane_layout(kVerticalMailLayout);

  // Get the state object. This assumes there is one and only one
  // 3pane window.
  let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");

  let oldWidth = mc.e("messagepaneboxwrapper").boxObject.width;
  let minWidth = Math.floor(mc.e("messagepaneboxwrapper").getAttribute("minwidth"));
  let newWidth = Math.floor((minWidth + oldWidth) / 2);
  let diffWidth = oldWidth - newWidth;

  assert_not_equals(newWidth, oldWidth,
    "To really perform a test the new message pane width should be " +
    "should be different from the old one but they are the same: " + newWidth);

  _move_splitter(mc.e("threadpane-splitter"), diffWidth, 0);
  // Check that the moving of the folderpane_splitter resulted in the correct width.
  let actualWidth = mc.e("messagepaneboxwrapper").boxObject.width;

  // FIXME: For whatever reasons the new width is off by one pixel on Mac OSX
  // But this test case is not for testing moving around a splitter but for
  // persistency. Therefore it is enough if the actual width is equal to the
  // the requested width plus/minus one pixel.
  assert_equals_fuzzy(newWidth, actualWidth, 1,
    "The message pane width should be " + newWidth + ", but is actually " +
    actualWidth + ". The oldWidth was: " + oldWidth);
  newWidth = actualWidth;

  // Make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook();

  // The 3pane window is closed.
  mail3PaneWindow.close();

  mc = open3PaneWindow();
  be_in_folder(folderA);
  assert_message_pane_visible();
  assert_pane_layout(kVerticalMailLayout);

  let actualWidth = mc.e("messagepaneboxwrapper").boxObject.width;
  assert_equals(newWidth, actualWidth, "The message pane width should be " +
    newWidth + ", but is actually " + actualWidth);

  // The old width is restored.
  _move_splitter(mc.e("threadpane-splitter"), -diffWidth, 0);
  let actualWidth = mc.e("messagepaneboxwrapper").boxObject.width;

  // FIXME: For whatever reasons the new width is off by two pixels on Mac OSX
  // But this test case is not for testing moving around a splitter but for
  // persistency. Therefore it is enough if the actual width is equal to the
  // the requested width plus/minus two pixels.
  assert_equals_fuzzy(oldWidth, actualWidth, 2,
    "The message pane width should be " + oldWidth + ", but is actually " +
    actualWidth);
  oldWidth = actualWidth;

  // The 3pane window is closed.
  mail3PaneWindow.close();

  mc = open3PaneWindow();
  be_in_folder(folderA);
  assert_message_pane_visible();
  assert_pane_layout(kVerticalMailLayout);

  let actualWidth = mc.e("messagepaneboxwrapper").boxObject.width;
  assert_equals(oldWidth, actualWidth, "The message pane width should be " +
    oldWidth + ", but is actually " + actualWidth);

  // The layout is reset to classical mail layout.
  set_pane_layout(kClassicMailLayout);
  assert_pane_layout(kClassicMailLayout);

  // We don't need the address book window any more.
  plan_for_window_close(abwc);
  abwc.window.close();
  wait_for_window_close();
}

function test_multiple_3pane_periodic_session_persistence() {
  // open a few more 3pane windows
  for (var i = 0; i < 3; ++i)
    open3PaneWindow();

  // then get the state objects for each window
  let state = [];
  let enumerator = Services.wm.getEnumerator("mail:3pane");
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
  enumerator = Services.wm.getEnumerator("mail:3pane");
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
  for (var i = 0; i < 3; ++i) {
    open3PaneWindow();
  }

  // make sure we have a different window open, so that we don't start shutting
  // down just because the last window was closed
  let abwc = openAddressBook();

  // close all the 3pane windows
  let lastWindowState = null;
  enumerator = Services.wm.getEnumerator("mail:3pane");
  while (enumerator.hasMoreElements()) {
    let window = enumerator.getNext();
    if (!enumerator.hasMoreElements())
      lastWindowState = window.getWindowStateForSessionPersistence();

    close_window(new mozmill.controller.MozMillController(window));
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


  open3PaneWindow();

  // We don't need the address book window any more.
  plan_for_window_close(abwc);
  abwc.window.close();
  wait_for_window_close();
}

/*
 * A set of private helper functions for drag'n'drop
 * These functions are inspired by tabmail/test-tabmail-dragndrop.js
 */

function _move_splitter(aSplitter, aDiffX, aDiffY) {

  // catch the splitter in the middle
  EventUtils.synthesizeMouse(aSplitter, 1, 0, {type:"mousedown"}, mc.window);
  EventUtils.synthesizeMouse(aSplitter, aDiffX, aDiffY, {type:"mousemove"},
                             mc.window);
  // release the splitter in the middle
  EventUtils.synthesizeMouse(aSplitter, 0, 0, {type:"mouseup"}, mc.window);

}

/**
 * Helper function that checks the fuzzy equivalence of two numeric
 * values against some given tolerance.
 *
 * @param aLeft one value to check equivalence with
 * @param aRight the other value to check equivalence with
 * @param aTolerance how fuzzy can our equivalence be?
 * @param aMessage the message to give off if we're outside of tolerance.
 */
function assert_equals_fuzzy(aLeft, aRight, aTolerance, aMessage) {
  assert_true(Math.abs(aLeft - aRight) <= aTolerance, aMessage);
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
