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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

var calendarController = {
    defaultController: null,

    commands: {
        // Common commands
        "calendar_new_event_command": true,
        "calendar_modify_event_command": true,
        "calendar_delete_event_command": true,

        "calendar_new_todo_command": true,
        "calendar_delete_todo_command": true,

        "calendar_new_calendar_command": true,
        "calendar_edit_calendar_command": true,
        "calendar_delete_calendar_command": true,

        "calendar_import_command": true,
        "calendar_export_command": true,
        "calendar_export_selection_command": true,

        "calendar_publish_selected_calendar_command": true,
        "calendar_publish_calendar_command": true,
        "calendar_publish_selected_events_command": true,

        "calendar_reload_remote_calendars": true,

        "cmd_cut": true,
        "cmd_copy": true,
        "cmd_paste": true,
        "cmd_undo": true,
        "cmd_redo": true,
        "cmd_print": true,
        "cmd_selectAll": true,
        "cmd_pageSetup": true,

        // Thunderbird commands
        "cmd_printpreview": true,
        "button_print": true,
        "button_delete": true,
        "cmd_delete": true
    },

    updateCommands: function cC_updateCommands() {
        for (var command in this.commands) {
            goUpdateCommand(command);
        }
    },

    supportsCommand: function cC_supportsCommand(aCommand) {
        if (aCommand in this.commands) {
            return true;
        }
        if (this.defaultContoller) {
            return this.defaultContoller.supportsCommand(aCommand);
        }
        return false;
    },

    isCommandEnabled: function cC_isCommandEnabled(aCommand) {
        switch (aCommand) {
            case "calendar_new_event_command":
                return this.writable && this.calendars_support_events;
            case "calendar_modify_event_command":
                return this.item_selected;
            case "calendar_delete_event_command":
                return this.selected_items_writable;
            case "calendar_new_todo_command":
                return this.writable && this.calendars_support_tasks;
            case "calendar_delete_todo_comand":
                return this.writable; // XXX are selected todo items readonly?

            case "calendar_delete_calendar_command":
                return !this.last_calendar;

            case "calendar_import_command":
                return this.writable;
            case "calendar_export_selection_command":
                return this.item_selected;

            case "calendar_publish_selected_events_command":
                return this.item_selected;

            case "calendar_reload_remote_calendar":
                return !this.no_network_calendars && !this.offline

            // Thunderbird Commands
            case "cmd_cut":
                return this.selected_items_writable;
            case "cmd_copy":
                return this.item_selected;
            case "cmd_paste":
                return this.writable && canPaste();
            case "cmd_undo":
                if (this.isCalendarInForeground()) {
                    goSetMenuValue(aCommand, 'valueDefault');
                    if (canUndo()) {
                        return true;
                    }
                }
                break;
            case "cmd_redo":
                if (this.isCalendarInForeground()) {
                    goSetMenuValue(aCommand, 'valueDefault');
                    if (canRedo()) {
                        return true;
                    }
                }
                break;

            case "cmd_selectAll":
                if (this.isCalendarInForeground()) {
                    // If there are no events at all, we might want to disable
                    // this item
                    return true;
                }
                break;

            case "button_print":
            case "cmd_print":
                if (this.isCalendarInForeground()) {
                    return true;
                }
                break;
            case "cmd_printpreview":
                if (this.isCalendarInForeground()) {
                    return false;
                }
                break;
            case "button_delete":
            case "cmd_delete":
                if (this.isCalendarInForeground()) {
                    return this.item_selected;
                }
                break;
        }

        if (aCommand in this.commands) {
            // All other commands we support should be enabled by default
            return true;
        }

        if (this.defaultController) {
            return this.defaultController.isCommandEnabled(aCommand);
        }
        return false;
    },

    doCommand: function cC_doCommand(aCommand) {
        switch (aCommand) {
            // Common Commands
            case "calendar_new_event_command":
                createEventWithDialog(getSelectedCalendar());
                break;
            case "calendar_modify_event_command":
                editSelectedEvents();
                break;
            case "calendar_delete_event_command":
                deleteSelectedEvents();
                break;

            case "calendar_new_todo_command":
                createTodoWithDialog(getSelectedCalendar());
                break;
            case "calendar_delete_todo_command":
                deleteToDoCommand();
                break;

            case "calendar_new_calendar_command":
                openCalendarWizard();
                break;
            case "calendar_edit_calendar_command":
                openCalendarProperties(getSelectedCalendar());
                break;
            case "calendar_delete_calendar_command":
                promptDeleteCalendar(getSelectedCalendar());
                break;

            case "calendar_import_command":
                loadEventsFromFile();
                break;
            case "calendar_export_command":
                exportEntireCalendar();
                break;
            case "calendar_export_selection_command":
                saveEventsToFile(currentView().getSelectedItems({}));
                break;

            case "calendar_publish_selected_calendar_command":
                publishEntireCalendar(getSelectedCalendar());
                break;
            case "calendar_publish_calendar_command":
                publishEntireCalendar();
                break;
            case "calendar_publish_selected_events_command":
                publishCalendarData();
                break;

            case "calendar_reload_remote_calendars":
                getCompositeCalendar().refresh();
                break;

            // These commands are overridden in lightning and native in sunbird.
            case "cmd_cut":
                cutToClipboard();
                break;
            case "cmd_copy":
                copyToClipboard();
                break;
            case "cmd_paste":
                pasteFromClipboard();
                break;
            case "cmd_undo":
                if (this.isCalendarInForeground() && canUndo()) {
                    getTransactionMgr().undo();
                }
                break;
            case "cmd_redo":
                if (this.isCalendarInForeground() && canRedo()) {
                    getTransactionMgr().redo();
                }
                break;
            case "cmd_selectAll":
                selectAllEvents();
                break;
            case "cmd_pageSetup":
                PrintUtils.showPageSetup();
                break;
            case "button_print":
            case "cmd_print":
                if (this.isCalendarInForeground()) {
                    calPrint();
                    return;
                }
                break;

            // Thunderbird commands
            case "cmd_printpreview":
            case "button_delete":
            case "cmd_delete":
                if (this.isCalendarInForeground()) {
                    // For these commands, nothing should happen in calendar mode.
                    return;
                }
                break;
        }

        if (this.defaultController) {
            this.defaultController.doCommand(aCommand);
        }
    },

    onEvent: function cC_onEvent(aEvent) {
    },

    isCalendarInForeground: function cC_isCalendarInForeground() {
        // For sunbird, calendar is always in foreground. Otherwise check if the
        // displayDeck is showing the calendar box.
        return isSunbird() ||
            document.getElementById("displayDeck").selectedPanel.id == "calendar-view-box";
    },

    /**
     * Condition Helpers
     */

    // This will be set up manually.
    item_selected: false,
    selected_events_readonly: false,
    selected_events_requires_network: false,

    get writable() {
        return !this.all_readonly &&
               (!this.offline || (this.has_local_calendars &&
               !this.all_local_calendars_readonly));
    },

    get offline() {
        return getIOService().offline;
    },

    get all_readonly () {
        var calMgr = getCalendarManager();
        return (calMgr.readOnlyCalendarCount == calMgr.calendarCount);
    },

    get no_network_calendars() {
        return (getCalendarManager().networkCalendarCount == 0);
    },

    get has_local_calendars() {
        var calMgr = getCalendarManager();
        return (calMgr.networkCalendarCount < calMgr.calendarCount);
    },

    get last_calendar() {
        return (getCalendarManager().calendarCount < 2);
    },

    get all_local_calendars_readonly() {
        // We might want to speed this part up by keeping track of this in the
        // calendar manager.
        var cals = getCalendarManager().getCalendars({});
        var count = cals.length;
        for each (var cal in cals) {
            if (!isCalendarWritable(cal)) {
                count--;
            }
        }
        return (count == 0);
    },

    get selected_items_writable() {
        return this.writable &&
               this.item_selected &&
               !this.selected_events_readonly &&
               (!this.offline || !this.selected_events_requires_network);
    },

    get calendars_support_tasks() {
        // XXX We might want to cache this
        var calendars = getCalendarManager().getCalendars({});

        for each (var cal in calendars) {
            if (isCalendarWritable(cal) &&
                cal.getProperty("capabilities.tasks.supported") !== false) {
                return true;
            }
        }
        return false;
    },

    get calendars_support_events() {
        // XXX We might want to cache this
        var calendars = getCalendarManager().getCalendars({});

        for each (var cal in calendars) {
            if (isCalendarWritable(cal) &&
                cal.getProperty("capabilities.events.supported") !== false) {
                return true;
            }
        }
        return false;
    }
};

function injectCalendarCommandController() {
    if (!isSunbird()) {
        // We need to put our new command controller *before* the one that
        // gets installed by thunderbird. Since we get called pretty early
        // during startup we need to install the function below as a callback
        // that periodically checks when the original thunderbird controller
        // gets alive. Please note that setTimeout with a value of 0 means that
        // we leave the current thread in order to re-enter the message loop.

        var tbController = top.controllers.getControllerForCommand("cmd_undo");
        if (!tbController) {
            setTimeout(injectCalendarCommandController, 0);
            return;
        } else {
            calendarController.defaultController = tbController;
            ltnInitializeCalendarMenu();
        }
    }
    top.controllers.insertControllerAt(0, calendarController);
    document.commandDispatcher.updateCommands("calendar_commands");
}
