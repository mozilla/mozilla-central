/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * tests post-plugin message filters as implemented in bug 198100
 */

load("../../../resources/POP3pump.js");

// Globals

const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                     .getService(Ci.nsIMsgDBService);

// command functions for test data
const kTrain = 0;  // train a file as a trait
const kClass = 1;  // classify files with traits

var gTest; // currently active test
var gMsgHdr; // current message header

const kJunkFile = "../../../data/bugmail1";
const kGoodFile = "../../../data/draft1";

const kPriorityLow = 3;
const kPriorityHigh = 5;
var gInboxListener; // database listener object

var gTests =
[
  // train two different messages
  {
    command: kTrain,
    fileName: kGoodFile,
    traitId: MailServices.junk.GOOD_TRAIT,
  },
  {
    command: kTrain,
    fileName: kJunkFile,
    traitId: MailServices.junk.JUNK_TRAIT,
  },
  // test a filter that acts on GOOD messages
  {
    command: kClass,
    fileName: kGoodFile,
    test: function testClassGood() {
      do_check_eq(kPriorityHigh, gMsgHdr.priority);
    }
  },
  // test a filter that acts on JUNK messages
  {
    command: kClass,
    fileName: kJunkFile,
    test: function testClassJunk() {
      do_check_eq(kPriorityLow, gMsgHdr.priority);
    }
  },
  /**/
]

// main test
function run_test()
{

  // Setup some incoming filters, setting junk priority low, and good high.

  // Can't use the fake server, must use the deferredTo local server!
  let filterList = localAccountUtils.incomingServer.getFilterList(null);

  // junkIsLow filter
  let filter = filterList.createFilter("junkIsLow");
  let searchTerm = filter.createTerm();
  searchTerm.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  let value = searchTerm.value;
  value.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  value.junkStatus = MailServices.junk.JUNK;
  searchTerm.value = value;
  searchTerm.op = Ci.nsMsgSearchOp.Is;
  searchTerm.booleanAnd = false;
  filter.appendTerm(searchTerm);
  let action = filter.createAction();
  action.type = Ci.nsMsgFilterAction.ChangePriority;
  action.priority = kPriorityLow;
  filter.appendAction(action);
  filter.filterType = Ci.nsMsgFilterType.PostPlugin;
  filter.enabled = true;
  filterList.insertFilterAt(0, filter);

  // goodIsHigh filter
  let filter = filterList.createFilter("goodIsHigh");
  let searchTerm = filter.createTerm();
  searchTerm.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  let value = searchTerm.value;
  value.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  value.junkStatus = MailServices.junk.GOOD;
  searchTerm.value = value;
  searchTerm.op = Ci.nsMsgSearchOp.Is;
  searchTerm.booleanAnd = false;
  filter.appendTerm(searchTerm);
  let action = filter.createAction();
  action.type = Ci.nsMsgFilterAction.ChangePriority;
  action.priority = kPriorityHigh;
  filter.appendAction(action);
  filter.filterType = Ci.nsMsgFilterType.PostPlugin;
  filter.enabled = true;
  filterList.insertFilterAt(1, filter);

  // setup a db listener to grab the message headers. There's probably an
  // easier way, but this works.
  gInboxListener = new DBListener();
  gDbService.registerPendingListener(localAccountUtils.inboxFolder, gInboxListener);

  do_test_pending();

  startCommand();
}

function endTest()
{
  // Cleanup
  dump(" Exiting mail tests\n");
  if (gInboxListener)
    gDbService.unregisterPendingListener(gInboxListener);

  gPOP3Pump = null;

  do_test_finished(); // for the one in run_test()
}

var classifyListener =
{
  //nsIMsgTraitClassificationListener implementation
  onMessageTraitsClassified: function(aMsgURI, {}, aTraits, aPercents)
  {
    //print("Message URI is " + aMsgURI);
    if (!aMsgURI)
      return; //ignore end-of-batch signal

    startCommand();
  }
};

// nsIDBChangeListener implementation.
function DBListener()
{
}

DBListener.prototype =
{
  onHdrFlagsChanged:
    function onHdrFlagsChanged(aHdrChanged, aOldFlags, aNewFlags, aInstigator)
    {
    },

  onHdrDeleted:
    function onHdrDeleted(aHdrChanged, aParentKey, Flags, aInstigator)
    {
    },

  onHdrAdded:
    function onHdrAdded(aHdrChanged, aParentKey, aFlags, aInstigator)
    {
      gMsgHdr = aHdrChanged;
    },

  onParentChanged:
    function onParentChanged(aKeyChanged, oldParent, newParent, aInstigator)
    {
    },

  onAnnouncerGoingAway:
    function onAnnouncerGoingAway(instigator)
    {
      if (gInboxListener)
      {
        try {
          IMAPPump.inbox.msgDatabase.RemoveListener(gInboxListener);
        }
        catch (e) {dump(" listener not found\n");}
      }
    },

  onReadChanged:
    function onReadChanged(aInstigator)
    {
    },

  onJunkScoreChanged:
    function onJunkScoreChanged(aInstigator)
    {
    },

  onHdrPropertyChanged:
    function onHdrPropertyChanged(aHdrToChange, aPreChange, aStatus, aInstigator)
    {
    },
  onEvent:
    function onEvent(aDB, aEvent)
    {
    },

};


// start the next test command
function startCommand()
{
  if (gTest && gTest.test)
  {
    dump("doing test " + gTest.test.name + "\n");
    gTest.test();
  }
  if (!gTests.length)       // Do we have more commands?
  {
    // no, all done
    endTest();
    return;
  }

  gTest = gTests.shift();
  switch (gTest.command)
  {
    case kTrain:
      // train message
      var proArray = [];
      proArray.push(gTest.traitId);

      MailServices.junk.setMsgTraitClassification(
        getSpec(gTest.fileName), //in string aMsgURI
        0,
        null,         // in nsIArray aOldTraits
        proArray.length,
        proArray,     // in nsIArray aNewTraits
        classifyListener); // [optional] in nsIMsgTraitClassificationListener aTraitListener
        // null,      // [optional] in nsIMsgWindow aMsgWindow
        // null,      // [optional] in nsIJunkMailClassificationListener aJunkListener
      break;

    case kClass:
      // classify message
      gPOP3Pump.files = [gTest.fileName];
      gPOP3Pump.onDone = function(){do_timeout(100, startCommand);};
      gPOP3Pump.run();
      break;
  }
}

function getSpec(aFileName)
{
  var file = do_get_file(aFileName);
  var uri = Services.io.newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
