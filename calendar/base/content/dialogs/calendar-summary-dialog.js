/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://calendar/modules/calItipUtils.jsm");
Components.utils.import("resource://calendar/modules/calAlarmUtils.jsm");
Components.utils.import("resource://calendar/modules/calRecurrenceUtils.jsm");

/**
 * Sets up the summary dialog, setting all needed fields on the dialog from the
 * item received in the window arguments.
 */
function onLoad() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    item = item.clone(); // use an own copy of the passed item
    var calendar = item.calendar;
    window.calendarItem = item;

    // the calling entity provides us with an object that is responsible
    // for recording details about the initiated modification. the 'finalize'-property
    // is our hook in order to receive a notification in case the operation needs
    // to be terminated prematurely. this function will be called if the calling
    // entity needs to immediately terminate the pending modification. in this
    // case we serialize the item and close the window.
    if (args.job) {

        // keep this context...
        var self = this;

        // store the 'finalize'-functor in the provided job-object.
        args.job.finalize = function finalize() {

            // store any pending modifications...
            self.onAccept();

            let item = window.calendarItem;

            // ...and close the window.
            window.close();

            return item;
        };
    }

    // set the dialog-id to enable the right window-icon to be loaded.
    if (cal.isEvent(item)) {
        setDialogId(document.documentElement, "calendar-event-summary-dialog");
    } else if (cal.isToDo(item)) {
        setDialogId(document.documentElement, "calendar-task-summary-dialog");
    }

    calendar = cal.wrapInstance(item.calendar, Components.interfaces.calISchedulingSupport);
    window.readOnly = !(isCalendarWritable(calendar)
                        && (userCanModifyItem(item)
                            || (calendar
                                && item.calendar.isInvitation(item)
                                && userCanRespondToInvitation(item))));
    if (!window.readOnly && calendar) {
        var attendee = calendar.getInvitedAttendee(item);
        if (attendee) {
            // if this is an unresponded invitation, preset our default alarm values:
            if (!item.getAlarms({}).length &&
                (attendee.participationStatus == "NEEDS-ACTION")) {
                cal.alarms.setDefaultValues(item);
            }

            window.attendee = attendee.clone();
            // Since we don't have API to update an attendee in place, remove
            // and add again. Also, this is needed if the attendee doesn't exist
            // (i.e REPLY on a mailing list)
            item.removeAttendee(attendee);
            item.addAttendee(window.attendee);
        }
    }

    document.getElementById("item-title").value = item.title;

    document.getElementById("item-start-row").Item = item;
    document.getElementById("item-end-row").Item = item;

    updateInvitationStatus();

    // show reminder if this item is *not* readonly.
    // this case happens for example if this is an invitation.
    var calendar = window.arguments[0].calendarEvent.calendar;
    var supportsReminders =
        (calendar.getProperty("capabilities.alarms.oninvitations.supported") !== false);
    if (!window.readOnly && supportsReminders) {
        document.getElementById("reminder-row").removeAttribute("hidden");
        loadReminders(window.calendarItem.getAlarms({}));
        updateReminder();
    }

    updateRepeatDetails();
    updateAttendees();
    updateLink();

    var location = item.getProperty("LOCATION");
    if (location && location.length) {
        document.getElementById("location-row").removeAttribute("hidden");
        document.getElementById("item-location").value = location;
    }

    var categories = item.getCategories({});
    if (categories.length > 0) {
        document.getElementById("category-row").removeAttribute("hidden");
        document.getElementById("item-category").value = categories.join(", "); // TODO l10n-unfriendly
    }

    var organizer = item.organizer;
    if (organizer && organizer.id) {
        document.getElementById("organizer-row").removeAttribute("hidden");

        if (organizer.commonName && organizer.commonName.length) {
            document.getElementById("item-organizer").value = organizer.commonName;
            document.getElementById("item-organizer").setAttribute("tooltiptext", organizer.toString());
        } else if (organizer.id && organizer.id.length) {
            document.getElementById("item-organizer").value = organizer.toString();
        }
    }

    var status = item.getProperty("STATUS");
    if (status && status.length) {
        var statusRow = document.getElementById("status-row");
        for (var i = 0; i < statusRow.childNodes.length; i++) {
            if (statusRow.childNodes[i].getAttribute("status") == status) {
                statusRow.removeAttribute("hidden");
                if (status == "CANCELLED" && cal.isToDo(item)) {
                    // There are two labels for CANCELLED, the second one is for
                    // todo items. Increment the counter here.
                    i++;
                }
                statusRow.childNodes[i].removeAttribute("hidden");
                break;
            }
        }
    }

    if (item.hasProperty("DESCRIPTION")) {
        var description = item.getProperty("DESCRIPTION");
        if (description && description.length) {
            document.getElementById("item-description-box")
                .removeAttribute("hidden");
            var textbox = document.getElementById("item-description");
            textbox.value = description;
            textbox.inputField.readOnly = true;
        }
    }

    document.title = item.title;

    // If this item is read only we remove the 'cancel' button as users
    // can't modify anything, thus we go ahead with an 'ok' button only.
    if (window.readOnly) {
        document.documentElement.getButton("cancel").setAttribute("collapsed", "true");
    }

    window.focus();
    opener.setCursor("auto");
}

