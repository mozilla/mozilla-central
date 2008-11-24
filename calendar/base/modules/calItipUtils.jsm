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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Clint Talbert <ctalbert.moz@gmail.com>
 *   Matthew Willis <lilmatt@mozilla.com>
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

/*
 * Scheduling and iTIP helper code;
 * don't use deliberately, because it'll be moved into interfaces/components.
 *
 * May replace the current calItipProcessor.js code soon.
 */

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.itip = {
    /**
     * Gets the sequence/revision number, either of the passed item or
     * the last received one of an attendee; see
     * <http://tools.ietf.org/html/draft-desruisseaux-caldav-sched-04#section-7.1>.
     */
     getSequence: function cal_itip_getSequence(item) {
        let seq = null;

        if (cal.calInstanceOf(item, Components.interfaces.calIAttendee)) {
            seq = item.getProperty("RECEIVED-SEQUENCE");
        } else if (item) {
            // Unless the below is standardized, we store the last original
            // REQUEST/PUBLISH SEQUENCE in X-MOZ-RECEIVED-SEQUENCE to test against it
            // when updates come in:
            seq = item.getProperty("X-MOZ-RECEIVED-SEQUENCE");
            if (seq === null) {
                seq = item.getProperty("SEQUENCE");
            }

            // Make sure we don't have a pre Outlook 2007 appointment, but if we do
            // use Microsoft's Sequence number. I <3 MS
            if ((seq === null) || (seq == "0")) {
                seq = item.getProperty("X-MICROSOFT-CDO-APPT-SEQUENCE");
            }
        }

        if (seq === null) {
            return 0;
        } else {
            seq = parseInt(seq, 10);
            return (isNaN(seq) ? 0 : seq);
        }
    },

    /**
     * Gets the stamp date-time, either of the passed item or
     * the last received one of an attendee; see
     * <http://tools.ietf.org/html/draft-desruisseaux-caldav-sched-04#section-7.2>.
     */
    getStamp: function cal_itip_getStamp(item) {
        let dtstamp = null;

        if (cal.calInstanceOf(item, Components.interfaces.calIAttendee)) {
            let st = item.getProperty("RECEIVED-DTSTAMP");
            if (st) {
                dtstamp = cal.createDateTime(st);
            }
        } else if (item) {
            // Unless the below is standardized, we store the last original
            // REQUEST/PUBLISH DTSTAMP in X-MOZ-RECEIVED-DTSTAMP to test against it
            // when updates come in:
            let st = item.getProperty("X-MOZ-RECEIVED-DTSTAMP");
            if (st) {
                dtstamp = cal.createDateTime(st);
            } else {
                // xxx todo: are there similar X-MICROSOFT-CDO properties to be considered here?
                dtstamp = item.stampTime;
            }
        }

        return dtstamp;
    },

    /**
     * Compares sequences and/or stamps of two parties; returns -1, 0, +1.
     */
    compare: function cal_itip_compare(item1, item2) {
        let seq1 = cal.itip.getSequence(item1);
        let seq2 = cal.itip.getSequence(item2);
        if (seq1 > seq2) {
            return 1;
        } else if (seq1 < seq2) {
            return -1;
        } else {
            let st1 = cal.itip.getStamp(item1);
            let st2 = cal.itip.getStamp(item2);
            if (st1 && st2) {
                return st1.compare(st2);
            } else if (!st1 && st2) {
                return -1;
            } else if (st1 && !st2) {
                return 1;
            } else {
                return 0;
            }
        }
    },

    /**
     * Scope: iTIP message receiver
     *
     * Checks the passed iTIP item and calls the passed function with options offered.
     *
     * @param itipItem iTIP item
     * @param optionsFunc function being called with parameters: itipItem, resultCode, actionFunc
     *                    The action func has a property |method| showing the options:
     *                    * REFRESH -- send the latest item (sent by attendee(s))
     *                    * PUBLISH -- initial publish, no reply (sent by organizer)
     *                    * PUBLISH:UPDATE -- update of a published item (sent by organizer)
     *                    * REQUEST -- initial invitation (sent by organizer)
     *                    * REQUEST:UPDATE -- rescheduling invitation, has major change (sent by organizer)
     *                    * REQUEST:UPDATE-MINOR -- update of invitation, minor change (sent by organizer)
     *                    * REPLY -- invitation reply (sent by attendee(s))
     *                    * CANCEL -- invitation cancel (sent by organizer)
     */
    processItipItem: function cal_itip_processItipItem(itipItem, optionsFunc) {
        switch (itipItem.receivedMethod.toUpperCase()) {
            case "REFRESH":
            case "PUBLISH":
            case "REQUEST":
            case "CANCEL":
            case "REPLY": {
                // Per iTIP spec (new Draft 4), multiple items in an iTIP message MUST have
                // same ID, this simplifies our searching, we can just look for Item[0].id
                let itemList = itipItem.getItemList({});
                if (itemList.length > 0) {
                    itipItem.targetCalendar.getItem(itemList[0].id,
                                                    new ItipFindItemListener(itipItem, optionsFunc));
                } else if (optionsFunc) {
                    optionsFunc(itipItem, Components.results.NS_OK);
                }
                break;
            }
            default: {
                if (optionsFunc) {
                    optionsFunc(itipItem, Components.results.NS_ERROR_NOT_IMPLEMENTED);
                }
                break;
            }
        }
    },

    /**
     * Scope: iTIP message sender
     *
     * Checks to see if e.g. attendees were added/removed or an item has been
     * deleted and sends out appropriate iTIP messages.
     */
    checkAndSend: function cal_itip_checkAndSend(aOpType, aItem, aOriginalItem) {
        if (aOriginalItem && aOriginalItem.recurrenceId && !aItem.recurrenceId && aItem.recurrenceInfo) {
            // sanity check: assure aItem doesn't refer to the master
            aItem = aItem.recurrenceInfo.getOccurrenceFor(aOriginalItem.recurrenceId);
            cal.ASSERT(aItem, "unexpected!");
            if (!aItem) {
                return;
            }
        }

        let autoResponse = { value: false }; // controls confirm to send email only once

        let invitedAttendee = ((cal.calInstanceOf(aItem.calendar, Components.interfaces.calISchedulingSupport) &&
                                aItem.calendar.isInvitation(aItem))
                               ? aItem.calendar.getInvitedAttendee(aItem) : null);
        if (invitedAttendee) { // actually is an invitation copy, fix attendee list to send REPLY
            if (aItem.organizer) {
                let origInvitedAttendee = (aOriginalItem && aOriginalItem.getAttendeeById(invitedAttendee.id));

                if (aOpType == Components.interfaces.calIOperationListener.DELETE) {
                    // in case the attendee has just deleted the item, we want to send out a DECLINED REPLY:
                    origInvitedAttendee = invitedAttendee;
                    invitedAttendee = invitedAttendee.clone();
                    invitedAttendee.participationStatus = "DECLINED";
                }

                // We want to send a REPLY send if:
                // - there has been a PARTSTAT change
                // - in case of an organizer SEQUENCE bump we'd go and reconfirm our PARTSTAT
                if (!origInvitedAttendee ||
                    (origInvitedAttendee.participationStatus != invitedAttendee.participationStatus) ||
                    (aOriginalItem && (cal.itip.getSequence(aItem) != cal.itip.getSequence(aOriginalItem)))) {
                    aItem = aItem.clone();
                    aItem.removeAllAttendees();
                    aItem.addAttendee(invitedAttendee);
                    sendMessage(aItem, "REPLY", [aItem.organizer], autoResponse);
                }
            }

            return;
        }

        if (aItem.getProperty("X-MOZ-SEND-INVITATIONS") != "TRUE") { // Only send invitations/cancellations
                                                                     // if the user checked the checkbox
            return;
        }

        if (aOpType == Components.interfaces.calIOperationListener.DELETE) {
            sendMessage(aItem, "CANCEL", aItem.getAttendees({}), autoResponse);
            return;
        } // else ADD, MODIFY:

        let originalAtt = (aOriginalItem ? aOriginalItem.getAttendees({}) : []);
        let itemAtt = aItem.getAttendees({});
        let canceledAttendees = [];

        if (itemAtt.length > 0 || originalAtt.length > 0) {
            let attMap = {};
            for each (let att in originalAtt) {
                attMap[att.id.toLowerCase()] = att;
            }

            for each (let att in itemAtt) {
                if (att.id.toLowerCase() in attMap) {
                    // Attendee was in original item.
                    delete attMap[att.id.toLowerCase()];
                }
            }

            for each (let cancAtt in attMap) {
                canceledAttendees.push(cancAtt);
            }
        }

        // Check to see if some part of the item was updated, if so, re-send REQUEST
        if (!aOriginalItem || (cal.itip.compare(aItem, aOriginalItem) > 0)) { // REQUEST
            let requestItem = aItem.clone();

            // check whether it's a simple UPDATE (no SEQUENCE change) or real (RE)REQUEST,
            // in case of time or location/description change.
            let isMinorUpdate = (aOriginalItem && (cal.itip.getSequence(aItem) == cal.itip.getSequence(aOriginalItem)));

            if (!requestItem.organizer) {
                let organizer = cal.createAttendee();
                organizer.id = requestItem.calendar.getProperty("organizerId");
                organizer.commonName = requestItem.calendar.getProperty("organizerCN");
                organizer.role = "REQ-PARTICIPANT";
                organizer.participationStatus = "ACCEPTED";
                organizer.isOrganizer = true;
                requestItem.organizer = organizer;
            }

            // Fix up our attendees for invitations using some good defaults
            let recipients = [];
            let itemAtt = requestItem.getAttendees({});
            if (!isMinorUpdate) {
                requestItem.removeAllAttendees();
            }
            for each (let attendee in itemAtt) {
                if (!isMinorUpdate) {
                    attendee = attendee.clone();
                    attendee.role = "REQ-PARTICIPANT";
                    attendee.participationStatus = "NEEDS-ACTION";
                    attendee.rsvp = "TRUE";
                    requestItem.addAttendee(attendee);
                }
                recipients.push(attendee);
            }

            if (recipients.length > 0) {
                sendMessage(requestItem, "REQUEST", recipients, autoResponse);
            }
        }

        // Cancel the event for all canceled attendees
        if (canceledAttendees.length > 0) {
            let cancelItem = aOriginalItem.clone();
            cancelItem.removeAllAttendees();
            for each (let att in canceledAttendees) {
                cancelItem.addAttendee(att);
            }
            sendMessage(cancelItem, "CANCEL", canceledAttendees, autoResponse);
        }
    },

    /**
     * Bumps the SEQUENCE in case of a major change; XXX todo may need more fine-tuning.
     */
    prepareSequence: function cal_itip_prepareSequence(newItem, oldItem) {
        if (cal.isInvitation(newItem)) {
            return newItem; // invitation copies don't bump the SEQUENCE
        }

        if (newItem.recurrenceId && !oldItem.recurrenceId && oldItem.recurrenceInfo) {
            // XXX todo: there's still the bug that modifyItem is called with mixed occurrence/parent,
            //           find original occurrence
            oldItem = oldItem.recurrenceInfo.getOccurrenceFor(newItem.recurrenceId);
            cal.ASSERT(oldItem, "unexpected!");
            if (!oldItem) {
                return newItem;
            }
        }

        function hashMajorProps(aItem) {
            const majorProps = {
                DTSTART: true,
                DTEND: true,
                DURATION: true,
                DUE: true,
                RDATE: true,
                RRULE: true,
                EXDATE: true,
                STATUS: true,
                LOCATION: true
            };

            let propStrings = [];
            for (let item in cal.itemIterator([aItem])) {
                for (let prop in cal.ical.propertyIterator(item.icalComponent)) {
                    if (prop.propertyName in majorProps) {
                        propStrings.push(item.recurrenceId + "#" + prop.icalString);
                    }
                }
            }
            propStrings.sort();
            return propStrings.join("");
        }

        let h1 = hashMajorProps(newItem);
        let h2 = hashMajorProps(oldItem);
        if (h1 != h2) {
            newItem = newItem.clone();
            // bump SEQUENCE, it never decreases (mind undo scenario here)
            newItem.setProperty("SEQUENCE",
                                String(Math.max(cal.itip.getSequence(oldItem),
                                                cal.itip.getSequence(newItem)) + 1));
        }

        return newItem;
    }
};

