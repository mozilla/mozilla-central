/*
 * Attempt to test nsMsgDBView and descendents.  Right now this means we:
 * - Ensure sorting and grouping sorta works, including using custom columns.
 *
 * Things we really should do:
 * - Test that secondary sorting works, especially when the primary column is
 *   a custom column.
 */

// this will be migrated out of gloda soon...
load("../../mailnews/resources/messageGenerator.js");
load("../../mailnews/resources/asyncTestUtils.js");

var gMessageGenerator;
var gScenarioFactory;

var gTestFolder;

function setup_globals(aNextFunc) {
  loadLocalMailAccount();
  gMessageGenerator = new MessageGenerator();
  gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

  // build up a diverse list of messages
  let messages = [];
  messages = messages.concat(gScenarioFactory.directReply(10));
  // the message generator uses a constanty incrementing counter, so we need to
  //  mix up the order of messages ourselves to ensure that the timestamp
  //  ordering is not already in order.  (a poor test of sorting otherwise.)
  messages = gScenarioFactory.directReply(6).concat(messages);
  messages = messages.concat(gScenarioFactory.fullPyramid(3,3));
  messages = messages.concat(gScenarioFactory.siblingsMissingParent());
  messages = messages.concat(gScenarioFactory.missingIntermediary());

  let mboxName = "dbviewy";
  writeMessagesToMbox(messages, gProfileDir,
                      "Mail", "Local Folders", mboxName);
  gTestFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder(mboxName);
  updateFolderAndNotify(gTestFolder, async_driver);
  return false;
}

var gCommandUpdater = {
  updateCommandStatus : function()
  {
    // the back end is smart and is only telling us to update command status
    // when the # of items in the selection has actually changed.
  },

  displayMessageChanged : function(aFolder, aSubject, aKeywords)
  {
  },

  updateNextMessageAfterDelete : function()
  {
  }
};

var gNextUniqueFolderId = 0;
function make_empty_folder() {
  let name = "gabba" + gNextUniqueFolderId++;
  let testFolder = gLocalIncomingServer.rootMsgFolder.addSubfolder(name);
  return testFolder;
}

/**
 * Create a synthetic message by passing the provided aMessageArgs to
 *  the message generator, then add the resulting message to the given
 *  folder (or gTestFolder if no folder is provided).
 */
function make_and_add_message(aMessageArgs, aFolder) {
  // create the message
  let synMsg = gMessageGenerator.makeMessage(aMessageArgs);

  // do it for the side-effect
  if (aFolder == null)
    aFolder = gTestFolder;
  aFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
  aFolder.addMessage(synMsg.toMboxString());

  return synMsg;
}

var WHITESPACE = "                                              ";
/**
 * Print out the current db view as best we can.
 *
 * Because nsITreeColumns are hard (impossible?) to create in an xpcshell test
 *  and GetCellText requires a real one (because it uses GetIdConst which is not
 *  scriptable), we can't actually get at the column text.  So we approximate
 *  it.  (The right thing to do is modify nsMsgDBView and children to provide a
 *  more testable way to get at the data.)
 */
function dump_view_contents() {
  dump("********* Current View State\n");
  for (let iViewIndex = 0; iViewIndex < gTreeView.rowCount; iViewIndex++) {
    let level = gTreeView.getLevel(iViewIndex);
    let viewFlags = gDBView.viewFlags;
    let flags = gDBView.getFlagsAt(iViewIndex);
    let msgHdr = gDBView.getMsgHdrAt(iViewIndex);

    let s = WHITESPACE.substr(0, level * 2);
    if (gTreeView.isContainer(iViewIndex))
      s += gTreeView.isContainerOpen(iViewIndex) ? "- " : "+ ";
    else
      s += ". ";
    //s += gTreeView.getCellText(iViewIndex, )
    if (flags & MSG_VIEW_FLAG_DUMMY)
      s += "dummy: ";
    s += msgHdr.mime2DecodedSubject;

    dump(s + "\n");
  }
  dump("********* end view state\n");
}

