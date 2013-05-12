/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/ical.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

function calIcalProperty(innerObject) {
    this.innerObject = innerObject || new ICAL.Property();
    this.wrappedJSObject = this;
}

const calIcalPropertyInterfaces = [Components.interfaces.calIIcalProperty];
const calIcalPropertyClassID = Components.ID("{423ac3f0-f612-48b3-953f-47f7f8fd705b}");
calIcalProperty.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calIcalPropertyInterfaces),
    classID: calIcalPropertyClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/ical-property;1",
        classDescription: "Wrapper for a libical property",
        classID: calIcalPropertyClassID,
        interfaces: calIcalPropertyInterfaces
    }),

    get icalString() this.innerObject.toICAL() + ICAL.newLineChar,
    get icalProperty() this.innerObject,
    set icalProperty(val) this.innerObject = val,

    get parent() this.innerObject.component,
    toString: function() this.innerObject.toICAL(),

    get value() {
        let type = this.innerObject.type;
        function stringifyValue(x) ICAL.stringify.value(x.toString(), type);
        return this.innerObject.getValues().map(stringifyValue).join(",");
    },
    set value(val) {
        var icalval = ICAL.parse._parseValue(val, this.innerObject.type);
        this.innerObject.setValue(icalval);
        return val;
    },

    get valueAsIcalString() this.value,
    set valueAsIcalString(val) this.value = val,

    get valueAsDatetime() {
        let val = this.innerObject.getFirstValue();
        return (val && val.icalclass == "icaltime" ? new calDateTime(val) : null);
    },
    set valueAsDatetime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.setValue(val);
    }, this),

    get propertyName() this.innerObject.name.toUpperCase(),

    getParameter: function(name) {
        // Unfortuantely getting the "VALUE" parameter won't work, since in
        // jCal it has been translated to the value type id.
        if (name == "VALUE") {
            let propname = this.innerObject.name.toLowerCase();
            if (propname in ICAL.design.property) {
                let details = ICAL.design.property[propname];
                if ('defaultType' in details &&
                    details.defaultType != this.innerObject.type) {
                    // Default type doesn't match object type, so we have a VALUE
                    // parameter
                    return this.innerObject.type.toUpperCase();
                }
            }
        }

        return this.innerObject.getParameter(name.toLowerCase());
    },
    setParameter: function(n, v) {
        // Similar problems for setting the value parameter. Lightning code
        // expects setting the value parameter to just change the value type
        // and attempt to use the previous value as the new one. To do this in
        // ICAL.js we need to save the value, reset the type and then try to
        // set the value again.
        if (n == "VALUE") {
            let type = this.innerObject.type;
            function stringifyValue(x) ICAL.stringify.value(x.toString(), type);
            function reparseValue(x) ICAL.parse._parseValue(stringifyValue(x), v);

            let oldValue;
            let wasMultiValue = this.innerObject.isMultiValue;
            if (wasMultiValue) {
                oldValue = this.innerObject.getValues();
            } else {
                oldValue = [this.innerObject.getFirstValue()];
            }
            this.innerObject.resetType(v.toLowerCase());
            try {
                oldValue = oldValue.map(reparseValue);
            } catch (e) {
                // If there was an error reparsing the value, then just keep it
                // empty.
                oldValue = null;
            }

            if (oldValue) {
                if (wasMultiValue && this.innerObject.isMultiValue) {
                    this.innerObject.setValues(oldValue);
                } else if (oldValue) {
                    this.innerObject.setValue(oldValue.join(","));
                }
            }
        } else {
            this.innerObject.setParameter(n.toLowerCase(), v);
        }
    },
    removeParameter: function(n) {
        // Again, VALUE needs special handling. Removing the value parameter is
        // kind of like resetting it to the default type. So find out the
        // default type and then set the value parameter to it.
        if (n == "VALUE") {
            let propname = this.innerObject.name.toLowerCase();
            if (propname in ICAL.design.property) {
                let details = ICAL.design.property[propname];
                if ('defaultType' in details) {
                    this.setParameter("VALUE", details.defaultType);
                }
            }
        } else {
            this.innerObject.removeParameter(n.toLowerCase());
        }
    },

    clearXParameters: function() {
        cal.WARN("calIICSService::clearXParameters is no longer implemented, " +
                 "please use removeParameter");
    },

    paramIterator: null,
    getFirstParameterName: function() {
        let innerObject = this.innerObject;
        this.paramIterator = (function() {

            let propname = innerObject.name.toLowerCase();
            if (propname in ICAL.design.property) {
                let details = ICAL.design.property[propname];
                if ('defaultType' in details &&
                    details.defaultType != innerObject.type) {
                    // Default type doesn't match object type, so we have a VALUE
                    // parameter
                    yield "VALUE";
                }
            }

            let paramNames = Object.keys(innerObject.jCal[1] || {});
            for each (let name in paramNames) {
                yield name.toUpperCase();
            }
        })();
        return this.getNextParameterName();
    },

    getNextParameterName: function() {
        if (this.paramIterator) {
            try {
                return this.paramIterator.next();
            } catch (e if e instanceof StopIteration) {
                this.paramIterator = null;
                return null;
            }
        } else {
            return this.getFirstParameterName();
        }
    }
};