/** local to this module file
 * Sets the received info either on the passed attendee or item object.
 *
 * @param item either  calIAttendee or calIItemBase
 * @param itipItemItem received iTIP item
 */
function setReceivedInfo(item, itipItemItem) {
    item.setProperty(cal.calInstanceOf(item, Components.interfaces.calIAttendee) ? "RECEIVED-SEQUENCE"
                                                                                 : "X-MOZ-RECEIVED-SEQUENCE",
                     String(cal.itip.getSequence(itipItemItem)));
    let dtstamp = cal.itip.getStamp(itipItemItem);
    if (dtstamp) {
        item.setProperty(cal.calInstanceOf(item, Components.interfaces.calIAttendee) ? "RECEIVED-DTSTAMP"
                                                                                     : "X-MOZ-RECEIVED-DTSTAMP",
                         dtstamp.getInTimezone(cal.UTC()).icalString);
    }
}

/** local to this module file
 * Takes over relevant item information from iTIP item and sets received info.
 *
 * @param item   the stored calendar item to update
 * @param itipItemItem the received item
 */
function updateItem(item, itipItemItem) {
    let newItem = item.clone();
    newItem.icalComponent = itipItemItem.icalComponent;
    setReceivedInfo(newItem, itipItemItem);
    newItem.generation = item.generation;
    newItem.alarmOffset = item.alarmOffset;
    newItem.alarmRelated = item.alarmRelated;
    newItem.alarmLastAck = item.alarmLastAck;
    return newItem;
}

