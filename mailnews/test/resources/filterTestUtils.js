// Utility functions for testing interactions with filters.

var contains = Ci.nsMsgSearchOp.Contains;
// This maps strings to a filter attribute (excluding the parameter)
var ATTRIB_MAP = {
  // Template : [attrib, op, field of value, otherHeader]
  "subject" : [Ci.nsMsgSearchAttrib.Subject, contains, "str", null],
  "from" : [Ci.nsMsgSearchAttrib.Sender, contains, "str", null],
  "date" : [Ci.nsMsgSearchAttrib.Date, Ci.nsMsgSearchOp.Is, "date", null],
  "size" : [Ci.nsMsgSearchAttrib.Size, Ci.nsMsgSearchOp.Is, "size", null],
  "message-id" : [Ci.nsMsgSearchAttrib.OtherHeader+1, contains, "str",
                  "Message-ID"],
  "user-agent" : [Ci.nsMsgSearchAttrib.OtherHeader+2, contains, "str",
                  "User-Agent"]
};
// And this maps strings to filter actions
var ACTION_MAP = {
  // Template : [action, auxiliary attribute field, auxiliary value]
  "priority" : [Ci.nsMsgFilterAction.ChangePriority, "priority", 6],
  "delete" : [Ci.nsMsgFilterAction.Delete],
  "read" : [Ci.nsMsgFilterAction.MarkRead],
  "unread" : [Ci.nsMsgFilterAction.MarkUnread],
  "kill" : [Ci.nsMsgFilterAction.KillThread],
  "watch" : [Ci.nsMsgFilterAction.WatchThread],
  "flag" : [Ci.nsMsgFilterAction.MarkFlagged],
  "stop": [Ci.nsMsgFilterAction.StopExecution],
  "tag" : [Ci.nsMsgFilterAction.AddTag, "strValue", "tag"]
};

/**
 * Creates a filter and appends it to the nsIMsgFilterList.
 *
 * @param list    An nsIMsgFilter to which the new filter will be appended.
 * @param trigger A key of ATTRIB_MAP that represents the filter trigger.
 * @param value   The value of the filter trigger.
 * @param action  A key of ACTION_MAP that represents the action to be taken.
 */
function createFilter(list, trigger, value, action) {
  var filter = list.createFilter(trigger + action + "Test");
  filter.filterType = Ci.nsMsgFilterType.NewsRule;

  var searchTerm = filter.createTerm();
  searchTerm.matchAll = false;
  if (trigger in ATTRIB_MAP) {
    let information = ATTRIB_MAP[trigger];
    searchTerm.attrib = information[0];
    if (information[3] != null)
      searchTerm.arbitraryHeader = information[3];
    searchTerm.op = information[1];
    var oldValue = searchTerm.value;
    oldValue.attrib = information[0];
    oldValue[information[2]] = value;
    searchTerm.value = oldValue;
  } else {
    throw "Unknown trigger " + trigger;
  }
  searchTerm.booleanAnd = true;
  filter.appendTerm(searchTerm);

  var filterAction = filter.createAction();
  if (action in ACTION_MAP) {
    let information = ACTION_MAP[action];
    filterAction.type = information[0];
    if (1 in information)
      filterAction[information[1]] = information[2];
  } else {
    throw "Unknown action " + action;
  }
  filter.appendAction(filterAction);

  filter.enabled = true;

  // Add to the end
  list.insertFilterAt(list.filterCount, filter);
}

