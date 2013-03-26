/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const FOLDERS = 1;
const MESSAGES = 2;
var dialog;

function onLoad()
{
  var windowArgs = window.arguments[0];

  dialog = {};

  dialog.nameField = document.getElementById("name");
  dialog.nameField.focus();

  // call this when OK is pressed
  dialog.okCallback = windowArgs.okCallback;

  // pre select the folderPicker, based on what they selected in the folder pane
  dialog.folder = windowArgs.folder;
  try {
    document.getElementById("MsgNewFolderPopup").selectFolder(windowArgs.folder);
  } catch(ex) {
    // selected a child folder
      document.getElementById("msgNewFolderPicker")
          .setAttribute("label", windowArgs.folder.prettyName);
  }

  // can folders contain both folders and messages?
  if (windowArgs.dualUseFolders) {
    dialog.folderType = FOLDERS | MESSAGES;

    // hide the section when folder contain both folders and messages.
    var newFolderTypeBox = document.getElementById("newFolderTypeBox");
    newFolderTypeBox.setAttribute("hidden", "true");
  } else {
    // set our folder type by calling the default selected type's oncommand
    var selectedFolderType = document.getElementById("folderGroup").selectedItem;
    eval(selectedFolderType.getAttribute("oncommand"));
  }

  doEnabling();
}

function onFolderSelect(event) {
  dialog.folder = event.target._folder;
  document.getElementById("msgNewFolderPicker")
          .setAttribute("label", dialog.folder.prettyName);
}

function onOK()
{
  var name = dialog.nameField.value;
  var uri = dialog.folder;

  // do name validity check?

  // make sure name ends in  "/" if folder to create can only contain folders
  if ((dialog.folderType == FOLDERS) && !name.endsWith("/"))
    dialog.okCallback(name + "/", dialog.folder);
  else
    dialog.okCallback(name, dialog.folder);

  return true;
}

function onFoldersOnly()
{
  dialog.folderType = FOLDERS;
}

function onMessagesOnly()
{
  dialog.folderType = MESSAGES;
}

function doEnabling()
{
  document.documentElement.getButton("accept").disabled = !dialog.nameField.value;
}

