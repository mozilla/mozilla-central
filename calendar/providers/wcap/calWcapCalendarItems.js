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
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

calWcapCalendar.prototype.encodeAttendee =
function calWcapCalendar_encodeAttendee(att) {
    if (LOG_LEVEL > 2) {
        log("attendee.icalProperty.icalString=" + att.icalProperty.icalString, this);
    }
    function encodeAttr(val, attr, params) {
        if (val && val.length > 0) {
            if (params.length > 0) {
                params += "^";
            }
            if (attr) {
                params += (attr + "=");
            }
            params += encodeURIComponent(val);
        }
        return params;
    }
    var params = encodeAttr(att.rsvp ? "TRUE" : "FALSE", "RSVP", "");
    params = encodeAttr(att.participationStatus, "PARTSTAT", params);
    params = encodeAttr(att.role, "ROLE", params);
    var cn = att.commonName;
    if (cn) {
        params = encodeAttr(cn.replace(/[;:]/g, " "), "CN", params); // remove ';' and ':' from CN
    }
    return encodeAttr(att.id, null, params);
};

calWcapCalendar.prototype.getRecurrenceParams =
function calWcapCalendar_getRecurrenceParams(item, out_rrules, out_rdates, out_exrules, out_exdates) {
    // recurrences:
    out_rrules.value = [];
    out_rdates.value = [];
    out_exrules.value = [];
    out_exdates.value = [];
    if (item.recurrenceInfo) {
        var rItems = item.recurrenceInfo.getRecurrenceItems({});
        for each (var rItem in rItems) {
            var isNeg = rItem.isNegative;
            if (calInstanceOf(rItem, Components.interfaces.calIRecurrenceRule)) {
                var rule = ("\"" + encodeURIComponent(rItem.icalProperty.valueAsIcalString) + "\"");
                if (isNeg) {
                    out_exrules.value.push(rule);
                } else {
                    out_rrules.value.push(rule);
                }
            } else if (calInstanceOf(rItem, Components.interfaces.calIRecurrenceDateSet)) {
                var d = rItem.getDates({});
                for each (var d in rdates) {
                    // cs does not accept DATEs here:
                    if (isNeg) {
                        out_exdates.value.push(getIcalUTC(ensureDateTime(d.date)));
                    } else {
                        out_rdates.value.push(getIcalUTC(ensureDateTime(d.date)));
                    }
                }
            } else if (calInstanceOf(rItem, Components.interfaces.calIRecurrenceDate)) {
                // cs does not accept DATEs here:
                if (isNeg) {
                    out_exdates.value.push(getIcalUTC(ensureDateTime(rItem.date)));
                } else {
                    out_rdates.value.push(getIcalUTC(ensureDateTime(rItem.date)));
                }
            } else {
                this.notifyError(NS_ERROR_UNEXPECTED,
                                 "don\'t know how to handle this recurrence item: " + rItem.valueAsIcalString);
            }
        }
    }
};

function sameStringSet(list, list_) {
    return (list.length == list_.length &&
            list.every( function everyFunc(x) {
                    return list_.some(
                        function someFunc(y) { return x == y; } );
                }));
}

calWcapCalendar.prototype.encodeRecurrenceParams =
    function calWcapCalendar_encodeRecurrenceParams(item, oldItem, excludeExdates) {
    var rrules = {};
    var rdates = {};
    var exrules = {};
    var exdates = {};
    this.getRecurrenceParams(item, rrules, rdates, exrules, exdates);
    if (oldItem) {
        // actually only write changes if an old item has been changed, because
        // cs recreates the whole series if a rule has changed.
        // xxx todo: one problem is left when a master only holds EXDATEs,
        //           and effectively no item is present anymore.
        //           cs seems not to clean up automatically, but it does when
        //           when deleting an occurrence {id, rec-id}!
        //           So this still leaves the question open why deleteOccurrence
        //           does not directly call deleteItem rather than modifyItem,
        //           which leads to a much cleaner usage.
        //           I assume this mimic has been chosen for easier undo/redo
        //           support (Undo would then have to distinguish whether
        //           it has previously deleted an occurrence or ordinary item:
        //            - entering an exception again
        //            - or adding an item)
        //           Currently it can just modifyItem(newItem/oldItem) back.
        var rrules_ = {};
        var rdates_ = {};
        var exrules_ = {};
        var exdates_ = {};
        this.getRecurrenceParams(oldItem, rrules_, rdates_, exrules_, exdates_);

        if (sameStringSet(rrules.value, rrules_.value)) {
            rrules.value = null; // don't write
        }
        if (sameStringSet(rdates.value, rdates_.value)) {
            rdates.value = null; // don't write
        }
        if (sameStringSet(exrules.value, exrules.value)) {
            exrules.value = null; // don't write
        }
        if (excludeExdates || sameStringSet(exdates.value, exdates_.value)) {
            exdates.value = null; // don't write
        }
    }

    var ret = "";
    if (rrules.value) {
        ret += ("&rrules=" + rrules.value.join(";"));
    }
    if (rdates.value) {
        ret += ("&rdates=" + rdates.value.join(";"));
    }
    if (exrules.value) {
        ret += ("&exrules=" + exrules.value.join(";"));
    }
    if (!excludeExdates && exdates.value) {
        ret += ("&exdates=" + exdates.value.join(";"));
    }
    return ret;
    // xxx todo:
    // rchange=1: expand recurrences,
    // or whether to replace the rrule, ambiguous documentation!!!
    // check with store(with no uid) upon adoptItem() which behaves strange
    // if rchange=0 is set!
};

calWcapCalendar.prototype.getAlarmParams =
function calWcapCalendar_getAlarmParams(item) {
    var params = null;
    var alarmStart = item.alarmOffset;
    if (alarmStart) {
        if (item.alarmRelated == calIItemBase.ALARM_RELATED_END) {
            // cs does not support explicit RELATED=END when
            // both start|entry and end|due are written
            var dur = item.duration;
            if (dur) { // both given
                alarmStart = alarmStart.clone();
                alarmStart.addDuration(dur);
            } // else only end|due is set, alarm makes little sense though
        }
        
        var emails = "";
        if (item.hasProperty("alarmEmailAddress")) {
            emails = encodeURIComponent(item.getProperty("alarmEmailAddress"));
        } else {
            emails = this.session.getDefaultAlarmEmails({}).map(encodeURIComponent).join(";");
        }
        if (emails.length > 0) {
            params = ("&alarmStart=" + alarmStart.icalString);
            params += ("&alarmEmails=" + emails);
        }
        // else popup
    }
    if (!params) { // clear popup, email alarm:
        params = "&alarmStart=&alarmPopup=&alarmEmails=";
    }
    return params;
};

