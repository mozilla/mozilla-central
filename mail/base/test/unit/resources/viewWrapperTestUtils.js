/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/dbViewWrapper.js");
Components.utils.import("resource:///modules/mailViewManager.js");
Components.utils.import("resource:///modules/virtualFolderWrapper.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var gInbox;

/**
 * Do initialization for xpcshell-tests; not used by
 *  test-folder-display-helpers.js, our friendly mozmill test helper.
 */
function initViewWrapperTestUtils(aInjectionConfig) {
  gMessageGenerator = new MessageGenerator();
  gMessageScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

  async_test_runner_register_helper(VWTU_testHelper);
  register_message_injection_listener(VWTU_testHelper);
  if (aInjectionConfig)
    gInbox = configure_message_injection(aInjectionConfig);
  else
    gInbox = configure_message_injection({mode: "local"});
}

// something less sucky than do_check_true
function assert_true(aBeTrue, aWhy, aDumpView) {
  if (!aBeTrue) {
    if (aDumpView)
      dump_view_state(VWTU_testHelper.active_view_wrappers[0]);
    do_throw(aWhy);
  }
}

function assert_false(aBeFalse, aWhy, aDumpView) {
  if (aBeFalse) {
    if (aDumpView)
      dump_view_state(VWTU_testHelper.active_view_wrappers[0]);
    do_throw(aWhy);
  }
}

function assert_equals(aA, aB, aWhy, aDumpView) {
  if (aA != aB) {
    if (aDumpView)
      dump_view_state(VWTU_testHelper.active_view_wrappers[0]);
    do_throw(aWhy);
  }
}

function assert_bit_set(aWhat, aBit, aWhy) {
  if (!(aWhat & aBit))
    do_throw(aWhy);
}

function assert_bit_not_set(aWhat, aBit, aWhy) {
  if (aWhat & aBit)
    do_throw(aWhy);
}

var gFakeCommandUpdater = {
  updateCommandStatus : function() {
  },

  displayMessageChanged : function(aFolder, aSubject, aKeywords) {
  },

  summarizeSelection: function () {
  },

  updateNextMessageAfterDelete : function() {
  }
};

var gMockViewWrapperListener = {
  __proto__: IDBViewWrapperListener.prototype,
  shouldUseMailViews: true,
  shouldDeferMessageDisplayUntilAfterServerConnect: false,
  shouldMarkMessagesReadOnLeavingFolder : function(aMsgFolder) {
      return Services.prefs
                     .getBoolPref("mailnews.mark_message_read." +
                                  aMsgFolder.server.type);
  },
  messenger: null,
  // use no message window!
  msgWindow: null,
  threadPaneCommandUpdater: gFakeCommandUpdater,
  // event handlers
  allMessagesLoadedEventCount: 0,
  onMessagesLoaded: function(aAll) {
    if (!aAll)
      return;
    this.allMessagesLoadedEventCount++;
    if (this.pendingLoad) {
      this.pendingLoad = false;
      async_driver();
    }
  },

  messagesRemovedEventCount: 0,
  onMessagesRemoved: function() {
    this.messagesRemovedEventCount++;
  }
};

function punt() {
  dump("  ******************************\n");
  dump("  *** PUNTING! implement me! ***\n");
  dump("  ******************************\n");
}

/**
 * Track our resources used by each test.  This is so we can keep our memory
 *  usage low by forcing things to be forgotten about (or even nuked) once
 *  a test completes, but also so we can provide useful information about the
 *  state of things if a test times out.
 */
var VWTU_testHelper = {
  active_view_wrappers: [],
  active_real_folders: [],
  active_virtual_folders: [],

  onVirtualFolderCreated: function(aVirtualFolder) {
    this.active_virtual_folders.push(aVirtualFolder);
  },

  postTest: function () {
    // close all the views we opened
    this.active_view_wrappers.forEach(function (wrapper) {
      wrapper.close();
    });
    // verify that the notification helper has no outstanding listeners.
    if (IDBViewWrapperListener.prototype._FNH.haveListeners()) {
      let msg = "FolderNotificationHelper has listeners, but should not.";
      dump("*** " + msg + "\n");
      dump("Pending URIs:\n");
      for each (let [folderURI, wrappers] in
                Iterator(IDBViewWrapperListener.prototype._FNH
                           ._pendingFolderUriToViewWrapperLists)) {
        dump("  " + folderURI + "\n");
      }
      dump("Interested wrappers:\n");
      for each (let [folderURI, wrappers] in
                Iterator(IDBViewWrapperListener.prototype._FNH
                           ._interestedWrappers)) {
        dump("  " + folderURI + "\n");
      }
      dump("***\n");
      do_throw(msg);
    }
    // force the folder to forget about the message database
    this.active_virtual_folders.forEach(function (folder) {
      folder.msgDatabase = null;
    });
    this.active_real_folders.forEach(function (folder) {
      folder.msgDatabase = null;
    });

    this.active_view_wrappers.splice(0);
    this.active_real_folders.splice(0);
    this.active_virtual_folders.splice(0);

    gMockViewWrapperListener.allMessagesLoadedEventCount = 0;
  },
  onTimeout: function () {
    dump("-----------------------------------------------------------\n");
    dump("Active things at time of timeout:\n");
    for each (let [, folder] in Iterator(this.active_real_folders)) {
      dump("Real folder: " + folder.prettyName + "\n");
    }
    for each (let [, virtFolder] in Iterator(this.active_virtual_folders)) {
      dump("Virtual folder: " + virtFolder.prettyName + "\n");
    }
    for each (let [i, viewWrapper] in Iterator(this.active_view_wrappers)) {
      dump("-----------------------------------\n");
      dump("Active view wrapper " + i + "\n");
      dump_view_state(viewWrapper);
    }
  }
};

function make_view_wrapper() {
  let wrapper = new DBViewWrapper(gMockViewWrapperListener);
  VWTU_testHelper.active_view_wrappers.push(wrapper);
  return wrapper;
}

/**
 * Clone an open and valid view wrapper.
 */
function clone_view_wrapper(aViewWrapper) {
  let wrapper = aViewWrapper.clone(gMockViewWrapperListener);
  VWTU_testHelper.active_view_wrappers.push(wrapper);
  return wrapper;
}

/**
 * Open a folder for view display.  This is an async operation, relying on the
 *  onMessagesLoaded(true) notification to get he test going again.
 */
function async_view_open(aViewWrapper, aFolder) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.open(aFolder);
  return false;
}

