/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for msg database functions.
 */

load("../../../../resources/messageGenerator.js");

var dbService;
var gTestFolder;
var gCurTestNum = 0;
const kNumTestMessages = 10;

const gTestArray =
[
  function test_db_open() {
    dbService = Components.classes["@mozilla.org/msgDatabase/msgDBService;1"]
                            .getService(Components.interfaces.nsIMsgDBService);
    // Get the root folder
    let root = localAccountUtils.incomingServer.rootFolder;
    root.createSubfolder("dbTest", null);
    gTestFolder = root.getChildNamed("dbTest");
    let db = dbService.openFolderDB(gTestFolder, true);
    do_check_neq(db, null);
    db.dBFolderInfo.highWater = 10;
    db.Close(true);
    db = dbService.openFolderDB(gTestFolder, true);
    do_check_neq(db, null);
    do_check_eq(db.dBFolderInfo.highWater, 10);
    db.dBFolderInfo.onKeyAdded(15);
    do_check_eq(db.dBFolderInfo.highWater, 15);
    db.Close(true);
    db.ForceClosed();
    db = null;
    doTest(++gCurTestNum);
  },
  function test_async_open() {
    let messageGenerator = new MessageGenerator();
    let localFolder = gTestFolder.QueryInterface(Ci.nsIMsgLocalMailFolder);
    let gMessages = [];

    // Add some messages to gTestFolder, close the db, and then test that opening
    // asynchronously works.
    for (let i = 0; i < kNumTestMessages; i++) {
      let message = messageGenerator.makeMessage();
      gMessages.push(message);
      gTestFolder.addMessage(message.toMboxString());
    }
    gTestFolder.msgDatabase = null;
    let db = dbService.asyncOpenFolderDB(gTestFolder, false);
    openMore(db);
  },
  function test_invalid_db_async_open() {
    // mark the summary invalid
    gTestFolder.msgDatabase.summaryValid = false;
    // clear the database so next time we have to reparse
    gTestFolder.msgDatabase.ForceClosed();
    let db = dbService.asyncOpenFolderDB(gTestFolder, false);
    // this should eventually throw an error in one of the callbacks
    openMoreAsync(db);
  }
];

function doTest(test)
{
  if (test <= gTestArray.length)
  {
    dump("Doing test " + test + "\n");
    gCurTestNum = test;

    var testFn = gTestArray[test-1];
    // Set a limit of 10 seconds; if the notifications haven't arrived by then there's a problem.
    do_timeout(10000, function(){
        if (gCurTestNum == test) 
          do_throw("Notifications not received in 10000 ms for operation " + testFn.name);
        }
      );
    try {
    testFn();
    } catch(ex) {do_throw(ex);}
  }
  else
  {
    do_test_finished(); // for the one in run_test()
  }
}


function run_test() {
  localAccountUtils.loadLocalMailAccount();
  do_test_pending();
  doTest(1);
}

function openMore(db)
{
  let done = dbService.openMore(db, 1);
  dump("in openMore done = " + done + "\n");
  if (!done)
    mailTestUtils.do_timeout_function(0, openMore, null, [db]);
  else {
    // just check that we can get something out of the db.
    do_check_eq(db.dBFolderInfo.numMessages, kNumTestMessages);
    db.Close(true);
    db.ForceClosed();
    db = null;
    doTest(++gCurTestNum);
  }
}

function openMoreAsync(db)
{
  let done = false;
  try {
    done = dbService.openMore(db, 100);
    dump("in openMoreAsync done = " + done + "\n");
  }
  catch (ex) {
    dump("got expected error opening corrupt db async\n");
    db = null;
    doTest(++gCurTestNum);
    return;
  };
  if (!done)
    mailTestUtils.do_timeout_function(0, openMoreAsync, null, [db]);
  else
    throw "Should have got an exception opening out of date db";
}

