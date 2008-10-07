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

// New code must not load/import calUtils.js, but should use calUtils.jsm.

var EXPORTED_SYMBOLS = ["cal"];
let cal = {
    // new code should land here,
    // and more code should be moved from calUtils.js into this object to avoid
    // clashes with other extensions

    getIOService: generateServiceAccessor("@mozilla.org/network/io-service;1",
                                          Components.interfaces.nsIIOService2),

    /**
     * Checks whether a timezone lacks a definition.
     */
    isPhantomTimezone: function cal_isPhantomTimezone(tz) {
        return (!tz.icalComponent && !tz.isUTC && !tz.isFloating);
    },

    // The below functions will move to some different place once the
    // unifinder tress are consolidated.

    compareNativeTime: function cal_compareNativeTime(a, b) {
      return (a < b ? -1 :
              a > b ?  1 : 0);
    },

    compareNumber: function cal_compareNumber(a, b) {
      a = Number(a);
      b = Number(b);
      return ((a < b) ? -1 :      // avoid underflow problems of subtraction
              (a > b) ?  1 : 0);
    },

    sortEntryComparer: function cal_sortEntryComparer(sortType, modifier) {
      switch (sortType) {
        case "number":
          function compareNumbers(sortEntryA, sortEntryB) {
            var nsA = cal.sortEntryKey(sortEntryA);
            var nsB = cal.sortEntryKey(sortEntryB);
            return cal.compareNumber(nsA, nsB) * modifier;
          }
          return compareNumbers;
        case "date":
          function compareTimes(sortEntryA, sortEntryB) {
            var nsA = cal.sortEntryKey(sortEntryA);
            var nsB = cal.sortEntryKey(sortEntryB);
            return cal.compareNativeTime(nsA, nsB) * modifier;
          }
          return compareTimes;
        case "string":
          var collator = cal.createLocaleCollator();
          function compareStrings(sortEntryA, sortEntryB) {
            var sA = cal.sortEntryKey(sortEntryA);
            var sB = cal.sortEntryKey(sortEntryB);
            if (sA.length == 0 || sB.length == 0) {
              // sort empty values to end (so when users first sort by a
              // column, they can see and find the desired values in that
              // column without scrolling past all the empty values).
              return -(sA.length - sB.length) * modifier;
            }
            var comparison = collator.compareString(0, sA, sB);
            return comparison * modifier;
          }
          return compareStrings;

        default:
          function compareOther(sortEntryA, sortEntryB) {
            return 0;
          }
          return compareOther;
      }
    },

    getItemSortKey: function cal_getItemSortKey(aItem, aKey, aStartTime) {
      switch(aKey) {
        case "priority":
          return aItem.priority || 5;

        case "title":
          return aItem.title || "";

        case "entryDate":
            return cal.nativeTimeOrNow(aItem.entryDate, aStartTime);
        case "startDate":
            return cal.nativeTimeOrNow(aItem.startDate, aStartTime);

        case "dueDate":
          return cal.nativeTimeOrNow(aItem.dueDate, aStartTime);

        case "endDate":
          return cal.nativeTimeOrNow(aItem.endDate, aStartTime);
        case "completedDate":
                  // XXX: is this right ??
          return cal.nativeTimeOrNow(aItem.completedDate, aStartTime);

        case "percentComplete":
          return aItem.percentComplete;

        case "categories":
          return aItem.getCategories({}).join(", ");

        case "location":
          return aItem.getProperty("LOCATION") || "";

        case "status":
          if (isToDo(aItem))
            return ["NEEDS-ACTION", "IN-PROCESS", "COMPLETED", "CANCELLED" ].indexOf(aItem.status);
          else
            return ["TENTATIVE", "CONFIRMED", "CANCELLED"].indexOf(aItem.status);
        case "calendar":
          return aItem.calendar.name || "";

        default:
          return null;
      }
    },

    getSortTypeForSortKey: function cal_getSortTypeForSortKey(aSortKey) {
      switch(aSortKey) {
        case "title":
        case "categories":
        case "location":
        case "calendar":
          return "string";

        case "completedDate":
        case "entryDate":
        case "dueDate":
        case "startDate":
        case "endDate":
          return "date";

        case "priority":
        case "percentComplete":
        case "status":
          return "number";
      }
    },

    nativeTimeOrNow: function cal_nativeTimeOrNow(calDateTime, sortStartedTime) {
        // Treat null/0 as 'now' when sort started, so incomplete tasks stay current.
        // Time is computed once per sort (just before sort) so sort is stable.
        if (calDateTime == null) {
            return sortStartedTime.nativeTime;
        }
        var ns = calDateTime.nativeTime;
        if (ns == -62168601600000000) { // ns value for (0000/00/00 00:00:00)
            return sortStartedTime;
        }
        return ns;
    },

    sortEntry: function cal_sortEntry(aItem) {
        var key = cal.getItemSortKey(aItem, this.mSortKey, this.mSortStartedDate);
        return {mSortKey : key, mItem: aItem};
    },

    sortEntryItem: function cal_sortEntryItem(sortEntry) {
        return sortEntry.mItem;
    },

    sortEntryKey: function cal_sortEntryKey(sortEntry) {
        return sortEntry.mSortKey;
    },

    createLocaleCollator: function cal_createLocaleCollator() {
      var localeService = generateServiceAccessor("@mozilla.org/intl/nslocaleservice;1");
      return generateServiceAccessor("@mozilla.org/intl/collation-factory;1")
            .CreateCollation(localeService.getApplicationLocale());
     },

    /**
     * Sort an array of strings according to the current locale.
     * Modifies aStringArray, returning it sorted.
     */
    sortArrayByLocaleCollator: function cal_sortArrayByLocaleCollator(aStringArray) {
        var localeCollator = cal.createLocaleCollator();
        function compare(a, b) { return localeCollator.compareString(0, a, b); }
        aStringArray.sort(compare);
        return aStringArray;
    }

};

// local to this module;
// will be used to generate service accessor functions, getIOService()
function generateServiceAccessor(id, iface) {
    return function this_() {
        if (this_.mService === undefined) {
            this_.mService = Components.classes[id].getService(iface);
        }
        return this_.mService;
    };
}

// Interim import of all symbols into cal:
// This should serve as a clean start for new code, e.g. new code could use
// cal.createDatetime instead of plain createDatetime NOW.
let calUtils = __LOCATION__.parent.parent.clone();
calUtils.append("js");
calUtils.append("calUtils.js");
Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
          .getService(Components.interfaces.mozIJSSubScriptLoader)
          .loadSubScript(cal.getIOService().newFileURI(calUtils).spec, cal);

