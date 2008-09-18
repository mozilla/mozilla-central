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
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Garth Smedley <garths@oeone.com>
 *                 Mike Potter <mikep@oeone.com>
 *                 Chris Charabaruk <coldacid@meldstar.com>
 *                 Colin Phillips <colinp@oeone.com>
 *                 ArentJan Banck <ajbanck@planet.nl>
 *                 Curtis Jewell <csjewell@mail.freeshell.org>
 *                 Eric Belhaire <eric.belhaire@ief.u-psud.fr>
 *                 Mark Swaffer <swaff@fudo.org>
 *                 Michael Buettner <michael.buettner@sun.com>
 *                 Philipp Kewisch <mozilla@kewis.ch>
 *                 Berend Cornelius <berend.cornelius@sun.com>
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

function addCategoryNames(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    var tasksSelected = (tasks.length > 0);
    if (tasksSelected) {
        var index = appendCategoryItems(tasks[0], aEvent.target, document.getElementById("calendar_task_category_command"));
        aEvent.target.childNodes[index].setAttribute("checked","true");
    } else {
        appendCategoryItems(null, aEvent.target);
        applyAttributeToMenuChildren(aEvent.target, "disabled", (!tasksSelected));
    }
}

function changeContextMenuForTask(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    var task = null;
    var tasksSelected = (tasks.length > 0);
    applyAttributeToMenuChildren(aEvent.target, "disabled", (!tasksSelected));
    document.getElementById("calendar_new_todo_command").removeAttribute("disabled");
    if (tasksSelected) {
        if (isPropertyValueSame(tasks, "isCompleted")) {
            setBooleanAttribute(document.getElementById("calendar-context-markcompleted"), "checked", tasks[0].isCompleted);
        } else {
            document.getElementById("calendar-context-markcompleted").setAttribute("checked", false);
        }
    }
}

function contextChangeTaskProgress2(aEvent, aProgress) {
    contextChangeTaskProgress(aEvent, aProgress);
    document.getElementById("calendar_percentComplete-100_command2").checked = false;
}

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

function contextChangeTaskCategory(aEvent) {
    startBatchTransaction();
    var tasks = getSelectedTasks(aEvent);
    var tasksSelected = (tasks.length > 0);
    if (tasksSelected) {
        var menuItem = aEvent.target;
        for (var t = 0; t < tasks.length; t++) {
            var newTask = tasks[t].clone().QueryInterface( Components.interfaces.calITodo );
            setCategory(newTask, menuItem);
            doTransaction('modify', newTask, newTask.calendar, tasks[t], null);
        }
    }
    endBatchTransaction();
}

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

function modifyTaskFromContext(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    for (var t = 0; t < tasks.length; t++) {
        modifyEventWithDialog(tasks[t], null, true);
    }
 }

/**
 *  Delete the current selected item with focus from the task tree
 */
function deleteToDoCommand(aEvent, aDoNotConfirm) {
    var tasks = getSelectedTasks(aEvent);
    calendarViewController.deleteOccurrences(tasks.length,
                                             tasks,
                                             false,
                                             aDoNotConfirm);
}

function getTaskTree() {
    var currentMode = document.getElementById("modeBroadcaster").getAttribute("mode");
    if (currentMode == "task") {
        return document.getElementById("calendar-task-tree");
    } else {
        return document.getElementById("unifinder-todo-tree");
    }
}

function getSelectedTasks(aEvent) {
    var taskTree = getTaskTree();
    if (taskTree != null) {
        return taskTree.selectedTasks;
    }
    else  {
        return [];
    }
}

function tasksToMail(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    calendarMailButtonDNDObserver.onDropItems(tasks);
}

function tasksToEvents(aEvent) {
    var tasks = getSelectedTasks(aEvent);
    calendarCalendarButtonDNDObserver.onDropItems(tasks);
}

function toggleCompleted(aEvent) {
    if (aEvent.target.getAttribute("checked") == "true") {
        contextChangeTaskProgress(aEvent, 100);
    } else {
        contextChangeTaskProgress(aEvent, 0);
    }
}
