/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/ical.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function calPeriod(innerObject) {
    this.innerObject = innerObject || new ICAL.Period({});
    this.wrappedJSObject = this;
}

const calPeriodInterfaces = [Components.interfaces.calIPeriod];
const calPeriodClassID = Components.ID("{394a281f-7299-45f7-8b1f-cce21258972f}");
calPeriod.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calPeriodInterfaces),
    classID: calPeriodClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/period;1",
        classDescription: "A period between two dates",
        classID: calPeriodClassID,
        interfaces: calPeriodInterfaces
    }),

    isMutable: true,
    innerObject: null,

    get icalPeriod() this.innerObject,
    set icalPeriod(val) this.innerObject = val,

    makeImmutable: function() this.isMutable = false,
    clone: function() new calPeriod(ICAL.Period.fromData(this.innerObject)),

    get start() wrapGetter(calDateTime, this.innerObject.start),
    set start(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.start = val;
    }, this),

    get end() wrapGetter(calDateTime, this.innerObject.getEnd()),
    set end(val) unwrapSetter(ICAL.Time, val, function(val) {
        if (this.innerObject.duration) {
            this.innerObject.duration = null;
        }
        this.innerObject.end = val;
    }, this),

    get duration() wrapGetter(calDuration, this.innerObject.getDuration()),

    get icalString() this.innerObject.toICALString(),
    set icalString(val) {
        let str = ICAL.parse._parseValue(val, "period");
        this.innerObject = ICAL.Period.fromString(str);
        return val;
    },

    toString: function() this.innerObject.toString()
};
