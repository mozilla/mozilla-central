/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const browserPrefsObserver =
{
  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic != "nsPref:changed" || document.getElementById("editor.use_custom_colors").value)
      return;

    switch (aData)
    {
      case "browser.anchor_color":
        SetColorPreview("linkText", Services.prefs.getCharPref(aData));
        break;
      case "browser.active_color":
        SetColorPreview("activeLinkText", Services.prefs.getCharPref(aData));
        break;
      case "browser.visited_color":
        SetColorPreview("visitedLinkText", Services.prefs.getCharPref(aData));
        break;
      default:
        SetBgAndFgColors(Services.prefs.getBoolPref("browser.display.use_system_colors"))
    }
  }
};

function Startup()
{
  // Add browser prefs observers
  Services.prefs.addObserver("browser.display.use_system_colors", browserPrefsObserver, false);
  Services.prefs.addObserver("browser.display.foreground_color", browserPrefsObserver, false);
  Services.prefs.addObserver("browser.display.background_color", browserPrefsObserver, false);
  Services.prefs.addObserver("browser.anchor_color", browserPrefsObserver, false);
  Services.prefs.addObserver("browser.active_color", browserPrefsObserver, false);
  Services.prefs.addObserver("browser.visited_color", browserPrefsObserver, false);

  // Add event listener so we can remove our observers
  window.addEventListener("unload", WindowOnUnload, false);
  UpdateDependent(document.getElementById("editor.use_custom_colors").value);
}

function GetColorAndUpdatePref(aType, aButtonID)
{
  // Don't allow a blank color, i.e., using the "default"
  var colorObj = { NoDefault:true, Type:"", TextColor:0, PageColor:0, Cancel:false };
  var preference = document.getElementById("editor." + aButtonID + "_color");

  if (aButtonID == "background")
    colorObj.PageColor = preference.value;
  else
    colorObj.TextColor = preference.value;

  colorObj.Type = aType;

  window.openDialog("chrome://editor/content/EdColorPicker.xul", "_blank", "chrome,close,titlebar,modal", "", colorObj);

  // User canceled the dialog
  if (colorObj.Cancel)
    return;

  // Update preference with picked color
  if (aType == "Page")
    preference.value = colorObj.BackgroundColor;
  else
    preference.value = colorObj.TextColor;
}

function UpdateDependent(aCustomEnabled)
{
  ToggleElements(aCustomEnabled);

  if (aCustomEnabled)
  { // Set current editor colors on preview and buttons
    SetColors("textCW", "normalText", document.getElementById("editor.text_color").value);
    SetColors("linkCW", "linkText", document.getElementById("editor.link_color").value);
    SetColors("activeCW", "activeLinkText", document.getElementById("editor.active_link_color").value);
    SetColors("visitedCW", "visitedLinkText", document.getElementById("editor.followed_link_color").value);
    SetColors("backgroundCW", "ColorPreview", document.getElementById("editor.background_color").value);
  }
  else
  { // Set current browser colors on preview
    SetBgAndFgColors(Services.prefs.getBoolPref("browser.display.use_system_colors"));
    SetColorPreview("linkText", Services.prefs.getCharPref("browser.anchor_color"));
    SetColorPreview("activeLinkText", Services.prefs.getCharPref("browser.active_color"));
    SetColorPreview("visitedLinkText", Services.prefs.getCharPref("browser.visited_color"));
  }
}

function ToggleElements(aCustomEnabled)
{
  var buttons = document.getElementById("color-rows").getElementsByTagName("button");
  
  for (var i = 0; i < buttons.length; i++)
  {
    let isLocked = CheckLocked(buttons[i].id);
    buttons[i].disabled = !aCustomEnabled || isLocked;
    buttons[i].previousSibling.disabled = !aCustomEnabled || isLocked;
    buttons[i].firstChild.setAttribute("default", !aCustomEnabled || isLocked);
  }
}

function CheckLocked(aButtonID)
{
  return document.getElementById("editor." + aButtonID + "_color").locked;
}

// Updates preview and button color when a editor color pref change
function UpdateColors(aColorWellID, aPreviewID, aColor)
{
  // Only show editor colors from prefs if we're in custom mode
  if (!document.getElementById("editor.use_custom_colors").value)
    return;

  SetColors(aColorWellID, aPreviewID, aColor)
}

function SetColors(aColorWellID, aPreviewID, aColor)
{
  SetColorWell(aColorWellID, aColor);
  SetColorPreview(aPreviewID, aColor);
}

function SetColorWell(aColorWellID, aColor)
{
  document.getElementById(aColorWellID).style.backgroundColor = aColor;
}

function SetColorPreview(aPreviewID, aColor)
{
  if (aPreviewID == "ColorPreview")
    document.getElementById(aPreviewID).style.backgroundColor = aColor;
  else
    document.getElementById(aPreviewID).style.color = aColor;
}

function UpdateBgImagePreview(aImage)
{
  var colorPreview = document.getElementById("ColorPreview");
  colorPreview.style.backgroundImage = aImage && "url(" + aImage + ")";
}

// Sets browser background/foreground colors
function SetBgAndFgColors(aSysPrefEnabled)
{
  if (aSysPrefEnabled)
  { // Use system colors
    SetColorPreview("normalText", "windowtext");
    SetColorPreview("ColorPreview", "window");
  }
  else
  {
    SetColorPreview("normalText", Services.prefs.getCharPref("browser.display.foreground_color"));
    SetColorPreview("ColorPreview", Services.prefs.getCharPref("browser.display.background_color"));
  }
}

function ChooseImageFile()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var editorBundle = document.getElementById("bundle_editor");
  var title = editorBundle.getString("SelectImageFile");
  fp.init(window, title, nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterImages);
  if (fp.show() == nsIFilePicker.returnOK)
    document.getElementById("editor.default_background_image").value = fp.fileURL.spec;

  var textbox = document.getElementById("backgroundImageInput");
  textbox.focus();
  textbox.select();
}

function WindowOnUnload()
{
  Services.prefs.removeObserver("browser.display.use_system_colors", browserPrefsObserver, false);
  Services.prefs.removeObserver("browser.display.foreground_color", browserPrefsObserver, false);
  Services.prefs.removeObserver("browser.display.background_color", browserPrefsObserver, false);
  Services.prefs.removeObserver("browser.anchor_color", browserPrefsObserver, false);
  Services.prefs.removeObserver("browser.active_color", browserPrefsObserver, false);
  Services.prefs.removeObserver("browser.visited_color", browserPrefsObserver, false);
  window.removeEventListener("unload", WindowOnUnload, false);
}
