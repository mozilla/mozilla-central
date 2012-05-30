/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


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
