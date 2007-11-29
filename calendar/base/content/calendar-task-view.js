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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
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

var taskEdit = {

    instructions: null,
    value: null,
    
    /**
     * Task Edit Events
     */
    onFocus: function tE_onFocus(aEvent) {
        var edit = document.getElementById("task-edit-field");
        taskEdit.instructions = edit.getAttribute("instructions");
        edit.value = taskEdit.value || "";
        edit.removeAttribute("instructions");
    },
    
    onBlur: function tE_onBlur(aEvent) {
        var edit = document.getElementById("task-edit-field");
        taskEdit.value = edit.value;
        edit.value = taskEdit.instructions;
        edit.setAttribute("instructions", taskEdit.instructions);
    },

    onKeyPress: function tE_onKeyPress(aEvent) {
        if (aEvent.keyCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_RETURN) {
            var edit = document.getElementById("task-edit-field");
            if(edit.value && edit.value.length > 0) {
                var item = createTodo();
                item.calendar = getSelectedCalendar();
                item.title = edit.value;
                edit.value = "";
                setDefaultAlarmValues(item);
                doTransaction('add', item, item.calendar, null,
                    new OpCompleteListener(
                        function respFunc(savedItem) {
                            if (savedItem) {
                                checkForAttendees(savedItem, null);
                            }
                        }));
            }
        }
    }
}

var taskDetailsView = {

    /**
     * Task Details Events
     */
    onSelect: function tDV_onSelect(event) {
        var item = document.getElementById("calendar-task-tree").currentTask;
        if (item != null) {
            document.getElementById("calendar-task-details-row").removeAttribute("hidden");
            document.getElementById("calendar-task-details-title").value = item.title;
            var textbox = document.getElementById("calendar-task-details-description");
            var description = item.hasProperty("DESCRIPTION") ? item.getProperty("DESCRIPTION") : null;
            textbox.value = description;
            textbox.inputField.readOnly = true;
        }
    }
};

function taskViewObserveDisplayDeckChange(event) {
    var deck = event.target;

    // Bug 309505: The 'select' event also fires when we change the selected
    // panel of calendar-view-box.  Workaround with this check.
    if (deck.id != "displayDeck") {
        return;
    }

    var id = null;
    try {
      id = deck.selectedPanel.id
    }
    catch (e) {}

    // In case we find that the task view has been made visible, we refresh the view.
    if (id == "calendar-task-box") {
        document.getElementById("calendar-task-tree").refresh();
    }
}

document.getElementById("displayDeck").
    addEventListener("select", taskViewObserveDisplayDeckChange, true);
