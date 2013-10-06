/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");
Components.utils.import("resource://calendar/modules/calIteratorUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Scheduling and iTIP helper code
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

        let wrappedItem = cal.wrapInstance(item, Components.interfaces.calIAttendee);
        if (wrappedItem) {
            seq = wrappedItem.getProperty("RECEIVED-SEQUENCE");
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

        let wrappedItem = cal.wrapInstance(item, Components.interfaces.calIAttendee);
        if (wrappedItem) {
            let st = wrappedItem.getProperty("RECEIVED-DTSTAMP");
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
     * Checks if the given calendar is a scheduling calendar. This means it
     * needs an organizer id and an itip transport. It should also be writable.
     *
     * @param calendar    The calendar to check
     * @return            True, if its a scheduling calendar.
     */
    isSchedulingCalendar: function isSchedulingCalendar(calendar) {
        return (cal.isCalendarWritable(calendar) &&
                calendar.getProperty("organizerId") &&
                calendar.getProperty("itip.transport"));
    },

    /**
     * Scope: iTIP message receiver
     *
     * Given an nsIMsgDBHdr and an imipMethod, set up the given itip item.
     *
     * @param itipItem    The item to set up
     * @param imipMethod  The received imip method
     * @param aMsgHdr     Information about the received email
     */
    initItemFromMsgData: function initItemFromMsgData(itipItem, imipMethod, aMsgHdr) {
        // Get the recipient identity and save it with the itip item.
        itipItem.identity = cal.itip.getMessageRecipient(aMsgHdr);

        // We are only called upon receipt of an invite, so ensure that isSend
        // is false.
        itipItem.isSend = false;

        // XXX Get these from preferences
        itipItem.autoResponse = Components.interfaces.calIItipItem.USER;

        if (imipMethod && imipMethod.length != 0 && imipMethod.toLowerCase() != "nomethod") {
            itipItem.receivedMethod = imipMethod.toUpperCase();
        } else { // There is no METHOD in the content-type header (spec violation).
                 // Fall back to using the one from the itipItem's ICS.
            imipMethod = itipItem.receivedMethod;
        }
        cal.LOG("iTIP method: " + imipMethod);

        function isWritableCalendar(aCalendar) {
            /* TODO: missing ACL check for existing items (require callback API) */
            return (cal.itip.isSchedulingCalendar(aCalendar)
                    && cal.userCanAddItemsToCalendar(aCalendar));
        }

        let writableCalendars = cal.getCalendarManager().getCalendars({}).filter(isWritableCalendar);
        if (writableCalendars.length > 0) {
            let compCal = Components.classes["@mozilla.org/calendar/calendar;1?type=composite"]
                                    .createInstance(Components.interfaces.calICompositeCalendar);
            writableCalendars.forEach(compCal.addCalendar, compCal);
            itipItem.targetCalendar = compCal;
        }
    },

    /**
     * Scope: iTIP message receiver
     *
     * Gets the suggested text to be shown when an imip item has been processed.
     * This text is ready localized and can be displayed to the user.
     *
     * @param aStatus         The status of the processing (i.e NS_OK, an error code)
     * @param aOperationType  An operation type from calIOperationListener
     * @return                The suggested text.
     */
    getCompleteText: function getCompleteText(aStatus, aOperationType) {
        function _gs(strName, param) {
            return cal.calGetString("lightning", strName, param, "lightning");
        }

        const cIOL = Components.interfaces.calIOperationListener;
        if (Components.isSuccessCode(aStatus)) {
            switch (aOperationType) {
                case cIOL.ADD: return _gs("imipAddedItemToCal");
                case cIOL.MODIFY: return _gs("imipUpdatedItem");
                case cIOL.DELETE: return _gs("imipCanceledItem");
            }
        } else {
            return _gs("imipBarProcessingFailed", [aStatus.toString(16)]);
        }
    },

    /**
     * Scope: iTIP message receiver
     *
     * Gets a text describing the given itip method. The text is of the form
     * "This Message contains a ... ".
     *
     * @param method      The method to describe.
     * @return            The localized text about the method.
     */
    getMethodText: function getMethodtext(method) {
        function _gs(strName) {
            return cal.calGetString("lightning", strName, null, "lightning");
        }

        switch (method) {
            case "REFRESH": return _gs("imipBarRefreshText");
            case "REQUEST": return _gs("imipBarRequestText");
            case "PUBLISH": return _gs("imipBarPublishText");
            case "CANCEL": return _gs("imipBarCancelText");
            case "REPLY": return _gs("imipBarReplyText");
            default:
                cal.ERROR("Unknown iTIP method: " + method);
                return _gs("imipBarUnsupportedText");
        }
    },

    /**
     * Scope: iTIP message receiver
     *
     * Gets localized texts about the message state. This returns a JS object
     * with the following structure:
     *
     * {
     *    label: "This is a desciptive text about the itip item",
     *    button1: {
     *      label: "What to show on the first button, i.e 'Decline'" +
     *             "This can be null if the button is not to be shown"
     *      actionMethod: "The method this triggers, i.e DECLINED",
     *    },
     *    // Same structure for button2/3
     *    button2: { ... }
     *    button3: { ... }
     * }
     *
     * @see processItipItem   This takes the same parameters as its optionFunc.
     * @param itipItem        The itipItem to query.
     * @param rc              The result of retrieving the item
     * @param actionFunc      The action function.
     */
    getOptionsText: function getOptionsText(itipItem, rc, actionFunc, foundItems) {
        function _gs(strName) {
            return cal.calGetString("lightning", strName, null, "lightning");
        }
        let imipLabel = null;
        if (itipItem.receivedMethod) {
            imipLabel = cal.itip.getMethodText(itipItem.receivedMethod);
        }
        let data = { label: imipLabel };
        for each (let btn in ["button1", "button2", "button3"]) {
            data[btn] = { label: null, actionMethod: "" };
        }

        if (rc == Components.interfaces.calIErrors.CAL_IS_READONLY) {
            // No writable calendars, tell the user about it
            data.label = _gs("imipBarNotWritable");
        } else if (Components.isSuccessCode(rc) && !actionFunc) {
            // This case, they clicked on an old message that has already been
            // added/updated, we want to tell them that.
            data.label = _gs("imipBarAlreadyProcessedText");
            if (foundItems && foundItems.length) {
                data.button1.label = _gs("imipDetails.label");
                // Not a real method, but helps us decide
                data.button1.actionMethod = "X-SHOWDETAILS";
            }
        } else if (Components.isSuccessCode(rc)) {

            cal.LOG("iTIP options on: " + actionFunc.method);
            switch (actionFunc.method) {
                case "REPLY":
                    // fall-thru intended
                case "PUBLISH:UPDATE":
                case "REQUEST:UPDATE-MINOR":
                    data.label = _gs("imipBarUpdateText");
                    data.button1.label = _gs("imipUpdate.label");
                    break;
                case "PUBLISH":
                    data.button1.label = _gs("imipAddToCalendar.label");
                    break;
                case "REQUEST:UPDATE":
                case "REQUEST:NEEDS-ACTION":
                case "REQUEST": {
                    if (actionFunc.method == "REQUEST:UPDATE") {
                        data.label = _gs("imipBarUpdateText");
                    } else if (actionFunc.method == "REQUEST:NEEDS-ACTION") {
                        data.label = _gs("imipBarProcessedNeedsAction");
                    }

                    data.button1.label = _gs("imipAcceptInvitation.label");
                    data.button1.actionMethod = "ACCEPTED";
                    data.button2.label = _gs("imipDeclineInvitation.label");
                    data.button2.actionMethod = "DECLINED";
                    data.button3.label = _gs("imipAcceptTentativeInvitation.label");
                    data.button3.actionMethod = "TENTATIVE";
                    break;
                }
                case "CANCEL": {
                    data.button1.label = _gs("imipCancelInvitation.label");
                    break;
                }
                case "REFRESH": {
                    data.button1.label = _gs("imipSend.label");
                    break;
                }
                default:
                    data.label = _gs("imipBarUnsupportedText");
                    break;
            }
        } else {
            data.label = _gs("imipBarUnsupportedText");
        }

        return data;
    },

    /**
     * Scope: iTIP message receiver
     *
     * Retrieves the intended recipient for this message.
     *
     * @param aMsgHdr     The message to check.
     * @return            The email of the intended recipient.
     */
    getMessageRecipient: function getMessageRecipient(aMsgHdr) {
        if (!aMsgHdr) {
            return null;
        }

        let identities;
        let actMgr = MailServices.accounts;
        if (aMsgHdr.accountKey) {
            // First, check if the message has an account key. If so, we can use the
            // account identities to find the correct recipient
            identities = actMgr.getAccount(aMsgHdr.accountKey).identities;
        } else {
            // Without an account key, we have to revert back to using the server
            identities = actMgr.getIdentitiesForServer(aMsgHdr.folder.server);
        }

        let emailMap = {};
        if (identities.length == 0) {
            // If we were not able to retrieve identities above, then we have no
            // choice but to revert to the default identity
            let identity = actMgr.defaultAccount.defaultIdentity;
            if (!identity) {
                // If there isn't a default identity (i.e Local Folders is your
                // default identity), then go ahead and use the first available
                // identity.
                let allIdentities = actMgr.allIdentities;
                if (allIdentities.length > 0) {
                    identity = allIdentities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
                } else {
                    // If there are no identities at all, we cannot get a recipient.
                    return null;
                }
            }
            emailMap[identity.email.toLowerCase()] = true;
        } else {
            // Build a map of usable email addresses
            for (let i = 0; i < identities.length; i++) {
                let identity = identities.queryElementAt(i, Components.interfaces.nsIMsgIdentity);
                emailMap[identity.email.toLowerCase()] = true;
            }
        }

        let hdrParser = MailServices.headerParser;
        let emails = {};

        // First check the recipient list
        hdrParser.parseHeadersWithArray(aMsgHdr.recipients, emails, {}, {});
        for each (let recipient in emails.value) {
            if (recipient.toLowerCase() in emailMap) {
                // Return the first found recipient
                return recipient;
            }
        }

        // Maybe we are in the CC list?
        hdrParser.parseHeadersWithArray(aMsgHdr.ccList, emails, {}, {});
        for each (let recipient in emails.value) {
            if (recipient.toLowerCase() in emailMap) {
                // Return the first found recipient
                return recipient;
            }
        }

        // Hrmpf. Looks like delegation or maybe Bcc.
        return null;
    },

    /**
     * Scope: iTIP message receiver
     *
     * Prompt for the target calendar, if needed for the given method. This
     * calendar will be set on the passed itip item.
     *
     * @param aMethod       The method to check.
     * @param aItipItem     The itip item to set the target calendar on.
     * @param aWindow       The window to open the dialog on.
     * @return              True, if a calendar was selected or no selection is
     *                        needed.
     */
    promptCalendar: function promptCalendar(aMethod, aItipItem, aWindow) {
        let needsCalendar = false;
        let targetCalendar = null;
        switch (aMethod) {
            // methods that don't require the calendar chooser:
            case "REFRESH":
            case "REQUEST:UPDATE":
            case "REQUEST:UPDATE-MINOR":
            case "PUBLISH:UPDATE":
            case "REPLY":
            case "CANCEL":
                needsCalendar = false;
                break;
            default:
                needsCalendar = true;
                break;
        }

        if (needsCalendar) {
            let calendars = cal.getCalendarManager().getCalendars({}).filter(cal.itip.isSchedulingCalendar);

            if (aItipItem.receivedMethod == "REQUEST") {
                // try to further limit down the list to those calendars that
                // are configured to a matching attendee;
                let item = aItipItem.getItemList({})[0];
                let matchingCals = calendars.filter(
                    function(calendar) {
                        return (cal.getInvitedAttendee(item, calendar) != null);
                    });
                // if there's none, we will show the whole list of calendars:
                if (matchingCals.length > 0) {
                    calendars = matchingCals;
                }
            }

            if (calendars.length == 0) {
                let msg = cal.calGetString("lightning", "imipNoCalendarAvailable", null, "lightning");
                aWindow.alert(msg);
            }
            else if (calendars.length == 1) {
                // There's only one calendar, so it's silly to ask what calendar
                // the user wants to import into.
                targetCalendar = calendars[0];
            } else {
                // Ask what calendar to import into
                let args = {};
                args.calendars = calendars;
                args.onOk = function selectCalendar(aCal) { targetCalendar = aCal; };
                args.promptText = cal.calGetString("calendar", "importPrompt");
                aWindow.openDialog("chrome://calendar/content/chooseCalendarDialog.xul",
                                   "_blank", "chrome,titlebar,modal,resizable", args);
            }

            if (targetCalendar) {
                aItipItem.targetCalendar = targetCalendar;
            }
        }

        return (!needsCalendar || targetCalendar != null);
    },

    /**
     * Clean up after the given iTIP item. This needs to be called once for each
     * time processItipItem is called. May be called with a null itipItem in
     * which case it will do nothing.
     *
     * @param itipItem      The iTIP item to clean up for.
     */
    cleanupItipItem: function cleanupItipItem(itipItem) {
        if (itipItem) {
            let itemList = itipItem.getItemList({});
            if (itemList.length > 0) {
                // Again, we can assume the id is the same over all items per spec
                ItipItemFinderFactory.cleanup(itemList[0].id);
            }
        }
    },

    /**
     * Scope: iTIP message receiver
     *
     * Checks the passed iTIP item and calls the passed function with options offered.
     * Be sure to call cleanupItipItem at least once after calling this function.
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
                if (!itipItem.targetCalendar) {
                    optionsFunc(itipItem, Components.interfaces.calIErrors.CAL_IS_READONLY);
                } else if (itemList.length > 0) {
                    ItipItemFinderFactory.findItem(itemList[0].id, itipItem, optionsFunc);
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

        // balance out parts of the modification vs delete confusion, deletion of occurrences
        // are notified as parent modifications and modifications of occurrences are notified
        // as mixed new-occurrence, old-parent (IIRC).
        if (aOriginalItem && aItem.recurrenceInfo) {
            if (aOriginalItem.recurrenceId && !aItem.recurrenceId) {
                // sanity check: assure aItem doesn't refer to the master
                aItem = aItem.recurrenceInfo.getOccurrenceFor(aOriginalItem.recurrenceId);
                cal.ASSERT(aItem, "unexpected!");
                if (!aItem) {
                    return;
                }
            }

            if (aOriginalItem.recurrenceInfo && aItem.recurrenceInfo) {
                // check whether the two differ only in EXDATEs
                let clonedItem = aItem.clone();
                let exdates = [];
                for each (let ritem in clonedItem.recurrenceInfo.getRecurrenceItems({})) {

                    let wrappedRItem = cal.wrapInstance(ritem, Components.interfaces.calIRecurrenceDate);
                    if (ritem.isNegative &&
                        wrappedRItem &&
                        !aOriginalItem.recurrenceInfo.getRecurrenceItems({}).some(
                            function(r) {
                                let wrappedR = cal.wrapInstance(r, Components.interfaces.calIRecurrenceDate);
                                return (r.isNegative &&
                                        wrappedR &&
                                        wrappedR.date.compare(wrappedRItem.date) == 0);
                            })) {
                        exdates.push(wrappedRItem);
                    }
                }
                if (exdates.length > 0) {
                    // check whether really only EXDATEs have been added:
                    let recInfo = clonedItem.recurrenceInfo;
                    exdates.forEach(recInfo.deleteRecurrenceItem, recInfo);
                    if (cal.compareItemContent(clonedItem, aOriginalItem)) { // transition into "delete occurrence(s)"
                        // xxx todo: support multiple
                        aItem = aOriginalItem.recurrenceInfo.getOccurrenceFor(exdates[0].date);
                        aOriginalItem = null;
                        aOpType = Components.interfaces.calIOperationListener.DELETE;
                    }
                }
            }
        }

        let autoResponse = { value: false }; // controls confirm to send email only once

        let invitedAttendee = cal.isInvitation(aItem) && cal.getInvitedAttendee(aItem);
        if (invitedAttendee) { // actually is an invitation copy, fix attendee list to send REPLY
            /* We check if the attendee id matches one of of the
             * userAddresses. If they aren't equal, it means that
             * someone is accepting invitations on behalf of an other user. */
            if (aItem.calendar.aclEntry) {
                let userAddresses = aItem.calendar.aclEntry.getUserAddresses({});
                if (userAddresses.length > 0
                    && !cal.attendeeMatchesAddresses(invitedAttendee, userAddresses)) {
                    invitedAttendee = invitedAttendee.clone();
                    invitedAttendee.setProperty("SENT-BY", "mailto:" + userAddresses[0]);
                }
            }

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

            // check whether it's a simple UPDATE (no SEQUENCE change) or real (RE)REQUEST,
            // in case of time or location/description change.
            let isMinorUpdate = (aOriginalItem && (cal.itip.getSequence(aItem) == cal.itip.getSequence(aOriginalItem)));

            if (!isMinorUpdate || !cal.compareItemContent(stripUserData(aItem), stripUserData(aOriginalItem))) {

                let requestItem = aItem.clone();
                if (!requestItem.organizer) {
                    requestItem.organizer = createOrganizer(requestItem.calendar);
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
                        if (!attendee.role) {
                            attendee.role = "REQ-PARTICIPANT";
                        }
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

    let wrappedItem = cal.wrapInstance(item, Components.interfaces.calIAttendee);
    item.setProperty(wrappedItem ? "RECEIVED-SEQUENCE"
                                 : "X-MOZ-RECEIVED-SEQUENCE",
                                 String(cal.itip.getSequence(itipItemItem)));
    let dtstamp = cal.itip.getStamp(itipItemItem);
    if (dtstamp) {
        item.setProperty(wrappedItem ? "RECEIVED-DTSTAMP"
                                     : "X-MOZ-RECEIVED-DTSTAMP",
                                     dtstamp.getInTimezone(cal.UTC()).icalString);
    }
}

/**
 * Strips user specific data, e.g. categories and alarm settings and returns the stripped item.
 */
function stripUserData(item_) {
    let item = item_.clone();
    let stamp = item.stampTime;
    let lastModified = item.lastModifiedTime;
    item.clearAlarms();
    item.alarmLastAck = null;
    item.setCategories(0, []);
    item.deleteProperty("RECEIVED-SEQUENCE");
    item.deleteProperty("RECEIVED-DTSTAMP");
    let propEnum = item.propertyEnumerator;
    while (propEnum.hasMoreElements()) {
        let prop = propEnum.getNext().QueryInterface(Components.interfaces.nsIProperty);
        let pname = prop.name;
        if (pname.substr(0, "X-MOZ-".length) == "X-MOZ-") {
            item.deleteProperty(prop.name);
        }
    }
    item.getAttendees({}).forEach(
        function(att) {
            att.deleteProperty("RECEIVED-SEQUENCE");
            att.deleteProperty("RECEIVED-DTSTAMP");
        });
    item.setProperty("DTSTAMP", stamp);
    item.setProperty("LAST-MODIFIED", lastModified); // need to be last to undirty the item
    return item;
}

/** local to this module file
 * Takes over relevant item information from iTIP item and sets received info.
 *
 * @param item         the stored calendar item to update
 * @param itipItemItem the received item
 */
function updateItem(item, itipItemItem) {
    function updateUserData(newItem, item) {
        // preserve user settings:
        newItem.generation = item.generation;
        newItem.clearAlarms();
        for each (let alarm in item.getAlarms({})) {
            newItem.addAlarm(alarm);
        }
        newItem.alarmLastAck = item.alarmLastAck;
        let cats = item.getCategories({});
        newItem.setCategories(cats.length, cats);
    }

    let newItem = item.clone();
    newItem.icalComponent = itipItemItem.icalComponent;
    setReceivedInfo(newItem, itipItemItem);
    updateUserData(newItem, item);

    let recInfo = itipItemItem.recurrenceInfo;
    if (recInfo) {
        // keep care of installing all overridden items, and mind existing alarms, categories:
        for each (let rid in recInfo.getExceptionIds({})) {
            let excItem = recInfo.getExceptionFor(rid).clone();
            cal.ASSERT(excItem, "unexpected!");
            let newExc = newItem.recurrenceInfo.getOccurrenceFor(rid).clone();
            newExc.icalComponent = excItem.icalComponent;
            setReceivedInfo(newExc, itipItemItem);
            let existingExcItem = (item.recurrenceInfo && item.recurrenceInfo.getExceptionFor(rid));
            if (existingExcItem) {
                updateUserData(newExc, existingExcItem);
            }
            newItem.recurrenceInfo.modifyException(newExc, true);
        }
    }

    return newItem;
}

/** local to this module file
 * Copies the provider-specified properties from the itip item to the passed
 * item. Special case property "METHOD" uses the itipItem's receivedMethod.
 *
 * @param itipItem      The itip item containing the receivedMethod.
 * @param itipItemItem  The calendar item inside the itip item.
 * @param item          The target item to copy to.
 */
function copyProviderProperties(itipItem, itipItemItem, item) {
    // Copy over itip properties to the item if requested by the provider
    let copyProps = item.calendar.getProperty("itip.copyProperties") || [];
    for each (let prop in copyProps) {
        if (prop == "METHOD") {
            // Special case, this copies over the received method
            item.setProperty("METHOD", itipItem.receivedMethod.toUpperCase());
        } else if (itipItemItem.hasProperty(prop)) {
            // Otherwise just copy from the item contained in the itipItem
            item.setProperty(prop, itipItemItem.getProperty(prop));
        }
    }
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
    let calendar = cal.wrapInstance(aItem.calendar, Components.interfaces.calISchedulingSupport);
    if (calendar) {
        if (calendar.QueryInterface(Components.interfaces.calISchedulingSupport)
                          .canNotify(aMethod, aItem)) {
            return; //provider will handle that
        }
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
 * Add a parameter SCHEDULE-AGENT=CLIENT to the item before it is
 * created or updated so that the providers knows scheduling will
 * be handled by the client.
 *
 * @param item item about to be added or updated
 * @param calendar calendar into which the item is about to be added or updated
 */
function addScheduleAgentClient(item, calendar) {
     if (calendar.getProperty("capabilities.autoschedule.supported") === true) {
          if (item.organizer) {
             item.organizer.setProperty("SCHEDULE-AGENT","CLIENT");
          }
     }
}

var ItipItemFinderFactory = {
    /**  Map to save finder instances for given ids */
    _findMap: {},

    /**
     * Create an item finder and track its progress. Be sure to clean up the
     * finder for this id at some point.
     *
     * @param aId           The item id to search for
     * @param aItipItem     The iTIP item used for processing
     * @param aOptionsFunc  The options function used for processing the found item
     */
    findItem: function findItem(aId, aItipItem, aOptionsFunc) {
        this.cleanup(aId);
        let finder = new ItipItemFinder(aId, aItipItem, aOptionsFunc);
        this._findMap[aId] = finder;
        finder.findItem();
    },

    /**
     * Clean up tracking for the given id. This needs to be called once for
     * every time findItem is called.
     *
     * @param aId           The item id to clean up for
     */
    cleanup: function cleanup(aId) {
        if (aId in this._findMap) {
            let finder = this._findMap[aId];
            finder.destroy();
            delete this._findMap[aId];
        }
    }
};

/** local to this module file
 * An operation listener triggered by cal.itip.processItipItem() for lookup of the sent iTIP item's UID.
 *
 * @param itipItem sent iTIP item
 * @param optionsFunc options func, see cal.itip.processItipItem()
 */
function ItipItemFinder(aId, itipItem, optionsFunc) {
    this.mItipItem = itipItem;
    this.mOptionsFunc = optionsFunc;
    this.mSearchId = aId;
}

ItipItemFinder.prototype = {

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.calIObserver,
        Components.interfaces.calIOperationListener
    ]),

    mSearchId: null,
    mItipItem: null,
    mOptionsFunc: null,
    mFoundItems: null,

    findItem: function findItem() {
        this.mFoundItems = [];
        this._unobserveChanges();
        this.mItipItem.targetCalendar.getItem(this.mSearchId, this);
    },

    _observeChanges: function _observeChanges(aCalendar) {
        this._unobserveChanges();
        this.mObservedCalendar = aCalendar;

        if (this.mObservedCalendar) this.mObservedCalendar.addObserver(this);
    },
    _unobserveChanges: function _unobserveChanges() {
        if (this.mObservedCalendar) {
            this.mObservedCalendar.removeObserver(this);
            this.mObservedCalendar = null;
        }
    },

    onStartBatch: function() {},
    onEndBatch: function() {},
    onError: function() {},
    onPropertyChanged: function() {},
    onPropertyDeleting: function() {},
    onLoad: function onLoad(aCalendar) {
        // Its possible that the item was updated. We need to re-retrieve the
        // items now.
        this.findItem();
    },

    onModifyItem: function onModifyItem(aNewItem, aOldItem) {
        let refItem = aOldItem || aNewItem;
        if (refItem.id == this.mSearchId) {
            // Check existing found items to see if it already exists
            let found = false;
            for (let [idx, item] in Iterator(this.mFoundItems)) {
                if (item.id == refItem.id && item.calendar.id == refItem.calendar.id) {
                    if (aNewItem) {
                        this.mFoundItems.splice(idx, 1, aNewItem);
                    } else {
                        this.mFoundItems.splice(idx, 1);
                    }
                    found = true;
                    break;
                }
            }

            // If it hasn't been found and there isto add a item, add it to the end
            if (!found && aNewItem) {
                this.mFoundItems.push(aNewItem);
            }
            this.processFoundItems();
        }
    },

    onAddItem: function onAddItem(aItem) {
        // onModifyItem is set up to also handle additions
        this.onModifyItem(aItem, null);
    },

    onDeleteItem: function onDeleteItem(aItem) {
        // onModifyItem is set up to also handle deletions
        this.onModifyItem(null, aItem);
    },

    onOperationComplete: function onOperationComplete(aCalendar,
                                                      aStatus,
                                                      aOperationType,
                                                      aId,
                                                      aDetail) {
        this.processFoundItems();
    },

    destroy: function destroy() {
        this._unobserveChanges();
    },

    processFoundItems: function processFoundItems() {
        let rc = Components.results.NS_OK;
        const method = this.mItipItem.receivedMethod.toUpperCase();
        let actionMethod = method;
        let operations = [];

        if (this.mFoundItems.length > 0) {
            // Save the target calendar on the itip item
            this.mItipItem.targetCalendar = this.mFoundItems[0].calendar;
            this._observeChanges(this.mItipItem.targetCalendar);

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
                                        let newItem = updateItem(item, itipItemItem);
                                        let action = function(opListener) {
                                            return newItem.calendar.modifyItem(newItem, item, opListener);
                                        };
                                        actionMethod = method + ":UPDATE";
                                        operations.push(action);
                                    }
                                    break;
                                case "REQUEST": {
                                        let newItem = updateItem(item, itipItemItem);
                                        let att = cal.getInvitedAttendee(newItem);
                                        if (!att) { // fall back to using configured organizer
                                            att = createOrganizer(newItem.calendar);
                                            if (att) {
                                                att.isOrganizer = false;
                                            }
                                        }
                                        if (att) {
                                            let firstFoundItem = this.mFoundItems.length && this.mFoundItems[0];
                                            let foundAttendee = firstFoundItem.getAttendeeById(att.id);

                                            // If the the user hasn't responded to the invitation yet and we
                                            // are viewing the current representation of the item, show the
                                            // accept/decline buttons. This means newer events will show the
                                            // "Update" button and older events will show the "already
                                            // processed" text.
                                            if (foundAttendee.participationStatus == "NEEDS-ACTION" &&
                                                (item.calendar.getProperty("itip.disableRevisionChecks") ||
                                                 cal.itip.compare(itipItemItem, item) == 0)) {

                                                actionMethod = "REQUEST:NEEDS-ACTION";
                                                operations.push(function(opListener, partStat) {
                                                    let changedItem = firstFoundItem.clone();
                                                    changedItem.removeAttendee(foundAttendee);
                                                    foundAttendee = foundAttendee.clone();
                                                    if (partStat) {
                                                        foundAttendee.participationStatus = partStat;
                                                    }
                                                    changedItem.addAttendee(foundAttendee);

                                                    return changedItem.calendar.modifyItem(
                                                        changedItem, firstFoundItem, new ItipOpListener(opListener, firstFoundItem));
                                                });
                                            } else if (item.calendar.getProperty("itip.disableRevisionChecks") ||
                                                       cal.itip.compare(itipItemItem, item) > 0) {

                                                addScheduleAgentClient(newItem, item.calendar);

                                                let isMinorUpdate = (cal.itip.getSequence(newItem) ==
                                                                     cal.itip.getSequence(item));
                                                actionMethod = (isMinorUpdate ? method + ":UPDATE-MINOR"
                                                                              : method + ":UPDATE");
                                                operations.push(function(opListener, partStat) {
                                                    if (!partStat) { // keep PARTSTAT
                                                        let att_ = cal.getInvitedAttendee(item);
                                                        partStat = (att_ ? att_.participationStatus : "NEEDS-ACTION");
                                                    }
                                                    newItem.removeAttendee(att);
                                                    att = att.clone();
                                                    att.participationStatus = partStat;
                                                    newItem.addAttendee(att);
                                                    return newItem.calendar.modifyItem(
                                                        newItem, item, new ItipOpListener(opListener, item));
                                                });
                                            }
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

                                        // Make sure the provider-specified properties are copied over
                                        copyProviderProperties(this.mItipItem, itipItemItem, newItem);

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

                                        // Make sure the provider-specified properties are copied over
                                        copyProviderProperties(this.mItipItem, itipItemItem, newItem);

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

            // If the item was not found, observe the target calendar anyway.
            // It will likely be the composite calendar, so we should update
            // if an item was added or removed
            this._observeChanges(this.mItipItem.targetCalendar);

            for each (let itipItemItem in this.mItipItem.getItemList({})) {
                switch (method) {
                    case "REQUEST":
                    case "PUBLISH": {
                        let this_ = this;
                        let action = function(opListener, partStat) {
                            let newItem = itipItemItem.clone();
                            setReceivedInfo(newItem, itipItemItem);
                            newItem.parentItem.calendar = this_.mItipItem.targetCalendar;
                            addScheduleAgentClient(newItem, this_.mItipItem.targetCalendar);
                            if (partStat) {
                                if (partStat != "DECLINED") {
                                    cal.alarms.setDefaultValues(newItem);
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

        this.mOptionsFunc(this.mItipItem, rc, actionFunc, this.mFoundItems);
    },

    onGetResult: function onGetResult(aCalendar,
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