function view_throw(why) {
  dump_view_contents();
  do_throw(why);
}

/**
 * Throw if gDBView has any rows.
 */
function assert_view_empty() {
  if (gTreeView.rowCount != 0)
    view_throw("Expected view to be empty, but it was not! (" +
             gTreeView.rowCount + " rows)");
}

/**
 * Throw if gDBView does not have aCount rows.
 */
function assert_view_row_count(aCount) {
  if (gTreeView.rowCount != aCount)
    view_throw("Expected view to have " + aCount + " rows, but it had " +
             gTreeView.rowCount + " rows!");
}

/**
 * Throw if any of the arguments (as view indices) do not correspond to dummy
 *  rows in gDBView.
 */
function assert_view_index_is_dummy() {
  for each (let [, viewIndex] in Iterator(arguments)) {
    let flags = gDBView.getFlagsAt(viewIndex);
    if (!(flags & MSG_VIEW_FLAG_DUMMY))
      view_throw("Expected index " + viewIndex + " to be a dummy!");
  }
}

/**
 * Throw if any of the arguments (as view indices) correspond to dummy rows in
 *  gDBView.
 */
function assert_view_index_is_not_dummy() {
  for each (let [, viewIndex] in Iterator(arguments)) {
    let flags = gDBView.getFlagsAt(viewIndex);
    if (flags & MSG_VIEW_FLAG_DUMMY)
      view_throw("Expected index " + viewIndex + " to not be a dummy!");
  }
}

/**
 * Given a message, assert that it is present at the given indices.
 *
 * Usage:
 *  assert_view_message_at_indices(synMsg, 0);
 *  assert_view_message_at_indices(synMsg, 0, 1);
 *  assert_view_message_at_indices(aMsg, 0, bMsg, 1);
 */
function assert_view_message_at_indices() {
  let curHdr;
  for each (let [, thing] in Iterator(arguments)) {
    // index
    if (typeof(thing) == "number") {
      let hdrAt = gDBView.getMsgHdrAt(thing);
      if (curHdr != hdrAt) {
        view_throw("Expected hdr at " + thing + " to be " +
                  curHdr.messageKey + ":" +
                   curHdr.mime2DecodedSubject.substr(0, 30) + " not " +
                  hdrAt.messageKey + ":" +
                    hdrAt.mime2DecodedSubject.substr(0, 30));
      }
    }

    // synthetic message, get the header...
    else
      curHdr = gTestFolder.msgDatabase.getMsgHdrForMessageID(thing.messageId);
  }
}

var authorFirstLetterCustomColumn = {
  getCellText: function(row, col) {
    let folder = this.dbView.getFolderForViewIndex(row);
    let msgHdr = this.dbView.getMsgHdrAt(row);
    return msgHdr.mime2DecodedAuthor.substr(0, 1).toUpperCase() || "?";
  },
  getSortStringForRow: function(msgHdr) {
    return msgHdr.mime2DecodedAuthor.substr(0, 1).toUpperCase() || "?";
  },
  isString: function() {
    return true;
  },

  getCellProperties:   function(row, col, props){},
  getRowProperties:    function(row, props){},
  getImageSrc:         function(row, col) {return null;},
  getSortLongForRow:   function(hdr) {return 0;}
};

var gDBView;
var gTreeView;

var ViewType = Components.interfaces.nsMsgViewType;
var SortType = Components.interfaces.nsMsgViewSortType;
var SortOrder = Components.interfaces.nsMsgViewSortOrder;
var ViewFlags = Components.interfaces.nsMsgViewFlagsType;
var MsgFlags = Components.interfaces.nsMsgMessageFlags;

var MSG_VIEW_FLAG_DUMMY = 0x20000000;
var MSG_VIEW_FLAG_HASCHILDREN = 0x40000000;
var MSG_VIEW_FLAG_ISTHREAD = 0x8000000;

