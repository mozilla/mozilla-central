/* -*- Mode: C; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger (03/01/00)
 *   Seth Spitzer (28/10/99)
 *   Dan Veditz <dveditz@netscape.com>
 *   Brant Gurganus <brantgurganus2001@cherokeescouting.org>
 *   Neil Rashbrook <neil@parkwaycc.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gMozAppsBundle;
var gProfileBundle;
var gBrandBundle;
var gProfileService;
var gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                               .getService(Components.interfaces.nsIPromptService);
var gProfileManagerMode = "selection";
var gDialogParams = window.arguments[0]
                          .QueryInterface(Components.interfaces.nsIDialogParamBlock);

function StartUp()
{
  gMozAppsBundle = document.getElementById("bundle_mozapps");
  gProfileBundle = document.getElementById("bundle_profile");
  gBrandBundle = document.getElementById("bundle_brand");
  if (gDialogParams.objects) {
    document.documentElement.getButton("accept").setAttribute("label",
      document.documentElement.getAttribute("buttonlabelstart"));
    document.documentElement.getButton("cancel").setAttribute("label",
      document.documentElement.getAttribute("buttonlabelexit"));
    document.getElementById('intro').textContent =
      document.getElementById('intro').getAttribute("start");
    document.getElementById('offlineState').hidden = false;
    gDialogParams.SetInt(0, 0);
  }

  gProfileService = Components.classes["@mozilla.org/toolkit/profile-service;1"]
                              .getService(Components.interfaces.nsIToolkitProfileService);
  var enum = gProfileService.profiles;
  var selectedProfile = null;
  try {
    selectedProfile = gProfileService.selectedProfile;
  }
  catch (ex) {
  }
  while (enum.hasMoreElements()) {
    AddItem(enum.getNext().QueryInterface(Components.interfaces.nsIToolkitProfile),
            selectedProfile);
  }

  var autoSelect = document.getElementById("autoSelect");
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
  if (prefs.getBoolPref("profile.manage_only_at_launch"))
    autoSelect.hidden = true;
  else
    autoSelect.checked = gProfileService.startWithLastProfile;

  DoEnabling();
}

// function : <profileSelection.js>::AddItem();
// purpose  : utility function for adding items to a tree.
function AddItem(aProfile, aProfileToSelect)
{
  var tree = document.getElementById("profiles");
  var treeitem = document.createElement("treeitem");
  var treerow = document.createElement("treerow");
  var treecell = document.createElement("treecell");
  treecell.setAttribute("label", aProfile.name);
  treerow.appendChild(treecell);
  treeitem.appendChild(treerow);
  tree.lastChild.appendChild(treeitem);
  treeitem.profile = aProfile;
  if (aProfile == aProfileToSelect) {
    var profileIndex = tree.view.getIndexOfItem(treeitem);
    tree.view.selection.select(profileIndex);
    tree.treeBoxObject.ensureRowIsVisible(profileIndex);
  }
}

// function : <profileSelection.js>::AcceptDialog();
// purpose  : sets the current profile to the selected profile (user choice: "Start Mozilla")
function AcceptDialog()
{
  var autoSelect = document.getElementById("autoSelect");
  if (!autoSelect.hidden) {
    gProfileService.startWithLastProfile = autoSelect.checked;
    gProfileService.flush();
  }

  var profileTree = document.getElementById("profiles");
  var selected = profileTree.view.getItemAtIndex(profileTree.currentIndex);

  if (!gDialogParams.objects) {
    var dirServ = Components.classes['@mozilla.org/file/directory_service;1']
                            .getService(Components.interfaces.nsIProperties);
    var profD = dirServ.get("ProfD", Components.interfaces.nsIFile);
    var profLD = dirServ.get("ProfLD", Components.interfaces.nsIFile);

    if (selected.profile.rootDir.equals(profD) &&
        selected.profile.localDir.equals(profLD))
      return true;
  }

  try {
    var profileLock = selected.profile.lock({});
    gProfileService.selectedProfile = selected.profile;
    gProfileService.flush();
    if (gDialogParams.objects) {
      gDialogParams.objects.insertElementAt(profileLock, 0, false);
      gProfileService.startOffline = document.getElementById("offlineState").checked;
      gDialogParams.SetInt(0, 1);
      gDialogParams.SetString(0, selected.profile.name);
      return true;
    }
    profileLock.unlock();
  } catch (e) {
    var brandName = gBrandBundle.getString("brandShortName");
    var message = gProfileBundle.getFormattedString("dirLocked",
                                                    [brandName, selected.profile.name]);
    gPromptService.alert(window, null, message);
    return false;
  }

  try {
    var env = Components.classes["@mozilla.org/process/environment;1"]
                        .getService(Components.interfaces.nsIEnvironment);
    env.set("XRE_PROFILE_NAME", selected.profile.name);
    env.set("XRE_PROFILE_PATH", selected.profile.rootDir.path);
    env.set("XRE_PROFILE_LOCAL_PATH", selected.profile.localDir.path);
    var app = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                        .getService(Components.interfaces.nsIAppStartup);
    app.quit(app.eAttemptQuit | app.eRestart);
    return true;
  }
  catch (e) {
    env.set("XRE_PROFILE_NAME", "");
    env.set("XRE_PROFILE_PATH", "");
    env.set("XRE_PROFILE_LOCAL_PATH", "");
    return false;
  }
}

// invoke the createProfile Wizard
function CreateProfileWizard()
{
  window.openDialog('chrome://mozapps/content/profile/createProfileWizard.xul',
                    '', 'centerscreen,chrome,modal,titlebar');
}

// update the display to show the additional profile
function CreateProfile(aProfile)
{
  gProfileService.flush();
  AddItem(aProfile, aProfile);
}

// rename the selected profile
function RenameProfile()
{
  var profileTree = document.getElementById("profiles");
  var selected = profileTree.view.getItemAtIndex(profileTree.currentIndex);
  var profileName = selected.profile.name;
  var newName = {value: profileName};
  var dialogTitle = gMozAppsBundle.getString("renameProfileTitle");
  var msg = gMozAppsBundle.getFormattedString("renameProfilePrompt", [profileName]);
  if (gPromptService.prompt(window, dialogTitle, msg, newName, null, {value: 0}) &&
      newName.value != profileName) {
    if (!/\S/.test(newName.value)) {
      gPromptService.alert(window,
                           gMozAppsBundle.getString("profileNameInvalidTitle"),
                           gMozAppsBundle.getString("profileNameEmpty"));
      return false;
    }

    if (/([\\*:?<>|\/\"])/.test(newName.value)) {
      gPromptService.alert(window,
                           gMozAppsBundle.getString("profileNameInvalidTitle"),
                           gMozAppsBundle.getFormattedString("invalidChar", [RegExp.$1]));
      return false;
    }

    try {
      gProfileService.getProfileByName(newName.value);
      gPromptService.alert(window,
                           gMozAppsBundle.getString("profileExistsTitle"),
                           gMozAppsBundle.getString("profileExists"));
      return false;
    }
    catch (e) {
    }

    selected.profile.name = newName.value;
    gProfileService.flush();
    selected.firstChild.firstChild.setAttribute("label", newName.value);
  }
}

function ConfirmDelete()
{
  var profileTree = document.getElementById("profiles");
  var selected = profileTree.view.getItemAtIndex(profileTree.currentIndex);
  if (!selected.profile.rootDir.exists()) {
    DeleteProfile(false);
    return;
  }

  try {
    var profileLock = selected.profile.lock({});
    var dialogTitle = gMozAppsBundle.getString("deleteTitle");
    var dialogText;

    var path = selected.profile.rootDir.path;
    dialogText = gProfileBundle.getFormattedString("deleteProfile", [path]);
    var buttonPressed = gPromptService.confirmEx(window, dialogTitle, dialogText,
        (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
        (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1) +
        (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_2),
        gMozAppsBundle.getString("dontDeleteFiles"), null,
        gMozAppsBundle.getString("deleteFiles"), null, {value: 0});
    profileLock.unlock();
    if (buttonPressed != 1)
      DeleteProfile(buttonPressed == 2);
  } catch (e) {
    var dialogTitle = gMozAppsBundle.getString("deleteTitle");
    var brandName = gBrandBundle.getString("brandShortName");
    var dialogText = gProfileBundle.getFormattedString("deleteLocked",
                                                       [brandName, selected.profile.name]);
    gPromptService.alert(window, dialogTitle, dialogText);
  }
}

// Delete the profile, with the delete flag set as per instruction above.
function DeleteProfile(aDeleteFiles)
{
  var profileTree = document.getElementById("profiles");
  var selected = profileTree.view.getItemAtIndex(profileTree.currentIndex);
  var previous = profileTree.currentIndex && profileTree.currentIndex - 1;

  try {
    selected.profile.remove(aDeleteFiles);
    gProfileService.flush();
    profileTree.lastChild.removeChild(selected);

    if (profileTree.view.rowCount != 0) {
      profileTree.view.selection.select(previous);
      profileTree.treeBoxObject.ensureRowIsVisible(previous);
    }

    // set the button state
    DoEnabling();
  }
  catch (ex) {
    dump("Exception during profile deletion.\n");
  }
}

function SwitchProfileManagerMode()
{
  var captionLine;
  var prattleIndex;

  if (gProfileManagerMode == "selection") {
    prattleIndex = 1;
    captionLine = gProfileBundle.getString("manageTitle");

    document.getElementById("profiles").focus();

    // hide the manage profiles button...
    document.documentElement.getButton("extra2").hidden = true;
    gProfileManagerMode = "manager";
  }
  else {
    prattleIndex = 0;
    captionLine = gProfileBundle.getString("selectTitle");
    gProfileManagerMode = "selection";
  }

  // swap deck
  document.getElementById("prattle").selectedIndex = prattleIndex;

  // change the title of the profile manager/selection window.
  document.getElementById("header").setAttribute("description", captionLine);
  document.title = captionLine;
}

// do button enabling based on tree selection
function DoEnabling()
{
  var acceptButton = document.documentElement.getButton("accept");
  var deleteButton = document.getElementById("deleteButton");
  var renameButton = document.getElementById("renameButton");

  var disabled = document.getElementById("profiles").view.selection.count == 0;
  acceptButton.disabled = disabled;
  deleteButton.disabled = disabled;
  renameButton.disabled = disabled;
}

// handle key event on tree
function HandleKeyEvent(aEvent)
{
  if (gProfileManagerMode != "manager")
    return;

  switch (aEvent.keyCode)
  {
    case KeyEvent.DOM_VK_BACK_SPACE:
    case KeyEvent.DOM_VK_DELETE:
      if (!document.getElementById("deleteButton").disabled)
        ConfirmDelete();
      break;
    case KeyEvent.DOM_VK_F2:
      if (!document.getElementById("renameButton").disabled)
        RenameProfile();
  }
}

function HandleClickEvent(aEvent)
{
  if (aEvent.button == 0 && aEvent.target.parentNode.view.selection.count != 0 && AcceptDialog()) {
    window.close();
    return true;
  }

  return false;
}
