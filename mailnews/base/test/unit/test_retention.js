/*
 * Simple tests for retention settings. In particular, we'd like to make
 * sure that applying retention settings works with the new code that avoids
 * opening db's to apply retention settings if the folder doesn't override
 * the server defaults.
 */

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

var gMessageGenerator = new MessageGenerator();
var gScenarioFactory = new MessageScenarioFactory(gMessageGenerator);

var gTestFolder;

function setup_globals(aNextFunc) {
  // Add 10 messages
  let messages = [];
  messages = messages.concat(gScenarioFactory.directReply(10));

  let msgSet = new SyntheticMessageSet(messages);

  gTestFolder = make_empty_folder();
  return add_sets_to_folders(gTestFolder, [msgSet]);
}

function run_test() {
  configure_message_injection({mode: "local"});
  do_test_pending();
  async_run({func: actually_run_test});
}

function actually_run_test() {
  yield async_run({func: setup_globals});
  let numMessages = 10;
  gTestFolder.msgDatabase = null;
  gTestFolder.applyRetentionSettings();
  const gDbService = Cc["@mozilla.org/msgDatabase/msgDBService;1"]
                       .getService(Ci.nsIMsgDBService);
  // adding messages leaves some headers around as garbage - make sure
  // those are cleaned up so the db will get closed.
  Components.utils.forceGC();
  Components.utils.forceCC();
  do_check_eq(gDbService.cachedDBForFolder(gTestFolder), null);
  // no retention settings, so we should have the same number of messages.
  do_check_eq(numMessages, gTestFolder.msgDatabase.dBFolderInfo.numMessages);
  let serverSettings = gTestFolder.server.retentionSettings;
  serverSettings.retainByPreference = Ci.nsIMsgRetentionSettings.nsMsgRetainByNumHeaders;
  serverSettings.numHeadersToKeep = 9;
  gTestFolder.server.retentionSettings = serverSettings;
  gTestFolder.applyRetentionSettings();
  // no retention settings, so we should have the same number of messages.
  do_check_eq(9, gTestFolder.msgDatabase.dBFolderInfo.numMessages);
  let folderSettings = gTestFolder.retentionSettings;
  folderSettings.retainByPreference = Ci.nsIMsgRetentionSettings.nsMsgRetainByNumHeaders;
  folderSettings.numHeadersToKeep = 8;
  folderSettings.useServerDefaults = false;
  gTestFolder.retentionSettings = folderSettings;
  gTestFolder.applyRetentionSettings();
  // no retention settings, so we should have the same number of messages.
  do_check_eq(8, gTestFolder.msgDatabase.dBFolderInfo.numMessages);
  do_test_finished();
}
