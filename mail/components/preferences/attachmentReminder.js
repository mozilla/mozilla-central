/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gAttachmentReminderOptionsDialog = {
  keywordListBox: null,
  bundle: null,

  init: function()
  {
    this.keywordListBox = document.getElementById("keywordList");
    this.bundle = document.getElementById("bundlePreferences");
    this.buildKeywordList();
  },

  buildKeywordList: function()
  {
    var keywordsInCsv = Services.prefs
      .getComplexValue("mail.compose.attachment_reminder_keywords",
                       Components.interfaces.nsIPrefLocalizedString);
    if (!keywordsInCsv)
      return;
    var keywordsInCsv = keywordsInCsv.data;
    var keywordsInArr = keywordsInCsv.split(",");
    for (var i = 0; i < keywordsInArr.length; i++)
    {
      if (keywordsInArr[i])
        this.keywordListBox.appendItem(keywordsInArr[i], keywordsInArr[i]);
    }
    if (keywordsInArr.length)
      this.keywordListBox.selectedIndex = 0;
  },

  addKeyword: function()
  {
    var input = {value: ""}; // Default to empty.
    var ok = Services.prompt.prompt(window,
                                    this.bundle.getString("attachmentReminderAddDialogTitle"),
                                    this.bundle.getString("attachmentReminderAddText"),
                                    input, null, {value:0});
    if (ok && input.value)
      this.keywordListBox.appendItem(input.value, input.value);
  },

  editKeyword: function()
  {
    if (this.keywordListBox.selectedIndex < 0)
      return;
    var keywordToEdit = this.keywordListBox.getItemAtIndex(this.keywordListBox.selectedIndex);
    var input = {value: keywordToEdit.getAttribute("value")};
    var ok = Services.prompt.prompt(window,
                                    this.bundle.getString("attachmentReminderEditDialogTitle"),
                                    this.bundle.getString("attachmentReminderEditText"),
                                    input, null, {value:0});
    if (ok && input.value) {
      this.keywordListBox.removeItemAt(this.keywordListBox.selectedIndex);
      this.keywordListBox.appendItem(input.value, input.value);
    }
  },

  removeKeyword: function()
  {
    if (this.keywordListBox.selectedIndex < 0)
      return;
    this.keywordListBox.removeItemAt(this.keywordListBox.selectedIndex);
  },

  saveKeywords: function()
  {
    var keywordList = "";
    for (var i = 0; i < this.keywordListBox.getRowCount(); i++) {
      keywordList += this.keywordListBox.getItemAtIndex(i).getAttribute("value");
      if (i != this.keywordListBox.getRowCount() - 1)
        keywordList += ",";
    }

    var str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(Components.interfaces.nsISupportsString);
    str.data = keywordList;
    Services.prefs.setComplexValue("mail.compose.attachment_reminder_keywords",
                                   Components.interfaces.nsISupportsString, str);
  }
};