/** local to this module file
 * Creates an organizer calIAttendee object based on the calendar's configured organizer id.
 *
 * @return calIAttendee object
 */
function createOrganizer(aCalendar) {
    let orgId = aCalendar.getProperty("organizerId");
    if (!orgId) {
        return null;
    }
    let organizer = cal.createAttendee();
    organizer.id = orgId;
    organizer.commonName = aCalendar.getProperty("organizerCN");
    organizer.role = "REQ-PARTICIPANT";
    organizer.participationStatus = "ACCEPTED";
    organizer.isOrganizer = true;
    return organizer;
}

/** local to this module file
 * Sends an iTIP message using the passed item's calendar transport.
 *
 * @param aItem iTIP item to be sent
 * @param aMethod iTIP method
 * @param aRecipientsList an array of calIAttendee objects the message should be sent to
 * @param autoResponse an inout object whether the transport should ask before sending
 */
function sendMessage(aItem, aMethod, aRecipientsList, autoResponse) {
    if (aRecipientsList.length == 0) {
        return;
    }
    if (cal.calInstanceOf(aItem.calendar, Components.interfaces.calISchedulingSupport) &&
        aItem.calendar.canNotify(aMethod, aItem)) {
        return; // provider will handle that
    }

    let aTransport = aItem.calendar.getProperty("itip.transport");
    if (!aTransport) { // can only send if there's a transport for the calendar
        return;
    }
    aTransport = aTransport.QueryInterface(Components.interfaces.calIItipTransport);

    let itipItem = Components.classes["@mozilla.org/calendar/itip-item;1"]
                             .createInstance(Components.interfaces.calIItipItem);
    itipItem.init(cal.getSerializedItem(aItem));
    itipItem.responseMethod = aMethod;
    itipItem.targetCalendar = aItem.calendar;
    itipItem.autoResponse = ((autoResponse && autoResponse.value) ? Components.interfaces.calIItipItem.AUTO
                                                                  : Components.interfaces.calIItipItem.USER);
    if (autoResponse) {
        autoResponse.value = true; // auto every following
    }
    // XXX I don't know whether the below are used at all, since we don't use the itip processor
    itipItem.isSend = true;

    aTransport.sendItems(aRecipientsList.length, aRecipientsList, itipItem);
}

