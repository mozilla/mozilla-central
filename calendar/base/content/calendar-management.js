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
 * The Original Code is Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michiel van Leeuwen <mvl@exedo.nl>
 *   Joey Minta <jminta@gmail.com>
 *   Berend Cornelius <berend.cornelius@sun.com>
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

/**
 * Get this window's currently selected calendar.
 * 
 * @return      The currently selected calendar.
 */
function getSelectedCalendar() {
    return getCompositeCalendar().defaultCalendar;
}

/**
 * Deletes the passed calendar, prompting the user if he really wants to do
 * this. If there is only one calendar left, no calendar is removed and the user
 * is not prompted.
 *
 * @param aCalendar     The calendar to delete.
 */
function promptDeleteCalendar(aCalendar) {
    var calendars = getCalendarManager().getCalendars({});
    if (calendars.length <= 1) {
        // If this is the last calendar, don't delete it.
        return;
    }

    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
    var ok = promptService.confirm(
        window,
        calGetString("calendar", "unsubscribeCalendarTitle"),
        calGetString("calendar",
                     "unsubscribeCalendarMessage",
                     [aCalendar.name]),
        {});

    if (ok) {
        var calMgr = getCalendarManager();
        calMgr.unregisterCalendar(aCalendar);
        calMgr.deleteCalendar(aCalendar);
    }
}

/**
 * Called to initialize the calendar manager for a window.
 */
function loadCalendarManager() {
    // Set up the composite calendar in the calendar list widget.
    let tree = document.getElementById("calendar-list-tree-widget");
    tree.compositeCalendar = getCompositeCalendar();

    // Create the home calendar if no calendar exists.
    let calendars = getCalendarManager().getCalendars({});
    if (!calendars.length) {
        initHomeCalendar();
    }
}

/**
 * Creates the initial "Home" calendar if no calendar exists.
 */
function initHomeCalendar() {
    let calMgr = cal.getCalendarManager();
    let composite = getCompositeCalendar();
    let url = makeURL("moz-profile-calendar://");
    let homeCalendar = calMgr.createCalendar("storage", url);
    homeCalendar.name = calGetString("calendar", "homeCalendarName");
    calMgr.registerCalendar(homeCalendar);
    cal.setPref("calendar.list.sortOrder", homeCalendar.id);
    composite.addCalendar(homeCalendar);

    // Wrapping this in a try/catch block, as if any of the migration code
    // fails, the app may not load.
    if (getPrefSafe("calendar.migrator.enabled", true)) {
        try {
            gDataMigrator.checkAndMigrate();
        } catch (e) {
            Components.utils.reportError("Migrator error: " + e);
        }
    }

    return homeCalendar;
}

/**
 * Called to clean up the calendar manager for a window.
 */
function unloadCalendarManager() {
    var composite = getCompositeCalendar();
    composite.setStatusObserver(null, null);
}

/**
 * Updates the sort order preference based on the given event. The event is a
 * "SortOrderChanged" event, emitted from the calendar-list-tree binding. You
 * can also pass in an object like { sortOrder: "Space separated calendar ids" }
 *
 * @param event     The SortOrderChanged event described above.
 */
function updateSortOrderPref(event) {
    let sortOrderString = event.sortOrder.join(" ");
    cal.setPref("calendar.list.sortOrder", sortOrderString);
}

/**
 * Handler function to call when the tooltip is showing on the calendar list.
 *
 * @param event     The DOM event provoked by the tooltip showing.
 */
function calendarListTooltipShowing(event) {
    let tree = document.getElementById("calendar-list-tree-widget");
    let calendar = tree.getCalendarFromEvent(event);
    let tooltipText = false;
    if (calendar) {
        let currentStatus = calendar.getProperty("currentStatus");
        if (!Components.isSuccessCode(currentStatus)){
            tooltipText = calGetString("calendar", "tooltipCalendarDisabled", [calendar.name]);
        } else if (calendar.readOnly) {
            tooltipText = calGetString("calendar", "tooltipCalendarReadOnly", [calendar.name]);
        }
    }
    setElementValue("calendar-list-tooltip", tooltipText, "label");
    return (tooltipText != false);
}

/**
 * A handler called to set up the context menu on the calendar list.
 *
 * @param event         The DOM event that caused the context menu to open.
 * @return              Returns true if the context menu should be shown.
 */
