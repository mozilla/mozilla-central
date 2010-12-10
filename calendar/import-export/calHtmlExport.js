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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 * ArentJan Banck <ajbanck@planet.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michiel van Leeuwen <mvl@exedo.nl>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

            // Description, inside a pre to preserve formating when needed.
            let desc = item.getProperty('DESCRIPTION');
            if (desc && desc.length > 0) {
                let usePre = false;
                if (desc.indexOf("\n ") >= 0 || desc.indexOf("\n\t") >= 0 ||
                    desc.indexOf(" ") == 0 || desc.indexOf("\t") == 0)
                    // (RegExp /^[ \t]/ doesn't work.)
                    // contains indented preformatted text after beginning or newline
                    // so preserve indentation with PRE.
                    usePre = true;

                let descnode =
                    <div>
                        <div class='key'>{prefixDescription}</div>
                        <div class='value'/>
                    </div>;

                if (usePre) {
                    descnode.div[1] = <pre class='description'>{desc}</pre>;
                } else {
                    let lines = desc.split('\n');
                    for (let i in lines) {
                        descnode.div[1].appendChild(lines[i]);
                        // Add a new line, except after the last line
                        if (i != (lines.length-1)) {
                            descnode.div[1].appendChild(<br/>);
                        }
                    }
                }
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
