/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/licenses/publicdomain/
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Setup for nsIMsgFolderListener tests.
 *
 * To create a test on top of this,
 *
 * - define a doTest function which accepts the number of the test as an argument.
 * - for each test, store the expected events as an array in gExpectedEvents, with
 *   format [event, item array] or [event, is move, item array, destination folder].
 * - use the copyListener and gMFListener
 * - make sure you set the function call flag once your function call is done.
 */

const nsIMsgDBHdr = Ci.nsIMsgDBHdr;
const nsIArray = Ci.nsIArray;
const nsIMsgFolder = Ci.nsIMsgFolder;

const gMFNService = Cc["@mozilla.org/messenger/msgnotificationservice;1"]
                      .getService(Ci.nsIMsgFolderNotificationService);
const gCopyService = Cc["@mozilla.org/messenger/messagecopyservice;1"]
                      .getService(Ci.nsIMsgCopyService);

// Current test being executed
var gTest = 1;

// Which events are expected
var gExpectedEvents;

// The current status (what all has been done)
var gCurrStatus = 0;
const kStatus =
{
  notificationsDone: 0x1,
  onStopCopyDone: 0x2,
  functionCallDone: 0x4,
  everythingDone: 0
};
kStatus.everythingDone = kStatus.notificationsDone | kStatus.onStopCopyDone | kStatus.functionCallDone;

// For CopyFileMessage: this stores the header that was received
var gHdrsReceived = new Array();

var gMsgHdrs = new Array();

// Our listener, which captures events and verifies them as they are received.
var gMFListener =
{
  msgAdded: function(aMsg)
  {
    verify([gMFNService.msgAdded, aMsg]);
    var hdr = gHdrsReceived.pop();
    gMsgHdrs.push({hdr: hdr, ID: hdr.messageId});
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  msgsDeleted: function(aMsgs)
  {
    verify([gMFNService.msgsDeleted, aMsgs]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder)
  {
    verify([gMFNService.msgsMoveCopyCompleted, aMove, aSrcMsgs, aDestFolder]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  folderDeleted: function(aFolder)
  {
    verify([gMFNService.folderDeleted, aFolder]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  folderMoveCopyCompleted: function(aMove, aSrcFolder, aDestFolder)
  {
    verify([gMFNService.folderMoveCopyCompleted, aMove, aSrcFolder, aDestFolder]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  folderRenamed: function(aOrigFolder, aNewFolder)
  {
    verify([gMFNService.folderRenamed, aOrigFolder, aNewFolder]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  }
};

// Copy listener, for proceeding after each operation.
var copyListener =
{
  // For CopyFileMessage: this should be the folder the message is being stored to
  mFolderStoredIn: null,
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gHdrsReceived.push(this.mFolderStoredIn.GetMessageHeader(aKey));
  },
  GetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus)
  {
    // Check: message successfully copied.
    do_check_eq(aStatus, 0);
    gCurrStatus |= kStatus.onStopCopyDone;
    if (gCurrStatus == kStatus.everythingDone)
      resetStatusAndProceed();
  }
};

function resetStatusAndProceed()
{
  gHdrsReceived.length = 0;
  gCurrStatus = 0;
  // Ugly hack: make sure we don't get stuck in a JS->C++->JS->C++... call stack
  // This can happen with a bunch of synchronous functions grouped together, and
  // can even cause tests to fail because they're still waiting for the listener
  // to return
  do_timeout(0, "doTest(++gTest)");
}

// Checks whether the array returned from a function has exactly these elements.
Array.prototype.hasExactlyElements = function(elements)
{
  // If an nsIArray (it could also be a single header or a folder)
  if (elements instanceof nsIArray)
  {
    var count = elements.length;

    // Check: array sizes should be equal.
    do_check_eq(count, this.length);

    for (var i = 0; i < count; i++)
    {
      // Check: query element, must be a header or folder and present in the array
      var currElement;
      try {
        currElement = elements.queryElementAt(i, nsIMsgDBHdr);
      }
      catch (e) {}
      if (!currElement)
      {
        try {
          currElement = elements.queryElementAt(i, nsIMsgFolder);
        }
        catch (e) {}
      }
      do_check_neq(currElement, undefined);
      do_check_neq(this.indexOf(currElement), -1);
    }
  }
  // If a single header or a folder
  else if (elements instanceof nsIMsgDBHdr || elements instanceof nsIMsgFolder)
  {
    // Check: there should be only one element in the array.
    do_check_eq(this.length, 1);

    // Check: the element should be present
    do_check_neq(this.indexOf(elements), -1);
  }
  // This shouldn't happen
  else
    do_throw("Unrecognized item returned from listener");
};

// Verifies an event
function verify(event)
{
  // Check: make sure we actually have an item to process
  do_check_true(gExpectedEvents.length >= 1);
  var expected = gExpectedEvents.shift();

  // Check: events match.
  var eventType = expected[0];
  do_check_eq(event[0], eventType);

  switch (eventType)
  {
  case gMFNService.msgAdded:
  case gMFNService.msgsDeleted:
  case gMFNService.folderDeleted:
    // Check: headers match/folder matches.
    expected[1].hasExactlyElements(event[1]);
    break;
  case gMFNService.msgsMoveCopyCompleted:
  case gMFNService.folderMoveCopyCompleted:
    // Check: Move or copy as expected.
    do_check_eq(expected[1], event[1]);

    // Check: headers match/folder matches.
    expected[2].hasExactlyElements(event[2]);

    // Check: destination folder matches.
    do_check_eq(expected[3], event[3]);
    break;
  case gMFNService.folderRenamed:
    // Check: source folder matches
    expected[1].hasExactlyElements(event[1]);

    // Check: destination folder name matches
    do_check_eq(expected[2], event[2].prettiestName);
    break;
  }
}
