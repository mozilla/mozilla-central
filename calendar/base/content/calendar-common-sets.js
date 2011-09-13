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

/**
 * Command controller to execute calendar specific commands
 * @see nsICommandController
 */
var calendarController = {
    defaultController: null,

    commands: {
        // Common commands
        "calendar_new_event_command": true,
        "calendar_new_event_context_command": true,
        "calendar_modify_event_command": true,
        "calendar_delete_event_command": true,

        "calendar_modify_focused_item_command": true,
        "calendar_delete_focused_item_command": true,

        "calendar_new_todo_command": true,
        "calendar_new_todo_context_command": true,
        "calendar_new_todo_todaypane_command": true,
        "calendar_modify_todo_command": true,
        "calendar_modify_todo_todaypane_command": true,
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

        "calendar_view_next_command": true,
        "calendar_view_prev_command": true,

        "calendar_toggle_orientation_command": true,
        "calendar_toggle_workdays_only_command": true,

        "calendar_day-view_command": true,
        "calendar_week-view_command": true,
        "calendar_multiweek-view_command": true,
        "calendar_month-view_command": true,

        "calendar_task_filter_command": true,
        "calendar_reload_remote_calendars": true,
        "calendar_show_unifinder_command": true,
        "calendar_toggle_completed_command": true,
        "calendar_percentComplete-0_command": true,
        "calendar_percentComplete-25_command": true,
        "calendar_percentComplete-50_command": true,
        "calendar_percentComplete-75_command": true,
        "calendar_percentComplete-100_command": true,
        "calendar_priority-0_command": true,
        "calendar_priority-9_command": true,
        "calendar_priority-5_command": true,
        "calendar_priority-1_command": true,
        "calendar_general-priority_command": true,
        "calendar_general-progress_command": true,
        "calendar_task_category_command": true,

        "calendar_attendance_command": true,

        // Pseudo commands
        "calendar_in_foreground": true,
        "calendar_in_background": true,
        "calendar_mode_calendar": true,
        "calendar_mode_task": true,

        "cmd_selectAll": true
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
            case "calendar_new_event_context_command":
                return this.writable && this.calendars_support_events;
            case "calendar_modify_focused_item_command":
                return this.item_selected;
            case "calendar_modify_event_command":
                return this.item_selected;
            case "calendar_delete_focused_item_command":
                return this.selected_items_writable;
            case "calendar_delete_event_command":
                return this.selected_items_writable;
            case "calendar_new_todo_command":
            case "calendar_new_todo_context_command":
            case "calendar_new_todo_todaypane_command":
                return this.writable && this.calendars_support_tasks;
            case "calendar_modify_todo_command":
            case "calendar_modify_todo_todaypane_command":
                 return this.todo_items_selected;
                 // This code is temporarily commented out due to
                 // bug 469684 Unifinder-todo: raising of the context menu fires blur-event
                 // this.todo_tasktree_focused;
            case "calendar_edit_calendar_command":
                return this.isCalendarInForeground();
            case "calendar_task_filter_command":
                return true;
            case "calendar_delete_todo_command":
            case "calendar_toggle_completed_command":
            case "calendar_percentComplete-0_command":
            case "calendar_percentComplete-25_command":
            case "calendar_percentComplete-50_command":
            case "calendar_percentComplete-75_command":
            case "calendar_percentComplete-100_command":
            case "calendar_priority-0_command":
            case "calendar_priority-9_command":
            case "calendar_priority-5_command":
            case "calendar_priority-1_command":
            case "calendar_task_category_command":
            case "calendar_general-progress_command":
            case "calendar_general-priority_command":
                return (this.isCalendarInForeground() || this.todo_tasktree_focused) &&
                       this.writable &&
                       this.todo_items_selected &&
                       this.todo_items_writable;
            case "calendar_delete_calendar_command":
                return this.isCalendarInForeground() && !this.last_calendar;
            case "calendar_import_command":
                return this.writable;
            case "calendar_export_selection_command":
                return this.item_selected;
            case "calendar_toggle_orientation_command":
                return this.isInMode("calendar") &&
                       currentView().supportsRotation;
            case "calendar_toggle_workdays_only_command":
                return this.isInMode("calendar") &&
                       currentView().supportsWorkdaysOnly;
            case "calendar_publish_selected_events_command":
                return this.item_selected;

            case "calendar_reload_remote_calendar":
                return !this.no_network_calendars && !this.offline;
            case "calendar_attendance_command": {
                let attendSel = false;
                if (this.todo_tasktree_focused) {
                    attendSel = this.writable &&
                                this.todo_items_invitation &&
                                this.todo_items_selected &&
                                this.todo_items_writable;
                } else {
                    attendSel = this.item_selected && this.selected_events_invitation;
                }

                // Small hack, we want to hide instead of disable.
                setBooleanAttribute("calendar_attendance_command", "hidden", !attendSel);
                return attendSel;
                break;
            }

            // The following commands all just need the calendar in foreground,
            // make sure you take care when changing things here.
            case "calendar_view_next_command":
            case "calendar_view_prev_command":
            case "calendar_in_foreground":
                return this.isCalendarInForeground();
            case "calendar_in_background":
                return !this.isCalendarInForeground();

            // The following commands need calendar mode, be careful when
            // changing things.
            case "calendar_day-view_command":
            case "calendar_week-view_command":
            case "calendar_multiweek-view_command":
            case "calendar_month-view_command":
            case "calendar_show_unifinder_command":
            case "calendar_mode_calendar":
                return this.isInMode("calendar");

            case "calendar_mode_task":
                return this.isInMode("task");

            case "cmd_selectAll":
                if (this.todo_tasktree_focused || this.isInMode("calendar")) {
                    return true;
                } else if (this.defaultController.supportsCommand(aCommand)) {
                    return this.defaultController.isCommandEnabled(aCommand);
                }
                break;

            default:
                if (this.defaultController && !this.isCalendarInForeground()) {
                    // The delete-button demands a special handling in mail-mode
                    // as it is supposed to delete an element of the focused pane
                    if (aCommand == "cmd_delete" || aCommand == "button_delete") {
                        var focusedElement = document.commandDispatcher.focusedElement;
                        if (focusedElement) {
                            if (focusedElement.getAttribute("id") == "agenda-listbox") {
                                 return agendaListbox.isEventSelected();
                            } else if (focusedElement.className == "calendar-task-tree") {
                                 return this.writable &&
                                        this.todo_items_selected &&
                                        this.todo_items_writable;
                            }
                        }
                    }

                    // If calendar is not in foreground, let the default controller take
                    // care. If we don't have a default controller (i.e sunbird), just
                    // continue.
                    if (this.defaultController.supportsCommand(aCommand)) {
                        return this.defaultController.isCommandEnabled(aCommand);
                    }
                }
                if (aCommand in this.commands) {
                    // All other commands we support should be enabled by default
                    return true;
                }
        }
        return false;
    },

    doCommand: function cC_doCommand(aCommand) {
        switch (aCommand) {
            // Common Commands
            case "calendar_new_event_command":
                createEventWithDialog(getSelectedCalendar(),
                                      getDefaultStartDate(currentView().selectedDay));
                break;
            case "calendar_new_event_context_command": {
                let newStart = currentView().selectedDateTime;
                if (!newStart) {
                    newStart = getDefaultStartDate(currentView().selectedDay);
                }
                createEventWithDialog(getSelectedCalendar(), newStart,
                                      null, null, null,
                                      newStart.isDate == true);
                break;
            }
            case "calendar_modify_event_command":
                editSelectedEvents();
                break;
            case "calendar_modify_focused_item_command": {
                let focusedElement = document.commandDispatcher.focusedElement;
                if (!focusedElement && this.defaultController && !this.isCalendarInForeground()) {
                    this.defaultController.doCommand(aCommand);
                } else {
                    let focusedRichListbox = getParentNodeOrThis(focusedElement, "richlistbox");
                    if (focusedRichListbox && focusedRichListbox.id == "agenda-listbox") {
                        agendaListbox.editSelectedItem();
                    } else if (focusedElement.className == "calendar-task-tree") {
                        modifyTaskFromContext();
                    } else {
                        editSelectedEvents();
                    }
                }
                break;
            }
            case "calendar_delete_event_command":
                deleteSelectedEvents();
                break;
            case "calendar_delete_focused_item_command": {
                let focusedElement = document.commandDispatcher.focusedElement;
                if (!focusedElement && this.defaultController && !this.isCalendarInForeground()) {
                    this.defaultController.doCommand(aCommand);
                } else {
                    let focusedRichListbox = getParentNodeOrThis(focusedElement, "richlistbox");
                    if (focusedRichListbox && focusedRichListbox.id == "agenda-listbox") {
                        agendaListbox.deleteSelectedItem(false);
                    } else if (focusedElement.className == "calendar-task-tree") {
                        deleteToDoCommand(null, false);
                    } else if (this.defaultController && !this.isCalendarInForeground()) {
                        this.defaultController.doCommand(aCommand);
                    } else {
                        deleteSelectedEvents();
                    }
                }
                break;
            }
            case "calendar_new_todo_command":
                createTodoWithDialog(getSelectedCalendar(),
                                     null, null, null,
                                     getDefaultStartDate(currentView().selectedDay));
                break;
            case "calendar_new_todo_context_command": {
                let initialDate = currentView().selectedDateTime;
                if (!initialDate || initialDate.isDate) {
                    initialDate = getDefaultStartDate(currentView().selectedDay);
                }
                createTodoWithDialog(getSelectedCalendar(),
                                     null, null, null,
                                     initialDate);
                break;
            }
            case "calendar_new_todo_todaypane_command":
                createTodoWithDialog(getSelectedCalendar(),
                                     null, null, null,
                                     getDefaultStartDate(agendaListbox.today.start));
                break;
            case "calendar_delete_todo_command":
                deleteToDoCommand();
                break;
            case "calendar_modify_todo_command":
                modifyTaskFromContext(null, getDefaultStartDate(currentView().selectedDay));
                break;
            case "calendar_modify_todo_todaypane_command":
                modifyTaskFromContext(null, getDefaultStartDate(agendaListbox.today.start));
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
            case "calendar_show_unifinder_command":
                toggleUnifinder();
                break;
            case "calendar_view_next_command":
                currentView().moveView(1);
                break;
            case "calendar_view_prev_command":
                currentView().moveView(-1);
                break;
            case "calendar_toggle_orientation_command":
                toggleOrientation();
                break;
            case "calendar_toggle_workdays_only_command":
                toggleWorkdaysOnly();
                break;

            case "calendar_day-view_command":
                switchCalendarView("day", true);
                break;
            case "calendar_week-view_command":
                switchCalendarView("week", true);
                break;
            case "calendar_multiweek-view_command":
                switchCalendarView("multiweek", true);
                break;
            case "calendar_month-view_command":
                switchCalendarView("month", true);
                break;
            case "calendar_attendance_command":
                // This command is actually handled inline, since it takes a value
                break;

            case "cmd_selectAll":
                if (!this.todo_tasktree_focused &&
                    this.defaultController && !this.isCalendarInForeground()) {
                    // Unless a task tree is focused, make the default controller
                    // take care.
                    this.defaultController.doCommand(aCommand);
                } else {
                    selectAllItems();
                }
                break;

            default:
                if (this.defaultController && !this.isCalendarInForeground()) {
                    // If calendar is not in foreground, let the default controller take
                    // care. If we don't have a default controller (i.e sunbird), just
                    // continue.
                    this.defaultController.doCommand(aCommand);
                    return;
                }

        }
        return;
    },

    onEvent: function cC_onEvent(aEvent) {
    },

    isCalendarInForeground: function cC_isCalendarInForeground() {
        // For sunbird, calendar is always in foreground. Otherwise check if
        // we are in the correct mode.
        return isSunbird() || (gCurrentMode && gCurrentMode != "mail");
    },

    isInMode: function cC_isInMode(mode) {
        switch (mode) {
            case "mail":
                return !isCalendarInForeground();
            case "calendar":
                return isSunbird() || (gCurrentMode && gCurrentMode == "calendar");
            case "task":
                return !isSunbird() && (gCurrentMode && gCurrentMode == "task");
       }
    },

    onSelectionChanged: function cC_onSelectionChanged(aEvent) {
        var selectedItems = aEvent.detail;
        calendarController.item_selected = selectedItems && (selectedItems.length > 0);

        let selLength = (selectedItems === undefined ? 0 : selectedItems.length);
        let selected_events_readonly = 0;
        let selected_events_requires_network = 0;
        let selected_events_invitation = 0;

        if (selLength > 0) {
            for each (var item in selectedItems) {
                if (item.calendar.readOnly) {
                    selected_events_readonly++;
                }
                if (item.calendar.getProperty("requiresNetwork")) {
                    selected_events_requires_network++;
                }

                if (cal.isInvitation(item)) {
                    selected_events_invitation++;
                } else if (item.organizer) {
                    // If we are the organizer and there are attendees, then
                    // this is likely also an invitation.
                    let calOrgId = item.calendar.getProperty("organizerId");
                    if (item.organizer.id == calOrgId && item.getAttendees({}).length) {
                        selected_events_invitation++;
                    }
                }
            }
        }

        calendarController.selected_events_readonly =
              (selected_events_readonly == selLength);

        calendarController.selected_events_requires_network =
              (selected_events_requires_network == selLength);
        calendarController.selected_events_invitation =
              (selected_events_invitation == selLength);

        calendarController.updateCommands();
        calendarController2.updateCommands();
        if(!isSunbird()) {
            document.commandDispatcher.updateCommands('mail-toolbar');
        }
    },

    /**
     * Condition Helpers
     */

    // These attributes will be set up manually.
    item_selected: false,
    selected_events_readonly: false,
    selected_events_requires_network: false,
    selected_events_invitation: false,

    /**
     * Returns a boolean indicating if its possible to write items to any
     * calendar.
     */
    get writable() {
        return !this.all_readonly &&
               (!this.offline || (this.has_local_calendars &&
               !this.all_local_calendars_readonly));
    },

    /**
     * Returns a boolean indicating if the application is currently in offline
     * mode.
     */
    get offline() {
        return getIOService().offline;
    },

    /**
     * Returns a boolean indicating if all calendars are readonly.
     */
    get all_readonly () {
        var calMgr = getCalendarManager();
        return (calMgr.readOnlyCalendarCount == calMgr.calendarCount);
    },

    /**
     * Returns a boolean indicating if all calendars are local
     */
    get no_network_calendars() {
        return (getCalendarManager().networkCalendarCount == 0);
    },

    /**
     * Returns a boolean indicating if there are calendars that don't require
     * network access.
     */
    get has_local_calendars() {
        var calMgr = getCalendarManager();
        return (calMgr.networkCalendarCount < calMgr.calendarCount);
    },

    /**
     * Returns a boolean indicating that there is only one calendar left.
     */
    get last_calendar() {
        return (getCalendarManager().calendarCount < 2);
    },

    /**
     * Returns a boolean indicating that all local calendars are readonly
     */
    get all_local_calendars_readonly() {
        // We might want to speed this part up by keeping track of this in the
        // calendar manager.
        var calendars = getCalendarManager().getCalendars({});
        var count = calendars.length;
        for each (var calendar in calendars) {
            if (!isCalendarWritable(calendar)) {
                count--;
            }
        }
        return (count == 0);
    },

    /**
     * Returns a boolean indicating if the items selected in the current view
     * all have writable calendars.
     */
    get selected_items_writable() {
        return this.writable &&
               this.item_selected &&
               !this.selected_events_readonly &&
               (!this.offline || !this.selected_events_requires_network);
    },

    /**
     * Returns a boolean indicating that at least one of the calendars supports
     * tasks.
     */
    get calendars_support_tasks() {
        // XXX We might want to cache this
        var calendars = getCalendarManager().getCalendars({});

        for each (var calendar in calendars) {
            if (isCalendarWritable(calendar) &&
                calendar.getProperty("capabilities.tasks.supported") !== false) {
                return true;
            }
        }
        return false;
    },


    /**
     * Returns a boolean indicating that at least one of the calendars supports
     * events.
     */
    get calendars_support_events() {
        // XXX We might want to cache this
        var calendars = getCalendarManager().getCalendars({});

        for each (var calendar in calendars) {
            if (isCalendarWritable(calendar) &&
                calendar.getProperty("capabilities.events.supported") !== false) {
                return true;
            }
        }
        return false;
    },

    /**
     * Returns a boolean indicating that tasks are selected.
     */
    get todo_items_selected() {
        var selectedTasks = getSelectedTasks();
        return (selectedTasks.length > 0);
    },


    get todo_items_invitation() {
        let selectedTasks = getSelectedTasks();
        let selected_tasks_invitation = 0;

        for each (let item in selectedTasks) {
            if (cal.isInvitation(item)) {
                selected_tasks_invitation++;
            } else if (item.organizer) {
                // If we are the organizer and there are attendees, then
                // this is likely also an invitation.
                let calOrgId = item.calendar.getProperty("organizerId");
                if (item.organizer.id == calOrgId && item.getAttendees({}).length) {
                    selected_tasks_invitation++;
                }
            }
        }

        return (selectedTasks.length == selected_tasks_invitation);
    },

    /**
     * Returns a boolean indicating that at least one task in the selection is
     * on a calendar that is writable.
     */
    get todo_items_writable() {
        var selectedTasks = getSelectedTasks();
        for each (var task in selectedTasks) {
            if (isCalendarWritable(task.calendar)) {
                return true;
            }
        }
        return false;
    }
};

