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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);

const MODULE_NAME = 'content-tab-helpers';

const RELATIVE_ROOT = '../shared-modules';

// we need this for the main controller
const MODULE_REQUIRES = ['folder-display-helpers'];

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
  module.open_content_tab_with_url = open_content_tab_with_url;
  module.open_content_tab_with_click = open_content_tab_with_click;
  module.plan_for_content_tab_load = plan_for_content_tab_load;
  module.wait_for_content_tab_load = wait_for_content_tab_load;
  module.assert_content_tab_has_url = assert_content_tab_has_url;
  module.assert_content_tab_has_favicon = assert_content_tab_has_favicon;
  module.content_tab_e = content_tab_e;
  module.content_tab_eid = content_tab_eid;
  module.get_content_tab_element_display = get_content_tab_element_display;
  module.assert_content_tab_element_hidden = assert_content_tab_element_hidden;
  module.assert_content_tab_element_visible = assert_content_tab_element_visible;
  module.wait_for_content_tab_element_display_value = wait_for_content_tab_element_display_value;
  module.assert_content_tab_text_present = assert_content_tab_text_present;
  module.assert_content_tab_text_absent = assert_content_tab_text_absent;
}

/**
 * Opens a content tab with the given URL.
 *
 * @param aURL The URL to load (string).
 * @param [aBackground] Whether the tab is opened in the background. Defaults to
 *                      false.
 * @param [aController] The controller to open the tab in. Defaults to |mc|.
 *
 * @returns The newly-opened tab.
 */
function open_content_tab_with_url(aURL, aClickHandler, aBackground, aController) {
  if (aClickHandler === undefined)
    aClickHandler = null;
  if (aBackground === undefined)
    aBackground = false;
  if (aController === undefined)
    aController = mc;

  let preCount = mc.tabmail.tabContainer.childNodes.length;
  let newTab = mc.tabmail.openTab("contentTab", {contentPage: aURL,
                                                 background: aBackground,
                                                 clickHandler: aClickHandler});
  if (!controller.waitForEval("subject.childNodes.length == " + (preCount + 1),
                              FAST_TIMEOUT, FAST_INTERVAL,
                              aController.tabmail.tabContainer))
    mark_failure(["Timeout waiting for the content tab to open with URL:", aURL]);

  // We append new tabs at the end, so check the last one.
  let expectedNewTab = aController.tabmail.tabInfo[preCount];
  folderDisplayHelper.assert_selected_tab(expectedNewTab);
  wait_for_content_tab_load(expectedNewTab);
  return expectedNewTab;
}

/**
 * Opens a content tab with a click on the given element. The tab is expected to
 * be opened in the foreground. The element is expected to be associated with
 * the given controller.
 *
 * @param aElem The element to click.
 * @param [aController] The controller the element is associated with. Defaults
 *                      to |mc|.
 * @returns The newly-opened tab.
 */
function open_content_tab_with_click(aElem, aController) {
  if (aController === undefined)
    aController = mc;

  let preCount = aController.tabmail.tabContainer.childNodes.length;
  aController.click(new elib.Elem(aElem));
  if (!controller.waitForEval("subject.childNodes.length == " + (preCount + 1),
                              FAST_TIMEOUT, FAST_INTERVAL,
                              aController.tabmail.tabContainer))
    mark_failure(["Timeout waiting for the content tab to open"]);

  // We append new tabs at the end, so check the last one.
  let expectedNewTab = aController.tabmail.tabInfo[preCount];
  folderDisplayHelper.assert_selected_tab(expectedNewTab);
  folderDisplayHelper.assert_tab_mode_name(expectedNewTab, "contentTab");
  wait_for_content_tab_load(expectedNewTab);
  return expectedNewTab;
}

/**
 * Call this before triggering a page load that you are going to wait for using
 * |wait_for_content_tab_load|. This ensures that if a page is already displayed
 * in the given tab that state is sufficiently cleaned up so it doesn't trick us
 * into thinking that there is no need to wait.
 *
 * @param [aTab] optional tab, defaulting to the current tab.
 */
function plan_for_content_tab_load(aTab) {
  if (aTab === undefined)
    aTab = mc.tabmail.currentTabInfo;
  aTab.pageLoaded = false;
}

