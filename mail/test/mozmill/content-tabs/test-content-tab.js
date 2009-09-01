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
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <mark@standard8.plus.com>
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

var MODULE_NAME = 'test-content-tab';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['window-helpers'];

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller)
;
var mozmill = {};
Components.utils.import('resource://mozmill/modules/mozmill.js', mozmill);
var elementslib = {};
Components.utils.import('resource://mozmill/modules/elementslib.js', elementslib);

var windowHelper;
var mainController = null;
var mc;

// RELATIVE_ROOT messes with the collector, so we have to bring the path back
// so we get the right path for the resources.
var url = collector.addHttpResource('../content-tabs/html', 'content-tabs');
var whatsUrl = url + "whatsnew.html";

var setupModule = function (module) {
  windowHelper = collector.getModule('window-helpers');
  mc = mainController = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.installInto(module);
  windowHelper.augment_controller(mc);
};

function test_content_tab_open() {
  let preCount = mc.tabmail.tabContainer.childNodes.length;

  // Set the pref so that what's new opens a local url
  Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefBranch)
            .setCharPref("mailnews.start_page.override_url",
                         whatsUrl);

  mc.click(new elementslib.Elem(mc.menus.helpMenu.whatsNew));

  controller.sleep(0);
  // XXX When bug 508999 is fixed, remove the sleep and use the waitForEval
  // instead.
  // controller.waitForEval("subject.busy == false", 1000, 100, newTab);
  controller.sleep(400);

  if (mc.tabmail.tabContainer.childNodes.length != preCount + 1)
    throw new Error("The content tab didn't open");

  if (mc.tabmail.selectedTab.title != "What's New Content Test")
    throw new Error("The content tab has an incorrect title");

  // Check that window.content is set up correctly wrt content-primary and
  // content-targetable.
  if (mc.window.content.location != whatsUrl)
    throw new Error("window.content is not set to the url loaded, incorrect type=\"...\"?");
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

// XXX todo
// - Open second tab
// - test find bar
// - window.close within tab
// - zoom?
