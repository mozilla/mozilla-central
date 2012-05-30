/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Insert Source HTML dialog */

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  document.documentElement.getButton("accept").removeAttribute("default");

  // Create dialog object to store controls for easy access
  gDialog.srcInput = document.getElementById("srcInput");

  var selection;
  try {
    selection = editor.outputToString("text/html", kOutputFormatted | kOutputSelectionOnly | kOutputWrap);
  } catch (e) {}
  if (selection)
  {
    selection = (selection.replace(/<body[^>]*>/,"")).replace(/<\/body>/,"");
    if (selection)
      gDialog.srcInput.value = selection;
  }
  // Set initial focus
  gDialog.srcInput.focus();
  // Note: We can't set the caret location in a multiline textbox
  SetWindowLocation();
}

function onAccept()
{
  if (gDialog.srcInput.value)
  {
    try {
      GetCurrentEditor().insertHTML(gDialog.srcInput.value);
    } catch (e) {}
  }
  else
  {
    dump("Null value -- not inserting in HTML Source dialog\n");
    return false;
  }
  SaveWindowLocation();

  return true;
}

