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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jean-Francois Ducarroz <ducarroz@netscape.com>
 *   Ben Bucksch <mozilla.BenB@bucksch.org>
 *   Ian Neal <bugzilla@arlen.demon.co.uk>
 *   Žiga Sancin <bisi@pikslar.com>
 *   Magnus Melin <mkmelin+mozilla@iki.fi>
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

var gParam = null;

/**
 * This dialog should be opened with arguments like e.g.
 * {action: nsIMsgCompSendFormat.AskUser, convertible: nsIMsgCompConvertible.Yes}
 */
function Startup()
{
  gParam = window.arguments[0];

  const msgCompSendFormat = Components.interfaces.nsIMsgCompSendFormat;
  const msgCompConvertible = Components.interfaces.nsIMsgCompConvertible;

  var bundle = document.getElementById("askSendFormatStringBundle");

  // If the user hits the close box, we will abort.
  gParam.abort = true;

  // Set the question label
  var mailSendFormatExplanation = document.getElementById("mailSendFormatExplanation");
  var icon = document.getElementById("convertDefault");

  switch (gParam.convertible)
  {
    case msgCompConvertible.Altering:
      mailSendFormatExplanation.textContent = bundle.getString("convertibleAltering");
      icon.className = "question-icon";
      break;
    case msgCompConvertible.No:
      mailSendFormatExplanation.textContent = bundle.getString("convertibleNo");
      icon.className = "alert-icon";
      break;
    default: // msgCompConvertible.Yes
      mailSendFormatExplanation.textContent = bundle.getString("convertibleYes");
      // XXX change this to use class message-icon once bug 512173 is fixed
      icon.className = "question-icon";
      break;
  }

  // Set the default radio array value and recommendation.
  var group = document.getElementById("mailDefaultHTMLAction");
  if (gParam.action != msgCompSendFormat.AskUser)
  {
    group.value = gParam.action;
    group.selectedItem.label += " " + bundle.getString("recommended");
  }
}

function Send()
{
  // gParam.action should be an integer for when it is returned to MsgComposeCommands.js
  gParam.action = parseInt(document.getElementById("mailDefaultHTMLAction").value);
  gParam.abort = false;
}
