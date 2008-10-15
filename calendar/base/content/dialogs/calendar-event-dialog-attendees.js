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
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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

var gStartDate = null;
var gEndDate = null;
var gStartTimezone = null;
var gEndTimezone = null;
var gDuration = null;
var gStartHour = 0;
var gEndHour = 24;
var gIsReadOnly = false;
var gIsInvitation = false;
var gIgnoreUpdate = false;
var gDisplayTimezone = true;
var gUndoStack = [];
var gForce24Hours = false;
var gZoomFactor = 100;

function onLoad() {
    // first of all, attach all event handlers
    window.addEventListener("resize", onResize, true);
    window.addEventListener("modify", onModify, true);
    window.addEventListener("rowchange", onRowChange, true);
    window.addEventListener("DOMMouseScroll", onMouseScroll, true);
    window.addEventListener("DOMAttrModified", onAttrModified, true);
    window.addEventListener("timebar", onTimebar, true);
    window.addEventListener("timechange", onTimeChange, true);

    var args = window.arguments[0];
    var startTime = args.startTime;
    var endTime = args.endTime;
    var calendar = args.calendar;

    gDisplayTimezone = args.displayTimezone;

    onChangeCalendar(calendar);

    // we need to enforce several layout constraints which can't be modelled
    // with plain xul and css, at least as far as i know.
    const kStylesheet = "chrome://calendar/content/calendar-event-dialog.css";
    for each (var stylesheet in document.styleSheets) {
        if (stylesheet.href == kStylesheet) {
            // make the dummy-spacer #1 [top] the same height as the timebar
            var timebar = document.getElementById("timebar");
            stylesheet.insertRule(
                ".attendee-spacer-top { height: "
                    + timebar.boxObject.height+"px; }", 0);
            // make the dummy-spacer #2 [bottom] the same height as the scrollbar
            var scrollbar = document.getElementById("horizontal-scrollbar");
            stylesheet.insertRule(
                ".attendee-spacer-bottom { height: "
                    + scrollbar.boxObject.height+"px; }", 0);
            break;
        }
    }

    var zoom = document.getElementById("zoom-menulist");
    zoom.value = "100";

    initTimeRange();

    // Check if an all-day event has been passed in (to adapt endDate).
    if (startTime.isDate) {
        startTime = startTime.clone();
        endTime = endTime.clone();

        endTime.day--;

        // for all-day events we expand to 24hrs, set zoom-factor to 25%
        // and disable the zoom-control.
        setForce24Hours(true);
        zoom.value = "400";
        zoom.setAttribute("disabled", "true");
        setZoomFactor(zoom.value);
    }

    loadDateTime(startTime, endTime);
    propagateDateTime();

    updateButtons();

    // attach an observer to get notified of changes
    // that are relevant to this dialog.
    var prefObserver = {
        observe: function aD_observe(aSubject, aTopic, aPrefName) {
            switch (aPrefName) {
                case "calendar.view.daystarthour":
                case "calendar.view.dayendhour":
                    initTimeRange();
                    propagateDateTime();
                    break;
            }
        }
    }
    var pb2 = Components.classes["@mozilla.org/preferences-service;1"].
              getService(Components.interfaces.nsIPrefBranch2);
    pb2.addObserver("calendar.", prefObserver, false);
    window.addEventListener("unload",
        function() {
            pb2.removeObserver("calendar.", prefObserver);
        },
        false);

    opener.setCursor("auto");
    self.focus();
}

function onAccept() {
    var attendees = document.getElementById("attendees-list");
    window.arguments[0].onOk(
        attendees.attendees,
        attendees.organizer,
        gStartDate.getInTimezone(gStartTimezone),
        gEndDate.getInTimezone(gEndTimezone));
    return true;
}

function onCancel() {
    return true;
}

function onZoomFactor(aValue) {
    setZoomFactor(parseInt(aValue));
}

