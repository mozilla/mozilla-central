load("../../../resources/logHelper.js");
load("../../../resources/asyncTestUtils.js");

load("../../../resources/messageGenerator.js");
load("../../../resources/messageModifier.js");
load("../../../resources/messageInjection.js");

Components.utils.import("resource:///modules/gloda/mimemsg.js");

let gMessenger = Cc["@mozilla.org/messenger;1"]
                   .createInstance(Ci.nsIMessenger);

// Create a message generator
const msgGen = gMessageGenerator = new MessageGenerator();

const p7mAttachment = "dGhpcyBpcyBub3QgYSByZWFsIHMvbWltZSBwN20gZW50aXR5";

// create a message with a p7m attachment
let messages = [{
  attachments: [{ 
    body: p7mAttachment,
    filename: 'test.txt.p7m',
    contentType: 'application/pkcs7-mime',
    format:'',
    encoding: "base64"
  }]
}];

let msgWindow = Cc["@mozilla.org/messenger/msgwindow;1"]
                  .createInstance(Ci.nsIMsgWindow);

function thunderbird_default(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);

  MsgHdrToMimeMessage(msgHdr, null, function (aMsgHdr, aMimeMsg) {
    try {
      do_check_true(aMimeMsg.allUserAttachments.length == 0);
      do_print("Strange p7m is discarded, so attachment number is 0 (thunderbird default behaviour)");
      async_driver();
    } catch (err) {
      do_throw(err);
    }
  });

  yield false;
}

function set_preference_to_true(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);

  Services.prefs.setBoolPref("mailnews.p7m_external", true);

  MsgHdrToMimeMessage(msgHdr, null, function (aMsgHdr, aMimeMsg) {
    try {
      do_check_true(aMimeMsg.allUserAttachments.length == 1);
      do_print("Setting preference mailnews.p7m_external to true");
      do_print("Strange p7m is presented to the end user as attachment (attachment number = 1)");
      async_driver();
    } catch (err) {
      do_throw(err);
    }
  });

  yield false;
}

function set_preference_to_false(info) {
  let synMsg = gMessageGenerator.makeMessage(info);
  let synSet = new SyntheticMessageSet([synMsg]);
  yield add_sets_to_folder(gInbox, [synSet]);

  let msgHdr = synSet.getMsgHdr(0);

  Services.prefs.setBoolPref("mailnews.p7m_external", false);

  MsgHdrToMimeMessage(msgHdr, null, function (aMsgHdr, aMimeMsg) {
    try {
      do_check_true(aMimeMsg.allUserAttachments.length == 0);
      do_print("Setting preference mailnews.p7m_external to false");
      do_print("Strange p7m is discarded, so attachment number is 0 (thunderbird default behaviour)");
      async_driver();
    } catch (err) {
      do_throw(err);
    }
  });

  yield false;
}

/* ===== Driver ===== */

let tests = [
  parameterizeTest(thunderbird_default, messages),
  parameterizeTest(set_preference_to_true, messages),
  parameterizeTest(set_preference_to_false, messages)
];

let gInbox;

function run_test() {
  gInbox = configure_message_injection({mode: "local"});
  async_run_tests(tests);
}
