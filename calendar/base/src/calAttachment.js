/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

//
// calAttachment.js
//
function calAttachment() {
    this.wrappedJSObject = this;
    this.mProperties = new cal.calPropertyBag();
}

const calAttachmentClassID = Components.ID("{5f76b352-ab75-4c2b-82c9-9206dbbf8571}");
const calAttachmentInterfaces = [Components.interfaces.calIAttachment];
calAttachment.prototype = {
    mData: null,
    mHashId: null,

    classID: calAttachmentClassID,
    QueryInterface: XPCOMUtils.generateQI(calAttachmentInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calAttachmentClassID,
        contractID: "@mozilla.org/calendar/attachment;1",
        classDescription: "Calendar Item Attachment",
        interfaces: calAttachmentInterfaces
    }),

    get hashId() {
        if (!this.mHashId) {
            let ch = Components.classes["@mozilla.org/security/hash;1"]
                               .createInstance(Components.interfaces.nsICryptoHash);

            let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
                                      .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
            converter.charset = "UTF-8";
            let data = converter.convertToByteArray(this.rawData, {});

            ch.init(ch.MD5);
            ch.update(data, data.length);
            this.mHashId = ch.finish(true);
        }
        return this.mHashId;
    },

    /**
     * calIAttachment
     */

    get uri() {
        let uri = null;
        if (this.getParameter("VALUE") != "BINARY") {
            // If this is not binary data, its likely an uri. Attempt to convert
            // and throw otherwise.
            try {
                uri = makeURL(this.mData);
            } catch (e) {
                // Its possible that the uri contains malformed data. Often
                // callers don't expect an exception here, so we just catch
                // it and return null.
            }
        }

        return uri;
    },
    set uri(aUri) {
        // An uri is the default format, remove any value type parameters
        this.deleteParameter("VALUE");
        this.setData(aUri.spec);
        return aUri;
    },

    get rawData() {
        return this.mData;
    },
    set rawData(aData) {
        // Setting the raw data lets us assume this is binary data. Make sure
        // the value parameter is set
        this.setParameter("VALUE", "BINARY");
        return this.setData(aData);
    },

    get formatType() {
        return this.getParameter("FMTTYPE");
    },
    set formatType(aType) {
        return this.setParameter("FMTTYPE", aType);
    },

    get encoding() {
        return this.getParameter("ENCODING");
    },
    set encoding(aValue) {
        return this.setParameter("ENCODING", aValue);
    },

    get icalProperty() {
        let icalatt = cal.getIcsService().createIcalProperty("ATTACH");

        for each (let [key, value] in this.mProperties) {
            try {
                icalatt.setParameter(key, value);
            } catch (e if e.result == Components.results.NS_ERROR_ILLEGAL_VALUE) {
                // Illegal values should be ignored, but we could log them if
                // the user has enabled logging.
                cal.LOG("Warning: Invalid attachment parameter value " + key + "=" + value);
            }
        }

        if (this.mData) {
            icalatt.value = this.mData;
        }
        return icalatt;
    },

    set icalProperty(attProp) {
        // Reset the property bag for the parameters, it will be re-initialized
        // from the ical property.
        this.mProperties = new cal.calPropertyBag();
        this.setData(attProp.value);

        for each (let [name, value] in cal.ical.paramIterator(attProp)) {
            this.setParameter(name, value);
        }
    },

    get icalString() {
        let comp = this.icalProperty;
        return (comp ? comp.icalString : "");
    },
    set icalString(val) {
        let prop = cal.getIcsService().createIcalPropertyFromString(val);
        if (prop.propertyName != "ATTACH") {
            throw Components.results.NS_ERROR_ILLEGAL_VALUE;
        }
        this.icalProperty = prop;
        return val;
    },

    getParameter: function (aName) {
        return this.mProperties.getProperty(aName);
    },

    setParameter: function (aName, aValue) {
        if (aValue || aValue === 0) {
            return this.mProperties.setProperty(aName, aValue);
        } else {
            return this.mProperties.deleteProperty(aName);
        }
    },

    deleteParameter: function (aName) {
        this.mProperties.deleteProperty(aName);
    },

    clone: function cA_clone() {
        let newAttachment = new calAttachment();
        newAttachment.mData = this.mData;
        newAttachment.mHashId = this.mHashId;
        for each (let [name, value] in this.mProperties) {
            newAttachment.mProperties.setProperty(name, value);
        }
        return newAttachment;
    },

    setData: function setData(aData) {
        // Sets the data and invalidates the hash so it will be recalculated
        this.mHashId = null;
        this.mData = aData;
        return this.mData;
    }
};
