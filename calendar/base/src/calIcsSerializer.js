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
 *   Michiel van Leeuwen <mvl@exedo.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");

function calIcsSerializer() {
    this.wrappedJSObject = this;
    this.mItems = [];
    this.mProperties = [];
    this.mComponents = [];
}

calIcsSerializer.prototype = {
    // nsIClassInfo:
    classID: Components.ID("{207a6682-8ff1-4203-9160-729ec28c8766}"),
    contractID: "@mozilla.org/calendar/ics-serializer;1",
    classDescription: "Calendar ICS Serializer",

    getInterfaces: function getInterfaces(count) {
        const ifaces = [Components.interfaces.calIIcsSerializer,
                        Components.interfaces.nsIClassInfo,
                        Components.interfaces.nsISupports];
        count.value = ifaces.length;
        return ifaces;
    },
    getHelperForLanguage: function getHelperForLanguage(language) {
        return null;
    },
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    QueryInterface: function QueryInterface(aIID) {
        return doQueryInterface(this, calIcsSerializer.prototype, aIID, null, this);
    },

    addItems: function is_addItems(aItems, aCount) {
        if (aCount > 0) {
            this.mItems = this.mItems.concat(aItems);
        }
    },

    addProperty: function is_addProperty(aProperty) {
       this.mProperties.push(aProperty);
    },

    addComponent: function is_addComponent(aComponent) {
       this.mComponents.push(aComponent);
    },

    serializeToString: function is_serializeToString() {
        let calComp = this.getIcalComponent();
        return calComp.serializeToICS();
    },

    serializeToInputStream: function is_serializeToStream(aStream) {
        let calComp = this.getIcalComponent();
        return calComp.serializeToICSStream();
    },

    serializeToStream: function is_serializeToStream(aStream) {
        let str = this.serializeToString();

        // Convert the javascript string to an array of bytes, using the
        // UTF8 encoder
        let convStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                                   .createInstance(Components.interfaces.nsIConverterOutputStream);
        convStream.init(aStream, 'UTF-8', 0, 0x0000);

        convStream.writeString(str);
        convStream.close();
    },

    getIcalComponent: function is_getIcalComponent() {
        let calComp = getIcsService().createIcalComponent("VCALENDAR");
        calSetProdidVersion(calComp);

        // xxx todo: think about that the below code doesn't clone the properties/components,
        //           thus ownership is moved to returned VCALENDAR...

        for each (let prop in this.mProperties) {
            calComp.addProperty(prop);
        }
        for each (let comp in this.mComponents) {
            calComp.addSubcomponent(comp);
        }

        for (let item in cal.itemIterator(this.mItems)) {
            calComp.addSubcomponent(item.icalComponent);
        }

        return calComp;
    }
};
