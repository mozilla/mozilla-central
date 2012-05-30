/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Called when the window is loaded to set up the unifinder-todo.
 */
function prepareCalendarToDoUnifinder() {
    if (isSunbird()) {
        document.getElementById("todo-label").removeAttribute("collapsed");
    }

    // add listener to update the date filters
    getViewDeck().addEventListener("dayselect", updateCalendarToDoUnifinder, false);

    updateCalendarToDoUnifinder();
}

/**
 * Updates the applied filter and show completed view of the unifinder todo.
 *
 * @param aFilter        The filter name to set.
 */
function updateCalendarToDoUnifinder(aFilter) {
    // Set up hiding completed tasks for the unifinder-todo tree
    let showCompleted = document.getElementById("show-completed-checkbox").checked;
    let tree = document.getElementById("unifinder-todo-tree");
    let oldFilter = document.getElementById("unifinder-todo-filter-broadcaster").getAttribute("value");
    let filter = oldFilter;

    // This function acts as an event listener, in which case we get the Event as the 
    // parameter instead of a filter.
    if (aFilter && !(aFilter instanceof Event)) {
        filter = aFilter;
    }

    if (filter && (filter != oldFilter)) {
        document.getElementById("unifinder-todo-filter-broadcaster").setAttribute("value", aFilter);
    }

    if (filter && !showCompleted) {
        let filterProps = tree.mFilter.getDefinedFilterProperties(filter);
        if (filterProps) {
            filterProps.status = (filterProps.status || filterProps.FILTER_STATUS_ALL) &
                                 (filterProps.FILTER_STATUS_INCOMPLETE |
                                  filterProps.FILTER_STATUS_IN_PROGRESS);
            filter = filterProps;
        }
    }

    // update the filter
    tree.showCompleted = showCompleted;
    tree.updateFilter(filter);
}

/**
 * Called when the window is unloaded to clean up the unifinder-todo.
 */
function finishCalendarToDoUnifinder() {
    // remove listeners
    getViewDeck().removeEventListener("dayselect", updateCalendarToDoUnifinder, false);
}
