/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "junk-helpers";

const RELATIVE_ROOT = "../shared-modules";
// we need this for the main controller
const MODULE_REQUIRES = ["folder-display-helpers"];

var elib = {};
Cu.import('resource://mozmill/modules/elementslib.js', elib);
var mozmill = {};
Cu.import('resource://mozmill/modules/mozmill.js', mozmill);
var utils = {};
Cu.import("resource://mozmill/modules/utils.js", utils);

var folderDisplayHelper;
var mc;

// logHelper (and therefore folderDisplayHelper) exports
var mark_failure;

function setupModule() {
  folderDisplayHelper = collector.getModule('folder-display-helpers');
  mc = folderDisplayHelper.mc;
  mark_failure = folderDisplayHelper.mark_failure;
}

function installInto(module) {
  setupModule();

  // Now copy helper functions
  module.mark_selected_messages_as_junk = mark_selected_messages_as_junk;
  module.delete_mail_marked_as_junk = delete_mail_marked_as_junk;
}

/**
 * Mark the selected messages as junk. This is done by pressing the J key.
 *
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function mark_selected_messages_as_junk(aController) {
  if (aController === undefined)
    aController = mc;
  aController.keypress(aController == mc ? mc.eThreadTree : null,
                       "j", {});
}

/**
 * Delete all mail marked as junk in the selected folder. This is done by
 * activating the menu option from the Tools menu.
 *
 * @param aNumDeletesExpected The number of deletes expected.
 * @param aController The controller in whose context to do this, defaults to
 *     |mc| if omitted.
 */
function delete_mail_marked_as_junk(aNumDeletesExpected, aController) {
  if (aController === undefined)
    aController = mc;
  // Monkey patch and wrap around the deleteJunkInFolder function, mainly for
  // the case where deletes aren't expected. See the below comment for an
  // explanation of why this is done.
  let realDeleteJunkInFolder = aController.window.deleteJunkInFolder;
  let numMessagesDeleted = null;
  let fakeDeleteJunkInFolder = function fakeDeleteJunkInFolder() {
    numMessagesDeleted = realDeleteJunkInFolder();
    return numMessagesDeleted;
  };
  try {
    aController.window.deleteJunkInFolder = fakeDeleteJunkInFolder;

    // if something is loading, make sure it finishes loading...
    folderDisplayHelper.wait_for_message_display_completion(aController);
    if (aNumDeletesExpected != 0) {
      folderDisplayHelper.plan_to_wait_for_folder_events(
        "DeleteOrMoveMsgCompleted", "DeleteOrMoveMsgFailed");
    }

    aController.click(new elib.Elem(aController.menus.tasksMenu.deleteJunk));

    if (aNumDeletesExpected != 0)
      folderDisplayHelper.wait_for_folder_events();

    // The case where no deletes are expected is somewhat more complicated,
    // since proving the lack of events is generally harder than proving their
    // presence. We somehow need to make sure that the program logic has
    // quiesced before declaring a success or failure. We have several options
    // to do this while treating deleteJunkInFolder as a black box, but all of
    // them have problems:
    //
    // 1. Time out, and expect a time out to happen: Time is generally a
    //    good-enough proxy for program logic quiescence, since it works out
    //    well (and quickly) in the case where events do happen, and we err on
    //    the side of failure. However, we lose these advantages when we expect
    //    things not to happen, since not only do we lose the quickness, we
    //    might also let some failures slip through if the events happen after
    //    the timeout.
    //
    // 2. Spin an event loop until it runs out of events: Something
    //    asynchronously I/O driven could potentially get starved enough just
    //    for that to break. Script blocking (which is what causes the whole
    //    problem of deferred click processing in the first place) is
    //    unfortunately one of those things.
    //
    // 3. Add an onclick listener to the menu item: We can't get a guarantee
    //    that we'll be executed after deleteJunkInFolder. Also, even if we did,
    //    this assumes that deleteJunkInFolder is always synchronous, even
    //    though deleteJunkInFolder gives us no such guarantees.
    //
    // 4. Monkey patch and wrap around the deleteJunkInFolder function, and see
    //    when it completes. Again, like 3, this assumes that deleteJunkInFolder
    //    is always synchronous.
    //
    // Methods that do depend on some knowledge of deleteJunkInFolder:
    //
    // 5. Have deleteJunkInFolder take a callback or listener that gets called
    //    whether or not messages are deleted. This has problems of its own:
    //    a) We'd have to trust deleteJunkInFolder to do the right thing and
    //       call the callback by itself whenever no messages are deleted. This
    //       really seems unavoidable.
    //    b) XUL doesn't have a way of command handlers notifying command
    //       completion, so we wouldn't be able to simulate a click (the above
    //       aController.click call) and have to call deleteJunkInFolder
    //       directly. This can be solved with monkey patching (option 3 above).
    //    c) Not all code paths in deleteJunkInFolder where messages are deleted
    //       allow listeners to be passed in.
    //
    // The solution adopted is to use a combination of 3 and having
    // deleteJunkInFolder return the number of messages deleted. This embraces
    // the unavoidability of a) above, solves b), and side-steps c) (which is
    // fine, because we already have all sorts of events when messages are
    // deleted). The only assumption is that deleteJunkInFolder is synchronous
    // if no messages are deleted.
    utils.waitFor(function () numMessagesDeleted != null,
                  "Timeout waiting for numMessagesDeleted to turn " +
                  "non-null. This either means that deleteJunkInFolder " +
                  "didn't get called or that it didn't return a value.");

    // Check the number of deleted messages.
    if (aNumDeletesExpected != numMessagesDeleted)
      mark_failure(["Expected", aNumDeletesExpected, "deletes, but",
                    numMessagesDeleted, "happened"]);
  }
  finally {
    aController.window.deleteJunkInFolder = realDeleteJunkInFolder;
  }
}