/**
 * Saves any changed information to the item.
 *
 * @return      Returns true if the dialog
 */
function onAccept() {
    dispose();
    if (window.readOnly) {
        return true;
    }
    var args = window.arguments[0];
    var oldItem = args.calendarEvent;
    var newItem = window.calendarItem;
    var calendar = newItem.calendar;
    saveReminder(newItem);
    args.onOk(newItem, calendar, oldItem);
    window.calendarItem = newItem;
    return true;
}

/**
 * Called when closing the dialog and any changes should be thrown away.
 */
function onCancel() {
    dispose();
    return true;
}

/**
 * Sets the dialog's invitation status dropdown to the value specified by the
 * user's invitation status.
 */
function updateInvitationStatus() {
    if (!window.readOnly) {
        if (window.attendee) {
            var invitationRow =
                document.getElementById("invitation-row");
            invitationRow.removeAttribute("hidden");
            var statusElement =
                document.getElementById("item-participation");
            statusElement.value = window.attendee.participationStatus;
        }
    }
}

/**
 * When the summary dialog is showing an invitation, this function updates the
 * user's invitation status from the value chosen in the dialog.
 *
 * XXX rename me!
 */
function updateInvitation() {
  var statusElement = document.getElementById("item-participation");
  if (window.attendee) {
      let item = window.arguments[0];
      let aclEntry = item.calendar.aclEntry;
      if (aclEntry) {
          let userAddresses = aclEntry.getUserAddresses({});
          if (userAddresses.length > 0
              && !cal.attendeeMatchesAddresses(window.attendee, userAddresses)) {
              window.attendee.setProperty("SENT-BY", "mailto:" + userAddresses[0]);
          }
      }

      window.attendee.participationStatus = statusElement.value;
  }
}

/**
 * Updates the dialog w.r.t recurrence, i.e shows a text describing the item's
 * recurrence)
 */
