/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * ICS Import and Export Plugin
 */

// Shared functions
function getIcsFileTypes(aCount) {
    aCount.value = 1;
    return [{
        QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIFileType]),
        defaultExtension: 'ics',
        extensionFilter: '*.ics',
        description: cal.calGetString("calendar", 'filterIcs', ['*.ics'])
    }];
}

// Importer
function calIcsImporter() {
}

calIcsImporter.prototype = {
    classID: Components.ID("{1e3e33dc-445a-49de-b2b6-15b2a050bb9d}"),
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIImporter]),

    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{1e3e33dc-445a-49de-b2b6-15b2a050bb9d}"),
        contractID: "@mozilla.org/calendar/import;1?type=ics",
        classDescription: "Calendar ICS Importer",
        interfaces: [Components.interfaces.calIImporter]
    }),

    getFileTypes: getIcsFileTypes,

    importFromStream: function importFromStream(aStream, aCount) {
        let parser = Components.classes["@mozilla.org/calendar/ics-parser;1"]
                               .createInstance(Components.interfaces.calIIcsParser);
        parser.parseFromStream(aStream, null);
        return parser.getItems(aCount);
    }
};

// Exporter
function calIcsExporter() {
}

calIcsExporter.prototype = {
    classID: Components.ID("{a6a524ce-adff-4a0f-bb7d-d1aaad4adc60}"),
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIExporter]),

    classInfo: XPCOMUtils.generateCI({
        classID: Components.ID("{a6a524ce-adff-4a0f-bb7d-d1aaad4adc60}"),
        contractID: "@mozilla.org/calendar/export;1?type=ics",
        classDescription: "Calendar ICS Exporter",
        interfaces: [Components.interfaces.calIExporter]
    }),

    getFileTypes: getIcsFileTypes,

    exportToStream: function exportToStream(aStream, aCount, aItems) {
        let serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                   .createInstance(Components.interfaces.calIIcsSerializer);
        serializer.addItems(aItems, aItems.length);
        serializer.serializeToStream(aStream);
    }
};
