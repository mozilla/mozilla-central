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
* Portions created by the Initial Developer are Copyright (C) 1998-1999
* the Initial Developer. All Rights Reserved.
*
* Contributor(s):
*   Håkan Waara <hwaara@chello.se>
*   Peter Annema <disttsc@bart.nl>
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

function Startup()
{
  SetDisables(false);
}

function SetDisables(aSetFocus)
{
  // const for Cookie Accept Policy
  const kCookiesDisabled = 2;
  // const for Cookie Lifetime Policy
  const kAskBeforeAccepting = 1;
  const kAcceptForNDays = 3;

  var behavior = document.getElementById("networkCookieBehavior");
  var behaviorPref = document.getElementById(behavior.getAttribute("preference"));

  var lifetime = document.getElementById("networkCookieLifetime");
  var lifetimePref = document.getElementById(lifetime.getAttribute("preference"));
  var days = document.getElementById("lifetimeDays");
  var daysPref = document.getElementById(days.getAttribute("preference"));

  var session = document.getElementById("alwaysAcceptSession");
  var sessionPref = document.getElementById(session.getAttribute("preference"));

  var cookiesDisabled = (behaviorPref.value == kCookiesDisabled);
  lifetime.disabled = cookiesDisabled || lifetimePref.locked;
  days.disabled = cookiesDisabled || daysPref.locked ||
                  (lifetimePref.value != kAcceptForNDays);
  session.disabled = cookiesDisabled || sessionPref.locked ||
                     (lifetimePref.value != kAskBeforeAccepting);

  if (!days.disabled && aSetFocus)
    days.focus();
}