function setup_view(aViewType, aViewFlags, aTestFolder) {
  let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=" + aViewType;

  if (aTestFolder == null)
    aTestFolder = gTestFolder;

  // always start out fully expanded
  aViewFlags |= ViewFlags.kExpandAll;

  gDBView = Components.classes[dbviewContractId]
                      .createInstance(Components.interfaces.nsIMsgDBView);
  gDBView.init(null, null, gCommandUpdater);
  var outCount = {};
  gDBView.open(aViewType != "search" ? aTestFolder : null,
               SortType.byDate, SortOrder.ascending, aViewFlags, outCount);
  dump("  View Out Count: " + outCount.value + "\n");

  // we need to cram messages into the search via nsIMsgSearchNotify interface
  if (aViewType == "search") {
    let searchNotify = gDBView.QueryInterface(
      Components.interfaces.nsIMsgSearchNotify);
    searchNotify.onNewSearch();
    let enumerator = aTestFolder.msgDatabase.EnumerateMessages();
    while (enumerator.hasMoreElements()) {
      let msgHdr = enumerator.getNext().QueryInterface(
        Components.interfaces.nsIMsgDBHdr);
      searchNotify.onSearchHit(msgHdr, msgHdr.folder);
    }
    searchNotify.onSearchDone(Components.results.NS_OK);
  }

  gDBView.addColumnHandler("authorFirstLetterCol",
                           authorFirstLetterCustomColumn);
  // XXX this sets the custom column to use for sorting by the custom column.
  // It has been argued (and is generally accepted) that this should not be
  // so limited.
  gDBView.curCustomColumn = "authorFirstLetterCol";

  gTreeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
}

/**
 * Comparison func for built-in types (including strings, so no subtraction.)
 */
function generalCmp(a, b) {
  if (a < b)
    return -1;
  else if (a > b)
    return 1;
  else
    return 0;
}

/**
 * Check that sort order and grouping logic (if applicable) are doing the right
 *  thing.
 *
 * In the case of groups (indicated by dummy headers), we want to ignore the
 *  dummies and 1) make sure all the values in the group have the same value,
 *  2) verify that the headers meet our total ordering.
 * In the case of threads, we want to ensure that each level of the hierarchy
 *  meets our ordering demands, recursing into children.  Because the tree
 *  representation is rather quite horrible, the easiest thing for us is to
 *  track a per-level list of comparison values we have seen, nuking older
 *  values when changes in levels indicate closure of a level.  (Namely,
 *  if we see a node at level N, then all levels >N are no longer valid.)
 *
 * @param aSortBy The sort type.
 * @param aDirection The sort direction.
 * @param aKeyOrValueGetter A string naming the attribute on the message header
 *     to retrieve, or if that is not sufficient a function that takes a
 *     message header and returns the sort value for it.
 * @param aGetGroupValue An optional function that takes a message header and
 *     returns the grouping value for the header.  If omitted, it is assumed
 *     that the sort value is the grouping value.
 */
