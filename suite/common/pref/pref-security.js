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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Kaiser <kairo@kairo.at>
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

function Startup()
{
  updateClearNowButtonLabel();
  document.getElementById("privacy.item.downloads").disabled = true; // XXX: as long as we aren't using toolkit's download manager
}

/**
 * Sets the label of the "Clear Now..." button according to the
 * privacy.sanitize.promptOnSanitize preference. Read valueFromPreferences to
 * only change the button when the underlying pref changes, since in the case
 * of instantApply=false, the call to clearPrivateDataNow would result in the
 * dialog appearing when the user just unchecked the "Ask me" checkbox.
 */
function updateClearNowButtonLabel()
{
  var pref = document.getElementById("privacy.sanitize.promptOnSanitize");
  var clearNowButton = document.getElementById("clearDataNow");

  if (pref.valueFromPreferences)
    clearNowButton.label = clearNowButton.getAttribute("labelDialog"); // "Clear Now..."
  else
    clearNowButton.label = clearNowButton.getAttribute("labelSilent"); // "Clear Now"
}

/**
 * Either displays a dialog from which individual parts of private data may be
 * cleared, or automatically clears private data according to current
 * CPD settings.  The former happens if privacy.sanitize.promptOnSanitize is
 * true, and the latter happens otherwise.
 */
function clearPrivateDataNow()
{
  Components.classes["@mozilla.org/suite/suiteglue;1"]
            .getService(Components.interfaces.nsISuiteGlue)
            .sanitize(window);
}
