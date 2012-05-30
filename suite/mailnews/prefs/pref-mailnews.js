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
  if ("@mozilla.org/suite/shell-service;1" in Components.classes) {
    var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                                 .getService(nsIShellService);

    document.getElementById("setDefaultMail").disabled =
      shellService.isDefaultClient(false, nsIShellService.MAIL);

    document.getElementById("setDefaultNews").disabled =
      shellService.isDefaultClient(false, nsIShellService.NEWS);

    document.getElementById("setDefaultFeed").disabled =
      shellService.isDefaultClient(false, nsIShellService.RSS);

    document.getElementById("defaultMailPrefs").hidden = false;
  }
}

function onSetDefaultMail()
{
  var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                               .getService(nsIShellService);

  shellService.setDefaultClient(false, false, nsIShellService.MAIL);
  shellService.shouldBeDefaultClientFor |= nsIShellService.MAIL;

  document.getElementById("setDefaultMail").disabled = true;
}

function onSetDefaultNews()
{
  var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                               .getService(nsIShellService);

  shellService.setDefaultClient(false, false, nsIShellService.NEWS);
  shellService.shouldBeDefaultClientFor |= nsIShellService.NEWS;

  document.getElementById("setDefaultNews").disabled = true;
}

function onSetDefaultFeed()
{
  var shellService = Components.classes["@mozilla.org/suite/shell-service;1"]
                               .getService(nsIShellService);

  shellService.setDefaultClient(false, false, nsIShellService.RSS);
  shellService.shouldBeDefaultClientFor |= nsIShellService.RSS;

  document.getElementById("setDefaultFeed").disabled = true;
}
