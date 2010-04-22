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
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

var MODULE_NAME = 'quick-filter-bar-helper';

const RELATIVE_ROOT = '../shared-modules';

var MODULE_REQUIRES = ['folder-display-helpers'];

var initialized = false;
function setupModule(module) {
  if (initialized)
    return;

  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);

  initialized = true;
}

var EXPORT = [
  'assert_quick_filter_button_visible',
  'assert_quick_filter_bar_visible',
  'toggle_quick_filter_bar',
  'assert_constraints_expressed',
  'toggle_boolean_constraints',
  'toggle_tag_constraints',
  'assert_tag_constraints_visible',
  'assert_tag_constraints_checked',
  'toggle_text_constraints',
  'assert_text_constraints_checked',
  'set_filter_text',
  'assert_filter_text',
  'assert_results_label_count',
  'clear_constraints',
];

var backstage = this;

function installInto(module) {
  setupModule(backstage);
  for each (let [, name] in Iterator(EXPORT)) {
    module[name] = backstage[name];
  }
  // disable the deferred search processing!
  mc.window.QuickFilterBarMuxer.deferredUpdateSearch =
    mc.window.QuickFilterBarMuxer.updateSearch;

  module.__teardownTest__ = _afterEveryTest;
  _afterEveryTest.__name__ = "teardownTest";
}

function _afterEveryTest() {
  clear_constraints();
  // make it visible if it's not
  if (mc.e("quick-filter-bar").collapsed) {
    toggle_quick_filter_bar();
  }
}

/**
 * Maps names to bar DOM ids to simplify checking.
 */
const nameToBarDomId = {
  sticky: "qfb-sticky",
  unread: "qfb-unread",
  starred: "qfb-starred",
  addrbook: "qfb-inaddrbook",
  tags: "qfb-tags",
  attachments: "qfb-attachment",
};

function assert_quick_filter_button_visible(aVisible) {
  if (mc.e("qfb-show-filter-bar").style.visibility !=
      (aVisible ? "visible" : "hidden")) {
    throw new Error("Quick filter bar button should be " +
                    (aVisible ? "visible" : "collapsed"));
  }
}

function assert_quick_filter_bar_visible(aVisible) {
  if (mc.e("quick-filter-bar").collapsed != !aVisible) {
    throw new Error("Quick filter bar should be " +
                    (aVisible ? "visible" : "collapsed"));
  }
}

/**
 * Toggle the state of the message filter bar as if by a mouse click.
 */
function toggle_quick_filter_bar() {
  mc.click(mc.eid("qfb-show-filter-bar"));
  wait_for_all_messages_to_load();
}

/**
 * Assert that the state of the constraints visually expressed by the bar is
 * consistent with the passed-in constraints.  This method does not verify
 * that the search constraints are in effect.  Check that elsewhere.
 */
function assert_constraints_expressed(aConstraints) {
  for each (let [name, domId] in Iterator(nameToBarDomId)) {
    let expectedValue = (name in aConstraints) ? aConstraints[name] : false;
    let domNode = mc.e(domId);
    if (domNode.checked !== expectedValue) {
      throw new Error(name + "'s checked state should be " + expectedValue);
    }
  }
}

/**
 * Toggle the given filter buttons by name (from nameToBarDomId); variable
 * argument magic enabled.
 */
function toggle_boolean_constraints() {
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    mc.click(mc.eid(nameToBarDomId[arguments[iArg]]));
  }
  wait_for_all_messages_to_load(mc);
}

/**
 * Toggle the tag faceting buttons by tag key.  Wait for messages after.
 */
function toggle_tag_constraints() {
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    mc.click(mc.eid("qfb-tag-" + arguments[iArg]));
  }
  wait_for_all_messages_to_load(mc);
}

/**
 * Verify that tag buttons exist for exactly the given set of tag keys in the
 *  provided variable argument list.  Ordering is significant.
 */
