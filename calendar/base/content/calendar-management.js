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
    var tree = document.getElementById("calendar-list-tree-widget");
    if (tree) {
        return calendarListTreeView.getCalendar(tree.currentIndex);
    } else { // make robust in startup scenarios when calendar list is not yet loaded:
        return getCompositeCalendar().defaultCalendar;
    }
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
 * Ensure that the passed calendar is visible to the user in the current window.
 */
function ensureCalendarVisible(aCalendar) {
    var composite = getCompositeCalendar();
    if (!composite.getCalendar(aCalendar.uri)) {
        composite.addCalendar(aCalendar);
    }
}

/**
 * Called to initialize the calendar manager for a window.
 */
function loadCalendarManager() {
    var calMgr = getCalendarManager();
    var composite = getCompositeCalendar();
    var calendars = calMgr.getCalendars({});
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch("").QueryInterface(Components.interfaces.nsIPrefBranch2);

    if (calendars.length == 0) {
        var url = makeURL("moz-profile-calendar://");
        var homeCalendar = calMgr.createCalendar("storage", url);

        calMgr.registerCalendar(homeCalendar);
        var name = calGetString("calendar", "homeCalendarName");

        homeCalendar.name = name;
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

        calendars = [homeCalendar];
    }

    calendarListInitCategoryColors();

    // Set up the tree view
    var tree = document.getElementById("calendar-list-tree-widget");
    calendarListTreeView.tree = tree;
    tree.view = calendarListTreeView;

    calMgr.addObserver(calendarManagerObserver);
    composite.addObserver(calendarManagerCompositeObserver);
    branch.addObserver("calendar.", calendarManagerObserver, false);

    // The calendar manager will not notify for existing calendars. Go through
    // them all and set up manually.
    for each (let calendar in sortCalendarArray(calendars)) {
        calendarManagerObserver.initializeCalendar(calendar);
    }
}

/**
 * Called to clean up the calendar manager for a window.
 */
function unloadCalendarManager() {
    calendarManagerObserver.unload();
    var calMgr = getCalendarManager();
    var composite = getCompositeCalendar();
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch("").QueryInterface(Components.interfaces.nsIPrefBranch2);

    branch.removeObserver("calendar.", calendarManagerObserver);
    composite.removeObserver(calendarManagerCompositeObserver);
    composite.setStatusObserver(null, null);
    calMgr.removeObserver(calendarManagerObserver);
}

/**
 * Color specific functions
 */
/**
 * Update the calendar-view-bindings.css stylesheet to provide rules for
 * category colors.
 *
 * XXX This doesn't really fit into the calendar manager and is here for
 * historical reasons.
 */
var gCachedStyleSheet;
function calendarListInitCategoryColors() {
    var calendars = getCalendarManager().getCalendars({});
    if (!gCachedStyleSheet) {
        var cssUri = "chrome://calendar/content/calendar-view-bindings.css";
        gCachedStyleSheet = getStyleSheet(cssUri);
    }

    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
    var categoryPrefBranch = prefService.getBranch("calendar.category.color.");
    var categories = categoryPrefBranch.getChildList("", {});

    // check category preference name syntax
    categories = calendarConvertObsoleteColorPrefs(categoryPrefBranch, categories);

    // Update all categories
    for each (var category in categories) {
        updateStyleSheetForObject(category, gCachedStyleSheet);
    }
}

/**
 * Remove illegally formatted category names from the array coloredCategories
 * so they don't cause CSS errors.  For each illegal colored category c, if
 * its color preference has not yet been replaced with a converted preference
 * with key formatStringForCSSRule(c), create the preference with the
 * converted key and with the previous preference value, and clear the old
 * preference.  (For most users who upgrade and do not later add colors with a
 * downgrade version, this should convert any illegal preferences once, so
 * future runs have no illegal preferences.)
 *
 * @param categoryPrefBranch        PrefBranch for "calendar.category.color."
 * @param coloredCategories         Array of preference name suffixes under the
 *                                    prefBranch.
 * @return                          Same array with each illegal name replaced
 *                                    with formatted name if it doesn't already
 *                                    exist, or simply removed from array if it
 *                                    does.
 *
 */