// why ever, X-S1CS-EMAIL is unsupported though documented
// for get_calprops... WTF.
function getCalId(att) {
    return (att ? att.getProperty("X-S1CS-CALID") : null);
}

function getAttendeeByCalId(atts, calId) {
    for each (var att in atts) {
        if (getCalId(att) == calId) {
            return att;
        }
    }
    return null;
}

calWcapCalendar.prototype.isInvitation =
function calWcapCalendar_isInvitation(item) {
    if (!this.session.isLoggedIn) {
        return false; // don't know
    }
    var calId = this.calId;
    var orgCalId = getCalId(item.organizer);
    if (orgCalId == calId) {
        return false;
    }
    return (this.getInvitedAttendee(item) != null);
};

calWcapCalendar.prototype.getInvitedAttendee =
function calWcapCalendar_getInvitedAttendee(item) {
    var att = getAttendeeByCalId(item.getAttendees({}), this.calId);
    if (!att) { // try to find mail address
        var ar = this.session.getUserPreferences("X-NSCP-WCAP-PREF-mail");
        if (ar.length > 0 && ar[0].length > 0) {
            att = item.getAttendeeById("mailto:" + ar[0]);
        }
    }
    return att;
};

calWcapCalendar.prototype.canNotify =
function calWcapCalendar_canNotify(method, item) {
    if (!this.session.isLoggedIn) {
        return false;
    }
    var calId = this.calId;
    switch (method) {
        case "REQUEST":
        case "CANCEL":
            // when creating new items, mind that organizer's id
            return (!item.organizer || // might yet not be set
                    (item.organizer.id == calId) || // or is set to raw calId
                    (getCalId(item.organizer) == calId));
        case "REPLY": // only if we we're invited from cs, and find matching X-S1CS-CALID:
            return (getAttendeeByCalId(item.getAttendees({}), calId) != null);
        default:
            return false;
    }
};

function equalDatetimes(one, two) {
    return ((!one && !two) ||
            (one && two &&
             (one.isDate == two.isDate) &&
             (one.compare(two) == 0)));
}

function identicalDatetimes(one, two) {
    return ((!one && !two) ||
            (equalDatetimes(one, two) &&
             compareObjects(one.timezone, two.timezone)));
}

// @return null if nothing has changed else value to be written
function diffProperty(newItem, oldItem, propName) {
    var val = newItem.getProperty(propName);
    var oldVal = (oldItem ? oldItem.getProperty(propName) : null);
    if (val === null) {
        // force being set when - no old item, eg when adding new item
        //                      - property is to be deleted
        if (!oldItem || oldVal) {
            val = "";
        }
    } else {
        val = val.replace(/(\r\n)|\n/g, "\r\n");
        if (oldVal) {
            oldVal = oldVal.replace(/(\r\n)|\n/g, "\r\n");
        }
        if (val == oldVal) {
            val = null;
        }
    }
    return val;
}

const METHOD_PUBLISH = 1;
const METHOD_REQUEST = 2;
const METHOD_REPLY   = 4;
const METHOD_CANCEL  = 8;
const METHOD_UPDATE  = 256;

