/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    inputName:      document.getElementById( "InputName" ),
    inputDisabled:  document.getElementById( "InputDisabled" ),
    inputTabIndex:  document.getElementById( "InputTabIndex" )
  };

  ImageStartup();

  // Get a single selected input element
  var tagName = "input";
  try {
    imageElement = editor.getSelectedElement(tagName);
  } catch (e) {}

  if (imageElement)
  {
    // We found an element and don't need to insert one
    gInsertNewImage = false;
  }
  else
  {
    gInsertNewImage = true;

    // We don't have an element selected,
    //  so create one with default attributes
    try {
      imageElement = editor.createElementWithDefaults(tagName);
    } catch(e) {}

    if (!imageElement )
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    var imgElement;
    try {
      imgElement = editor.getSelectedElement("img");
    } catch(e) {}

    if (imgElement)
    {
      // We found an image element, convert it to an input type="image"
      var attributes = ["src", "alt", "width", "height", "hspace", "vspace", "border", "align", "usemap", "ismap"];
      for (i in attributes)
        imageElement.setAttribute(attributes[i], imgElement.getAttribute(attributes[i]));
    }
  }

  // Make a copy to use for AdvancedEdit
  globalElement = imageElement.cloneNode(false);

  // We only need to test for this once per dialog load
  gHaveDocumentUrl = GetDocumentBaseUrl();

  InitDialog();

  // Save initial source URL
  gOriginalSrc = gDialog.srcInput.value;

  // By default turn constrain on, but both width and height must be in pixels
  gDialog.constrainCheckbox.checked =
    gDialog.widthUnitsMenulist.selectedIndex == 0 &&
    gDialog.heightUnitsMenulist.selectedIndex == 0;

  SetTextboxFocus(gDialog.inputName);

  SetWindowLocation();
}

function InitDialog()
{
  InitImage();
  gDialog.inputName.value = globalElement.getAttribute("name");
  gDialog.inputDisabled.setAttribute("checked", globalElement.hasAttribute("disabled"));
  gDialog.inputTabIndex.value = globalElement.getAttribute("tabindex");
}

function ValidateData()
{
  if (!ValidateImage())
    return false;
  if (gDialog.inputName.value)
    globalElement.setAttribute("name", gDialog.inputName.value);
  else
    globalElement.removeAttribute("name");
  if (gDialog.inputTabIndex.value)
    globalElement.setAttribute("tabindex", gDialog.inputTabIndex.value);
  else
    globalElement.removeAttribute("tabindex");
  if (gDialog.inputDisabled.checked)
    globalElement.setAttribute("disabled", "");
  else
    globalElement.removeAttribute("disabled");
  globalElement.setAttribute("type", "image");
  return true;
}

function onAccept()
{
  // Show alt text error only once
  // (we don't initialize doAltTextError=true
  //  so Advanced edit button dialog doesn't trigger that error message)
  // Use this now (default = false) so Advanced Edit button dialog doesn't trigger error message
  gDoAltTextError = true;

  if (ValidateData())
  {

    var editor = GetCurrentEditor();
    editor.beginTransaction();

    try {
      if (gRemoveImageMap)
      {
        globalElement.removeAttribute("usemap");
        if (gImageMap)
        {
          editor.deleteNode(gImageMap);
          gInsertNewIMap = true;
          gImageMap = null;
        }
      }
      else if (gImageMap)
      {
        // Assign to map if there is one
        var mapName = gImageMap.getAttribute("name");
        if (mapName != "")
        {
          globalElement.setAttribute("usemap", ("#"+mapName));
          if (globalElement.getAttribute("border") == "")
            globalElement.setAttribute("border", 0);
        }
      }

      if (gInsertNewImage)
      {
        // 'true' means delete the selection before inserting
        // in case were are converting an image to an input type="image"
        editor.insertElementAtSelection(imageElement, true);
      }
      editor.cloneAttributes(imageElement, globalElement);

      // If document is empty, the map element won't insert,
      //  so always insert the image element first
      if (gImageMap && gInsertNewIMap)
      {
        // Insert the ImageMap element at beginning of document
        var body = editor.rootElement;
        editor.setShouldTxnSetSelection(false);
        editor.insertNode(gImageMap, body, 0);
        editor.setShouldTxnSetSelection(true);
      }
    } catch (e) {}

    editor.endTransaction();

    SaveWindowLocation();

    return true;
  }
  return false;
}

