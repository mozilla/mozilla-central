/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var ltnSuiteUtils = {

  addStartupObserver: function lSU_addStartupObserver() {
    Services.obs.addObserver(this.startupObserver, "lightning-startup-done", false);
    Services.obs.addObserver(this.startupObserver, "calendar-taskview-startup-done",
                    false);

  },

  startupObserver: {
    observe: function lSU_observe(subject, topic, state) {
      if (topic != "lightning-startup-done" &&
          topic != "calendar-taskview-startup-done") {
        return;
      }

      [["CustomizeTaskActionsToolbar", "task-actions-toolbox"],
       ["CustomizeCalendarToolbar", "calendar-toolbox"],
       ["CustomizeTaskToolbar", "task-toolbox"]].forEach(function(eIDs) {
        let [itemID, toolboxID] = eIDs;
        let item = document.getElementById(itemID);
        let toolbox = document.getElementById(toolboxID);
        toolbox.customizeInit = function() {
          item.setAttribute("disabled", "true");
          toolboxCustomizeInit("mail-menubar");
        };
        toolbox.customizeDone = function(aToolboxChanged) {
          item.removeAttribute("disabled");
          toolboxCustomizeDone("mail-menubar", toolbox, aToolboxChanged);
        };
        toolbox.customizeChange = function(aEvent) {
          toolboxCustomizeChange(toolbox, aEvent);
        };
      });
    }
  }

}

ltnSuiteUtils.addStartupObserver();
