/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Helpers to deal with the preferences window.
 */

const MODULE_NAME = "pref-window-helpers";

const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ["folder-display-helpers", "window-helpers"];

var utils = {};
Cu.import("resource://mozmill/modules/utils.js", utils);

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

    utils.waitFor(paneLoadedChecker,
                  "Timed out waiting for prefpane " + aPaneID + " to load.");
    aCallback(prefc);
  }

  wh.plan_for_modal_dialog("Mail:Preferences", waitForPaneLoad);
  fdh.mc.window.openOptionsDialog(aPaneID);
  wh.wait_for_modal_dialog("Mail:Preferences");
}
