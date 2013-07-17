/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "dom-helpers";

const RELATIVE_ROOT = "../shared-modules";
// we need this for the main controller
const MODULE_REQUIRES = ["folder-display-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);
var utils = {};
Cu.import('resource://mozmill/modules/utils.js', utils);

const NORMAL_TIMEOUT = 6000;
const FAST_TIMEOUT = 1000;
const FAST_INTERVAL = 100;

var folderDisplayHelper;
var mc;

// logHelper (and therefore folderDisplayHelper) exports
var mark_failure;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  mark_failure = folderDisplayHelper.mark_failure;
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.assert_element_visible = assert_element_visible;
  module.element_visible_recursive = element_visible_recursive;
  module.assert_element_not_visible = assert_element_not_visible;
  module.wait_for_element = wait_for_element;
  module.assert_next_nodes = assert_next_nodes;
  module.assert_previous_nodes = assert_previous_nodes;
  module.wait_for_element_enabled = wait_for_element_enabled;
}

/**
 * This function takes either a string or an elementlibs.Elem, and returns
 * whether it is hidden or not (simply by poking at its hidden property). It
 * doesn't try to do anything smart, like is it not into view, or whatever.
 *
 * @param aElt The element to query.
 * @return Whether the element is visible or not.
 */
function element_visible(aElt) {
  let e;
  if (typeof aElt == "string") {
    e = mc.eid(aElt);
  } else {
    e = aElt;
  }
  return !e.getNode().hidden;
}

/**
 * Assert that en element's visible.
 * @param aElt The element, an ID or an elementlibs.Elem
 * @param aWhy The error message in case of failure
 */
function assert_element_visible(aElt, aWhy) {
  folderDisplayHelper.assert_true(element_visible(aElt), aWhy);
}

/**
 * Returns if a element is visible by traversing all parent elements and check
 * that all are visible.
 *
 * @param aElem The element to be checked
 */
function element_visible_recursive(aElem) {
  if (aElem.hidden || aElem.collapsed)
    return false;
  let parent = aElem.parentNode;
  if (parent == null)
    return true;
  if (("selectedPanel" in parent) &&
      parent.selectedPanel != aElem)
    return false;
  return element_visible_recursive(parent);
}

/**
 * Assert that en element's not visible.
 * @param aElt The element, an ID or an elementlibs.Elem
 * @param aWhy The error message in case of failure
 */
function assert_element_not_visible(aElt, aWhy) {
  folderDisplayHelper.assert_true(!element_visible(aElt), aWhy);
}

/**
 * Wait for and return an element matching a particular CSS selector.
 *
 * @param aParent the node to begin searching from
 * @param aSelector the CSS selector to search with
 */
function wait_for_element(aParent, aSelector) {
  let target = null;
  mc.waitFor(function() {
    target = aParent.querySelector(aSelector);
    return (target != null);
  }, "Timed out waiting for a target for selector: " + aSelector);

  return target;
}

/**
 * Given some starting node aStart, ensure that aStart and the aNum next
 * siblings of aStart are nodes of type aNodeType.
 *
 * @param aNodeType the type of node to look for, example: "br".
 * @param aStart the first node to check.
 * @param aNum the number of sibling br nodes to check for.
 */
function assert_next_nodes(aNodeType, aStart, aNum) {
  let node = aStart;
  for (let i = 0; i < aNum; ++i) {
    node = node.nextSibling;
    if (node.localName != aNodeType)
      throw new Error("The node should be followed by " + aNum + " nodes of " +
                      "type " + aNodeType);
  }
  return node;
}

/**
 * Given some starting node aStart, ensure that aStart and the aNum previous
 * siblings of aStart are nodes of type aNodeType.
 *
 * @param aNodeType the type of node to look for, example: "br".
 * @param aStart the first node to check.
 * @param aNum the number of sibling br nodes to check for.
 */
function assert_previous_nodes(aNodeType, aStart, aNum) {
  let node = aStart;
  for (let i = 0; i < aNum; ++i) {
    node = node.previousSibling;
    if (node.localName != aNodeType)
      throw new Error("The node should be preceded by " + aNum + " nodes of " +
                      "type " + aNodeType);
  }
  return node;
}

/**
 * Given some element, wait for that element to be enabled or disabled,
 * depending on the value of aEnabled.
 *
 * @param aController the controller parent of the element
 * @param aNode the element to check.
 * @param aEnabled whether or not the node should be enabled, or disabled.
 */
function wait_for_element_enabled(aController, aElement, aEnabled) {
  if (!("disabled" in aElement))
    throw new Error("Element does not appear to have disabled property; id=" +
                    aElement.id);

  aController.waitFor(function() aElement.disabled != aEnabled,
                      "Element should have eventually been " +
                      (aEnabled ? "enabled" : "disabled") +
                      "; id=" + aElement.id);
}
