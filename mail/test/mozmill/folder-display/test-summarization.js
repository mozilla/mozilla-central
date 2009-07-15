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

/**
 * Test that summarization happens at the right time, that it clears itself at
 *  the right time, that it waits for selection stability when recently
 *  summarized, and that summarization does not break under tabbing.
 *
 * Because most of the legwork is done automatically by
 *  test-folder-display-helpers, the more basic tests may look like general
 *  selection / tabbing tests, but are intended to specifically exercise the
 *  summarization logic and edge cases.  (Although general selection tests and
 *  tab tests may do the same thing too...)
 *
 * Things we don't test but should:
 * - The difference between thread summary and multi-message summary.
 */

var MODULE_NAME = 'test-summarization';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers'];

var folder;
var thread1, thread2, msg1, msg2;

var setupModule = function(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  folder = create_folder("SummarizationA");
  thread1 = create_thread(10);
  msg1 = create_thread(1);
  thread2 = create_thread(10);
  msg2 = create_thread(1);
  add_sets_to_folders([folder], [thread1, msg1, thread2, msg2]);
};

function test_basic_summarization() {
  be_in_folder(folder);

  // - make sure we get a summary
  select_click_row(0);
  select_shift_click_row(5);
  // this will verify a multi-message display is happening
  assert_selected_and_displayed([0, 5]);
}

function test_summarization_goes_away() {
  select_none();
  assert_nothing_selected();
}

/**
 * Verify that we update summarization when switching amongst tabs.
 */
function test_folder_tabs_update_correctly() {
  // tab with summary
  let tabA = be_in_folder(folder);
  select_click_row(0);
  select_control_click_row(2);
  assert_selected_and_displayed(0, 2);

  // tab with nothing
  let tabB = open_folder_in_new_tab(folder);
  assert_nothing_selected();

  // correct changes, none <=> summary
  switch_tab(tabA);
  assert_selected_and_displayed(0, 2);
  switch_tab(tabB);
  assert_nothing_selected();

  // correct changes, one <=> summary
  select_click_row(0);
  assert_selected_and_displayed(0);
  switch_tab(tabA);
  assert_selected_and_displayed(0, 2);
  switch_tab(tabB);
  assert_selected_and_displayed(0);

  // correct changes, summary <=> summary
  select_shift_click_row(3);
  assert_selected_and_displayed([0, 3]);
  switch_tab(tabA);
  assert_selected_and_displayed(0, 2);
  switch_tab(tabB);
  assert_selected_and_displayed([0, 3]);

  // closing tab returns state correctly...
  close_tab(tabB);
  assert_selected_and_displayed(0, 2);
}

function test_message_tabs_update_correctly() {
  let tabFolder = be_in_folder(folder);
  let message = select_click_row(0);
  assert_selected_and_displayed(0);

  let tabMessage = open_selected_message_in_new_tab();
  assert_selected_and_displayed(message);

  switch_tab(tabFolder);
  select_shift_click_row(2);
  assert_selected_and_displayed([0, 2]);

  switch_tab(tabMessage);
  assert_selected_and_displayed(message);

  switch_tab(tabFolder);
  assert_selected_and_displayed([0, 2]);

  close_tab(tabMessage);
}

/**
 * Test the stabilization logic by making the stabilization interval absurd and
 *  then manually clearing things up.
 */
