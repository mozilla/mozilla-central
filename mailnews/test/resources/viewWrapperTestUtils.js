
Components.utils.import("resource://app/modules/dbViewWrapper.js");
Components.utils.import("resource://app/modules/mailViewManager.js");
Components.utils.import("resource://app/modules/quickSearchManager.js");
Components.utils.import("resource://app/modules/virtualFolderWrapper.js");

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

var gFakeCommandUpdater = {
  updateCommandStatus : function()
  {
  },

  displayMessageChanged : function(aFolder, aSubject, aKeywords)
  {
  },

  updateNextMessageAfterDelete : function()
  {
  }
};

var gMockViewWrapperListener = {
  __proto__: IDBViewWrapperListener.prototype,
  shouldUseMailViews: true,
  shouldDeferMessageDisplayUntilAfterServerConnect: false,
  messenger: null,
  // use no message window!
  msgWindow: null,
  threadPaneCommandUpdater: gFakeCommandUpdater,
  // event handlers
  onAllMessagesLoaded: function() {
    dump("ALL LOADED\n");
    if (this.pendingLoad) {
      this.pendingLoad = false;
      async_driver();
    }
  },
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

  postTest: function () {
    // close all the views we opened
    this.active_view_wrappers.forEach(function (wrapper) {
      wrapper.close();
    });
    // verify that the notification helper has no outstanding listeners.
    if (IDBViewWrapperListener.prototype._FNH.haveListeners())
      do_throw("FolderNotificationHelper has listeners, but should not.");
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
async_test_runner_register_helper(VWTU_testHelper);

function make_view_wrapper() {
  let wrapper = new DBViewWrapper(gMockViewWrapperListener);
  VWTU_testHelper.active_view_wrappers.push(wrapper);
  return wrapper;
}

/**
 * Open a folder for view display.  This is an async operation, relying on the
 *  onAllMessagesLoaded notification to get he test going again.
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

function async_view_quick_search(aViewWrapper, aSearchMode, aSearchString) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.search.quickSearch(aSearchMode, aSearchString);
  return false;
}

function async_view_refresh(aViewWrapper) {
  aViewWrapper.listener.pendingLoad = true;
  aViewWrapper.refresh();
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

var gNextUniqueFolderId = 0;
/**
 * Create and return an empty local folder.  If you want to delete this folder
 *  you must call delete_folder to kill it!
 */
function make_empty_folder() {
  let name = "gabba" + gNextUniqueFolderId++;
  let testFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder(name);
  // track it for cleanup or error reporting (if the test hangs)
  VWTU_testHelper.active_real_folders.push(testFolder);
  return testFolder;
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
 */
function async_delete_folder(aFolder, aViewWrapper) {
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
  aFolder.emptyTrash(null, null);
  return false;
}
var delete_folder = async_delete_folder;

SEARCH_TERM_MAP_HELPER = {
  subject: Components.interfaces.nsMsgSearchAttrib.Subject,
  body: Components.interfaces.nsMsgSearchAttrib.Body,
  from: Components.interfaces.nsMsgSearchAttrib.Sender,
  to: Components.interfaces.nsMsgSearchAttrib.To,
  cc: Components.interfaces.nsMsgSearchAttrib.CC,
  recipient: Components.interfaces.nsMsgSearchAttrib.ToOrCC,
  involves: Components.interfaces.nsMsgSearchAttrib.AllAddresses,
  age: Components.interfaces.nsMsgSearchAttrib.AgeInDays,
  tags: Components.interfaces.nsMsgSearchAttrib.Keywords,
};
/**
 * Create and return a virtual folder.
 *
 * @param aFolders The real folders this virtual folder should draw from.
 * @param aSearchDef The search definition to use to build the list of search
 *     terms that populate this virtual folder.  Keys should be stuff from
 *     SEARCH_TERM_MAP_HELPER and values should be strings to search for within
 *     those attribute things.
 * @param aBooleanAnd Should the search terms be and-ed together.
 */
function make_virtual_folder(aFolders, aSearchDef, aBooleanAnd) {
  let name = "virt" + gNextUniqueFolderId++;

  let terms = [];
  let termCreator = Components.classes["@mozilla.org/messenger/searchSession;1"]
                              .createInstance(Ci.nsIMsgSearchSession);
  for each (let [key, val] in Iterator(aSearchDef)) {
    let term = termCreator.createTerm();
    let value = term.value;
    value.str = val;
    term.value = value;
    term.attrib = SEARCH_TERM_MAP_HELPER[key];
    term.op = Components.interfaces.nsMsgSearchOp.Contains;
    term.booleanAnd = Boolean(aBooleanAnd);
    terms.push(term);
  }
  // create an ALL case if we didn't add any terms
  if (terms.length == 0) {
    let term = termCreator.createTerm();
    term.matchAll = true;
    terms.push(term);
  }

  let wrapped = VirtualFolderHelper.createNewVirtualFolder(
    name, gLocalIncomingServer.rootMsgFolder, aFolders, terms,
    /* online */ false);
  // track it for cleanup or error reporting (if the test hangs)
  VWTU_testHelper.active_virtual_folders.push(wrapped.virtualFolder);
  return wrapped.virtualFolder;
}

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
    s += msgHdr.mime2DecodedSubject;
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
      do_throw("view contains header that should not be present!");
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
      do_throw("view does not contain a header that should be present!");
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
 * Create a new local folder, populating it with messages according to the set
 *  definition provided.
 *
 * @param aSynSetDefs A synthetic set definition, as appropriate to pass to
 *     make_new_sets_in_folder.
 * @return A list whose first element is the nsIMsgLocalMailFolder created and
 *     whose subsequent items are the SyntheticMessageSets used to populate the
 *     folder (as returned by make_new_sets_in_folder).
 */
function make_folder_with_sets(aSynSetDefs) {
  let msgFolder = make_empty_folder();
  let results = make_new_sets_in_folder(msgFolder, aSynSetDefs);
  results.unshift(msgFolder);
  return results;
}

/**
 * Create multiple new local folders, populating them with messages according to
 *  the set definitions provided.  Differs from make_folder_with_sets by taking
 *  the number of folders to create and return the list of created folders as
 *  the first element in the returned list.  This method is simple enough that
 *  the limited code duplication is deemed acceptable in support of readability.
 *
 * @param aSynSetDefs A synthetic set definition, as appropriate to pass to
 *     make_new_sets_in_folder.
 * @return A list whose first element is the nsIMsgLocalMailFolder created and
 *     whose subsequent items are the SyntheticMessageSets used to populate the
 *     folder (as returned by make_new_sets_in_folder).
 */
function make_folders_with_sets(aFolderCount, aSynSetDefs) {
  let msgFolders = [];
  for (let i = 0; i < aFolderCount; i++)
    msgFolders.push(make_empty_folder());
  let results = make_new_sets_in_folders(msgFolders, aSynSetDefs);
  results.unshift(msgFolders);
  return results;
}

var gMessageGenerator = new MessageGenerator();
var gMessageScenarioFactory = new MessageScenarioFactory(gMessageGenerator);
/**
 * Given one or more existing local folder, create new message sets and add them
 *  to the folders using
 *
 * @param aMsgFolders A single nsIMsgLocalMailFolder or a list of them.  The
 *     synthetic messages will be added to the folder(s).
 * @param aSynSetDefs Either an integer describing the number of sets of
 *     messages to create (using default parameters), or a list of set
 *     definition objects as defined by MessageGenerator.makeMessages.
 * @return A list of SyntheticMessageSet objects, each corresponding to the
 *     entry in aSynSetDefs (or implied if an integer was passed).
 */
function make_new_sets_in_folders(aMsgFolders, aSynSetDefs) {
  // is it just a count of the number of plain vanilla sets to create?
  if (typeof(aSynSetDefs) == "number") {
    let setCount = aSynSetDefs;
    aSynSetDefs = [];
    for (let iSet = 0; iSet < setCount; iSet++)
      aSynSetDefs.push({});
  }
  // now it must be a list of set descriptors

  // - create the synthetic message sets
  let messageSets = [];
  for each (let [, synSetDef] in Iterator(aSynSetDefs)) {
    let messages = gMessageGenerator.makeMessages(synSetDef);
    messageSets.push(new SyntheticMessageSet(messages));
  }

  // - add the messages to the folders (interleaving them)
  add_sets_to_folders(aMsgFolders, messageSets);

  return messageSets;
}
/** singular folder alias for single-folder users' readability */
let make_new_sets_in_folder = make_new_sets_in_folders;

/**
 * An iterator that generates an infinite sequence of its argument.  So
 *  _looperator(1, 2, 3) will generate the iteration stream: [1, 2, 3, 1, 2, 3,
 *  1, 2, 3, ...].  For use by add_sets_across_folders.
 */
function _looperator(aList) {
  if (aList.length == 0)
    throw Exception("aList must have at least one item!");

  let i = 0, length = aList.length;
  while (true) {
    yield aList[i];
    i = (i + 1) % length;
  }
}

/**
 * Spreads the messages in aMessageSets across the folders in aMsgFolders.  Each
 *  message set is spread in a round-robin fashion across all folders.  At the
 *  same time, each message-sets insertion is interleaved with the other message
 *  sets.  This distributes message across multiple folders for useful
 *  cross-folder threading testing (via the round robin) while also hopefully
 *  avoiding making things pathologically easy for the code under test (by way
 *  of the interleaving.)
 *
 * For example, given the following 2 input message sets:
 *  message set 'lower': [a b c d e f]
 *  message set 'upper': [A B C D E F G H]
 *
 * across 2 folders:
 *  folder 1: [a A c C e E G]
 *  folder 2: [b B d D f F H
 * across 3 folders:
 *  folder 1: [a A d D G]
 *  folder 2: [b B e E H]
 *  folder 3: [c C f F]
 *
 * @param aMsgFolders An nsIMsgLocalMailFolder to add the message sets to or a
 *     list of them.
 * @param aMessageSets A list of SyntheticMessageSets.
 */
function add_sets_to_folders(aMsgFolders, aMessageSets) {
  if (!('length' in aMsgFolders))
    aMsgFolders = [aMsgFolders];

  for each (let [, folder] in Iterator(aMsgFolders)) {
    if (!(folder instanceof Components.interfaces.nsIMsgLocalMailFolder))
      throw Exception("All folders in aMsgFolders must be local folders!");
  }

  let iterFolders = _looperator(aMsgFolders);

  let iPerSet = 0, folder = iterFolders.next();
  // loop, incrementing our subscript until all message sets are out of messages
  let didSomething;
  do {
    didSomething = false;
    // for each message set, if it is not out of messages, add the message
    for each (let [, messageSet] in Iterator(aMessageSets)) {
      if (iPerSet < messageSet.synMessages.length) {
        messageSet.addMessageToFolderByIndex(folder, iPerSet);
        didSomething = true;
      }
    }
    iPerSet++;
    folder = iterFolders.next();
  } while (didSomething);
}
/** singular function name for understandability of single-folder users */
let add_sets_to_folder = add_sets_to_folders;

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