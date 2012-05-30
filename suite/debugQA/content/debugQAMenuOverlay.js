/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// "about:bloat" is available only when
// (the application is) compiled with |--enable-logrefcnt|.
if ("@mozilla.org/network/protocol/about;1?what=bloat" in Components.classes)
  window.addEventListener("load", onLoadBloat, false);

// Unhide (and enable) the Bloat menu and its associated separator.
function onLoadBloat()
{
  window.removeEventListener("load", onLoadBloat, false);

  // Ignore windows which don't get the Debug menu, like 'View Source'.
  if (!document.getElementById("debugMenu"))
    return;

  // Enable the menu, only if its feature is currently active.
  var envSvc = Components.classes["@mozilla.org/process/environment;1"]
                         .getService(Components.interfaces.nsIEnvironment);
  // Checking the environment variables is good enough,
  // as the Bloat service doesn't report the status of its statistics feature.
  if (envSvc.exists("XPCOM_MEM_BLOAT_LOG") ||
      envSvc.exists("XPCOM_MEM_LEAK_LOG"))
    document.getElementById("bloatMenu").disabled = false;

  document.getElementById("bloatSeparator").hidden = false;
  document.getElementById("bloatMenu").hidden = false;
}