function updateRepeatDetails() {
    var args = window.arguments[0];
    var item = args.calendarEvent;

    // step to the parent (in order to show the
    // recurrence info which is stored at the parent).
    item = item.parentItem;

    // retrieve a valid recurrence rule from the currently
    // set recurrence info. bail out if there's more
    // than a single rule or something other than a rule.
    var recurrenceInfo = item.recurrenceInfo;
    if (!recurrenceInfo) {
        return;
    }

    document.getElementById("repeat-row").removeAttribute("hidden");

    // First of all collapse the details text. If we fail to
    // create a details string, we simply don't show anything.
    // this could happen if the repeat rule is something exotic
    // we don't have any strings prepared for.
    var repeatDetails = document.getElementById("repeat-details");
    repeatDetails.setAttribute("collapsed", "true");

    // Try to create a descriptive string from the rule(s).
    var kDefaultTimezone = calendarDefaultTimezone();
    var startDate =  item.startDate || item.entryDate;
    var endDate = item.endDate || item.dueDate;
    startDate = startDate ? startDate.getInTimezone(kDefaultTimezone) : null;
    endDate = endDate ? endDate.getInTimezone(kDefaultTimezone) : null;
    var detailsString = recurrenceRule2String(recurrenceInfo, startDate,
                                              endDate, startDate.isDate);

    if (!detailsString) {
        detailsString = cal.calGetString("calendar-event-dialog", "ruleTooComplexSummary");
    }

    // Now display the string...
    var lines = detailsString.split("\n");
    repeatDetails.removeAttribute("collapsed");
    while (repeatDetails.childNodes.length > lines.length) {
        repeatDetails.removeChild(repeatDetails.lastChild);
    }
    var numChilds = repeatDetails.childNodes.length;
    for (var i = 0; i < lines.length; i++) {
        if (i >= numChilds) {
            var newNode = repeatDetails.childNodes[0]
                                       .cloneNode(true);
            repeatDetails.appendChild(newNode);
        }
        repeatDetails.childNodes[i].value = lines[i];
        repeatDetails.childNodes[i].setAttribute("tooltiptext", detailsString);
    }
}

/**
 * Updates the attendee listbox, displaying all attendees invited to the
 * window's item.
 */
function updateAttendees() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    var attendees = item.getAttendees({});
    if (attendees && attendees.length) {
        document.getElementById("item-attendees").removeAttribute("hidden");
        var listbox = document.getElementById("item-attendee-listbox");
        var itemNode = listbox.getElementsByTagName("listitem")[0];
        var num_items = Math.ceil(attendees.length/2)-1;
        while (num_items--) {
            var newNode = itemNode.cloneNode(true);
            listbox.appendChild(newNode);
        }
        var list = listbox.getElementsByTagName("listitem");
        var page = 0;
        var line = 0;
        for each (var attendee in attendees) {
            var itemNode = list[line];
            var listcell = itemNode.getElementsByTagName("listcell")[page];
            if (attendee.commonName && attendee.commonName.length) {
                listcell.setAttribute("label", attendee.commonName);
            } else {
                listcell.setAttribute("label",  attendee.toString());
            }
            listcell.setAttribute("tooltiptext", attendee.toString());
            listcell.setAttribute("status", attendee.participationStatus);
            listcell.removeAttribute("hidden");

            page++;
            if (page > 1) {
              page = 0;
              line++;
            }
        }
    }
}

/**
 * Updates the reminder, called when a reminder has been selected in the
 * menulist.
 */
function updateReminder() {
    commonUpdateReminder();
}

/**
 * Browse the item's attached URL.
 *
 * XXX This function is broken, should be fixed in bug 471967
 */
function browseDocument() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    var url = item.getProperty("URL")
    launchBrowser(url);
}

/**
 * Extracts the item's organizer and opens a compose window to send the
 * organizer an email.
 */
function sendMailToOrganizer() {
    var args = window.arguments[0];
    var item = args.calendarEvent;

    var organizer = item.organizer;
    if (organizer) {
        if (organizer.id && organizer.id.length) {
            var email = organizer.id.replace(/^mailto:/i, "");

            // Set up the subject
            var emailSubject = calGetString("calendar-event-dialog",
                                            "emailSubjectReply",
                                            [item.title]);

            sendMailTo(email, emailSubject);
        }
    }
}

/**
 * This hack allows the attendees listbox to remain cropping when resized.
 * To check if its still needed, remove the hack, open the summary dialog with
 * at least two attendees with long names, then make the dialog wider and shrink
 * it again. If the labels crop again, then go ahead and remove it.
 * See bug 632355
 */
function fixAttendeesListbox() {
    let left = document.getElementById("item-attendee-left-col");
    let right = document.getElementById("item-attendee-right-col");

    left.removeAttribute("flex");
    right.removeAttribute("flex");

    left.setAttribute("flex", "1");
    right.setAttribute("flex", "1");
}
