/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

// Milliseconds. Decided on MacBook 2.4GHz Intel (Dual Core).
// 4s seemed a resonable time for the main window to be displayed.
const kMailStartup = 4000;
// The other two windows (compose + addrbook) are closed after 3 seconds,
// well close after 8 to allow a little extra time - if they get delayed, then
// well get a prompt for closing the compose window that we don't want.
// See bug 321783.
const kMailClose = 8000;

const kMailWaitTotal = kMailStartup + kMailClose;

function startMainTest()
{
  removeEventListener("load", startMainTest, false);

  setTimeout(shutdownMainWindow, kMailWaitTotal);

  // First thing to do is to start the address book and compose windows
  toOpenWindowByType("mail:addressbook",
                     "chrome://messenger/content/addressbook/addressbook.xul");

  startComposeWindow();
}

function shutdownMainWindow()
{
  var window = Services.wm.getMostRecentWindow("msgcompose");

  // Double-check because of bug 321783
  if (window)
  {
    // It hasn't shutdown yet, reset the timeout
    dump("XXX Trying to quit too early, delaying shutdown to stop bug 321783 affecting us\n");
    setTimeout(shutdownMainWindow, kMailWaitTotal);
    return;
  }

  goQuitApplication();
}

function startComposeWindow()
{
  var msgComposeService =
    Components.classes["@mozilla.org/messengercompose;1"]
              .getService(Components.interfaces.nsIMsgComposeService);

  // Compose a new message, format HTML, default identity
  msgComposeService.OpenComposeWindow(null, null, null, 0, 1, null, null);
}

// Add the startMainTest call to the load event for the window.
addEventListener("load", startMainTest, false);