function calIcalComponent(innerObject) {
    this.innerObject = innerObject || new ICAL.Component();
    this.wrappedJSObject = this;
}

const calIcalComponentInterfaces = [Components.interfaces.calIIcalComponent];
const calIcalComponentClassID = Components.ID("{51ac96fd-1279-4439-a85b-6947b37f4cea}");
calIcalComponent.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calIcalComponentInterfaces),
    classID: calIcalComponentClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/ical-component;1",
        classDescription: "Wrapper for a icaljs component",
        classID: calIcalComponentClassID,
        interfaces: calIcalComponentInterfaces
    }),

    clone: function() new calIcalComponent(new ICAL.Component(this.innerObject.toJSON(), this.innerObject.component)),

    get parent() wrapGetter(calIcalComponent, this.innerObject.parent),

    get icalTimezone() this.innerObject.name == "vtimezone" ? this.innerObject : null,
    get icalComponent() this.innerObject,
    set icalComponent(val) this.innerObject = val,

    componentIterator: null,
    getFirstSubcomponent: function(kind) {
        if (kind == "ANY") {
            kind = null;
        } else if (kind) {
            kind = kind.toLowerCase();
        }
        let innerObject = this.innerObject;
        this.componentIterator = (function() {
            let comps = innerObject.getAllSubcomponents(kind);
            for each (let comp in comps) {
                yield new calIcalComponent(comp);
            }
        })();
        return this.getNextSubcomponent(kind)
    },
    getNextSubcomponent: function(kind) {
        if (this.componentIterator) {
            try {
                return this.componentIterator.next();
            } catch (e if e instanceof StopIteration) {
                this.componentIterator = null;
                return null;
            }
        } else {
            return this.getFirstSubcomponent(kind);
        }
    },

    get componentType() this.innerObject.name.toUpperCase(),

    get uid() this.innerObject.getFirstPropertyValue("uid"),
    set uid(val) this.innerObject.updatePropertyWithValue("uid", val),

    get prodid() this.innerObject.getFirstPropertyValue("prodid"),
    set prodid(val) this.innerObject.updatePropertyWithValue("prodid", val),

    get version() this.innerObject.getFirstPropertyValue("version"),
    set version(val) this.innerObject.updatePropertyWithValue("version", val),

    get method() this.innerObject.getFirstPropertyValue("method"),
    set method(val) this.innerObject.updatePropertyWithValue("method", val),

    get status() this.innerObject.getFirstPropertyValue("status"),
    set status(val) this.innerObject.updatePropertyWithValue("status", val),

    get summary() this.innerObject.getFirstPropertyValue("summary"),
    set summary(val) this.innerObject.updatePropertyWithValue("summary", val),

    get description() this.innerObject.getFirstPropertyValue("description"),
    set description(val) this.innerObject.updatePropertyWithValue("description", val),

    get location() this.innerObject.getFirstPropertyValue("location"),
    set location(val) this.innerObject.updatePropertyWithValue("location", val),

    get categories() this.innerObject.getFirstPropertyValue("categories"),
    set categories(val) this.innerObject.updatePropertyWithValue("categories", val),

    get URL() this.innerObject.getFirstPropertyValue("url"),
    set URL(val) this.innerObject.updatePropertyWithValue("url", val),

    get priority() {
        // If there is no value for this integer property, then we must return
        // the designated INVALID_VALUE.
        const INVALID_VALUE = Components.interfaces.calIIcalComponent.INVALID_VALUE;
        let prop = this.innerObject.getFirstProperty("priority");
        let val = prop ? prop.getFirstValue() : null;
        return (val === null ?  INVALID_VALUE : val);
    },
    set priority(val) this.innerObject.updatePropertyWithValue("priority", val),

    get startTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("dtstart")),
    set startTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("dtstart", val);
    }, this),

    get endTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("dtend")),
    set endTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("dtend", val);
    }, this),

    get duration() wrapGetter(calDuration, this.innerObject.getFirstPropertyValue("duration")),

    get dueTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("due")),
    set dueTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("due", val);
    }, this),

    get stampTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("dtstamp")),
    set stampTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("dtstamp", val);
    }, this),

    get createdTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("created")),
    set createdTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("created", val);
    }, this),

    get completedTime() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("completed")),
    set completedTime(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("completed", val);
    }, this),

    get lastModified() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("last-modified")),
    set lastModified(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("last-modified", val);
    }, this),

    get recurrenceId() wrapGetter(calDateTime, this.innerObject.getFirstPropertyValue("recurrence-id")),
    set recurrenceId(val) unwrapSetter(ICAL.Time, val, function(val) {
        this.innerObject.updatePropertyWithValue("recurrence-id", val);
    }, this),

    serializeToICS: function() this.innerObject.toString() + ICAL.newLineChar,
    toString: function() this.innerObject.toString(),

    addSubcomponent: unwrap(ICAL.Component, function(comp) {
        this.innerObject.addSubcomponent(comp);
    }),

    propertyIterator: null,
    getFirstProperty: function getFirstProperty(kind) {
        if (kind == "ANY") {
            kind = null;
        } else if (kind) {
            kind = kind.toLowerCase();
        }
        let innerObject = this.innerObject;
        this.propertyIterator = (function() {
            let props = innerObject.getAllProperties(kind);
            for each (var prop in props) {
                let hell = prop.getValues();
                if (hell.length > 1) {
                    // Uh oh, multiple property values. Our code expects each as one
                    // property. I hate API incompatibility!
                    for each (var devil in hell) {
                        var thisprop = new ICAL.Property(prop.toJSON(),
                                                         prop.component);
                        thisprop.removeAllValues();
                        thisprop.setValue(devil);
                        yield new calIcalProperty(thisprop);
                    }
                } else {
                    yield new calIcalProperty(prop);
                }
            }
        })();

        return this.getNextProperty(kind);
    },

    getNextProperty: function getNextProperty(kind) {
        if (this.propertyIterator) {
            try {
                return this.propertyIterator.next();
            } catch (e if e instanceof StopIteration) {
                this.propertyIterator = null;
                return null;
            }
        } else {
            return this.getFirstProperty(kind);
        }
    },

    addProperty: unwrap(ICAL.Property, function(prop) this.innerObject.addProperty(prop)),

    addTimezoneReference: function(tz) {
        // This doesn't quite fit in with ical.js at the moment. ical.js should
        // be able to figure this out internally.
    },

    getReferencedTimezones: function(aCount) {
        // This doesn't quite fit in with ical.js at the moment. ical.js should
        // be able to figure this out internally.
    },

    serializeToICSStream: function() {
        let sstream = Components.classes["@mozilla.org/io/string-input-stream;1"]
                                .createInstance(Components.interfaces.nsIStringInputStream);
        let data = this.innerObject.toString();
        sstream.setData(data, data.length);
        return sstream;

    }
};

