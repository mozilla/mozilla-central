/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * A thin wrapper around the html list exporter for the list print format.
 */
function calListFormatter() {
}

calListFormatter.prototype = {
    classID: Components.ID("{9ae04413-fee3-45b9-8bbb-1eb39a4cbd1b}"),
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIPrintFormatter]),

    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{9ae04413-fee3-45b9-8bbb-1eb39a4cbd1b}"),
        contractID: "@mozilla.org/calendar/printformatter;1?type=list",
        classDescription: "Calendar List Print Formatter",
        interfaces: [Components.interfaces.calIPrintFormatter]
    }),

    get name() cal.calGetString("calendar", "formatListName"),

    formatToHtml: function list_formatToHtml(aStream, aStart, aEnd, aCount, aItems, aTitle) {
        let htmlexporter = Components.classes["@mozilla.org/calendar/export;1?type=htmllist"]
                                     .createInstance(Components.interfaces.calIExporter);
        htmlexporter.exportToStream(aStream, aCount, aItems, aTitle);
    }
};
