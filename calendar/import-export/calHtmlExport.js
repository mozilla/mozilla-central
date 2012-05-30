/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");

// Export
function calHtmlExporter() {
}

calHtmlExporter.prototype = {
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

    contractID: "@mozilla.org/calendar/export;1?type=html",
    classDescription: "Calendar HTML Exporter",
    classID: Components.ID("{72d9ab35-9b1b-442a-8cd0-ae49f00b159b}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return cal.doQueryInterface(this, calHtmlExporter.prototype, aIID, null, this);
    },

    getFileTypes: function getFileTypes(aCount) {
        aCount.value = 1;
        let wildmat = '*.html; *.htm';
        let label = cal.calGetString("calendar", 'filterHtml', [wildmat]);
        return [{ defaultExtension:'html',
                  extensionFilter: wildmat,
                  description: label }];
    },

    exportToStream: function html_exportToStream(aStream, aCount, aItems, aTitle) {
        let documentTitle = aTitle || cal.calGetString("calendar", "HTMLTitle");

        let html =
            <html>
                <head>
                    <title>{documentTitle}</title>
                    <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
                    <style type='text/css'/>
                </head>
                <body>
                    <!-- Note on the use of the summarykey class: this is a
                         special class, because in the default style, it is hidden.
                         The div is still included for those that want a different
                         style, where the key is visible -->
                </body>
            </html>;
        // XXX The html comment above won't propagate to the resulting html.
        //     Should fix that, one day.

        // Using this way to create the styles, because { and } are special chars
        // in e4x. They have to be escaped, which doesn't improve readability
        html.head.style = ".vevent {border: 1px solid black; padding: 0px; margin-bottom: 10px;}\n";
        html.head.style += "div.key {font-style: italic; margin-left: 3px;}\n";
        html.head.style += "div.value {margin-left: 20px;}\n";
        html.head.style += "abbr {border: none;}\n";
        html.head.style += ".summarykey {display: none;}\n";
        html.head.style += "div.summary {background: white; font-weight: bold; margin: 0px; padding: 3px;}\n";
        html.head.style += "div.description { white-space: pre-wrap; }\n";

        // Sort aItems
        function sortFunc(a, b) {
            let start_a = a[cal.calGetStartDateProp(a)];
            if (!start_a) {
                return -1;
            }
            let start_b = b[cal.calGetStartDateProp(b)];
            if (!start_b) {
                return 1;
            }
            return start_a.compare(start_b);
        }
        aItems.sort(sortFunc);

        let prefixTitle = cal.calGetString("calendar", "htmlPrefixTitle");
        let prefixWhen = cal.calGetString("calendar", "htmlPrefixWhen");
        let prefixLocation = cal.calGetString("calendar", "htmlPrefixLocation");
        let prefixDescription = cal.calGetString("calendar", "htmlPrefixDescription");
        let defaultTimezone = cal.calendarDefaultTimezone();

        for (let pos = 0; pos < aItems.length; ++pos) {
            let item = aItems[pos];

            // Put properties of the event in a definition list
            // Use hCalendar classes as bonus
            let ev = <div class='vevent'/>;
            let fmtTaskCompleted = cal.calGetString("calendar",
                                                    "htmlTaskCompleted",
                                                    [item.title]);

            // Title
            ev.appendChild(
                <div>
                    <div class='key summarykey'>{prefixTitle}</div>
                    <div class='value summary'>{item.isCompleted ? fmtTaskCompleted : item.title}</div>
                </div>
            );
            let startDate = item[cal.calGetStartDateProp(item)];
            let endDate = item[cal.calGetEndDateProp(item)];
            let dateString = cal.getDateFormatter().formatItemInterval(item);

            if (startDate != null || endDate != null) {
                // This is a task with a start or due date, format accordingly
                ev.appendChild(
                    <div>
                        <div class='key'>{prefixWhen}</div>
                        <div class='value'>
                            <abbr class='dtstart' title={startDate ? startDate.icalString : "none"}>{dateString}</abbr>
                        </div>
                    </div>
                );
            }
            // Location
            if (item.getProperty('LOCATION')) {
                ev.appendChild(
                    <div>
                        <div class='key'>{prefixLocation}</div>
                        <div class='value location'>{item.getProperty('LOCATION')}</div>
                    </div>
                );
            }

            let desc = item.getProperty('DESCRIPTION');
            if (desc && desc.length > 0) {
                let descnode =
                    <div>
                        <div class='key'>{prefixDescription}</div>
                        <div class='value description'>{desc}</div>
                    </div>;

                ev.appendChild(descnode);
            }
            html.body.appendChild(ev);
        }

        // Convert the javascript string to an array of bytes, using the
        // utf8 encoder
        let convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIConverterOutputStream);
        convStream.init(aStream, 'UTF-8', 0, 0x0000);

        let str = html.toXMLString()
        convStream.writeString(str);
    }
};
