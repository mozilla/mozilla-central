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
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
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

/**
 * Used by the "quick add" feature for tasks, for example in the task view or
 * the uniinder-todo.
 *
 * NOTE: many of the following methods are called without taskEdit being the
 * |this| object.
 */

var taskEdit = {
    mObservedCalendar: null,
    get observedCalendar tE_get_observedCalendar() {
        return this.mObservedCalendar;
    },

    set observedCalendar tE_set_observedCalendar(v) {
        if (this.mObservedCalendar) {
            this.mObservedCalendar.removeObserver(this.calendarObserver);
        }

        this.mObservedCalendar = v;

        if (this.mObservedCalendar) {
            this.mObservedCalendar.addObserver(this.calendarObserver);
        }
        return this.mObservedCalendar;
    },

    setupTaskField: function tE_setupTaskField(aTarget, aDisable, aValue) {
        aTarget.value = aValue;
        setElementValue(aTarget, aDisable && "true", "readonly");
        setElementValue(aTarget, aDisable && "true", "aria-disabled");
    },

    onFocus: function tE_onFocus(aEvent) {
        var edit = aEvent.target;
        if (edit.localName == "input") {
            // For some reason, we only recieve an onfocus event for the textbox
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

    onBlur: function tE_onBlur(aEvent) {
        var edit = aEvent.target;
        if (edit.localName == "input") {
            // For some reason, we only recieve the blur event for the input
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

    onKeyPress: function tE_onKeyPress(aEvent) {
        if (aEvent.keyCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_RETURN) {
            var edit = aEvent.target;
            if (edit.value && edit.value.length > 0) {
                var item = createTodo();
                item.calendar = getSelectedCalendar();
                item.title = edit.value;
                edit.value = "";
                setDefaultAlarmValues(item);
                doTransaction('add', item, item.calendar, null, null);
            }
        }
    },

    onLoad: function tE_onLoad(aEvent) {
        window.removeEventListener("load", taskEdit.onLoad, false);
        var taskEditFields = document.getElementsByAttribute("class", "task-edit-field");
        for (var i = 0; i < taskEditFields.length; i++) {
            taskEdit.onBlur({ target: taskEditFields[i] });
        }

        getCompositeCalendar().addObserver(taskEdit.compositeObserver);
        taskEdit.observedCalendar = getSelectedCalendar();
    },

    onUnload: function tE_onUnload() {
        getCompositeCalendar().removeObserver(taskEdit.compositeObserver);
        taskEdit.observedCalendar = null;
    },

    calendarObserver: {
        QueryInterface: function tE_calObs_QueryInterface(aIID) {
            return doQueryInterface(this, null, aIID,
                                    [Components.interfaces.calIObserver]);
        },

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

    compositeObserver: {
        QueryInterface: function tE_compObs_QueryInterface(aIID) {
            return doQueryInterface(this, null, aIID,
                                    [Components.interfaces.calIObserver,
                                     Components.interfaces.calICompositeObserver]);
        },

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
