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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

/**
 * This script reads out the passed zones.tab and its timezone definitions and
 * composes an sqlite db file containing all those.
 * The timezone service (including all known TZID aliases) is used to check
 * what TZIDs have been dropped from the zones.tab. Those need to be inserted
 * below.
 *
 * args: <path-to-zones.tab-file> <moz-root> <version>
 */

function createFile(path) {
    var file = Components.classes["@mozilla.org/file/local;1"]
                         .createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(path);
    return file;
}

function appendSegmentsToFile(file, segments) {
    segments.forEach( function(seg) { file.append(seg); } );
}

/**
 * Creates a file stream on/of a file.
 *
 * @param filePath path to file
 * @param inputStream whether an input stream or output stream should be created
 */
function createStream(file, createOutputStream) {
    var stream;
    if (createOutputStream) {
        stream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                           .createInstance(Components.interfaces.nsIFileOutputStream);
        stream.init(file,
                    0x02 /* PR_WRONLY */ |
                    0x08 /* PR_CREATE_FILE */ |
                    0x20 /* PR_TRUNCATE */,
                    0700 /* read, write, execute/search by owner */,
                    0 /* unused */);
    } else {
        stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                           .createInstance(Components.interfaces.nsIFileInputStream);
        stream.init(file, 0x01 /* PR_RDONLY */, 0, 0 /* unused */);
    }
    return stream;
}

function readUTF8String(inputStream) {
    var binaryIS = Components.classes["@mozilla.org/binaryinputstream;1"]
                             .createInstance(Components.interfaces.nsIBinaryInputStream);
    binaryIS.setInputStream(inputStream);
    var octetArray = binaryIS.readByteArray(binaryIS.available());
    binaryIS.close();
    // Interpret the byte-array as a UTF8-string, and convert into a
    // javascript string.
    var unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                     .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    // ICS files are always UTF8
    unicodeConverter.charset = "UTF-8";
    return unicodeConverter.convertFromByteArray(octetArray, octetArray.length);
}

function parseIcsString(str) {
    var icsService = Components.classes["@mozilla.org/calendar/ics-service;1"]
                               .getService(Components.interfaces.calIICSService);
    return icsService.parseICS(str, null);
}
function parseIcsFile(file) {
    return parseIcsString(readUTF8String(createStream(file)));
}

function calIntrinsicTimezone(lati, longi, comp) {
    // align with calITimezone w.r.t. tzid, latitude, longitude and component attribute:
    this.latitude = lati;
    this.longitude = longi;
    this.icalComponent = comp;
    this.tzid = comp.getFirstProperty("TZID").value;
}

function hashTimezone(tz) {
    var ret = tz.icalComponent.serializeToICS().split(/\n/);
    ret.sort();
    ret += tz.latitude;
    ret += tz.longitude;
    return ret;
}

function createStatement(db, sql) {
    try {
        var stmt = db.createStatement(sql);
        var wrapper = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
                                .createInstance(Components.interfaces.mozIStorageStatementWrapper);
        wrapper.initialize(stmt);
        return wrapper;
    } catch (exc) {
        throw ("mozStorage exception: createStatement failed, statement: '" + 
               sql + "', error: '" + db.lastErrorString + "' - " + exc);
    }
}

function ask(question, options) {
    for (;;) {
        dump(question);
        var ret = readline();
        if (options) {
            if (ret.length != 1 || options.indexOf(ret) == -1) {
                continue;
            }
        }
        return ret;
    }
}

