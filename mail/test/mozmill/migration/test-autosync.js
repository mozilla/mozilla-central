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
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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
 * Test that the migration assistant's autosync page works properly.
 */

var MODULE_NAME = "test-autosync";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "migration-helpers"];

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let mh = collector.getModule("migration-helpers");
  mh.installInto(module);
}

/**
 * Make sure we can't open the autosync page, because we don't have any
 * fake IMAP servers.
 */
function test_open_and_close_autosync() {
  // Open the migration assistant, and try to navigate to the autosync page.
  try {
    let fc = open_migration_assistant(mc, "autosync");
    close_migration_assistant(fc);
  }
  catch (e) {
    // If it's not the error we were expecting, throw it!
    if (e.message != "Didn't find autosync in Migration Assistant!")
      throw e;
    // Otherwise, return before we throw the error below.
    return;
  }
  // Note: We don't find autosync because we don't have any fake IMAP
  // servers, so we shouldn't get here, and thus we're throwing an error.
  throw new Error("Found autosync, but didn't expect to!");
}

