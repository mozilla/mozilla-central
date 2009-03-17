/*
 * Attempt to test nsMsgDBView and descendents.  Right now this means we:
 * - Ensure sorting and grouping sorta works, including using custom columns.
 *
 * Things we really should do:
 * - Test that secondary sorting works, especially when the primary column is
 *   a custom column.
 */

// this will be migrated out of gloda soon...
do_import_script("../mailnews/db/gloda/test/resources/messageGenerator.js");

var gMessageGenerator;
var gScenarioFactory;

var gTestFolder;

function setup_globals(aNextFunc, aNextThis, aNextArgs) {
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
  updateFolderAndNotify(gTestFolder, aNextFunc, aNextThis, aNextArgs);
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

var MSG_VIEW_FLAG_DUMMY = 0x20000000;

function setup_view(aViewType, aViewFlags) {
  let dbviewContractId = "@mozilla.org/messenger/msgdbview;1?type=" + aViewType;

  // always start out fully expanded
  aViewFlags |= ViewFlags.kExpandAll;

  gDBView = Components.classes[dbviewContractId]
                      .createInstance(Components.interfaces.nsIMsgDBView);
  gDBView.init(null, null, gCommandUpdater);
  var outCount = {};
  gDBView.open(aViewType != "search" ? gTestFolder : null,
               SortType.byDate, SortOrder.ascending, aViewFlags, outCount);
  dump("View Out Count: " + outCount.value + "\n");

  // we need to cram messages into the search via nsIMsgSearchNotify interface
  if (aViewType == "search") {
    let searchNotify = gDBView.QueryInterface(
      Components.interfaces.nsIMsgSearchNotify);
    searchNotify.onNewSearch();
    let enumerator = gTestFolder.msgDatabase.EnumerateMessages();
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
  dump("Ensuring sort order for " + aSortBy + " (Row count: "
       + gTreeView.rowCount + ")\n");
  dump(" cur view flags: " + gDBView.viewFlags + "\n");

  // standard grouping doesn't re-group when you sort.  so we need to actually
  //  re-initialize the view.
  // but search mode is special and does the right thing because asuth didn't
  //  realize that it shouldn't do the right thing, so it can just change the
  //  sort.  (of course, under the hood, it is actually creating a new view...)
  if ((gDBView.viewFlags & ViewFlags.kGroupBySort) &&
      (gDBView.viewType != ViewType.eShowSearch)) {
    // we must close to re-open (or we could just use a new view)
    gDBView.close();
    gDBView.open(gTestFolder, aSortBy, aDirection, gDBView.viewFlags, {});
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

function test_group_by_custom_column() {

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
    test_group_by_custom_column
  ],
  threaded: [
  ]
};

function run_test() {
  do_test_pending();
  setup_globals(actually_run_test, null, []);
}

function actually_run_test() {
  dump("Num Messages: " + gTestFolder.msgDatabase.dBFolderInfo.numMessages + "\n");

  // for each view type...
  for (let [, view_type_and_flags] in Iterator(view_types)) {
    let [view_type, view_flags] = view_type_and_flags;
    dump("===== Testing View Type: " + view_type + " flags: " + view_flags +
         "\n");
    // ... run each test
    setup_view(view_type, view_flags);

    for (let [, testFunc] in Iterator(tests_for_all_views)) {
      testFunc();
    }

    if (tests_for_specific_views[view_type]) {
      for (let [, testFunc] in Iterator(tests_for_specific_views[view_type])) {
        testFunc();
      }
    }
  }
  do_test_finished();
}
