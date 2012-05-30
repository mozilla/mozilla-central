/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var insertNew;
var textareaElement;

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

  gDialog = {
    accept:             document.documentElement.getButton("accept"),
    textareaName:       document.getElementById("TextAreaName"),
    textareaRows:       document.getElementById("TextAreaRows"),
    textareaCols:       document.getElementById("TextAreaCols"),
    textareaWrap:       document.getElementById("TextAreaWrap"),
    textareaReadOnly:   document.getElementById("TextAreaReadOnly"),
    textareaDisabled:   document.getElementById("TextAreaDisabled"),
    textareaTabIndex:   document.getElementById("TextAreaTabIndex"),
    textareaAccessKey:  document.getElementById("TextAreaAccessKey"),
    textareaValue:      document.getElementById("TextAreaValue"),
    MoreSection:        document.getElementById("MoreSection"),
    MoreFewerButton:    document.getElementById("MoreFewerButton")
  };

  // Get a single selected text area element
  const kTagName = "textarea";
  try {
    textareaElement = editor.getSelectedElement(kTagName);
  } catch (e) {}

  if (textareaElement) {
    // We found an element and don't need to insert one
    insertNew = false;

    gDialog.textareaValue.value = textareaElement.value;
  }
  else
  {
    insertNew = true;

    // We don't have an element selected,
    //  so create one with default attributes
    try {
      textareaElement = editor.createElementWithDefaults(kTagName);
    } catch(e) {}

    if (!textareaElement)
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    else
      gDialog.textareaValue.value = GetSelectionAsText();
  }

  // Make a copy to use for AdvancedEdit
  globalElement = textareaElement.cloneNode(false);

  InitDialog();

  InitMoreFewer();

  SetTextboxFocus(gDialog.textareaName);
  
  SetWindowLocation();
}

function InitDialog()
{
  gDialog.textareaName.value = globalElement.getAttribute("name");
  gDialog.textareaRows.value = globalElement.getAttribute("rows");
  gDialog.textareaCols.value = globalElement.getAttribute("cols");
  gDialog.textareaWrap.value = GetHTMLOrCSSStyleValue(globalElement, "wrap", "white-space");
  gDialog.textareaReadOnly.checked = globalElement.hasAttribute("readonly");
  gDialog.textareaDisabled.checked = globalElement.hasAttribute("disabled");
  gDialog.textareaTabIndex.value = globalElement.getAttribute("tabindex");
  gDialog.textareaAccessKey.value = globalElement.getAttribute("accesskey");
  onInput();
}

function onInput()
{
  var disabled = !gDialog.textareaName.value || !gDialog.textareaRows.value || !gDialog.textareaCols.value;
  if (gDialog.accept.disabled != disabled)
    gDialog.accept.disabled = disabled;
}

function ValidateData()
{
  var attributes = {
    name: gDialog.textareaName.value,
    rows: gDialog.textareaRows.value,
    cols: gDialog.textareaCols.value,
    wrap: gDialog.textareaWrap.value,
    tabindex: gDialog.textareaTabIndex.value,
    accesskey: gDialog.textareaAccessKey.value
  };
  var flags = {
    readonly: gDialog.textareaReadOnly.checked,
    disabled: gDialog.textareaDisabled.checked
  };
  for (var a in attributes)
  {
    if (attributes[a])
      globalElement.setAttribute(a, attributes[a]);
    else
      globalElement.removeAttribute(a);
  }
  for (var f in flags)
  {
    if (flags[f])
      globalElement.setAttribute(f, "");
    else
      globalElement.removeAttribute(f);
  }
  return true;
}

function onAccept()
{
  // All values are valid - copy to actual element in doc or
  //   element created to insert
  ValidateData();

  var editor = GetCurrentEditor();

  editor.beginTransaction();

  try {
    editor.cloneAttributes(textareaElement, globalElement);

    if (insertNew)
      editor.insertElementAtSelection(textareaElement, true);

    // undoably set value
    var initialText = gDialog.textareaValue.value;
    if (initialText != textareaElement.value) {
      editor.setShouldTxnSetSelection(false);

      while (textareaElement.hasChildNodes())
        editor.deleteNode(textareaElement.lastChild);
      if (initialText) {
        var textNode = editor.document.createTextNode(initialText);
        editor.insertNode(textNode, textareaElement, 0);
      }

      editor.setShouldTxnSetSelection(true);
    }
  } finally {
    editor.endTransaction();
  }

  SaveWindowLocation();

  return true;
}

