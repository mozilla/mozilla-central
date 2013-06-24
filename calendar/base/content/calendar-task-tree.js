/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Add registered calendars to the given menupopup. Removes all previous
 * children.
 *
 * XXX Either replace the existing items using replaceNode, or use helper
 * functions (cal.removeChildren).
 *
 * @param aEvent    The popupshowing event of the opening menu
 */
function addCalendarNames(aEvent) {
    var calendarMenuPopup = aEvent.target;
    var calendars = getCalendarManager().getCalendars({});
    while (calendarMenuPopup.hasChildNodes()) {
        calendarMenuPopup.removeChild(calendarMenuPopup.lastChild);
    }
    var tasks = getSelectedTasks(aEvent);
    var tasksSelected = (tasks.length > 0);
    if (tasksSelected) {
        var selIndex = appendCalendarItems(tasks[0], calendarMenuPopup, null, "contextChangeTaskCalendar(event);");
        if (isPropertyValueSame(tasks, "calendar") && (selIndex > -1)) {
            calendarMenuPopup.childNodes[selIndex].setAttribute("checked", "true");
        }
    }
}

/**
 * Change the opening context menu for the selected tasks.
 *
 * @param aEvent    The popupshowing event of the opening menu.
 */
function changeContextMenuForTask(aEvent) {
    handleTaskContextMenuStateChange(aEvent);

    let idnode = document.popupNode.id;
    let sunbird = cal.isSunbird();
    let items = getSelectedTasks(aEvent);
    document.getElementById("task-context-menu-new").hidden =
        (idnode == "unifinder-todo-tree" && !sunbird);
    document.getElementById("task-context-menu-modify").hidden =
        (idnode == "unifinder-todo-tree" && !sunbird);
    document.getElementById("task-context-menu-new-todaypane").hidden =
        (idnode == "calendar-task-tree" || sunbird);
    document.getElementById("task-context-menu-modify-todaypane").hidden =
        (idnode == "calendar-task-tree" || sunbird);
    document.getElementById("task-context-menu-filter-todaypane").hidden =
        (idnode == "calendar-task-tree" || sunbird);
    document.getElementById("task-context-menu-separator-filter").hidden =
        (idnode == "calendar-task-tree" || sunbird);

    let tasksSelected = (items.length > 0);
    applyAttributeToMenuChildren(aEvent.target, "disabled", (!tasksSelected));
    if (calendarController.isCommandEnabled("calendar_new_todo_command") &&
        calendarController.isCommandEnabled("calendar_new_todo_todaypane_command")) {
        document.getElementById("calendar_new_todo_command").removeAttribute("disabled");
        document.getElementById("calendar_new_todo_todaypane_command").removeAttribute("disabled");
    } else {
        document.getElementById("calendar_new_todo_command").setAttribute("disabled", "true");
        document.getElementById("calendar_new_todo_todaypane_command").setAttribute("disabled", "true");
    }

    // make sure the paste menu item is enabled
    goUpdateCommand("cmd_paste");

    // make sure the filter menu is enabled
    document.getElementById("task-context-menu-filter-todaypane").removeAttribute("disabled");
    applyAttributeToMenuChildren(document.getElementById("task-context-menu-filter-todaypane-popup"),
                                 "disabled", false);

    changeMenuForTask(aEvent);

    let menu = document.getElementById("task-context-menu-attendance-menu");
    setupAttendanceMenu(menu, items);
}

/**
 * Notify the task tree that the context menu open state has changed.
 *
 * @param aEvent    The popupshowing or popuphiding event of the menu.
 */
function handleTaskContextMenuStateChange(aEvent) {
    let tree = document.popupNode;

    if (tree) {
        tree.updateFocus();
    }
}

/**
 * Change the opening menu for the selected tasks.
 *
 * @param aEvent    The popupshowing event of the opening menu.
 */
function changeMenuForTask(aEvent) {
    let tasks = getSelectedTasks(aEvent);
    let tasksSelected = (tasks.length > 0);
    if (tasksSelected) {
        let cmd = document.getElementById("calendar_toggle_completed_command");
        if (isPropertyValueSame(tasks, "isCompleted")) {
            setBooleanAttribute(cmd, "checked", tasks[0].isCompleted);
        } else {
            setBooleanAttribute(cmd, "checked", false);
        }
    }
}

/**
 * Handler function to change the progress of all selected tasks.
 *
 * @param aEvent      The DOM event that triggered this command.
 * @param aProgress   The progress percentage to set.
 */
