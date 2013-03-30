/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://gre/modules/Services.jsm");

var dialog;

/**
 * Pass in keyToEdit as a window argument to turn this dialog into an edit
 * tag dialog.
 */
function onLoad()
{
  let windowArgs = window.arguments[0];

  dialog = {};

  dialog.OKButton = document.documentElement.getButton("accept");
  dialog.nameField = document.getElementById("name");
  dialog.nameField.focus();

  // call this when OK is pressed
  dialog.okCallback = windowArgs.okCallback;
  if (windowArgs.keyToEdit)
    initializeForEditing(windowArgs.keyToEdit);

  doEnabling();
}

/**
 * Turn the new tag dialog into an edit existing tag dialog
 */
function initializeForEditing(aTagKey)
{
  dialog.editTagKey = aTagKey;

  // Change the title of the dialog
  var messengerBundle = document.getElementById("bundle_messenger");
  document.title = messengerBundle.getString("editTagTitle");

  // override the OK button
  document.documentElement.setAttribute("ondialogaccept", "return onOKEditTag();");

  // extract the color and name for the current tag
  document.getElementById("tagColorPicker").color = MailServices.tags.getColorForKey(aTagKey);
  dialog.nameField.value = MailServices.tags.getTagForKey(aTagKey);
}

/**
 * on OK handler for editing a new tag. 
 */
function onOKEditTag()
{
  // get the tag name of the current key we are editing
  let existingTagName = MailServices.tags.getTagForKey(dialog.editTagKey);

  // it's ok if the name didn't change
  if (existingTagName != dialog.nameField.value)
  {
    // don't let the user edit a tag to the name of another existing tag
    if (MailServices.tags.getKeyForTag(dialog.nameField.value))
    {
      alertForExistingTag();
      return false; // abort the OK
    }

    MailServices.tags.setTagForKey(dialog.editTagKey, dialog.nameField.value);
  }

  MailServices.tags.setColorForKey(dialog.editTagKey, document.getElementById("tagColorPicker").color);
  return dialog.okCallback();
}

/**
 * on OK handler for creating a new tag. Alerts the user if a tag with 
 * the name already exists.
 */
function onOKNewTag()
{
  var name = dialog.nameField.value;

  if (MailServices.tags.getKeyForTag(name))
  {
    alertForExistingTag();
    return false;
  }
  return dialog.okCallback(name, document.getElementById("tagColorPicker").color);
}

/**
 * Alerts the user that they are trying to create a tag with a name that
 * already exists.
 */
function alertForExistingTag()
{
  var messengerBundle = document.getElementById("bundle_messenger");
  var alertText = messengerBundle.getString("tagExists");
  Services.prompt.alert(window, document.title, alertText);
}

function doEnabling()
{
  dialog.OKButton.disabled = !dialog.nameField.value;
}
