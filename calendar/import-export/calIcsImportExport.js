/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

// Shared functions
function getIcsFileTypes(aCount) {
    aCount.value = 1;
    let wildmat = '*.ics';
    let label = cal.calGetString("calendar", 'filterIcs', [wildmat]);
    return [{ defaultExtension: 'ics',
              extensionFilter: wildmat,
              description: label }];
}

// Importer
function calIcsImporter() {
}

calIcsImporter.prototype = {
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIImporter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/import;1?type=ics",
    classDescription: "Calendar ICS Importer",
    classID: Components.ID("{1e3e33dc-445a-49de-b2b6-15b2a050bb9d}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calIcsImporter.prototype, aIID, null, this);
    },

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
    getInterfaces: function (count) {
        const ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.nsIClassInfo,
            Components.interfaces.calIExporter,
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/export;1?type=ics",
    classDescription: "Calendar ICS Exporter",
    classID: Components.ID("{a6a524ce-adff-4a0f-bb7d-d1aaad4adc60}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calIcsExporter.prototype, aIID, null, this);
    },

    getFileTypes: getIcsFileTypes,

    exportToStream: function exportToStream(aStream, aCount, aItems) {
        let serializer = Components.classes["@mozilla.org/calendar/ics-serializer;1"]
                                   .createInstance(Components.interfaces.calIIcsSerializer);
        serializer.addItems(aItems, aItems.length);
        serializer.serializeToStream(aStream);
    }
};