calWcapCalendar.prototype.storeItem =
function calWcapCalendar_storeItem(bAddItem, item, oldItem, request) {
    var this_ = this;
    var bIsEvent = isEvent(item);
    var bIsParent = isParent(item);

    var method = METHOD_PUBLISH;
    var bNoSmtpNotify = false;
    var params = "";

    var calId = this.calId;
    if (!bAddItem && this.isInvitation(item)) { // REPLY
        method = METHOD_REPLY;
        var att = getAttendeeByCalId(item.getAttendees({}), calId);
        if (att) {
            log("attendee: " + att.icalProperty.icalString, this);
            var oldAtt = null;
            if (oldItem) {
                oldAtt = getAttendeeByCalId(oldItem.getAttendees({}), calId);
            }
            if (!oldAtt || (att.participationStatus != oldAtt.participationStatus)) {
                // REPLY first for just this calendar:
                params += ("&attendees=PARTSTAT=" + att.participationStatus +
                           "^" + encodeURIComponent(att.id));
            }
        }
    } else { // PUBLISH, REQUEST

        // workarounds for server bugs concerning recurrences/exceptions:
        // - if first occurrence is an exception
        //   and an EXDATE for that occurrence ought to be written,
        //   then the master item's data is replaced with that EXDATEd exception. WTF.
        // - if start/end date is being written on master, the previously EXDATEd
        //   exception overwrites master, why ever.
        // So in these cases: write all data of master.

        var bIsAllDay = false;
        if (bIsEvent) {
            var dtstart = item.startDate;
            var dtend = item.endDate;
            bIsAllDay = (dtstart.isDate && dtend.isDate);
            if (!oldItem || !identicalDatetimes(dtstart, oldItem.startDate)
                         || !identicalDatetimes(dtend, oldItem.endDate)) {
                params += ("&dtstart=" + getIcalUTC(dtstart)); // timezone will be set with tzid param
                params += ("&dtend=" + getIcalUTC(dtend));
                params += (bIsAllDay ? "&isAllDay=1" : "&isAllDay=0");

                if (bIsParent && item.recurrenceInfo) {
                    oldItem = null; // recurrence/exceptions hack: write whole master
                }
            }
        } else { // calITodo
            // xxx todo: dtstart is mandatory for cs, so if this is
            //           undefined, assume an allDay todo???
            var dtstart = item.entryDate;
            var dtend = item.dueDate;

            // cs bug: enforce DUE (set to DTSTART) if alarm is set
            if (!dtend && item.alarmOffset) {
                dtend = dtstart;
            }

            bIsAllDay = (dtstart && dtstart.isDate);
            if (!oldItem || !identicalDatetimes(dtstart, oldItem.entryDate)
                         || !identicalDatetimes(dtend, oldItem.dueDate)) {
                params += ("&dtstart=" + getIcalUTC(dtstart)); // timezone will be set with tzid param
                params += ("&due=" + getIcalUTC(dtend)); // timezone will be set with tzid param
                params += (bIsAllDay ? "&isAllDay=1" : "&isAllDay=0");

                if (bIsParent && item.recurrenceInfo) {
                    oldItem = null; // recurrence/exceptions hack: write whole master
                }
            }
        }
        if (bIsParent) {
            var recParams = this.encodeRecurrenceParams(item, oldItem, !bAddItem /* exclude EXDATEs */);
            if (recParams.length > 0) {
                oldItem = null; // recurrence/exceptions hack: write whole master
                params += recParams;
            }
        }
        
        function getOrgId(item) {
            return (item && item.organizer && item.organizer.id ? item.organizer.id : null);
        }
        var orgCalId = getCalId(item.organizer);
        // xxx todo: mbu initially sets this ownerId:
        if (!orgCalId) {
            var orgId = getOrgId(item);
            if (!orgId || (orgId == this.ownerId)) {
                orgCalId = calId; // patch to this calid
            }
        }
        
        var attendees = item.getAttendees({});
        if (attendees.length > 0) {
            // xxx todo: why ever, X-S1CS-EMAIL is unsupported though documented for calprops... WTF.
            function encodeAttendees(atts) {
                function attendeeSort(one, two) {
                    one = one.id;
                    two = two.id;
                    if (one == two) {
                        return 0;
                    }
                    return (one < two ? -1 : 1);
                }
                atts = atts.concat([]);
                atts.sort(attendeeSort);
                return atts.map(this_.encodeAttendee, this_).join(";");
            }
            var attParam = encodeAttendees(attendees);
            if (!oldItem || attParam != encodeAttendees(oldItem.getAttendees({}))) {
                params += ("&attendees=" + attParam);
            }

            if (orgCalId == calId) {
                method = METHOD_REQUEST;
            } else {
                method = METHOD_UPDATE;
                bNoSmtpNotify = true;
            }
        } else if (oldItem && oldItem.getAttendees({}).length > 0) {
            // else using just PUBLISH
            params += "&attendees="; // clear attendees
        }

        if (orgCalId) {
            if (!oldItem || (orgCalId != getCalId(oldItem.organizer))) {
                params += ("&orgCalid=" + encodeURIComponent(orgCalId));
            }
        } else { // might be a copy of an iTIP invitation:
            var orgEmail = getOrgId(item);
            if (!oldItem || (getOrgId(oldItem) != orgEmail)) {
                params += ("&orgEmail=" + encodeURIComponent(orgEmail));
            }
        }

        var val = item.title;
        if (!oldItem || val != oldItem.title) {
            params += ("&summary=" + encodeURIComponent(val));
        }

        params += "&categories=";
        var categories = item.getCategories({});
        if (categories.length > 0) {
            function encodeCategories(cats) {
                cats = cats.concat([]);
                cats.sort();
                return cats.join(";");
            }
            var catParam = encodeCategories(categories);
            if (!oldItem || catParam != encodeCategories(oldItem.getCategories({}))) {
                params += catParam;
            }
        }

        val = diffProperty(item, oldItem, "DESCRIPTION");
        if (val !== null) {
            params += ("&desc=" + encodeURIComponent(val));
        }
        val = diffProperty(item, oldItem, "LOCATION");
        if (val !== null) {
            params += ("&location=" + encodeURIComponent(val));
        }
        val = diffProperty(item, oldItem, "URL");
        if (val !== null) {
            params += ("&icsUrl=" + encodeURIComponent(val));
        }
        // xxx todo: default prio is 0 (5 in sjs cs)
        val = item.priority;
        if (!oldItem || val != oldItem.priority) {
            params += ("&priority=" + encodeURIComponent(val));
        }

        function getPrivacy(item) {
            return ((item.privacy && item.privacy != "") ? item.privacy : "PUBLIC");
        }
        var icsClass = getPrivacy(item);
        if (!oldItem || icsClass != getPrivacy(oldItem)) {
            params += ("&icsClass=" + icsClass);
        }

        if (!oldItem || item.status != oldItem.status) {
            switch (item.status) {
                case "CONFIRMED":    params += "&status=0"; break;
                case "CANCELLED":    params += "&status=1"; break;
                case "TENTATIVE":    params += "&status=2"; break;
                case "NEEDS-ACTION": params += "&status=3"; break;
                case "COMPLETED":    params += "&status=4"; break;
                case "IN-PROCESS":   params += "&status=5"; break;
                case "DRAFT":        params += "&status=6"; break;
                case "FINAL":        params += "&status=7"; break;
                default: // reset to default
                    params += (bIsEvent ? "&status=0" : "&status=3");
                    break;
            }
        }

        val = diffProperty(item, oldItem, "TRANSP");
        if (val !== null) {
            switch (val) {
                case "TRANSPARENT":
                    params += "&transparent=1";
                    break;
                case "OPAQUE":
                    params += "&transparent=0";
                    break;
                default:
                    params += ("&transparent=" + (((icsClass == "PRIVATE") || bIsAllDay) ? "1" : "0"));
                    break;
            }
        }

        if (!bIsEvent) {
            if (!oldItem || item.percentComplete != oldItem.percentComplete) {
                params += ("&percent=" + item.percentComplete.toString(10));
            }
            if (!oldItem || !equalDatetimes(item.completedDate, oldItem.completedDate)) {
                params += ("&completed=" + getIcalUTC(item.completedDate));
            }
        }

        // attachment urls:
        function getAttachments(item) {
            var ret = "";
            var attachments = item.attachments;
            if (attachments) {
                var strings = [];
                for each (var att in attachements) {
                    if (typeof(att) == "string") {
                        strings.push(encodeURIComponent(att));
                    } else if (calInstanceOf(att, Components.interfaces.calIAttachment)) {
                        strings.push(encodeURIComponent(att.uri.spec));
                    } else { // xxx todo
                        logError("only URLs supported as attachment, not: " + att, this_);
                    }
                }
                strings.sort();
                ret += strings.join(";");
            }
            return ret;
        }
        var val = getAttachments(item);
        if (!oldItem || val != getAttachments(oldItem)) {
            params += ("&attachments=" + val);
        }
    } // PUBLISH, REQUEST
    
    var alarmParams = this.getAlarmParams(item);
    if (!oldItem || (this.getAlarmParams(oldItem) != alarmParams)) {
        if ((method == METHOD_REQUEST) && params.length == 0) {
            // assure no email notifications about this change:
            bNoSmtpNotify = true;
        }
        params += alarmParams;
    }

    if (params.length == 0) {
        log("no change at all.", this);
        if (LOG_LEVEL > 2) {
            log("old item:\n" + oldItem.icalString + "\n\nnew item:\n" + item.icalString, this);
        }
        request.execRespFunc(null, item);
    } else {
        // cs does not support separate timezones for start and end, just pick one for tzid param:
        var someDate = (item.startDate || item.entryDate || item.dueDate);
        if (someDate && !someDate.timezone.isUTC) {
            params += ("&tzid=" + encodeURIComponent(this.getAlignedTzid(someDate.timezone)));
        }

        if (item.id) {
            params += ("&uid=" + encodeURIComponent(item.id));
        }

        // be picky about create/modify, if possible:
        // WCAP_STORE_TYPE_CREATE, WCAP_STORE_TYPE_MODIFY
        if (bAddItem) {
            params += "&storetype=1";
        } else if (oldItem) {
            params += "&storetype=2";
        } // else we don't know exactly, so don't check

        if (bIsParent) {
            params += "&mod=4"; // THIS AND ALL INSTANCES
        } else {
            params += ("&mod=1&rid=" + getIcalUTC(ensureDateTime(item.recurrenceId))); // THIS INSTANCE
        }

        params += ("&method=" + method);
        if (bNoSmtpNotify) {
            params += "&smtp=0&smtpNotify=0&notify=0";
        }
        params += "&replace=1"; // (update) don't append to any lists    
        params += "&fetch=1&relativealarm=1&compressed=1&recurring=1";
        params += "&emailorcalid=1&fmt-out=text%2Fcalendar";

        function netRespFunc(err, icalRootComp) {
            if (err) {
                throw err;
            }
            var items = this_.parseItems(icalRootComp, calICalendar.ITEM_FILTER_ALL_ITEMS,
                                         0, null, null, true /* bLeaveMutable */);
            if (items.length < 1) {
                throw new Components.Exception("empty VCALENDAR returned!");
            }
            if (items.length > 1) {
                this_.notifyError(NS_ERROR_UNEXPECTED,
                                  "unexpected number of items: " + items.length);
            }
            var newItem = items[0];
            this_.tunnelXProps(newItem, item);
            newItem.makeImmutable();
            // invalidate cached results:
            delete this_.m_cachedResults;
            // xxx todo: may log request status
            request.execRespFunc(null, newItem);
        }
        this.issueNetworkRequest(request, netRespFunc, stringToIcal,
                                 bIsEvent ? "storeevents" : "storetodos", params,
                                 calIWcapCalendar.AC_COMP_READ |
                                 calIWcapCalendar.AC_COMP_WRITE);
    }
};

