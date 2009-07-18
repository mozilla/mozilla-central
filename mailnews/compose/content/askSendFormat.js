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

var msgCompSendFormat = Components.interfaces.nsIMsgCompSendFormat;
var msgCompConvertible = Components.interfaces.nsIMsgCompConvertible;
var param = null;

/* There are 3 preferences that let you customize the behavior of this dialog

1. pref("mail.asksendformat.default", 1); //1=plaintext, 2=html, 3=both
   This defines the default action selected when the dialog opens. It can be overwritten by the preference
   mail.asksendformat.recommended_as_default


2. pref("mail.asksendformat.recommended_as_default", true);
   If you set this preference to true and we have a recommended action, this action will be selected by default.
   In this case, we ignore the preference mail.asksendformat.default


3. pref("mail.asksendformat.display_recommendation", true);
   When this preference is set to false, the recommended action label will not be displayed next to the action
   radio button. However, the default action might change to the recommended one if the preference
   mail.asksendformat.recommended_as_default is set.
*/

var defaultAction = msgCompSendFormat.PlainText;
var recommended_as_default = true;
var display_recommendation = true;
var useDefault = false;

var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService();
if (prefs)
{
  prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
  if (prefs)
  {
    try
    {
      defaultAction = prefs.getIntPref("mail.asksendformat.default");
      useDefault = true;
    }
    catch (ex) {}

    try
    {
      recommended_as_default = prefs.getBoolPref("mail.asksendformat.recommended_as_default");
    }
    catch (ex) {}

    try
    {
      display_recommendation = prefs.getBoolPref("mail.asksendformat.display_recommendation");
    }
    catch (ex) {}
  }
}

function Startup()
{
  if (window.arguments && window.arguments[0])
  {
    var askSendFormatStringBundle = document.getElementById("askSendFormatStringBundle");
    param = window.arguments[0];
    // If the user hits the close box, we will abort.
    param.abort = true;
    if (param.action)
    {
      // Set the question label
      var mailSendFormatExplanation = document.getElementById("mailSendFormatExplanation");
      var icon = document.getElementById("convertDefault");
      switch (param.convertible)
      {
        case msgCompConvertible.Plain:
          // We shouldn't be here at all
          mailSendFormatExplanation.textContent = askSendFormatStringBundle.getString("convertibleYes");
          // No icon
          break;
        case msgCompConvertible.Yes:
          mailSendFormatExplanation.textContent = askSendFormatStringBundle.getString("convertibleYes");
          icon.setAttribute("id", "convertYes");
          break;
        case msgCompConvertible.Altering:
          mailSendFormatExplanation.textContent = askSendFormatStringBundle.getString("convertibleAltering");
          icon.setAttribute("id", "convertAltering");
          break;
        case msgCompConvertible.No:
          mailSendFormatExplanation.textContent = askSendFormatStringBundle.getString("convertibleNo");
          icon.setAttribute("id", "convertNo");
          break;
      }

      // Set the default radio array value and recommendation
      var group = document.getElementById("mailDefaultHTMLAction");
      var radio;
      var radioButtons = group.getElementsByTagName("radio");
      var haveRecommendation = false;
      var format = (useDefault) ? defaultAction : param.action;

      switch (format)
      {
        case msgCompSendFormat.AskUser:
          // haveRecommendation = false;
          break;
        case msgCompSendFormat.PlainText:
          radio = radioButtons[1];
          haveRecommendation = true;
          break;
        case msgCompSendFormat.Both:
          radio = radioButtons[0];
          haveRecommendation = true;
          break;
        case msgCompSendFormat.HTML:
          radio = radioButtons[2];
          haveRecommendation = true;
          break;
      }

      if (haveRecommendation)
      {
        if (display_recommendation)
          radio.label += " " + askSendFormatStringBundle.getString("recommended");

        if (recommended_as_default)
          group.value = format;
      }

      if (!haveRecommendation || !recommended_as_default)
        group.value = defaultAction;
    }
  }
  else 
  {
    dump("error, no return object registered\n");
  }
}

function Send()
{
  if (param)
  {
    // param.action should be an integer for when it is returned to MsgComposeCommands.js
    param.action = parseInt(document.getElementById("mailDefaultHTMLAction").value);
    param.abort = false;
  }
  return true;
}

function Cancel()
{
  if (param)
    param.abort = true;
  return true;
}
