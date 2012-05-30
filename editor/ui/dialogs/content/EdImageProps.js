/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gAnchorElement = null;
var gLinkElement = null;
var gOriginalHref = "";
var gHNodeArray = {};

// dialog initialization code

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  ImageStartup();
  gDialog.hrefInput        = document.getElementById("hrefInput");
  gDialog.makeRelativeLink = document.getElementById("MakeRelativeLink");
  gDialog.showLinkBorder   = document.getElementById("showLinkBorder");
  gDialog.linkTab          = document.getElementById("imageLinkTab");
  gDialog.linkAdvanced     = document.getElementById("LinkAdvancedEditButton");

  // Get a single selected image element
  var tagName = "img";
  if ("arguments" in window && window.arguments[0])
  {
    imageElement = window.arguments[0];
    // We've been called from form field propertes, so we can't insert a link
    gDialog.linkTab.parentNode.removeChild(gDialog.linkTab);
    gDialog.linkTab = null;
  }
  else
  {
    // First check for <input type="image">
    try {
      imageElement = editor.getSelectedElement("input");

      if (!imageElement || imageElement.getAttribute("type") != "image") {
        // Get a single selected image element
        imageElement = editor.getSelectedElement(tagName);
        if (imageElement)
          gAnchorElement = editor.getElementOrParentByTagName("href", imageElement);
      }
    } catch (e) {}

  }

  if (imageElement)
  {
    // We found an element and don't need to insert one
    if (imageElement.hasAttribute("src"))
    {
      gInsertNewImage = false;
      gActualWidth  = imageElement.naturalWidth;
      gActualHeight = imageElement.naturalHeight;
    }
  }
  else
  {
    gInsertNewImage = true;

    // We don't have an element selected,
    //  so create one with default attributes
    try {
      imageElement = editor.createElementWithDefaults(tagName);
    } catch(e) {}

    if (!imageElement)
    {
      dump("Failed to get selected element or create a new one!\n");
      window.close();
      return;
    }
    try {
      gAnchorElement = editor.getSelectedElement("href");
    } catch (e) {}
  }

  // Make a copy to use for AdvancedEdit
  globalElement = imageElement.cloneNode(false);

  // We only need to test for this once per dialog load
  gHaveDocumentUrl = GetDocumentBaseUrl();

  InitDialog();
  if (gAnchorElement)
  {
    gOriginalHref = gAnchorElement.getAttribute("href");
    // Make a copy to use for AdvancedEdit
    gLinkElement = gAnchorElement.cloneNode(false);
  }
  else
  {
    gLinkElement = editor.createElementWithDefaults("a");
  }
  gDialog.hrefInput.value = gOriginalHref;

  FillLinkMenulist(gDialog.hrefInput, gHNodeArray);
  ChangeLinkLocation();

  // Save initial source URL
  gOriginalSrc = gDialog.srcInput.value;

  // By default turn constrain on, but both width and height must be in pixels
  gDialog.constrainCheckbox.checked =
    gDialog.widthUnitsMenulist.selectedIndex == 0 &&
    gDialog.heightUnitsMenulist.selectedIndex == 0;

  // Start in "Link" tab if 2nd arguement is true
  if (gDialog.linkTab && "arguments" in window && window.arguments[1])
  {
    document.getElementById("TabBox").selectedTab = gDialog.linkTab;
    SetTextboxFocus(gDialog.hrefInput);
  }
  else
    SetTextboxFocus(gDialog.srcInput);

  SetWindowLocation();
}

// Set dialog widgets with attribute data
// We get them from globalElement copy so this can be used
//   by AdvancedEdit(), which is shared by all property dialogs
function InitDialog()
{
  InitImage();
  var border = TrimString(gDialog.border.value);
  gDialog.showLinkBorder.checked = border != "" && border > 0;
}

function ChangeLinkLocation()
{
  var href = TrimString(gDialog.hrefInput.value);
  SetRelativeCheckbox(gDialog.makeRelativeLink);
  gDialog.showLinkBorder.disabled = !href;
  gDialog.linkAdvanced.disabled = !href;
  gLinkElement.setAttribute("href", href);
}

