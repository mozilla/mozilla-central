/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var tagName = "hr";
var gHLineElement;
var width;
var height;
var align;
var shading;
const gMaxHRSize = 1000; // This is hard-coded in nsHTMLHRElement::StringToAttribute()

// dialog initialization code
function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }
  try {
    // Get the selected horizontal line
    gHLineElement = editor.getSelectedElement(tagName);
  } catch (e) {}

  if (!gHLineElement) {
    // We should never be here if not editing an existing HLine
    window.close();
    return;
  }
  gDialog.heightInput = document.getElementById("height");
  gDialog.widthInput = document.getElementById("width");
  gDialog.leftAlign = document.getElementById("leftAlign");
  gDialog.centerAlign = document.getElementById("centerAlign");
  gDialog.rightAlign = document.getElementById("rightAlign");
  gDialog.alignGroup = gDialog.rightAlign.radioGroup;
  gDialog.shading = document.getElementById("3dShading");
  gDialog.pixelOrPercentMenulist = document.getElementById("pixelOrPercentMenulist");

  // Make a copy to use for AdvancedEdit and onSaveDefault
  globalElement = gHLineElement.cloneNode(false);

  // Initialize control values based on existing attributes
  InitDialog()

  // SET FOCUS TO FIRST CONTROL
  SetTextboxFocus(gDialog.widthInput);

  // Resize window
  window.sizeToContent();

  SetWindowLocation();
}

// Set dialog widgets with attribute data
// We get them from globalElement copy so this can be used
//   by AdvancedEdit(), which is shared by all property dialogs
function InitDialog()
{
  // Just to be confusing, "size" is used instead of height because it does
  // not accept % values, only pixels
  var height = GetHTMLOrCSSStyleValue(globalElement, "size", "height")
  if (height.contains("px")) {
    height = height.substr(0, height.indexOf("px"));
  }
  if(!height) {
    height = 2; //Default value
  }

  // We will use "height" here and in UI
  gDialog.heightInput.value = height;

  // Get the width attribute of the element, stripping out "%"
  // This sets contents of menulist (adds pixel and percent menuitems elements)
  gDialog.widthInput.value = InitPixelOrPercentMenulist(globalElement, gHLineElement, "width","pixelOrPercentMenulist");

  var marginLeft  = GetHTMLOrCSSStyleValue(globalElement, "align", "margin-left").toLowerCase();
  var marginRight = GetHTMLOrCSSStyleValue(globalElement, "align", "margin-right").toLowerCase();
  align = marginLeft + " " + marginRight;
  gDialog.leftAlign.checked   = (align == "left left"     || align == "0px auto");
  gDialog.centerAlign.checked = (align == "center center" || align == "auto auto" || align == " ");
  gDialog.rightAlign.checked  = (align == "right right"   || align == "auto 0px");

  if (gDialog.centerAlign.checked) {
    gDialog.alignGroup.selectedItem = gDialog.centerAlign;
  }
  else if (gDialog.rightAlign.checked) {
    gDialog.alignGroup.selectedItem = gDialog.rightAlign;
  }
  else {
    gDialog.alignGroup.selectedItem = gDialog.leftAlign;
  }

  gDialog.shading.checked = !globalElement.hasAttribute("noshade");
}

function onSaveDefault()
{
  // "false" means set attributes on the globalElement,
  //   not the real element being edited
  if (ValidateData()) {
    var alignInt;
    if (align == "left") {
      alignInt = 0;
    } else if (align == "right") {
      alignInt = 2;
    } else {
      alignInt = 1;
    }
    Services.prefs.setIntPref("editor.hrule.align", alignInt);

    var percent;
    var widthInt;
    var heightInt;

    if (width)
    {
      if (width.contains("%")) {
        percent = true;
        widthInt = Number(width.substr(0, width.indexOf("%")));
      } else {
        percent = false;
        widthInt = Number(width);
      }
    }
    else
    {
      percent = true;
      widthInt = Number(100);
    }

    heightInt = height ? Number(height) : 2;

    Services.prefs.setIntPref("editor.hrule.width", widthInt);
    Services.prefs.setBoolPref("editor.hrule.width_percent", percent);
    Services.prefs.setIntPref("editor.hrule.height", heightInt);
    Services.prefs.setBoolPref("editor.hrule.shading", shading);

    // Write the prefs out NOW!
    Services.prefs.savePrefFile(null);
	}
}

// Get and validate data from widgets.
// Set attributes on globalElement so they can be accessed by AdvancedEdit()
function ValidateData()
{
  // Height is always pixels
  height = ValidateNumber(gDialog.heightInput, null, 1, gMaxHRSize,
                          globalElement, "size", false);
  if (gValidationError)
    return false;

  width = ValidateNumber(gDialog.widthInput, gDialog.pixelOrPercentMenulist, 1, gMaxPixels, 
                         globalElement, "width", false);
  if (gValidationError)
    return false;

  align = "left";
  if (gDialog.centerAlign.selected) {
    // Don't write out default attribute
    align = "";
  } else if (gDialog.rightAlign.selected) {
    align = "right";
  }
  if (align)
    globalElement.setAttribute("align", align);
  else
    try {
      GetCurrentEditor().removeAttributeOrEquivalent(globalElement, "align", true);
    } catch (e) {}

  if (gDialog.shading.checked) {
    shading = true;
    globalElement.removeAttribute("noshade");
  } else {
    shading = false;
    globalElement.setAttribute("noshade", "noshade");
  }
  return true;
}

function onAccept()
{
  if (ValidateData())
  {
    // Copy attributes from the globalElement to the document element
    try {
      GetCurrentEditor().cloneAttributes(gHLineElement, globalElement);
    } catch (e) {}
    return true;
  }
  return false;
}
