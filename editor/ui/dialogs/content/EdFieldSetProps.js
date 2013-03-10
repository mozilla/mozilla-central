/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var insertNew;
var fieldsetElement;
var newLegend;
var legendElement;

// dialog initialization code

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    dump("Failed to get active editor!\n");
    window.close();
    return;
  }

  gDialog.editText = document.getElementById("EditText");
  gDialog.legendText = document.getElementById("LegendText");
  gDialog.legendAlign = document.getElementById("LegendAlign");
  gDialog.RemoveFieldSet = document.getElementById("RemoveFieldSet");

  // Get a single selected field set element
  const kTagName = "fieldset";
  try {
    // Find a selected fieldset, or if one is at start or end of selection.
    fieldsetElement = editor.getSelectedElement(kTagName);
    if (!fieldsetElement)
      fieldsetElement = editor.getElementOrParentByTagName(kTagName, editor.selection.anchorNode);
    if (!fieldsetElement)
      fieldsetElement = editor.getElementOrParentByTagName(kTagName, editor.selection.focusNode);
  } catch (e) {}

  if (fieldsetElement)
    // We found an element and don't need to insert one
    insertNew = false;
  else
  {
    insertNew = true;

    // We don't have an element selected,
    //  so create one with default attributes
    try {
      fieldsetElement = editor.createElementWithDefaults(kTagName);
    } catch (e) {}

    if (!fieldsetElement)
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    // Hide button removing existing fieldset
    gDialog.RemoveFieldSet.hidden = true;
  }

  legendElement = fieldsetElement.firstChild;
  if (legendElement && legendElement.localName == "LEGEND")
  {
    newLegend = false;
    var range = editor.document.createRange();
    range.selectNode(legendElement);
    gDialog.legendText.value = range.toString();
    if (legendElement.innerHTML.contains("<"))
    {
      gDialog.editText.checked = false;
      gDialog.editText.disabled = false;
      gDialog.legendText.disabled = true;
      gDialog.editText.addEventListener("command", onEditText, false);
      gDialog.RemoveFieldSet.focus();
    }
    else
      SetTextboxFocus(gDialog.legendText);
  }
  else
  {
    newLegend = true;

    // We don't have an element selected,
    //  so create one with default attributes

    legendElement = editor.createElementWithDefaults("legend");
    if (!legendElement)
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    SetTextboxFocus(gDialog.legendText);
  }

  // Make a copy to use for AdvancedEdit
  globalElement = legendElement.cloneNode(false);

  InitDialog();

  SetWindowLocation();
}

function InitDialog()
{
  gDialog.legendAlign.value = GetHTMLOrCSSStyleValue(globalElement, "align", "caption-side");
}

function onEditText()
{
  gDialog.editText.removeEventListener("command", onEditText, false);
  Services.prompt.alert(window, GetString("Alert"), GetString("EditTextWarning"));
}

function RemoveFieldSet()
{
  var editor = GetCurrentEditor();
  editor.beginTransaction();
  try {
    if (!newLegend)
      editor.deleteNode(legendElement);
    RemoveBlockContainer(fieldsetElement);
  } finally {
    editor.endTransaction();
  }
  SaveWindowLocation();
  window.close();
}

function ValidateData()
{
  if (gDialog.legendAlign.value)
    globalElement.setAttribute("align", gDialog.legendAlign.value);
  else
    globalElement.removeAttribute("align");
  return true;
}

function onAccept()
{
  // All values are valid - copy to actual element in doc
  ValidateData();

  var editor = GetCurrentEditor();

  editor.beginTransaction();

  try {
    editor.cloneAttributes(legendElement, globalElement);
 
    if (insertNew)
    {
      if (gDialog.legendText.value)
      {
        fieldsetElement.appendChild(legendElement);
        legendElement.appendChild(editor.document.createTextNode(gDialog.legendText.value));
      }
      InsertElementAroundSelection(fieldsetElement);
    }
    else if (gDialog.editText.checked)
    {
      editor.setShouldTxnSetSelection(false);

      if (gDialog.legendText.value)
      {
        if (newLegend)
          editor.insertNode(legendElement, fieldsetElement, 0, true);
        else while (legendElement.firstChild)
          editor.deleteNode(legendElement.lastChild);
        editor.insertNode(editor.document.createTextNode(gDialog.legendText.value), legendElement, 0);
      }
      else if (!newLegend)
        editor.deleteNode(legendElement);

      editor.setShouldTxnSetSelection(true);
    }
  }
  finally {
    editor.endTransaction();
  }

  SaveWindowLocation();

  return true;
}

