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
 * The Mozilla Foundation.
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

/**
 * When moving from ui-rdf 0 to 1, we ensure that we've removed the collapsed
 * property from the folderPaneBox, but that we still persist width.
 */

let MODULE_NAME = "test-migrate-to-rdf-ui-2";
let RELATIVE_ROOT = "../shared-modules";
let MODULE_REQUIRES = ["folder-display-helpers", "migration-helpers"];

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let mh = collector.getModule("migration-helpers");
  mh.installInto(module);
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

  assert_equals(-1, currentSet.indexOf("throbber-box"),
                "We found a throbber-box where we shouldn't have.");
}