function loadDateTime(aStartDate, aEndDate) {
    gDuration = aEndDate.subtractDate(aStartDate);
    var kDefaultTimezone = calendarDefaultTimezone();
    gStartTimezone = aStartDate.timezone;
    gEndTimezone = aEndDate.timezone;
    gStartDate = aStartDate.getInTimezone(kDefaultTimezone);
    gEndDate = aEndDate.getInTimezone(kDefaultTimezone);
    gStartDate.makeImmutable();
    gEndDate.makeImmutable();
}

function propagateDateTime() {
    // Fill the controls
    updateDateTime();

    // Tell the timebar about the new start/enddate
    var timebar = document.getElementById("timebar");
    timebar.startDate = gStartDate;
    timebar.endDate = gEndDate;
    timebar.refresh();

    // Tell the selection-bar about the new start/enddate
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.startDate = gStartDate;
    selectionbar.endDate = gEndDate;
    selectionbar.update();

    // Tell the freebusy grid about the new start/enddate
    var grid = document.getElementById("freebusy-grid");

    var refresh = (grid.startDate == null) ||
                  (grid.startDate.compare(gStartDate) != 0) ||
                  (grid.endDate == null) ||
                  (grid.endDate.compare(gEndDate) != 0);
    grid.startDate = gStartDate;
    grid.endDate = gEndDate;
    if (refresh) {
        grid.forceRefresh();
    }

    // Expand to 24hrs if the new range is outside of the default range.
    var kDefaultTimezone = calendarDefaultTimezone();
    var startTime = gStartDate.getInTimezone(kDefaultTimezone);
    var endTime = gEndDate.getInTimezone(kDefaultTimezone);
    if ((startTime.hour < gStartHour) ||
        (endTime.hour > gEndHour) ||
        (startTime.isDate)) {
        setForce24Hours(true);
    }
}

/**
 * assumes that gStartDate and gEndDate have been correctly initialized,
 * either by having called loadDateTime() or having read the information
 * from the controls due to recent user input. gStartDate and gEndDate are
 * assumed to always be in the default timezone while the actual timezones
 * are expected at gStartTimezone and gEndTimezone. this function attempts
 * to copy these state related informations to the dialog controls, which
 * makes it read from the variables and write to the controls (i.e. it
 * doesn't change the state).
 */
function updateDateTime() {
    // Convert to default timezone if the timezone option
    // is *not* checked, otherwise keep the specific timezone
    // and display the labels in order to modify the timezone.
    if (gDisplayTimezone) {
        var startTime = gStartDate.getInTimezone(gStartTimezone);
        var endTime = gEndDate.getInTimezone(gEndTimezone);

        if (startTime.isDate) {
            document.getElementById("all-day")
                .setAttribute("checked", "true");
        }

        // In the case where the timezones are different but
        // the timezone of the endtime is "UTC", we convert
        // the endtime into the timezone of the starttime.
        if (startTime && endTime) {
            if (!compareObjects(startTime.timezone, endTime.timezone)) {
                if (endTime.timezone.isUTC) {
                    endTime = endTime.getInTimezone(startTime.timezone);
                }
            }
        }

        // Before feeding the date/time value into the control we need
        // to set the timezone to 'floating' in order to avoid the
        // automatic conversion back into the OS timezone.
        startTime.timezone = floating();
        endTime.timezone = floating();

        document.getElementById("event-starttime").value = startTime.jsDate;
        document.getElementById("event-endtime").value = endTime.jsDate;
    } else {
        var kDefaultTimezone = calendarDefaultTimezone();

        var startTime = gStartDate.getInTimezone(kDefaultTimezone);
        var endTime = gEndDate.getInTimezone(kDefaultTimezone);

        if (startTime.isDate) {
            document.getElementById("all-day")
                .setAttribute("checked", "true");
        }

        // Before feeding the date/time value into the control we need
        // to set the timezone to 'floating' in order to avoid the
        // automatic conversion back into the OS timezone.
        startTime.timezone = floating();
        endTime.timezone = floating();

        document.getElementById("event-starttime").value = startTime.jsDate;
        document.getElementById("event-endtime").value = endTime.jsDate;
    }

    updateTimezone();
    updateAllDay();
}

