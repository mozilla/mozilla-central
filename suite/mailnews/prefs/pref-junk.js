/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function Startup()
{
  UpdateDependentElement("manualMark", "manualMarkMode");
  UpdateDependentElement("enableJunkLogging", "openJunkLog");
}

function UpdateDependentElement(aBaseId, aDependentId)
{
  var pref = document.getElementById(aBaseId).getAttribute("preference");
  EnableElementById(aDependentId, document.getElementById(pref).value, false);
}

function OpenJunkLog()
{
  window.openDialog("chrome://messenger/content/junkLog.xul",
                    "junkLog",
                    "chrome,modal,titlebar,resizable,centerscreen");
}

function ResetTrainingData()
{
  // make sure the user really wants to do this
  var bundle = document.getElementById("bundleJunkPreferences");
  var title  = bundle.getString("confirmResetJunkTrainingTitle");
  var text   = bundle.getString("confirmResetJunkTrainingText");

  // if the user says no, then just fall out
  if (Services.prompt.confirmEx(window, title, text,
                                Services.prompt.STD_YES_NO_BUTTONS |
                                Services.prompt.BUTTON_POS_1_DEFAULT,
                                "", "", "", null, {}))
    return;

  // otherwise go ahead and remove the training data
  var junkmailPlugin = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                                 .getService(Components.interfaces.nsIJunkMailPlugin);

  if (junkmailPlugin)
    junkmailPlugin.resetTrainingData();
}
