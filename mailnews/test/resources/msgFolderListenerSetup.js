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

const allTestedEvents =
  gMFNService.msgAdded |
  gMFNService.msgsClassified |
  gMFNService.msgsDeleted |
  gMFNService.msgsMoveCopyCompleted |
  gMFNService.folderAdded |
  gMFNService.folderDeleted |
  gMFNService.folderMoveCopyCompleted |
  gMFNService.folderRenamed |
  gMFNService.itemEvent;

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
    // We might not actually have a header in gHdrsReceived in the IMAP case,
    // so use the aMsg we got instead
    gMsgHdrs.push({hdr: aMsg, ID: aMsg.messageId});
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
    else if (gExpectedEvents[0][0] == gMFNService.msgsClassified)
    {
      // XXX this is a hack to deal with limitations of the classification logic
      //  and the new list.  We want to issue a call to clear the list once all
      //  the messages have been added, which would be when the next expected
      //  event is msgsClassified.  (The limitation is that if we don't do this,
      //  we can end up getting told about this message again later.)
      aMsg.folder.clearNewMessages();
    }
  },

  msgsClassified: function(aMsgs, aJunkProcessed, aTraitProcessed)
  {
    dump("classified id: " + aMsgs.queryElementAt(0, Ci.nsIMsgDBHdr).messageId + "\n");
    verify([gMFNService.msgsClassified, aMsgs, aJunkProcessed,
              aTraitProcessed]);
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

  msgsMoveCopyCompleted: function(aMove, aSrcMsgs, aDestFolder, aDestMsgs)
  {
    verify([gMFNService.msgsMoveCopyCompleted, aMove, aSrcMsgs, aDestFolder,
            aDestMsgs]);
    if (gExpectedEvents.length == 0)
    {
      gCurrStatus |= kStatus.notificationsDone;
      if (gCurrStatus == kStatus.everythingDone)
        resetStatusAndProceed();
    }
  },

  folderAdded: function(aFolder)
  {
    verify([gMFNService.folderAdded, aFolder]);
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
  },

  itemEvent: function(aFolder, aEvent, aBetterBeNull)
  {
    // we currently require the third argument to be null...
    do_check_eq(aBetterBeNull, null);
    verify([gMFNService.itemEvent, aFolder, aEvent]);
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
  mMessageId: "",
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey)
  {
    gHdrsReceived.push(this.mFolderStoredIn.GetMessageHeader(aKey));
  },
  GetMessageId: function(aMessageId) {
    aMessageId = {value: this.mMessageId};
  },
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
function hasExactlyElements(array, elements)
{
  // If an nsIArray (it could also be a single header or a folder)
  if (elements instanceof nsIArray)
  {
    var count = elements.length;

    // Check: array sizes should be equal.
    do_check_eq(count, array.length);

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
      do_check_neq(array.indexOf(currElement), -1);
    }
  }
  // If a single header or a folder
  else if (elements instanceof nsIMsgDBHdr || elements instanceof nsIMsgFolder)
  {
    // Check: there should be only one element in the array.
    do_check_eq(array.length, 1);

    // Check: the element should be present
    do_check_neq(array.indexOf(elements), -1);
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

  dump("..... Verifying event type " + eventType + "\n");

  switch (eventType)
  {
  case gMFNService.msgAdded:
    // So for IMAP right now, we aren't able to get the actual nsIMsgDBHdr.
    // Instead, we'll match up message ids as a (poor?) substitute.
    if (expected[1].expectedMessageId)
    {
      do_check_eq(event[1].messageId, expected[1].expectedMessageId);
      break;
    }
    // If we do have a header, fall through to the case below
  case gMFNService.msgsDeleted:
  case gMFNService.folderDeleted:
    // Check: headers match/folder matches.
    hasExactlyElements(expected[1], event[1]);
    break;
  case gMFNService.msgsClassified:
    // In the IMAP case expected[1] is a list of mesage-id strings whereas in
    // the local case (where we are copying from files), we actually have
    // the headers.
    if (typeof(expected[1][0]) == "string") { // IMAP; message id strings
      // The IMAP case has additional complexity in that the 'new message'
      // list is not tailored to our needs and so may over-report about
      // new messagse.  So to deal with this we make sure the msgsClassified
      // event is telling us about at least the N expected events and that
      // the last N of these events match
      if (event[1].length < expected[1].length)
        do_throw("Not enough reported classified messages.");
      let ignoreCount = event[1].length - expected[1].length;
      for (let i = 0; i < expected[1].length; i++) {
        let eventHeader = event[1].queryElementAt(i + ignoreCount,
                                                  nsIMsgDBHdr);
        do_check_eq(expected[1][i], eventHeader.messageId);
      }
    }
    else { // actual headers
      hasExactlyElements(expected[1], event[1]);
    }
    // aJunkProcessed: was the message processed for junk?
    do_check_eq(expected[2], event[2]);
    // aTraitProcessed: was the message processed for traits?
    do_check_eq(expected[3], event[3]);
    break;
  case gMFNService.msgsMoveCopyCompleted:
  case gMFNService.folderMoveCopyCompleted:
    // Check: Move or copy as expected.
    do_check_eq(expected[1], event[1]);

    // Check: headers match/folder matches.
    hasExactlyElements(expected[2], event[2]);

    // Check: destination folder matches.
    do_check_eq(expected[3], event[3]);

    if (eventType == gMFNService.folderMoveCopyCompleted)
      break;

    // Check: destination headers.  We only expect these in the local folder
    //  case, and in that case, we will not have heard about the headers ahead
    //  of time, so the best we can do is make sure they match up.  To this end,
    //  if null is expected then we check for null.  If true is expected, then
    //  we check that the message-id header values match up.
    if (expected[4] == null)
    {
      do_check_eq(null, event[4]);
    }
    else
    {
      for (let iMsg = 0; iMsg < event[2].length; iMsg++)
      {
        let srcHdr = event[2].queryElementAt(iMsg, nsIMsgDBHdr);
        let destHdr = event[4].queryElementAt(iMsg, nsIMsgDBHdr);
        do_check_eq(srcHdr.messageId, destHdr.messageId);
      }
    }
    break;
  case gMFNService.folderAdded:
    // Check: parent folder matches
    do_check_eq(event[1].parent, expected[1]);

    // Check: folder name matches
    do_check_eq(event[1].prettyName, expected[2]);
    do_check_eq(event[1].name, expected[2]);

    // Not a check, but if we have to store this folder somewhere, do it
    if (expected[3])
      eval(expected[3] + "= event[1]");
    break;
  case gMFNService.folderRenamed:
    // Check: source folder matches
    hasExactlyElements(expected[1], event[1]);

    // Check: destination folder name matches
    do_check_eq(expected[2], event[2].prettiestName);
    break;
  case gMFNService.itemEvent:
    // the event string should match
    do_check_eq(expected[2], event[2]);
    // and so should the folder we are talking about
    do_check_eq(expected[1], event[1]);
    break;
  }
}
