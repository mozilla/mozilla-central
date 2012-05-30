/* -*- Mode: C; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
