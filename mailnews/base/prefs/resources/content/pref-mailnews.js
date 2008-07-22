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
 * Mark Banner <bugzilla@standard8.plus.com>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

if ("@mozilla.org/browser/shell-service;1" in Components.classes)
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
  if ("@mozilla.org/browser/shell-service;1" in Components.classes) {
    var shellService = Components.classes["@mozilla.org/browser/shell-service;1"]
                                 .getService(nsIShellService);

    document.getElementById("setDefaultMail").disabled =
      shellService.isDefaultClient(false, nsIShellService.MAIL);

    document.getElementById("setDefaultNews").disabled =
      shellService.isDefaultClient(false, nsIShellService.NEWS);

    return;
  }
  if ("@mozilla.org/mapiregistry;1" in Components.classes) {
    var mapiRegistry = Components.classes["@mozilla.org/mapiregistry;1"]
                     .getService(Components.interfaces.nsIMapiRegistry);

    document.getElementById("setDefaultMail").disabled =
      mapiRegistry.isDefaultMailClient;

    document.getElementById("setDefaultNews").disabled =
      mapiRegistry.isDefaultNewsClient;

    return;
  }

  document.getElementById("defaultMailPrefs").hidden = true;
}

function onSetDefaultMail()
{
  if ("@mozilla.org/browser/shell-service;1" in Components.classes) {
    var shellService = Components.classes["@mozilla.org/browser/shell-service;1"]
                                 .getService(nsIShellService);

    shellService.setDefaultClient(false, false, nsIShellService.MAIL);
  }
  else if ("@mozilla.org/mapiregistry;1" in Components.classes) {
    var mapiRegistry = Components.classes["@mozilla.org/mapiregistry;1"]
                     .getService(Components.interfaces.nsIMapiRegistry);

    mapiRegistry.isDefaultMailClient = true;

  }
  document.getElementById("setDefaultMail").disabled = true;
}

function onSetDefaultNews()
{
  if ("@mozilla.org/browser/shell-service;1" in Components.classes) {
    var shellService = Components.classes["@mozilla.org/browser/shell-service;1"]
                                 .getService(nsIShellService);

    shellService.setDefaultClient(false, false, nsIShellService.NEWS);
  }
  else if ("@mozilla.org/mapiregistry;1" in Components.classes) {
    var mapiRegistry = Components.classes["@mozilla.org/mapiregistry;1"]
                     .getService(Components.interfaces.nsIMapiRegistry);

    mapiRegistry.isDefaultNewsClient = true;
  }
  document.getElementById("setDefaultNews").disabled = true;
}