function contextChangeTaskProgress(aEvent, aProgress) {
    startBatchTransaction();
    var tasks = getSelectedTasks(aEvent);
    for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        var newTask = task.clone().QueryInterface( Components.interfaces.calITodo );
        newTask.percentComplete = aProgress;
        switch (aProgress) {
            case 0:
                newTask.isCompleted = false;
                break;
            case 100:
                newTask.isCompleted = true;
                break;
            default:
                newTask.status = "IN-PROCESS";
                newTask.completedDate = null;
                break;
        }
        doTransaction('modify', newTask, newTask.calendar, task, null);
    }
    endBatchTransaction();
}

/**
 * Handler function to change the calendar of the selected tasks. The targeted
 * menuitem must have "calendar" property that implements calICalendar.
 *
 * @param aEvent      The DOM event that triggered this command.
 */
function contextChangeTaskCalendar(aEvent) {
   startBatchTransaction();
   var tasks = getSelectedTasks(aEvent);
   for (var t = 0; t < tasks.length; t++) {
       var task = tasks[t];
       var newTask = task.clone().QueryInterface( Components.interfaces.calITodo );
       newTask.calendar = aEvent.target.calendar;
       doTransaction('modify', newTask, newTask.calendar, task, null);
    }
    endBatchTransaction();
}

/**
 * Handler function to change the priority of the selected tasks.
 *
 * @param aEvent      The DOM event that triggered this command.
 * @param aPriority   The priority to set on the selected tasks.
 */
function contextChangeTaskPriority(aEvent, aPriority) {
    startBatchTransaction();
    var tasks = getSelectedTasks(aEvent);
    for (var t = 0; t < tasks.length; t++) {
        var task = tasks[t];
        var newTask = task.clone().QueryInterface( Components.interfaces.calITodo );
        newTask.priority = aPriority;
        doTransaction('modify', newTask, newTask.calendar, task, null);
    }
    endBatchTransaction();
}

/**
 * Handler function to postpone the start and due dates of the selected tasks.
 *
 * @param aEvent      The DOM event that triggered this command.
 * @param aDuration   The duration to postpone the dates.
 */
function contextPostponeTask(aEvent, aDuration) {
    let duration = cal.createDuration(aDuration);
    if (!duration) {
        cal.LOG("[calendar-task-tree] Postpone Task - Invalid duration " + aDuration);
    }

    startBatchTransaction();
    let tasks = getSelectedTasks(aEvent);

    tasks.forEach(function(task) {
        if (task.entryDate || task.dueDate) {
            let newTask = task.clone();
            cal.shiftItem(newTask, duration);
            doTransaction('modify', newTask, newTask.calendar, task, null);
        }
    });

    endBatchTransaction();
}

/**
 * Modifies the selected tasks with the event dialog
 *
 * @param aEvent        The DOM event that triggered this command.
 * @param initialDate   (optional) The initial date for new task datepickers  
 */
function modifyTaskFromContext(aEvent, initialDate) {
    var tasks = getSelectedTasks(aEvent);
    for (var t = 0; t < tasks.length; t++) {
        modifyEventWithDialog(tasks[t], null, true, initialDate);
    }
 }

/**
 *  Delete the current selected item with focus from the task tree
 *
 * @param aEvent          The DOM event that triggered this command.
 * @param aDoNotConfirm   If true, the user will not be asked to delete.
 */
function deleteToDoCommand(aEvent, aDoNotConfirm) {
    var tasks = getSelectedTasks(aEvent);
    calendarViewController.deleteOccurrences(tasks.length,
                                             tasks,
                                             false,
                                             aDoNotConfirm);
}

/**
 * Gets the currently visible task tree
 *
 * @return    The XUL task tree element.
 */
function getTaskTree() {
    var currentMode = document.getElementById("modeBroadcaster").getAttribute("mode");
    if (currentMode == "task") {
        return document.getElementById("calendar-task-tree");
    } else {
        return document.getElementById("unifinder-todo-tree");
    }
}

/**
 * Gets the tasks selected in the currently visible task tree.
 *
 * XXX Parameter aEvent is unused, needs to be removed here and in calling
 * functions.
 *
 * @param aEvent      Unused
 */
function getSelectedTasks(aEvent) {
    var taskTree = getTaskTree();
    if (taskTree != null) {
        return taskTree.selectedTasks;
    }
    else  {
        return [];
    }
}

/**
 * Convert selected tasks to emails.
 */
function tasksToMail(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    calendarMailButtonDNDObserver.onDropItems(tasks);
}

/**
 * Convert selected tasks to events.
 */
function tasksToEvents(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    calendarCalendarButtonDNDObserver.onDropItems(tasks);
}

/**
 * Toggle the completed state on selected tasks.
 *
 * @param aEvent    The originating event, can be null.
 */
function toggleCompleted(aEvent) {
    if (aEvent.target.getAttribute("checked") == "true") {
        contextChangeTaskProgress(aEvent, 0);
    } else {
        contextChangeTaskProgress(aEvent, 100);
    }
}
