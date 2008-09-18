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
 * The Original Code is lightning code.
 *
 * The Initial Developer of the Original Code is
 *  Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir.vukicevic@oracle.com>
 *   Matthew Willis <lilmatt@mozilla.com>
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

function getRidKey(dt) {
    if (!dt) {
        return null;
    }
    var tz = dt.timezone;
    if (!tz.isUTC && !tz.isFloating) {
        dt = dt.getInTimezone(UTC());
    }
    return dt.icalString;
}

function calRecurrenceInfo() {
    this.mRecurrenceItems = [];
    this.mExceptionMap = {};

    this.wrappedJSObject = this;
}

calRecurrenceInfo.prototype = {
    mImmutable: false,
    mBaseItem: null,
    mRecurrenceItems: null,
    mPositiveRules: null,
    mNegativeRules: null,
    mExceptionMap: null,

    QueryInterface: function cRI_QueryInterface(aIID) {
        return doQueryInterface(this, calRecurrenceInfo.__proto__, aIID, null, this);
    },

    /**
     * nsIClassInfo
     */
    getInterfaces: function cRI_getInterfaces(aCount) {
        const interfaces = [Components.interfaces.nsISupports,
                            Components.interfaces.calIRecurrenceInfo,
                            Components.interfaces.nsIClassInfo];

        aCount.value = interfaces.length;
        return interfaces;
    },
    getHelperForLanguage: function cRI_getHelperForLanguage(aLang) {
        return null;
    },
    contractID: "@mozilla.org/calendar/recurrence-info;1",
    classDescription: "Calendar Recurrence Info",
    classID: Components.ID("{04027036-5884-4a30-b4af-f2cad79f6edf}"),
    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,
    flags: 0,

    /**
     * Helpers
     */
    ensureBaseItem: function cRI_ensureBaseItem() {
        if (!this.mBaseItem) {
            throw Components.results.NS_ERROR_NOT_INITIALIZED;
        }
    },
    ensureMutable: function cRI_ensureMutable() {
        if (this.mImmutable) {
            throw Components.results.NS_ERROR_OBJECT_IS_IMMUTABLE;
        }
    },
    ensureSortedRecurrenceRules: function cRI_ensureSortedRecurrenceRules() {
        if (!this.mPositiveRules || !this.mNegativeRules) {
            this.mPositiveRules = [];
            this.mNegativeRules = [];
            for each (var ritem in this.mRecurrenceItems) {
                if (ritem.isNegative) {
                    this.mNegativeRules.push(ritem);
                } else {
                    this.mPositiveRules.push(ritem);
                }
            }
        }
    },

    /**
     * Mutability bits
     */
    get isMutable cRI_get_isMutable() {
        return !this.mImmutable;
    },
    makeImmutable: function cRI_makeImmutable() {
        if (this.mImmutable) {
            return;
        }

        for each (ritem in this.mRecurrenceItems) {
            if (ritem.isMutable) {
                ritem.makeImmutable();
            }
        }

        for each (item in this.mExceptionMap) {
            if (item.isMutable) {
                item.makeImmutable();
            }
        }

        this.mImmutable = true;
    },

    clone: function cRI_clone() {
        var cloned = new calRecurrenceInfo();
        cloned.mBaseItem = this.mBaseItem;

        var clonedItems = [];
        for each (var ritem in this.mRecurrenceItems) {
            clonedItems.push(ritem.clone());
        }
        cloned.mRecurrenceItems = clonedItems;

        var clonedExceptions = {};
        for (var exitem in this.mExceptionMap) {
            clonedExceptions[exitem] = this.mExceptionMap[exitem].cloneShallow(this.mBaseItem);
        }
        cloned.mExceptionMap = clonedExceptions;

        return cloned;
    },

    /*
     * calIRecurrenceInfo
     */
    get item cRI_get_item() {
        return this.mBaseItem;
    },
    set item cRI_set_item(value) {
        this.ensureMutable();

        value = calTryWrappedJSObject(value);
        this.mBaseItem = value;
        // patch exception's parentItem:
        for each (exitem in this.mExceptionMap) {
            exitem.parentItem = value;
        }
    },

    get isFinite cRI_get_isFinite() {
        this.ensureBaseItem();

        for each (ritem in this.mRecurrenceItems) {
            if (!ritem.isFinite) {
                return false;
            }
        }
        return true;
    },

    getRecurrenceItems: function cRI_getRecurrenceItems(aCount) {
        this.ensureBaseItem();

        aCount.value = this.mRecurrenceItems.length;
        return this.mRecurrenceItems;
    },

    setRecurrenceItems: function cRI_setRecurrenceItems(aCount, aItems) {
        this.ensureBaseItem();
        this.ensureMutable();

        // XXX should we clone these?
        this.mRecurrenceItems = aItems;
        this.mPositiveRules = null;
        this.mNegativeRules = null;
    },

    countRecurrenceItems: function cRI_countRecurrenceItems() {
        this.ensureBaseItem();

        return this.mRecurrenceItems.length;
    },

    getRecurrenceItemAt: function cRI_getRecurrenceItemAt(aIndex) {
        this.ensureBaseItem();

        if (aIndex < 0 || aIndex >= this.mRecurrenceItems.length) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        return this.mRecurrenceItems[aIndex];
    },

    appendRecurrenceItem: function cRI_appendRecurrenceItem(aItem) {
        this.ensureBaseItem();
        this.ensureMutable();
        this.ensureSortedRecurrenceRules();

        this.mRecurrenceItems.push(aItem);
        if (aItem.isNegative) {
            this.mNegativeRules.push(aItem);
        } else {
            this.mPositiveRules.push(aItem);
        }
    },

    deleteRecurrenceItemAt: function cRI_deleteRecurrenceItemAt(aIndex) {
        this.ensureBaseItem();
        this.ensureMutable();

        if (aIndex < 0 || aIndex >= this.mRecurrenceItems.length) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (this.mRecurrenceItems[aIndex].isNegative) {
            this.mNegativeRules = null;
        } else {
            this.mPositiveRules = null;
        }

        this.mRecurrenceItems.splice(aIndex, 1);
    },

    deleteRecurrenceItem: function cRI_deleteRecurrenceItem(aItem) {
        // Because xpcom objects can be wrapped in various ways, testing for
        // mere == sometimes returns false even when it should be true.  Use
        // the interface pointer returned by sip to avoid that problem.
        var sip1 = Components.classes["@mozilla.org/supports-interface-pointer;1"]
                            .createInstance(Components.interfaces.nsISupportsInterfacePointer);
        sip1.data = aItem;
        sip1.dataIID = Components.interfaces.calIRecurrenceItem;

        var pos;
        if ((pos = this.mRecurrenceItems.indexOf(sip1.data)) > -1) {
            this.deleteRecurrenceItemAt(pos);
        } else {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }
    },

    insertRecurrenceItemAt: function cRI_insertRecurrenceItemAt(aItem, aIndex) {
        this.ensureBaseItem();
        this.ensureMutable();
        this.ensureSortedRecurrenceRules();

        if (aIndex < 0 || aIndex > this.mRecurrenceItems.length) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (aItem.isNegative) {
            this.mNegativeRules.push(aItem);
        } else {
            this.mPositiveRules.push(aItem);
        }

        this.mRecurrenceItems.splice(aIndex, 0, aItem);
    },

    clearRecurrenceItems: function cRI_clearRecurrenceItems() {
        this.ensureBaseItem();
        this.ensureMutable();

        this.mRecurrenceItems = [];
        this.mPositiveRules = [];
        this.mNegativeRules = [];
    },

    /*
     * calculations
     */
    getNextOccurrence: function cRI_getNextOccurrence(aTime) {
        this.ensureBaseItem();
        this.ensureSortedRecurrenceRules();

        var startDate = this.mBaseItem.recurrenceStartDate;
        var dates = [];

        var nextOccurrences = [];
        var invalidOccurrences;
        var negMap = {};
        var minOccRid;

        // Go through all negative rules to create a map of occurrences that
        // should be skipped when going through occurrences.
        for each (var ritem in this.mNegativeRules) {
            // TODO Infinite rules (i.e EXRULE) are not taken into account,
            // because its very performance hungry and could potentially
            // lead to a deadlock (i.e RRULE is canceled out by an EXRULE).
            // This is ok for now, since EXRULE is deprecated anyway.
            if (ritem.isFinite) {
                // Get all occurrences starting at our recurrence start date.
                // This is fine, since there will never be an EXDATE that
                // occurrs before the event started and its illegal to EXDATE an
                // RDATE.
                var rdates = ritem.getOccurrences(startDate,
                                                  startDate,
                                                  null,
                                                  0,
                                                  {});
                // Map all negative dates.
                for each (var r in rdates) {
                    negMap[getRidKey(r)] = true;
                }
            } else {
                WARN("Item '" + this.mBaseItem.title + "'" +
                     (this.mBaseItem.calendar ? " (" + this.mBaseItem.calendar.name + ")" : "") +
                     " has an infinite negative rule (EXRULE)");
            }
        }

        var bailCounter = 0;
        do {
            invalidOccurrences = 0;
            // Go through all positive rules and get the next recurrence id
            // according to that rule. If for all rules the rid is "invalid",
            // (i.e an EXDATE removed it, or an exception moved it somewhere
            // else), then get the respective next rid.
            //
            // If in a loop at least one rid is valid (i.e not an exception, not
            // an exdate, is after aTime), then remember the lowest one.
            for (var i = 0; i < this.mPositiveRules.length; i++) {
                if (calInstanceOf(this.mPositiveRules[i], Components.interfaces.calIRecurrenceDate)) {
                    // RDATEs are special. there is only one date in this rule,
                    // so no need to search anything.
                    var rdate = this.mPositiveRules[i].date;
                    if (!nextOccurrences[i] && rdate.compare(aTime) > 0) {
                        // The RDATE falls into range, save it.
                        nextOccurrences[i] = rdate;
                    } else {
                        // The RDATE doesn't fall into range. This rule will
                        // always be invalid, since it can't give out a date.
                        nextOccurrences[i] = null;
                        invalidOccurrences++;
                    }
                    // TODO What about calIRecurrenceDateSet? Multi-value date
                    // sets are parsed into multiple calIRecurrenceDates, iirc.
                } else if (calInstanceOf(this.mPositiveRules[i], Components.interfaces.calIRecurrenceRule)) {
                    // RRULEs must not start searching before |startDate|, since
                    // the pattern is only valid afterwards. If an occurrence
                    // was found in a previous round, we can go ahead and start
                    // searching from that occurrence.
                    var searchStart = nextOccurrences[i] || startDate;

                    // Search for the next occurrence after aTime. If the last
                    // round was invalid, then in this round we need to search
                    // after nextOccurrences[i] to make sure getNextOccurrence()
                    // doesn't find the same occurrence again.
                    var searchDate =
                        (nextOccurrences[i] && nextOccurrences[i].compare(aTime) > 0 ?
                            nextOccurrences[i] :
                            aTime);

                    nextOccurrences[i] = this.mPositiveRules[i]
                                             .getNextOccurrence(searchStart, searchDate);
                }

                if (negMap[getRidKey(nextOccurrences[i])] || this.mExceptionMap[getRidKey(nextOccurrences[i])]) {
                    // If the found recurrence id points to either an exception
                    // (will handle later) or an EXDATE, then nextOccurrences[i]
                    // is invalid and we might need to try again next round.
                    invalidOccurrences++;
                } else if (nextOccurrences[i]) {
                    // We have a valid recurrence id (not an exception, not an
                    // EXDATE, falls into range). We only need to save the
                    // earliest occurrence after aTime (checking for aTime is
                    // not needed, since getNextOccurrence() above returns only
                    // occurrences after aTime).
                    if (!minOccRid || minOccRid.compare(nextOccurrences[i]) > 0) {
                        minOccRid = nextOccurrences[i];
                    }
                }
            }

            // To make sure users don't just report bugs like "the application
            // hangs", bail out after 100 runs. If this happens, it is most
            // likely a bug.
            if (bailCounter++ > 100) {
                ERROR("Could not find next occurrence after 100 runs!");
                return null;
            }

            // We counted how many positive rules found out that their next
            // candidate is invalid. If all rules produce invalid next
            // occurrences, a second round is needed.
        } while (invalidOccurrences == this.mPositiveRules.length);

        // Since we need to compare occurrences by date, save the rid found
        // above also as a date. This works out because above we skipped
        // exceptions.
        var minOccDate = minOccRid;

        // Scan exceptions for any dates earlier than the above found
        // minOccDate, but still after aTime.
        for each (var exc in this.mExceptionMap) {
            var start = exc.recurrenceStartDate;
            if (start.compare(aTime) > 0 &&
                (!minOccDate || start.compare(minOccDate) <= 0)) {
                // This exception is earlier, save its rid (for getting the
                // occurrence later on) and its date (for comparing to other
                // exceptions).
                minOccRid = exc.recurrenceId;
                minOccDate = start;
            }
        }

        // If we found a recurrence id any time above, then return the
        // occurrence for it.
        return (minOccRid ? this.getOccurrenceFor(minOccRid) : null);
    },

    getPreviousOccurrence: function cRI_getPreviousOccurrence(aTime) {
        // TODO libical currently does not provide us with easy means of
        // getting the previous occurrence. This could be fixed to improve
        // performance greatly. Filed as libical feature request 1944020.

        // HACK We never know how early an RDATE might be before the actual
        // recurrence start. Since rangeStart cannot be null for recurrence
        // items like calIRecurrenceRule, we need to work around by supplying a
        // very early date. Again, this might have a high performance penalty.
        var early = createDateTime();
        early.icalString = "00000101T000000Z";

        var rids = this.calculateDates(early,
                                       aTime,
                                       0);
        // The returned dates are sorted, so the last one is a good
        // candidate, if it exists.
        return (rids.length > 0 ? this.getOccurrenceFor(rids[rids.length - 1].id) : null);
    },

    // internal helper function;
    calculateDates: function cRI_calculateDates(aRangeStart,
                                                aRangeEnd,
                                                aMaxCount) {
        this.ensureBaseItem();
        this.ensureSortedRecurrenceRules();

        function ridDateSortComptor(a,b) {
            return a.rstart.compare(b.rstart);
        }

        // workaround for UTC- timezones
        var rangeStart = ensureDateTime(aRangeStart);
        var rangeEnd = ensureDateTime(aRangeEnd);

        // If aRangeStart falls in the middle of an occurrence, libical will
        // not return that occurrence when we go and ask for an
        // icalrecur_iterator_new.  This actually seems fairly rational, so
        // instead of hacking libical, I'm going to move aRangeStart back far
        // enough to make sure we get the occurrences we might miss.
        var searchStart = rangeStart.clone();
        var baseDuration = this.mBaseItem.duration;
        if (baseDuration) {
            var duration = baseDuration.clone();
            duration.isNegative = true;
            searchStart.addDuration(duration);
        }

        var startDate = this.mBaseItem.recurrenceStartDate;
        var dates = [];

        // toss in exceptions first. Save a map of all exceptions ids, so we
        // don't add the wrong occurrences later on.
        var occurrenceMap = {};
        for (var ex in this.mExceptionMap) {
            var item = this.mExceptionMap[ex];
            var occDate = checkIfInRange(item, aRangeStart, aRangeEnd, true);
            occurrenceMap[ex] = true;
            if (occDate) {
                binaryInsert(dates, { id: item.recurrenceId, rstart: occDate }, ridDateSortComptor);
            }
        }

        // DTSTART/DUE is always part of the (positive) expanded set:
        // DTSTART always equals RECURRENCE-ID for items expanded from RRULE
        var baseOccDate = checkIfInRange(this.mBaseItem, aRangeStart, aRangeEnd, true);
        var baseOccDateKey = getRidKey(baseOccDate);
        if (baseOccDate && !occurrenceMap[baseOccDateKey]) {
            occurrenceMap[baseOccDateKey] = true;
            binaryInsert(dates, { id: baseOccDate, rstart: baseOccDate }, ridDateSortComptor);
        }

        // if both range start and end are specified, we ask for all of the occurrences,
        // to make sure we catch all possible exceptions.  If aRangeEnd isn't specified,
        // then we have to ask for aMaxCount, and hope for the best.
        var maxCount;
        if (rangeStart && rangeEnd) {
            maxCount = 0;
        } else {
            maxCount = aMaxCount;
        }

        // Apply positive rules
        for each (ritem in this.mPositiveRules) {
            var cur_dates = ritem.getOccurrences(startDate,
                                                 searchStart,
                                                 rangeEnd,
                                                 maxCount, {});
            if (cur_dates.length == 0) {
                continue;
            }

            // if positive, we just add these date to the existing set,
            // but only if they're not already there

            var index = 0;
            var len = cur_dates.length;

            // skip items before rangeStart due to searchStart libical hack:
            if (rangeStart && baseDuration) {
                for (; index < len; ++index) {
                    var date = cur_dates[index].clone();
                    date.addDuration(baseDuration);
                    if (rangeStart.compare(date) < 0) {
                        break;
                    }
                }
            }
            for (; index < len; ++index) {
                var date = cur_dates[index];
                var dateKey = getRidKey(date);
                if (occurrenceMap[dateKey]) {
                    // Don't add occurrences twice (i.e exception was
                    // already added before)
                    continue;
                }
                // TODO if cur_dates[] is also sorted, then this binary
                // search could be optimized further
                binaryInsert(dates, { id: date, rstart: date }, ridDateSortComptor);
                occurrenceMap[dateKey] = true;
            }
        }

        // Apply negative rules
        for each (ritem in this.mNegativeRules) {
            var cur_dates = ritem.getOccurrences(startDate,
                                                 searchStart,
                                                 rangeEnd,
                                                 maxCount, {});
            if (cur_dates.length == 0) {
                continue;
            }

            // XXX: i'm pretty sure negative dates can't really have exceptions
            // (like, you can't make a date "real" by defining an RECURRENCE-ID which
            // is an EXDATE, and then giving it a real DTSTART) -- so we don't
            // check exceptions here
            for each (var dateToRemove in cur_dates) {
                var dateToRemoveKey = getRidKey(dateToRemove);
                if (occurrenceMap[dateToRemoveKey]) {
                    // TODO PERF Theoretically we could use occurrence map
                    // to construct the array of occurrences. Right now I'm
                    // just using the occurrence map to skip the filter
                    // action if the occurrence isn't there anyway.
                    dates = dates.filter(function (d) { return d.id.compare(dateToRemove) != 0; });
                    delete occurrenceMap[dateToRemoveKey];
                }
            }
        }

        // The list was already sorted above, chop anything over aMaxCount, if
        // specified.
        if (aMaxCount && dates.length > aMaxCount) {
            dates = dates.splice(aMaxCount, dates.length - aMaxCount);
        }

        return dates;
    },

    getOccurrenceDates: function cRI_getOccurrenceDates(aRangeStart,
                                                        aRangeEnd,
                                                        aMaxCount,
                                                        aCount) {
        var dates = this.calculateDates(aRangeStart, aRangeEnd, aMaxCount);
        dates = dates.map(function(d) { return d.rstart; });
        aCount.value = dates.length;
        return dates;
    },

    getOccurrences: function cRI_getOccurrences(aRangeStart,
                                                aRangeEnd,
                                                aMaxCount,
                                                aCount) {
        var results = [];
        var dates = this.calculateDates(aRangeStart, aRangeEnd, aMaxCount);
        if (dates.length) {
            var count = aMaxCount;
            if (!count)
                count = dates.length;

            for (var i = 0; i < count; i++) {
                results.push(this.getOccurrenceFor(dates[i].id));
            }
        }

        aCount.value = results.length;
        return results;
    },

    getOccurrenceFor: function cRI_getOccurrenceFor(aRecurrenceId) {
        var proxy = this.getExceptionFor(aRecurrenceId, false);
        if (!proxy) {
            var duration = null;

            var name = "DTEND";
            if (isToDo(this.mBaseItem))
                name = "DUE";

            if (this.mBaseItem.hasProperty(name)) {
                duration = this.mBaseItem.duration;
            }

            proxy = this.mBaseItem.createProxy();
            proxy.recurrenceId = aRecurrenceId;
            proxy.setProperty("DTSTART", aRecurrenceId.clone());
            if (duration) {
                var enddate = aRecurrenceId.clone();
                enddate.addDuration(duration);
                proxy.setProperty(name, enddate);
            }
            if (!this.mBaseItem.isMutable) {
                proxy.makeImmutable();
            }
        }
        return proxy;
    },

    removeOccurrenceAt: function cRI_removeOccurrenceAt(aRecurrenceId) {
        this.ensureBaseItem();
        this.ensureMutable();

        var d = Components.classes["@mozilla.org/calendar/recurrence-date;1"]
                          .createInstance(Components.interfaces.calIRecurrenceDate);
        d.isNegative = true;
        d.date = aRecurrenceId.clone();

        this.removeExceptionFor(d.date);

        this.appendRecurrenceItem(d);
    },

    restoreOccurrenceAt: function cRI_restoreOccurrenceAt(aRecurrenceId) {
        this.ensureBaseItem();
        this.ensureMutable();
        this.ensureSortedRecurrenceRules();

        for (var i = 0; i < this.mRecurrenceItems.length; i++) {
            if (calInstanceOf(this.mRecurrenceItems[i], Components.interfaces.calIRecurrenceDate)) {
                var rd = this.mRecurrenceItems[i].QueryInterface(Components.interfaces.calIRecurrenceDate);
                if (rd.isNegative && rd.date.compare(aRecurrenceId) == 0) {
                    return this.deleteRecurrenceItemAt(i);
                }
            }
        }

        throw Components.results.NS_ERROR_INVALID_ARG;
    },

    //
    // exceptions
    //

    //
    // Some notes:
    //
    // The way I read ICAL, RECURRENCE-ID is used to specify a
    // particular instance of a recurring event, according to the
    // RRULEs/RDATEs/etc. specified in the base event.  If one of
    // these is to be changed ("an exception"), then it can be
    // referenced via the UID of the original event, and a
    // RECURRENCE-ID of the start time of the instance to change.
    // This, to me, means that an event where one of the instances has
    // changed to a different time has a RECURRENCE-ID of the original
    // start time, and a DTSTART/DTEND representing the new time.
    //
    // ITIP, however, seems to want something different -- you're
    // supposed to use UID/RECURRENCE-ID to select from the current
    // set of occurrences of an event.  If you change the DTSTART for
    // an instance, you're supposed to use the old (original) DTSTART
    // as the RECURRENCE-ID, and put the new time as the DTSTART.
    // However, after that change, to refer to that instance in the
    // future, you have to use the modified DTSTART as the
    // RECURRENCE-ID.  This madness is described in ITIP end of
    // section 3.7.1.
    //
    // This implementation does the first approach (RECURRENCE-ID will
    // never change even if DTSTART for that instance changes), which
    // I think is the right thing to do for CalDAV; I don't know what
    // we'll do for incoming ITIP events though.
    //
    modifyException: function cRI_modifyException(anItem, aTakeOverOwnership) {
        this.ensureBaseItem();

        anItem = calTryWrappedJSObject(anItem);

        if (anItem.parentItem.calendar != this.mBaseItem.calendar &&
            anItem.parentItem.id != this.mBaseItem.id)
        {
            ERROR("recurrenceInfo::addException: item parentItem != this.mBaseItem (calendar/id)!");
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        if (anItem.recurrenceId == null) {
            ERROR("recurrenceInfo::addException: item with null recurrenceId!");
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        var itemtoadd;
        if (aTakeOverOwnership && anItem.isMutable) {
            itemtoadd = anItem;
            itemtoadd.parentItem = this.mBaseItem;
        } else {
            itemtoadd = anItem.cloneShallow(this.mBaseItem);
        }
        itemtoadd.makeImmutable();

        // we're going to assume that the recurrenceId is valid here,
        // because presumably the item came from one of our functions

        var exKey = getRidKey(itemtoadd.recurrenceId);
        this.mExceptionMap[exKey] = itemtoadd;
    },

    createExceptionFor: function cRI_createExceptionFor(aRecurrenceId) {
        this.ensureBaseItem();

        // XX should it be an error to createExceptionFor
        // an already-existing recurrenceId?
        var existing = this.getExceptionFor(aRecurrenceId, false);
        if (existing)
            return existing;

        // check if aRecurrenceId is valid.

        // this is a bit of a hack; we know that ranges are defined as [start, end),
        // so we do a search on aRecurrenceId and aRecurrenceId.seconds + 1.
        var rangeStart = aRecurrenceId;
        var rangeEnd = aRecurrenceId.clone();
        rangeEnd.second += 1;

        var dates = this.getOccurrenceDates(rangeStart, rangeEnd, 1, {});
        var found = false;
        for each (d in dates) {
            if (d.compare(aRecurrenceId) == 0) {
                found = true;
                break;
            }
        }

        // not found; the recurrence id is invalid
        if (!found)
            throw Components.results.NS_ERROR_INVALID_ARG;

        var rid = aRecurrenceId.clone();
        rid.makeImmutable();

        var newex = this.mBaseItem.createProxy();
        newex.recurrenceId = rid;
        this.mExceptionMap[getRidKey(rid)] = newex;

        return newex;
    },

    getExceptionFor: function cRI_getExceptionFor(aRecurrenceId, aCreate) {
        this.ensureBaseItem();

        var exc = this.mExceptionMap[getRidKey(aRecurrenceId)];
        if (exc) {
            return exc;
        } else if (aCreate) {
            return this.createExceptionFor(aRecurrenceId);
        }
        return null;
    },

    removeExceptionFor: function cRI_removeExceptionFor(aRecurrenceId) {
        this.ensureBaseItem();
        delete this.mExceptionMap[getRidKey(aRecurrenceId)];
    },

    getExceptionIds: function cRI_getExceptionIds(aCount) {
        this.ensureBaseItem();

        var ids = [];
        for each (var item in this.mExceptionMap) {
            ids.push(item.recurrenceId);
        }

        aCount.value = ids.length;
        return ids;
    },

    // changing the startdate of an item needs to take exceptions into account.
    // in case we're about to modify a parentItem (aka 'folded' item), we need
    // to modify the recurrenceId's of all possibly existing exceptions as well.
    onStartDateChange: function cRI_onStartDateChange(aNewStartTime, aOldStartTime) {

        // passing null for the new starttime would indicate an error condition,
        // since having a recurrence without a starttime is invalid.
        if (!aNewStartTime) {
            throw Components.results.NS_ERROR_INVALID_ARG;
        }

        // no need to check for changes if there's no previous starttime.
        if (!aOldStartTime) {
            return;
        }

        // convert both dates to UTC since subtractDate is not timezone aware.
        var timeDiff = aNewStartTime.getInTimezone(UTC()).subtractDate(aOldStartTime.getInTimezone(UTC()));

        var rdates = {};

        // take RDATE's and EXDATE's into account.
        const kCalIRecurrenceDate = Components.interfaces.calIRecurrenceDate;
        const kCalIRecurrenceDateSet = Components.interfaces.calIRecurrenceDateSet;
        var ritems = this.getRecurrenceItems({});
        for each (var ritem in ritems) {
            if (calInstanceOf(ritem, kCalIRecurrenceDate)) {
                ritem = ritem.QueryInterface(kCalIRecurrenceDate);
                var date = ritem.date;
                date.addDuration(timeDiff);
                if (!ritem.isNegative) {
                    rdates[getRidKey(date)] = date;
                }
                ritem.date = date;
            } else if (calInstanceOf(ritem, kCalIRecurrenceDateSet)) {
                ritem = ritem.QueryInterface(kCalIRecurrenceDateSet);
                var rdates = ritem.getDates({});
                for each (var date in rdates) {
                    date.addDuration(timeDiff);
                    if (!ritem.isNegative) {
                        rdates[getRidKey(date)] = date;
                    }
                }
                ritem.setDates(rdates.length,rdates);
            } else if (calInstanceOf(ritem, Components.interfaces.calIRecurrenceRule)) {
                ritem = ritem.QueryInterface(Components.interfaces.calIRecurrenceRule);
                if (!ritem.isByCount) {
                    var endDate = ritem.endDate;
                    if (endDate) {
                        endDate.addDuration(timeDiff);
                        ritem.endDate = endDate;
                    }
                }
            }
        }

        var startTimezone = aNewStartTime.timezone;
        var exceptions = this.getExceptionIds({});
        var modifiedExceptions = [];
        for each (var exid in exceptions) {
            var ex = this.getExceptionFor(exid, false);
            if (ex) {
                ex = ex.clone();
                // track RECURRENCE-IDs in DTSTART's or RDATE's timezone,
                // otherwise those won't match any longer w.r.t DST:
                var rid = ex.recurrenceId;
                rid = rid.getInTimezone(rdates[getRidKey(rid)]
                                        ? rdates[getRidKey(rid)].timezone
                                        : startTimezone);
                rid.addDuration(timeDiff);
                ex.recurrenceId = rid;

                modifiedExceptions.push(ex);
                this.removeExceptionFor(exid);
            }
        }
        for each (var modifiedEx in modifiedExceptions) {
            this.modifyException(modifiedEx, true);
        }
    }
};
