/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Used by the "quick add" feature for tasks, for example in the task view or
 * the uniinder-todo.
 *
 * NOTE: many of the following methods are called without taskEdit being the
 * |this| object.
 */

var taskEdit = {
    /**
     * Get the currently observed calendar.
     */
    mObservedCalendar: null,
    get observedCalendar() {
        return this.mObservedCalendar;
    },

    /**
     * Set the currently observed calendar, removing listeners to any old
     * calendar set and adding listeners to the new one.
     */
    set observedCalendar(v) {
        if (this.mObservedCalendar) {
            this.mObservedCalendar.removeObserver(this.calendarObserver);
        }

        this.mObservedCalendar = v;

        if (this.mObservedCalendar) {
            this.mObservedCalendar.addObserver(this.calendarObserver);
        }
        return this.mObservedCalendar;
    },

    /**
     * Helper function to set readonly and aria-disabled states and the value
     * for a given target.
     *
     * @param aTarget   The ID or XUL node to set the value
     * @param aDisable  A boolean if the target should be disabled.
     * @param aValue    The value that should be set on the target.
     */
    setupTaskField: function tE_setupTaskField(aTarget, aDisable, aValue) {
        aTarget.value = aValue;
        setElementValue(aTarget, aDisable && "true", "readonly");
        setElementValue(aTarget, aDisable && "true", "aria-disabled");
    },

    /**
     * Handler function to call when the quick-add textbox gains focus.
     *
     * @param aEvent    The DOM focus event
     */
    onFocus: function tE_onFocus(aEvent) {
        var edit = aEvent.target;
        if (edit.localName == "input") {
            // For some reason, we only receive an onfocus event for the textbox
            // when debugging with venkman.
            edit = edit.parentNode.parentNode;
        }

        var calendar = getSelectedCalendar();
        edit.showsInstructions = true;

        if (calendar.getProperty("capabilities.tasks.supported") === false) {
            taskEdit.setupTaskField(edit,
                                    true,
                                    calGetString("calendar", "taskEditInstructionsCapability"));
        } else if (!isCalendarWritable(calendar)) {
            taskEdit.setupTaskField(edit,
                                    true,
                                    calGetString("calendar", "taskEditInstructionsReadonly"));
        } else {
            edit.showsInstructions = false;
            taskEdit.setupTaskField(edit, false, edit.savedValue || "");
        }
    },

    /**
     * Handler function to call when the quick-add textbox loses focus.
     *
     * @param aEvent    The DOM blur event
     */
    onBlur: function tE_onBlur(aEvent) {
        var edit = aEvent.target;
        if (edit.localName == "input") {
            // For some reason, we only receive the blur event for the input
            // element. There are no targets that point to the textbox. Go up
            // the parent chain until we reach the textbox.
            edit = edit.parentNode.parentNode;
        }

        var calendar = getSelectedCalendar();

        if (calendar.getProperty("capabilities.tasks.supported") === false){
            taskEdit.setupTaskField(edit,
                                    true,
                                    calGetString("calendar", "taskEditInstructionsCapability"));
        } else if (!isCalendarWritable(calendar)) {
            taskEdit.setupTaskField(edit,
                                    true,
                                    calGetString("calendar", "taskEditInstructionsReadonly"));
        } else {
            if (!edit.showsInstructions) {
                edit.savedValue = edit.value || "";
            }
            taskEdit.setupTaskField(edit,
                                    false,
                                    calGetString("calendar", "taskEditInstructions"));
        }
        edit.showsInstructions = true;
    },

    /**
     * Handler function to call on keypress for the quick-add textbox.
     *
     * @param aEvent    The DOM keypress event
     */
    onKeyPress: function tE_onKeyPress(aEvent) {
        if (aEvent.keyCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_RETURN) {
            var edit = aEvent.target;
            if (edit.value && edit.value.length > 0) {
                var item = createTodo();
                item.calendar = getSelectedCalendar();
                item.title = edit.value;
                edit.value = "";
                cal.alarms.setDefaultValues(item);
                doTransaction('add', item, item.calendar, null, null);
            }
        }
    },

    /**
     * Window load function to set up all quick-add textboxes. The texbox must
     * have the class "task-edit-field".
     */
    onLoad: function tE_onLoad(aEvent) {
        window.removeEventListener("load", taskEdit.onLoad, false);
        // TODO use getElementsByClassName
        var taskEditFields = document.getElementsByAttribute("class", "task-edit-field");
        for (var i = 0; i < taskEditFields.length; i++) {
            taskEdit.onBlur({ target: taskEditFields[i] });
        }

        getCompositeCalendar().addObserver(taskEdit.compositeObserver);
        taskEdit.observedCalendar = getSelectedCalendar();
    },

    /**
     * Window load function to clean up all quick-add fields.
     */
    onUnload: function tE_onUnload() {
        getCompositeCalendar().removeObserver(taskEdit.compositeObserver);
        taskEdit.observedCalendar = null;
    },

    /**
     * Observer to watch for readonly, disabled and capability changes of the
     * observed calendar.
     *
     * @see calIObserver
     */
    calendarObserver: {
        QueryInterface: XPCOMUtils.generateQI([Components.interfaces.calIObserver]),

        // calIObserver:
        onStartBatch: function() {},
        onEndBatch: function() {},
        onLoad: function(aCalendar) {},
        onAddItem: function(aItem) {},
        onModifyItem: function(aNewItem, aOldItem) {},
        onDeleteItem: function(aDeletedItem) {},
        onError: function(aCalendar, aErrNo, aMessage) {},

        onPropertyChanged: function tE_calObs_onPropertyChanged(aCalendar,
                                                         aName,
                                                         aValue,
                                                         aOldValue) {
            if (aCalendar.id != getSelectedCalendar().id) {
                // Optimization: if the given calendar isn't the default calendar,
                // then we don't need to change any readonly/disabled states.
                return;
            }
            switch (aName) {
                case "readOnly":
                case "disabled":
                    var taskEditFields = document.getElementsByAttribute("class", "task-edit-field");
                    for (var i = 0; i < taskEditFields.length; i++) {
                        taskEdit.onBlur({ target: taskEditFields[i] });
                    }
            }
        },

        onPropertyDeleting: function tE_calObs_onPropertyDeleting(aCalendar,
                                                           aName) {
            // Since the old value is not used directly in onPropertyChanged,
            // but should not be the same as the value, set it to a different
            // value.
            this.onPropertyChanged(aCalendar, aName, null, null);
        }
    },

    /**
     * Observer to watch for changes to the selected calendar.
     *
     * XXX I think we don't need to implement calIObserver here.
     *
     * @see calICompositeObserver
     */
    compositeObserver: {
        QueryInterface: XPCOMUtils.generateQI([
            Components.interfaces.calIObserver,
            Components.interfaces.calICompositeObserver
        ]),

        // calIObserver:
        onStartBatch: function() {},
        onEndBatch: function() {},
        onLoad: function(aCalendar) {},
        onAddItem: function(aItem) {},
        onModifyItem: function(aNewItem, aOldItem) {},
        onDeleteItem: function(aDeletedItem) {},
        onError: function(aCalendar, aErrNo, aMessage) {},
        onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {},
        onPropertyDeleting: function(aCalendar, aName) {},

        // calICompositeObserver:
        onCalendarAdded: function onCalendarAdded(aCalendar) {},
        onCalendarRemoved: function onCalendarRemoved(aCalendar) {},
        onDefaultCalendarChanged: function tE_compObs_onDefaultCalendarChanged(aNewDefault) {
            var taskEditFields = document.getElementsByAttribute("class", "task-edit-field");
            for (var i = 0; i < taskEditFields.length; i++) {
                taskEdit.onBlur({ target: taskEditFields[i] });
            }
            taskEdit.observedCalendar = aNewDefault;
        }
    }
};

window.addEventListener("load", taskEdit.onLoad, false);
window.addEventListener("unload", taskEdit.onUnload, false);
