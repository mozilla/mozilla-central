var ltnSuiteUtils = {

  customizeToolbar: function lSU_customizeToolbar(aItem) {
    let toolbar = aItem.parentNode.triggerNode;
    while (toolbar.localName != "toolbar")
      toolbar = toolbar.parentNode;
    goCustomizeToolbar(toolbar.toolbox);
  },

  addStartupObserver: function lSU_addStartupObserver() {
    let obs = Components.classes["@mozilla.org/observer-service;1"]
                        .getService(Components.interfaces.nsIObserverService);
    obs.addObserver(this.startupObserver, "lightning-startup-done", false);
    obs.addObserver(this.startupObserver, "calendar-taskview-startup-done",
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