calWcapCalendar.prototype.tunnelXProps =
function calWcapCalendar_tunnelXProps(destItem, srcItem) {
    // xxx todo: temp workaround for bug in calItemBase.js
    if (!isParent(srcItem)) {
        return;
    }
    // tunnel alarm X-MOZ-SNOOZE only if alarm is still set:
    var alarmOffset = destItem.alarmOffset;
    var enumerator = srcItem.propertyEnumerator;
    while (enumerator.hasMoreElements()) {
        try {
            var prop = enumerator.getNext().QueryInterface(Components.interfaces.nsIProperty);
            var name = prop.name;
            if (name.indexOf("X-MOZ-") == 0) {
                switch (name) {
                    // keep snooze stamps for occurrences only and if alarm is still set:
                    case "X-MOZ-SNOOZE-TIME":
                        if (!alarmOffset) {
                            break; // alarm has been reset
                        }
                        // fallthru intended
                    default:
                        if (LOG_LEVEL > 1) {
                            log("tunneling " + name + "=" + prop.value, this);
                        }
                        destItem.setProperty(name, prop.value);
                        break;
                }
            }
        } catch (exc) {
            logError(exc, this);
        }
    }
};

calWcapCalendar.prototype.adoptItem =
function calWcapCalendar_adoptItem(item, listener) {
    var this_ = this;
    var request = new calWcapRequest(
        function adoptItem_resp(request, err, newItem) {
            this_.notifyOperationComplete(listener,
                                          getResultCode(err),
                                          calIOperationListener.ADD,
                                          err ? item.id : newItem.id,
                                          err ? err : newItem);
            if (!err) {
                this_.notifyObservers("onAddItem", [newItem]);
            }
        },
        log("adoptItem() call: " + item.title, this));

    try {
        if (!isParent(item)) {
            logError("adoptItem(): unexpected proxy!", this);
        }
        this.storeItem(true /* bAddItem */, item, null, request);
    } catch (exc) {
        request.execRespFunc(exc);
    }
    return request;
}

calWcapCalendar.prototype.addItem =
function calWcapCalendar_addItem(item, listener) {
    this.adoptItem(item.clone(), listener);
};

calWcapCalendar.prototype.modifyItem =
function calWcapCalendar_modifyItem(newItem, oldItem, listener) {
    var this_ = this;
    var request = new calWcapRequest(
        function modifyItem_resp(request, err, item) {
            this_.notifyOperationComplete(listener,
                                          getResultCode(err),
                                          calIOperationListener.MODIFY,
                                          newItem.id, err ? err : item);
            if (!err) {
                this_.notifyObservers("onModifyItem", [item, oldItem]);
            }
        },
        log("modifyItem() call: " + newItem.id, this));

    try {
        if (!newItem.id) {
            throw new Components.Exception("new item has no id!");
        }
        var oldItem_ = oldItem;
        if (isParent(newItem)) {
            // Due to a cs bug, EXDATEs cannot be passed with store, thus make a two-step delete then store.
            // First check if EXDATEs are passed or have been modified:
            var exdates = {};
            this.getRecurrenceParams(newItem, {}, {}, {}, exdates);
            if (oldItem) {
                var exdates_ = {};
                this.getRecurrenceParams(oldItem_, {}, {}, {}, exdates_);
                // only use added elements
                exdates.value = exdates.value.filter(
                    function(elem) { return !exdates_.value.some(function(elem_) { return elem_ == elem; }); });
            } // else in case no oldItem is passed, nevertheless try to delete the EXDATEs
            if (exdates.value.length > 0) {
                var params = "&uid=";
                // all deletes on the same item:
                for (var i = exdates.value.length; i--;) {
                    params += encodeURIComponent(newItem.id);
                    if (i > 0) {
                        params += ";";
                    }
                }
                params += ("&mod=1&rid=" + exdates.value.join(";"));

                var orgCalId = getCalId(newItem.organizer);
                if (!orgCalId || (orgCalId != this.calId)) {
                    // item does not belong to this user, so don't notify:
                    params += "&smtp=0&smtpNotify=0&notify=0";
                }
                params += "&fmt-out=text%2Fxml";

                request.lockPending();
                this.issueNetworkRequest(request,
                                         function netResp(err, xml) {
                                             try {
                                                 // ignore any error and continue storing the item:
                                                 if (LOG_LEVEL > 0) {
                                                     log("modifyItem EXDATEs: " +
                                                         (xml ? getWcapRequestStatusString(xml) : "failed!"), this_);
                                                 }
                                                 // invalidate cached results:
                                                 delete this_.m_cachedResults;
                                                 this_.storeItem(false /* bAddItem */, newItem, oldItem_, request);
                                             } finally {
                                                 request.unlockPending();
                                             }
                                         },
                                         stringToXml, isEvent(newItem) ? "deleteevents_by_id" : "deletetodos_by_id",
                                         params, calIWcapCalendar.AC_COMP_WRITE);
                return request;
            }

        } else if (oldItem && !oldItem.parentItem.recurrenceInfo.getExceptionFor(newItem.recurrenceId, false)) {
            // pass null for oldItem when creating new exceptions, write whole item:
            oldItem_ = null;
        }
        this.storeItem(false /* bAddItem */, newItem, oldItem_, request);
    } catch (exc) {
        request.execRespFunc(exc);
    }
    return request;
};