function assert_tag_constraints_visible() {
  // the stupid bar should be visible if any arguments are specified
  if (arguments.length && mc.e("quick-filter-bar-tab-bar").collapsed)
    throw new Error("The tag bar should not be collapsed!");

  let kids = mc.e("quick-filter-bar-tab-bar").childNodes;
  // this is bad error reporting in here for now.
  if (kids.length != arguments.length)
    throw new Error("Mismatch in expected tag count and actual. " +
                    "Expected " + arguments.length +
                    " actual " + kids.length);
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let nodeId = "qfb-tag-" + arguments[iArg];
    if (nodeId != kids[iArg].id)
      throw new Error("Mismatch at tag " + iArg + " expected " + nodeId +
                      " but got " + kids[iArg].id);
  }
}

/**
 * Verify that only the buttons corresponding to the provided tag keys are
 * checked.
 */
function assert_tag_constraints_checked() {
  let expected = {};
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let nodeId = "qfb-tag-" + arguments[iArg];
    expected[nodeId] = true;
  }

  let kids = mc.e("quick-filter-bar-tab-bar").childNodes;
  for (let iNode = 0; iNode < kids.length; iNode++) {
    let node = kids[iNode];
    if (node.checked != (node.id in expected))
      throw new Error("node " + node.id + " should " +
                      ((node.id in expected) ? "be " : "not be ") + "checked.");
  }
}

const nameToTextDomId = {
  sender: "qfb-qs-sender",
  recipients: "qfb-qs-recipients",
  subject: "qfb-qs-subject",
  body: "qfb-qs-body",
};

function toggle_text_constraints() {
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    mc.click(mc.eid(nameToTextDomId[arguments[iArg]]));
  }
  wait_for_all_messages_to_load(mc);
}

/**
 * Assert that the text constraint buttons are checked.  Variable-argument
 *  support where the arguments are one of sender/recipients/subject/body.
 */
function assert_text_constraints_checked() {
  let expected = {};
  for (let iArg = 0; iArg < arguments.length; iArg++) {
    let nodeId = nameToTextDomId[arguments[iArg]];
    expected[nodeId] = true;
  }

  let kids = mc.e("quick-filter-bar-filter-text-bar").childNodes;
  for (let iNode = 0; iNode < kids.length; iNode++) {
    let node = kids[iNode];
    if (node.tagName == "label")
      continue;
    if (node.checked != (node.id in expected))
      throw new Error("node " + node.id + " should " +
                      ((node.id in expected) ? "be " : "not be ") + "checked.");
  }
}

/**
 * Set the text in the text filter box, trigger it like enter was pressed, then
 *  wait for all messages to load.
 */
function set_filter_text(aText) {
  // We're not testing the reliability of the textbox widget; just poke our text
  // in and trigger the command logic.
  let textbox = mc.e("qfb-qs-textbox");
  textbox.value = aText;
  textbox.doCommand();
  wait_for_all_messages_to_load(mc);
}

function assert_filter_text(aText) {
  let textbox = mc.e("qfb-qs-textbox");
  if (textbox.value != aText)
    throw new Error("Expected text filter value of '" + aText + "' but got '" +
                    textbox.value);
}

/**
 * Assert that the results label is telling us there are aCount messages
 *  using the appropriate string.
 */
function assert_results_label_count(aCount) {
  let resultsLabel = mc.e("qfb-results-label");
  if (aCount == 0) {
    if (resultsLabel.value != resultsLabel.getAttribute("noresultsstring"))
      throw new Error("results label should be displaying the no messages case");
  }
  else {
    let s = resultsLabel.value;
    s = s.substring(0, s.indexOf(" "));
    if (parseInt(s) !== aCount)
     throw new Error("Result count is displaying " + s + " but should show " +
                     aCount);
  }
}

/**
 * Clear active constraints via any means necessary; state cleanup for testing,
 *  not to be used as part of a test.  Unlike normal clearing, this will kill
 *  the sticky bit.
 *
 * This is automatically called by the test teardown helper.
 */
function clear_constraints() {
  mc.window.QuickFilterBarMuxer._testHelperResetFilterState();
}
