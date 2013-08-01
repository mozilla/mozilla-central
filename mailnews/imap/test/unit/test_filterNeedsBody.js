/*
 * This file tests the needsBody attribute added to a
 *  custom filter action in bug 555051.
 *
 * Original author: Kent James <kent@caspia.com>
 * adapted from test_imapFilterActions.js
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/IMAPpump.js");

Components.utils.import("resource:///modules/mailServices.js");

// Globals
var gFilter; // a message filter with a subject search
var gAction; // current message action (reused)
const gMessage = "draft1"; // message file used as the test message

// Definition of tests
var tests = [
  setup,
  function NeedsBodyTrue() {
    gAction.type = Ci.nsMsgFilterAction.Custom;
    gAction.customId = 'mailnews@mozilla.org#testOffline';
    actionTestOffline.needsBody = true;
    gAction.strValue = 'true';
    runFilterAction(gFilter, gAction);
  },
  function NeedsBodyFalse() {
    gAction.type = Ci.nsMsgFilterAction.Custom;
    gAction.customId = 'mailnews@mozilla.org#testOffline';
    actionTestOffline.needsBody = false;
    gAction.strValue = 'false';
    runFilterAction(gFilter, gAction);
  },
  teardown
];

function setup() {
  setupIMAPPump();

  // Create a test filter.
  let filterList = gIMAPIncomingServer.getFilterList(null);
  gFilter = filterList.createFilter("test offline");
  let searchTerm = gFilter.createTerm();
  searchTerm.matchAll = true;

  gFilter.appendTerm(searchTerm);
  gFilter.enabled = true;

  // an action that can be modified by tests
  gAction = gFilter.createAction();

  // add the custom actions
  MailServices.filters.addCustomAction(actionTestOffline);
}

// basic preparation done for each test
function runFilterAction(aFilter, aAction) {
  let filterList = gIMAPIncomingServer.getFilterList(null);
  while (filterList.filterCount)
    filterList.removeFilterAt(0);
  if (aFilter) {
    aFilter.clearActionList();
    if (aAction) {
      aFilter.appendAction(aAction);
      filterList.insertFilterAt(0, aFilter);
    }
  }
  gIMAPMailbox.addMessage(new imapMessage(specForFileName(gMessage),
                          gIMAPMailbox.uidnext++, []));
  gIMAPInbox.updateFolderWithListener(null, asyncUrlListener);
  yield false;
}

function teardown() {
  teardownIMAPPump();
}

function run_test() {
  async_run_tests(tests);
}

// custom action to test offline status
actionTestOffline =
{
  id: "mailnews@mozilla.org#testOffline",
  name: "test if offline",
  apply: function(aMsgHdrs, aActionValue, aListener, aType, aMsgWindow)
  {
    for (var i = 0; i < aMsgHdrs.length; i++)
    {
      var msgHdr = aMsgHdrs.queryElementAt(i, Ci.nsIMsgDBHdr);
      let isOffline = msgHdr.flags & Ci.nsMsgMessageFlags.Offline;
      do_check_eq(isOffline, aActionValue == 'true');
    }
  },
  isValidForType: function(type, scope) {return true;},

  validateActionValue: function(value, folder, type) { return null;},

  allowDuplicates: false,

  needsBody: false // set during test setup
};

/*
 * helper functions
 */

// given a test file, return the file uri spec
function specForFileName(aFileName)
{
  let file = do_get_file("../../../data/" + aFileName);
  let msgfileuri = Services.io.newFileURI(file).QueryInterface(Ci.nsIFileURL);
  return msgfileuri.spec;
}
