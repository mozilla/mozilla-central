/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.print = {
    /**
     * Returns a simple key in the format YYYY-MM-DD for use in the table of
     * dates to day boxes
     *
     * @param dt    The date to translate
     * @return      YYYY-MM-DD
     */
    getDateKey: function getDateKey(dt) {
        return dt.year + "-" + dt.month + "-" + dt.day;
    },

    /**
     * Add category styles to the document's "sheet" element. This is needed
     * since the HTML created is serialized, so we can't dynamically set the
     * styles and can be changed if the print formatter decides to return a
     * DOM document instead.
     *
     * @param document      The document that contains <style id="sheet"/>.
     * @param categories    Array of categories to insert rules for.
     */
    insertCategoryRules: function insertCategoryRules(document, categories) {
        let sheet = document.getElementById("sheet");
        sheet.insertedCategoryRules = sheet.insertedCategoryRules || {};

        for each (let category in categories) {
            let prefName = cal.formatStringForCSSRule(category);
            let color = cal.getPrefSafe("calendar.category.color." + prefName) || "transparent";
            if (!(prefName in sheet.insertedCategoryRules)) {
                sheet.insertedCategoryRules[prefName] = true;
                let ruleAdd = ' .category-color-box[categories~="' + prefName + '"] { ' +
                              ' border: 2px solid ' + color + '; }' + "\n";
                sheet.textContent += ruleAdd;
            }
        }
    },

    /**
     * Add calendar styles to the document's "sheet" element. This is needed
     * since the HTML created is serialized, so we can't dynamically set the
     * styles and can be changed if the print formatter decides to return a
     * DOM document instead.
     *
     * @param document      The document that contains <style id="sheet"/>.
     * @param categories    The calendar to insert a rule for.
     */
    insertCalendarRules: function insertCalendarRules(document, calendar) {
        let sheet = document.getElementById("sheet");
        let color = calendar.getProperty("color") || "#A8C2E1";
        sheet.insertedCalendarRules = sheet.insertedCalendarRules || {};

        if (!(calendar.id in sheet.insertedCalendarRules)) {
            sheet.insertedCalendarRules[calendar.id] = true;
            let formattedId = cal.formatStringForCSSRule(calendar.id);
            let ruleAdd = ' .calendar-color-box[calendar-id="' + formattedId + '"] { ' +
                          ' background-color: ' + color + '; ' +
                          ' color: ' + cal.getContrastingTextColor(color) + '; }' + "\n";
            sheet.textContent += ruleAdd;
        }
    },

    /**
     * Serializes the given item by setting marked nodes to the item's content.
     * Has some expectations about the DOM document (in CSS-selector-speak), all
     * following nodes MUST exist.
     *
     * - #item-template will be cloned and filled, and modified:
     *   - .item-interval gets the time interval of the item.
     *   - .item-title gets the item title
     *   - .category-color-box gets a 2px solid border in category color
     *   - .calendar-color-box gets background color of the calendar
     *
     * @param document          The DOM Document to set things on
     * @param item              The item to serialize
     * @param dayContainer      The DOM Node to insert the container in
     */
    addItemToDaybox: function addItemToDaybox(document, item, dayContainer) {
        // Clone our template
        let itemNode = document.getElementById("item-template").cloneNode(true);
        itemNode.removeAttribute("id");
        itemNode.item = item;

        // Fill in details of the item
        let itemInterval = cal.getDateFormatter().formatItemTimeInterval(item);
        itemNode.querySelector(".item-interval").textContent = itemInterval;
        itemNode.querySelector(".item-title").textContent = item.title;

        // Fill in category details
        let categoriesArray = item.getCategories({});
        if (categoriesArray.length > 0) {
            let cssClassesArray = categoriesArray.map(cal.formatStringForCSSRule);
            itemNode.querySelector(".category-color-box")
                    .setAttribute("categories", cssClassesArray.join(" "));

            cal.print.insertCategoryRules(document, categoriesArray);
        }

        // Fill in calendar color
        itemNode.querySelector(".calendar-color-box")
                .setAttribute("calendar-id", cal.formatStringForCSSRule(item.calendar.id));
        cal.print.insertCalendarRules(document, item.calendar);

        // Add it to the day container in the right order
        cal.binaryInsertNode(dayContainer, itemNode, item, comparePrintItems);
    },

    /**
     * Serializes the given item by setting marked nodes to the item's
     * content. Should be used for tasks with no start and due date. Has
     * some expectations about the DOM document (in CSS-selector-speak),
     * all following nodes MUST exist.
     *
     * - Nodes will be added to #task-container.
     * - #task-list-box will have the "hidden" attribute removed.
     * - #task-template will be cloned and filled, and modified:
     *   - .task-checkbox gets the "checked" attribute set, if completed
     *   - .task-title gets the item title.
     *
     * @param document          The DOM Document to set things on
     * @param item              The item to serialize
     */
    addItemToDayboxNodate: function addItemToDayboxNodate(document, item) {
        let taskContainer = document.getElementById("task-container");
        let taskNode = document.getElementById("task-template").cloneNode(true);
        taskNode.removeAttribute("id");
        taskNode.item = item;

        let taskListBox = document.getElementById("tasks-list-box");
        if (taskListBox.hasAttribute("hidden")) {
            let tasksTitle = document.getElementById("tasks-title");
            taskListBox.removeAttribute("hidden");
            tasksTitle.textContent = cal.calGetString("calendar","tasksWithNoDueDate");
        }

        // Fill in details of the task
        if (item.isCompleted) {
            taskNode.querySelector(".task-checkbox").setAttribute("checked", "checked");
        }

        taskNode.querySelector(".task-title").textContent = item.title;

        let collator = cal.createLocaleCollator();
        cal.binaryInsertNode(taskContainer, taskNode, item, function(a, b) collator.compareString(0, a, b), function(node) node.item.title);
    }
}

/**
 * Item comparator for inserting items into dayboxes.
 *
 * TODO This could possibly be replaced with a global item comparator so
 * that it matches with the views and such.
 *
 * @param a     The first item
 * @param b     The second item
 * @return      The usual -1, 0, 1
 */
function comparePrintItems(a, b) {
    if (!a) return -1;
    if (!b) return 1;

    // Sort tasks before events
    if (cal.isEvent(a) && cal.isToDo(b)) {
        return 1;
    }
    if (cal.isToDo(a) && cal.isEvent(b)) {
        return -1;
    }
    if (cal.isEvent(a)) {
        let startCompare = a.startDate.compare(b.startDate);
        if (startCompare != 0) {
            return startCompare;
        }
        return a.endDate.compare(b.endDate);
    }
    let dateA = a.entryDate || a.dueDate;
    let dateB = b.entryDate || b.dueDate;
    return dateA.compare(dateB);
}
