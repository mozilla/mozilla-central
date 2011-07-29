/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Charles Manske (cmanske@netscape.com)
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

// Overrides the main contentAreaContext onpopupshowing so needs to do
// everything that does plus call Composer specific code.
function editorContextPopupShowing(aNode)
{
  gContextMenu = new nsContextMenu(aNode);
  if (gContextMenu.shouldDisplay)
  {
    var showExtra = top.document.commandDispatcher.focusedWindow == content;
    gContextMenu.initEditorItems(showExtra);
    return true;
  }
  return false;
}

// Extends the main nsContextMenu for Composer.
nsContextMenu.prototype.initEditorItems = function (aShow)
{
  var isInLink = false;
  var objectName;
  var inSourceMode = IsInHTMLSourceMode();
  var showSpell = !inSourceMode && !IsInPreviewMode() &&
                  InlineSpellCheckerUI.canSpellCheck;
  this.showItem("spell-check-enabled", showSpell);
  this.showItem("spell-separator", showSpell);

  aShow = aShow && !inSourceMode;
  this.hideDisabledItem("menu_pasteNoFormatting_cm", aShow);

  // Only do this stuff when not in source mode or sidebar.
  if (aShow)
  {
    // Setup object property command element.
    objectName = InitObjectPropertiesMenuitem();
    isInLink = objectName == "href";

    InitRemoveStylesMenuitems("removeStylesMenuitem_cm",
                              "removeLinksMenuitem_cm",
                              "removeNamedAnchorsMenuitem_cm");

    // Set appropriate text for join cells command.
    InitJoinCellMenuitem("joinTableCells_cm");

    // Update enable states for all table commands.
    goUpdateTableMenuItems(document.getElementById("composerTableMenuItems"));

    this.hideDisabledItem("context-undo", true);
    this.hideDisabledItem("context-redo", true);
    this.hideDisabledItem("context-cut", true);
    this.hideDisabledItem("context-copy", true);
    this.hideDisabledItem("context-paste", true);
    this.hideDisabledItem("context-delete", true);
    
    this.showItem("context-sep-undo",
                  this.shouldShowSeparator("context-sep-undo"));
    this.showItem("context-sep-paste",
                  this.shouldShowSeparator("context-sep-paste"));
  }

  this.hideDisabledItem("objectProperties_cm", aShow);

  // Show "Create Link" if not in a link and not in source mode or sidebar.
  this.showItem("createLink_cm", aShow && !isInLink);

  // Show "Edit link in new Composer" if in a link and
  // not in source mode or sidebar.
  this.showItem("editLink_cm", aShow && isInLink);

  this.hideDisabledItem("removeStylesMenuitem_cm", aShow);
  this.hideDisabledItem("removeLinksMenuitem_cm", aShow);
  this.hideDisabledItem("removeNamedAnchorsMenuitem_cm", aShow);

  this.hideDisabledItem("joinTableCells_cm", aShow);
  this.hideDisabledItem("splitTableCell_cm", aShow);
  this.hideDisabledItem("tableOrCellColor_cm", aShow);

  var inCell = aShow && IsInTableCell();
  // Remove table submenus if not in table.
  this.showItem("tableInsertMenu_cm", inCell);
  this.showItem("tableSelectMenu_cm", inCell);
  this.showItem("tableDeleteMenu_cm", inCell);

  this.showItem("context-sep-selectall", aShow);
  this.showItem("context-sep-properites", aShow && !!objectName);
  this.showItem("frame-sep", aShow && IsInTable());
};

nsContextMenu.prototype.hideDisabledItem = function(aId, aShow)
{
  this.showItem(aId, aShow && IsItemOrCommandEnabled(aId));
};

function IsItemOrCommandEnabled(aId)
{
  var item = document.getElementById(aId);
  if (!item)
    return false;

  var command = item.getAttribute("command");
  if (command) {
    // If possible, query the command controller directly
    var controller = document.commandDispatcher
                             .getControllerForCommand(command);
    if (controller)
      return controller.isCommandEnabled(command);
  }

  // Fall back on the inefficient observed disabled attribute
  return item.getAttribute("disabled") != "true";
}
