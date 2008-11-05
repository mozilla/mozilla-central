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
 * The Original Code is Lightning code.
 *
 * The Initial Developer of the Original Code is Oracle Corporation
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Vladimir Vukicevic <vladimir@pobox.com>
 *   Mike Shaver <shaver@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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
    // basically what happens when "None" is selected. Also, if there is
    // a transport, 
    var menuPopup = document.getElementById("email-identity-menupopup");
    addMenuItem(menuPopup, ltnGetString("lightning", "imipNoIdentity"), "none");
    var identities = getAccountManager().allIdentities;
    for (var i = 0; i <  identities.Count(); ++i) {
        var identity = identities.GetElementAt(i)
                                 .QueryInterface(Components.interfaces.nsIMsgIdentity);
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
