/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

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

function NSGetFactory(cid) {
    if (!this.scriptsLoaded) {
        Services.io.getProtocolHandler("resource")
                .QueryInterface(Components.interfaces.nsIResProtocolHandler)
                .setSubstitution("calendar", Services.io.newFileURI(__LOCATION__.parent.parent));
        Components.utils.import("resource://calendar/modules/calUtils.jsm");
        cal.loadScripts(scriptLoadOrder, Components.utils.getGlobalForObject(this));
        this.scriptsLoaded = true;
    }

    let components = [
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

    return (XPCOMUtils.generateNSGetFactory(components))(cid);
}