function ToggleShowLinkBorder()
{
  if (gDialog.showLinkBorder.checked)
  {
    var border = TrimString(gDialog.border.value);
    if (!border || border == "0")
      gDialog.border.value = "2";
  }
  else
  {
    gDialog.border.value = "0";
  }
}

// Get data from widgets, validate, and set for the global element
//   accessible to AdvancedEdit() [in EdDialogCommon.js]
function ValidateData()
{
  return ValidateImage();
}

function onAccept()
{
  // Use this now (default = false) so Advanced Edit button dialog doesn't trigger error message
  gDoAltTextError = true;

  if (ValidateData())
  {
    if ("arguments" in window && window.arguments[0])
    {
      SaveWindowLocation();
      return true;
    }

    var editor = GetCurrentEditor();

    editor.beginTransaction();

    try
    {
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
        // un-comment to see that inserting image maps does not work!
        /*
        gImageMap = editor.createElementWithDefaults("map");
        gImageMap.setAttribute("name", "testing");
        var testArea = editor.createElementWithDefaults("area");
        testArea.setAttribute("shape", "circle");
        testArea.setAttribute("coords", "86,102,52");
        testArea.setAttribute("href", "test");
        gImageMap.appendChild(testArea);
        */

        // Assign to map if there is one
        var mapName = gImageMap.getAttribute("name");
        if (mapName != "")
        {
          globalElement.setAttribute("usemap", ("#"+mapName));
          if (globalElement.getAttribute("border") == "")
            globalElement.setAttribute("border", 0);
        }
      }

      // Create or remove the link as appropriate
      var href = gDialog.hrefInput.value;
      if (href != gOriginalHref)
      {
        if (href && !gInsertNewImage)
        {
          EditorSetTextProperty("a", "href", href);
          // gAnchorElement is needed for cloning attributes later.
          if (!gAnchorElement)
            gAnchorElement = editor.getElementOrParentByTagName("href", imageElement);
        }
        else
        {
          EditorRemoveTextProperty("href", "");
        }
      }

      // If inside a link, always write the 'border' attribute
      if (href)
      {
        if (gDialog.showLinkBorder.checked)
        {
          // Use default = 2 if border attribute is empty
          if (!globalElement.hasAttribute("border"))
            globalElement.setAttribute("border", "2");
        }
        else
          globalElement.setAttribute("border", "0");
      }

      if (gInsertNewImage)
      {
        if (href) {
          gLinkElement.appendChild(imageElement);
          editor.insertElementAtSelection(gLinkElement, true);
        }
        else
          // 'true' means delete the selection before inserting
          editor.insertElementAtSelection(imageElement, true);
      }

      // Check to see if the link was to a heading
      // Do this last because it moves the caret (BAD!)
      if (href in gHNodeArray)
      {
        var anchorNode = editor.createElementWithDefaults("a");
        if (anchorNode)
        {
          anchorNode.name = href.substr(1);
          // Remember to use editor method so it is undoable!
          editor.insertNode(anchorNode, gHNodeArray[href], 0, false);
        }
      }
      // All values are valid - copy to actual element in doc or
      //   element we just inserted
      editor.cloneAttributes(imageElement, globalElement);
      if (gAnchorElement)
        editor.cloneAttributes(gAnchorElement, gLinkElement);

      // If document is empty, the map element won't insert,
      //  so always insert the image first
      if (gImageMap && gInsertNewIMap)
      {
        // Insert the ImageMap element at beginning of document
        var body = editor.rootElement;
        editor.setShouldTxnSetSelection(false);
        editor.insertNode(gImageMap, body, 0);
        editor.setShouldTxnSetSelection(true);
      }
    }
    catch (e)
    {
      dump(e);
    }

    editor.endTransaction();

    SaveWindowLocation();
    return true;
  }

  gDoAltTextError = false;

  return false;
}

function onLinkAdvancedEdit()
{
  window.AdvancedEditOK = false;
  window.openDialog("chrome://editor/content/EdAdvancedEdit.xul", "_blank",
                    "chrome,close,titlebar,modal,resizable=yes", "",
                    gLinkElement);
  window.focus();
  if (window.AdvancedEditOK)
    gDialog.hrefInput.value = gLinkElement.getAttribute("href");
}
