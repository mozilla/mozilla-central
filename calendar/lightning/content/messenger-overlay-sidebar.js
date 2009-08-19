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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mike Shaver <shaver@mozilla.org>
 *   Vladimir Vukicevic <vladimir@pobox.com>
 *   Stuart Parmenter <stuart.parmenter@oracle.com>
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
 *   Simon Paquet <bugzilla@babylonsounds.com>
 *   Stefan Sitter <ssitter@googlemail.com>
 *   Thomas Benisch <thomas.benisch@sun.com>
 *   Michael Buettner <michael.buettner@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Berend Cornelius <berend.cornelius@sun.com>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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

var gLastShownCalendarView = null;

function yesterday()
{
    var d = now();
    d.day--;
    return d;
}

var calendarTabType = {
  name: "calendar",
  panelId: "calendarTabPanel",
  modes: {
    calendar: {
      type: "calendar",
      maxTabs: 1,
      openTab: function(aTab, aArgs) {
        aTab.title = aArgs["title"];
        if (!("background" in aArgs) || !aArgs["background"]) {
            // Only do calendar mode switching if the tab is opened in
            // foreground.
            ltnSwitch2Calendar();
        }

        if (("selectedDay" in aArgs) && aArgs.selectedDay != null) {
            currentView().goToDay(aArgs.selectedDay);
        }
      },

      showTab: function(aTab) {
        ltnSwitch2Calendar();
      },
      closeTab: function(aTab) {
        if (gCurrentMode == "calendar") {
          // Only revert menu hacks if closing the active tab, otherwise we
          // would switch to mail mode even if in task mode and closing the
          // calendar tab.
          ltnSwitch2Mail();
        }
      },

      persistTab: function(aTab) {
        let tabmail = document.getElementById("tabmail");
        return {
            // Save the currently selected day
            selectedDay: getSelectedDay().icalString,
            // Since we do strange tab switching logic in ltnSwitch2Calendar,
            // we should store the current tab state ourselves.
            background: (aTab != tabmail.currentTabInfo)
        };
      },

      restoreTab: function(aTabmail, aState) {
        aState.title = document.getElementById('calendar-tab-button').getAttribute('tooltiptext');
        if ("selectedDay" in aState) {
            // Convert the serialized date to a datetime object
            aState.selectedDay = cal.createDateTime(aState.selectedDay);
        }
        aTabmail.openTab('calendar', aState);
      },

      onTitleChanged: function(aTab) {
        // Make sure the title is updated.
        // TODO We should move this to a dedicated string some time.
        aTab.title = document.getElementById("calendar-tab-button").getAttribute("tooltiptext");
      },

      supportsCommand: function (aTab, aCommand) calendarController.supportsCommand(aCommand),
      isCommandEnabled: function (aTab, aCommand) calendarController.isCommandEnabled(aCommand),
      doCommand: function(aTab, aCommand) calendarController.doCommand(aCommand),
      onEvent: function(aTab, aEvent) calendarController.onEvent(aEvent)
    },

    tasks: {
      type: "tasks",
      maxTabs: 1,
      openTab: function(aTab, aArgs) {
        aTab.title = aArgs["title"];
        if (!("background" in aArgs) || !aArgs["background"]) {
            ltnSwitch2Task();
        }
      },
      showTab: function(aTab) {
        ltnSwitch2Task();
      },
      closeTab: function(aTab) {
        if (gCurrentMode == "task") {
          // Only revert menu hacks if closing the active tab, otherwise we
          // would switch to mail mode even if in calendar mode and closing the
          // tasks tab.
          ltnSwitch2Mail();
        }
      },

      persistTab: function(aTab) {
        let tabmail = document.getElementById("tabmail");
        return {
            // Since we do strange tab switching logic in ltnSwitch2Task,
            // we should store the current tab state ourselves.
            background: (aTab != tabmail.currentTabInfo)
        };
      },

      restoreTab: function(aTabmail, aState) {
        aState.title = document.getElementById('task-tab-button').getAttribute('tooltiptext');
        aTabmail.openTab('tasks', aState);
      },

      supportsCommand: function (aTab, aCommand) calendarController.supportsCommand(aCommand),
      isCommandEnabled: function (aTab, aCommand) calendarController.isCommandEnabled(aCommand),
      doCommand: function(aTab, aCommand) calendarController.doCommand(aCommand),
      onEvent: function(aTab, aEvent) calendarController.onEvent(aEvent)
    },
  },

  /* because calendar does some direct menu manipulation, we need to change
   *  to the mail mode to clean up after those hacks.
   */
  saveTabState: function(aTab) {
    ltnSwitch2Mail();
  },
};
window.addEventListener("load", function(e) {
  document.getElementById('tabmail').registerTabType(calendarTabType); }, false);


