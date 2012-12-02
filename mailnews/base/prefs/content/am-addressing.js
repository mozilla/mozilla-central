/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

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
  LDAPenabling();
  quoteEnabling();
}

function onEditDirectories()
{
  window.openDialog("chrome://messenger/content/addressbook/pref-editdirectories.xul",
                    "editDirectories", "chrome,modal=yes,resizable=no", null);
}

function onPreInit(account, accountValues)
{
}

function LDAPenabling()
{
  onCheckItem("identity.directoryServer", ["directories"]);
  onCheckItem("editButton", ["directories"]);
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

/**
 * Open the Preferences dialog on the tab with Addressing options.
 */
function showGlobalAddressingPrefs()
{
  openPrefsFromAccountManager("paneCompose", "addressingTab", null, "addressing_pane");
}

/**
 * Open the Preferences dialog on the tab with Composing options.
 */
function showGlobalComposingPrefs()
{
  openPrefsFromAccountManager("paneCompose", "generalTab", null, "composing_messages_pane");
}
