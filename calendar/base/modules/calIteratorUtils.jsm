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
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
Components.utils.import("resource://gre/modules/Services.jsm");

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this

/**
 * Iterates an array of items, i.e. the passed item including all
 * overridden instances of a recurring series.
 *
 * @param items array of items
 */
cal.itemIterator = function cal_itemIterator(items) {
    return {
        __iterator__: function itemIterator(aWantKeys) {
            cal.ASSERT(aWantKeys, "Please use for() on the item iterator");
            for each (let item in items) {
                yield item;
                let rec = item.recurrenceInfo;
                if (rec) {
                    for each (let exid in rec.getExceptionIds({})) {
                        yield rec.getExceptionFor(exid);
                    }
                }
            }
        }
    };
};

/**
 * Runs the body() function once for each item in the iterator using the event
 * queue to make sure other actions could run inbetween. When all iterations are
 * done (and also when cal.forEach.BREAK is returned), calls the completed()
 * function if passed.
 *
 * If you would like to break or continue inside the body(), return either
 *     cal.forEach.BREAK or cal.forEach.CONTINUE
 *
 * Note since the event queue is used, this function will return immediately,
 * before the iteration is complete. If you need to run actions after the real
 * for each loop, use the optional completed() function.
 *
 * @param iter          The Iterator to go through in this loop.
 * @param body          The function called for each iteration. Its parameter is
 *                          the single item from the iterator.
 * @param completed     [optional] The function called after the loop completes.
 */
cal.forEach = function cal_forEach(iter, body, completed) {
    // This should be a const one day, lets keep it a pref for now though until we
    // find a sane value.
    let LATENCY = cal.getPrefSafe("calendar.threading.latency", 250);

    let ourIter = iter;
    if (!(iter instanceof Iterator)) {
        // If its not an iterator, we need to use a generator expression to make
        // sure calling this function feels right.
        ourIter = (i for each (i in iter));
    }

    let currentThread = Services.tm.currentThread;

    // This is our dispatcher, it will be used for the iterations
    let dispatcher = {
        run: function run() {
            try {
                let startTime = (new Date()).getTime();
                while (((new Date()).getTime()  - startTime) < LATENCY) {
                    let next = ourIter.next();
                    let rc = body(next);
                    if (rc == cal.forEach.BREAK) {
                        throw StopIteration;
                    }
                }
            } catch (e if e instanceof StopIteration) {
                // Iterating is done, return early to avoid resubmitting to the
                // event queue again. If there is a completed function, run it.
                if (completed) {
                    completed();
                }
                return;
            }

            currentThread.dispatch(this, currentThread.DISPATCH_NORMAL);
        }
    };

    currentThread.dispatch(dispatcher, currentThread.DISPATCH_NORMAL);
};

cal.forEach.CONTINUE = 1;
cal.forEach.BREAK = 2;

/**
 * "ical" namespace. Used for all iterators (and possibly other functions) that
 * are related to libical.
 */
cal.ical = {
    /**
     *  Yields all subcomponents in all calendars in the passed component.
     *  - If the passed component is an XROOT (contains multiple calendars),
     *    then go through all VCALENDARs in it and get their subcomponents.
     *  - If the passed component is a VCALENDAR, iterate through its direct
     *    subcomponents.
     *  - Otherwise assume the passed component is the item itself and yield
     *    only the passed component.
     *
     * This iterator can only be used in a for() block:
     *   for (let component in cal.ical.calendarComponentIterator(aComp)) { ... }
     *
     *  @param aComponent       The component to iterate given the above rules.
     *  @param aCompType        The type of item to iterate.
     *  @return                 The iterator that yields all items.
     */
    calendarComponentIterator: function cal_ical_calendarComponentIterator(aComponent, aCompType) {
        let compType = (aCompType || "ANY");
        if (aComponent && aComponent.componentType == "VCALENDAR") {
            return cal.ical.subcomponentIterator(aComponent, compType);
        } else if (aComponent && aComponent.componentType == "XROOT") {
            function calVCALENDARIterator(aWantKeys) {
                cal.ASSERT(aWantKeys, "Please use for() on the calendar component iterator");
                for (let calComp in cal.ical.subcomponentIterator(aComponent, "VCALENDAR")) {
                    for (let itemComp in cal.ical.subcomponentIterator(calComp, compType)) {
                        yield itemComp;
                    }
                }
            };
            return { __iterator__: calVCALENDARIterator };
        } else if (aComponent && (compType == "ANY" || compType == aComponent.componentType)) {
            return {
                __iterator__: function singleItemIterator(aWantKeys) {
                    cal.ASSERT(aWantKeys, "Please use for() on the calendar component iterator");
                    yield aComponent;
                }
            }
        } else {
            return Iterator({});
        }
    },

    /**
     * Use to iterate through all subcomponents of a calIIcalComponent. This
     * iterators depth is 1, this means no sub-sub-components will be iterated.
     *
     * This iterator can only be used in a for() block:
     *   for (let component in cal.ical.subcomponentIterator(aComp)) { ... }
     *
     * @param aComponent        The component who's subcomponents to iterate.
     * @param aSubcomp          (optional) the specific subcomponent to
     *                            enumerate. If not given, "ANY" will be used.
     * @return                  An iterator object to iterate the properties.
     */
    subcomponentIterator: function cal_ical_subcomponentIterator(aComponent, aSubcomp) {
        return {
            __iterator__: function icalSubcompIterator(aWantKeys) {
                cal.ASSERT(aWantKeys, "Please use for() on the subcomponent iterator");
                let subcompName = (aSubcomp || "ANY");
                for (let subcomp = aComponent.getFirstSubcomponent(subcompName);
                     subcomp;
                     subcomp = aComponent.getNextSubcomponent(subcompName)) {
                    yield subcomp;
                }
            }
        };
    },

    /**
     * Use to iterate through all properties of a calIIcalComponent.
     * This iterator can only be used in a for() block:
     *   for (let property in cal.ical.propertyIterator(aComp)) { ... }
     *
     * @param aComponent        The component to iterate.
     * @param aProperty         (optional) the specific property to enumerate.
     *                            If not given, "ANY" will be used.
     * @return                  An iterator object to iterate the properties.
     */
    propertyIterator: function cal_ical_propertyIterator(aComponent, aProperty) {
        return {
            __iterator__: function icalPropertyIterator(aWantKeys) {
                cal.ASSERT(aWantKeys, "Please use for() on the property iterator");
                let propertyName = (aProperty || "ANY");
                for (let prop = aComponent.getFirstProperty(propertyName);
                     prop;
                     prop = aComponent.getNextProperty(propertyName)) {
                    yield prop;
                }
            }
        };
    },

    /**
     * Use to iterate through all parameters of a calIIcalProperty.
     * This iterator behaves similar to the object iterator. Possible uses:
     *   for (let paramName in cal.ical.paramIterator(prop)) { ... }
     * or:
     *   for each (let [paramName, paramValue] in cal.ical.paramIterator(prop)) { ... }
     *
     * @param aProperty         The property to iterate.
     * @return                  An iterator object to iterate the properties.
     */
    paramIterator: function cal_ical_paramIterator(aProperty) {
        return {
            __iterator__: function icalParamIterator(aWantKeys) {
                for (let paramName = aProperty.getFirstParameterName();
                     paramName;
                     paramName = aProperty.getNextParameterName()) {
                    yield (aWantKeys ? paramName :
                           [paramName, aProperty.getParameter(paramName)]);
                }
            }
        }
    }
};

