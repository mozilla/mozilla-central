/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Testing of inherited folder properties
 */

function run_test()
{ 
  localAccountUtils.loadLocalMailAccount();
  var rootFolder = localAccountUtils.incomingServer.rootMsgFolder;

  // add subfolders to the inbox
  const subFolder11 = localAccountUtils.inboxFolder.createLocalSubfolder("subfolder11")
                         .QueryInterface(Ci.nsIMsgLocalMailFolder);
  const subFolder12 = localAccountUtils.inboxFolder.createLocalSubfolder("subfolder12")
                         .QueryInterface(Ci.nsIMsgLocalMailFolder);
  const subFolder21 = subFolder11.createLocalSubfolder("subfolder21");
  const subFolder22 = subFolder12.createLocalSubfolder("subfolder22");

  // add a global preference
  const propertyName = "iexist";
  const invalidName = "idontexist";
  const globalPref = "mail.server.default." + propertyName;
  const globalValue = "iAmGlobal";
  const folderValue = "iAmFolder";
  const folderValue2 = "iAmFolder2";
  const rootValue = "iAmRoot";
  Services.prefs.setCharPref(globalPref, globalValue);

  // test that the global preference is honored
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(rootFolder.getInheritedStringProperty(invalidName), null);
  do_check_eq(subFolder11.getInheritedStringProperty(invalidName), null);
  do_check_eq(subFolder22.getInheritedStringProperty(invalidName), null);

  // set a value on a subfolder and check
  subFolder11.setStringProperty(propertyName, folderValue);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), globalValue);

  // set a root folder value and check
  localAccountUtils.incomingServer.setCharValue(propertyName, rootValue);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), rootValue);

  // force an empty string
  subFolder12.setForcePropertyEmpty(propertyName, true);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), "");
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), "");

  // reset a folder to allow inheritance
  subFolder12.setForcePropertyEmpty(propertyName, false);
  subFolder12.setStringProperty(propertyName, "");
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), rootValue);

  // force an empty string on the server
  localAccountUtils.incomingServer.setForcePropertyEmpty(propertyName, true);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), "");
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), "");
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), "");

  // reset a server to allow inheritance from the global
  localAccountUtils.incomingServer.setCharValue(propertyName, "");
  localAccountUtils.incomingServer.setForcePropertyEmpty(propertyName, false);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), globalValue);

  // check with all levels populated
  subFolder21.setStringProperty(propertyName, folderValue2);
  localAccountUtils.incomingServer.setCharValue(propertyName, rootValue);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue2);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), rootValue);
  
  // clear the global value and the root value
  Services.prefs.clearUserPref(globalPref);
  localAccountUtils.incomingServer.setCharValue(propertyName, "");
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), null);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), null);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue2);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), null);

}
