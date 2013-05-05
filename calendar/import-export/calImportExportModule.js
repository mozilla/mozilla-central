/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

const scriptLoadOrder = [
    "calIcsImportExport.js",
    "calHtmlExport.js",
    "calOutlookCSVImportExport.js",

    "calListFormatter.js",
    "calMonthGridPrinter.js",
    "calWeekPrinter.js"
];

function getComponents() {
    return [
        calIcsImporter,
        calIcsExporter,
        calHtmlExporter,
        calOutlookCSVImporter,
        calOutlookCSVExporter,

        calListFormatter,
        calMonthPrinter,
        calWeekPrinter
    ];
}

var NSGetFactory = cal.loadingNSGetFactory(scriptLoadOrder, getComponents, this);
