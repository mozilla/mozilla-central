const NS_LOCALFILEOUTPUTSTREAM_CONTRACTID = "@mozilla.org/network/file-output-stream;1";
const kRegistrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);

load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");
load("../../../resources/messageGenerator.js");

Services.prefs.setCharPref("mail.serverDefaultStoreContractID",
                           "@mozilla.org/msgstore/berkeleystore;1");

let gTargetFolder;
let gUuid;
let gOriginalCID =
  Components.manager.contractIDToCID(NS_LOCALFILEOUTPUTSTREAM_CONTRACTID);

function LockedFileOutputStream() {
}

LockedFileOutputStream.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFileOutputStream]),

  init: function(file, ioFlags, perm, behaviorFlags) {
    throw Cr.NS_ERROR_FILE_IS_LOCKED;
  },
}

var FileOutputStreamFactory = {
  createInstance: function(aOuter, aIid) {
    if (aOuter)
      do_throw(Cr.NS_ERROR_NO_AGGREGATION);

    return new LockedFileOutputStream().QueryInterface(aIid);
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFactory])
};

function setup_output_stream_stub() {
  gUuid = Cc["@mozilla.org/uuid-generator;1"]
            .getService(Ci.nsIUUIDGenerator)
            .generateUUID()
            .toString();

  kRegistrar.registerFactory(Components.ID(gUuid),
                            "Stub for nsIFileOutputStream",
                            NS_LOCALFILEOUTPUTSTREAM_CONTRACTID,
                            FileOutputStreamFactory);
}

function teardown_output_stream_stub() {
  kRegistrar.unregisterFactory(Components.ID(gUuid),
                              FileOutputStreamFactory);
  kRegistrar.registerFactory(gOriginalCID,
                            "",
                            NS_LOCALFILEOUTPUTSTREAM_CONTRACTID,
                            null);
}

function setup_target_folder() {
  let messageGenerator = new MessageGenerator();
  let scenarioFactory = new MessageScenarioFactory(messageGenerator);
  let messages = [];
  messages = messages.concat(scenarioFactory.directReply(10));

  gTargetFolder = gLocalIncomingServer.rootMsgFolder.createLocalSubfolder("Target");
  addMessagesToFolder(messages, gTargetFolder);

  updateFolderAndNotify(gTargetFolder, async_driver);
  yield false;
}

function delete_all_messages() {
  let enumerator = gTargetFolder.messages;
  let headers = [];
  while (enumerator.hasMoreElements())
    headers.push(enumerator.getNext().QueryInterface(Ci.nsIMsgDBHdr));

  let array = toXPCOMArray(headers, Ci.nsIMutableArray);

  gTargetFolder.deleteMessages(array, null, false, true, asyncCopyListener, false);
  yield false;
}

function test_compact_without_crash() {
  let compactor = Cc["@mozilla.org/messenger/localfoldercompactor;1"]
                    .createInstance(Ci.nsIMsgFolderCompactor);
  let listener = new AsyncUrlListener(null, function(url, exitCode) {
    do_throw("This listener should not be called back.");
  });
  try {
    compactor.compact(gTargetFolder, false, listener, null);
    do_throw("nsIMsgFolderCompactor.compact did not fail.");
  } catch(ex) {
    do_check_eq(Cr.NS_ERROR_FILE_IS_LOCKED, ex.result);
  }
}

var tests = [
  setup_target_folder,
  delete_all_messages,
  setup_output_stream_stub,
  test_compact_without_crash,
  teardown_output_stream_stub,
];

function create_local_folders() {
  let rootFolder = gLocalIncomingServer.rootMsgFolder;
  let localTrashFolder = rootFolder.getChildNamed("Trash");
  localTrashFolder.setFlag(Ci.nsMsgFolderFlags.Trash);
}

function run_test() {
  loadLocalMailAccount();
  create_local_folders();

  async_run_tests(tests);
}