/**
 * XXX This is a temporary hack so we can release 1.0b2. This will soon be
 * superceeded by a new command controller architecture.
 */
var calendarController2 = {
    defaultController: null,

    commands: {
        "cmd_cut": true,
        "cmd_copy": true,
        "cmd_paste": true,
        "cmd_undo": true,
        "cmd_redo": true,
        "cmd_print": true,
        "cmd_pageSetup": true,

        "cmd_printpreview": true,
        "button_print": true,
        "button_delete": true,
        "cmd_delete": true,
        "cmd_properties": true,
        "cmd_goForward": true,
        "cmd_goBack": true,
        "cmd_fullZoomReduce": true,
        "cmd_fullZoomEnlarge": true,
        "cmd_fullZoomReset": true
    },

    // These functions can use the same from the calendar controller for now.
    updateCommands: calendarController.updateCommands,
    supportsCommand: calendarController.supportsCommand,
    onEvent: calendarController.onEvent,

    isCommandEnabled: function isCommandEnabled(aCommand) {
        switch (aCommand) {
            // Thunderbird Commands
            case "cmd_cut":
                return calendarController.selected_items_writable;
            case "cmd_copy":
                return calendarController.item_selected;
            case "cmd_paste":
                return canPaste();
            case "cmd_undo":
                goSetMenuValue(aCommand, 'valueDefault');
                return canUndo();
            case "cmd_redo":
                goSetMenuValue(aCommand, 'valueDefault');
                return canRedo();
            case "button_delete":
            case "cmd_delete":
                return calendarController.isCommandEnabled("calendar_delete_focused_item_command");
            case "cmd_fullZoomReduce":
            case "cmd_fullZoomEnlarge":
            case "cmd_fullZoomReset":
              return calendarController.isInMode("calendar") &&
                     currentView().supportsZoom;
            case "cmd_properties":
            case "cmd_printpreview":
                return false;
            default:
                return true;
        }
    },

    doCommand: function doCommand(aCommand) {
        switch (aCommand) {
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
                undo();
                break;
            case "cmd_redo":
                redo();
                break;
            case "cmd_pageSetup":
                PrintUtils.showPageSetup();
                break;
            case "button_print":
            case "cmd_print":
                calPrint();
                break;

            // Thunderbird commands
            case "cmd_goForward":
                currentView().moveView(1);
                break;
            case "cmd_goBack":
                currentView().moveView(-1);
                break;
            case "cmd_fullZoomReduce":
                currentView().zoomIn();
                break;
            case "cmd_fullZoomEnlarge":
                currentView().zoomOut();
                break;
            case "cmd_fullZoomReset":
                currentView().zoomReset();
                break;

            case "button_delete":
            case "cmd_delete":
                calendarController.doCommand("calendar_delete_focused_item_command");
                break;
        }
    }
};

