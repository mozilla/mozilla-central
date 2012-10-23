/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const MAX_HISTORY_MENU_ITEMS = 15;
const MAX_URLBAR_HISTORY_MENU_ITEMS = 30;
const MAX_URLBAR_HISTORY_ITEMS = 100;

function toggleTabsFromOtherComputers()
  {
    // enable/disable the Tabs From Other Computers menu
    let menuitem = document.getElementById("sync-tabs-menuitem");

    // If Sync isn't configured yet, then don't show the menuitem.
    if (Weave.Status.checkSetup() == Weave.CLIENT_NOT_CONFIGURED ||
        Weave.Svc.Prefs.get("firstSync", "") == "notReady") {
      menuitem.hidden = true;
      return;
    }

    // The tabs engine might never be inited (if services.sync.registerEngines
    // is modified), so make sure we avoid undefined errors.
    let enabled = Weave.Service.isLoggedIn &&
                  Weave.Service.engineManager.get("tabs") &&
                  Weave.Service.engineManager.get("tabs").enabled;
    menuitem.setAttribute("disabled", !enabled);
    menuitem.hidden = false;
  }

function FillHistoryMenu(aParent, aMenu)
{
  // Remove old entries if any
  deleteHistoryItems(aParent);

  var sessionHistory = getWebNavigation().sessionHistory;

  var count = sessionHistory.count;
  var index = sessionHistory.index;
  var end;

  switch (aMenu)
  {
    case "back":
      end = index > MAX_HISTORY_MENU_ITEMS ? index - MAX_HISTORY_MENU_ITEMS
                                           : 0;
      if (index <= end)
        return false;
      for (let j = index - 1; j >= end; j--)
      {
        let entry = sessionHistory.getEntryAtIndex(j, false);
        if (entry)
          createHistoryMenuItem(aParent, j, entry);
      }
      break;
    case "forward":
      end = count - index > MAX_HISTORY_MENU_ITEMS ? index + MAX_HISTORY_MENU_ITEMS
                                                   : count - 1;
      if (index >= end)
        return false;
      for (let j = index + 1; j <= end; j++)
      {
        let entry = sessionHistory.getEntryAtIndex(j, false);
        if (entry)
          createHistoryMenuItem(aParent, j, entry);
      }
      break;
    case "go":
      var startHistory = document.getElementById("startHistorySeparator");
      var endHistory = document.getElementById("endHistorySeparator");
      var syncMenuItem = document.getElementById("sync-tabs-menuitem");
      startHistory.hidden = (count == 0);
      end = count > MAX_HISTORY_MENU_ITEMS ? count - MAX_HISTORY_MENU_ITEMS
                                           : 0;
      for (let j = count - 1; j >= end; j--)
      {
        let entry = sessionHistory.getEntryAtIndex(j, false);
        if (entry)
          createHistoryMenuItem(aParent, j, entry, endHistory, j == index);
      }
      toggleTabsFromOtherComputers();
      endHistory.hidden = (endHistory == aParent.lastChild || syncMenuItem.hidden);
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
        gURLBar.value = label;
        UpdatePageProxyState();
        handleURLBarCommand();
      }
  }

function createUBHistoryMenu( aParent )
  {
    while (aParent.hasChildNodes())
      aParent.removeChild(aParent.lastChild);

    var file = GetUrlbarHistoryFile();
    if (file.exists()) {
      var connection = Services.storage.openDatabase(file);
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

function createHistoryMenuItem(aParent, aIndex, aEntry, aAnchor, aChecked)
{
  var menuitem = document.createElement("menuitem");
  menuitem.setAttribute("label", aEntry.title);
  menuitem.setAttribute("index", aIndex);
  if (aChecked)
  {
    menuitem.setAttribute("type", "radio");
    menuitem.setAttribute("checked", "true");
  }

  if (!aChecked || /Mac/.test(navigator.platform))
  {
    menuitem.className = "menuitem-iconic bookmark-item menuitem-with-favicon";
    PlacesUtils.favicons.getFaviconURLForPage(aEntry.URI,
      function faviconURLCallback(aURI) {
        if (aURI) {
          menuitem.setAttribute("image",
                                PlacesUtils.favicons
                                           .getFaviconLinkForIcon(aURI).spec);
        }
      }
    );
  }
  aParent.appendChild(menuitem);
}

function deleteHistoryItems(aParent)
{
  var children = aParent.childNodes;
  for (let i = children.length - 1; i >= 0; --i)
  {
    if (children[i].hasAttribute("index"))
      aParent.removeChild(children[i]);
  }
}

function updateGoMenu(event)
  {
    FillHistoryMenu(event.target, "go");
    updateRecentMenuItems();
  }
