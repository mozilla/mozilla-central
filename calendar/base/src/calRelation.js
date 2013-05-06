/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * calRelation prototype definition
 *
 * @implements calIRelation
 * @constructor
 */
function calRelation() {
    this.wrappedJSObject = this;
    this.mProperties = new calPropertyBag();
}
const calRelationClassID = Components.ID("{76810fae-abad-4019-917a-08e95d5bbd68}");
const calRelationInterfaces = [Components.interfaces.calIRelation];
calRelation.prototype = {
    mType: null,
    mId: null,

    classID: calRelationClassID,
    QueryInterface: XPCOMUtils.generateQI(calRelationInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calRelationClassID,
        contractID: "@mozilla.org/calendar/relation;1",
        classDescription: "Calendar Item Relation",
        interfaces: calRelationInterfaces
    }),

    /**
     * @see calIRelation
     */

    get relType() {
        return this.mType;
    },
    set relType(aType) {
        return (this.mType = aType);
    },

    get relId() {
        return this.mId;
    },
    set relId(aRelId) {
        return (this.mId = aRelId);
    },

    get icalProperty() {
        let icssvc = getIcsService();
        let icalatt = icssvc.createIcalProperty("RELATED-TO");
        if (this.mId) {
            icalatt.value = this.mId;
        }

        if (this.mType) {
            icalatt.setParameter("RELTYPE", this.mType);
        }

        for each (let [key, value] in this.mProperties) {
            try {
                icalatt.setParameter(key, value);
            } catch (e if e.result == Components.results.NS_ERROR_ILLEGAL_VALUE) {
                // Illegal values should be ignored, but we could log them if
                // the user has enabled logging.
                cal.LOG("Warning: Invalid relation property value " + key + "=" + value);
            }
        }
        return icalatt;
    },

    set icalProperty(attProp) {
        // Reset the property bag for the parameters, it will be re-initialized
        // from the ical property.
        this.mProperties = new calPropertyBag();

        if (attProp.value) {
            this.mId = attProp.value;
        }
        for each (let [name, value] in cal.ical.paramIterator(attProp)) {
            if (name == "RELTYPE") {
                this.mType = value;
                continue;
            }

            this.setParameter(name, value);
        }
    },

    get icalString() {
        let comp = this.icalProperty;
        return (comp ? comp.icalString : "");
    },
    set icalString(val) {
        let prop = cal.getIcsService().createIcalPropertyFromString(val);
        if (prop.propertyName != "RELATED-TO") {
            throw Components.results.NS_ERROR_ILLEGAL_VALUE;
        }
        this.icalProperty = prop;
        return val;
    },

    getParameter: function (aName) {
        return this.mProperties.getProperty(aName);
    },

    setParameter: function (aName, aValue) {
        return this.mProperties.setProperty(aName, aValue);
    },

    deleteParameter: function (aName) {
        return this.mProperties.deleteProperty(aName);
    },

    clone: function cR_clone() {
        let newRelation = new calRelation();
        newRelation.mId = this.mId;
        newRelation.mType = this.mType;
        for each (let [name, value] in this.mProperties) {
            newRelation.mProperties.setProperty(name, value);
        }
        return newRelation;
    }
};
