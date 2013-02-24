/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gInput;
var gAcceptButton;
var gLastPref = "general.open_location.last_url";
var gOpenAppList;
var gBundle;
var gAction;

function onLoad()
{
  gInput = document.getElementById("dialog.input");
  gAcceptButton = document.documentElement.getButton("accept");
  gOpenAppList = document.getElementById("openAppList");
  gBundle = document.getElementById("openLocationBundle");
  gAction = window.arguments[0].action;
  // Set arguments action to prevent problems on cancel.
  window.arguments[0].action = "-1";

  switch (gAction) {
    case "5": // attach web page
      document.title = gBundle.getString("attachTitle");
      document.getElementById("enterLabel").value = gBundle.getString("attachEnterLabel");
      document.getElementById("openWhereBox").setAttribute("hidden", true);

      // Change accept button text to 'attach'.
      gAcceptButton.label = gBundle.getString("attachButtonLabel");
      gLastPref = "mailnews.attach_web_page.last_url";

      break;

    case "2": // open web page from composer
      gOpenAppList.selectedItem = document.getElementById("editWindow");
      var openTopWindow = document.getElementById("currentTab");

      // Change string to make more sense for Composer.
      openTopWindow.setAttribute("label",
                                 gBundle.getString("existingNavigatorWindow"));

      // Disable existing browser and new tab menuitems and create indicator
      // if no browser windows found.
      if (!Services.wm.getMostRecentWindow("navigator:browser")) {
        openTopWindow.setAttribute("disabled", "true");
        document.getElementById("newTab").setAttribute("disabled", "true");
        gAction = "-1";
      }
      break;

    default: // open web page
      gOpenAppList.value = Services.prefs.getIntPref("general.open_location.last_window_choice");
  }

  gInput.value = GetStringPref(gLastPref);
  if (gInput.value)
    gInput.select(); // XXX should probably be done automatically

  doEnabling();
}

function doEnabling()
{
  gAcceptButton.disabled = !gInput.value;
}

function accept()
{
  var params = window.arguments[0];
  params.url = gInput.value;
  params.action = gOpenAppList.value;
  if (gAction == "4" || params.action == "4")
    return; // private, don't set any preferences

  if (gAction != "5") { // open web page
    // If there were no browser windows open and not set to open in composer
    // then set to open in a new window.
    if (gAction == "-1" && params.action != "2")
      params.action = "1";

    // If open web page from navigator window, save last window choice.
    if (gAction == "0")
      Services.prefs.setIntPref("general.open_location.last_window_choice",
                                gOpenAppList.value);
  }

  SetStringPref(gLastPref, gInput.value);
}

function onChooseFile()
{
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  try {
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, gBundle.getString("chooseFileDialogTitle"), nsIFilePicker.modeOpen);
    if (window.arguments[0].action != "5" && gOpenAppList.value == "2") {
      // When loading into Composer, direct user to prefer HTML files and text
      // files, so we call separately to control the order of the filter list.
      fp.appendFilters(nsIFilePicker.filterHTML | nsIFilePicker.filterText);
      fp.appendFilters(nsIFilePicker.filterAll);
    }
    else {
      fp.appendFilters(nsIFilePicker.filterHTML | nsIFilePicker.filterText |
                       nsIFilePicker.filterAll | nsIFilePicker.filterImages | nsIFilePicker.filterXML);
    }

    if (fp.show() == nsIFilePicker.returnOK && fp.fileURL.spec && fp.fileURL.spec.length > 0)
      gInput.value = fp.fileURL.spec;
  }
  catch(ex) {
  }
  doEnabling();
}

function useUBHistoryItem(aValue)
{
  gInput.value = aValue;
  gInput.focus();
  doEnabling();
}