function ensure_view_ordering(aSortBy, aDirection, aKeyOrValueGetter,
    aGetGroupValue) {
  if (!gTreeView.rowCount)
    do_throw("There are no rows in my folder! I can't test anything!");
  dump("  Ensuring sort order for " + aSortBy + " (Row count: "
       + gTreeView.rowCount + ")\n");
  dump("    cur view flags: " + gDBView.viewFlags + "\n");

  // standard grouping doesn't re-group when you sort.  so we need to actually
  //  re-initialize the view.
  // but search mode is special and does the right thing because asuth didn't
  //  realize that it shouldn't do the right thing, so it can just change the
  //  sort.  (of course, under the hood, it is actually creating a new view...)
  if ((gDBView.viewFlags & ViewFlags.kGroupBySort) &&
      (gDBView.viewType != ViewType.eShowSearch)) {
    // we must close to re-open (or we could just use a new view)
    let msgFolder = gDBView.msgFolder;
    gDBView.close();
    gDBView.open(msgFolder, aSortBy, aDirection, gDBView.viewFlags, {});
  }
  else {
    gDBView.sort(aSortBy, aDirection);
  }

  let comparisonValuesByLevel = [];
  let expectedComparison = (aDirection == SortOrder.ascending ? 1 : -1);
  let comparator = generalCmp;

  let dummyCount = 0, emptyDummyCount = 0;

  let valueGetter = (typeof(aKeyOrValueGetter) == "string") ?
    function(msgHdr) { return msgHdr[aKeyOrValueGetter]; } : aKeyOrValueGetter;
  let groupValueGetter = aGetGroupValue || valueGetter;

  // don't do group testing until we see a dummy header (which we will see
  //  before we see any grouped headers, so it's fine to do this)
  let inGroup = false;
  // the current grouping value for the current group.  this allows us to
  //  detect erroneous grouping of different group values together.
  let curGroupValue = null;
  // the set of group values observed before the current group.  this allows
  //  us to detect improper grouping where there are multiple groups with the
  //  same grouping value.
  let previouslySeenGroupValues = {};

  for (let iViewIndex = 0; iViewIndex < gTreeView.rowCount; iViewIndex++) {
    let msgHdr = gDBView.getMsgHdrAt(iViewIndex);
    let msgViewFlags = gDBView.getFlagsAt(iViewIndex);

    // ignore dummy headers; testing grouping logic happens elsewhere
    if (msgViewFlags & MSG_VIEW_FLAG_DUMMY) {
      if (dummyCount && curGroupValue == null)
        emptyDummyCount++;
      dummyCount++;
      if (curGroupValue != null)
        previouslySeenGroupValues[curGroupValue] = true;
      curGroupValue = null;
      inGroup = true;
      continue;
    }

    // level is 0-based
    let level = gTreeView.getLevel(iViewIndex);
    // nuke existing comparison levels
    if (level < comparisonValuesByLevel.length - 1)
      comparisonValuesByLevel.splice(level);

    // get the value for comparison
    let curValue = valueGetter(msgHdr);
    if (inGroup) {
      let groupValue = groupValueGetter(msgHdr);
      if (groupValue in previouslySeenGroupValues)
        do_throw("Group value " + groupValue + " observed in more than one " +
                 "group!");
      if (curGroupValue == null)
        curGroupValue = groupValue;
      else if (curGroupValue != groupValue)
        do_throw("Inconsistent grouping! " + groupValue + " != " +
                 curGroupValue);
    }

    // is this level new to our comparisons?  then track it...
    if (level >= comparisonValuesByLevel.length) {
      // null-fill any gaps (due to, say, dummy nodes)
      while (comparisonValuesByLevel.length <= level)
        comparisonValuesByLevel.push(null);
      comparisonValuesByLevel.push(curValue);
    }
    else { // otherwise compare it
      let prevValue = comparisonValuesByLevel[level-1];
      let cmpResult = comparator(curValue, prevValue);
      if (cmpResult && cmpResult != expectedComparison)
        do_throw("Ordering failure on key " + aKey + ". " +
                 curValue + " should have been " +
                 (expectedComparison == 1 ? ">=" : "<=") + " " +
                 prevValue + " but was not.");
    }
  }

  if (inGroup && curGroupValue == null)
    emptyDummyCount++;
  if (dummyCount)
    dump("  saw " + dummyCount + " dummy headers (" + emptyDummyCount +
         " empty).\n");
}

/**
 * Test sorting functionality.
 */
