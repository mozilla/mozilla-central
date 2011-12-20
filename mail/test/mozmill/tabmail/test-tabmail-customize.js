/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Conley <mconley@mozilla.com>
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
 * Tests customization features of the tabs toolbar.
 */

var MODULE_NAME = "test-tabmail-customize";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ['folder-display-helpers', 'mouse-event-helpers',
                       'window-helpers'];

const USE_SHEET_PREF = "toolbar.customization.usesheet";

let controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);

function setupModule(module) {
  let fdh = collector.getModule('folder-display-helpers');
  fdh.installInto(module);
  let meh = collector.getModule('mouse-event-helpers');
  meh.installInto(module);
  let wh = collector.getModule('window-helpers');
  wh.installInto(module);
}

function teardownModule(module) {
  // Let's reset any and all of our changes to the toolbar
  let ctw = open_mail_toolbox_customization_dialog(mc);
  ctw.window.restoreDefaultSet();
  close_mail_toolbox_customization_dialog(ctw);
}

/**
 * Test that we can access the customize context menu by right
 * clicking on the tabs toolbar.
 */
function test_open_context_menu() {
  // First, ensure that the context menu is closed.
  let contextPopup = mc.e('toolbar-context-menu');
  assert_not_equals(contextPopup.state, "open");

  // Right click on the tab bar
  mc.rightClick(mc.eid("tabcontainer"));
  // Ensure that the popup opened
  assert_equals(contextPopup.state, "open");
}

/**
 * Test that, when customizing the toolbars, if the user drags an item onto
 * the tab bar, they're redirected to the toolbar directly to the right of
 * the tab bar.
 */
function test_redirects_toolbarbutton_drops() {
  let tabbar = mc.e("tabcontainer");
  let toolbar = mc.e("tabbar-toolbar");

  // First, let's open up the customize toolbar window.
  let ctw = open_mail_toolbox_customization_dialog(mc);

  // Let's grab some items from the customize window, and try dropping
  // them on the tab bar
  ["wrapper-button-replyall",
   "wrapper-button-replylist",
   "wrapper-button-forward",
   "wrapper-button-archive",
  ].forEach(function(aButtonId) {
    let button = ctw.e(aButtonId);

    let dt = synthesize_drag_start(ctw.window, button, ctw.window);
    assert_true(dt, "Drag target was undefined");

    synthesize_drag_over(mc.window, tabbar, dt);
    synthesize_drop(mc.window, tabbar, dt);

    // Now let's check to make sure that this button is now the first
    // item in the tab bar toolbar.
    assert_equals(toolbar.firstChild.id, aButtonId,
                  "Button was not added as first child!");
  });

  // Ok, now let's try to grab some toolbar buttons from mail-bar3, and
  // make sure we can drop those on the tab bar too.
  ["button-getmsg",
   "button-newmsg",
   "button-address",
   "button-tag",
  ].forEach(function(aButtonId) {
    let button = mc.e(aButtonId);

    let dt = synthesize_drag_start(mc.window, button, mc.window);
    assert_true(dt, "Drag target was undefined");

    synthesize_drag_over(mc.window, tabbar, dt);
    synthesize_drop(mc.window, tabbar, dt);

    // Now let's check to make sure that this button is now the first
    // item in the tab bar toolbar.
    assert_equals(toolbar.firstChild.id, "wrapper-" + aButtonId,
                  "Button was not added as first child!");
  });
  
  close_mail_toolbox_customization_dialog(ctw);
}

/**
 * Open the mail-toolbox customization dialog.
 */
function open_mail_toolbox_customization_dialog(aController) {
  // This is some hackery copied over from message-header/test-header-toolbar.js
  // - we'll want to combine these two hacks at some point so we can eliminate
  // them at the same time someday.
  let ctc;
  aController.click(aController.eid("CustomizeMailToolbar"));
  // Depending on preferences the customization dialog is
  // either a normal window or embedded into a sheet.
  if (Services.prefs.getBoolPref(USE_SHEET_PREF, true)) {
    // XXX Sleep so the dialog has a chance to load. It seems that
    // ewait("donebutton") does not work after the update to mozmill 1.5.4b4.
    controller.sleep(1000);
    let contentWindow = aController.eid("customizeToolbarSheetIFrame").node.contentWindow;
    // This is taken from test-migration-helpers.js#128:
    // XXX this is not my fault, but I'm not going to fix it. Just make it less
    // broken:
    // Lie to mozmill to convince it to not explode because these frames never
    // get a mozmillDocumentLoaded attribute.
    contentWindow.mozmillDocumentLoaded = true;
    ctc = augment_controller(new controller.MozMillController(contentWindow));
  }
  else {
    ctc = wait_for_existing_window("CustomizeToolbarWindow");
  }
  return ctc;
}

/**
 * Close the mail-toolbox customization dialog.
 */
function close_mail_toolbox_customization_dialog(aCtc)
{
  // As with open_mail_toolbox_customization_dialog, this is hackery copied
  // over from message-header/test-header-toolbar.js.
  aCtc.click(aCtc.eid("donebutton"));
  // XXX There should be an equivalent for testing the closure of
  // XXX the dialog embedded in a sheet, but I do not know how.
  if (!Services.prefs.getBoolPref(USE_SHEET_PREF, true)) {
    assert_true(aCtc.window.closed, "The customization dialog is not closed.");
  }
}
