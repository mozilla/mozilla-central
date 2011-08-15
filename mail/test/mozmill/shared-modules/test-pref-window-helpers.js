/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
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

/*
 * Helpers to deal with the preferences window.
 */

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

var controller = {};
Cu.import("resource://mozmill/modules/controller.js", controller);

const MODULE_NAME = "pref-window-helpers";

const RELATIVE_ROOT = "../shared-modules";

const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

const NORMAL_TIMEOUT = 6000;
const FAST_INTERVAL = 100;

var fdh;
var wh;

function setupModule() {
  fdh = collector.getModule("folder-display-helpers");
  wh = collector.getModule("window-helpers");
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.open_pref_window = open_pref_window;
}

/**
 * Open the preferences window with the given pane displayed. The pane needs to
 * be one of the prefpane ids in mail/components/preferences/preferences.xul.
 *
 * Since the preferences window might be modal (it is currently modal on
 * platforms without instantApply), it spins its own event loop. This means
 * that you need to provide a callback to be executed when the window is loaded.
 *
 * @param aPaneID The ID of the pref pane to display (see
 *     mail/components/preferences/preferences.xul for valid IDs.)
 * @param aCallback A callback to be executed once the window is loaded. It will
 *     be passed the controller for the pref window as its one and only argument.
 */
function open_pref_window(aPaneID, aCallback) {
  function waitForPaneLoad(prefc) {
    let pane = prefc.e(aPaneID);
    function paneLoadedChecker() {
      return pane.loaded;
    }

    if (!controller.waitForEval("subject()", NORMAL_TIMEOUT, FAST_INTERVAL,
                                paneLoadedChecker))
      throw new Error("Timed out waiting for prefpane " + aPaneID +
                      " to load.");

    aCallback(prefc);
  }

  wh.plan_for_modal_dialog("Mail:Preferences", waitForPaneLoad);
  fdh.mc.window.openOptionsDialog(aPaneID);
  wh.wait_for_modal_dialog("Mail:Preferences");
}