function calendarConvertObsoleteColorPrefs(categoryPrefBranch, coloredCategories) {
    for (var i in coloredCategories) {
        var category = coloredCategories[i];
        if (category.search(/[^_0-9a-z-]/) != -1) {
            var categoryFix = formatStringForCSSRule(category);
            if (!categoryPrefBranch.prefHasUserValue(categoryFix)) {
                var color = categoryPrefBranch.getCharPref(category);
                categoryPrefBranch.setCharPref(categoryFix, color);
                categoryPrefBranch.clearUserPref(category); // not usable
                coloredCategories[i] = categoryFix;  // replace illegal name
            } else {
                coloredCategories.splice(i, 1); // remove illegal name
            }
        }
    }
    return coloredCategories;
}

/**
 * Update the cached stylesheet to provide rules for the calendar list's
 * calendar colors.
 *
 * @param aCalendar         The calendar to update rules for.
 */
function calendarListUpdateColor(aCalendar) {
    var selectorPrefix = "treechildren::-moz-tree-cell";
    var color = aCalendar.getProperty("color");
    if (!color) {
        return;
    }
    var selector = selectorPrefix + "color-"  + color.substr(1);

    for (var i = 0; i < gCachedStyleSheet.cssRules.length; i++) {
        var thisrule = gCachedStyleSheet.cssRules[i];
        if (thisrule.selectorText && thisrule.selectorText == selector) {
            return;
        }
    }

    var ruleString = selectorPrefix + "(calendar-list-tree-color, color-" + color.substr(1) + ") { }";

    var rule = gCachedStyleSheet
               .insertRule(ruleString, gCachedStyleSheet.cssRules.length);

    gCachedStyleSheet.cssRules[rule].style.backgroundColor = color;
    return;
}

/**
 * Calendar Tree View
 */