/**
 * assumes that gStartDate and gEndDate have been correctly initialized,
 * either by having called loadDateTime() or having read the information
 * from the controls due to recent user input. gStartDate and gEndDate are
 * assumed to always be in the default timezone while the actual timezones
 * are expected at gStartTimezone and gEndTimezone. this function attempts
 * to copy these state related informations to the dialog controls, which
 * makes it read from the variables and write to the controls (i.e. it
 * doesn't change the state).
 */
function updateTimezone() {
    gIgnoreUpdate = true;

    if (gDisplayTimezone) {
        var startTimezone = gStartTimezone;
        var endTimezone = gEndTimezone;
        var equalTimezones = false;
        if (startTimezone && endTimezone &&
            (compareObjects(startTimezone, endTimezone) || endTimezone.isUTC)) {
            equalTimezones = true;
        }

        var tzStart = document.getElementById("timezone-starttime");
        var tzEnd = document.getElementById("timezone-endtime");
        if (startTimezone != null) {
            tzStart.removeAttribute('collapsed');
            tzStart.value = startTimezone.displayName || startTimezone.tzid;
        } else {
            tzStart.setAttribute('collapsed', 'true');
        }

        // we never display the second timezone if both are equal
        if (endTimezone != null && !equalTimezones) {
            tzEnd.removeAttribute('collapsed');
            tzEnd.value = endTimezone.displayName || endTimezone.tzid;
        } else {
            tzEnd.setAttribute('collapsed', 'true');
        }
    } else {
        document.getElementById("timezone-starttime")
            .setAttribute('collapsed', 'true');
        document.getElementById("timezone-endtime")
            .setAttribute('collapsed', 'true');
    }

    gIgnoreUpdate = false;
}

function updateStartTime() {
    if (gIgnoreUpdate) {
        return;
    }

    var startWidgetId = "event-starttime";
    var endWidgetId = "event-endtime";

    var startWidget = document.getElementById(startWidgetId);
    var endWidget = document.getElementById(endWidgetId);

    // jsDate is always in OS timezone, thus we create a calIDateTime
    // object from the jsDate representation and simply set the new
    // timezone instead of converting.
    var start = jsDateToDateTime(startWidget.value,
                                 gDisplayTimezone ? gStartTimezone : calendarDefaultTimezone());
    gStartDate = start.clone();
    start.addDuration(gDuration);
    gEndDate = start.getInTimezone(gEndTimezone);

    var allDayElement = document.getElementById("all-day");
    var allDay = allDayElement.getAttribute("checked") == "true";
    if (allDay) {
        gStartDate.isDate = true;
        gEndDate.isDate = true;
    }

    propagateDateTime();
}

function updateEndTime() {
    if (gIgnoreUpdate) {
        return;
    }

    var startWidgetId = "event-starttime";
    var endWidgetId = "event-endtime";

    var startWidget = document.getElementById(startWidgetId);
    var endWidget = document.getElementById(endWidgetId);

    var saveStartTime = gStartDate;
    var saveEndTime = gEndDate;
    var kDefaultTimezone = calendarDefaultTimezone();

    gStartDate = jsDateToDateTime(startWidget.value,
                                  gDisplayTimezone ? gStartTimezone : calendarDefaultTimezone());

    var timezone = gEndTimezone;
    if (timezone.isUTC &&
        gStartDate &&
        !compareObjects(gStartTimezone, gEndTimezone)) {
        timezone = gStartTimezone;
    }
    gEndDate = jsDateToDateTime(endWidget.value,
                                gDisplayTimezone ? timezone : kDefaultTimezone);

    var allDayElement = document.getElementById("all-day");
    var allDay = allDayElement.getAttribute("checked") == "true";
    if (allDay) {
        gStartDate.isDate = true;
        gEndDate.isDate = true;
    }

    // Calculate the new duration of start/end-time.
    // don't allow for negative durations.
    var warning = false;
    if (gEndDate.compare(gStartDate) >= 0) {
        gDuration = gEndDate.subtractDate(gStartDate);
    } else {
        gStartDate = saveStartTime;
        gEndDate = saveEndTime;
        warning = true;
    }

    propagateDateTime();

    if (warning) {
        var callback = function() {
            var promptService =
                Components.classes[
                    "@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(
                        Components.interfaces.nsIPromptService);
            promptService.alert(
                null,
                document.title,
                calGetString("calendar", "warningNegativeDuration"));
        }
        setTimeout(callback, 1);
    }
}