calWcapCalendar.prototype.deleteItem =
function calWcapCalendar_deleteItem(item, listener) {
    var this_ = this;
    var request = new calWcapRequest(
        function deleteItem_resp(request, err) {
            // xxx todo: need to notify about each deleted item if multiple?
            this_.notifyOperationComplete(listener,
                                          getResultCode(err),
                                          calIOperationListener.DELETE,
                                          item.id, err ? err : item);
            if (!err) {
                this_.notifyObservers("onDeleteItem", [item]);
            }
        },
        log("deleteItem() call: " + item.id, this));

    try {
        if (!item.id) {
            throw new Components.Exception("no item id!");
        }
        var params = ("&uid=" + encodeURIComponent(item.id));
        if (isParent(item)) { // delete THIS AND ALL:
            params += "&mod=4&rid=0";
        } else { // delete THIS INSTANCE:
            // cs does not accept DATE here:
            params += ("&mod=1&rid=" + getIcalUTC(ensureDateTime(item.recurrenceId)));
        }

        var orgCalId = getCalId(item.organizer);
        if (!orgCalId || (orgCalId != this.calId)) {
            // item does not belong to this user, so don't notify:
            params += "&smtp=0&smtpNotify=0&notify=0";
        }

        params += "&fmt-out=text%2Fxml";

        this.issueNetworkRequest(request,
                                 function netResp(err, xml) {
                                     if (err) {
                                         throw err;
                                     }
                                     // invalidate cached results:
                                     delete this_.m_cachedResults;
                                     if (LOG_LEVEL > 0) {
                                         log("deleteItem(): " + getWcapRequestStatusString(xml), this_);
                                     }
                                 },
                                 stringToXml, isEvent(item) ? "deleteevents_by_id" : "deletetodos_by_id",
                                 params, calIWcapCalendar.AC_COMP_WRITE);
    } catch (exc) {
        request.execRespFunc(exc);
    }
    return request;
};

calWcapCalendar.prototype.patchTimezone = function calWcapCalendar_patchTimezone(subComp, attr, xpropOrTz) {
    var dt = subComp[attr];
    // if TZID parameter present (all-day items), it takes precedence:
    if (dt && (dt.timezone.isUTC || dt.timezone.isFloating)) {
        if (LOG_LEVEL > 2) {
            log(attr + " is " + dt, this);
        }
        var tz;
        if (typeof(xpropOrTz) == "string") {
            var tzid = subComp.getFirstProperty(xpropOrTz);
            if (tzid) {
                tz = this.session.getTimezone(tzid.value);
                ASSERT(tz, "timezone not found: " + tzid);
            }
        } else {
            tz = xpropOrTz;
        }
        if (tz) {
            if (LOG_LEVEL > 2) {
                log("patching " + xpropOrTz + ": from " +
                    dt + " to " + dt.getInTimezone(tz), this);
            }
            dt = dt.getInTimezone(tz);
            subComp[attr] = dt;
        }
    }
    return dt;
}

