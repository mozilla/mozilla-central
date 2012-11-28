/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

/**
 * Gets the value of a string in a .properties file from the lightning bundle
 *
 * @param aBundleName  the name of the properties file.  It is assumed that the
 *                     file lives in chrome://lightning/locale/
 * @param aStringName  the name of the string within the properties file
 * @param aParams      optional array of parameters to format the string
 */
function ltnGetString(aBundleName, aStringName, aParams) {
    return cal.calGetString(aBundleName, aStringName, aParams, "lightning");
}

// shared by lightning-calendar-properties.js and lightning-calendar-creation.js:
function ltnInitMailIdentitiesRow() {
    if (!gCalendar) {
        collapseElement("calendar-email-identity-row");
    }

    var imipIdentityDisabled = gCalendar.getProperty("imip.identity.disabled");
    setElementValue("calendar-email-identity-row",
                    imipIdentityDisabled && "true",
                    "collapsed");

    if (imipIdentityDisabled) {
        // If the imip identity is disabled, we don't have to set up the
        // menulist.
        return;
    }

    // If there is no transport but also no organizer id, then the
    // provider has not statically configured an organizer id. This is
    // basically what happens when "None" is selected.
    var menuPopup = document.getElementById("email-identity-menupopup");

    // Remove all children from the email list to avoid duplicates if the list
    // has already been populated during a previous step in the calendar
    // creation wizard.
    while (menuPopup.lastChild) {
        menuPopup.removeChild(menuPopup.lastChild);
    }

    addMenuItem(menuPopup, ltnGetString("lightning", "imipNoIdentity"), "none");
    let identities;
    if (gCalendar && gCalendar.aclEntry && gCalendar.aclEntry.hasAccessControl) {
        identities = gCalendar.aclEntry.getOwnerIdentities({});
    } else {
        identities = MailServices.accounts.allIdentities;
    }
    for each (let identity in fixIterator(identities, Components.interfaces.nsIMsgIdentity)) {
        addMenuItem(menuPopup, identity.identityName, identity.key);
    }
    try {
        var sel = gCalendar.getProperty("imip.identity");
        if (sel) {
            sel = sel.QueryInterface(Components.interfaces.nsIMsgIdentity);
        }
        menuListSelectItem("email-identity-menulist", sel ? sel.key : "none");
    } catch (exc) {
    }
}

function ltnSaveMailIdentitySelection() {
    if (!gCalendar) {
        return;
    }
    var sel = "none";
    var imipIdentityDisabled = gCalendar.getProperty("imip.identity.disabled");
    var selItem = document.getElementById("email-identity-menulist").selectedItem;
    if (!imipIdentityDisabled && selItem) {
        sel = selItem.getAttribute("value");
    }
    // no imip.identity.key will default to the default account/identity, whereas
    // an empty key indicates no imip; that identity will not be found
    gCalendar.setProperty("imip.identity.key", sel == "none" ? "" : sel);
}
