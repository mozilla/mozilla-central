/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Object that contains a set of filter properties that may be used by a calFilter object
 * to filter a set of items.
 * Supported filter properties:
 *   start, end:   Specifies the relative date range to use when calculating the filter date 
 *               range. The relative date range may relative to the current date and time, the
 *               currently selected date, or the dates range of the current view. The actual 
 *               date range used to filter items will be calculated by the calFilter object 
 *               by using the updateFilterDates function, which may be called multiple times 
 *               to reflect changes in the current date and time, and changes to the view.
 *
 *
 *                 The properties may be set to one of the folowing values:
 *               - FILTER_DATE_ALL: An unbound date range.
 *               - FILTER_DATE_XXX: One of the defined relative date ranges.
 *               - A string that may be converted to a calIDuration object that will be used
 *                 as an offset to the current date and time.
 *
 *                 The start and end properties may have values representing different relative 
 *               date ranges, in which case the filter start date will be calculated as the start
 *               of the relative range specified by the start property, while the filter end date
 *               will be calculated as the end of the relative range specified by the end 
 *               property.
 *
 *   due:          Specifies the filter property for the due date of tasks. This filter has no
 *               effect when filtering events. 
 *
 *                 The property has a bit field value, with the FILTER_DUE_XXX bit flags set 
 *               to indicate that tasks with the corresponding due property value should match
 *               the filter.
 *
 *                 If the value is set to null the due date will not be considered when filtering.
 *
 *   status:       Specifies the filter property for the status of tasks. This filter has no 
 *               effect when filtering events.
 *
 *                 The property has a bit field value, with the FILTER_STATUS_XXX bit flags set 
 *               to indicate that tasks with the corresponding status property value should match
 *               the filter.
 *
 *                 If the value is set to null the status will not be considered when filtering.
 *
 *   category:     Specifies the filter property for the item category.
 *
 *                 The property may be set to one of the folowing values:
 *               - null: The item category will not be considered when filtering.
 *               - A string: The item will match the filter if any of it's categories match the 
 *               category specified by the property.
 *               - An array: The item will match the filter if any of it's categories match any
 *               of the categories contained in the Array specified by the property.
 *
 *   onfilter:     A callback function that may be used to apply additional custom filter 
 *               constraints. If specified, the callback function will be called after any other
 *               specified filter properties are tested.
 *
 *                 The callback function will be called with the following parameters:
 *               - function(aItem, aResults, aFilterProperties, aFilter)
 *                   @param aItem               The item being tested.
 *                   @param aResults            The results of the test of the other specified
 *                                              filter properties.
 *                   @param aFilterProperties   The current filter properties being tested.
 *                   @param aFilter             The calFilter object performing the filter test.
 *
 *                 If specified, the callback function is responsible for returning a value that
 *               can be converted to true if the item should match the filter, or a value that 
 *               can be converted to false otherwise. The return value will override the results
 *               of the testing of any other specified filter properties.
 */
function calFilterProperties() {
    this.wrappedJSObject = this;
}

