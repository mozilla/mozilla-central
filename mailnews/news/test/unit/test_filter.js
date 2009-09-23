////////////////////////////////////////////////////////////////////////////////
// Tests for the filtering code of NNTP. The same tests are run for each of the
// different NNTP setups, to test code in a variety of cases.
//
// Different suites:
// * Perfect 3977 compliance (not tested)
// * Perfect 2980 compliance (XOVER and XHDR work)
// * Giganews compliance (XHDR doesn't work for practical purposes)
// * Only 977 compliance (no XOVER support)
// Basic operations:
// * Test that the following headers trigger:
//   - Subject
//   - From
//   - Date
//   - Size
//   - Message-ID (header retrievable by XOVER)
//   - User-Agent (header not retrievable by XHDR)
// * Test all actions
////////////////////////////////////////////////////////////////////////////////

load("../../mailnews/resources/filterTestUtils.js");

// These are the expected results for testing filter triggers
var attribResults = {
  "1@regular.invalid" : ["isRead", false],
  "2@regular.invalid" : ["isRead", true],
  "3@regular.invalid" : ["isRead", true],
  "4@regular.invalid" : ["isRead", true],
  "5@regular.invalid" : ["isRead", true],
  "6.odd@regular.invalid" : ["isRead", true],
  "7@regular.invalid" : ["isRead", true]
};
function testAttrib(handler, localserver) {
  var server = new nsMailServer(handler);
  server.start(NNTP_PORT);

  // Get the folder and force filters to run
  var folder = localserver.rootFolder.getChildNamed("test.filter");
  folder.getNewMessages(null, {
    OnStopRunningUrl: function () { localserver.closeCachedConnections() }});
  server.performTest();

  var headerEnum = folder.messages;
  var headers = [];
  while (headerEnum.hasMoreElements())
    headers.push(headerEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  try
  {
    do_check_eq(headers.length, 7);
    for each (var header in headers) {
      var id = header.messageId;
      dump("Testing message "+id+"\n");
      do_check_eq(header[attribResults[id][0]], attribResults[id][1]);
    }
  } catch (e) {
    print(server.playTransaction().them);
    throw e;
  } finally {
    server.stop();
  }

  resetFolder(folder);
}

// These are the results for testing actual actions
var actionResults = {
  "1@regular.invalid" : ["priority", 6],
  // "2@regular.invalid" should not be in database
  "3@regular.invalid" : function (header, folder) {
    var flags = folder.msgDatabase.GetThreadContainingMsgHdr(header).flags;
    var ignored = Ci.nsMsgMessageFlags.Ignored;
    // This is checking the thread's kill flag
    return (flags & ignored) == ignored;
  },
  "4@regular.invalid" : function (header, folder) {
    var flags = folder.msgDatabase.GetThreadContainingMsgHdr(header).flags;
    var watched = Ci.nsMsgMessageFlags.Watched;
    // This is checking the thread's watch flag
    return (flags & watched) == watched;
  },
  "5@regular.invalid" : ["isFlagged", true],
  "6.odd@regular.invalid" : ["isRead", false],
  "7@regular.invalid" : function (header, folder) {
    return header.getStringProperty("keywords") == "tag";
  }
};
function testAction(handler, localserver) {
  var server = new nsMailServer(handler);
  server.start(NNTP_PORT);

  // Get the folder and force filters to run
  var folder = localserver.rootFolder.getChildNamed("test.filter");
  folder.getNewMessages(null, {
    OnStopRunningUrl: function () { localserver.closeCachedConnections() }});
  server.performTest();

  var headerEnum = folder.messages;
  var headers = [];
  while (headerEnum.hasMoreElements())
    headers.push(headerEnum.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  try
  {
    do_check_eq(headers.length, 6);
    for each (var header in headers) {
      var id = header.messageId;
      dump("Testing message "+id+"\n");
      if (actionResults[id] instanceof Array)
        do_check_eq(header[actionResults[id][0]], actionResults[id][1]);
      else
        do_check_true(actionResults[id](header, folder));
    }
  } catch (e) {
    print(server.playTransaction().them);
    throw e;
  } finally {
    server.stop();
  }

  resetFolder(folder);
}

// These are the various server handlers
var handlers = [NNTP_RFC977_handler, NNTP_Giganews_handler,
                NNTP_RFC2980_handler];
function run_test() {
  // Set up the server and add in filters
  var daemon = setupNNTPDaemon();
  var localserver = setupLocalServer(NNTP_PORT);
  var serverFilters = localserver.getFilterList(null);

  createFilter(serverFilters, "subject", "Odd", "read");
  createFilter(serverFilters, "from", "Odd Person", "read");
  // A PRTime is the time in μs, but a JS date is time in ms.
  createFilter(serverFilters, "date", new Date(2000, 0, 1)*1000, "read");
  createFilter(serverFilters, "size", 2, "read");
  createFilter(serverFilters, "message-id", "odd", "read");
  createFilter(serverFilters, "user-agent", "Odd/1.0", "read");
  localserver.setFilterList(serverFilters);

  handlers.forEach( function (handler) {
    var handlerObj = new handler(daemon);
    testAttrib(handlerObj, localserver);
  });

  // Now we test folder-filters... and actions
  // Clear out the server filters
  while (serverFilters.filterCount > 0)
    serverFilters.removeFilterAt(0);
  localserver.setFilterList(serverFilters);

  var folder = localserver.rootFolder.getChildNamed("test.filter");
  var folderFilters = folder.getFilterList(null);
  createFilter(folderFilters, "subject", "First", "priority");
  createFilter(folderFilters, "subject", "Odd", "delete");
  createFilter(folderFilters, "from", "Odd Person", "kill");
  createFilter(folderFilters, "date", new Date(2000, 0, 1)*1000, "watch");
  createFilter(folderFilters, "size", 2, "flag");
  createFilter(folderFilters, "message-id", "odd", "stop");
  // This shouldn't be hit, because of the previous filter
  createFilter(folderFilters, "message-id", "6.odd", "read");
  createFilter(folderFilters, "user-agent", "Odd/1.0", "tag");
  folderFilters.loggingEnabled = true;
  folder.setFilterList(folderFilters);

  handlers.forEach( function (handler) {
    var handlerObj = new handler(daemon);
    testAction(handlerObj, localserver);
  });
}