try {
    if (arguments.length < 3) {
        throw "args: <path-to-zones.tab-file> <moz-root> <build-id>";
    }
    var zonesTabFile = createFile(arguments[0]);
    if (!zonesTabFile.exists()) {
        throw "No zones.tab found!";
    }
    var sqlTzFile = createFile(arguments[1]);
    appendSegmentsToFile(sqlTzFile, ["calendar", "timezones", "timezones.sqlite"]);
    if (!sqlTzFile.exists()) {
        throw "No timezones.sqlite found!";
    }

    // Read out timezone locale props:
    var localeProps = {};
    var bundleFile = createFile(arguments[1]);
    appendSegmentsToFile(bundleFile, ["calendar", "locales", "en-US", "chrome",
                                      "calendar", "timezones.properties"]);
    if (!bundleFile.exists()) {
        throw "No " + bundleFile.path;
    }
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService2);
    var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                  .getService(Components.interfaces.nsIStringBundleService);
    var bundle = bundleService.createBundle(ioService.newFileURI(bundleFile).spec);
    var enumerator = bundle.getSimpleEnumeration();
    while (enumerator.hasMoreElements()) {
        var prop = enumerator.getNext().QueryInterface(Components.interfaces.nsIPropertyElement);
        var name = prop.key;
        if (name.indexOf("pref.timezone.") == 0 &&
            name != "pref.timezone.floating" &&
            name != "pref.timezone.UTC") {
            localeProps[name.substr("pref.timezone.".length).replace(/\./g, "/")] = (name + "=" + prop.value);
        }
    }

    // First read out whole shiny and new Olson set into newSet:
    var newSet = {};

    var zonesTab = createStream(zonesTabFile).QueryInterface(Components.interfaces.nsILineInputStream);
    var zonesTabLine = {};

    print("\n\nChanges needed for " + bundleFile.path + ":\n---");
    while (zonesTab.readLine(zonesTabLine)) {
        var [lati, longi, tzid] = zonesTabLine.value.split(/ /);
        var tzFile = zonesTabFile.parent.clone();
        appendSegmentsToFile(tzFile, (tzid + ".ics").split(/\//));

        var vcalComp = parseIcsFile(tzFile);
        for (var tzComp = vcalComp.getFirstSubcomponent("VTIMEZONE");
             tzComp;
             tzComp = vcalComp.getNextSubcomponent("VTIMEZONE")) {
            var tz = new calIntrinsicTimezone(lati, longi, tzComp);
            newSet[tz.tzid] = tz;

            // We only want the top-notch Olson names to be localized for the UI,
            // every other (attic, preserved, whatever) timezone will be shown by TZID
            // (fallback of calITimezone::displayName) though.
            if (localeProps[tz.tzid]) {
                delete localeProps[tz.tzid];
            } else {
                print("add    pref.timezone." + tz.tzid.replace(/\//g, ".") + "=" + tz.tzid.replace(/_/g, " "));
            }
        }
    }
    print("---\n\n");

    // then read old set:
    var oldSet = {};

    var dbService = Components.classes["@mozilla.org/storage/service;1"]
                              .getService(Components.interfaces.mozIStorageService);
    var db = dbService.openDatabase(sqlTzFile);

    var statement = createStatement(db, "SELECT * FROM tz_data WHERE alias IS NULL");
    try {
        while (statement.step()) {
            var row = statement.row;
            oldSet[row.tzid] = new calIntrinsicTimezone(row.latitude,
                                                        row.longitude,
                                                        parseIcsString("BEGIN:VCALENDAR\r\n" +
                                                                       row.component +
                                                                       "END:VCALENDAR\r\n").getFirstSubcomponent("VTIMEZONE"));
        }
    } finally {
        statement.reset();
    }
    statement = createStatement(db, "SELECT * FROM tz_data WHERE alias IS NOT NULL");
    try {
        while (statement.step()) {
            var row = statement.row;
            oldSet[row.tzid] = oldSet[row.alias];
        }
    } finally {
        statement.reset();
    }

    // now compare new and old, what changed etc:
    for each (var newTz in newSet) { // newSet yet doesn't contain aliases
        var tzid = newTz.tzid;
        var oldTz = oldSet[tzid];
        if (oldTz) {
            // we already have this one, compare:
            if (hashTimezone(newTz) != hashTimezone(oldTz)) {
                print("timezone has been updated: " + tzid);
            }
            delete oldSet[tzid];
        }
    }

    // scan remaining ones in oldSet and decide what to do:
    for (var tzid in oldSet) {
        var oldTz = oldSet[tzid];
        if (tzid != oldTz.tzid) { // is alias
            // check if referred timezone is available in newSet:
            var newTz = newSet[oldTz.tzid];
            if (newTz) { // is available, keep alias:
                newSet[tzid] = newTz;
                continue;
            } // else ask what should be done
        }
        if (ask("timezone: " + tzid + "    [t]ake over as is or use [a]lias? ", "ta") == "a") {
            for (var newTz = null; !newTz;) {
                var newTz = newSet[ask("Please enter tzid that should be aliased with " + tzid + ": ")];
            }
            newSet[tzid] = newTz;
        } else { // takeover old component:
            newSet[tzid] = oldTz;
            delete localeProps[tzid]; // don't remove from locale props
        }
    }

    // rest needs to be removed:
    print("\n\nChanges needed for " + bundleFile.path + ":\n---");
    for each (var p in localeProps) {
        print("remove " + p);
    }
    print("---\n\n");

    // finally write tz db:
    db.executeSimpleSQL("DROP TABLE tz_data");
    db.createTable("tz_data",
                   "tzid      TEXT, " +
                   "alias     TEXT, " +
                   "latitude  TEXT, " +
                   "longitude TEXT, " +
                   "component TEXT");
    statement = createStatement(db,
                                "INSERT INTO tz_data (tzid, alias, latitude, longitude, component) " +
                                "VALUES (:tzid, :alias, :latitude, :longitude, :component)");
    try {
        for (var tzid in newSet) {
            statement.reset();
            var params = statement.params;
            params.tzid = tzid;
            var tz = newSet[tzid];
            if (tzid == tz.tzid) { // no alias
                params.alias = null;
                params.latitude = tz.latitude;
                params.longitude = tz.longitude;
                // libical seems to put an empty line after the inner components of the VTIMEZONE when
                // serializing the vzic'ed VTIMEZONEs to ical.
                // This confuses looking at the timezones.sqlite dump-diff; bug 437418.
                params.component = tz.icalComponent.serializeToICS().replace(/\r\n\r\n/g, "\r\n");
            } else { // alias
                params.alias = tz.tzid;
            }
            statement.execute();
        }
    } finally {
        statement.reset();
    }
    db.executeSimpleSQL("UPDATE tz_version SET version = '" + arguments[2] + "'");

// for future schema upgrades:
//     db.executeSimpleSQL("UPDATE tz_schema_version SET version = 2");

    db.executeSimpleSQL("VACUUM");
    print("\nDONE.");
} catch (exc) {
    print("\n\n### ERROR: " + exc);
    quit(1);
}

