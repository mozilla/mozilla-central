/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup() {
  let value = document.getElementById("mail.compose.autosave").value;
  EnableElementById("autoSaveInterval", value, false);
}

function EnableMailComposeAutosaveInterval(aValue) {
  let focus = (document.getElementById("autoSave") == document.commandDispatcher.focusedElement);
  EnableElementById("autoSaveInterval", aValue, focus);
}

function PopulateFonts() {
  var fontsList = document.getElementById("fontSelect");
  try {
    var enumerator = Components.classes["@mozilla.org/gfx/fontenumerator;1"]
                               .getService(Components.interfaces.nsIFontEnumerator);
    var localFontCount = { value: 0 }
    var localFonts = enumerator.EnumerateAllFonts(localFontCount);
    for (let font of localFonts)
      fontsList.appendItem(font, font);
  } catch (ex) { }

  // Select the item after the list is completely generated.
  document.getElementById(fontsList.getAttribute("preference"))
          .setElementValue(fontsList);
}