/** local to this module file
 * An operation listener that is used on calendar operations which checks and sends further iTIP
 * messages based on the calendar action.
 *
 * @param opListener operation listener to forward
 * @param oldItem the previous item before modification (if any) 
 */
function ItipOpListener(opListener, oldItem) {
    this.mOpListener = opListener;
    this.mOldItem = oldItem;
}
ItipOpListener.prototype = {
    onOperationComplete: function ItipOpListener_onOperationComplete(aCalendar,
                                                                     aStatus,
                                                                     aOperationType,
                                                                     aId,
                                                                     aDetail) {
        cal.ASSERT(Components.isSuccessCode(aStatus), "error on iTIP processing");
        if (Components.isSuccessCode(aStatus)) {
            cal.itip.checkAndSend(aOperationType, aDetail, this.mOldItem);
        }
        if (this.mOpListener) {
            this.mOpListener.onOperationComplete(aCalendar,
                                                 aStatus,
                                                 aOperationType,
                                                 aId,
                                                 aDetail);
        }
    },
    onGetResult: function ItipOpListener_onGetResult(aCalendar,
                                                     aStatus,
                                                     aItemType,
                                                     aDetail,
                                                     aCount,
                                                     aItems) {
    }
};

/** local to this module file
 * An operation listener triggered by cal.itip.processItipItem() for lookup of the sent iTIP item's UID.
 *
 * @param itipItem sent iTIP item
 * @param optionsFunc options func, see cal.itip.processItipItem()
 */
