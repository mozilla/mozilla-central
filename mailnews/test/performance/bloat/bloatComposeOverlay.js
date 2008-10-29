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
