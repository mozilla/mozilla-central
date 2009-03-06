/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Kent James <kent@caspia.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
 * Testing of inherited folder properties
 */

function run_test()
{ 
  loadLocalMailAccount();
  var rootFolder = gLocalIncomingServer.rootMsgFolder;

  // add subfolders to the inbox
  const subFolder11 = gLocalInboxFolder.addSubfolder("subfolder11");
  const subFolder12 = gLocalInboxFolder.addSubfolder("subfolder12");
  const subFolder21 = subFolder11.addSubfolder("subfolder21");
  const subFolder22 = subFolder12.addSubfolder("subfolder22");

  // add a global preference
  const propertyName = "iexist";
  const invalidName = "idontexist";
  const globalPref = "mail.server.default." + propertyName;
  const globalValue = "iAmGlobal";
  const folderValue = "iAmFolder";
  const folderValue2 = "iAmFolder2";
  const rootValue = "iAmRoot";
  const prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Ci.nsIPrefBranch);
  prefs.setCharPref(globalPref, globalValue);

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
  gLocalIncomingServer.setCharValue(propertyName, rootValue);
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
  gLocalIncomingServer.setForcePropertyEmpty(propertyName, true);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), "");
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), "");
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), "");

  // reset a server to allow inheritance from the global
  gLocalIncomingServer.setCharValue(propertyName, "");
  gLocalIncomingServer.setForcePropertyEmpty(propertyName, false);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), globalValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), globalValue);

  // check with all levels populated
  subFolder21.setStringProperty(propertyName, folderValue2);
  gLocalIncomingServer.setCharValue(propertyName, rootValue);
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), rootValue);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue2);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), rootValue);
  
  // clear the global value and the root value
  prefs.clearUserPref(globalPref);
  gLocalIncomingServer.setCharValue(propertyName, "");
  do_check_eq(rootFolder.getInheritedStringProperty(propertyName), null);
  do_check_eq(subFolder11.getInheritedStringProperty(propertyName), folderValue);
  do_check_eq(subFolder12.getInheritedStringProperty(propertyName), null);
  do_check_eq(subFolder21.getInheritedStringProperty(propertyName), folderValue2);
  do_check_eq(subFolder22.getInheritedStringProperty(propertyName), null);

}