function calICSService() {
    this.wrappedJSObject = this;
}

const calICSServiceInterfaces = [Components.interfaces.calIICSService];
const calICSServiceClassID = Components.ID("{c61cb903-4408-41b3-bc22-da0b27efdfe1}");
calICSService.prototype = {
    QueryInterface: XPCOMUtils.generateQI(calICSServiceInterfaces),
    classID: calICSServiceClassID,
    classInfo: XPCOMUtils.generateCI({
        contractID: "@mozilla.org/calendar/ics-service;1",
        classDescription: "ICS component and property service",
        classID: calICSServiceClassID,
        interfaces: [Components.interfaces.calIICSService]
    }),

    parseICS: function parseICS(serialized, tzProvider) {
        // TODO ical.js doesn't support tz providers, but this is usually null
        // or our timezone service anyway.
        let comp = ICAL.parse(serialized);
        return new calIcalComponent(new ICAL.Component(comp[1]));
    },

    parseICSAsync: function parseICSAsync(serialized, tzProvider, listener) {
        // There are way too many error checking messages here, but I had so
        // much pain with this method that I don't want it to break again.
        try {
            let worker = new ChromeWorker("resource://calendar/calendar-js/calICSService-worker.js");
            worker.onmessage = function(event) {
                let rc = Components.results.NS_ERROR_FAILURE;
                let icalComp = null;
                try {
                    rc = event.data.rc;
                    icalComp = new calIcalComponent(new ICAL.Component(event.data.data[1]));
                    if (!Components.isSuccessCode(rc)) {
                        cal.ERROR("[calICSService] Error in parser worker: " + data);
                    }
                } catch (e) {
                    cal.ERROR("[calICSService] Exception parsing item: " + e);
                }

                listener.onParsingComplete(rc, icalComp);
            };
            worker.onerror = function(event) {
                cal.ERROR("[calICSService] Error in parser worker: " + event.message);
                listener.onParsingComplete(Components.results.NS_ERROR_FAILURE, null);
            };
            worker.postMessage(serialized);
        } catch (e) {
            // If an error occurs above, the calling code will hang. Catch the exception just in case
            cal.ERROR("[calICSService] Error starting parsing worker: " + e);
            listener.onParsingComplete(Components.results.NS_ERROR_FAILURE, null);
        }
    },

    createIcalComponent: function createIcalComponent(kind) {
        return new calIcalComponent(new ICAL.Component(kind.toLowerCase()));
    },

    createIcalProperty: function createIcalProperty(kind) {
        return new calIcalProperty(new ICAL.Property(kind.toLowerCase()));
    },

    createIcalPropertyFromString: function(str) {
        if (!str.endsWith(ICAL.newLineChar)) {
            str += ICAL.newLineChar;
        }
        let data = ICAL.parse("BEGIN:VCALENDAR\r\n" + str + "END:VCALENDAR");
        let comp = new ICAL.Component(data[1]);
        return new calIcalProperty(comp.getFirstProperty());
    }
};
