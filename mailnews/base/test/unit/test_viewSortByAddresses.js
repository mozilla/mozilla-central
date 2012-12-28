/*
 * Attempt to test nsMsgDBView's handling of sorting by sender/recipients
 * when using a display name from the address book.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");
load("../../../resources/abSetup.js");

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gMessageGenerator = new MessageGenerator();
var gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

Services.prefs.setBoolPref("mail.showCondensedAddresses", true);

var gTestFolder;

// Setup the display name to be opposite of alphabetic order of e-mail address.
const cards = [
  { email: "aaa@b.invalid", displayName: "4" },
  { email: "ccc@d.invalid", displayName: "3" },
  { email: "eee@f.invalid", displayName: "2" },
  { email: "ggg@h.invalid", displayName: "1" },
];

function run_test() {
  configure_message_injection({mode: "local"});

  // Ensure all the directories are initialised.
  MailServices.ab.directories;

  let ab = MailServices.ab.getDirectory(kPABData.URI);

  function createAndAddCard(element) {
    var card = Cc["@mozilla.org/addressbook/cardproperty;1"]
                 .createInstance(Ci.nsIAbCard);

    card.primaryEmail = element.email;
    card.displayName = element.displayName;

    ab.addCard(card);
  }

  // Add address to addressbook so we can set display name and verify that
  // the view uses the display name for display and sorting.
  cards.forEach(createAndAddCard);

  // build up a couple message with addresses in the ab.
  let messages = [];
  messages = messages.concat(gMessageGenerator.makeMessage({from: ["aaa", "aaa@b.invalid"], to: [["ccc", "ccc@d.invalid"]]}));
  messages = messages.concat(gMessageGenerator.makeMessage({from: ["eee", "eee@f.invalid"], to: [["ggg", "ggg@h.invalid"]]}));

  let msgSet = new SyntheticMessageSet(messages);

  do_test_pending();

  gTestFolder = make_empty_folder();
  add_sets_to_folders(gTestFolder, [msgSet]);
  // - create the view
  setup_view("threaded", ViewFlags.kNone);
  // Check that sorting by sender uses the display name
  gDBView.sort(SortType.byAuthor, SortOrder.ascending);
  let sender1 = gDBView.cellTextForColumn(0, "sender");
  let sender2 = gDBView.cellTextForColumn(1, "sender");

  if (sender1 != 2)
    view_throw("expected sender 1 to be 2");
  if (sender2 != 4)
    view_throw("expected sender 2 to be 4");

  gDBView.sort(SortType.byRecipient, SortOrder.ascending);
  let recip1 = gDBView.cellTextForColumn(0, "recipient");
  let recip2 = gDBView.cellTextForColumn(1, "recipient");

  if (recip1 != 1)
    view_throw("expected recip 1 to be 1");
  if (recip2 != 3)
    view_throw("expected recip 2 to be 3");

  do_test_finished();
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
  },
  summarizeSelection : function() {return false;}
};

var WHITESPACE = "                                              ";
/**
 * Print out the current db view as best we can.
 */
function dump_view_contents() {
  dump("********* Current View State\n");
  for (let iViewIndex = 0; iViewIndex < gTreeView.rowCount; iViewIndex++) {
    let level = gTreeView.getLevel(iViewIndex);
    let viewFlags = gDBView.viewFlags;
    let flags = gDBView.getFlagsAt(iViewIndex);

    let s = WHITESPACE.substr(0, level * 2);
    if (gTreeView.isContainer(iViewIndex))
      s += gTreeView.isContainerOpen(iViewIndex) ? "- " : "+ ";
    else
      s += ". ";
    if (flags & MSG_VIEW_FLAG_DUMMY)
      s += "dummy: ";
    s += gDBView.cellTextForColumn(iViewIndex, "subject") + " " +
         gDBView.cellTextForColumn(iViewIndex, "sender");

    dump(s + "\n");
  }
  dump("********* end view state\n");
}

function view_throw(why) {
  dump_view_contents();
  do_throw(why);
}
var gDBView;
var gTreeView;

var ViewType = Components.interfaces.nsMsgViewType;
var SortType = Components.interfaces.nsMsgViewSortType;
var SortOrder = Components.interfaces.nsMsgViewSortOrder;
var ViewFlags = Components.interfaces.nsMsgViewFlagsType;

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
               SortType.byDate,
               aViewType != "search" ? SortOrder.ascending : SortOrder.descending,
               aViewFlags, outCount);
  dump("  View Out Count: " + outCount.value + "\n");

  gTreeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
}