function async_view_set_mail_view(aViewWrapper, aMailViewIndex, aData) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.setMailView(aMailViewIndex, aData);
  return false;
}

function async_view_refresh(aViewWrapper) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.refresh();
  return false;
}

function async_view_group_by_sort(aViewWrapper, aGroupBySort) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.showGroupedBySort = aGroupBySort;
  return false;
}

/**
 * Call endViewUpdate on your wrapper in the async idiom.  This is essential if
 *  you are doing things to a cross-folder view which does its searching in a
 *  time-sliced fashion.  In such a case, you would call beginViewUpdate
 *  manually, then poke at the view, then call us to end the view update.
 */
function async_view_end_update(aViewWrapper) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.endViewUpdate();
  return false;
}

/**
 * The deletion is asynchronous from a view perspective because the view ends
 *  up re-creating itself which triggers a new search.  This function is
 *  nominally asynchronous because we refresh XFVF views when one of their
 *  folders gets deleted.  In that case, you must pass the view wrapper you
 *  expect to be affected so we can do our async thing.
 * If, however, you are deleting the last folder that belongs to a view, you
 *  should not pass a view wrapper, because you should expect the view wrapper
 *  to close itself and destroy the view.  (Well, the view might do something
 *  too, but we don't care what it does.)  We provide a |delete_folder| alias
 *  so code can look clean.
 *
 * @param aViewWrapper Required when you want us to operate asynchronously.
 * @param aDontEmptyTrash This function will empty the trash after deleting the
 *                        folder, unless you set this parameter to true.
 */
