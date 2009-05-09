# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Chinmay Deepakbhai Patel <chinu.ptl@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

var gAttachmentReminderOptionsDialog = {
  prefs: null,
  promptService: null,
  keywordListBox: null,
  bundle: null,

  init: function()
  {
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
    this.promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                   .getService(Components.interfaces.nsIPromptService);
    this.keywordListBox = document.getElementById("keywordList");
    this.bundle = document.getElementById("bundlePreferences");
    this.buildKeywordList();
  },

  buildKeywordList: function()
  {
    var keywordsInCsv = this.prefs.getComplexValue("mail.compose.attachment_reminder_keywords",
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
    var ok = this.promptService.prompt(window,
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
    var ok = this.promptService.prompt(window,
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
    this.prefs.setComplexValue("mail.compose.attachment_reminder_keywords",
                               Components.interfaces.nsISupportsString, str);
  }
};
