/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

if ("@mozilla.org/suite/shell-service;1" in Components.classes)
  const nsIShellService = Components.interfaces.nsIShellService;

function Startup()
{
  startPageCheck();
  defaultClientSetup();
}

function startPageCheck()
{
  var checked = document.getElementById("mailnews.start_page.enabled").value;
  var urlElement = document.getElementById("mailnewsStartPageUrl");
  var prefLocked = document.getElementById("mailnews.start_page.url").locked;

  urlElement.disabled = !checked || prefLocked;
}

function setHomePageToDefaultPage()
{
  var startPagePref = document.getElementById("mailnews.start_page.url");

  startPagePref.value = startPagePref.defaultValue;
}

function defaultClientSetup()
{
  if ("@mozilla.org/suite/shell-service;1" in Components.classes) try {
    var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                                 .getService(nsIShellService);

    ["Mail", "News", "Rss"].forEach(function(aType) {
      var button = document.getElementById("setDefault" + aType);
      try {
        button.disabled = shellService.isDefaultClient(false, nsIShellService[aType.toUpperCase()]);
        document.getElementById("defaultMailPrefs").hidden = false;
      } catch (e) {
        button.hidden = true;
      }
    });
  } catch (e) {
  }
}

function onSetDefault(aButton, aType)
{
  var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                               .getService(nsIShellService);

  shellService.setDefaultClient(false, false, nsIShellService[aType]);
  shellService.shouldBeDefaultClientFor |= nsIShellService[aType];

  aButton.disabled = true;
}
