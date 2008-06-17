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
 * Portions created by the Initial Developer are Copyright (C) 2008
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

var g_stringBundle = null;

function calIntrinsicTimezone(tzid, component, latitude, longitude) {
    this.wrappedJSObject = this;
    this.tzid = tzid;
    this.mComponent = component;
    this.isUTC = false;
    this.isFloating = false;
    this.latitude = latitude;
    this.longitude = longitude;
}
calIntrinsicTimezone.prototype = {
    toString: function calIntrinsicTimezone_toString() {
        return (this.component ? this.component.toString() : this.tzid);
    },

    get icalComponent calIntrinsicTimezone_get_icalcomponent() {
        var comp = this.mComponent;
        if (comp && (typeof(comp) == "string")) {
            this.mComponent = getIcsService().parseICS("BEGIN:VCALENDAR\r\n" + comp + "END:VCALENDAR\r\n", null)
                                             .getFirstSubcomponent("VTIMEZONE");
        }
        return this.mComponent;
    },

    get displayName calIntrinsicTimezone_get_displayName() {
        if (this.mDisplayName === undefined) {
            try {
                this.mDisplayName = g_stringBundle.GetStringFromName("pref.timezone." + this.tzid.replace(/\//g, "."));
            } catch (exc) {
                ASSERT(false, exc);
                this.mDisplayName = null;
            }
        }
        return this.mDisplayName;
    },

    get provider calIntrinsicTimezone_get_provider() {
        return getTimezoneService();
    }
};

function calStringEnumerator(stringArray) {
    this.mIndex = 0;
    this.mStringArray = stringArray;
}
calStringEnumerator.prototype = {
    // nsIUTF8StringEnumerator:
    hasMore: function calStringEnumerator_hasMore() {
        return (this.mIndex < this.mStringArray.length);
    },
    getNext: function calStringEnumerator_getNext() {
        if (!this.hasMore()) {
            throw Components.results.NS_ERROR_UNEXPECTED;
        }
        return this.mStringArray[this.mIndex++];
    }
};

function calTimezoneService() {
    this.wrappedJSObject = this;

    // floating
    this.floating = new calIntrinsicTimezone("floating", null, "", "");
    this.floating.isFloating = true;
    // UTC
    this.UTC = new calIntrinsicTimezone("UTC", null, "", "");
    this.UTC.isUTC = true;

    this.mTimezoneCache = {};
    this.mBlacklist = {};
    this.mTimezoneCache.floating = this.floating;
    this.mTimezoneCache.UTC = this.UTC;
    this.mTimezoneCache.utc = this.UTC;
}
calTimezoneService.prototype = {
    createStatement: function calTimezoneService_createStatement(sql) {
        var statement = this.mDb.createStatement(sql);
        var ret = Components.classes["@mozilla.org/storage/statement-wrapper;1"]
                            .createInstance(Components.interfaces.mozIStorageStatementWrapper);
        ret.initialize(statement);
        return ret;
    },

    ensureInitialized: function calTimezoneService_ensureInitialized() {
        if (!this.mDb) {
            // Calendar-timezones.xpi is preinstalled into the application, but
            // lightning.xpi yet doesn't contain the calendar-timezones.xpi, thus we package up
            // the timezones.sqlite as well as the timezones.properties into lightning for now.

            const kCalendarTimezonesXpiId = "calendar-timezones@mozilla.org";
            var sqlTzFile;
            var bundleURL;

            try {
                var extMgr = Components.classes["@mozilla.org/extensions/manager;1"]
                                       .getService(Components.interfaces.nsIExtensionManager);
                sqlTzFile = extMgr.getInstallLocation(kCalendarTimezonesXpiId).getItemLocation(kCalendarTimezonesXpiId);
                bundleURL = "chrome://calendar-timezones/locale/timezones.properties";
            } catch (exc) {
                try {
                    if (!isSunbird()) { // probe for lightning; xxx todo, this will vanish when we repackage lightning
                        const kLightningXpiId = "{e2fda1a4-762b-4020-b5ad-a41df1933103}";
                        sqlTzFile = extMgr.getInstallLocation(kLightningXpiId).getItemLocation(kLightningXpiId);
                        bundleURL = "chrome://lightning/locale/timezones.properties";
                    }
                } catch (exc) { // we land here in case of the unit tests:
                    var dirSvc = Components.classes["@mozilla.org/file/directory_service;1"]
                                           .getService(Components.interfaces.nsIProperties);
                    sqlTzFile = dirSvc.get("CurProcD", Components.interfaces.nsILocalFile);
                    sqlTzFile.append("extensions");
                    sqlTzFile.append(kCalendarTimezonesXpiId);
                    WARN("\### USING " + sqlTzFile.path);
                    var bundleFile = sqlTzFile.clone();
                    bundleFile.append("chrome");
                    bundleFile.append("calendar-timezones-en-US.jar");
                    bundleURL = "jar:" + getIOService().newFileURI(bundleFile).spec + "!/locale/en-US/timezones.properties";
                }
            }

            try {
                sqlTzFile.append("timezones.sqlite");
                LOG("using " + sqlTzFile.path);
                var dbService = Components.classes["@mozilla.org/storage/service;1"]
                                          .getService(Components.interfaces.mozIStorageService);
                this.mDb = dbService.openDatabase(sqlTzFile);
                this.mSelectByTzid = this.createStatement("SELECT * FROM tz_data WHERE tzid = :tzid LIMIT 1");

                var selectVersion = this.createStatement("SELECT version FROM tz_version LIMIT 1");
                try {
                    if (selectVersion.step()) {
                        this.mVersion = selectVersion.row.version;
                    }
                } finally {
                    selectVersion.reset();
                }
                LOG("timezones version: " + this.mVersion);

                g_stringBundle = calGetStringBundle(bundleURL);
            } catch (exc) {
                var msg = calGetString("calendar", "missingCalendarTimezonesError");
                Components.utils.reportError(msg);
                showError(msg);
            }
        }
    },

    // nsIClassInfo:
    getInterfaces: function calTimezoneService_getInterfaces(count) {
        const ifaces = [Components.interfaces.calITimezoneService,
                        Components.interfaces.calITimezoneProvider,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    classDescription: "Calendar Timezone Service",
    contractID: "@mozilla.org/calendar/timezone-service;1",
    classID: Components.ID("{1a23ace4-a0dd-43b4-96a8-b3cd419a14a5}"),
    getHelperForLanguage: function calTimezoneService_getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: Components.interfaces.nsIClassInfo.SINGLETON,

    QueryInterface: function calTimezoneService_QueryInterface(aIID) {
        return doQueryInterface(this, calTimezoneService.prototype, aIID, null, this);
    },

    // calITimezoneProvider:
    getTimezone: function calTimezoneService_getTimezone(tzid) {
        if (tzid.indexOf("/mozilla.org/") == 0) {
            // We know that our former tzids look like "/mozilla.org/<dtstamp>/continent/..."
            // The ending of the mozilla prefix is the index of that slash before the
            // continent. Therefore, we start looking for the prefix-ending slash
            // after position 13.
            tzid = tzid.substring(tzid.indexOf("/", 13) + 1);
        }

        var tz = this.mTimezoneCache[tzid];
        if (!tz && !this.mBlacklist[tzid]) {
            this.ensureInitialized();
            this.mSelectByTzid.params.tzid = tzid;
            if (this.mSelectByTzid.step()) {
                var row = this.mSelectByTzid.row;
                var alias = row.alias;
                if (alias && alias.length > 0) {
                    tz = this.getTimezone(alias); // resolve
                } else {
                    tz = new calIntrinsicTimezone(row.tzid, row.component, row.latitude, row.longitude);
                }
            }
            this.mSelectByTzid.reset();
            if (tz) {
                this.mTimezoneCache[tzid] = tz;
            } else {
                this.mBlacklist[tzid] = true;
            }
        }
        return tz;
    },

    get timezoneIds calTimezoneService_get_timezoneIds() {
        if (!this.mTzids) {
            var tzids = [];
            this.ensureInitialized();
            var selectAllButAlias = this.createStatement("SELECT * FROM tz_data WHERE alias IS NULL");
            try {
                while (selectAllButAlias.step()) {
                    tzids.push(selectAllButAlias.row.tzid);
                }
            } finally {
                selectAllButAlias.reset();
            }
            this.mTzids = tzids;
        }
        return new calStringEnumerator(this.mTzids);
    },

    get version calTimezoneService_get_version() {
        this.ensureInitialized();
        return this.mVersion;
    }
};