/**
 * Waits for the given content tab to load completely. This is expected to be
 * accompanied by a |plan_for_content_tab_load| right before the action
 * triggering the page load takes place.
 *
 * Note that you cannot call |plan_for_content_tab_load| if you're opening a new
 * tab. That is fine, because pageLoaded is initially false.
 *
 * @param [aTab] optional tab, defaulting to the current tab.
 */
function wait_for_content_tab_load(aTab) {
  if (aTab === undefined)
    aTab = mc.tabmail.currentTabInfo;

  function isLoadedChecker() {
    // Require that the progress listener think that the page is loaded.
    if (!aTab.pageLoaded)
      return false;
    // Also require that our tab infrastructure thinks that the page is loaded.
    if (aTab.busy)
      return false;
    // Finally, require that the tab's browser thinks that no page is being loaded.
    return !(aTab.browser.isLoadingDocument);
  }

  if (!controller.waitForEval("subject()", NORMAL_TIMEOUT, FAST_INTERVAL,
                              isLoadedChecker))
    mark_failure(["Timeout waiting for the content tab page to load."]);
  // the above may return immediately, meaning the event queue might not get a
  //  chance.  give it a chance now.
  mc.sleep(0);
}

/**
 * Assert that the given content tab has the given URL (string) loaded.
 */
function assert_content_tab_has_url(aTab, aURL) {
  if (aTab.browser.currentURI.spec != aURL)
    mark_failure(["The tab", aTab, "should have URL", aURL, "but instead has",
                  aTab.browser.currentURI.spec]);
}

/**
 * Gets the element with the given ID from the content tab's displayed page.
 */
function content_tab_e(aTab, aId) {
  return aTab.browser.contentDocument.getElementById(aId);
}

/**
 * Assert that the given content tab has the given URL loaded as a favicon.
 */
function assert_content_tab_has_favicon(aTab, aURL) {
  if (aTab.browser.mIconURL != aURL)
    mark_failure(["The tab", aTab, "should have a favicon with URL", aURL,
                  "but instead has", aTab.browser.mIconURL]);
}

/**
 * Gets the element with the given ID from the content tab's displayed page,
 * wrapped in an elib.Elem.
 */
function content_tab_eid(aTab, aId) {
  return new elib.Elem(content_tab_e(aTab, aId));
}

/**
 * Returns the current "display" style property of an element.
 */
function get_content_tab_element_display(aTab, aElem) {
  let style = aTab.browser.contentWindow.getComputedStyle(aElem);
  return style.getPropertyValue("display");
}

/**
 * Asserts that the given element is hidden from view on the page.
 */
function assert_content_tab_element_hidden(aTab, aElem) {
  let display = get_content_tab_element_display(aTab, aElem);
  if (display != "none") {
    mark_failure(["Element", aElem, "should be hidden but has display", display,
                  "instead"]);
  }
}

/**
 * Asserts that the given element is visible on the page.
 */
function assert_content_tab_element_visible(aTab, aElem) {
  let display = get_content_tab_element_display(aTab, aElem);
  if (display != "inline") {
    mark_failure(["Element", aElem, "should be visible but has display", display,
                  "instead"]);
  }
}

/**
 * Waits for the element's display property to be the given value.
 */
function wait_for_content_tab_element_display_value(aTab, aElem, aValue) {
  function isValue() {
    return get_content_tab_element_display(aTab, aElem) == aValue;
  }
  if (!controller.waitForEval("subject()", NORMAL_TIMEOUT, FAST_INTERVAL,
                              isValue)) {
    mark_failure(["Timeout waiting for element", aElem, "to have display value",
                  aValue]);
  }
}

/**
 * Asserts that the given text is present on the content tab's page.
 */
function assert_content_tab_text_present(aTab, aText) {
  let html = aTab.browser.contentDocument.documentElement.innerHTML;
  if (html.indexOf(aText) == -1) {
    mark_failure(["Unable to find string \"" + aText + "\" on the content tab's page"]);
  }
}

/**
 * Asserts that the given text is absent on the content tab's page.
 */
function assert_content_tab_text_absent(aTab, aText) {
  let html = aTab.browser.contentDocument.documentElement.innerHTML;
  if (html.indexOf(aText) != -1) {
    mark_failure(["Found string \"" + aText + "\" on the content tab's page"]);
  }
}
