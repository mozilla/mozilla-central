/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Test that "watch thread" and "ignore thread" works correctly.
 */

// make SOLO_TEST=folder-display/test-watch-ignore-thread.js mozmill-one

const MODULE_NAME = "test-watch-ignore-thread";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers"];

var folder;
var thread1, thread2, thread3;

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);

  folder = create_folder("WatchIgnoreThreadTest");
  thread1 = create_thread(3);
  thread2 = create_thread(4);
  thread3 = create_thread(5);
  add_sets_to_folders([folder], [thread1, thread2, thread3]);

  be_in_folder(folder);
  make_display_threaded();
  expand_all_threads();
}

/**
 * Click one of the menu items in the appmenu View | Messages menu.
 * @param aMenuId the id of the menu item to click.
 */
function clickViewMessagesItem(aMenuId) {
  mc.click_menus_in_sequence(mc.e("appmenu-popup"),
    [
      {id: "appmenu_View"},
      {id: "appmenu_viewMessagesMenu"},
      {id: aMenuId}
    ]
  );
}

/**
 * Test that Ignore Thread works as expected.
 */
function test_ignore_thread() {
  let t1root = thread1.getMsgHdr(0);

  let t1second = select_click_row(1);
  assert_selected_and_displayed(t1second);

  // Ignore this thread.
  mc.keypress(null, "K", {shiftKey: false, accelKey: false});

  // The first msg in the next thread should now be selected.
  let t2root = thread2.getMsgHdr(0);
  assert_selected_and_displayed(t2root);

  // The ignored thread should still be visible (with an ignored icon).
  assert_visible(thread1.msgHdrList);

  // Go to another folde then back. Ignored messages should now be hidden.
  be_in_folder(inboxFolder);
  be_in_folder(folder);
  select_click_row(0);
  assert_selected_and_displayed(t2root);
}

/**
 * Test that ignored threads are shown when the View | Threads |
 * Ignored Threads option is checked.
 */
function test_view_threads_ignored_threads() {
  let t1root = thread1.getMsgHdr(0);
  let t2root = thread2.getMsgHdr(0);

  // Check "Ignored Threads" - the ignored messages should appear =>
  // the first row is the first message of the first thread.
  clickViewMessagesItem("appmenu_viewIgnoredThreadsMenuItem");
  select_click_row(0);
  assert_selected_and_displayed(t1root);

  // Uncheck "Ignored Threads" - the ignored messages should get hidden.
  clickViewMessagesItem("appmenu_viewIgnoredThreadsMenuItem");
  select_click_row(0);
  assert_selected_and_displayed(t2root);
  assert_not_shown(thread1.msgHdrList);
}

/**
 * Test that Watch Thread makes the thread watched.
 */
function test_watch_thread() {
  let t2root = thread2.getMsgHdr(0);
  let t2second = select_click_row(1);
  let t3root = thread3.getMsgHdr(0);
  assert_selected_and_displayed(t2second);

  // Watch this thread.
  mc.keypress(null, "W", {shiftKey: false, accelKey: false});

  // Choose "Watched Threads with Unread".
  clickViewMessagesItem("appmenu_viewWatchedThreadsWithUnreadMenuItem");
  select_click_row(1);
  assert_selected_and_displayed(t2second);
  assert_not_shown(thread1.msgHdrList);
  assert_not_shown(thread3.msgHdrList);

  // Choose "All Messages" again.
  clickViewMessagesItem("appmenu_viewAllMessagesMenuItem");
  assert_not_shown(thread1.msgHdrList); // still ignored (and now shown)
  select_click_row(thread2.msgHdrList.length);
  assert_selected_and_displayed(t3root);
}