var calendarListTreeView = {
    mCalendarList: [],
    tree: null,
    treebox: null,
    mContextElement: null,

    QueryInterface: function cLTV_QueryInterface(aIID) {
        return doQueryInterface(this, calendarListTreeView.__proto__, aIID,
                                [Components.interfaces.nsISupports,
                                 Components.interfaces.nsITreeView]);
    },

    /**
     * High-level calendar tree manipulation
     */

    /**
     * Find the array index of the passed calendar
     *
     * @param aCalendar     The calendar to find an index for.
     * @return              The array index, or -1 if not found.
     */
    findIndex: function cLTV_findIndex(aCalendar) {
        for (var i = 0; i < this.mCalendarList.length; i++) {
            if (this.mCalendarList[i].id == aCalendar.id) {
                return i;
            }
        }
        return -1;
    },

    /**
     * Find the array index of a calendar by its uri.
     *
     * @param aUri          The uri to find an index for.
     * @return              The array index, or -1 if not found.
     */
    findIndexByUri: function cLTV_findIndexByUri(aUri) {
        for (var i = 0; i < this.mCalendarList.length; i++) {
            if (this.mCalendarList[i].uri.equals(aUri)) {
                return i;
            }
        }
        return -1;
    },

    /**
     * Add a calendar to the calendar list
     * 
     * @param aCalendar     The calendar to add.
     */
    addCalendar: function cLTV_addCalendar(aCalendar) {
        var composite = getCompositeCalendar();
        this.mCalendarList.push(aCalendar);
        calendarListUpdateColor(aCalendar);
        this.treebox.rowCountChanged(this.mCalendarList.length - 1, 1);

        if (!composite.defaultCalendar ||
            aCalendar.id == composite.defaultCalendar.id) {
            this.tree.view.selection.select(this.mCalendarList.length - 1);
        }
    },

    /**
     * Remove a calendar from the calendar list
     * 
     * @param aCalendar     The calendar to remove.
     */
    removeCalendar: function cLTV_removeCalendar(aCalendar) {
        var index = this.findIndex(aCalendar);
        if (index < 0) {
            return;
        }

        this.mCalendarList.splice(index, 1);
        if (index == this.rowCount) {
            index--;
        }

        this.tree.view.selection.select(index + 1);
        this.treebox.rowCountChanged(index, -1);
    },

    /**
     * Update a calendar's tree row (to refresh the color and such)
     * 
     * @param aCalendar     The calendar to update.
     */
    updateCalendar: function cLTV_updateCalendar(aCalendar) {
        var index = this.findIndex(aCalendar);
        this.treebox.invalidateRow(index);
    },

    /**
     * Get the calendar from the given DOM event. This can be a Mouse event or a
     * keyboard event.
     *
     * @param event     The DOM event to check
     * @param aCol      An out-object for the column id.
     * @param aRow      An out-object for the row index.
     */
    getCalendarFromEvent: function cLTV_getCalendarFromEvent(event,
                                                             aCol,
                                                             aRow) {
        if (event.clientX && event.clientY) {
            // If we have a client point, get the row directly from the client
            // point.
            aRow = aRow || {};
            this.treebox.getCellAt(event.clientX,
                                   event.clientY,
                                   aRow,
                                   aCol || {},
                                   {});

        } else {
            // The event is probably coming from a context menu oncommand
            // handler. We saved the row and column where the context menu
            // showed up in setupContextMenu().
            aCol = { value: this.mContextElement.column };
            aRow = { value: this.mContextElement.row };
        }
        return aRow && aRow.value > -1 && this.mCalendarList[aRow.value];
    },


    /**
     * Get the calendar from a certain index.
     * 
     * @param index     The index to get the calendar for.
     */
    getCalendar: function cLTV_getCalendar(index) {
        if (index < 0) {
            index = 0;
        } else if (index >= this.mCalendarList.length) {
            index = (this.mCalendarList.length - 1);
        }
        return this.mCalendarList[index];
    },

    /**
     * nsITreeView methods and properties
     */
    get rowCount() {
        return this.mCalendarList.length;
    },

    getCellProperties: function cLTV_getCellProperties(aRow, aCol, aProps) {
        this.getRowProperties(aRow, aProps);
        this.getColumnProperties(aCol, aProps);
    },

    getRowProperties: function cLTV_getRowProperties(aRow, aProps) {
        var calendar = this.getCalendar(aRow);
        var composite = getCompositeCalendar();

        // Set up the composite calendar status
        if (composite.getCalendar(calendar.uri)) {
            aProps.AppendElement(getAtomFromService("checked"));
        } else {
            aProps.AppendElement(getAtomFromService("unchecked"));
        }

        // Get the calendar color
        var color = calendar.getProperty("color");
        color = color && color.substr(1);

        // Set up the calendar color (background)
        var bgColorProp = "color-" + (color || "default");
        aProps.AppendElement(getAtomFromService(bgColorProp));

        // Set a property to get the contrasting text color (foreground)
        var fgColorProp = getContrastingTextColor(color || "a8c2e1");
        aProps.AppendElement(getAtomFromService(fgColorProp));

        var currentStatus = calendar.getProperty("currentStatus");
        if (!Components.isSuccessCode(currentStatus)){
            aProps.AppendElement(getAtomFromService("readfailed"));
        // 'readfailed' is supposed to "win" over 'readonly', meaning that 
        // if reading from a calendar fails there is no further need to also display
        // information about 'readonly' status
        } else if (calendar.readOnly) {
            aProps.AppendElement(getAtomFromService("readonly"));
        }

        // Set up the disabled state
        if (calendar.getProperty("disabled")) {
            aProps.AppendElement(getAtomFromService("disabled"));
        } else {
            aProps.AppendElement(getAtomFromService("enabled"));
        }
    },

    getColumnProperties: function cLTV_getColumnProperties(aCol, aProps) {},

    isContainer: function cLTV_isContainer(aRow) {
        return false;
    },

    isContainerOpen: function cLTV_isContainerOpen(aRow) {
        return false;
    },

    isContainerEmpty: function cLTV_isContainerEmpty(aRow) {
        return false;
    },

    isSeparator: function cLTV_isSeparator(aRow) {
        return false;
    },

    isSorted: function cLTV_isSorted(aRow) {
        return false;
    },

    canDrop: function cLTV_canDrop(aRow, aOrientation) {
        return false;
    },

    drop: function cLTV_drop(aRow, aOrientation) {},

    getParentIndex: function cLTV_getParentIndex(aRow) {
        return -1;
    },

    hasNextSibling: function cLTV_hasNextSibling(aRow, aAfterIndex) {},

    getLevel: function cLTV_getLevel(aRow) {
        return 0;
    },

    getImageSrc: function cLTV_getImageSrc(aRow, aOrientation) {},

    getProgressMode: function cLTV_getProgressMode(aRow, aCol) {},

    getCellValue: function cLTV_getCellValue(aRow, aCol) {
        var calendar = this.getCalendar(aRow);
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
                return composite.getCalendar(calendar.uri) ? "true" : "false";
            case "calendar-list-tree-status":
                // The value of this cell shows the calendar readonly state
                return (calendar.readOnly ? "true" : "false");
        }
        return null;
    },

    getCellText: function cLTV_getCellText(aRow, aCol) {
        var calendar = this.getCalendar(aRow);
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-calendar":
                return this.getCalendar(aRow).name;
        }
        return "";
    },

    setTree: function cLTV_setTree(aTreeBox) {
        this.treebox = aTreeBox;
    },

    toggleOpenState: function cLTV_toggleOpenState(aRow) {},

    cycleHeader: function cLTV_cycleHeader(aCol) { },

    cycleCell: function cLTV_cycleCell(aRow, aCol) {
        var calendar = this.getCalendar(aRow);
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
            try {
                composite.startBatch();
                if (composite.getCalendar(calendar.uri)) {
                    composite.removeCalendar(calendar.uri);
                } else {
                    composite.addCalendar(calendar);
                }
            } finally {
                composite.endBatch();
            }
            break;
        }
        this.treebox.invalidateRow(aRow);
    },

    isEditable: function cLTV_isEditable(aRow, aCol) {
        return false;
    },

    setCellValue: function cLTV_setCellValue(aRow, aCol, aValue) {
        var calendar = this.getCalendar(aRow);
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
                if (aValue == "true") {
                    composite.addCalendar(calendar);
                } else {
                    composite.removeCalendar(calendar);
                }
                break;
            case "calendar-list-tree-status":
                calendar.readOnly = (aValue == "true");
                break;
            default:
                return null;
        }
        return aValue;
    },

    setCellText: function cLTV_setCellText(aRow, aCol, aValue) {},

    performAction: function cLTV_performAction(aAction) {},

    performActionOnRow: function cLTV_performActionOnRow(aAction, aRow) {},

    performActionOnCell: function cLTV_performActionOnCell(aAction, aRow, aCol) {},

    /**
     * Calendar Tree Events
     */
    onKeyPress: function cLTV_onKeyPress(event) {
        const kKE = Components.interfaces.nsIDOMKeyEvent;
        switch (event.keyCode || event.which) {
            case kKE.DOM_VK_DELETE:
                promptDeleteCalendar(getSelectedCalendar());
                break;
            case kKE.DOM_VK_SPACE:
                if (this.tree.currentIndex > -1 ) {
                    var cbCol = this.treebox.columns.getNamedColumn("calendar-list-tree-checkbox");
                    this.cycleCell(this.tree.currentIndex, cbCol);
                }
                break;
        }
    },

    onDoubleClick: function cLTV_onDoubleClick(event) {
        var col = {};
        var calendar = this.getCalendarFromEvent(event, col);
        if (event.button != 0 ||
            (col.value && col.value.id == "calendar-list-tree-checkbox")) {
            // Only left clicks that are not on the checkbox column
            return;
        }
        if (calendar) {
            openCalendarProperties(calendar);
        } else {
            openCalendarWizard();
        }
    },

    onSelect: function cLTV_onSelect(event) {
        // The select event should only fire when an item is actually selected,
        // therefore we can assume that getSelectedCalendar() returns a
        // calendar.
        var composite = getCompositeCalendar();
        composite.defaultCalendar = getSelectedCalendar();
        document.commandDispatcher.updateCommands("calendar_commands");
    },

    onTooltipShowing: function cLTV_onTooltipShowing(event) {
        var calendar = this.getCalendarFromEvent(event);
        var tooltipText = false;
        if (calendar) {
            var currentStatus = calendar.getProperty("currentStatus");
            if (!Components.isSuccessCode(currentStatus)){
                tooltipText = calGetString("calendar", "tooltipCalendarDisabled", [calendar.name]);
            } else if (calendar.readOnly) {
                tooltipText = calGetString("calendar", "tooltipCalendarReadOnly", [calendar.name]);
            }

        }
        setElementValue("calendar-list-tooltip", tooltipText, "label");
        return (tooltipText != false);
    },

    /**
     * A handler called to set up the context menu on the calendar list.
     *
     * @param event         The DOM event that caused the context menu to open.
     * @return              Returns true if the context menu should be shown.
     */
    setupContextMenu: function cLTV_setupContextMenu(event) {
        var col = {};
        var row = {};
        var calendar;
        var calendars = getCalendarManager().getCalendars({});

        if (document.popupNode.localName == "tree") {
            // Using VK_APPS to open the context menu will target the tree
            // itself. In that case we won't have a client point even for
            // opening the context menu. The "target" element should then be the
            // selected element.
            row.value =  this.tree.currentIndex;
            col.value = this.treebox.columns
                            .getNamedColumn("calendar-list-tree-calendar");
            calendar = this.getCalendar(row.value);
        } else {
            // Using the mouse, the context menu will open on the treechildren
            // element. Here we can use client points.
            calendar = this.getCalendarFromEvent(event, col, row);
        }

        if (col.value && col.value.id == "calendar-list-tree-checkbox") {
            // Don't show the context menu if the checkbox was clicked.
            return false;
        }

        // We need to save the row to return the correct calendar in
        // getCalendarFromEvent()
        this.mContextElement = {
            row: row && row.value,
            column: col && col.value
        };

        // Only enable calendar search if there's actually the chance of finding something:
        document.getElementById("list-calendars-context-find").setAttribute(
            "collapsed", (getCalendarSearchService().getProviders({}).length > 0 ? "false" : "true"));

        if (calendar) {
            document.getElementById("list-calendars-context-edit")
                    .removeAttribute("disabled");
            document.getElementById("list-calendars-context-publish")
                    .removeAttribute("disabled");
            // Only enable the delete calendars item if there is more than one
            // calendar. We don't want to have the last calendar deleted.
            if (calendars.length > 1) {
                document.getElementById("list-calendars-context-delete")
                        .removeAttribute("disabled");
            }
        } else {
            document.getElementById("list-calendars-context-edit")
                    .setAttribute("disabled", "true");
            document.getElementById("list-calendars-context-publish")
                    .setAttribute("disabled", "true");
            document.getElementById("list-calendars-context-delete")
                    .setAttribute("disabled", "true");
        }
        return true;
    }
};

