/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = 'test-toolbar-buttons';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = ['folder-display-helpers']

Components.utils.import("resource:///modules/imServices.jsm");

function setupModule(module) {
  collector.getModule('folder-display-helpers').installInto(module);
}

/* This test checks that the toolbar buttons of the chat toolbar are
 * correctly disabled/enabled, and that the placeholder displayed in
 * the middle of the chat tab is correct.
 */
function test_toolbar_and_placeholder() {
  assert_not_equals(mc.tabmail.selectedTab.mode.type, "chat",
                    "the chat tab shouldn't be selected at startup");
  mc.click(mc.eid("button-chat"));
  assert_equals(mc.tabmail.selectedTab.mode.type, "chat",
                "the chat tab should be selected");

  // Check that "No connected account" placeholder is correct.
  assert_equals(mc.e("conversationsDeck").selectedPanel.id, "noConvScreen",
                "'Your chat accounts are not connected.' placeholder");
  assert_true(mc.e("noConvInnerBox").hidden,
              "the 'No conversation' placeholder is hidden");
  assert_true(mc.e("noAccountInnerBox").hidden,
              "the 'No account' placeholder is hidden");
  assert_false(mc.e("noConnectedAccountInnerBox").hidden,
               "the 'No connected account' placeholder is visible");
  let chatHandler = mc.window.chatHandler;
  assert_equals(chatHandler._placeHolderButtonId, "openIMAccountManagerButton",
                "the correct placeholder button is visible");
  assert_equals(mc.window.document.activeElement.id, chatHandler._placeHolderButtonId,
                "the placeholder button is focused");

  // check that add contact and join chat are disabled
  assert_true(mc.e("button-add-buddy").disabled,
              "the Add Buddy button is disabled");
  assert_true(mc.e("button-join-chat").disabled,
              "the Join Chat button is disabled");

  // The next tests require an account, get the unwrapped default IRC account.
  let account = Services.accounts.getAccountByNumericId(1);
  assert_equals(account.protocol.id, "prpl-irc",
                "the default IM account is an IRC account");
  let ircAccount = account.prplAccount.wrappedJSObject;

  // Pretend the account is connected and check how the UI reacts
  ircAccount.reportConnected();

  // check that add contact and join chat are no longer disabled
  assert_false(mc.e("button-add-buddy").disabled,
               "the Add Buddy button is not disabled");
  assert_false(mc.e("button-join-chat").disabled,
               "the Join Chat button is not disabled");

  // Check that the "No conversations" placeholder is correct.
  assert_false(mc.e("noConvInnerBox").hidden,
               "the 'No conversation' placeholder is visible");
  assert_true(mc.e("noAccountInnerBox").hidden,
              "the 'No account' placeholder is hidden");
  assert_true(mc.e("noConnectedAccountInnerBox").hidden,
              "the 'No connected account' placeholder is hidden");
  assert_false(chatHandler._placeHolderButtonId,
               "no placeholder button");

  // Now check that the UI reacts to account disconnections too.
  ircAccount.reportDisconnected();

  // check that add contact and join chat are disabled again.
  assert_true(mc.e("button-add-buddy").disabled,
              "the Add Buddy button is disabled");
  assert_true(mc.e("button-join-chat").disabled,
              "the Join Chat button is disabled");

  // Check that the "No connected account" placeholder is back.
  assert_true(mc.e("noConvInnerBox").hidden,
              "the 'No conversation' placeholder is hidden");
  assert_true(mc.e("noAccountInnerBox").hidden,
              "the 'No account' placeholder is hidden");
  assert_false(mc.e("noConnectedAccountInnerBox").hidden,
               "the 'No connected account' placeholder is visible");
  assert_equals(chatHandler._placeHolderButtonId, "openIMAccountManagerButton",
                "the correct placeholder button is visible");
}
