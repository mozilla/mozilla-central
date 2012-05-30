/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// dialog initialization code
function Startup()
{
  if (!GetCurrentEditor())
  {
    window.close();
    return;
  }
  
  SetWindowLocation();
}

function KeepCurrentPage()
{
  // Simply close dialog and don't change current page
  //TODO: Should we force saving of the current page?
  SaveWindowLocation();
  return true;
}

function UseOtherPage()
{
  // Reload the URL -- that will get other editor's contents
  window.opener.setTimeout(window.opener.EditorLoadUrl, 0, GetDocumentUrl());
  SaveWindowLocation();
  return true;
}

function PreventCancel()
{
  SaveWindowLocation();

  // Don't let Esc key close the dialog!
  return false;
}
