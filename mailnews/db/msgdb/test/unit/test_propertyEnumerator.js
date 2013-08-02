/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 // tests propertyEnumerator in nsIMsgDBHdr;

Components.utils.import("resource:///modules/mailServices.js");

var gHdr;

function run_test() {
  localAccountUtils.loadLocalMailAccount();
  // Get a message into the local filestore.
  // Function continue_test() continues the testing after the copy.
  var bugmail1 = do_get_file("../../../../data/bugmail1");
  do_test_pending();
  MailServices.copy.CopyFileMessage(bugmail1, localAccountUtils.inboxFolder, null,
                                    false, 0, "", copyListener, null);
}

var copyListener =
{
  OnStartCopy: function() {},
  OnProgress: function(aProgress, aProgressMax) {},
  SetMessageKey: function(aKey) { gHdr = localAccountUtils.inboxFolder.GetMessageHeader(aKey);},
  SetMessageId: function(aMessageId) {},
  OnStopCopy: function(aStatus) { continue_test();}
};

function continue_test()
{
  // test some of the default properties
  var enumerator = gHdr.propertyEnumerator;
  var properties = [];
  while (enumerator.hasMore())
  {
    var property = enumerator.getNext();
    //dump("\nProperty is " + property);
    properties.push(property);
  }
  do_check_true(properties.indexOf("flags") >= 0);
  do_check_true(properties.indexOf("size") >= 0);
  // this will be added in the next section, but does not exist yet
  do_check_true(properties.indexOf("iamnew") < 0);

  // add a new property, and make sure that it appears
  gHdr.setStringProperty("iamnew", "somevalue");

  enumerator = gHdr.propertyEnumerator;
  properties = [];
  while (enumerator.hasMore())
  {
    property = enumerator.getNext();
    //dump("\nProperty 2 is " + property);
    properties.push(property);
  }
  do_check_true(properties.indexOf("flags") >= 0);
  do_check_true(properties.indexOf("size") >= 0);
  do_check_true(properties.indexOf("iamnew") >= 0);
  do_check_true(properties.indexOf("idonotexist") < 0);

  gHdr = null;
  do_test_finished();
}
