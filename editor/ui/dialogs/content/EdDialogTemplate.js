/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


//Cancel() is in EdDialogCommon.js
var insertNew = true;
var tagname = "TAG NAME"

// dialog initialization code
function Startup()
{
  if (!GetCurrentEditor())
  {
    window.close();
    return;
  }
  // gDialog is declared in EdDialogCommon.js
  // Set commonly-used widgets like this:
  gDialog.fooButton = document.getElementById("fooButton");

  initDialog();
  
  // Set window location relative to parent window (based on persisted attributes)
  SetWindowLocation();

  // Set focus to first widget in dialog, e.g.:
  SetTextboxFocus(gDialog.fooButton);
}

function InitDialog() 
{
  // Initialize all dialog widgets here,
  // e.g., get attributes from an element for property dialog
}

function onAccept()
{
  // Validate all user data and set attributes and possibly insert new element here
  // If there's an error the user must correct, return false to keep dialog open.
  
  SaveWindowLocation();
  return true; // do close the window
}
