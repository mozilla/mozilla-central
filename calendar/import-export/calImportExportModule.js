/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

const scriptLoadOrder = [
    "calIcsImportExport.js",
    "calHtmlExport.js",
    "calOutlookCSVImportExport.js",

    "calListFormatter.js",
    "calMonthGridPrinter.js",
    "calWeekPrinter.js"
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
        calIcsImporter,
        calIcsExporter,
        calHtmlExporter,
        calOutlookCSVImporter,
        calOutlookCSVExporter,

        calListFormatter,
        calMonthPrinter,
        calWeekPrinter
    ];

    return (XPCOMUtils.generateNSGetFactory(components))(cid);
}