/**
 * Inserts the command controller into the document. On Lightning, also make
 * sure that it is inserted before the conflicting thunderbird command
 * controller.
 */
function injectCalendarCommandController() {
    if (!isSunbird()) {
        // We need to put our new command controller *before* the one that
        // gets installed by thunderbird. Since we get called pretty early
        // during startup we need to install the function below as a callback
        // that periodically checks when the original thunderbird controller
        // gets alive. Please note that setTimeout with a value of 0 means that
        // we leave the current thread in order to re-enter the message loop.

        let tbController = top.controllers.getControllerForCommand("cmd_runJunkControls");
        if (!tbController) {
            setTimeout(injectCalendarCommandController, 0);
            return;
        } else {
            calendarController.defaultController = tbController;
        }
    } else {
        // On Sunbird, we also need to set up our hacky command controller.
        top.controllers.insertControllerAt(0, calendarController2);
    }

    // This needs to be done for all applications
    top.controllers.insertControllerAt(0, calendarController);
    document.commandDispatcher.updateCommands("calendar_commands");
}

/**
 * Remove the calendar command controller from the document.
 */
function removeCalendarCommandController() {
    top.controllers.removeController(calendarController);
}

/**
 * Handler function to set up the item context menu, depending on the given
 * items. Changes the delete menuitem to fit the passed items.
 *
 * @param event         The DOM popupshowing event that is triggered by opening
 *                        the context menu.
 * @param items         An array of items (usually the selected items) to adapt
 *                        the context menu for.
 * @return              True, to show the popup menu.
 */
