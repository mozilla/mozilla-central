/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var insertNew;
var buttonElement;

// dialog initialization code

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  gDialog = {
    buttonType:       document.getElementById("ButtonType"),
    buttonName:       document.getElementById("ButtonName"),
    buttonValue:      document.getElementById("ButtonValue"),
    buttonDisabled:   document.getElementById("ButtonDisabled"),
    buttonTabIndex:   document.getElementById("ButtonTabIndex"),
    buttonAccessKey:  document.getElementById("ButtonAccessKey"),
    MoreSection:      document.getElementById("MoreSection"),
    MoreFewerButton:  document.getElementById("MoreFewerButton"),
    RemoveButton:     document.getElementById("RemoveButton")
  };

  // Get a single selected button element
  const kTagName = "button";
  try {
    buttonElement = editor.getSelectedElement(kTagName);
  } catch (e) {}

  if (buttonElement)
    // We found an element and don't need to insert one
    insertNew = false;
  else
  {
    insertNew = true;

    // We don't have an element selected,
    //  so create one with default attributes
    try {
      buttonElement = editor.createElementWithDefaults(kTagName);
    } catch (e) {}

    if (!buttonElement)
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    // Hide button removing existing button
    gDialog.RemoveButton.hidden = true;
  }

  // Make a copy to use for AdvancedEdit
  globalElement = buttonElement.cloneNode(false);

  InitDialog();

  InitMoreFewer();

  gDialog.buttonType.focus();

  SetWindowLocation();
}

function InitDialog()
{
  var type = globalElement.getAttribute("type");
  var index = 0;
  switch (type)
  {
    case "button":
      index = 2;
      break;
    case "reset":
      index = 1;
      break;
  }
  gDialog.buttonType.selectedIndex = index;
  gDialog.buttonName.value = globalElement.getAttribute("name");
  gDialog.buttonValue.value = globalElement.getAttribute("value");
  gDialog.buttonDisabled.setAttribute("checked", globalElement.hasAttribute("disabled"));
  gDialog.buttonTabIndex.value = globalElement.getAttribute("tabindex");
  gDialog.buttonAccessKey.value = globalElement.getAttribute("accesskey");
}

function RemoveButton()
{
  RemoveContainer(buttonElement);
  SaveWindowLocation();
  window.close();
}

function ValidateData()
{
  var attributes = {
    type: ["", "reset", "button"][gDialog.buttonType.selectedIndex],
    name: gDialog.buttonName.value,
    value: gDialog.buttonValue.value,
    tabindex: gDialog.buttonTabIndex.value,
    accesskey: gDialog.buttonAccessKey.value
  };
  for (var a in attributes)
  {
    if (attributes[a])
      globalElement.setAttribute(a, attributes[a]);
    else
      globalElement.removeAttribute(a);
  }
  if (gDialog.buttonDisabled.checked)
    globalElement.setAttribute("disabled", "");
  else
    globalElement.removeAttribute("disabled");
  return true;
}

function onAccept()
{
  // All values are valid - copy to actual element in doc or
  //   element created to insert
  ValidateData();

  var editor = GetCurrentEditor();

  editor.cloneAttributes(buttonElement, globalElement);

  if (insertNew)
  {
    if (!InsertElementAroundSelection(buttonElement))
    {
      buttonElement.innerHTML = editor.outputToString("text/html", kOutputSelectionOnly);
      editor.insertElementAtSelection(buttonElement, true);
    }
  }

  SaveWindowLocation();

  return true;
}

