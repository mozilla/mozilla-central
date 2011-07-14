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
 * The Original Code is Oracle Corporation code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Stuart Parmenter <pavlov@pavlov.net>
 *   Joey Minta <jminta@gmail.com>
 *   Fred Jendrzejewski <fred.jen@web.de>
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
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");

//
// calAttachment.js
//
function calAttachment() {
    this.wrappedJSObject = this;
    this.mProperties = new cal.calPropertyBag();
}

calAttachment.prototype = {
    mData: null,
    mHashId: null,

    QueryInterface: function (aIID) {
        return cal.doQueryInterface(this,
                                    calAttachment.prototype,
                                    aIID,
                                    null,
                                    this);
    },

    /**
     * nsIClassInfo
     */

    getInterfaces: function cA_getInterfaces(aCount) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIAttachment,
            Components.interfaces.nsIClassInfo
        ];
        aCount.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function cA_getHelperForLanguage(language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/attachment;1",
    classDescription: "Calendar Item Attachment",
    classID: Components.ID("{5f76b352-ab75-4c2b-82c9-9206dbbf8571}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,


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
        var icssvc = getIcsService();
        var icalatt = icssvc.createIcalProperty("ATTACH");

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

    getParameter: function (aName) {
        return this.mProperties.getProperty(aName);
    },

    setParameter: function (aName, aValue) {
        return this.mProperties.setProperty(aName, aValue);
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
