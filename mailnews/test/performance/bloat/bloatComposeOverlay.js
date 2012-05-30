/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Milliseconds. Decided on MacBook 2.4GHz Intel (Dual Core).
// 200ms would crash, 2s seemed stable and enough time for the window to
// actually be displayed, so left it as 3s.
const kComposeStartup = 3000;

var gCurrentTimeout;

function startComposeTest()
{
  removeEventListener("load", startComposeTest, false);

  // load gets called before we've finished displaying/really loading, so we
  // have to have a bit of a timeout to allow it to get to that stage.
  gCurrentTimeout = setTimeout(handleComposeTest, kComposeStartup);
}

function handleComposeTest()
{
  // Call the correct close compose window function, this also skips the
  // are you sure you want to close it prompt (bug 321783).
  MsgComposeCloseWindow(true);
}

// Add the startBloatTest call to the load event for the window.
addEventListener("load", startComposeTest, false);
