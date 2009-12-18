/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
 * tests post-plugin message filters as implemented in bug 198100
 */

load("../../mailnews/resources/POP3pump.js");

// Globals

const nsIJunkMailPlugin =
  Cc["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
    .getService(Ci.nsIJunkMailPlugin);

const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                     .getService(Ci.nsIMsgDBService);

// command functions for test data
const kTrain = 0;  // train a file as a trait
const kClass = 1;  // classify files with traits

var gTest; // currently active test
var gMsgHdr; // current message header

const kJunkFile = "../../mailnews/data/bugmail1";
const kGoodFile = "../../mailnews/data/draft1";

const kPriorityLow = 3;
const kPriorityHigh = 5;
var gInboxListener; // database listener object

var gTests =
[
  // train two different messages
  {
    command: kTrain,
    fileName: kGoodFile,
    traitId: nsIJunkMailPlugin.GOOD_TRAIT,
  },
  {
    command: kTrain,
    fileName: kJunkFile,
    traitId: nsIJunkMailPlugin.JUNK_TRAIT,
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
  let filterList = gLocalIncomingServer.getFilterList(null);

  // junkIsLow filter
  let filter = filterList.createFilter("junkIsLow");
  let searchTerm = filter.createTerm();
  searchTerm.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  let value = searchTerm.value;
  value.attrib = Ci.nsMsgSearchAttrib.JunkStatus;
  value.junkStatus = nsIJunkMailPlugin.JUNK;
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
  value.junkStatus = nsIJunkMailPlugin.GOOD;
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
  gDbService.registerPendingListener(gLocalInboxFolder, gInboxListener);

  do_test_pending();

  startCommand();
}

function endTest()
{
  // Cleanup
  dump(" Exiting mail tests\n");
  if (gInboxListener)
  {
    try {
      gLocalInboxFolder.msgDatabase.RemoveListener(gInboxListener);
    }
    catch(e) {}
    try {
      gDbService.UnregisterPendingListener(gInboxListener);
    }
    catch(e) {}
  }

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
          gIMAPInbox.msgDatabase.RemoveListener(gInboxListener);
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

      nsIJunkMailPlugin.setMsgTraitClassification(
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
      gPOP3Pump.onDone = function(){do_timeout(100, startCommand());};
      gPOP3Pump.run();
      break;
  }
}

function getSpec(aFileName)
{
  var file = do_get_file("../../mailnews/data/" + aFileName);
  var uri = Cc["@mozilla.org/network/io-service;1"]
               .getService(Ci.nsIIOService)
               .newFileURI(file).QueryInterface(Ci.nsIURL);
  uri.query = "type=application/x-message-display";
  return uri.spec;
}