/**
 * An observer of the composite calendar to keep the calendar list in sync.
 * Implements calICompositeObserver and calIObserver.
 */
var calendarManagerCompositeObserver = {
    QueryInterface: function cMCO_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.calICompositeObserver) &&
            !aIID.equals(Components.interfaces.calIObserver) &&
            !aIID.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    onCalendarAdded: function cMO_onCalendarAdded(aCalendar) {
        // Make sure the checkbox state is updated
        var index = calendarListTreeView.findIndex(aCalendar);
        calendarListTreeView.treebox.invalidateRow(index);
    },

    onCalendarRemoved: function cMO_onCalendarRemoved(aCalendar) {
        // Make sure the checkbox state is updated
        var index = calendarListTreeView.findIndex(aCalendar);
        calendarListTreeView.treebox.invalidateRow(index);
    },

    onDefaultCalendarChanged: function cMO_onDefaultCalendarChanged(aCalendar) {
    },

    // calIObserver. Note that each registered calendar uses this observer, not
    // only the composite calendar.
    onStartBatch: function cMO_onStartBatch() { },
    onEndBatch: function cMO_onEndBatch() { },
    onLoad: function cMO_onLoad() { },

    // TODO: remove these temporary caldav exclusions when it is safe to do so
    // needed to allow cadav refresh() to update w/o forcing visibility
    onAddItem: function cMO_onAddItem(aItem) {
        if (aItem.calendar.type != "caldav") {
            ensureCalendarVisible(aItem.calendar);
        }
    },

    onModifyItem: function cMO_onModifyItem(aNewItem, aOldItem) {
        if (aNewItem.calendar.type != "caldav") {
            ensureCalendarVisible(aNewItem.calendar);
        }
    },

    onDeleteItem: function cMO_onDeleteItem(aDeletedItem) { },
    onError: function cMO_onError(aCalendar, aErrNo, aMessage) { },

    onPropertyChanged: function cMO_onPropertyChanged(aCalendar,
                                                      aName,
                                                      aValue,
                                                      aOldValue) {
    },
    
    onPropertyDeleting: function cMO_onPropertyDeleting(aCalendar,
                                                        aName) {}
}