function setupContextItemType(event, items) {
    function adaptModificationMenuItem(aMenuItemId, aItemType) {
        let menuItem = document.getElementById(aMenuItemId);
        if (menuItem) {
            menuItem.setAttribute("label", calGetString("calendar", "delete" + aItemType + "Label"));
            menuItem.setAttribute("accesskey", calGetString("calendar", "delete" + aItemType + "Accesskey"));
        }
    }
    if (items.some(isEvent) && items.some(isToDo)) {
        event.target.setAttribute("type", "mixed");
        adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Item");
    } else if (items.length && isEvent(items[0])) {
        event.target.setAttribute("type", "event");
        adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Event");
    } else if (items.length && isToDo(items[0])) {
        event.target.setAttribute("type", "todo");
        adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Task");
    } else {
        event.target.removeAttribute("type");
        adaptModificationMenuItem("calendar-item-context-menu-delete-menuitem", "Item");
    }

    let menu = document.getElementById("calendar-item-context-menu-attendance-menu");
    setupAttendanceMenu(menu, items);

    return true;
}

/**
 * Shows the given date in the current view, if in calendar mode.
 *
 * XXX This function is misplaced, should go to calendar-views.js or a minimonth
 * specific js file.
 *
 * @param aNewDate      The new date as a JSDate.
 */
function minimonthPick(aNewDate) {
  if (cal.isSunbird() || gCurrentMode == "calendar" || gCurrentMode == "task") {
      let cdt = jsDateToDateTime(aNewDate, currentView().timezone);
      cdt.isDate = true;
      currentView().goToDay(cdt);

      // update date filter for task tree
      let tree = document.getElementById(cal.isSunbird() ? "unifinder-todo-tree" : "calendar-task-tree");
      tree.updateFilter();
  }
}

/**
 * Selects all items, based on which mode we are currently in and what task tree is focused
 */
function selectAllItems() {
  if (calendarController.todo_tasktree_focused) {
    getTaskTree().selectAll();
  } else if (calendarController.isInMode("calendar")) {
    selectAllEvents();
  }
}