function test_sort_columns() {
  ensure_view_ordering(SortType.byDate, SortOrder.ascending, 'date',
    function getDateAgeBucket(msgHdr) {
      // so, this is a cop-out, but we know that the date age bucket for our
      //  generated messages is always more than 2-weeks ago!
      return 5;
    });
  // (note, subject doesn't use dummy groups and so won't have grouping tested)
  ensure_view_ordering(SortType.bySubject, SortOrder.ascending, 'mime2DecodedSubject');
  ensure_view_ordering(SortType.byAuthor, SortOrder.ascending, 'mime2DecodedAuthor');
  // Id
  // Thread
  // Priority
  // Status
  // Size
  // Flagged
  // Unread
  ensure_view_ordering(SortType.byRecipient, SortOrder.ascending, 'mime2DecodedRecipients');
  // Location
  // Tags
  // JunkStatus
  // Attachments
  // Account
  // Custom
  ensure_view_ordering(SortType.byCustom, SortOrder.ascending,
    function (msgHdr) {
      return authorFirstLetterCustomColumn.getSortStringForRow(msgHdr);
    });
  // Received
}

function test_group_dummies_under_mutation_by_date() {
  // - start with an empty folder
  gTestFolder = make_empty_folder();

  // - create the view
  setup_view("group", ViewFlags.kGroupBySort);
  gDBView.sort(SortType.byDate, SortOrder.ascending);

  // - ensure it's empty
  assert_view_empty();

  // - add a message from today
  let smsg = make_and_add_message({age: {hours: 1}});

  // - make sure the message and a dummy appear
  assert_view_row_count(2);
  assert_view_index_is_dummy(0);
  assert_view_index_is_not_dummy(1);
  assert_view_message_at_indices(smsg, 0, 1);

  // - delete that message from today
  yield async_delete_messages(smsg);

  // - make sure the message and dummy disappear
  assert_view_empty();

  // - add two messages from today
  let newer = make_and_add_message({age: {hours: 1}});
  let older = make_and_add_message({age: {hours: 2}});

  // - sanity check addition
  assert_view_row_count(3); // 2 messages + 1 dummy
  assert_view_index_is_dummy(0);
  assert_view_index_is_not_dummy(1, 2);
  // the dummy should be based off the newer guy
  assert_view_message_at_indices(newer, 0, 1);
  assert_view_message_at_indices(older, 2);

  // - delete the message right under the dummy
  // (this will be the newer one)
  yield async_delete_messages(newer);

  // - ensure we still have the dummy and the right child node
  assert_view_row_count(2);
  assert_view_index_is_dummy(0);
  assert_view_index_is_not_dummy(1);
  // now the dummy should be based off the remaining older one
  assert_view_message_at_indices(older, 0, 1);
}

var view_types = [
  ["group", ViewFlags.kGroupBySort],
  ["threaded", ViewFlags.kThreadedDisplay],
  ["search", ViewFlags.kGroupBySort],
  ["search", ViewFlags.kThreadedDisplay]
];

var tests_for_all_views = [
  test_sort_columns
];

var tests_for_specific_views = {
  group: [
    test_group_dummies_under_mutation_by_date
  ],
  threaded: [
  ]
};

function run_test() {
  do_test_pending();
  async_run({func: actually_run_test});
}

function actually_run_test() {
  dump("in actually_run_test\n");
  yield async_run({func: setup_globals});

  dump("Num Messages: " + gTestFolder.msgDatabase.dBFolderInfo.numMessages + "\n");

  // for each view type...
  for (let [, view_type_and_flags] in Iterator(view_types)) {
    let [view_type, view_flags] = view_type_and_flags;
    dump("===== Testing View Type: " + view_type + " flags: " + view_flags +
         "\n");

    // ... run each test
    setup_view(view_type, view_flags);

    for (let [, testFunc] in Iterator(tests_for_all_views)) {
      dump("=== Running generic test: " + testFunc.name + "\n");
      yield async_run({func: testFunc});
    }

    if (tests_for_specific_views[view_type]) {
      for (let [, testFunc] in Iterator(tests_for_specific_views[view_type])) {
        dump("=== Running view-specific test: " + testFunc.name + "\n");
        yield async_run({func: testFunc});
      }
    }
  }
  do_test_finished();
}