function ItipFindItemListener(itipItem, optionsFunc) {
    this.mItipItem = itipItem;
    this.mOptionsFunc = optionsFunc;
    this.mFoundItems = [];
}
ItipFindItemListener.prototype = {
    mItipItem: null,
    mOptionsFunc: null,
    mFoundItems: null,

    onOperationComplete: function ItipFindItemListener_onOperationComplete(aCalendar,
                                                                           aStatus,
                                                                           aOperationType,
                                                                           aId,
                                                                           aDetail) {
        let rc = Components.results.NS_OK;
        const method = this.mItipItem.receivedMethod.toUpperCase();
        let actionMethod = method;
        let operations = [];

        if (this.mFoundItems.length > 0) {
            cal.LOG("iTIP on " + method + ": found " + this.mFoundItems.length + " items.");
            switch (method) {
                // XXX todo: there's still a potential flaw, if multiple PUBLISH/REPLY/REQUEST on
                //           occurrences happen at once; those lead to multiple
                //           occurrence modifications. Since those modifications happen
                //           implicitly on the parent (ics/memory/storage calls modifyException),
                //           the generation check will fail. We should really consider to allow
                //           deletion/modification/addition of occurrences directly on the providers,
                //           which would ease client code a lot.
                case "REFRESH":
                case "PUBLISH":
                case "REQUEST":
                case "REPLY":
                    for each (let itipItemItem in this.mItipItem.getItemList({})) {
                        for each (let item in this.mFoundItems) {
                            let rid = itipItemItem.recurrenceId; //  XXX todo support multiple
                            if (rid) { // actually applies to individual occurrence(s)
                                if (item.recurrenceInfo) {
                                    item = item.recurrenceInfo.getOccurrenceFor(rid);
                                    if (!item) {
                                        continue;
                                    }
                                } else { // the item has been rescheduled with master:
                                    itipItemItem = itipItemItem.parentItem;
                                }
                            }
                            switch (method) {
                                case "REFRESH": { // xxx todo test
                                    let attendees = itipItemItem.getAttendees({});
                                    cal.ASSERT(attendees.length == 1, "invalid number of attendees in REFRESH!");
                                    if (attendees.length > 0) {
                                        let action = function(opListener) {
                                            if (!item.organizer) {
                                                let org = createOrganizer(item.calendar);
                                                if (org) {
                                                    item = item.clone();
                                                    item.organizer = org;
                                                }
                                            }
                                            sendMessage(item, "REQUEST", attendees, true /* don't ask */);
                                        };
                                        operations.push(action);
                                    }
                                    break;
                                }
                                case "PUBLISH":
                                    cal.ASSERT(itipItemItem.getAttendees({}).length == 0,
                                               "invalid number of attendees in PUBLISH!");
                                    if (item.calendar.getProperty("itip.disableRevisionChecks") ||
                                        cal.itip.compare(itipItemItem, item) > 0) {
                                        let newItem = updateItem(newItem, itipItemItem);
                                        let action = function(opListener) {
                                            return newItem.calendar.modifyItem(newItem, item, opListener);
                                        };
                                        actionMethod = method + ":UPDATE";
                                        operations.push(action);
                                    }
                                    break;
                                case "REQUEST":
                                    if (item.calendar.getProperty("itip.disableRevisionChecks") ||
                                        cal.itip.compare(itipItemItem, item) > 0) {
                                        let newItem = updateItem(item, itipItemItem);
                                        let att = cal.getInvitedAttendee(newItem);
                                        if (!att) { // fall back to using configured organizer
                                            att = createOrganizer(newItem.calendar);
                                            if (att) {
                                                att.isOrganizer = false;
                                            }
                                        }
                                        if (att) {
                                            newItem.removeAttendee(att);
                                            att = att.clone();
                                            let action = function(opListener, partStat) {
                                                if (!partStat) { // keep PARTSTAT
                                                    let att_ = cal.getInvitedAttendee(item);
                                                    partStat = (att_ ? att_.participationStatus : "NEEDS-ACTION");
                                                }
                                                att.participationStatus = partStat;
                                                newItem.addAttendee(att);
                                                return newItem.calendar.modifyItem(
                                                    newItem, item, new ItipOpListener(opListener, item));
                                            };
                                            let isMinorUpdate = (cal.itip.getSequence(newItem) ==
                                                                 cal.itip.getSequence(item));
                                            actionMethod = (isMinorUpdate ? method + ":UPDATE-MINOR"
                                                                          : method + ":UPDATE");
                                            operations.push(action);
                                        }
                                    }
                                    break;
                                case "REPLY": {
                                    let attendees = itipItemItem.getAttendees({});
                                    cal.ASSERT(attendees.length == 1, "invalid number of attendees in REPLY!");
                                    if (attendees.length > 0 &&
                                        (item.calendar.getProperty("itip.disableRevisionChecks") ||
                                         (cal.itip.compare(itipItemItem, item.getAttendeeById(attendees[0].id)) > 0))) {
                                        // accepts REPLYs from previously uninvited attendees:
                                        let newItem = item.clone();
                                        let att = (item.getAttendeeById(attendees[0].id) || attendees[0]);
                                        newItem.removeAttendee(att);
                                        att = att.clone();
                                        setReceivedInfo(att, itipItemItem);
                                        att.participationStatus = attendees[0].participationStatus;
                                        newItem.addAttendee(att);
                                        let action = function(opListener) {
                                            return newItem.calendar.modifyItem(
                                                newItem, item,
                                                newItem.calendar.getProperty("itip.notify-replies")
                                                ? new ItipOpListener(opListener, item)
                                                : opListener);
                                        };
                                        operations.push(action);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    break;
                case "CANCEL": {
                    let modifiedItems = {};
                    for each (let itipItemItem in this.mItipItem.getItemList({})) {
                        for each (let item in this.mFoundItems) {
                            let rid = itipItemItem.recurrenceId; //  XXX todo support multiple
                            if (rid) { // actually a CANCEL of occurrence(s)
                                if (item.recurrenceInfo) {
                                    // collect all occurrence deletions into a single parent modification:
                                    let newItem = modifiedItems[item.id];
                                    if (!newItem) {
                                        newItem = item.clone();
                                        modifiedItems[item.id] = newItem;
                                        operations.push(
                                            function(opListener) {
                                                return newItem.calendar.modifyItem(newItem, item, opListener);
                                            });
                                    }
                                    newItem.recurrenceInfo.removeOccurrenceAt(rid);
                                } else if (item.recurrenceId && (item.recurrenceId.compare(rid) == 0)) {
                                    // parentless occurrence to be deleted (future)
                                    operations.push(
                                        function(opListener) {
                                            return item.calendar.deleteItem(item, opListener);
                                        });
                                }
                            } else {
                                operations.push(
                                    function(opListener) {
                                        return item.calendar.deleteItem(item, opListener);
                                    });
                            }
                        }
                    }
                    break;
                }
                default:
                    rc = Components.results.NS_ERROR_NOT_IMPLEMENTED;
                    break;
            }

        } else { // not found:
            cal.LOG("iTIP on " + method + ": no existing items.");

            for each (let itipItemItem in this.mItipItem.getItemList({})) {
                switch (method) {
                    case "REQUEST":
                    case "PUBLISH": {
                        let this_ = this;
                        let action = function(opListener, partStat) {
                            let newItem = itipItemItem.clone();
                            setReceivedInfo(newItem, itipItemItem);
                            newItem.parentItem.calendar = this_.mItipItem.targetCalendar;
                            if (partStat) {
                                if (partStat != "DECLINED") {
                                    cal.setDefaultAlarmValues(newItem);
                                }
                                let att = cal.getInvitedAttendee(newItem);
                                if (!att) { // fall back to using configured organizer
                                    att = createOrganizer(newItem.calendar);
                                    if (att) {
                                        att.isOrganizer = false;
                                        newItem.addAttendee(att);
                                    }
                                }
                                if (att) {
                                    att.participationStatus = partStat;
                                } else {
                                    cal.ASSERT(att, "no attendee to reply REQUEST!");
                                    return null;
                                }
                            } else {
                                cal.ASSERT(itipItemItem.getAttendees({}).length == 0,
                                           "invalid number of attendees in PUBLISH!");
                            }
                            return newItem.calendar.addItem(newItem,
                                                            (method == "REQUEST")
                                                            ? new ItipOpListener(opListener, null)
                                                            : opListener);
                        };
                        operations.push(action);
                        break;
                    }
                    case "CANCEL": // has already been processed
                        break;
                    default:
                        rc = Components.results.NS_ERROR_NOT_IMPLEMENTED;
                        break;
                }
            }
        }

        cal.LOG("iTIP operations: " + operations.length);
        let actionFunc = null;
        if (operations.length > 0) {
            actionFunc = function execOperations(opListener, partStat) {
                for each (let op in operations) {
                    try {
                        op(opListener, partStat);
                    } catch (exc) {
                        cal.ERROR(exc);
                    }
                }
            };
            actionFunc.method = actionMethod;
        }

        this.mOptionsFunc(this.mItipItem, rc, actionFunc);
    },

    onGetResult: function ItipFindItemListener_onGetResult(aCalendar,
                                                           aStatus,
                                                           aItemType,
                                                           aDetail,
                                                           aCount,
                                                           aItems) {
        if (Components.isSuccessCode(aStatus)) {
            this.mFoundItems = this.mFoundItems.concat(aItems);
        }
    }
};