function test_selection_stabilization_logic() {
  // make sure all summarization has run to completion.
  mc.sleep(0);
  // make it inconceivable that the timeout happens.
  mc.window.MessageDisplayWidget.prototype
    .SUMMARIZATION_SELECTION_STABILITY_INTERVAL_MS = 10000;
  // does not summarize anything, does not affect timer
  select_click_row(0);
  // does summarize things.  timer will be tick tick ticking!
  select_shift_click_row(1);
  // verify that things were summarized...
  assert_selected_and_displayed([0, 1]);
  // save the set of messages so we can verify the summary sticks to this.
  let messages = mc.folderDisplay.selectedMessages;

  // make sure the

  // this will not summarize!
  select_shift_click_row(2);
  // verify that our summary is still just 0 and 1.
  assert_messages_summarized(mc, messages);

  // - put it back, the way it was
  // oh put it back the way it was
  // ...
  // That's right folks, a 'Lil Abner reference.
  // ...
  // Culture!
  // ...
  // I'm already embarassed I wrote that.
  mc.window.MessageDisplayWidget.prototype
    .SUMMARIZATION_SELECTION_STABILITY_INTERVAL_MS = 0;
  // (we did that because the stability logic is going to schedule another guard
  //  timer when we manually trigger it, and we want that to clear immediately.)

  // - pretend the timer fired.
  // we need to de-schedule the timer, but do not need to clear the variable
  //  because it will just get overwritten anyways
  mc.window.clearTimeout(mc.messageDisplay._summaryStabilityTimeout);
  mc.messageDisplay._showSummary(true);

  // - the summary should now be up-to-date
  assert_selected_and_displayed([0, 2]);
}


function test_summarization_thread_detection() {
  select_none();
  assert_nothing_selected();
  make_display_threaded();
  select_click_row(0);
  select_shift_click_row(9);
  let messages = mc.folderDisplay.selectedMessages;
  toggle_thread_row(0);
  assert_messages_summarized(mc, messages);
  // count the number of messages represented
  assert_summary_contains_N_divs('wrappedsender', 10);
  select_shift_click_row(1);
  // this should have shifted to the multi-message view
  assert_summary_contains_N_divs('wrappedsender', 0);
  assert_summary_contains_N_divs('wrappedsubject', 2);
  select_none();
  assert_nothing_selected();
  select_click_row(1); // select a single message
  select_shift_click_row(2); // add a thread
  assert_summary_contains_N_divs('wrappedsender', 0);
  assert_summary_contains_N_divs('wrappedsubject', 2);
}

/**
 * If you are looking at a message that becomes part of a thread because of the
 *  arrival of a new message, expand the thread so you do not have the message
 *  turn into a summary beneath your feet.
 *
 * There are really two cases here:
 * - The thread gets moved because its sorted position changes.
 * - The thread does not move.
 */
function test_new_thread_that_was_not_summarized_expands() {
  be_in_folder(folder);
  make_display_threaded();

  // - create the base messages
  let [willMoveMsg, willNotMoveMsg] = make_new_sets_in_folders(
    [folder], [{count: 1}, {count: 1}]);

  // - do the non-move case
  // XXX actually, this still gets treated as a move. I don't know why...
  // select it
  select_click_row(willNotMoveMsg);
  assert_selected_and_displayed(willNotMoveMsg);

  // give it a friend...
  let [extraNonMoveMsg] = make_new_sets_in_folders(
    [folder], [{count: 1, inReplyTo: willNotMoveMsg}]);
  assert_expanded(willNotMoveMsg);
  assert_selected_and_displayed(willNotMoveMsg);

  // - do the move case
  select_click_row(willMoveMsg);
  assert_selected_and_displayed(willMoveMsg);

  // give it a friend...
  let [extraMoveMsg] = make_new_sets_in_folders(
    [folder], [{count: 1, inReplyTo: willMoveMsg}]);
  assert_expanded(willMoveMsg);
  assert_selected_and_displayed(willMoveMsg);
}

/**
 * Selecting an existing (and collapsed) thread, then add a message and make
 *  sure the summary updates.
 */
function test_summary_updates_when_new_message_added_to_collapsed_thread() {
  be_in_folder(folder);
  make_display_threaded();
  collapse_all_threads();

  // - select the thread root, thereby summarizing it
  let thread1Root = select_click_row(thread1); // this just uses the root msg
  assert_collapsed(thread1Root);
  // just the thread root should be selected
  assert_selected(thread1Root);
  // but the whole thread should be summarized
  assert_messages_summarized(mc, thread1);

  // - add a new message, make sure it's in the summary now.
  let [thread1Extra] = make_new_sets_in_folders(
                         [folder], [{count: 1, inReplyTo: thread1}]);
  let thread1All = thread1.union(thread1Extra);
  assert_selected(thread1Root);
  assert_messages_summarized(mc, thread1All);
}
