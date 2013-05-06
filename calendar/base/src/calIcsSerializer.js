/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");

function calIcsSerializer() {
    this.wrappedJSObject = this;
    this.mItems = [];
    this.mProperties = [];
    this.mComponents = [];
}
const calIcsSerializerClassID = Components.ID("{207a6682-8ff1-4203-9160-729ec28c8766}");
const calIcsSerializerInterfaces = [Components.interfaces.calIIcsSerializer];
calIcsSerializer.prototype = {
    classID: calIcsSerializerClassID,
    QueryInterface: XPCOMUtils.generateQI(calIcsSerializerInterfaces),
    classInfo: XPCOMUtils.generateCI({
        classID: calIcsSerializerClassID,
        contractID: "@mozilla.org/calendar/ics-serializer;1",
        classDescription: "Calendar ICS Serializer",
        interfaces: calIcsSerializerInterfaces,
    }),

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