calWcapCalendar.prototype.parseItems = function calWcapCalendar_parseItems(
    icalRootComp, itemFilter, maxResults, rangeStart, rangeEnd, bLeaveMutable) {
    var items = [];
    var unexpandedItems = [];
    var uid2parent = {};
    var excItems = [];

    var componentType = "ANY";
    switch (itemFilter & calICalendar.ITEM_FILTER_TYPE_ALL) {
        case calICalendar.ITEM_FILTER_TYPE_TODO:
            componentType = "VTODO";
            break;
        case calICalendar.ITEM_FILTER_TYPE_EVENT:
            componentType = "VEVENT";
            break;
    }

    var recurrenceBound = this.session.recurrenceBound;

    var this_ = this;
    forEachIcalComponent(
        icalRootComp, componentType,
        function(subComp) {
            var organizer = subComp.getFirstProperty("ORGANIZER");
            if (organizer && organizer.getParameter("SENT-BY")) { // has SENT-BY
                // &emailorcalid=1 sets wrong email, workaround setting calid...
                var id = organizer.getParameter("X-S1CS-CALID");
                if (id) {
                    organizer.value = id;
                }
            }

            var dtstart = this_.patchTimezone(subComp, "startTime", "X-NSCP-DTSTART-TZID");

            var item = null;
            switch (subComp.componentType) {
                case "VEVENT": {
                    this_.patchTimezone(subComp, "endTime", dtstart ? dtstart.timezone : "X-NSCP-DTEND-TZID");
                    item = createEvent();
                    item.icalComponent = subComp;
                    break;
                }
                case "VTODO": {
                    this_.patchTimezone(subComp, "dueTime", dtstart ? dtstart.timezone : "X-NSCP-DUE-TZID");
                    item = createTodo();
                    item.icalComponent = subComp;
                    switch (itemFilter & calICalendar.ITEM_FILTER_COMPLETED_ALL) {
                        case calICalendar.ITEM_FILTER_COMPLETED_YES:
                            if (!item.isCompleted) {
                                delete item;
                                item = null;
                            }
                            break;
                        case calICalendar.ITEM_FILTER_COMPLETED_NO:
                            if (item.isCompleted) {
                                delete item;
                                item = null;
                            }
                            break;
                    }
                    break;
                }
            }
            if (item) {
                if (!item.title) {
                    // assumed to look at a subscribed calendar,
                    // so patch title for private items:
                    switch (item.privacy) {
                        case "PRIVATE":
                            item.title = g_privateItemTitle;
                            break;
                        case "CONFIDENTIAL":
                            item.title = g_confidentialItemTitle;
                            break;
                    }
                }

                item.calendar = this_.superCalendar;
                var rid = item.recurrenceId;
                if (rid) {
                    rid = rid.getInTimezone(dtstart.timezone);
                    item.recurrenceId = rid;
                    item.recurrenceInfo = null;
                    if (LOG_LEVEL > 1) {
                        log("exception item: " + item.title +
                            "\nrid=" + getIcalUTC(rid) +
                            "\nitem.id=" + item.id, this_);
                    }
                    excItems.push(item);

                } else if (item.recurrenceInfo) {
                    unexpandedItems.push(item);
                    uid2parent[item.id] = item;
                } else if ((maxResults == 0 || items.length < maxResults) &&
                           checkIfInRange(item, rangeStart, rangeEnd)) {
                    if (LOG_LEVEL > 2) {
                        log("item: " + item.title + "\n" + item.icalString, this_);
                    }
                    if (!bLeaveMutable) {
                        item.makeImmutable();
                    }
                    items.push(item);
                }
            }
        },
        maxResults);

    // tag "exceptions", i.e. items with rid:
    for each (var item in excItems) {
        var parent = uid2parent[item.id];
        if (parent) {
            var recStartDate = parent.recurrenceStartDate;
            if (recStartDate && recStartDate.isDate && !item.recurrenceId.isDate) {
                // cs ought to return proper all-day RECURRENCE-ID!
                // get into startDate's timezone before cutting:
                var rid = item.recurrenceId.getInTimezone(recStartDate.timezone);
                rid.isDate = true;
                item.recurrenceId = rid;
            }
            parent.recurrenceInfo.modifyException(item, true);
        } else {
            logError("parseItems(): no parent item for " + item.title +
                     ", rid=" + getIcalUTC(item.recurrenceId) +
                     ", item.id=" + item.id, this);
            // due to a server bug, in some scenarions the returned
            // data is lacking the parent item, leave parentItem open then
            if ((itemFilter & calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) == 0) {
                item.recurrenceId = null;
            }
            if (!bLeaveMutable) {
                item.makeImmutable();
            }
            items.push(item);
        }
    }

    if (itemFilter & calICalendar.ITEM_FILTER_CLASS_OCCURRENCES) {
        for each (var item in unexpandedItems) {
            if (maxResults != 0 && items.length >= maxResults) {
                break;
            }

            var recStartDate = item.recurrenceStartDate;
            if (recStartDate && !recStartDate.isDate) {
                recStartDate = null;
            }
            var recItems = item.recurrenceInfo.getRecurrenceItems({});
            for each (var recItem in recItems) {
                // cs bug: workaround missing COUNT
                if (calInstanceOf(recItem, Components.interfaces.calIRecurrenceRule)) {
                    if (!recItem.isFinite && !recItem.isNegative) {
                        recItem.count = recurrenceBound;
                    }
                } else if (recStartDate &&
                           calInstanceOf(recItem, Components.interfaces.calIRecurrenceDate)) {
                    // cs bug: always uses DATE-TIME even though the master item is all-day DATE:
                    //         get into startDate's timezone before cutting:
                    var date = recItem.date.getInTimezone(recStartDate.timezone);
                    date.isDate = true;
                    recItem.date = date;
                }
            }

            if (!bLeaveMutable) {
                item.makeImmutable();
            }
            var occurrences = item.recurrenceInfo.getOccurrences(rangeStart, rangeEnd,
                                                                 maxResults == 0 ? 0 : maxResults - items.length,
                                                                 {});
            if (LOG_LEVEL > 1) {
                log("item: " + item.title + " has " + occurrences.length.toString() + " occurrences.", this);
                if (LOG_LEVEL > 2) {
                    log("master item: " + item.title + "\n" + item.icalString, this);
                    for each (var occ in occurrences) {
                        log("item: " + occ.title + "\n" + occ.icalString, this);
                    }
                }
            }
            // only proxies returned:
            items = items.concat(occurrences);
        }

    } else {
        if (maxResults != 0 &&
            (items.length + unexpandedItems.length) > maxResults) {
            unexpandedItems.length = (maxResults - items.length);
        }
        if (!bLeaveMutable) {
            for each (var item in unexpandedItems) {
                item.makeImmutable();
            }
        }
        if (LOG_LEVEL > 2) {
            for each (var item in unexpandedItems) {
                log("item: " + item.title + "\n" + item.icalString, this);
            }
        }
        items = items.concat(unexpandedItems);
    }

    if (LOG_LEVEL > 1) {
        log("parseItems(): returning " + items.length + " items", this);
    }
    return items;
};

calWcapCalendar.prototype.getItem =
function calWcapCalendar_getItem(id, listener) {
    var this_ = this;
    var request = new calWcapRequest(
        function getItem_resp(request, err, item) {
            if (checkErrorCode(err, calIWcapErrors.WCAP_FETCH_EVENTS_BY_ID_FAILED) ||
                checkErrorCode(err, calIWcapErrors.WCAP_COMPONENT_NOT_FOUND)) {
                // querying by id is a valid use case, even if no item is returned:
                err = NS_OK;
            }
            this_.notifyOperationComplete(listener,
                                          getResultCode(err),
                                          calIOperationListener.GET,
                                          item ? item.id : null,
                                          err || item);
        },
        log("getItem() call: id=" + id, this));

    try {
        if (!id) {
            throw new Components.Exception("no item id!");
        }
        var params = "&relativealarm=1&compressed=1&recurring=1";
        params += "&emailorcalid=1&fmt-out=text%2Fcalendar&uid=";
        params += encodeURIComponent(id);

        function notifyResult(icalRootComp) {
            var items = this_.parseItems(icalRootComp, calICalendar.ITEM_FILTER_ALL_ITEMS, 0, null, null);
            if (items.length < 1) {
                throw new Components.Exception("no such item!");
            }
            if (items.length > 1) {
                this_.notifyError(NS_ERROR_UNEXPECTED,
                                  "unexpected number of items: " + items.length);
            }
            if (listener) {
                listener.onGetResult(this_.superCalendar, NS_OK,
                                     calIItemBase, log("getItem(): success. id=" + id, this_),
                                     items.length, items);
            }
            request.execRespFunc(null, items[0]);
        };
        // most common: try events first
        this.issueNetworkRequest(
            request,
            function fetchEventById_resp(err, icalRootComp) {
                if (err) {
                    if (!checkErrorCode(err, calIWcapErrors.WCAP_FETCH_EVENTS_BY_ID_FAILED) &&
                        !checkErrorCode(err, calIWcapErrors.WCAP_COMPONENT_NOT_FOUND)) {
                        throw err;
                    }
                    // try todos:
                    this_.issueNetworkRequest(
                        request,
                        function fetchTodosById_resp(err, icalRootComp) {
                            if (err)
                                throw err;
                            notifyResult(icalRootComp);
                        },
                        stringToIcal, "fetchtodos_by_id", params, calIWcapCalendar.AC_COMP_READ);
                } else {
                    notifyResult(icalRootComp);
                }
            },
            stringToIcal, "fetchevents_by_id", params, calIWcapCalendar.AC_COMP_READ);
    } catch (exc) {
        request.execRespFunc(exc);
    }
    return request;
};