function async_delete_folder(aFolder, aViewWrapper, aDontEmptyTrash) {
  VWTU_testHelper.active_real_folders.splice(
    VWTU_testHelper.active_real_folders.indexOf(aFolder), 1);
  // deleting tries to be helpful and move the folder to the trash...
  aFolder.parent.deleteSubFolders(
    toXPCOMArray([aFolder], Ci.nsIMutableArray), null);

  // ugh.  So we have the problem where that move above just triggered a
  //  re-computation of the view... which is an asynchronous operation
  //  that we don't care about at all.  We don't need to wait for it to
  //  complete, but if we don't, we have a race on enabling this next
  //  notification.
  // So we interrupt the search ourselves.  This problem is exclusively
  //  limited to unit testing and is not something we would need to do
  //  normally.  (Because things are single-threaded we are also
  //  guaranteed that we can interrupt it without needing locks or anything.)
  if (aViewWrapper) {
    if (aViewWrapper.searching)
      aViewWrapper.search.session.interruptSearch();
    aViewWrapper.listener.pendingLoad = true;
  }

  // ...so now the stupid folder is in the stupid trash
  // let's empty the trash, then, shall we?
  // (for local folders it doesn't matter who we call this on.)
  if (!aDontEmptyTrash)
    aFolder.emptyTrash(null, null);
  return false;
}
var delete_folder = async_delete_folder;

/**
 * For assistance in debugging, dump information about a message header.
 */
function dump_message_header(aMsgHdr) {
  dump("  Subject: " + aMsgHdr.mime2DecodedSubject + "\n");
  dump("  Date: " + new Date(aMsgHdr.date / 1000) + "\n");
  dump("  Author: " + aMsgHdr.mime2DecodedAuthor + "\n");
  dump("  Recipients: " + aMsgHdr.mime2DecodedRecipients + "\n");
  let junkScore = aMsgHdr.getStringProperty("junkscore");
  dump("  Read: " + aMsgHdr.isRead + "   Flagged: " + aMsgHdr.isFlagged +
       "   Killed: " + aMsgHdr.isKilled + "   Junk: " + (junkScore == "100") +
       "\n");
  dump("  Keywords: " + aMsgHdr.getStringProperty("Keywords") + "\n");
  dump("  Folder: " + aMsgHdr.folder.prettyName +
       "  Key: " + aMsgHdr.messageKey + "\n");
}

var WHITESPACE = "                                              ";
var MSG_VIEW_FLAG_DUMMY = 0x20000000;
function dump_view_contents(aViewWrapper) {
  let dbView = aViewWrapper.dbView;
  let treeView = aViewWrapper.dbView.QueryInterface(Ci.nsITreeView);
  let rowCount = treeView.rowCount;

  dump("********* Current View Contents\n");
  for (let iViewIndex = 0; iViewIndex < rowCount; iViewIndex++) {
    let level = treeView.getLevel(iViewIndex);
    let viewFlags = dbView.viewFlags;
    let flags = dbView.getFlagsAt(iViewIndex);
    let msgHdr = dbView.getMsgHdrAt(iViewIndex);

    let s = WHITESPACE.substr(0, level * 2);
    if (treeView.isContainer(iViewIndex))
      s += treeView.isContainerOpen(iViewIndex) ? "- " : "+ ";
    else
      s += ". ";
    //s += treeView.getCellText(iViewIndex, )
    if (flags & MSG_VIEW_FLAG_DUMMY)
      s += "dummy: ";
    s += dbView.cellTextForColumn(iViewIndex, "subject");
    s += " [" + msgHdr.folder.prettyName + "," + msgHdr.messageKey + "]";

    dump(s + "\n");
  }
  dump("********* end view contents\n");
}

