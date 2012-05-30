/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MODULE_NAME = 'test-message-sidebar';

var RELATIVE_ROOT = '../shared-modules';
var MODULE_REQUIRES = ['window-helpers'];

var windowHelper;
var mc;

var setupModule = function (module) {
  windowHelper = collector.getModule('window-helpers');
  mc = windowHelper.wait_for_existing_window("mail:3pane");
  windowHelper.installInto(module);
  windowHelper.augment_controller(mc);
};


function test_messagepane_extension_points_exist() {
  mc.assertNode(mc.eid("messagepanewrapper"));
}
