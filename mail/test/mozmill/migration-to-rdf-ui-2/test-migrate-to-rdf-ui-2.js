/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * When moving from ui-rdf 0 to 1, we ensure that we've removed the collapsed
 * property from the folderPaneBox, but that we still persist width.
 */

let MODULE_NAME = "test-migrate-to-rdf-ui-2";
let RELATIVE_ROOT = "../shared-modules";
let MODULE_REQUIRES = ["folder-display-helpers"];

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function setupModule(module) {
  collector.getModule("folder-display-helpers").installInto(module);
}

/**
 * Test that the "collapsed" property for the folderPaneBox resource was
 * successfully unasserted.
 */
function test_collapsed_removed() {
  // We can't actually detect this visually (at least, not deterministically)
  // so we'll use the RDF service to see if the collapsed property has been
  // excised from the folderPaneBox resource.
  const MESSENGER_DOCURL = "chrome://messenger/content/messenger.xul#";

  let rdf = Cc["@mozilla.org/rdf/rdf-service;1"].getService(Ci.nsIRDFService);
  let datasource = rdf.GetDataSource("rdf:local-store");
  let fpbResource = rdf.GetResource(MESSENGER_DOCURL + "folderPaneBox");
  let collapsedResource = rdf.GetResource("collapsed");
  let target = datasource.GetTarget(fpbResource, collapsedResource, true);

  if (target != null)
    throw Error("The collapsed property still seems to exist for folderPaneBox.");
}

/**
 * Test that the "width" property of the folderPaneBox resource was persisted.
 * We do this simply be checking that the width of the folderPaneBox matches
 * the width defined in localstore.rdf (which, in this case, is 500px).
 */
function test_width_persisted() {
  const EXPECTED_WIDTH = 500; // Set in localstore.rdf, found in this directory
  let fpbWidth = mc.e("folderPaneBox").width;
  assert_equals(EXPECTED_WIDTH, fpbWidth,
                "The width of the folderPaneBox was not persisted.");
}

/**
 * Test that the throbber in the main menu (or the mailbar on OSX) was removed.
 */
function test_throbber_removed() {
  let currentSet;

  if (mc.mozmillModule.isMac)
    currentSet = mc.e("mail-bar3").getAttribute("currentset");
  else
    currentSet = mc.e("mail-toolbar-menubar2").getAttribute("currentset");

  assert_false(currentSet.contains("throbber-box"),
               "We found a throbber-box where we shouldn't have.");
}
