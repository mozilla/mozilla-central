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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

// Global variable, set to true if the user has picked a custom color.
var customColorSelected = false;

/**
 * Load Handler, called when the edit category dialog is loaded
 */
function editCategoryLoad() {
    document.getElementById("categoryName").value = window.arguments[0];
    document.title = window.arguments[2];
    if (window.arguments[1]) {
        document.getElementById("useColor").checked = true;
        document.getElementById("categoryColor").color = window.arguments[1];
        customColorSelected = true;
    }
}

/**
 * Handler function to be called when the category dialog is accepted and
 * the opener should further process the selected name and color
 */
function doOK() {
    let color = document.getElementById("useColor").checked ?
                document.getElementById("categoryColor").color :
                null;

    let categoryName = document.getElementById("categoryName").value;
    window.opener.gCategoriesPane.saveCategory(categoryName, color);
    return true;
}

/**
 * Handler function to be called when the category name changed
 */
function categoryNameChanged() {
    let newValue = document.getElementById("categoryName").value;

    // The user removed the category name, assign the color automatically again.
    if (newValue == "") {
        customColorSelected = false;
    }

    if (!customColorSelected && document.getElementById("useColor").checked) {
        // Color is wanted, choose the color based on the category name's hash.
        document.getElementById("categoryColor").color = cal.hashColor(newValue);
    }
}

/**
 * Handler function to be called when the checkbox to use a category color was
 * changed. Toggles the color checkbox and recomputes the color, if needed.
 */
function toggleColor() {
    if (document.getElementById("useColor").checked) {
        // Pretend the category name changed, this selects the color
        categoryNameChanged();
    } else {
        document.getElementById("categoryColor").color = "transparent";
        customColorSelected = false;
    }
}

/**
 * Handler function to be called when the color picker's color has been changed.
 */
function colorPickerChanged() {
    document.getElementById('useColor').checked = true;
    customColorSelected = true;
}
