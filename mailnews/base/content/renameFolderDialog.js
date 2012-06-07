/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var dialog;

function onLoad()
{
  var windowArgs = window.arguments[0];

  dialog = {};

  dialog.OKButton = document.documentElement.getButton("accept");

  dialog.nameField = document.getElementById("name");
  dialog.nameField.value = windowArgs.name;
  dialog.nameField.select();
  dialog.nameField.focus();

  // call this when OK is pressed
  dialog.okCallback = windowArgs.okCallback;

  // pre select the folderPicker, based on what they selected in the folder pane
  dialog.preselectedFolderURI = windowArgs.preselectedURI;

  doEnabling();
}

function onOK()
{
  dialog.okCallback(dialog.nameField.value, dialog.preselectedFolderURI);

  return true;
}

function doEnabling()
{
  if (dialog.nameField.value) {
    if (dialog.OKButton.disabled)
      dialog.OKButton.disabled = false;
  } else {
    if (!dialog.OKButton.disabled)
      dialog.OKButton.disabled = true;
  }
}
