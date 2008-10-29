/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla MailNews test code.
 *   Mark Banner <bugzilla@standard8.plus.com>
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);

  var window = wm.getMostRecentWindow("msgcompose");

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
