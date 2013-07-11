/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Cu.import("resource://gre/modules/Services.jsm");
var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var EventUtils = {};
Cu.import('resource://mozmill/stdlib/EventUtils.js', EventUtils);
var controller = {};
Cu.import('resource://mozmill/modules/controller.js', controller);

const MODULE_NAME = 'customization-helpers';
const USE_SHEET_PREF = "toolbar.customization.usesheet";

const MODULE_REQUIRES = ['folder-display-helpers', 'window-helpers'];

var wh, fdh;

function setupModule() {
  fdh = collector.getModule('folder-display-helpers');
  wh = collector.getModule('window-helpers');
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.CustomizeDialogHelper = CustomizeDialogHelper;
}

/**
 * Initalize the help for a customization dialog
 * @param {} aToolbarId
 *   the ID of the toolbar to be customized
 * @param {} aOpenElementId
 *   the ID of the element to be clicked on to open the dialog
 * @param {} aWindowType
 *   the windowType of the window containing the dialog to be opened
 */
function CustomizeDialogHelper(aToolbarId, aOpenElementId, aWindowType) {
  this._toolbarId = aToolbarId;
  this._openElementId = aOpenElementId;
  this._windowType = aWindowType;
  this._openInWindow = !Services.prefs.getBoolPref(USE_SHEET_PREF);
}


CustomizeDialogHelper.prototype = {
  /**
   * Open a customization dialog by clicking on a given XUL element.
   * @param {} aController
   *   the controller object of the window for which the customization
   *   dialog should be opened
   * @returns a controller for the customization dialog
   */
  open: function CustomizeDialogHelper_open(aController) {
    let ctc;
    aController.click(aController.eid(this._openElementId));
    // Depending on preferences the customization dialog is
    // either a normal window or embedded into a sheet.
    if (!this._openInWindow) {
      ctc = wh.wait_for_frame_load(aController.e("customizeToolbarSheetIFrame"),
        "chrome://global/content/customizeToolbar.xul");
    }
    else {
      ctc = wh.wait_for_existing_window(this._windowType);
    }
    return ctc;
  },

  /**
   * Close the customization dialog.
   * @param {} aCtc
   *   the controller object of the customization dialog which should be closed
   */
  close: function CustomizeDialogHelper_close(aCtc) {
    if (this._openInWindow)
      wh.plan_for_window_close(aCtc);

    aCtc.click(aCtc.eid("donebutton"));
    // XXX There should be an equivalent for testing the closure of
    // XXX the dialog embedded in a sheet, but I do not know how.
    if (this._openInWindow) {
      wh.wait_for_window_close();
      fdh.assert_true(aCtc.window.closed, "The customization dialog is not closed.");
    }
  },

  /**
   *  Restore the default buttons in the header pane toolbar
   *  by clicking the corresponding button in the palette dialog
   *  and check if it worked.
   * @param {} aController
   *   the controller object of the window for which the customization
   *   dialog should be opened
   */
  restoreDefaultButtons: function CustomizeDialogHelper_restoreDefaultButtons(aController) {
    let ctc = this.open(aController);
    let restoreButton = ctc.window
                           .document
                           .getElementById("main-box")
                           .querySelector("[oncommand*='overlayRestoreDefaultSet();']");

    ctc.click(new elib.Elem(restoreButton));

    this.close(ctc);

    let toolbar = aController.e(this._toolbarId);
    let defaultSet = toolbar.getAttribute("defaultset");

    fdh.assert_equals(toolbar.currentSet, defaultSet);
    fdh.assert_equals(toolbar.getAttribute("currentset"), defaultSet);
  },
};
