/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Calendar Code.
 *
 * The Initial Developer of the Original Code is
 * Michiel van Leeuwen <mvl@exedo.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Gary van der Merwe <garyvdm@gmail.com>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");

var gCalendar;

var errorConstants = {
    SUCCESS: 0,
    INVALID_URI: 1,
    ALREADY_EXISTS: 2
}

var l10nStrings = {};
l10nStrings[errorConstants.SUCCESS] = "";
l10nStrings[errorConstants.INVALID_URI] = cal.calGetString("calendarCreation", "error.invalidUri");
l10nStrings[errorConstants.ALREADY_EXISTS] = cal.calGetString("calendarCreation", "error.alreadyExists");

/**
 * Initialize the location page
 */
function initLocationPage() {
    checkRequired();
}

/**
 * Initialize the customize page
 */
function initCustomizePage() {
    initNameFromURI();
    checkRequired();

    let suppressAlarmsRow = document.getElementById("customize-suppressAlarms-row");
    suppressAlarmsRow.hidden =
        (gCalendar && gCalendar.getProperty("capabilities.alarms.popup.supported") === false);
}

/**
 * Sets up notifications for the location page. On aReason == SUCCESS, all
 * notifications are removed. Otherwise, the respective notification is added to
 * the notification box. Only one notification per reason will be shown.
 *
 * @param aReason           The reason of notification, one of |errorConstants|.
 */
function setNotification(aReason) {
    let notificationBox = document.getElementById("location-notifications");

    if (aReason == errorConstants.SUCCESS) {
        notificationBox.removeAllNotifications();
    } else {
        let existingBox = notificationBox.getNotificationWithValue(aReason);
        if (!existingBox) {
            notificationBox.appendNotification(l10nStrings[aReason],
                                               aReason,
                                               null,
                                               notificationBox.PRIORITY_WARNING_MEDIUM,
                                               null);
            notificationBox.getNotificationWithValue(aReason).setAttribute("hideclose", "true");
        }
    }
}

/**
 * Checks if the required information is set so that the wizard can advance. On
 * an error, notifications are shown and the wizard can not be advanced.
 */
function checkRequired() {
    let canAdvance = true;
    let curPage = document.getElementById('calendar-wizard').currentPage;
    if (curPage) {
        let eList = curPage.getElementsByAttribute('required', 'true');
        for (let i = 0; i < eList.length && canAdvance; ++i) {
            canAdvance = (eList[i].value != "");
        }

        let notificationbox = document.getElementById("location-notifications");
        if (canAdvance && document.getElementById("calendar-uri").value &&
                curPage.pageid == "locationPage") {
            let [reason,] = parseUri(document.getElementById("calendar-uri").value);
            canAdvance = (reason == errorConstants.SUCCESS);
            setNotification(reason);
        } else {
            notificationbox.removeAllNotifications();
        }
        document.getElementById('calendar-wizard').canAdvance = canAdvance;
    }
}

/**
 * Handler function called when the advance button is pressed on the initial
 * wizard page
 */
function onInitialAdvance() {
    let type = document.getElementById('calendar-type').selectedItem.value;
    let page = document.getElementsByAttribute('pageid', 'initialPage')[0];
    if (type == 'local') {
        prepareCreateCalendar();
        page.next = 'customizePage';
    } else {
        page.next = 'locationPage';
    }
}

/**
 * Create the calendar, so that the customize page can already check for
 * calendar capabilities of the provider.
 */
function prepareCreateCalendar() {
    gCalendar = null;

    let provider;
    let url;
    let reason;
    let type = document.getElementById('calendar-type').selectedItem.value;
    if (type == 'local') {
        provider = 'storage';
        [reason, url] = parseUri('moz-profile-calendar://');
    } else {
        provider = document.getElementById('calendar-format').selectedItem.value;
        [reason, url] = parseUri(document.getElementById("calendar-uri").value);
    }

    if (reason != errorConstants.SUCCESS || !url) {
        return false;
    }

    try {
        gCalendar = cal.getCalendarManager().createCalendar(provider, url);
    } catch (ex) {
        dump(ex);
        return false;
    }

    return true;
}

/**
 * The actual process of registering the created calendar.
 */
function doCreateCalendar() {
    let cal_name = document.getElementById("calendar-name").value;
    let cal_color = document.getElementById('calendar-color').color;

    gCalendar.name = cal_name;
    gCalendar.setProperty('color', cal_color);

    if (!document.getElementById("fire-alarms").checked) {
        gCalendar.setProperty('suppressAlarms', true);
    }

    cal.getCalendarManager().registerCalendar(gCalendar);
    return true;
}

/**
 * Initializes the calendar name from its uri
 */
function initNameFromURI() {
    let path = document.getElementById("calendar-uri").value;
    let nameField = document.getElementById("calendar-name");
    if (!path || nameField.value)
        return;

    let fullPathRegex = new RegExp("([^/:]+)[.]ics$");
    let captures = path.match(fullPathRegex);
    if (captures && captures.length >= 1) {
        nameField.value = decodeURIComponent(captures[1]);
    }
}

/**
 * Parses the given uri value to check if it is valid and there is not already
 * a calendar with this uri.
 *
 * @param aUri          The string to parse as an uri.
 * @return [error,uri]  |error| is the error code from errorConstants, |uri| the
 *                        parsed nsIURI, or null on error.
 */
function parseUri(aUri) {
    let uri;
    try {
        // Test if the entered uri can be parsed.
        uri = makeURL(aUri);
    } catch (ex) {
        return [errorConstants.INVALID_URI, null];
    }

    let calManager = cal.getCalendarManager();
    let cals = calManager.getCalendars({});
    let type = document.getElementById('calendar-type').selectedItem.value;
    let alreadyExists = false;
    do {
        alreadyExists = cals.some(function (c) c.uri.spec == uri.spec);
        if (alreadyExists) {
            if (type != 'local') {
                return [errorConstants.ALREADY_EXISTS, null];
            }
            function uriIncrementer(s, id) {
                return "id=" + (Number(id) + 1);
            }
            uri.spec = uri.spec.replace(/id=(\d+)/, uriIncrementer);
        }
    } while (alreadyExists);

    return [errorConstants.SUCCESS, uri];
}

/**
 * Disables the back button, in case we are far enough that its not possible to
 * undo.
 */
function setCanRewindFalse() {
   document.getElementById('calendar-wizard').canRewind = false;
}
