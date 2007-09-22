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
 * Calendar specific utility functions
 */
var gCompositeCalendar = null;
function getCompositeCalendar() {
    if (!gCompositeCalendar) {
        gCompositeCalendar =
            Components.classes["@mozilla.org/calendar/calendar;1?type=composite"]
            .createInstance(Components.interfaces.calICompositeCalendar);

        gCompositeCalendar.prefPrefix = 'calendar-main';
    }
    return gCompositeCalendar;
}

function getSelectedCalendar() {
    var tree = document.getElementById("calendar-list-tree");
    return (tree.currentIndex > -1) &&
           calendarListTreeView.mCalendarList[tree.currentIndex] || null;
}

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

function ensureCalendarVisible(aCalendar) {
    var composite = getCompositeCalendar();
    if (!composite.getCalendar(aCalendar.uri)) {
        composite.addCalendar(aCalendar);
    }
}

/**
 * Calendar manager load/unload functions
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
        composite.addCalendar(homeCalendar);

        // Wrapping this in a try/catch block, as if any of the migration code
        // fails, the app may not load.
        try {
            gDataMigrator.checkAndMigrate();
        } catch (e) {
            Components.utils.reportError("Migrator error: " + e);
        }

        calendars = [homeCalendar];
    }

    calendarListInitCategoryColors();

    // Set up the tree view
    var tree = document.getElementById("calendar-list-tree");
    calendarListTreeView.tree = tree;
    tree.view = calendarListTreeView;

    calMgr.addObserver(calendarManagerObserver);
    composite.addObserver(calendarManagerObserver);
    branch.addObserver("calendar.", calendarManagerObserver, false);

    // The calendar manager will not notify for existing calendars. Go through
    // them all and set up manually.
    for each (var calendar in calendars) {
        calendarManagerObserver.initializeCalendar(calendar);
    }
}

function unloadCalendarManager() {
    var calMgr = getCalendarManager();
    var composite = getCompositeCalendar();
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch("").QueryInterface(Components.interfaces.nsIPrefBranch2);

    branch.removeObserver("calendar.", calendarManagerObserver);
    composite.removeObserver(calendarManagerObserver);
    calMgr.removeObserver(calendarManagerObserver);
}

/**
 * Color specific functions
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

    // Update all categories
    for each (var category in categories) {
        updateStyleSheetForObject(category, gCachedStyleSheet);
    }
}

function calendarListUpdateColor(aCalendar) {
    var selectorPrefix = "treechildren::-moz-tree-cell";

    var color = getCalendarManager().getCalendarPref(aCalendar, "color");
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

    var ruleString = selectorPrefix + "(color-" + color.substr(1) + ") { }";

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

    /**
     * High-level calendar tree manipulation
     */

    findIndex: function cLTV_findIndex(aCalendar) {
        for (var i = 0; i < this.mCalendarList.length; i++) {
            if (this.mCalendarList[i].id == aCalendar.id) {
                return i;
            }
        }
        return -1;
    },

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

    removeCalendar: function cLTV_removeCalendar(aCalendar) {
        var index = this.findIndex(aCalendar);
        if (index < 0) {
            return;
        }

        this.mCalendarList.splice(index, 1);
        this.treebox.rowCountChanged(index, -1);

        if (index == this.rowCount) {
            index--;
        }

        this.tree.view.selection.select(index);
    },

    updateCalendar: function cLTV_updateCalendar(aCalendar) {
        var index = this.findIndex(aCalendar);
        this.treebox.invalidateRow(index);
    },

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
     * nsITreeView methods and properties
     */
    get rowCount() {
        return this.mCalendarList.length;
    },

    getCellProperties: function cLTV_getCellProperties(aRow, aCol, aProps) {
        var calendar = this.mCalendarList[aRow];
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
                if (composite.getCalendar(calendar.uri)) {
                    aProps.AppendElement(getAtomFromService("checked"));
                } else {
                    aProps.AppendElement(getAtomFromService("unchecked"));
                }
                break;
            case "calendar-list-tree-color":
                var color = getCalendarManager().getCalendarPref(calendar,
                                                                 "color");
                color = "color-" + (color ? color.substr(1) : "default");
                aProps.AppendElement(getAtomFromService(color));
                break;
       }
    },

    cycleCell: function cLTV_cycleCell(aRow, aCol) {
        var calendar = this.mCalendarList[aRow];
        var composite = getCompositeCalendar();

        if (composite.getCalendar(calendar.uri)) {
            composite.removeCalendar(calendar.uri);
        } else {
            composite.addCalendar(calendar);
        }
        this.treebox.invalidateRow(aRow);
    },

    getCellValue: function cLTV_getCellValue(aRow, aCol) {
        var calendar = this.mCalendarList[aRow];
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
                return composite.getCalendar(calendar.uri) ? "true" : "false";
        }
        return null;
    },

    setCellValue: function cLTV_setCellValue(aRow, aCol, aValue) {
        var calendar = this.mCalendarList[aRow];
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-checkbox":
                if (aValue == "true") {
                    composite.addCalendar(calendar);
                } else {
                    composite.removeCalendar(calendar);
                }
                return aValue;
        }
        return null;
    },

    getCellText: function cLTV_getCellText(aRow, aCol) {
        var calendar = this.mCalendarList[aRow];
        var composite = getCompositeCalendar();

        switch (aCol.id) {
            case "calendar-list-tree-calendar":
                return this.mCalendarList[aRow].name;

        }
        return "";
    },

    getImageSrc: function cLTV_getImageSrc(aRow, aCol) {
        return null;
    },

    isEditable: function cLTV_isEditable(aRow, aCol) {
        return false;
    },

    setTree: function cLTV_setTree(aTreeBox) {
        this.treebox = aTreeBox;
    },

    isContainer: function cLTV_isContainer(aRow) {
        return false;
    },

    isSeparator: function cLTV_isSeparator(aRow) {
        return false;
    },

    isSorted: function cLTV_isSorted(aRow) {
        return false;
    },

    getLevel: function cLTV_getLevel(aRow) {
        return 0;
    },

    getRowProperties: function cLTV_getRowProperties(aRow, aProps) {},

    getColumnProperties: function cLTV_getColumnProperties(aCol, aProps) {},

    cycleHeader: function cLTV_cycleHeader(aCol) { },

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
                    var cbCol =
                        this.treebox.columns
                            .getNamedColumn("list-calendarsr-tree-checkbox");
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
            openCalendarProperties(calendar, null);
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
    },

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
            calendar = this.mCalendarList[row.value];
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