function getItemFilterParams(itemFilter) {
    var params = "";
    switch (itemFilter & calICalendar.ITEM_FILTER_TYPE_ALL) {
        case calICalendar.ITEM_FILTER_TYPE_TODO:
            params += "&component-type=todo";
            break;
        case calICalendar.ITEM_FILTER_TYPE_EVENT:
            params += "&component-type=event";
            break;
    }

    var compstate = "";
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REPLY_DECLINED)
//         compstate += ";REPLY-DECLINED";
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REPLY_ACCEPTED)
//         compstate += ";REPLY-ACCEPTED";
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REQUEST_COMPLETED)
//         compstate += ";REQUEST-COMPLETED";
    if (itemFilter & calICalendar.ITEM_FILTER_REQUEST_NEEDS_ACTION) {
        compstate += ";REQUEST-NEEDS-ACTION";
    }
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REQUEST_NEEDSNOACTION) {
//         compstate += ";REQUEST-NEEDSNOACTION";
//     }
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REQUEST_PENDING)
//         compstate += ";REQUEST-PENDING";
//     if (itemFilter & calIWcapCalendar.ITEM_FILTER_REQUEST_WAITFORREPLY)
//         compstate += ";REQUEST-WAITFORREPLY";
    if (compstate.length > 0) {
        params += ("&compstate=" + compstate.substr(1));
    }
    return params;
}

