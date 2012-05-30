/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A thin wrapper that is a print formatter, and just calls the html (list)
 * exporter
 */
function calListFormatter() {
}

calListFormatter.prototype = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIPrintFormatter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/printformatter;1?type=list",
    classDescription: "Calendar List Print Formatter",
    classID: Components.ID("{9ae04413-fee3-45b9-8bbb-1eb39a4cbd1b}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calListFormatter.prototype, aIID, null, this);
    },

    get name() {
        return cal.calGetString("calendar", "formatListName");
    },

    formatToHtml: function list_formatToHtml(aStream, aStart, aEnd, aCount, aItems, aTitle) {
        let htmlexporter = Components.classes["@mozilla.org/calendar/export;1?type=htmllist"]
                                     .createInstance(Components.interfaces.calIExporter);
        htmlexporter.exportToStream(aStream, aCount, aItems, aTitle);
    }
};
