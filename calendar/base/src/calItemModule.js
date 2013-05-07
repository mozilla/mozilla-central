/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

const scriptLoadOrder = [
    "calItemBase.js",
    "calUtils.js",
    "calCachedCalendar.js",

    "calAlarm.js",
    "calAlarmService.js",
    "calAlarmMonitor.js",
    "calAttendee.js",
    "calAttachment.js",
    "calCalendarManager.js",
    "calCalendarSearchService.js",
    "calDateTimeFormatter.js",
    "calDeletedItems.js",
    "calEvent.js",
    "calFreeBusyService.js",
    "calIcsParser.js",
    "calIcsSerializer.js",
    "calItipItem.js",
    "calProtocolHandler.js",
    "calRecurrenceDate.js",
    "calRecurrenceInfo.js",
    "calRelation.js",
    "calStartupService.js",
    "calTransactionManager.js",
    "calTodo.js",
    "calWeekInfoService.js"
];

function getComponents() {
    Components.classes["@mozilla.org/calendar/backend-loader;1"].getService();

    return [
        calAlarm,
        calAlarmService,
        calAlarmMonitor,
        calAttendee,
        calAttachment,
        calCalendarManager,
        calCalendarSearchService,
        calDateTimeFormatter,
        calDeletedItems,
        calEvent,
        calFreeBusyService,
        calIcsParser,
        calIcsSerializer,
        calItipItem,
        calProtocolHandlerWebcal,
        calProtocolHandlerWebcals,
        calRecurrenceDate,
        calRecurrenceInfo,
        calRelation,
        calStartupService,
        calTransaction,
        calTransactionManager,
        calTodo,
        calWeekInfoService,
    ];
}

var NSGetFactory = cal.loadingNSGetFactory(scriptLoadOrder, getComponents, this);