calWcapCalendar.prototype.getItems =
function calWcapCalendar_getItems(itemFilter, maxResults, rangeStart, rangeEnd, listener) {
    rangeStart = ensureDateTime(rangeStart);
    rangeEnd = ensureDateTime(rangeEnd);
    var zRangeStart = getIcalUTC(rangeStart);
    var zRangeEnd = getIcalUTC(rangeEnd);
    
    var this_ = this;
    var request = new calWcapRequest(
        function getItems_resp(request, err, data) {
            log("getItems() complete: " + errorToString(err), this_);
            this_.notifyOperationComplete(listener,
                                          getResultCode(err),
                                          calIOperationListener.GET,
                                          null,
                                          err);
        },
        log("getItems():\n\titemFilter=0x" + itemFilter.toString(0x10) +
            ",\n\tmaxResults=" + maxResults +
            ",\n\trangeStart=" + zRangeStart +
            ",\n\trangeEnd=" + zRangeEnd, this));
    
    if (this.aboutToBeUnregistered) {
        // limiting the amount of network traffic while unregistering
        log("being unregistered, no results.", this);
        request.execRespFunc(null, []);
        return request;
    }

    // m_cachedResults holds the last data revtrieval. This is expecially useful when
    // switching on multiple subcriptions: the composite calendar multiplexes getItems()
    // calls to all composited calendars over and over again, most often on the same
    // date range (as the user usually looks at the same view).
    // This will most likely vanish when a better caching is implemented in the views,
    // or WCAP local storage caching has sufficient performance.
    // The cached results will be invalidated after 2 minutes to reflect incoming invitations.
    if (CACHE_LAST_RESULTS > 0 && this.m_cachedResults) {
        for each (var entry in this.m_cachedResults) {
            if ((itemFilter == entry.itemFilter) &&
                equalDatetimes(rangeStart, entry.rangeStart) &&
                equalDatetimes(rangeEnd, entry.rangeEnd)) {
                log("reusing last getItems() cached data.", this);
                if (listener) {
                    listener.onGetResult(
                        this.superCalendar, NS_OK, calIItemBase,
                        "getItems()", entry.results.length, entry.results);
                }
                request.execRespFunc(null, entry.results);
                return request;
            }
        }
    }

    try {
        var params = ("&relativealarm=1&compressed=1&recurring=1&emailorcalid=1&fmt-out=text%2Fcalendar");
        // setting component-type, compstate filters:
        params += getItemFilterParams(itemFilter);
        if (maxResults > 0) {
            params += ("&maxResults=" + maxResults);
        }
        params += ("&dtstart=" + zRangeStart);
        params += ("&dtend=" + zRangeEnd);

        this.issueNetworkRequest(
            request,
            function netResp(err, icalRootComp) {
                if (err) {
                    if (checkErrorCode(err, calIWcapErrors.WCAP_ACCESS_DENIED_TO_CALENDAR)) {
                        // try free-busy times:
                        if (listener &&
                            (itemFilter & calICalendar.ITEM_FILTER_TYPE_EVENT) &&
                            rangeStart && rangeEnd) {

                            var freeBusyListener = { // calIGenericOperationListener:
                                onResult: function freeBusyListener_onResult(request, result) {
                                    if (!Components.isSuccessCode(request.status)) {
                                        throw request.status;
                                    }
                                    var items = [];
                                    for each (var entry in result) {
                                        var item = createEvent();
                                        item.id = (g_busyPhantomItemUuidPrefix + getIcalUTC(entry.interval.start));
                                        item.calendar = this_.superCalendar;
                                        item.title = g_busyItemTitle;
                                        item.startDate = entry.interval.start;
                                        item.endDate = entry.interval.end;
                                        item.makeImmutable();
                                        items.push(item);
                                    }
                                    listener.onGetResult(this_.superCalendar, NS_OK, calIItemBase,
                                                         "getItems()/free-busy", items.length, items);
                                }
                            };
                            request.attachSubRequest(
                                this_.session.getFreeBusyIntervals(
                                    this_.calId, rangeStart, rangeEnd, calIFreeBusyInterval.BUSY_ALL,
                                    freeBusyListener));
                        }
                    } else {
                        throw err;
                    }
                } else if (listener) {

                    var items = this_.parseItems(
                        icalRootComp, itemFilter, maxResults,
                        rangeStart, rangeEnd);

                    if (CACHE_LAST_RESULTS > 0) {
                        // auto invalidate after X minutes:
                        if (!this_.m_cachedResultsTimer) {

                            var callback = {
                                notify: function notify(timer) {
                                    if (!this_.m_cachedResults) {
                                        return;
                                    }
                                    var now = (new Date()).getTime();
                                    // sort out old entries:
                                    var entries = [];
                                    for (var i = 0; i < this_.m_cachedResults.length; ++i) {
                                        var entry = this_.m_cachedResults[i];
                                        if ((now - entry.stamp) < (CACHE_LAST_RESULTS_INVALIDATE * 1000)) {
                                            entries.push(entry);
                                        } else {
                                            log("invalidating cached entry:\n\trangeStart=" +
                                                getIcalUTC(entry.rangeStart) + "\n\trangeEnd=" +
                                                getIcalUTC(entry.rangeEnd), this_);
                                        }
                                    }
                                    this_.m_cachedResults = entries;
                                }
                            };
                            // sort out freq:
                            var freq = Math.min(20, // default: 20secs
                                                Math.max(1, CACHE_LAST_RESULTS_INVALIDATE));
                            log("cached results sort out timer freq: " + freq, this_);
                            this_.m_cachedResultsTimer = Components.classes["@mozilla.org/timer;1"]
                                                                   .createInstance(Components.interfaces.nsITimer);
                            this_.m_cachedResultsTimer.initWithCallback(callback, freq * 1000,
                                                                        Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
                        }
                        if (!this_.m_cachedResults) {
                            this_.m_cachedResults = [];
                        }
                        var entry = {
                            stamp: (new Date()).getTime(),
                            itemFilter: itemFilter,
                            rangeStart: (rangeStart ? rangeStart.clone() : null),
                            rangeEnd: (rangeEnd ? rangeEnd.clone() : null),
                            results: items
                        };
                        this_.m_cachedResults.unshift(entry);
                        if (this_.m_cachedResults.length > CACHE_LAST_RESULTS) {
                            this_.m_cachedResults.length = CACHE_LAST_RESULTS;
                        }
                    }

                    listener.onGetResult(this_.superCalendar, NS_OK, calIItemBase, "getItems()", items.length, items);
                }
            },
            stringToIcal, "fetchcomponents_by_range", params, calIWcapCalendar.AC_COMP_READ);
    } catch (exc) {
        request.execRespFunc(exc);
    }
    return request;
};

calWcapCalendar.prototype.resetLog =
function calWcapCalendar_resetLog() {
    this.deleteProperty("replay.last_stamp");
};

calWcapCalendar.prototype.replayChangesOn =
function calWcapCalendar_replayChangesOn(destCal, listener) {
    var this_ = this;
    var itemFilter = calICalendar.ITEM_FILTER_ALL_ITEMS;
    var dtFrom = getDatetimeFromIcalString(this.getProperty("replay.last_stamp"));
    var now = getTime(); // new stamp for this sync

    var request_ = new calWcapRequest(
        function replayChangesOn_resp(request, err) {
            if (err) {
                logError("error replaying changes: " + errorToString(err));
                this_.notifyError(err);
            } else {
                log("replay succeeded.", this_);
                this_.setProperty("replay.last_stamp", getIcalUTC(now));
                log("new replay stamp: " + getIcalUTC(now), this_);
            }
            if (opListener) {
                opListener.onResult(request, null);
            }
        },
        log("replayChangesOn():\n\titemFilter=0x" + itemFilter.toString(0x10) +
            "\n\tdtFrom=" + getIcalUTC(dtFrom), this));

    try {
        var writeListener = {
            onGetResult: function() {},
            onOperationComplete: function(cal, status, opType, id, detail) {
                if (!Components.isSuccessCode(status)) {
                    request.execRespFunc(status); // any error on writing breaks whole operation
                }
            }
        };
        var request = new calWcapRequest(
            function netFinishedRespFunc(err, data) {
                var modifiedIds = {};
                for each (var item in request.m_modifiedItems) {
                    var dtCreated = item.getProperty("CREATED");
                    var bAdd = (!dtCreated || !dtFrom || dtCreated.compare(dtFrom) >= 0);
                    modifiedIds[item.id] = true;
                    if (bAdd) {
                        log("replayChangesOn(): new item " + item.id, this_);
                        if (destCal) {
                            destCal.addItem(item, writeListener);
                        }
                    } else {
                        log("replayChangesOn(): modified item " + item.id, this_);
                        if (destCal) {
                            destCal.modifyItem(item, null, writeListener);
                        }
                    }
                }
                for each (var item in request.m_deletedItems) {
                    // don't delete anything that has been touched by lastmods:
                    if (modifiedIds[item.id]) {
                        log("replayChangesOn(): skipping deletion of " + item.id, this_);
                    } else if (isParent(item)) {
                        log("replayChangesOn(): deleted item " + item.id, this_);
                        if (destCal) {
                            destCal.deleteItem(item, writeListener);
                        }
                    } else { // modify parent instead of
                             // straight-forward deleteItem(). WTF.
                        var parent = item.parentItem.clone();
                        parent.recurrenceInfo.removeOccurrenceAt(item.recurrenceId);
                        log("replayChangesOn(): modified parent "+ parent.id, this_);
                        if (destCal) {
                            destCal.modifyItem(parent, item, writeListener);
                        }
                    }
                }
            }, "replayChangesOn() netFinishedRespFunc");
        request_.attachSubRequest(request);

        // assure being logged in to calc server times:
        this.session.getSessionId(
            request,
            function getSessionId_resp(err, sessionId) {
                try {
                    if (err) {
                        throw err;
                    }
                    var params = ("&relativealarm=1&compressed=1&recurring=1" +
                                  "&emailorcalid=1&fmt-out=text%2Fcalendar");
                    if (dtFrom) {
                        dtFrom = this_.session.getServerTime(dtFrom);
                    }
                    params += ("&dtstart=" + getIcalUTC(dtFrom));
                    params += ("&dtend=" + getIcalUTC(this_.session.getServerTime(now)));

                    log("replayChangesOn(): getting last modifications...", this_);
                    this_.issueNetworkRequest(
                        request,
                        function modifiedNetResp(err, icalRootComp) {
                            if (err) {
                                throw err;
                            }
                            request.m_modifiedItems = this_.parseItems(icalRootComp,
                                                                       calICalendar.ITEM_FILTER_ALL_ITEMS,
                                                                       0, null, null);
                        },
                        stringToIcal, "fetchcomponents_by_lastmod",
                        params + getItemFilterParams(itemFilter),
                        calIWcapCalendar.AC_COMP_READ);

                    log("replayChangesOn(): getting deleted items...", this_);
                    this_.issueNetworkRequest(
                        request,
                        function modifiedNetResp(err, icalRootComp) {
                            if (err) {
                                throw err;
                            }
                            request.m_deletedItems = this_.parseItems(icalRootComp,
                                                                      calICalendar.ITEM_FILTER_ALL_ITEMS,
                                                                      0, null, null);
                        },
                        stringToIcal, "fetch_deletedcomponents",
                        params + getItemFilterParams(itemFilter & // only component types
                                                     calICalendar.ITEM_FILTER_TYPE_ALL),
                        calIWcapCalendar.AC_COMP_READ);
                } catch (exc) {
                    request.execRespFunc(exc);
                }
            });
    } catch (exc) {
        request_.execRespFunc(exc);
    }
    return request_;
};