calFilterProperties.prototype = {
    FILTER_DATE_ALL: 0,
    FILTER_DATE_VIEW: 1,
    FILTER_DATE_SELECTED: 2,
    FILTER_DATE_SELECTED_OR_NOW: 3,
    FILTER_DATE_NOW: 4,
    FILTER_DATE_TODAY: 5,
    FILTER_DATE_CURRENT_WEEK: 6,
    FILTER_DATE_CURRENT_MONTH: 7,
    FILTER_DATE_CURRENT_YEAR: 8,

    FILTER_STATUS_INCOMPLETE: 1,
    FILTER_STATUS_IN_PROGRESS: 2,
    FILTER_STATUS_COMPLETED_TODAY: 4,
    FILTER_STATUS_COMPLETED_BEFORE: 8,
    FILTER_STATUS_ALL: 15,

    FILTER_DUE_PAST: 1,
    FILTER_DUE_TODAY: 2,
    FILTER_DUE_FUTURE: 4,
    FILTER_DUE_NONE: 8,
    FILTER_DUE_ALL: 15,

    start: null,
    end: null,
    due: null,
    status: null,
    category: null,

    onfilter: null,
    
    equals: function cFP_equals(aFilterProps) {
        if (!(aFilterProps instanceof calFilterProperties)) {
            return false;
        }
        let props = ["start", "end", "due", "status", "category", "onfilter"];
        return props.every(function(prop) {
            return (this[prop] == aFilterProps[prop]);
        }, this);
    },

    clone: function cFP_clone() {
        let cl = new calFilterProperties();
        let props = ["start", "end", "due", "status", "category", "onfilter"];
        props.forEach(function(prop) {
            cl[prop] = this[prop];
        }, this);

        return cl;
    },

    LOG: function cFP_LOG(aString) {
        cal.LOG("[calFilterProperties] " +
                (aString || "") +
                "\n  start: " + this.start +
                "\n  end: " + this.end +
                "\n  status: " + this.status +
                "\n  due: " + this.due +
                "\n  category: " + this.category);
    }
};

/**
 * Object that allows filtering of a set of items using a set of filter properties. A set
 * of property filters may be defined by a filter name, which may then be used to apply 
 * the defined filter properties. A set of commonly used property filters are predefined.
 */
function calFilter() {
    this.wrappedJSObject = this;
    this.mFilterProperties = new calFilterProperties();
    this.initDefinedFilters();
}