function _lookupValueNameInInterface(aValue, aInterface) {
  for each (let [key, value] in Iterator(aInterface)) {
    if (value == aValue)
      return key;
  }
  return "unknown: " + aValue;
}

function dump_view_state(aViewWrapper, aDoNotDumpContents) {
  if (aViewWrapper.dbView == null) {
    dump("no nsIMsgDBView instance!\n");
    return;
  }
  if (!aDoNotDumpContents)
    dump_view_contents(aViewWrapper);
  dump("View: " + aViewWrapper.dbView + "\n");
  dump("  View Type: " +
       _lookupValueNameInInterface(aViewWrapper.dbView.viewType,
                                   Components.interfaces.nsMsgViewType) +
       "   " +
       "View Flags: " + aViewWrapper.dbView.viewFlags + "\n");
  dump("  Sort Type: " +
       _lookupValueNameInInterface(aViewWrapper.dbView.sortType,
                                   Components.interfaces.nsMsgViewSortType) +
       "   " +
       "Sort Order: " +
       _lookupValueNameInInterface(aViewWrapper.dbView.sortOrder,
                                   Components.interfaces.nsMsgViewSortOrder) +
       "\n");

  dump(aViewWrapper.search.prettyString());
}

/**
 * Verify that the messages in the provided SyntheticMessageSets are the only
 *  visible messages in the provided DBViewWrapper. If dummy headers are present
 *  in the view for group-by-sort, the code will ensure that the dummy header's
 *  underlying header corresponds to a message in the synthetic sets.  However,
 *  you should generally not rely on this code to test for anything involving
 *  dummy headers.
 *
 * In the event the view does not contain all of the messages from the provided
 *  sets or contains messages not in the provided sets, do_throw will be invoked
 *  with a human readable explanation of the problem.
 *
 * @param aSynSets A single SyntheticMessageSet or a list of
 *     SyntheticMessageSets.
 * @param aViewWrapper The DBViewWrapper whose contents you want to validate.
 */
function verify_messages_in_view(aSynSets, aViewWrapper) {
  if (!('length' in aSynSets))
    aSynSets = [aSynSets];

  // - Iterate over all the message sets, retrieving the message header.  Use
  //  this to construct a URI to populate a dictionary mapping.
  let synMessageURIs = {}; // map URI to message header
  for each (let [, messageSet] in Iterator(aSynSets)) {
    for each (let msgHdr in Iterator(messageSet.msgHdrs)) {
      synMessageURIs[msgHdr.folder.getUriForMsg(msgHdr)] = msgHdr;
    }
  }

  // - Iterate over the contents of the view, nulling out values in
  //  synMessageURIs for found messages, and exploding for missing ones.
  let dbView = aViewWrapper.dbView;
  let treeView = aViewWrapper.dbView.QueryInterface(Ci.nsITreeView);
  let rowCount = treeView.rowCount;

  for (let iViewIndex = 0; iViewIndex < rowCount; iViewIndex++) {
    let msgHdr = dbView.getMsgHdrAt(iViewIndex);
    let uri = msgHdr.folder.getUriForMsg(msgHdr);
    // expected hit, null it out. (in the dummy case, we will just null out
    //  twice, which is also why we do an 'in' test and not a value test.
    if (uri in synMessageURIs) {
      synMessageURIs[uri] = null;
    }
    // the view is showing a message that should not be shown, explode.
    else {
      dump("The view is showing the following message header and should not" +
           " be:\n");
      dump_message_header(msgHdr);
      dump("View State:\n");
      dump_view_state(aViewWrapper);
      mark_failure(["view contains header that should not be present!",
                    msgHdr]);
    }
  }

  // - Iterate over our URI set and make sure every message got nulled out.
  for each (let [, msgHdr] in Iterator(synMessageURIs)) {
    if (msgHdr != null) {
      dump("************************\n");
      dump("The view should have included the following message header but" +
           " did not:\n");
      dump_message_header(msgHdr);
      dump("View State:\n");
      dump_view_state(aViewWrapper);
      mark_failure(["view does not contain a header that should be present!",
                    msgHdr]);
    }
  }
}

