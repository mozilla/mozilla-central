/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gEditor;

// dialog initialization code
function Startup()
{
  gEditor = GetCurrentEditor();
  if (!gEditor)
  {
    window.close();
    return;
  }

  gEditor instanceof Components.interfaces.nsIHTMLAbsPosEditor;

  gDialog.enableSnapToGrid = document.getElementById("enableSnapToGrid");
  gDialog.sizeInput        = document.getElementById("size");
  gDialog.sizeLabel        = document.getElementById("sizeLabel");
  gDialog.unitLabel        = document.getElementById("unitLabel");

  // Initialize control values based on existing attributes
  InitDialog()

  // SET FOCUS TO FIRST CONTROL
  SetTextboxFocus(gDialog.sizeInput);

  // Resize window
  window.sizeToContent();

  SetWindowLocation();
}

// Set dialog widgets with attribute data
// We get them from globalElement copy so this can be used
//   by AdvancedEdit(), which is shared by all property dialogs
function InitDialog()
{
  gDialog.enableSnapToGrid.checked = gEditor.snapToGridEnabled;
  toggleSnapToGrid();

  gDialog.sizeInput.value = gEditor.gridSize;
}

function onAccept()
{
  gEditor.snapToGridEnabled = gDialog.enableSnapToGrid.checked;
  gEditor.gridSize = gDialog.sizeInput.value;

  return true;
}

function toggleSnapToGrid()
{
  SetElementEnabledById("size", gDialog.enableSnapToGrid.checked)
  SetElementEnabledById("sizeLabel", gDialog.enableSnapToGrid.checked)
  SetElementEnabledById("unitLabel", gDialog.enableSnapToGrid.checked)
}
