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

function onLoad() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    item = (item.isMutable) ? item : item.clone();
    var calendar = item.calendar;
    window.item = item;

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

            var item = window.item;

            // ...and close the window.
            window.close();

            return item;
        }
    }

    window.readOnly = calendar.readOnly;
    if (!window.readOnly) {
        try {
            var provider = calendar
                .QueryInterface(
                    Components.interfaces.calIWcapCalendar);
            var attendee = provider.getInvitedAttendee(item);
            if (attendee) {
                window.attendee = attendee.clone();
                item.removeAttendee(attendee);
                item.addAttendee(window.attendee);
            }
        }
        catch(e) {
        }
    }

    var formatter = Components.classes[
        "@mozilla.org/calendar/datetime-formatter;1"]
            .getService(
                Components.interfaces.calIDateTimeFormatter);

    document.getElementById("item-title").value = item.title;

    // show the start time of the event
    var kDefaultTimezone = calendarDefaultTimezone();
    var start = item.startDate || item.entryDate;
    if (start) {
        document.getElementById("item-datetime")
            .value = formatter.formatDateLong(
                start.getInTimezone(kDefaultTimezone));
    }

    if (!window.readOnly) {
        document.getElementById("item-main-separator")
            .removeAttribute("hidden");
    }

    updateInvitationStatus();

    // show reminder if this item is *not* readonly.
    // this case happens for example if this is an invitation.
    if (!window.readOnly) {
        document.getElementById("reminder-row").removeAttribute("hidden");
        loadReminder(window.item);
        updateReminderDetails();
    }

    updateRepeatDetails();
    updateAttendees();

    var location = item.getProperty("LOCATION");
    if (location && location.length) {
        document.getElementById("location-row").removeAttribute("hidden");
        document.getElementById("item-location").value = location;
    }

    var organizer = item.organizer;
    if (organizer) {
        if (organizer.commonName && organizer.commonName.length) {
            document.getElementById("organizer-row")
                .removeAttribute("hidden");
            document.getElementById("item-organizer")
                .value = organizer.commonName;
        } else if (organizer.id && organizer.id.length) {
            var email = organizer.id;
            if (email.indexOf("mailto:") == 0) {
                email = email.split("mailto:")[1]
            }
            document.getElementById("organizer-row").removeAttribute("hidden");
            document.getElementById("item-organizer").value = email;
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

    if (item.hasProperty("URL")) {
      var url = item.getProperty("URL");
      if (url && url.length) {
        document.getElementById("item-link-box").removeAttribute("hidden");
        document.getElementById("item-link").value = url;
      }
    }

    document.title = item.title;

    // If this item is read only we remove the 'cancel' button as users
    // can't modify anything, thus we go ahead with an 'ok' button only.
    if (window.readOnly) {
        document.getElementById("calendar-summary-dialog")
            .getButton("cancel").setAttribute("collapsed", "true");
    }

    window.focus();
    opener.setCursor("auto");
}

function onAccept() {
    dispose();
    if (window.readOnly) {
        return true;
    }
    var args = window.arguments[0];
    var oldItem = args.calendarEvent;
    var newItem = window.item;
    var calendar = newItem.calendar;
    saveReminder(newItem);
    args.onOk(newItem, calendar, oldItem);
    window.item = newItem;
    return true;
}

function onCancel() {
    dispose();
    return true;
}

function updateInvitationStatus() {
    var item = window.item;
    var calendar = item.calendar;
    if (!window.readOnly) {
        if (window.attendee) {
            var invitationRow =
                document.getElementById("invitation-row");
            invitationRow.removeAttribute("hidden");
            var statusElement =
                document.getElementById("item-participation");
            statusElement.value = attendee.participationStatus;
        }
    }
}

function updateInvitation() {
  var statusElement = document.getElementById("item-participation");
  if (window.attendee) {
      window.attendee.participationStatus = statusElement.value;
  }
}

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

    var kDefaultTimezone = calendarDefaultTimezone();
    var startDate =  item.startDate || item.entryDate;
    var endDate = item.endDate || item.dueDate;
    startDate = startDate ? startDate.getInTimezone(kDefaultTimezone) : null;
    endDate = endDate ? endDate.getInTimezone(kDefaultTimezone) : null;
    commonUpdateRepeatDetails(recurrenceInfo, startDate, endDate, startDate.isDate);
}

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
            var name = attendee.commonName;
            if (!(name && name.length)) {
                if (attendee.id && attendee.id.length) {
                    var email = organizer.id;
                    if (email.indexOf("mailto:") == 0) {
                        email = email.split("mailto:")[1];
                    }
                    name = email;
                }
            }
            if (name && name.length) {
                var itemNode = list[line];
                var image = itemNode.getElementsByTagName("image")[page];
                var label = itemNode.getElementsByTagName("label")[page];
                label.value = name;
                image.setAttribute("status", attendee.participationStatus);
                image.removeAttribute("hidden");
                page++;
                if (page > 1) {
                  page = 0;
                  line++;
                }
            }
        }
    }
}

function updateReminder() {
    commonUpdateReminder();
}

function browseDocument() {
    var args = window.arguments[0];
    var item = args.calendarEvent;
    var url = item.getProperty("URL")
    launchBrowser(url);
}

function sendMailToOrganizer() {
    var args = window.arguments[0];
    var item = args.calendarEvent;

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
            var emailSubject = calGetString("sun-calendar-event-dialog",
                                            "emailSubjectReply",
                                            [item.title]);

            sendMailTo(email, emailSubject);
        }
    }
}