var calendarManagerObserver = {
    mDefaultCalendarItem: null,

    QueryInterface: function cMO_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.calICalendarManagerObserver) &&
            !aIID.equals(Components.interfaces.calICompositeObserver) &&
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
        var calendars = getCalendarManager().getCalendars({});
        calendarListTreeView.addCalendar(aCalendar);

        updateStyleSheetForObject(aCalendar, gCachedStyleSheet);
        calendarListUpdateColor(aCalendar);

        // Watch the calendar for changes, to ensure its visibility when adding
        // or changing items.
        aCalendar.addObserver(this);

        // Make sure we can delete calendars when there is more than one.
        if (calendars.length > 1) {
            document.getElementById("calendar_delete_calendar_command")
                    .removeAttribute("disabled");
        }

        if (aCalendar.canRefresh) {
            document.getElementById("calendar_reload_remote_calendars")
                    .removeAttribute("disabled");
        }
    },

    // calICalendarManagerObserver
    onCalendarRegistered: function cMO_onCalendarRegistered(aCalendar) {
        this.initializeCalendar(aCalendar);
        getCompositeCalendar().addCalendar(aCalendar);
    },

    onCalendarUnregistering: function cMO_onCalendarUnregistering(aCalendar) {
        var calendars = getCalendarManager().getCalendars({});

        calendarListTreeView.removeCalendar(aCalendar);
        aCalendar.removeObserver(this);

        // We want to make sure its not possible to delete the last calendar.
        // Since at this point the current calendar hasn't been deleted yet,
        // start disabling when there are two calendars.
        if (calendars.length <= 2) {
            document.getElementById("calendar_delete_calendar_command")
                    .setAttribute("disabled", true);
        }

        if (aCalendar.canRefresh) {
            // This may be the last refreshable calendar. In that case, disable
            // the possibility to reload remote calendars.
            function calCanRefresh(cal) {
                return (cal.canRefresh && !cal.uri.equals(aCalendar.uri));
            }
            if (!calendars.some(calCanRefresh)) {
                document.getElementById("calendar_reload_remote_calendars")
                        .setAttribute("disabled", true);
            }
        }
    },

    onCalendarDeleting: function cMO_onCalendarDeleting(aCalendar) {
        // Make sure the calendar is removed from the composite calendar
        getCompositeCalendar().removeCalendar(aCalendar.uri);
    },

    onCalendarPrefSet: function cMO_onCalendarPrefSet(aCalendar,
                                                      aName,
                                                      aValue) {
        switch (aName) {
            case "color":
                updateStyleSheetForObject(aCalendar, gCachedStyleSheet);
                calendarListUpdateColor(aCalendar);
                // Fall through, update item in any case
            case "name":
                calendarListTreeView.updateCalendar(aCalendar);
                break;
        }
    },

    onCalendarPrefDeleting: function cMO_onCalendarPrefDeleting(aCalendar,
                                                                aName) {
        this.onCalendarPrefSet(aCalendar, aName, null);
    },

    // calICompositeObserver
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

    onAddItem: function cMO_onAddItem(aItem) {
        ensureCalendarVisible(aItem.calendar);
    },

    onModifyItem: function cMO_onModifyItem(aNewItem, aOldItem) {
        ensureCalendarVisible(aNewItem.calendar);
    },

    onDeleteItem: function cMO_onDeleteItem(aDeletedItem) { },
    onError: function cMO_onError(aErrNo, aMessage) { },

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
