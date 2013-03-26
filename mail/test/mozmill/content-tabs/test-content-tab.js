/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-content-tab';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['folder-display-helpers', 'content-tab-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);
Components.utils.import('resource://gre/modules/Services.jsm');

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
// Note: this one adds to '' as we need to make sure that favicon.ico is in the
// root directory.
var url = collector.addHttpResource('../content-tabs/html', '');
var whatsUrl = url + "whatsnew.html";

var setupModule = function (module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let cth = collector.getModule('content-tab-helpers');
  cth.installInto(module);
  let dh = collector.getModule('dom-helpers');
  dh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
};

function test_content_tab_open() {
  // Set the pref so that what's new opens a local url
  Services.prefs.setCharPref("mailnews.start_page.override_url", whatsUrl);

  let tab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew, whatsUrl);

  assert_tab_has_title(tab, "What's New Content Test");
  // Check the location of the what's new image, this is via the link element
  // and therefore should be set and not favicon.png.
  assert_content_tab_has_favicon(tab, url + "whatsnew.png");

  // Check that window.content is set up correctly wrt content-primary and
  // content-targetable.
  if (mc.window.content.location != whatsUrl)
    throw new Error("window.content is not set to the url loaded, incorrect type=\"...\"?");

}

/**
 * Just make sure that the context menu does what we expect in content tabs wrt.
 * spell checking options.
 */
function test_spellcheck_in_content_tabs() {
  let tabmail = mc.tabmail;
  let w = tabmail.selectedTab.browser.contentWindow;
  let textarea = w.document.querySelector("textarea");
  let eidMailContext = mc.eid("mailContext");

  // Test a few random items
  mc.click(new elementslib.Elem(textarea));
  // Bug 364914 causes textareas to not be spell checked until they have been
  // focused at last once, so give the event loop a chance to spin.
  mc.sleep(0);
  mc.rightClick(new elementslib.Elem(textarea));
  assert_element_visible("mailContext-spell-dictionaries");
  assert_element_visible("mailContext-spell-check-enabled");
  assert_element_not_visible("mailContext-replySender"); // we're in a content tab!
  close_popup(mc, eidMailContext);

  // Different test
  mc.rightClick(new elementslib.Elem(w.document.body.firstElementChild));
  assert_element_not_visible("mailContext-spell-dictionaries");
  assert_element_not_visible("mailContext-spell-check-enabled");
  close_popup(mc, eidMailContext);

  // Right-click on "zombocom" and add to dictionary
  EventUtils.synthesizeMouse(textarea, 5, 5,
                             {type: "contextmenu", button: 2}, w);
  let suggestions = mc.window.document.getElementsByClassName("spell-suggestion");
  assert_true(suggestions.length > 0, "What, is zombocom a registered word now?");
  mc.click(mc.eid("mailContext-spell-add-to-dictionary"));
  close_popup(mc, eidMailContext);

  // Now check we don't have any suggestionss
  EventUtils.synthesizeMouse(textarea, 5, 5,
                             {type: "contextmenu", button: 2}, w);
  let suggestions = mc.window.document.getElementsByClassName("spell-suggestion");
  assert_true(suggestions.length == 0, "But I just taught you this word!");
  close_popup(mc, eidMailContext);
}
// XXX Currently the spellcheck test has focus issues on non-Mac
test_spellcheck_in_content_tabs.EXCLUDED_PLATFORMS = ['winnt', 'linux'];

function test_content_tab_context_menu() {
  let tabmail = mc.tabmail;
  let w = tabmail.selectedTab.browser.contentWindow;
  let heading = w.document.querySelector("h1");
  let mailContext = mc.e("mailContext");

  // Make sure the page's menu items are added on right-click.
  EventUtils.synthesizeMouse(heading, 5, 5, { type: "contextmenu", button: 2 },
                             w);
  wait_for_popup_to_open(mailContext);
  assert_equals(mailContext.firstChild.label, "Click me!");
  assert_element_visible("page-menu-separator");
  close_popup(mc, new elementslib.Elem(mailContext));

  // Make sure the page's menu items are *not* added on shift-right-click.
  EventUtils.synthesizeMouse(heading, 5, 5, { type: "contextmenu", button: 2,
                                              shiftKey: true }, w);
  wait_for_popup_to_open(mailContext);
  assert_not_equals(mailContext.firstChild.label, "Click me!");
  assert_element_not_visible("page-menu-separator");
  close_popup(mc, new elementslib.Elem(mailContext));
}

function test_content_tab_open_same() {
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  mc.click(new elementslib.Elem(mc.menus.helpMenu.whatsNew));

  controller.sleep(0);

  if (mc.tabmail.tabContainer.childNodes.length != preCount)
    throw new Error("A new content tab was opened when it shouldn't have been");

  // Double-check browser is still the same.
  if (mc.window.content.location != whatsUrl)
    throw new Error("window.content is not set to the url loaded, incorrect type=\"...\"?");
}

function test_content_tab_default_favicon() {
  const whatsUrl1 = url + "whatsnew1.html";

  // Set the pref so that what's new opens a local url
  Services.prefs.setCharPref("mailnews.start_page.override_url", whatsUrl1);

  let tab = open_content_tab_with_click(mc.menus.helpMenu.whatsNew, whatsUrl1);

  assert_tab_has_title(tab, "What's New Content Test 1");
  // Check the location of the favicon, this should be the site favicon in this
  // test.
  assert_content_tab_has_favicon(tab, url + "favicon.ico");
}

function test_content_tab_onbeforeunload() {
  let count = mc.tabmail.tabContainer.childNodes.length;
  let tab = mc.tabmail.tabInfo[count-1];
  tab.browser.contentWindow.addEventListener("beforeunload", function (event) {
    event.returnValue = "Green llama in your car";
  }, false);

  plan_for_modal_dialog("commonDialog", function (controller) {
    controller.window.document.documentElement.getButton("accept").doCommand();
  });
  mc.tabmail.closeTab(tab);
  wait_for_modal_dialog();
}

// XXX todo
// - test find bar
// - window.close within tab
// - zoom?
