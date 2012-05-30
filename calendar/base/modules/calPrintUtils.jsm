/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.print = {
    getTasksWithoutDueDate: function getTasksWithoutDueDate(aItems, date) {
        function isTaskWithoutDueDate(item) {
            return !item.dueDate && !item.endDate;
        }
        let filteredItems = aItems.filter(isTaskWithoutDueDate);
        if (filteredItems.length == 0) {
            return "";
        }
        let tasksDiv = <div class="tasks"/>;
        let monthName = cal.calGetString("dateFormat", "month." + (date.month +1)+ ".name");
        tasksDiv.appendChild(<h3>{cal.calGetString("calendar","tasksWithNoDueDate")}</h3>);
        let list = <ul class="taskList" />;
        for each (let task in filteredItems) {
            let taskItem = <li class="taskItem" />;
            if (task.isCompleted) {
                taskItem.appendChild(<input checked="checked" type="checkbox" disabled="true"/>);
                taskItem.appendChild(<s>{task.title}</s>);
            } else {
                taskItem.appendChild(<input type="checkbox" disabled="true"/>);
                taskItem.appendChild(task.title);
            }
            list.appendChild(taskItem);
        }
        tasksDiv.appendChild(list);
        return tasksDiv;
    }
}