function ltnOnLoad(event) {

    // nuke the onload, or we get called every time there's
    // any load that occurs
    document.removeEventListener("load", ltnOnLoad, true);

    document.getElementById("calendarDisplayDeck").
      addEventListener("select", LtnObserveDisplayDeckChange, true);

    // Take care of common initialization
    commonInitCalendar();

    // Hide the calendar view so it doesn't push the status-bar offscreen
    collapseElement(document.getElementById("calendar-view-box"));

    // Add an unload function to the window so we don't leak any listeners
    window.addEventListener("unload", ltnFinish, false);

    // Set up invitations manager
    scheduleInvitationsUpdate(FIRST_DELAY_STARTUP);
    getCalendarManager().addObserver(gInvitationsCalendarManagerObserver);

    let filter = document.getElementById("task-tree-filtergroup");
    filter.value = filter.value || "all";
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);
    document.getElementById("modeBroadcaster").setAttribute("checked", "true");

    let mailContextPopup = document.getElementById("mailContext");
    if (mailContextPopup)
      mailContextPopup.addEventListener("popupshowing",
                                        gCalSetupMailContext.popup, false);

}

/* Called at midnight to tell us to redraw date-specific widgets.  Do NOT call
 * this for normal refresh, since it also calls scheduleMidnightRefresh.
 */
function refreshUIBits() {
    try {
        getMinimonth().refreshDisplay();

        // refresh the current view, if it has ever been shown
        var cView = currentView();
        if (cView.initialized) {
            cView.goToDay(cView.selectedDay);
        }

        if (!TodayPane.showsToday()) {
            TodayPane.setDay(now());
        }

        // update the unifinder
        refreshEventTree();
    } catch (exc) {
        ASSERT(false, exc);
    }

    // schedule our next update...
    scheduleMidnightUpdate(refreshUIBits);
}

/**
 * Select the calendar view in the background, not switching to calendar mode if
 * in mail mode.
 */
function ltnSelectCalendarView(type) {
    gLastShownCalendarView = type;

    // Sunbird/Lightning Common view switching code
    switchToView(type);

}

/**
 * Show the calendar view, also switching to calendar mode if in mail mode
 */
function ltnShowCalendarView(type)
{
    gLastShownCalendarView = type;

    if (gCurrentMode != 'calendar') {
        // This function in turn calls showCalendarView(), so return afterwards.
        ltnSwitch2Calendar();
        return;
    }

    ltnSelectCalendarView(type);
}


/**
 * This function has the sole responsibility to switch back to
 * mail mode (by calling ltnSwitch2Mail()) if we are getting
 * notifications from other panels (besides the calendar views)
 * but find out that we're not in mail mode. This situation can
 * for example happen if we're in calendar mode but the 'new mail'
 * slider gets clicked and wants to display the appropriate mail.
 * All necessary logic for switching between the different modes
 * should live inside of the corresponding functions:
 * - ltnSwitch2Mail()
 * - ltnSwitch2Calendar()
 * - ltnSwitch2Task()
 */
function LtnObserveDisplayDeckChange(event) {
    var deck = event.target;

    // Bug 309505: The 'select' event also fires when we change the selected
    // panel of calendar-view-box.  Workaround with this check.
    if (deck.id != "calendarDisplayDeck") {
        return;
    }

    var id = null;
    try { id = deck.selectedPanel.id } catch (e) { }

    // Switch back to mail mode in case we find that this
    // notification has been fired but we're still in calendar or task mode.
    // Specifically, switch back if we're *not* in mail mode but the notification
    // did *not* come from either the "calendar-view-box" or the "calendar-task-box".
    if (gCurrentMode != 'mail') {
        if (id != "calendar-view-box" && id != "calendar-task-box") {
            ltnSwitch2Mail();
        }
    }
}

function ltnFinish() {
    getCalendarManager().removeObserver(gInvitationsCalendarManagerObserver);

    // Remove listener for mailContext.
    let mailContextPopup = document.getElementById("mailContext");
    if (mailContextPopup)
      mailContextPopup.removeEventListener("popupshowing",
                                           gCalSetupMailContext.popup, false);

    // Common finish steps
    commonFinishCalendar();
}

// After 1.5 was released, the search box was moved into an optional toolbar
// item, with a different ID.  This function keeps us compatible with both.
function findMailSearchBox() {
    var tb15Box = document.getElementById("searchBox");
    if (tb15Box) {
        return tb15Box;
    }

    var tb2Box = document.getElementById("searchInput");
    if (tb2Box) {
        return tb2Box;
    }

    // In later versions, it's possible that a user removed the search box from
    // the toolbar.
    return null;
}

// == invitations link
const FIRST_DELAY_STARTUP = 100;
const FIRST_DELAY_RESCHEDULE = 100;
const FIRST_DELAY_REGISTER = 10000;
const FIRST_DELAY_UNREGISTER = 0;

