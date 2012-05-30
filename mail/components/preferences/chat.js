/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gChatPane = {
  init: function ()
  {
    this.updateDisabledState();
  },

  updateDisabledState: function ()
  {
    let broadcaster = document.getElementById("idleReportingEnabled");
    if (document.getElementById("messenger.status.reportIdle").value) {
      broadcaster.removeAttribute("disabled");
      this.updateMessageDisabledState();
    }
    else
      broadcaster.setAttribute("disabled", "true");
  },

  updateMessageDisabledState: function ()
  {
    let textbox = document.getElementById("defaultIdleAwayMessage");
    if (document.getElementById("messenger.status.awayWhenIdle").value)
      textbox.removeAttribute("disabled");
    else
      textbox.setAttribute("disabled", "true");
  }
};
