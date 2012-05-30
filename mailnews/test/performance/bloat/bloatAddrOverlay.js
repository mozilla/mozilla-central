/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Milliseconds. Decided on MacBook 2.4GHz Intel (Dual Core).
// 3s seemed a resonable time for the address book window to be displayed.
const kABStartup = 3000;

var gCurrentTimeout;

function startABTest() 
{
  removeEventListener("load", startABTest, false);

  // load gets called before we've finished displaying/really loading, so we
  // have to have a bit of a timeout to allow it to get to that stage.
  gCurrentTimeout = setTimeout(mainABTest, kABStartup);
}

function mainABTest()
{
  // Close the window.
  window.close();
}

// Add the startABTest call to the load event for the window.
addEventListener("load", startABTest, false);