/**
 * Assert if the view wrapper is displaying any messages.
 */
function verify_empty_view(aViewWrapper) {
  verify_messages_in_view([], aViewWrapper);
}

/**
 * Build a histogram of the treeview levels and verify it matches the expected
 *  histogram.  Oddly enough, I find this to be a reasonable and concise way to
 *  verify that threading mode is enabled.  Keep in mind that this file is
 *  currently not used to test the actual thread logic.  If/when that day comes,
 *  something less eccentric is certainly the way that should be tested.
 */
function verify_view_level_histogram(aExpectedHisto, aViewWrapper) {
  let dbView = aViewWrapper.dbView;
  let treeView = aViewWrapper.dbView.QueryInterface(Ci.nsITreeView);
  let rowCount = treeView.rowCount;

  let actualHisto = {};
  for (let iViewIndex = 0; iViewIndex < rowCount; iViewIndex++) {
    let level = treeView.getLevel(iViewIndex);
    actualHisto[level] = (actualHisto[level] || 0) + 1;
  }

  for (let [level, count] in Iterator(aExpectedHisto)) {
    if (actualHisto[level] != count) {
      dump_view_state(aViewWrapper);
      dump("*******************\n");
      dump("Expected count for histogram level " + level + " was " + count +
           " but got " + actualHisto[level] + "\n");
      do_throw("View histogram does not match!");
    }
  }
}

/**
 * Given a view wrapper and one or more view indices, verify that the row
 *  returns true for isContainer.
 *
 * @param aViewWrapper The view wrapper in question
 * @param ... View indices to check.
 */
function verify_view_row_at_index_is_container(aViewWrapper) {
  let treeView = aViewWrapper.dbView.QueryInterface(Ci.nsITreeView);
  for (let iArg = 1; iArg < arguments.length; iArg++) {
    let viewIndex = arguments[iArg];
    if (!treeView.isContainer(viewIndex)) {
      dump_view_state(aViewWrapper);
      do_throw("Expected isContainer to be true at view index " + viewIndex);
    }
  }
}

/**
 * Given a view wrapper and one or more view indices, verify that there is a
 *  dummy header at each provided index.
 *
 * @param aViewWrapper The view wrapper in question
 * @param ... View indices to check.
 */
function verify_view_row_at_index_is_dummy(aViewWrapper) {
  for (let iArg = 1; iArg < arguments.length; iArg++) {
    let viewIndex = arguments[iArg];
    let flags = aViewWrapper.dbView.getFlagsAt(viewIndex);
    if (!(flags & MSG_VIEW_FLAG_DUMMY)) {
      dump_view_state(aViewWrapper);
      do_throw("Expected a dummy header at view index " + viewIndex);
    }
  }
}

/**
 * Expand all nodes in the view wrapper.  This is a debug helper function
 *  because there's no good reason to have it be on the view wrapper at this
 *  time.  You must call async_view_refresh or async_view_end_update (if you are
 *  within a view update batch) after calling this!
 */
function view_expand_all(aViewWrapper) {
  // we can't use the command because it has assertions about having a tree.
  aViewWrapper._viewFlags |= Ci.nsMsgViewFlagsType.kExpandAll;
}

/**
 * Create a name and address pair where the provided word is part of the name.
 */
function make_person_with_word_in_name(aWord) {
  let dude = gMessageGenerator.makeNameAndAddress();
  return [aWord, dude[1]];
}

/**
 * Create a name and address pair where the provided word is part of the mail
 *  address.
 */
function make_person_with_word_in_address(aWord) {
  let dude = gMessageGenerator.makeNameAndAddress();
  return [dude[0], aWord + "@madeup.nul"];
}
