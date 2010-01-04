/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jason Eager <jce2@po.cwru.edu>
 *   Blake Ross <BlakeR1234@aol.com>
 *   Peter Annema <disttsc@bart.nl>
 *   Dean Tessman <dean_tessman@hotmail.com>
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
const MAX_HISTORY_MENU_ITEMS = 15;
const MAX_URLBAR_HISTORY_MENU_ITEMS = 30;
const MAX_URLBAR_HISTORY_ITEMS = 100;

function FillHistoryMenu(aParent, aMenu)
  {
    // Remove old entries if any
    deleteHistoryItems(aParent);

    var sessionHistory = getWebNavigation().sessionHistory;

    var count = sessionHistory.count;
    var index = sessionHistory.index;
    var end;
    var j;
    var entry;

    switch (aMenu)
      {
        case "back":
          end = (index > MAX_HISTORY_MENU_ITEMS) ? index - MAX_HISTORY_MENU_ITEMS : 0;
          if ((index - 1) < end) return false;
          for (j = index - 1; j >= end; j--)
            {
              entry = sessionHistory.getEntryAtIndex(j, false);
              if (entry)
                createMenuItem(aParent, j, entry.title);
            }
          break;
        case "forward":
          end  = ((count-index) > MAX_HISTORY_MENU_ITEMS) ? index + MAX_HISTORY_MENU_ITEMS : count - 1;
          if ((index + 1) > end) return false;
          for (j = index + 1; j <= end; j++)
            {
              entry = sessionHistory.getEntryAtIndex(j, false);
              if (entry)
                createMenuItem(aParent, j, entry.title);
            }
          break;
        case "go":
          var startHistory = document.getElementById("startHistorySeparator");
          var endHistory = document.getElementById("endHistorySeparator");
          startHistory.hidden = (count == 0);
          endHistory.hidden = (endHistory == aParent.lastChild);
          end = count > MAX_HISTORY_MENU_ITEMS ? count - MAX_HISTORY_MENU_ITEMS : 0;
          for (j = count - 1; j >= end; j--)
            {
              entry = sessionHistory.getEntryAtIndex(j, false);
              if (entry)
                createRadioMenuItem(aParent, endHistory, j, entry.title, j == index);
            }
          break;
      }
    return true;
  }

function executeUrlBarHistoryCommand( aTarget )
  {
    var index = aTarget.getAttribute("index");
    var label = aTarget.getAttribute("label");
    if (index != "nothing_available" && label)
      {
        if (gURLBar) {
          gURLBar.value = label;
          addToUrlbarHistory(gURLBar.value);
          BrowserLoadURL();
        } else {
          var uri = getShortcutOrURI(label);
          loadURI(uri);
        }
      }
  }

function createUBHistoryMenu( aParent )
  {
    while (aParent.hasChildNodes())
      aParent.removeChild(aParent.lastChild);

    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties)
                         .get("ProfD", Components.interfaces.nsIFile);
    file.append("urlbarhistory.sqlite");
    if (file.exists()) {
      var connection = Components.classes["@mozilla.org/storage/service;1"]
                                 .getService(Components.interfaces.mozIStorageService)
                                 .openDatabase(file);
      try {
        if (connection.tableExists("urlbarhistory")) {
          var statement = connection.createStatement(
              "SELECT url FROM urlbarhistory ORDER BY ROWID DESC");
          while (statement.executeStep())
            aParent.appendChild(document.createElement("menuitem"))
                   .setAttribute("label", statement.getString(0));
          statement.reset();
          statement.finalize();
          return;
        }
      } finally {
        connection.close();
      }
    }
    //Create the "Nothing Available" Menu item and disable it.
    var na = aParent.appendChild(document.createElement("menuitem"));
    na.setAttribute("label", gNavigatorBundle.getString("nothingAvailable"));
    na.setAttribute("disabled", "true");
  }

function createMenuItem(aParent, aIndex, aLabel)
  {
    var menuitem = document.createElement( "menuitem" );
    menuitem.setAttribute( "label", aLabel );
    menuitem.setAttribute( "index", aIndex );
    aParent.appendChild(menuitem);
  }

function createRadioMenuItem(aParent, aAnchor, aIndex, aLabel, aChecked)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("type", "radio");
    menuitem.setAttribute("label", aLabel);
    menuitem.setAttribute("index", aIndex);
    if (aChecked)
      menuitem.setAttribute("checked", "true");
    aParent.insertBefore(menuitem, aAnchor);
  }

function deleteHistoryItems(aParent)
  {
    var children = aParent.childNodes;
    for (var i = children.length - 1; i >= 0; --i )
      {
        var index = children[i].getAttribute( "index" );
        if (index)
          aParent.removeChild( children[i] );
      }
  }

function updateGoMenu(event)
  {
    FillHistoryMenu(event.target, "go");
  }
