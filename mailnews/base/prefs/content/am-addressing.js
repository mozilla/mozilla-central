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
 * The Original Code is Mozilla Communicator client code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Srilatha Moturi <srilatha@netscape.com>, original implementor
 *   Mark Banner <bugzilla@standard8.plus.com>
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

var gIdentity = null;
var gPrefInt = null;

function onLoad()
{
  parent.onPanelLoaded('am-addressing.xul');
}

function onInit(aPageId, aServerId) 
{
  onInitCompositionAndAddressing();
}

function onInitCompositionAndAddressing()
{
  enabling();
  quoteEnabling();
}

function onEditDirectories()
{
  window.openDialog("chrome://messenger/content/addressbook/pref-editdirectories.xul",
                    "editDirectories", "chrome,modal=yes,resizable=no", null);
}

function onPreInit(account, accountValues)
{
  gIdentity = account.defaultIdentity;
}

function enabling()
{
  var autocomplete = document.getElementById("identity.overrideGlobal_Pref");
  var directoriesList = document.getElementById("identity.directoryServer");
  var editButton = document.getElementById("editButton");

  switch (autocomplete.value)
  {
    case "false":
      directoriesList.setAttribute("disabled", true);
      editButton.setAttribute("disabled", true);
      break;
    case "true":
      directoriesList.removeAttribute("disabled");
      editButton.removeAttribute("disabled");
      break;      
  }

  if (!gPrefInt) {
    gPrefInt = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
  }

  if (gIdentity && gPrefInt.prefIsLocked("mail.identity." + gIdentity.key + ".directoryServer")) {
    directoriesList.setAttribute("disabled", "true");
  }
}

function quoteEnabling()
{
  var quotebox = document.getElementById("thenBox");
  var placebox = document.getElementById("placeBox");
  var quotecheck = document.getElementById("identity.autoQuote");

  if (quotecheck.checked && !quotecheck.disabled &&
      (document.getElementById("identity.replyOnTop").value == 1)) {
    placebox.firstChild.removeAttribute("disabled");
    placebox.lastChild.removeAttribute("disabled");
  }
  else {
    placebox.firstChild.setAttribute("disabled", "true");
    placebox.lastChild.setAttribute("disabled", "true");
  }
  if (quotecheck.checked && !quotecheck.disabled) {
    quotebox.firstChild.removeAttribute("disabled");
    quotebox.lastChild.removeAttribute("disabled");
  }
  else {
    quotebox.firstChild.setAttribute("disabled", "true");
    quotebox.lastChild.setAttribute("disabled", "true");
  }
}

