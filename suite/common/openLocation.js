/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 *
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Lowe <michael.lowe@bigfoot.com>
 *   Blake Ross   <blaker@netscape.com>
 *   Neil Rashbrook <neil@parkwaycc.co.uk>
 *   Ian Neal <iann_bugzilla@blueyonder.co.uk>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
    case "4": // attach web page
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
  if (gAction != "4") { // open web page
    params.action = gOpenAppList.value;
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
    if (window.arguments[0].action != "4" && gOpenAppList.value == "2") {
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