var gInvitationsOperationListener = {
    mCount: 0,

    onOperationComplete: function sBOL_onOperationComplete(aCalendar,
                                                           aStatus,
                                                           aOperationType,
                                                           aId,
                                                           aDetail) {
        let invitationsBox = document.getElementById("calendar-invitations-panel");
        if (Components.isSuccessCode(aStatus)) {
            let value = ltnGetString("lightning", "invitationsLink.label", [this.mCount]);
            document.getElementById("calendar-invitations-label").value = value;
            setElementValue(invitationsBox, this.mCount < 1 && "true", "hidden");
        } else {
            invitationsBox.setAttribute("hidden", "true");
        }
        this.mCount = 0;
    },

    onGetResult: function sBOL_onGetResult(aCalendar,
                                           aStatus,
                                           aItemType,
                                           aDetail,
                                           aCount,
                                           aItems) {
        if (Components.isSuccessCode(aStatus)) {
            this.mCount += aCount;
        }
    }
};

var gInvitationsCalendarManagerObserver = {
    mSideBar: this,

    onCalendarRegistered: function cMO_onCalendarRegistered(aCalendar) {
        this.mSideBar.rescheduleInvitationsUpdate(FIRST_DELAY_REGISTER);
    },

    onCalendarUnregistering: function cMO_onCalendarUnregistering(aCalendar) {
        this.mSideBar.rescheduleInvitationsUpdate(FIRST_DELAY_UNREGISTER);
    },

    onCalendarDeleting: function cMO_onCalendarDeleting(aCalendar) {
    }
};

function scheduleInvitationsUpdate(firstDelay) {
    gInvitationsCalendarManagerObserver.mCount = 0;
    getInvitationsManager().scheduleInvitationsUpdate(firstDelay,
                                                      gInvitationsOperationListener);
}

function rescheduleInvitationsUpdate(firstDelay) {
    getInvitationsManager().cancelInvitationsUpdate();
    scheduleInvitationsUpdate(firstDelay);
}

function openInvitationsDialog() {
    getInvitationsManager().cancelInvitationsUpdate();
    gInvitationsCalendarManagerObserver.mCount = 0;
    getInvitationsManager().openInvitationsDialog(
        gInvitationsOperationListener,
        function oiD_callback() {
            scheduleInvitationsUpdate(FIRST_DELAY_RESCHEDULE);
        });
}

/**
 * the current mode is set to a string defining the current
 * mode we're in. allowed values are:
 *  - 'mode'
 *  - 'mail'
 *  - 'calendar'
 *  - 'task'
 */
var gCurrentMode = 'mail';

/**
 * ltnSwitch2Mail() switches to the mail mode
 */

function ltnSwitch2Mail() {
  if (gCurrentMode != 'mail') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.setAttribute("checked", "true");
    switch2calendar.removeAttribute("checked");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'mail';
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);

    document.commandDispatcher.updateCommands('calendar_commands');
    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Calendar() switches to the calendar mode
 */

function ltnSwitch2Calendar() {
  if (gCurrentMode != 'calendar') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.setAttribute("checked", "true");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'calendar';
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);

    // display the calendar panel on the display deck
    var viewBox = document.getElementById("calendar-view-box");
    uncollapseElement(viewBox);
    var deck = document.getElementById("calendarDisplayDeck");
    deck.selectedPanel = viewBox;

    // show the last displayed type of calendar view
    showCalendarView(gLastShownCalendarView);

    document.commandDispatcher.updateCommands('calendar_commands');
    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Task() switches to the task mode
 */

function ltnSwitch2Task() {
  if (gCurrentMode != 'task') {
    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.removeAttribute("checked");
    switch2task.setAttribute("checked", "true");

    gCurrentMode = 'task';
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);

    // display the task panel on the display deck
    var taskBox = document.getElementById("calendar-task-box");
    uncollapseElement(taskBox);
    var deck = document.getElementById("calendarDisplayDeck");
    deck.selectedPanel = taskBox;

    document.commandDispatcher.updateCommands('calendar_commands');
    window.setCursor("auto");
  }
}

const gCalSetupMailContext = {
    popup: function gCalSetupMailContext_popup() {
        let hasSelection = (gFolderDisplay.selectedMessage != null);
        // Disable the convert menu altogether.
        setElementValue("mailContext-calendar-convert-menu",
                        !hasSelection && "true", "hidden");
    }
};

// Overwrite the InitMessageMenu function, since we never know in which order
// the popupshowing event will be processed. This function takes care of
// disabling the message menu when in calendar or task mode.
function calInitMessageMenu() {
    calInitMessageMenu.origFunc();

    document.getElementById("markMenu").disabled = (gCurrentMode != 'mail');
}
calInitMessageMenu.origFunc = InitMessageMenu;
InitMessageMenu = calInitMessageMenu;

document.addEventListener("load", ltnOnLoad, true);
