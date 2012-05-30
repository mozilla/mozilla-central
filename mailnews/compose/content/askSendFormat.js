/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