function editStartTimezone() {
    var tzStart = document.getElementById("timezone-starttime");
    if (tzStart.hasAttribute("disabled")) {
        return;
    }

    var self = this;
    var args = new Object();
    args.time = gStartDate.getInTimezone(gStartTimezone);
    args.onOk = function(datetime) {
        var equalTimezones = false;
        if (gStartTimezone && gEndTimezone &&
            compareObjects(gStartTimezone, gEndTimezone)) {
            equalTimezones = true;
        }
        gStartTimezone = datetime.timezone;
        if (equalTimezones) {
            gEndTimezone = datetime.timezone;
        }
        self.propagateDateTime();
    };

    // Open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-timezone.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

function editEndTimezone() {
    var tzStart = document.getElementById("timezone-endtime");
    if (tzStart.hasAttribute("disabled")) {
        return;
    }

    var self = this;
    var args = new Object();
    args.time = gEndTime.getInTimezone(gEndTimezone);
    args.onOk = function(datetime) {
        if (gStartTimezone && gEndTimezone &&
            compareObjects(gStartTimezone, gEndTimezone)) {
            gStartTimezone = datetime.timezone;
        }
        gEndTimezone = datetime.timezone;
        self.propagateDateTime();
    };

    // Open the dialog modally
    openDialog(
        "chrome://calendar/content/calendar-event-dialog-timezone.xul",
        "_blank",
        "chrome,titlebar,modal,resizable",
        args);
}

function updateAllDay() {
    if (gIgnoreUpdate) {
        return;
    }

    var allDayElement = document.getElementById("all-day");
    var allDay  = (allDayElement.getAttribute("checked") == "true");
    var startpicker = document.getElementById("event-starttime");
    var endpicker = document.getElementById("event-endtime");

    var tzStart = document.getElementById("timezone-starttime");
    var tzEnd = document.getElementById("timezone-endtime");

    // Disable the timezone links if 'allday' is checked OR the
    // calendar of this item is read-only. In any other case we
    // enable the links.
    if (allDay) {
        startpicker.setAttribute("timepickerdisabled", "true");
        endpicker.setAttribute("timepickerdisabled", "true");

        tzStart.setAttribute("disabled", "true");
        tzEnd.setAttribute("disabled", "true");
        tzStart.removeAttribute("class");
        tzEnd.removeAttribute("class");
    } else {
        startpicker.removeAttribute("timepickerdisabled");
        endpicker.removeAttribute("timepickerdisabled");

        tzStart.removeAttribute("disabled");
        tzEnd.removeAttribute("disabled");
        tzStart.setAttribute("class", "text-link");
        tzEnd.setAttribute("class", "text-link");
    }
}

function changeAllDay() {
    var allDayElement = document.getElementById("all-day");
    var allDay = (allDayElement.getAttribute("checked") == "true");

    gStartDate = gStartDate.clone();
    gEndDate = gEndDate.clone();

    gStartDate.isDate = allDay;
    gEndDate.isDate = allDay;

    propagateDateTime();

    // After propagating the modified times we enforce some constraints
    // on the zoom-factor. in case this events is now said to be all-day,
    // we automatically enforce a 25% zoom-factor and disable the control.
    var zoom = document.getElementById("zoom-menulist");
    if (allDay) {
        zoom.value = "400";
        zoom.setAttribute("disabled", "true");
        setZoomFactor(zoom.value);
        setForce24Hours(true);
    } else {
        zoom.removeAttribute("disabled");
    }
}

function onResize() {
    // Don't do anything if we haven't been initialized.
    if (!gStartDate || !gEndDate) {
        return;
    }

    var grid = document.getElementById("freebusy-grid");
    var gridScrollbar = document.getElementById("horizontal-scrollbar");
    grid.fitDummyRows();
    var ratio = grid.boxObject.width / grid.documentSize;
    var maxpos = gridScrollbar.getAttribute("maxpos");
    var inc = maxpos * ratio / (1 - ratio);
    gridScrollbar.setAttribute("pageincrement", inc);

    var attendees = document.getElementById("attendees-list");
    var attendeesScrollbar = document.getElementById("vertical-scrollbar");
    var box = document.getElementById("vertical-scrollbar-box");
    attendees.fitDummyRows();
    var ratio = attendees.boxObject.height / attendees.documentSize;
    if (ratio < 1) {
        box.removeAttribute("collapsed");
        var maxpos = attendeesScrollbar.getAttribute("maxpos");
        var inc = maxpos * ratio / (1 - ratio);
        attendeesScrollbar.setAttribute("pageincrement", inc);
    } else {
        box.setAttribute("collapsed", "true");
    }
}

function onChangeCalendar(calendar) {
    var args = window.arguments[0];
    var organizer = args.organizer;

    // set 'mIsReadOnly' if the calendar is read-only
    if (calendar && calendar.readOnly) {
        gIsReadOnly = true;
    }

    // assume we're the organizer [in case that the calendar
    // does not support the concept of identities].
    gIsInvitation = false;
    if (calInstanceOf(args.item.calendar, Components.interfaces.calISchedulingSupport)) {
        gIsInvitation = args.item.calendar.isInvitation(args.item);
    }

    if (gIsReadOnly || gIsInvitation) {
        document.getElementById("next-slot")
            .setAttribute('disabled', 'true');
        document.getElementById("previous-slot")
            .setAttribute('disabled', 'true');
    }

    var freebusy = document.getElementById("freebusy-grid");
    freebusy.onChangeCalendar(calendar);
}

function updateButtons() {
    var previousButton = document.getElementById("previous-slot");
    if (gUndoStack.length > 0) {
        previousButton.removeAttribute('disabled');
    } else {
        previousButton.setAttribute('disabled', 'true');
    }
}

function onNextSlot() {
    // Store the current setting in the undo-stack.
    var currentSlot = {};
    currentSlot.startTime = gStartDate;
    currentSlot.endTime = gEndDate;
    gUndoStack.push(currentSlot);

    // Ask the grid for the next possible timeslot.
    var grid = document.getElementById("freebusy-grid");
    var duration = gEndDate.subtractDate(gStartDate);
    var start = grid.nextSlot();
    var end = start.clone();
    end.addDuration(duration);
    if (start.isDate) {
        end.day++;
    }
    gStartDate = start.clone();
    gEndDate = end.clone();
    var endDate = gEndDate.clone();

    // Check if an all-day event has been passed in (to adapt endDate).
    if (gStartDate.isDate) {
        gEndDate.day--;
    }
    gStartDate.makeImmutable();
    gEndDate.makeImmutable();
    endDate.makeImmutable();

    propagateDateTime();

    // Scroll the grid/timebar such that the current time is visible
    scrollToCurrentTime();

    updateButtons();
}

function onPreviousSlot() {
    var previousSlot = gUndoStack.pop();
    if (!previousSlot) {
        return;
    }

    // In case the new starttime happens to be scheduled
    // on a different day, we also need to update the
    // complete freebusy informations and appropriate
    // underlying arrays holding the information.
    var refresh = previousSlot.startTime.day != gStartDate.day;

    gStartDate = previousSlot.startTime.clone();
    gEndDate = previousSlot.endTime.clone();
    var endDate = gEndDate.clone();

    propagateDateTime();

    // scroll the grid/timebar such that the current time is visible
    scrollToCurrentTime();

    updateButtons();

    if (refresh) {
        var grid = document.getElementById("freebusy-grid");
        grid.forceRefresh();
    }
}

function onMinus() {
    var timebar = document.getElementById("timebar");
    var ratio = timebar.scroll;
    ratio -= timebar.step;
    if (ratio <= 0.0) {
        ratio = 0.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}

function onPlus() {
    var timebar = document.getElementById("timebar");
    var ratio = timebar.scroll;
    ratio += timebar.step;
    if (ratio >= 1.0) {
        ratio = 1.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}

function scrollToCurrentTime() {
    var timebar = document.getElementById("timebar");
    var ratio = (gStartDate.hour - gStartHour) * timebar.step;
    if (ratio <= 0.0) {
        ratio = 0.0;
    }
    if (ratio >= 1.0) {
        ratio = 1.0;
    }
    var scrollbar = document.getElementById("horizontal-scrollbar");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute("curpos", ratio * maxpos);
}


function setZoomFactor(aValue) {
    if (gZoomFactor == aValue) {
        return aValue;
    }

    gZoomFactor = aValue;
    var timebar = document.getElementById("timebar");
    timebar.zoomFactor = gZoomFactor;
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.zoomFactor = gZoomFactor;
    var grid = document.getElementById("freebusy-grid");
    grid.zoomFactor = gZoomFactor;

    // Calling onResize() will update the scrollbars and everything else
    // that needs to adopt the previously made changes. We need to call
    // this after the changes have actually been made...
    onResize();

    var scrollbar = document.getElementById("horizontal-scrollbar");
    if (scrollbar.hasAttribute("maxpos")) {
        var curpos = scrollbar.getAttribute("curpos");
        var maxpos = scrollbar.getAttribute("maxpos");
        var ratio = curpos / maxpos;
        timebar.scroll = ratio;
        grid.scroll = ratio;
        selectionbar.ratio = ratio;
    }

    return aValue;
}

function setForce24Hours(aValue) {
    if (gForce24Hours == aValue) {
      return aValue;
    }

    gForce24Hours = aValue;
    initTimeRange();
    var timebar = document.getElementById("timebar");
    timebar.force24Hours = gForce24Hours;
    var selectionbar = document.getElementById("selection-bar");
    selectionbar.force24Hours = gForce24Hours;
    var grid = document.getElementById("freebusy-grid");
    grid.force24Hours = gForce24Hours;

    // Calling onResize() will update the scrollbars and everything else
    // that needs to adopt the previously made changes. We need to call
    // this after the changes have actually been made...
    onResize();

    var scrollbar = document.getElementById("horizontal-scrollbar");
    if (!scrollbar.hasAttribute("maxpos")) {
        return aValue;
    }
    var curpos = scrollbar.getAttribute("curpos");
    var maxpos = scrollbar.getAttribute("maxpos");
    var ratio = curpos / maxpos;
    timebar.scroll = ratio;
    grid.scroll = ratio;
    selectionbar.ratio = ratio;

    return aValue;
}

function initTimeRange() {
    if (gForce24Hours) {
        gStartHour = 0;
        gEndHour = 24;
    } else {
        gStartHour = getPrefSafe("calendar.view.daystarthour", 8);
        gEndHour = getPrefSafe("calendar.view.dayendhour", 19);
    }
}

function onModify(event) {
    onResize();
    document.getElementById(
        "freebusy-grid")
            .onModify(event);
}

function onRowChange(event) {
    var scrollbar = document.getElementById("vertical-scrollbar");
    var attendees = document.getElementById("attendees-list");
    var maxpos = scrollbar.getAttribute("maxpos");
    scrollbar.setAttribute(
        "curpos",
        event.details / attendees.mMaxAttendees * maxpos);
}

function onMouseScroll(event) {
    // ignore mouse scrolling for now...
    event.stopPropagation();
}

function onAttrModified(event) {
    if (event.attrName == "width") {
        var selectionbar = document.getElementById("selection-bar");
        selectionbar.setWidth(selectionbar.boxObject.width);
        return;
    }

    // Synchronize grid and attendee list
    var target = event.originalTarget;
    if (target.hasAttribute("anonid") &&
        target.getAttribute("anonid") == "input" &&
        event.attrName == "focused" &&
        event.newValue == "true") {
        var attendees = document.getElementById("attendees-list");
        var grid = document.getElementById("freebusy-grid");
        if (grid.firstVisibleRow != attendees.firstVisibleRow) {
            grid.firstVisibleRow = attendees.firstVisibleRow;
        }
    }

    if (event.originalTarget.localName == "scrollbar") {
        var scrollbar = event.originalTarget;
        if (scrollbar.hasAttribute("maxpos")) {
            if (scrollbar.getAttribute("id") == "vertical-scrollbar") {
                var attendees = document.getElementById("attendees-list");
                var grid = document.getElementById("freebusy-grid");
                if (event.attrName == "curpos") {
                    var maxpos = scrollbar.getAttribute("maxpos");
                    attendees.ratio = event.newValue / maxpos;
                }
                grid.firstVisibleRow = attendees.firstVisibleRow;
            } else if (scrollbar.getAttribute("id") == "horizontal-scrollbar") {
                if (event.attrName == "curpos") {
                    var maxpos = scrollbar.getAttribute("maxpos");
                    var ratio = event.newValue/maxpos;
                    var timebar = document.getElementById("timebar");
                    var grid = document.getElementById("freebusy-grid");
                    var selectionbar = document.getElementById("selection-bar");
                    timebar.scroll = ratio;
                    grid.scroll = ratio;
                    selectionbar.ratio = ratio;
                }
            }
        }
    }
}

function onTimebar(event) {
    document.getElementById(
        "selection-bar")
            .init(event.details, event.height);
}

function onTimeChange(event) {
    var start = event.startDate.getInTimezone(gStartTimezone);
    var end = event.endDate.getInTimezone(gEndTimezone);

    loadDateTime(start, end);

    // fill the controls
    updateDateTime();

    // tell the timebar about the new start/enddate
    var timebar = document.getElementById("timebar");
    timebar.startDate = gStartDate;
    timebar.endDate = gEndDate;
    timebar.refresh();

    // tell the freebusy grid about the new start/enddate
    var grid = document.getElementById("freebusy-grid");

    var refresh = (grid.startDate == null) ||
                  (grid.startDate.compare(gStartDate) != 0) ||
                  (grid.endDate == null) ||
                  (grid.endDate.compare(gEndDate) != 0);
    grid.startDate = gStartDate;
    grid.endDate = gEndDate;
    if (refresh) {
        grid.forceRefresh();
    }
}

/**
 * This listener is used in calendar-event-dialog-freebusy.xml inside the
 * binding. It has been taken out of the binding to prevent leaks.
 */
function calFreeBusyListener(aFbElement, aBinding) {
    this.mFbElement = aFbElement;
    this.mBinding = aBinding;
}

calFreeBusyListener.prototype = {
    onResult: function cFBL_onResult(aRequest, aEntries) {
        if (aRequest && !aRequest.isPending) {
            // Find request in list of pending requests and remove from queue:
            function neq(aOp) {
                return (aRequest.id != aOp.id);
            }
            this.mBinding.mPendingRequests = this.mBinding.mPendingRequests.filter(neq);
        }
        if (aEntries) {
            this.mFbElement.onFreeBusy(aEntries);
        }
    }
};
