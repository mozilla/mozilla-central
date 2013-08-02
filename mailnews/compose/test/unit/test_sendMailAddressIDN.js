/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * Tests sending messages to addresses with non-ASCII characters.
 */
load("../../../resources/alertTestUtils.js");

var type = null;
var test = null;
var server;
var finished = false;

var sentFolder;
var originalData;
var expectedAlertMessage;

const kSender     = "from@foo.invalid";
const kToASCII    = "to@foo.invalid";
const kToValid    = "to@v\u00E4lid.foo.invalid";
const kToValidACE = "to@xn--vlid-loa.foo.invalid";
const kToInvalid  = "b\u00F8rken.to@invalid.foo.invalid";
const kToInvalidWithoutDomain = "b\u00F8rken.to";
const NS_ERROR_BUT_DONT_SHOW_ALERT = 0x805530ef;


// nsIPrompt
function alert(aDialogText, aText)
{
  // ignore without domain situation (this is crash test)
  if (test == kToInvalidWithoutDomain)
    return;

  // we should only get here for the kToInvalid test case
  do_check_eq(test, kToInvalid);
  do_check_eq(aText, expectedAlertMessage);
}


// message listener implementations
function msgListener(aRecipient)
{
  this.rcpt = aRecipient;
}

msgListener.prototype =
{
  // nsIMsgSendListener
  onStartSending: function (aMsgID, aMsgSize) {},
  onProgress: function (aMsgID, aProgress, aProgressMax) {},
  onStatus: function (aMsgID, aMsg) {},
  onStopSending: function (aMsgID, aStatus, aMsg, aReturnFile)
  {
    try
    {
      do_check_eq(aStatus, 0);
      do_check_transaction(server.playTransaction(),
                           ["EHLO test",
                            "MAIL FROM:<" + kSender + "> SIZE=" + originalData.length,
                            "RCPT TO:<" + this.rcpt + ">",
                            "DATA"]);
      // Compare data file to what the server received
      do_check_eq(originalData, server._daemon.post);
    }
    catch (e)
    {
      do_throw(e);
    }
    finally
    {
      server.stop();
      var thread = gThreadManager.currentThread;
      while (thread.hasPendingEvents())
        thread.processNextEvent(false);
    }
  },
  onGetDraftFolderURI: function (aFolderURI) {},
  onSendNotPerformed: function (aMsgID, aStatus) {},

  // nsIMsgCopyServiceListener
  OnStartCopy: function () {},
  OnProgress: function (aProgress, aProgressMax) {},
  SetMessageKey: function (aKey) {},
  GetMessageId: function (aMessageId) {},
  OnStopCopy: function (aStatus)
  {
    do_check_eq(aStatus, 0);
    try
    {
      // Now do a comparison of what is in the sent mail folder
      let msgData = mailTestUtils
        .loadMessageToString(sentFolder, mailTestUtils.firstMsgHdr(sentFolder));
      // Skip the headers etc that mailnews adds
      var pos = msgData.indexOf("From:");
      do_check_neq(pos, -1);
      msgData = msgData.substr(pos);
      do_check_eq(originalData, msgData);
    }
    catch (e)
    {
      do_throw(e);
    }
    finally
    {
      finished = true;
      do_test_finished();
    }
  },

  // QueryInterface
  QueryInterface: function (iid)
  {
    if (iid.equals(Ci.nsIMsgSendListener) ||
        iid.equals(Ci.nsIMsgCopyServiceListener) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Components.results.NS_ERROR_NO_INTERFACE;
  }
}


function DoSendTest(aRecipient, aRecipientExpected, aExceptionExpected)
{
  var smtpServer = getBasicSmtpServer();
  var identity = getSmtpIdentity(kSender, smtpServer);
  do_check_eq(identity.doFcc, true);

  // Random test file with data we don't actually care about. ;-)
  var testFile = do_get_file("data/message1.eml");
  originalData = IOUtils.loadFileToString(testFile);

  // Handle the server in a try/catch/finally loop so that we always will stop
  // the server if something fails.
  server = setupServerDaemon();
  var exceptionCaught = 0;
  try
  {
    // Start the fake SMTP server
    server.start(SMTP_PORT);

    var compFields = Cc["@mozilla.org/messengercompose/composefields;1"]
                       .createInstance(Ci.nsIMsgCompFields);
    compFields.from = identity.email;
    compFields.to = aRecipient;

    var msgSend = Cc["@mozilla.org/messengercompose/send;1"]
                    .createInstance(Ci.nsIMsgSend);
    msgSend.sendMessageFile(identity, "", compFields, testFile,
                            false, false, Ci.nsIMsgSend.nsMsgDeliverNow,
                            null, new msgListener(aRecipientExpected), null, null);

    server.performTest();

    do_timeout(10000, function()
        {if (!finished) do_throw('Notifications of message send/copy not received');}
      );
    do_test_pending();
  }
  catch (e)
  {
    exceptionCaught = e.result;
  }
  finally
  {
    server.stop();
    var thread = gThreadManager.currentThread;
    while (thread.hasPendingEvents())
      thread.processNextEvent(true);
  }
  do_check_eq(exceptionCaught, aExceptionExpected);
}


function run_test()
{
  type = "sendMailAddressIDN";
  registerAlertTestUtils();
  var composeProps = Services.strings.createBundle("chrome://messenger/locale/messengercompose/composeMsgs.properties");
  expectedAlertMessage = composeProps.GetStringFromName("errorIllegalLocalPart")
                                     .replace("%s", kToInvalid);

  // Ensure we have at least one mail account
  localAccountUtils.loadLocalMailAccount();
  MailServices.accounts.setSpecialFolders();
  sentFolder = localAccountUtils.rootFolder.createLocalSubfolder("Sent");

  // Test 1:
  // Plain ASCII recipient address.
  test = kToASCII;
  DoSendTest(kToASCII, kToASCII, 0);

  // Test 2:
  // The recipient's domain part contains a non-ASCII character, hence the
  // address needs to be converted to ACE before sending.
  // The old code would just strip the non-ASCII character and try to send
  // the message to the remaining - wrong! - address.
  // The new code will translate the domain part to ACE for the SMTP
  // transaction (only), i.e. the To: header will stay as stated by the sender.
  test = kToValid;
  DoSendTest(kToValid, kToValidACE, 0);

  // Test 3:
  // The recipient's local part contains a non-ASCII character, which is not
  // allowed with unextended SMTP.
  // The old code would just strip the invalid character and try to send the
  // message to the remaining - wrong! - address.
  // The new code will present an informational message box and deny sending.
  test = kToInvalid;
  DoSendTest(kToInvalid, kToInvalid, NS_ERROR_BUT_DONT_SHOW_ALERT);

  // Test 4:
  // Bug 856506. invalid char without '@' casues crash.
  test = kToInvalidWithoutDomain;
  DoSendTest(kToInvalidWithoutDomain, kToInvalidWithoutDomain, NS_ERROR_BUT_DONT_SHOW_ALERT);
}
