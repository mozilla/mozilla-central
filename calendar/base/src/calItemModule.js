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
 *   Mike Shaver <shaver@off.net>
 *   Matthew Willis <lilmatt@mozilla.com>
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

/* Update these in calBaseCID.h */
const componentData =
    [
     /* calItemBase and calUtils must be first: later scripts depend on them */
    {cid: null,
     contractid: null,
     script: "calItemBase.js",
     constructor: null},

    {cid: null,
     contractid: null,
     script: "calUtils.js",
     constructor: null},

    {cid: null,
     contractid: null,
     script: "calCachedCalendar.js",
     constructor: null},

    {cid: Components.ID("{f42585e7-e736-4600-985d-9624c1c51992}"),
     contractid: "@mozilla.org/calendar/manager;1",
     script: "calCalendarManager.js",
     constructor: "calCalendarManager",
     service: true},

    {cid: Components.ID("{b8db7c7f-c168-4e11-becb-f26c1c4f5f8f}"),
     contractid: "@mozilla.org/calendar/alarm;1",
     script: "calAlarm.js",
     constructor: "calAlarm"},

    {cid: Components.ID("{7a9200dd-6a64-4fff-a798-c5802186e2cc}"),
     contractid: "@mozilla.org/calendar/alarm-service;1",
     script: "calAlarmService.js",
     constructor: "calAlarmService",
     categories: {"app-startup": "alarm-service-startup"},
     service: true},

    {cid: Components.ID("{29C56CD5-D36E-453a-ACDE-0083BD4FE6D3}"),
     contractid: "@mozilla.org/calendar/freebusy-service;1",
     script: "calFreeBusyService.js",
     constructor: "calFreeBusyService",
     service: true},

    {cid: Components.ID("{F5F743CD-8997-428e-BC1B-644E73F61203}"),
     contractid: "@mozilla.org/calendar/calendarsearch-service;1",
     script: "calCalendarSearchService.js",
     constructor: "calCalendarSearchService",
     service: true},

    {cid: Components.ID("{4b7ae030-ed79-11d9-8cd6-0800200c9a66}"),
     contractid: "@mozilla.org/calendar/alarm-monitor;1",
     script: "calAlarmMonitor.js",
     constructor: "calAlarmMonitor",
     service: true,
     categories: {"alarm-service-startup": "calendar-alarm-monitor",
                  "alarm-service-shutdown": "calendar-alarm-monitor"}},

    {cid: Components.ID("{974339d5-ab86-4491-aaaf-2b2ca177c12b}"),
     contractid: "@mozilla.org/calendar/event;1",
     script: "calEvent.js",
     constructor: "calEvent"},

    {cid: Components.ID("{7af51168-6abe-4a31-984d-6f8a3989212d}"),
     contractid: "@mozilla.org/calendar/todo;1",
     script: "calTodo.js",
     constructor: "calTodo"},

    {cid: Components.ID("{5c8dcaa3-170c-4a73-8142-d531156f664d}"),
     contractid: "@mozilla.org/calendar/attendee;1",
     script: "calAttendee.js",
     constructor: "calAttendee"},

    {cid: Components.ID("{5f76b352-ab75-4c2b-82c9-9206dbbf8571}"),
     contractid: "@mozilla.org/calendar/attachment;1",
     script: "calAttachment.js",
     constructor: "calAttachment"},

    {cid: Components.ID("{04027036-5884-4a30-b4af-f2cad79f6edf}"),
     contractid: "@mozilla.org/calendar/recurrence-info;1",
     script: "calRecurrenceInfo.js",
     constructor: "calRecurrenceInfo"},

    {cid: Components.ID("{76810fae-abad-4019-917a-08e95d5bbd68}"),
     contractid: "@mozilla.org/calendar/relation;1",
     script: "calRelation.js",
     constructor: "calRelation"},

    {cid: Components.ID("{4123da9a-f047-42da-a7d0-cc4175b9f36a}"),
     contractid: "@mozilla.org/calendar/datetime-formatter;1",
     script: "calDateTimeFormatter.js",
     constructor: "calDateTimeFormatter"},

    {cid: Components.ID("{6877bbdd-f336-46f5-98ce-fe86d0285cc1}"),
     contractid: "@mozilla.org/calendar/weekinfo-service;1",
     script: "calWeekInfoService.js",
     constructor: "calWeekInfoService"},

    {cid: Components.ID("{f41392ab-dcad-4bad-818f-b3d1631c4d93}"),
     contractid: "@mozilla.org/calendar/itip-item;1",
     script: "calItipItem.js",
     constructor: "calItipItem"},

    {cid: Components.ID("{1153c73a-39be-46aa-9ba9-656d188865ca}"),
     contractid: "@mozilla.org/network/protocol;1?name=webcal",
     script: "calProtocolHandler.js",
     constructor: "calProtocolHandlerWebcal"},

    {cid: Components.ID("{bdf71224-365d-4493-856a-a7e74026f766}"),
     contractid: "@mozilla.org/network/protocol;1?name=webcals",
     script: "calProtocolHandler.js",
     constructor: "calProtocolHandlerWebcals"},

    {cid: Components.ID("{6fe88047-75b6-4874-80e8-5f5800f14984}"),
     contractid: "@mozilla.org/calendar/ics-parser;1",
     script: "calIcsParser.js",
     constructor: "calIcsParser"},

    {cid: Components.ID("{207a6682-8ff1-4203-9160-729ec28c8766}"),
     contractid: "@mozilla.org/calendar/ics-serializer;1",
     script: "calIcsSerializer.js",
     constructor: "calIcsSerializer"},

    {cid: Components.ID("{40a1ccf4-5f54-4815-b842-abf06f84dbfd}"),
     contractid: "@mozilla.org/calendar/transactionmanager;1",
     script: "calTransactionManager.js",
     constructor: "calTransactionManager"},

    {cid: Components.ID("{1a23ace4-a0dd-43b4-96a8-b3cd419a14a5}"),
     contractid: "@mozilla.org/calendar/timezone-service;1",
     script: "calTimezoneService.js",
     constructor: "calTimezoneService",
     service: true},

    // This should be last, or at least after all services it calls
    {cid: Components.ID("{2547331f-34c0-4a4b-b93c-b503538ba6d6}"),
     contractid: "@mozilla.org/calendar/startup-service;1",
     script: "calStartupService.js",
     constructor: "calStartupService",
     categories: {"app-startup": "calendar-startup-startup"},
     service: true}
    ];

