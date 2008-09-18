/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
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

//
// calTodo.js
//

//
// constructor
//
function calTodo() {
    this.initItemBase();

    this.todoPromotedProps = {
        "DTSTART": true,
        "DTEND": true,
        "DTSTAMP": true,
        "DUE": true,
        "COMPLETED": true,
        __proto__: this.itemBasePromotedProps
    };
}

var calTodoClassInfo = {
    getInterfaces: function (count) {
        var ifaces = [
            Components.interfaces.nsISupports,
            Components.interfaces.calIItemBase,
            Components.interfaces.calITodo,
            Components.interfaces.calIInternalShallowCopy,
            Components.interfaces.nsIClassInfo
        ];
        count.value = ifaces.length;
        return ifaces;
    },

    getHelperForLanguage: function (language) {
        return null;
    },

    contractID: "@mozilla.org/calendar/todo;1",
    classDescription: "Calendar Todo",
    classID: Components.ID("{7af51168-6abe-4a31-984d-6f8a3989212d}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0
};

calTodo.prototype = {
    __proto__: calItemBase.prototype,

    QueryInterface: function (aIID) {
        return doQueryInterface(this, calEvent.prototype, aIID, null, calTodoClassInfo);
    },

    cloneShallow: function (aNewParent) {
        var m = new calTodo();
        this.cloneItemBaseInto(m, aNewParent);

        return m;
    },

    createProxy: function () {
        if (this.mIsProxy) {
            calDebug("Tried to create a proxy for an existing proxy!\n");
            throw Components.results.NS_ERROR_UNEXPECTED;
        }

        var m = new calTodo();
        m.initializeProxy(this);

        return m;
    },

    makeImmutable: function () {
        this.makeItemBaseImmutable();
    },

    get isCompleted() {
        return this.completedDate != null ||
               this.percentComplete == 100 ||
               this.status == "COMPLETED";
    },
    
    set isCompleted(v) {
        if (v) {
            if (!this.completedDate)
                this.completedDate = jsDateToDateTime(new Date());
            this.status = "COMPLETED";
            this.percentComplete = 100;
        } else {
            this.deleteProperty("COMPLETED");
            this.deleteProperty("STATUS");
            this.deleteProperty("PERCENT-COMPLETE");
        }
    },

    get duration() {
        if (!this.entryDate)
            return null;
        if (!this.dueDate)
            return null;
        return this.dueDate.subtractDate(this.entryDate);
    },

    get recurrenceStartDate() {
        // DTSTART is optional for VTODOs, so it's unclear if RRULE is allowed then,
        // so fallback to DUE if no DTSTART is present:
        return this.entryDate || this.dueDate;
    },

    icsEventPropMap: [
    { cal: "DTSTART", ics: "startTime" },
    { cal: "DUE", ics: "dueTime" },
    { cal: "COMPLETED", ics: "completedTime" }],

    set icalString(value) {
        this.icalComponent = getIcsService().parseICS(value, null);
    },

    get icalString() {
        var calcomp = getIcsService().createIcalComponent("VCALENDAR");
        calSetProdidVersion(calcomp);
        calcomp.addSubcomponent(this.icalComponent);
        return calcomp.serializeToICS();
    },

    get icalComponent() {
        var icssvc = getIcsService();
        var icalcomp = icssvc.createIcalComponent("VTODO");
        this.fillIcalComponentFromBase(icalcomp);
        this.mapPropsToICS(icalcomp, this.icsEventPropMap);

        var bagenum = this.propertyEnumerator;
        while (bagenum.hasMoreElements()) {
            var iprop = bagenum.getNext().
                QueryInterface(Components.interfaces.nsIProperty);
            try {
                if (!this.todoPromotedProps[iprop.name]) {
                    var icalprop = icssvc.createIcalProperty(iprop.name);
                    icalprop.value = iprop.value;
                    var propBucket = this.mPropertyParams[iprop.name]
                    if (propBucket) {
                        for (paramName in propBucket) {
                            icalprop.setParameter(paramName,
                                                  propBucket[paramName]);
                        }
                    }
                    icalcomp.addProperty(icalprop);
                }
            } catch (e) {
                // dump("failed to set " + iprop.name + " to " + iprop.value +
                // ": " + e + "\n");
            }
        }
        return icalcomp;
    },

    todoPromotedProps: null,

    set icalComponent(todo) {
        this.modify();
        if (todo.componentType != "VTODO") {
            todo = todo.getFirstSubcomponent("VTODO");
            if (!todo)
                throw Components.results.NS_ERROR_INVALID_ARG;
        }

        this.setItemBaseFromICS(todo);
        this.mapPropsFromICS(todo, this.icsEventPropMap);
        this.mIsAllDay = this.mStartDate && this.mStartDate.isDate;

        this.importUnpromotedProperties(todo, this.todoPromotedProps);
        // Importing didn't really change anything
        this.mDirty = false;
    },

    isPropertyPromoted: function (name) {
        return (this.todoPromotedProps[name]);
    },

    set entryDate(value) {
        this.modify();
        
        // We're about to change the start date of an item which probably
        // could break the associated calIRecurrenceInfo. We're calling
        // the appropriate method here to adjust the internal structure in
        // order to free clients from worrying about such details.
        if (this.parentItem == this) {
            var rec = this.recurrenceInfo;
            if (rec) {
                rec.onStartDateChange(value,this.entryDate);
            }
        }

        this.setProperty("DTSTART", value);
    },

    get entryDate() {
        return this.getProperty("DTSTART");
    },

    mDueDate: undefined,
    get dueDate() {
        var dueDate = this.mDueDate;
        if (dueDate === undefined) {
            dueDate = this.getProperty("DUE");
            if (!dueDate) {
                var entryDate = this.entryDate;
                var dur = this.getProperty("DURATION");
                if (entryDate && dur) {
                    // If there is a duration set on the todo, calculate the right end time.
                    dueDate = entryDate.clone();
                    var icalDur = Components.classes["@mozilla.org/calendar/duration;1"]
                                            .createInstance(Components.interfaces.calIDuration);
                    icalDur.icalString = dur;
                    dueDate.addDuration(icalDur);
                }
            }
            this.mDueDate = dueDate;
        }
        return dueDate;
    },

    set dueDate(value) {
        this.deleteProperty("DURATION"); // setting dueDate once removes DURATION
        this.setProperty("DUE", value);
        return (this.mDueDate = value);
    }
};

// var decl to prevent spurious error messages when loaded as component

var makeMemberAttr;
if (makeMemberAttr) {
    makeMemberAttr(calTodo, "COMPLETED", null, "completedDate", true);
    makeMemberAttr(calTodo, "PERCENT-COMPLETE", 0, "percentComplete", true);
}