calFilter.prototype = {
    mStartDate: null,
    mEndDate: null,
    mSelectedDate: null,
    mFilterText: "",
    mDefinedFilters: {},
    mFilterProperties: null,
    mToday: null,
    mTomorrow: null,

    /**
     * Initializes the predefined filters.
     */
    initDefinedFilters: function cF_initDefinedFilters() {
        let filters = ["all", "notstarted", "overdue", "open", "completed", "throughcurrent", 
                       "throughtoday", "throughsevendays", "today", "thisCalendarMonth", 
                       "future", "current", "currentview"];
        filters.forEach(function(filter) {
            if (!(filter in this.mDefinedFilters)) {
                this.defineFilter(filter, this.getPreDefinedFilterProperties(filter));
            }
        }, this);
    },

    /**
     * Gets the filter properties for a predefined filter.
     *
     * @param aFilter   The name of the filter to retrieve the filter properties for.
     * @result          The filter properties for the specified filter, or null if the filter 
     *                  not predefined.
     */
    getPreDefinedFilterProperties: function cF_getPreDefinedFilterProperties(aFilter) {
        let props = new calFilterProperties();

        if (!aFilter) {
            return props;
        }

        switch (aFilter) {

            // Predefined Task filters
            case "notstarted":
                props.status = props.FILTER_STATUS_INCOMPLETE;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_SELECTED_OR_NOW;
                break;
            case "overdue":
                props.status = props.FILTER_STATUS_INCOMPLETE | props.FILTER_STATUS_IN_PROGRESS;
                props.due = props.FILTER_DUE_PAST;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_SELECTED_OR_NOW;
                break;
            case "open":
                props.status = props.FILTER_STATUS_INCOMPLETE | props.FILTER_STATUS_IN_PROGRESS;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_SELECTED_OR_NOW;
                break;
            case "completed":
                props.status = props.FILTER_STATUS_COMPLETED_TODAY | props.FILTER_STATUS_COMPLETED_BEFORE;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_SELECTED_OR_NOW;
                break;
            case "throughcurrent":
                props.status = props.FILTER_STATUS_INCOMPLETE | props.FILTER_STATUS_IN_PROGRESS | 
                               props.FILTER_STATUS_COMPLETED_TODAY;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_SELECTED_OR_NOW;
                break;
            case "throughtoday":
                props.status = props.FILTER_STATUS_INCOMPLETE | props.FILTER_STATUS_IN_PROGRESS | 
                               props.FILTER_STATUS_COMPLETED_TODAY;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_TODAY;
                break;
            case "throughsevendays":
                props.status = props.FILTER_STATUS_INCOMPLETE | props.FILTER_STATUS_IN_PROGRESS | 
                               props.FILTER_STATUS_COMPLETED_TODAY;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = "P7D";
                break;

            // Predefined Event filters
            case "today":
                props.start = props.FILTER_DATE_TODAY;
                props.end = props.FILTER_DATE_TODAY;
                break;
            case "thisCalendarMonth":
                props.start = props.FILTER_DATE_CURRENT_MONTH;
                props.end = props.FILTER_DATE_CURRENT_MONTH;
                break;
            case "future":
                props.start = props.FILTER_DATE_NOW;
                props.end = props.FILTER_DATE_ALL;
                break;
            case "current":
                props.start = props.FILTER_DATE_SELECTED;
                props.end = props.FILTER_DATE_SELECTED;
                break;
            case "currentview":
                props.start = props.FILTER_DATE_VIEW;
                props.end = props.FILTER_DATE_VIEW;
                break;

            case "all":
            default:
                props.status = props.FILTER_STATUS_ALL;
                props.due = props.FILTER_DUE_ALL;
                props.start = props.FILTER_DATE_ALL;
                props.end = props.FILTER_DATE_ALL;
        }

        return props;
    },

    /**
     * Defines a set of filter properties so that they may be applied by the filter name. If
     * the specified filter name is already defined, it's associated filter properties will be 
     * replaced.
     *
     * @param aFilterName         The name to define the filter properties as.
     * @param aFilterProperties   The filter properties to define.
     */
    defineFilter: function cF_defineFilter(aFilterName, aFilterProperties) {
        if (!(aFilterProperties instanceof calFilterProperties)) {
            return;
        }

        this.mDefinedFilters[aFilterName] = aFilterProperties;
    },

    /**
     * Returns the set of filter properties that were previously defined by a filter name.
     *
     * @param aFilter             The filter name of the defined filter properties.
     * @return                    The properties defined by the filter name, or null if
     *                            the filter name was not previously defined.
     */
    getDefinedFilterProperties: function cF_getDefinedFilterProperties(aFilter) {
        if (aFilter in this.mDefinedFilters) {
            return this.mDefinedFilters[aFilter].clone();
        } else {
            return null;
        }
    },

    /**
     * Returns the filter name that a set of filter properties were previously defined as.
     *
     * @param aFilterProperties   The filter properties previously defined.
     * @return                    The name of the first filter name that the properties 
     *                            were defined as, or null if the filter properties were
     *                            not previously defined.
     */
    getDefinedFilterName: function cF_getDefinedFilterName(aFilterProperties) {
        for (filter in this.mDefinedFilters) {
            if (this.mDefinedFilters[filter].equals(aFilterProperties)) {
                return filter;
            }
        }
        return null;
    },

    /**
     * Checks if the item matches the current filter text
     *
     * @param aItem               The item to check.
     * @return                    Returns true if the item matches the filter text or no
     *                            filter text has been set, false otherwise.
     */
    textFilter: function cF_filterByText(aItem) {
        if (!this.mFilterText) {
            return true;
        }

        let searchText = this.mFilterText.toLowerCase();

        if (!searchText.length || searchText.match(/^\s*$/)) {
            return true;
        }

        //XXX TODO: Support specifying which fields to search on
        for each (let field in ["SUMMARY", "DESCRIPTION", "LOCATION", "URL"]) {
            let val = aItem.getProperty(field);
            if (val && val.toLowerCase().indexOf(searchText) != -1) {
                return true;
            }
        }

        return aItem.getCategories({}).some(function(cat) {
            return (cat.toLowerCase().indexOf(searchText) != -1);
        });
    },

    /**
     * Checks if the item matches the current filter date range.
     *
     * @param aItem               The item to check.
     * @return                    Returns true if the item falls within the date range
     *                            specified by mStartDate and mEndDate, false otherwise.
     */
    dateRangeFilter: function cF_dateRangeFilter(aItem) {
        return checkIfInRange(aItem, this.mStartDate, this.mEndDate);
    },

    /**
     * Checks if the item matches the currently applied filter properties. Filter properties
     * with a value of null or that are not applicable to the item's type are not tested.
     *
     * @param aItem               The item to check.
     * @return                    Returns true if the item matches the filter properties
     *                            currently applied, false otherwise.
     */
    propertyFilter: function cF_propertyFilter(aItem) {
        let result;
        let props = this.mFilterProperties;
        if (!props) {
            return false;
        }

        // the today and tomorrow properties are precalculated in the updateFilterDates function
        // for better performance when filtering batches of items.
        let today = this.mToday;
        if (!today) {
            today = cal.now();
            today.isDate = true;
        }

        let tomorrow = this.mTomorrow;
        if (!tomorrow) {
            tomorrow = today.clone();
            tomorrow.day++;
        }

        // test the date range of the applied filter.
        result = this.dateRangeFilter(aItem);

        // test the category property. If the property value is an array, only one category must
        // match.
        if (result && props.category) {
            let cats = [];

            if (typeof(props.category) == "string") {
                cats.push(props.category);
            } else if (Array.isArray(props.category)) {
                cats = props.category;
            }
            result = cats.some(function(cat) {
                return aItem.getCategories({}).indexOf(cat) > -1;
            });
        }

        // test the status property. Only applies to tasks.
        if (result && props.status != null && cal.isToDo(aItem)) {
            let completed = aItem.isCompleted;
            let current = !aItem.completedDate || today.compare(aItem.completedDate) <= 0;
            let percent = aItem.percentComplete || 0;

            result = ((props.status & props.FILTER_STATUS_INCOMPLETE) ||
                      !(!completed && (percent == 0))) &&
                     ((props.status & props.FILTER_STATUS_IN_PROGRESS) ||
                      !(!completed && (percent > 0))) &&
                     ((props.status & props.FILTER_STATUS_COMPLETED_TODAY) ||
                      !(completed && current)) &&
                     ((props.status & props.FILTER_STATUS_COMPLETED_BEFORE) ||
                      !(completed && !current));
        }

        // test the due property. Only applies to tasks.
        if (result && props.due != null && cal.isToDo(aItem)) {
            let due = aItem.dueDate;
            let now = cal.now();

            result = ((props.due & props.FILTER_DUE_PAST) ||
                      !(due && (due.compare(now) < 0))) &&
                     ((props.due & props.FILTER_DUE_TODAY) ||
                      !(due && (due.compare(now) >= 0) && (due.compare(tomorrow) < 0))) &&
                     ((props.due & props.FILTER_DUE_FUTURE) ||
                      !(due && (due.compare(tomorrow) >= 0))) &&
                     ((props.due & props.FILTER_DUE_NONE) ||
                      !(due == null));
        }

        // Call the filter properties onfilter callback if set. The return value of the 
        // callback function will override the result of this function.
        if (props.onfilter && (typeof(props.onfilter) == "function")) {
            return props.onfilter(aItem, result, props, this);
        }

        return result;
    },

    /**
     * Calculates the date from a date filter property.
     *
     * @param prop                The value of the date filter property to calculate for. May
     *                            be a constant specifying a relative date range, or a string
     *                            representing a duration offset from the current date time.
     * @param start               If true, the function will return the date value for the 
     *                            start of the relative date range, otherwise it will return the
     *                            date value for the end of the date range.
     * @return                    The calculated date for the property.
     */
    getDateForProperty: function cF_getDateForProperty(prop, start) {
        let props = this.mFilterProperties || new calFilterProperties();
        let result = null;
        let selectedDate = this.mSelectedDate || currentView().selectedDay || cal.now();

        if (typeof(prop) == "string") {
            let duration = cal.createDuration(prop);
            if (duration) {
                result = cal.now();
                result.addDuration(duration);
            }
        } else {
            switch (prop) {
                case props.FILTER_DATE_ALL:
                    result = null;
                    break;
                case props.FILTER_DATE_VIEW:
                    result = start ? currentView().startDay.clone() :
                                     currentView().endDay.clone();
                    break;
                case props.FILTER_DATE_SELECTED:
                    result = selectedDate.clone();
                    result.isDate = true;
                    break;
                case props.FILTER_DATE_SELECTED_OR_NOW:
                    result = selectedDate.clone();
                    if ((start && result.jsDate > cal.now().jsDate) ||
                        (!start && result.jsDate < cal.now().jsDate)) {
                        result = cal.now();
                    }
                    result.isDate = true;
                    break;
                case props.FILTER_DATE_NOW:
                    result = cal.now();
                    break;
                case props.FILTER_DATE_TODAY:
                    result = cal.now();
                    result.isDate = true;
                    break;
                case props.FILTER_DATE_CURRENT_WEEK:
                    result = start ? cal.now().startOfWeek : cal.now().endOfWeek;
                    break;
                case props.FILTER_DATE_CURRENT_MONTH:
                    result = start ? cal.now().startOfMonth : cal.now().endOfMonth;
                    break;
                case props.FILTER_DATE_CURRENT_YEAR:
                    result = start ? cal.now().startOfYear : cal.now().endOfYear;
                    break;
            }

            // date ranges are inclusive, so we need to include the day for the end date
            if (!start && result && prop != props.FILTER_DATE_NOW) {
                result.day++;
            }
        }

        return result;
    },

    /**
     * Calculates the current start and end dates for the currently applied filter.
     *
     * @return                    The current [startDate, endDate] for the applied filter.
     */
    getDatesForFilter: function cfp_getDatesForFilter() {
        let startDate = null;
        let endDate = null;

        if (this.mFilterProperties) {
            startDate = this.getDateForProperty(this.mFilterProperties.start, true);
            endDate = this.getDateForProperty(this.mFilterProperties.end, false);

            // swap the start and end dates if necessary
            if (startDate && endDate && startDate.compare(endDate) > 0) {
                let swap = startDate;
                endDate = startDate;
                startDate = swap;
            }
        }

        return [startDate, endDate];
    },

    /**
     * Gets the start date for the current filter date range.
     *
     * @return:                    The start date of the current filter date range, or null if
     *                             the date range has an unbound start date.
     */
    get startDate() {
        return this.mStartDate;
    },

    /** 
     * Sets the start date for the current filter date range. This will override the date range
     * calculated from the filter properties by the getDatesForFilter function.
     */
    set startDate(aStartDate) {
        return (this.mStartDate = aStartDate);
    },

    /**
     * Gets the end date for the current filter date range.
     *
     * @return:                    The end date of the current filter date range, or null if
     *                             the date range has an unbound end date.
     */
    get endDate() {
        return this.mEndDate;
    },

    /** 
     * Sets the end date for the current filter date range. This will override the date range
     * calculated from the filter properties by the getDatesForFilter function.
     */
    set endDate(aEndDate) {
        return (this.mEndDate = aEndDate);
    },

    /**
     * Gets the value used to perform the text filter.
     */
    get filterText() {
        return this.mFilterText;
    },

    /**
     * Sets the value used to perform the text filter.
     *
     * @param aValue              The string value to use for the text filter.
     */
    set filterText(aValue) {
        return (this.mFilterText = aValue);
    },

    /**
     * Gets the selected date used by the getDatesForFilter function to calculate date ranges
     * that are relative to the selected date.
     */
    get selectedDate() {
        return this.mSelectedDate;
    },

    /**
     * Sets the selected date used by the getDatesForFilter function to calculate date ranges
     * that are relative to the selected date.
     */
    set selectedDate(aSelectedDate) {
        return (this.mSelectedDate = aSelectedDate);
    },

    /**
     * Gets the currently applied filter properties.
     *
     * @return                    The currently applied filter properties.
     */
    get filterProperties() {
        return this.mFilterProperties ? this.mFilterProperties.clone() : null;
    },

    /**
     * Gets the name of the currently applied filter.
     *
     * @return                    The current defined name of the currently applied filter
     *                            properties, or null if the current properties were not
     *                            previously defined.
     */
    get filterName() {
        if (!this.mFilterProperties) {
            return null;
        }

        return this.getDefinedFilterName(this.mFilterProperties);
    },

    /**
     * Applies the specified filter.
     *
     * @param aFilter           The filter to apply. May be one of the following types:
     *                          - a calFilterProperties object specifying the filter properties
     *                          - a String representing a previously defined filter name
     *                          - a String representing a duration offset from now
     *                          - a Function to use for the onfilter callback for a custom filter
     */
    applyFilter: function cF_applyFilter(aFilter) {
        this.mFilterProperties = null;

        if (typeof(aFilter) == "string") {
            if (aFilter in this.mDefinedFilters) {
                this.mFilterProperties = this.getDefinedFilterProperties(aFilter);
            } else {
                let dur = cal.createDuration(aFilter);
                if (dur.inSeconds > 0) {
                    this.mFilterProperties = new calFilterProperties();
                    this.mFilterProperties.start = this.mFilterProperties.FILTER_DATE_NOW;
                    this.mFilterProperties.end = aFilter;
                }
            }
        } else if (typeof(aFilter) == "object" && (aFilter instanceof calFilterProperties)) {
            this.mFilterProperties = aFilter;
        } else if (typeof(aFilter) == "function") {
            this.mFilterProperties = new calFilterProperties();
            this.mFilterProperties.onfilter = aFilter;
        } else {
            this.mFilterProperties = new calFilterProperties();
        }

        if (!this.mFilterProperties) {
            cal.WARN("[calFilter] Unable to apply filter " + aFilter);
        } else {
            this.updateFilterDates();
            this.mFilterProperties.LOG("Applying filter:");
        }
    },

    /**
     * Calculates the current start and end dates for the currently applied filter, and updates
     * the current filter start and end dates. This function can be used to update the date range
     * for date range filters that are relative to the selected date or current date and time.
     *
     * @return                    The current [startDate, endDate] for the applied filter.
     */
    updateFilterDates: function cF_updateFilterDates() {
        let [startDate, endDate] = this.getDatesForFilter();
        this.mStartDate = startDate;
        this.mEndDate = endDate;

        // the today and tomorrow properties are precalculated here
        // for better performance when filtering batches of items.
        this.mToday = cal.now();
        this.mToday.isDate = true;

        this.mTomorrow = this.mToday.clone();
        this.mTomorrow.day++;

        return [startDate, endDate];
    },

    /**
     * Filters an array of items, returning a new array containing the items that match
     * the currently applied filter properties and text filter.
     *
     * @param aItems              The array of items to check.
     * @param aCallback           An optional callback function to be called with each item and 
     *                            the result of it's filter test.
     * @return                    A new array containing the items that match the filters, or 
     *                            null if no filter has been applied.
     */  
    filterItems: function cF_filterItems(aItems, aCallback) {
        if (!this.mFilterProperties) {
            return null;
        }

        return aItems.filter(function(aItem) {
            let result = this.propertyFilter(aItem) && this.textFilter(aItem);

            if (aCallback && (typeof(aCallback) == "function")) {
                aCallback(aItem, result, this.mFilterProperties, this);
            }

            return result;
        }, this);
    },

    /**
     * Checks if the item matches the currently applied filter properties and text filter.
     *
     * @param aItem               The item to check.
     * @return                    Returns true if the item matches the filters, 
     *                            false otherwise.
     */     
    isItemInFilters: function cF_isItemInFilters(aItem) {
        return (this.propertyFilter(aItem) && this.textFilter(aItem));
    }
};