var calItemModule = {
    mScriptsLoaded: false,
    loadScripts: function () {
        if (this.mScriptsLoaded)
            return;

        // Register our alias here: this code always needs to run first (triggered by app-startup)
        let ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                  .getService(Components.interfaces.nsIIOService2);
        ioService.getProtocolHandler("resource")
                 .QueryInterface(Components.interfaces.nsIResProtocolHandler)
                 .setSubstitution("calendar", ioService.newFileURI(__LOCATION__.parent.parent));

        Components.utils.import("resource://calendar/modules/calUtils.jsm");
        cal.loadScripts(componentData.map(function(entry) { return entry.script; }),
                        Components.utils.getGlobalForObject(this));

        this.mScriptsLoaded = true;
    },

    registerSelf: function (compMgr, fileSpec, location, type) {
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);

        var catman = Components.classes["@mozilla.org/categorymanager;1"]
            .getService(Components.interfaces.nsICategoryManager);
        for (var i = 0; i < componentData.length; i++) {
            var comp = componentData[i];
            if (!comp.cid)
                continue;
            compMgr.registerFactoryLocation(comp.cid,
                                            "",
                                            comp.contractid,
                                            fileSpec,
                                            location,
                                            type);

            if (comp.categories) {
                var contractid;
                if (comp.service)
                    contractid = "service," + comp.contractid;
                else
                    contractid = comp.contractid;
                for (var category in comp.categories) {
                    catman.addCategoryEntry(category, comp.categories[category],
                                            contractid, true, true);
                }
            }
        }
    },

    makeFactoryFor: function(constructor, contractid) {
        var factory = {
            QueryInterface: function (aIID) {
                if (!aIID.equals(Components.interfaces.nsISupports) &&
                    !aIID.equals(Components.interfaces.nsIFactory))
                    throw Components.results.NS_ERROR_NO_INTERFACE;
                return this;
            },

            createInstance: function (outer, iid) {
                if (outer != null)
                    throw Components.results.NS_ERROR_NO_AGGREGATION;
                return (new constructor(contractid)).QueryInterface(iid);
            }
        };

        return factory;
    },

    getClassObject: function (compMgr, cid, iid) {
        if (!iid.equals(Components.interfaces.nsIFactory))
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

        if (!this.mScriptsLoaded)
            this.loadScripts();

        for (var i = 0; i < componentData.length; i++) {
            if (cid.equals(componentData[i].cid)) {
                if (componentData[i].onComponentLoad) {
                    eval(componentData[i].onComponentLoad);
                }
                // eval to get usual scope-walking
                // somebody knows why we eval the constructor function's name?
                return this.makeFactoryFor(eval(componentData[i].constructor),
                                           componentData[i].contractid);
            }
        }

        throw Components.results.NS_ERROR_NO_INTERFACE;
    },

    canUnload: function(compMgr) {
        return true;
    }
};

function NSGetModule(compMgr, fileSpec) {
    return calItemModule;
}
