/* This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function test() {
  waitForExplicitFinish();

  let prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch);

  let findBar = document.getElementById("FindToolbar");
  let textbox = findBar.getElement("findbar-textbox");

  let temp = {};
  Components.utils.import("resource:///modules/Sanitizer.jsm", temp);
  let s = temp.Sanitizer;
  let prefBranch = prefService.getBranch("privacy.item.");

  prefBranch.setBoolPref("cache", false);
  prefBranch.setBoolPref("cookies", false);
  prefBranch.setBoolPref("downloads", false);
  prefBranch.setBoolPref("formdata", true);
  prefBranch.setBoolPref("history", false);
  prefBranch.setBoolPref("offlineApps", false);
  prefBranch.setBoolPref("passwords", false);
  prefBranch.setBoolPref("sessions", false);
  prefBranch.setBoolPref("siteSettings", false);

  prefService.setBoolPref("privacy.sanitize.promptOnSanitize", false);

  // Sanitize now so we can test that canClear is correct
  s.sanitize();
  ok(!s.canClearItem("formdata"), "pre-test baseline for sanitizer");
  textbox.value = "m";
  ok(s.canClearItem("formdata"), "formdata can be cleared after input");
  s.sanitize();
  is(textbox.value, "", "findBar textbox should be empty after sanitize");
  ok(!s.canClearItem("formdata"), "canClear now false after sanitize");
  finish();
}