/**
 * An observer for the calendar manager xpcom component, to keep the calendar
 * list in sync.
 */
var calendarManagerObserver = {
    mDefaultCalendarItem: null,

    QueryInterface: function cMO_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.calICalendarManagerObserver) &&
            !aIID.equals(Components.interfaces.calIObserver) &&
            !aIID.equals(Components.interfaces.nsIObserver) &&
            !aIID.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    /**
     * Set up the UI for a new calendar.
     *
     * @param aCalendar     The calendar to add.
     */
    initializeCalendar: function cMO_initializeCalendar(aCalendar) {
        calendarListTreeView.addCalendar(aCalendar);

        updateStyleSheetForObject(aCalendar, gCachedStyleSheet);
        calendarListUpdateColor(aCalendar);

        // Watch the calendar for changes, to ensure its visibility when adding
        // or changing items.
        aCalendar.addObserver(this);

        // Update the calendar commands for number of remote calendars and for
        // more than one calendar
        document.commandDispatcher.updateCommands("calendar_commands");
    },

    /**
     * Clean up function to remove observers when closing the window
     */
    unload: function cMO_unload() {
        var calendars = getCalendarManager().getCalendars({});
        for each (var calendar in calendars) {
            calendar.removeObserver(this);
        }
    },

    /**
     * Disables all elements with the attribute
     * 'disable-when-no-writable-calendars' set to 'true'.
     */
    setupWritableCalendars: function cMO_setupWritableCalendars() {
        var nodes = document.getElementsByAttribute("disable-when-no-writable-calendars", "true");
        for (var i = 0; i < nodes.length; i++) {
            if (this.mWritableCalendars < 1) {
                nodes[i].setAttribute("disabled", "true");
            } else {
                nodes[i].removeAttribute("disabled");
            }
        }
    },

    // calICalendarManagerObserver
    onCalendarRegistered: function cMO_onCalendarRegistered(aCalendar) {
        // append by default:
        let sortOrder = cal.getPrefSafe("calendar.list.sortOrder", "").split(" ");
        sortOrder.push(aCalendar.id);
        cal.setPref("calendar.list.sortOrder", sortOrder.join(" "));

        this.initializeCalendar(aCalendar);
        var composite = getCompositeCalendar();
        var inComposite = aCalendar.getProperty(composite.prefPrefix +
                                                "-in-composite");
        if ((inComposite === null) || inComposite) {
            composite.addCalendar(aCalendar);
        }
    },

    onCalendarUnregistering: function cMO_onCalendarUnregistering(aCalendar) {
        var calendars = getCalendarManager().getCalendars({});

        calendarListTreeView.removeCalendar(aCalendar);
        aCalendar.removeObserver(this);

        // Make sure the calendar is removed from the composite calendar
        getCompositeCalendar().removeCalendar(aCalendar.uri);

        // Update commands to disallow deleting the last calendar and only
        // allowing reload remote calendars when there are remote calendars.
        document.commandDispatcher.updateCommands("calendar_commands");
    },

    onCalendarDeleting: function cMO_onCalendarDeleting(aCalendar) {
    },

    // calIObserver. Note that each registered calendar uses this observer, not
    // only the composite calendar.
    onStartBatch: function cMO_onStartBatch() { },
    onEndBatch: function cMO_onEndBatch() { },
    onLoad: function cMO_onLoad() { },

    // TODO: remove these temporary caldav exclusions when it is safe to do so
    // needed to allow cadav refresh() to update w/o forcing visibility
    onAddItem: function cMO_onAddItem(aItem) {
        if (aItem.calendar.type != "caldav") {
            ensureCalendarVisible(aItem.calendar);
        }
    },

    onModifyItem: function cMO_onModifyItem(aNewItem, aOldItem) {
        if (aNewItem.calendar.type != "caldav") {
            ensureCalendarVisible(aNewItem.calendar);
        }
    },

    onDeleteItem: function cMO_onDeleteItem(aDeletedItem) { },
    onError: function cMO_onError(aCalendar, aErrNo, aMessage) { },

    onPropertyChanged: function cMO_onPropertyChanged(aCalendar,
                                                      aName,
                                                      aValue,
                                                      aOldValue) {
        switch (aName) {
            case "color":
                updateStyleSheetForObject(aCalendar, gCachedStyleSheet);
                calendarListUpdateColor(aCalendar);
                // Fall through, update item in any case
            case "name":
            case "currentStatus":
            case "readOnly":
            case "disabled":
                calendarListTreeView.updateCalendar(aCalendar);
                // Fall through, update commands in any cases.
            case "requiresNetwork":
                document.commandDispatcher.updateCommands("calendar_commands");
                break;
        }
    },

    onPropertyDeleting: function cMO_onPropertyDeleting(aCalendar,
                                                        aName) {
        // Since the old value is not used directly in onPropertyChanged,
        // but should not be the same as the value, set it to a different
        // value.
        this.onPropertyChanged(aCalendar, aName, null, null);
    },

    // nsIObserver
    observe: function cMO_observe(aSubject, aTopic, aPrefName) {

        switch (aPrefName) {
            case "calendar.week.start":
                getMinimonth().refreshDisplay(true);
                break;
            case "calendar.date.format":
                var view = currentView();
                var day = view.selectedDay;
                if (day) {
                    // The view may not be initialized, only refresh if there is
                    // a selected day.
                    view.goToDay(day);
                }

                if (isSunbird()) {
                    refreshEventTree();
                }
                toDoUnifinderRefresh();
                break;
            case "calendar.timezone.local":
                var subject = aSubject.QueryInterface(Components.interfaces.nsIPrefBranch2);
                gDefaultTimezone = subject.getCharPref(aPrefName);

                var view = currentView();
                var day = view.selectedDay;
                if (day) {
                    // The view may not be initialized, only refresh if there is
                    // a selected day.
                    view.goToDay(day);
                }

                if (isSunbird()) {
                    refreshEventTree();
                }
                toDoUnifinderRefresh();
                break;
            default :
                break;
        }

        // Since we want to take care of all categories, this must be done
        // extra.
        if (aPrefName.substring(0, 24) == "calendar.category.color.") {
            var categoryName = aPrefName.substring(24);
            updateStyleSheetForObject(categoryName, gCachedStyleSheet);
        }
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
