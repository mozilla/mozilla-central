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
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Berend Cornelius <berend.cornelius@sun.com>
 *   Fred Jendrzejewski <fred.jen@web.de>
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


var taskDetailsView = {

    /**
     * Task Details Events
     *
     * XXXberend Please document this function, possibly also consolidate since
     * its the only function in taskDetailsView.
     */
    onSelect: function tDV_onSelect(event) {

        var dateFormatter =
            Components.classes["@mozilla.org/calendar/datetime-formatter;1"]
            .getService(Components.interfaces.calIDateTimeFormatter);

        function displayElement(id,flag) {
            setBooleanAttribute(id, "hidden", !flag);
            return flag;
        }

        var item = document.getElementById("calendar-task-tree").currentTask;
        if (displayElement("calendar-task-details-container", item != null) &&
            displayElement("calendar-task-view-splitter", item != null)) {
            displayElement("calendar-task-details-title-row", true);
            document.getElementById("calendar-task-details-title").value = item.title;
            var organizer = item.organizer;
            if (displayElement("calendar-task-details-organizer-row", organizer != null)) {
                var name = organizer.commonName;
                if (!name || name.length <= 0) {
                  if (organizer.id && organizer.id.length) {
                      name = organizer.id;
                      var re = new RegExp("^mailto:(.*)", "i");
                      var matches = re.exec(name);
                      if (matches) {
                          name = matches[1];
                      }
                  }
                }
                if (displayElement("calendar-task-details-organizer-row", name && name.length)) {
                    document.getElementById("calendar-task-details-organizer").value = name;
                }
            }
            var priority = 0;
            if (item.calendar.getProperty("capabilities.priority.supported") != false) {
                priority = parseInt(item.priority);
            }
            if (displayElement("calendar-task-details-priority-row", priority > 0)) {
                displayElement("calendar-task-details-priority-low", (priority >= 6 && priority <= 9));
                displayElement("calendar-task-details-priority-normal", priority == 5);
                displayElement("calendar-task-details-priority-high", (priority >= 1 && priority <= 4));
            }
            var status = item.getProperty("STATUS");
            if (displayElement("calendar-task-details-status-row", status && status.length > 0)) {
                var statusDetails = document.getElementById("calendar-task-details-status");
                switch(status) {
                    case "NEEDS-ACTION":
                        statusDetails.value = calGetString(
                            "calendar",
                            "taskDetailsStatusNeedsAction");
                        break;
                    case "IN-PROCESS":
                        var percent = 0;
                        var property = item.getProperty("PERCENT-COMPLETE");
                        if (property != null) {
                            var percent = parseInt(property);
                        }
                        statusDetails.value = calGetString(
                            "calendar",
                            "taskDetailsStatusInProgress", [percent]);
                        break;
                    case "COMPLETED":
                        if (item.completedDate) {
                            var completedDate = item.completedDate.getInTimezone(
                                                    calendarDefaultTimezone());
                            statusDetails.value = calGetString(
                                "calendar",
                                "taskDetailsStatusCompletedOn",
                                [dateFormatter.formatDateTime(completedDate)]);
                        }
                        break;
                    case "CANCELLED":
                        statusDetails.value = calGetString(
                            "calendar",
                            "taskDetailsStatusCancelled");
                        break;
                    default:
                        displayElement("calendar-task-details-status-row", false);
                        break;
                }
            }
            var categories = item.getCategories({});
            if (displayElement("calendar-task-details-category-row", categories.length > 0)) {
                document.getElementById("calendar-task-details-category").value = categories.join(", ");
            }
            document.getElementById("task-start-row").Item = item;
            document.getElementById("task-due-row").Item = item;
            var parentItem = item;
            if (parentItem.parentItem != parentItem) {
                // XXXdbo Didn't we want to get rid of these checks?
                parentItem = parentItem.parentItem;
            }
            var recurrenceInfo = parentItem.recurrenceInfo;
            var recurStart = parentItem.recurrenceStartDate;
            if (displayElement("calendar-task-details-repeat-row", recurrenceInfo && recurStart)) {
                var kDefaultTimezone = calendarDefaultTimezone();
                var startDate = recurStart.getInTimezone(kDefaultTimezone);
                var endDate = item.dueDate ? item.dueDate.getInTimezone(kDefaultTimezone) : null;
                var detailsString = recurrenceRule2String(recurrenceInfo,startDate,endDate,startDate.isDate);
                if (detailsString) {
                    document.getElementById("calendar-task-details-repeat").value = detailsString.split("\n").join(" ");
                }
            }
            var textbox = document.getElementById("calendar-task-details-description");
            var description = item.hasProperty("DESCRIPTION") ? item.getProperty("DESCRIPTION") : null;
            textbox.value = description;
            textbox.inputField.readOnly = true;
            var gURL = item.getProperty("URL");
            if (displayElement("calendar-task-details-attachment-row", gURL && gURL.length)) {
                var urlLabel = document.getElementById("calendar-task-details-attachment");
                urlLabel.value = gURL;
                urlLabel.setAttribute("tooltiptext", gURL);
            }
        }
    }
};


/**
 * Updates the currently applied filter for the task view and refreshes the task
 * tree.
 *
 * @param filter        The filter name to set.
 */
function taskViewUpdate(filter) {
    document.getElementById("filterBroadcaster").setAttribute("value", filter);

    var tree = document.getElementById("calendar-task-tree");

    // set the filters
    tree.mFilter.propertyFilter  = filter;
    tree.mFilter.setDateFilter(filter);

    tree.refresh();
}

/**
 * Prepares a dialog to send an email to the organizer of the currently selected
 * task in the task view.
 *
 * XXX We already have a function with this name in the event dialog. Either
 * consolidate or make name more clear.
 */
function sendMailToOrganizer() {
    var item = document.getElementById("calendar-task-tree").currentTask;
    if (item != null) {
        var organizer = item.organizer;
        if (organizer) {
            if (organizer.id && organizer.id.length) {
                var email = organizer.id;
                var re = new RegExp("^mailto:(.*)", "i");
                if (email && email.length) {
                    if (re.test(email)) {
                        email = RegExp.$1;
                    } else {
                        email = email;
                    }
                }

                // Set up the subject
                var emailSubject = calGetString("calendar-event-dialog",
                                                "emailSubjectReply",
                                                [item.title]);

                sendMailTo(email, emailSubject);
            }
        }
    }
}

/**
 * Handler function to observe changing of the calendar display deck. Updates
 * the task tree if the task view was selected.
 *
 * TODO Consolidate this function and anything connected, its still from times
 * before we had view tabs.
 */
function taskViewObserveDisplayDeckChange(event) {
    var deck = event.target;

    // Bug 309505: The 'select' event also fires when we change the selected
    // panel of calendar-view-box.  Workaround with this check.
    if (deck.id != "calendarDisplayDeck") {
        return;
    }

    var id = null;
    try {
      id = deck.selectedPanel.id
    }
    catch (e) {}

    // In case we find that the task view has been made visible, we refresh the view.
    if (id == "calendar-task-box") {
        taskViewUpdate(
            document.getElementById("task-tree-filtergroup").value || "all");
    }
}

// Install event listeners for the display deck change.
document.addEventListener("load", function () {
  document.getElementById("calendarDisplayDeck").
    addEventListener("select", taskViewObserveDisplayDeckChange, true);
  }, true);