function calendarListSetupContextMenu(event) {
    let col = {};
    let row = {};
    let calendar;
    let calendars = getCalendarManager().getCalendars({});
    let treeNode = document.getElementById("calendar-list-tree-widget");

    if (document.popupNode.localName == "tree") {
        // Using VK_APPS to open the context menu will target the tree
        // itself. In that case we won't have a client point even for
        // opening the context menu. The "target" element should then be the
        // selected calendar.
        row.value =  treeNode.tree.currentIndex;
        col.value = treeNode.getColumn("calendarname-treecol");
        calendar = treeNode.getCalendar(row.value);
    } else {
        // Using the mouse, the context menu will open on the treechildren
        // element. Here we can use client points.
        calendar = treeNode.getCalendarFromEvent(event, col, row);
    }

    if (col.value &&
        col.value.element.getAttribute("anonid") == "checkbox-treecol") {
        // Don't show the context menu if the checkbox was clicked.
        return false;
    }

    document.getElementById("list-calendars-context-menu").contextCalendar = calendar;

    // Only enable calendar search if there's actually the chance of finding something:
    let hasProviders = getCalendarSearchService().getProviders({}).length < 1 && "true";
    setElementValue("list-calendars-context-find", hasProviders, "collapsed");

    if (calendar) {
        enableElement("list-calendars-context-edit");
        enableElement("list-calendars-context-publish");
        // Only enable the delete calendars item if there is more than one
        // calendar. We don't want to have the last calendar deleted.
        if (calendars.length > 1) {
            enableElement("list-calendars-context-delete");
        }
    } else {
        disableElement("list-calendars-context-edit");
        disableElement("list-calendars-context-publish");
        disableElement("list-calendars-context-delete");
    }
    return true;
}

var compositeObserver = {
    QueryInterface: function cO_QueryInterface(aIID) {
        return cal.doQueryInterface(this,
                                    calendarManagementCompositeObserver.prototype,
                                    aIID,
                                    [Components.interfaces.calICompositeObserver]);
    },

    onCalendarAdded: function cO_onCalendarAdded(aCalendar) {
        // Update the calendar commands for number of remote calendars and for
        // more than one calendar
        document.commandDispatcher.updateCommands("calendar_commands");
    },

    onCalendarRemoved: function cO_onCalendarRemoved(aCalendar) {
        // Update commands to disallow deleting the last calendar and only
        // allowing reload remote calendars when there are remote calendars.
        document.commandDispatcher.updateCommands("calendar_commands");
    }
};

/**
 * Opens the subscriptions dialog modally.
 */
function openCalendarSubscriptionsDialog() {
    // the dialog will reset this to auto when it is done loading
    window.setCursor("wait");

    // open the dialog modally
    window.openDialog("chrome://calendar/content/calendar-subscriptions-dialog.xul",
                      "_blank",
                      "chrome,titlebar,modal,resizable");
}

/**
 * Calendar Offline Manager
 */
var calendarOfflineManager = {
    QueryInterface: function cOM_QueryInterface(aIID) {
        return doQueryInterface(this, calendarOfflineManager.prototype, aIID,
                                [Components.interfaces.nsIObserver, Components.interfaces.nsISupports]);
    },

    init: function cOM_init() {
        if (this.initialized) {
            throw Components.results.NS_ERROR_ALREADY_INITIALIZED;
        }
        var os = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
        os.addObserver(this, "network:offline-status-changed", false);

        this.updateOfflineUI(!this.isOnline());
        this.initialized = true;
    },

    uninit: function cOM_uninit() {
        if (!this.initialized) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
        var os = Components.classes["@mozilla.org/observer-service;1"]
                           .getService(Components.interfaces.nsIObserverService);
        os.removeObserver(this, "network:offline-status-changed", false);
        this.initialized = false;
    },

    isOnline: function cOM_isOnline() {
        return (!getIOService().offline);

    },

    updateOfflineUI: function cOM_updateOfflineUI(aIsOffline) {
        // Refresh the current view
        currentView().goToDay(currentView().selectedDay);

        // Set up disabled locks for offline
        document.commandDispatcher.updateCommands("calendar_commands");
    },

    observe: function cOM_observe(aSubject, aTopic, aState) {
        if (aTopic == "network:offline-status-changed") {
            this.updateOfflineUI(aState == "offline");
        }
    }
};
