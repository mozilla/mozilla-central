/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/*
 * Test suite for nsMsgCompose functions relating to listeners.
 */

const MsgComposeContractID = "@mozilla.org/messengercompose/compose;1";
const MsgComposeParamsContractID = "@mozilla.org/messengercompose/composeparams;1";
const MsgComposeFieldsContractID = "@mozilla.org/messengercompose/composefields;1";
const nsIMsgCompose = Components.interfaces.nsIMsgCompose;
const nsIMsgComposeParams = Components.interfaces.nsIMsgComposeParams;
const nsIMsgCompFields = Components.interfaces.nsIMsgCompFields;
const nsIAbPreferMailFormat = Components.interfaces.nsIAbPreferMailFormat;

function checkPopulate(aTo, aNonHTMLRecipients, aPreferMailOut, aCheckTo)
{
  var msgCompose = Components.classes[MsgComposeContractID]
                             .createInstance(nsIMsgCompose);

  // Set up some basic fields for compose.
  var fields = Components.classes[MsgComposeFieldsContractID]
                         .createInstance(nsIMsgCompFields);

  fields.to = aTo;

  // Set up some params
  var params = Components.classes[MsgComposeParamsContractID]
                         .createInstance(nsIMsgComposeParams);

  params.composeFields = fields;

  msgCompose.initialize(params);

  var nonHTMLRecipients = new Object();

  do_check_eq(msgCompose.checkAndPopulateRecipients(true, true,
                                                    nonHTMLRecipients),
              aPreferMailOut);

  do_check_eq(fields.to, aCheckTo);

  do_check_eq(nonHTMLRecipients.value, aNonHTMLRecipients);
}

function run_test() {
  // Test setup - copy the data files into place
  var testAB = do_get_file("../../../data/abLists1.mab");

  // Copy the file to the profile directory for a PAB
  testAB.copyTo(do_get_profile(), kPABData.fileName);

  testAB = do_get_file("../../../data/abLists2.mab");

  // Copy the file to the profile directory for a CAB
  testAB.copyTo(do_get_profile(), kCABData.fileName);

  // Test - Check we can initalize with fewest specified
  // parameters and don't fail/crash like we did in bug 411646.

  var msgCompose = Components.classes[MsgComposeContractID]
                             .createInstance(nsIMsgCompose);

  // Set up some params
  var params = Components.classes[MsgComposeParamsContractID]
                         .createInstance(nsIMsgComposeParams);

  msgCompose.initialize(params);

  // Test - checkAndPopulateRecipients basic functionality.

  // Re-initialize
  msgCompose = Components.classes[MsgComposeContractID]
                         .createInstance(nsIMsgCompose);

  // Set up some basic fields for compose.
  var fields = Components.classes[MsgComposeFieldsContractID]
                         .createInstance(nsIMsgCompFields);

  // These aren't in the address book copied above.
  fields.from = "test1@foo1.invalid";
  fields.to = "test2@foo1.invalid";
  fields.cc = "test3@foo1.invalid";
  fields.bcc = "test4@foo1.invalid";

  // Set up some params
  params = Components.classes[MsgComposeParamsContractID]
                     .createInstance(nsIMsgComposeParams);

  params.composeFields = fields;

  msgCompose.initialize(params);

  var nonHTMLRecipients = new Object();

  do_check_eq(msgCompose.checkAndPopulateRecipients(true, false,
                                                    nonHTMLRecipients),
              nsIAbPreferMailFormat.unknown);

  do_check_eq(nonHTMLRecipients.value, "");

  do_check_eq(msgCompose.checkAndPopulateRecipients(true, true,
                                                      nonHTMLRecipients),
              nsIAbPreferMailFormat.unknown);

  do_check_eq(nonHTMLRecipients.value, "test2@foo1.invalid,test3@foo1.invalid,test4@foo1.invalid");

  do_check_eq(fields.to, "test2@foo1.invalid");
  do_check_eq(fields.cc, "test3@foo1.invalid");
  do_check_eq(fields.bcc, "test4@foo1.invalid");

  // Test - checkAndPopulateRecipients with plain text.

  checkPopulate("test4@foo.invalid", "test4@foo.invalid",
                nsIAbPreferMailFormat.plaintext, "test4@foo.invalid");

  // Test - checkAndPopulateRecipients with html.

  checkPopulate("test5@foo.invalid", "", nsIAbPreferMailFormat.html,
                "test5@foo.invalid");

  // Test - checkAndPopulateRecipients with a list of three items.

  checkPopulate("TestList1 <TestList1>",
                "test1@foo.invalid,test2@foo.invalid,test3@foo.invalid",
                nsIAbPreferMailFormat.unknown,
                "test1@foo.invalid,test2@foo.invalid,test3@foo.invalid");

  // Test - checkAndPopulateRecipients with a list of one item.

  checkPopulate("TestList2 <TestList2>", "test4@foo.invalid",
                nsIAbPreferMailFormat.plaintext, "test4@foo.invalid");

  checkPopulate("TestList3 <TestList3>", "",
                nsIAbPreferMailFormat.html, "test5@foo.invalid");

  // Test - checkAndPopulateRecipients with items from multiple address books.

  checkPopulate("TestList1 <TestList1>, test3@com.invalid",
                "test1@foo.invalid,test2@foo.invalid,test3@foo.invalid,test3@com.invalid",
                nsIAbPreferMailFormat.unknown,
                "test1@foo.invalid,test2@foo.invalid,test3@foo.invalid,test3@com.invalid");

  checkPopulate("TestList2 <TestList2>, ListTest2 <ListTest2>",
                "test4@foo.invalid,test4@com.invalid",
                nsIAbPreferMailFormat.plaintext,
                "test4@foo.invalid,test4@com.invalid");

  checkPopulate("TestList3 <TestList3>, ListTest1 <ListTest1>",
                "test1@com.invalid,test2@com.invalid,test3@com.invalid",
                nsIAbPreferMailFormat.unknown,
                "test5@foo.invalid,test1@com.invalid,test2@com.invalid,test3@com.invalid");
                
  // test bug 254519 rfc 2047 encoding
  checkPopulate("=?iso-8859-1?Q?Sure=F6name=2C_Forename__Dr=2E?= <pb@bieringer.invalid>", "pb@bieringer.invalid",
                nsIAbPreferMailFormat.unknown,
                "\"Sure\u00F6name, Forename  Dr.\" <pb@bieringer.invalid>");
};
