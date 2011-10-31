/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ryan Cassin (rcassin@supernova.org)
 *   Neil Rashbrook (neil@parkwaycc.co.uk)
 *   Charles Manske (cmanske@netscape.com)
 *   Ian Neal (iann_bugzilla@blueyonder.co.uk)
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

function BuildRecentPagesMenu()
{
  var editor = GetCurrentEditor();
  if (!editor)
    return;

  var popup = document.getElementById("menupopup_RecentFiles");
  if (!popup || !editor.document)
    return;

  // Delete existing menu
  while (popup.firstChild)
    popup.removeChild(popup.firstChild);

  // Current page is the "0" item in the list we save in prefs,
  //  but we don't include it in the menu.
  var curUrl = StripPassword(GetDocumentUrl());
  var historyCount = GetIntPref("editor.history.url_maximum", 10);

  var menuIndex = 1;
  for (var i = 0; i < historyCount; i++)
  {
    var url = GetStringPref("editor.history_url_" + i);

    // Skip over current url
    if (url && url != curUrl)
    {
      // Build the menu
      var title = GetStringPref("editor.history_title_" + i);
      var fileType = GetStringPref("editor.history_type_" + i);
      AppendRecentMenuitem(popup, title, url, fileType, menuIndex);
      menuIndex++;
    }
  }
}

function AppendRecentMenuitem(aPopup, aTitle, aUrl, aFileType, aIndex)
{
  if (!aPopup)
    return;

  var menuItem = document.createElement("menuitem");
  if (!menuItem)
    return;

  var accessKey = aIndex <= 10 ? String(aIndex % 10) : " ";

  // Show "title [url]" or just the URL.
  var itemString = aTitle ? aTitle + " [" + aUrl + "]" : aUrl;

  menuItem.setAttribute("label", accessKey + " " + itemString);
  menuItem.setAttribute("crop", "center");
  menuItem.setAttribute("tooltiptext", aUrl);
  menuItem.setAttribute("value", aUrl);
  menuItem.setAttribute("fileType", aFileType);
  if (accessKey != " ")
    menuItem.setAttribute("accesskey", accessKey);
  aPopup.appendChild(menuItem);
}

function EditorInitFileMenu()
{
  // Disable "Save" menuitem when editing remote url. User should use "Save As"

  var docUrl = GetDocumentUrl();
  var scheme = GetScheme(docUrl);
  if (scheme && scheme != "file")
    SetElementEnabledById("menu_saveCmd", false);

  // Enable recent pages submenu if there are any history entries in prefs.
  var historyUrl = "";

  if (GetIntPref("editor.history.url_maximum", 10))
  {
    historyUrl = GetStringPref("editor.history_url_0");

    // See if there's more if current file is only entry in history list.
    if (historyUrl && historyUrl == docUrl)
      historyUrl = GetStringPref("editor.history_url_1");
  }
  SetElementEnabledById("menu_RecentFiles", historyUrl != "");
}
