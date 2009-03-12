/**
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
 * The Original Code is Mozilla Calendar Code.
 *
 * The Initial Developer of the Original Code is
 * Mike Potter.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   ArentJan Banck <ajbanck@planet.nl>
 *   Matthew Willis <mattwillis@gmail.com>
 *   Stefan Sitter <ssitter@googlemail.com>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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
 * ***** END LICENSE BLOCK *****
 */
Components.utils.import("resource://calendar/modules/calUtils.jsm");

var gCategoryList;
var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService);
var categoryPrefBranch = prefService.getBranch("calendar.category.color.");

/**
 * Global Object to hold methods for the categories pref pane
 */
var gCategoriesPane = {

    /**
     * Initialize the categories pref pane. Sets up dialog controls to show the
     * categories saved in preferences.
     */
    init: function gCP_init() {
        // On non-instant-apply platforms, once this pane has been loaded,
        // attach our "revert all changes" function to the parent prefwindow's
        // "ondialogcancel" event.
        var parentPrefWindow = document.getElementById("CalendarPreferences") ||
                               document.getElementById("MailPreferences");
        if (!parentPrefWindow.instantApply) {
            var existingOnDialogCancel = parentPrefWindow.getAttribute("ondialogcancel");
            parentPrefWindow.setAttribute("ondialogcancel",
                                          "gCategoriesPane.panelOnCancel(); " + 
                                          existingOnDialogCancel);
        }

        // A list of preferences to be reverted when the dialog is cancelled.
        // It needs to be a property of the parent to be visible onCancel
        if (!parent.backupPrefList) {
            parent.backupPrefList = [];
        }

        var categories = document.getElementById("calendar.categories.names").value;

        // If no categories are configured load a default set from properties file
        if (!categories || categories == "") {
            categories = calGetString("categories", "categories2");
            document.getElementById("calendar.categories.names").value = categories;
        }

        gCategoryList = categoriesStringToArray(categories);
        
        // When categories is empty, split returns an array containing one empty
        // string, rather than an empty array. This results in an empty listbox
        // child with no corresponding category.
        if (gCategoryList.length == 1 && !gCategoryList[0].length) {
            gCategoryList.pop();
        }

        this.updateCategoryList();
    },

    /**
     * Updates the listbox containing the categories from the categories saved
     * in preferences.
     */
    updateCategoryList: function gCP_updateCategoryList () {
        cal.sortArrayByLocaleCollator(gCategoryList);
        document.getElementById("calendar.categories.names").value =
            categoriesArrayToString(gCategoryList);

        var listbox = document.getElementById("categorieslist");

        listbox.clearSelection();
        document.getElementById("editCButton").disabled = "true";
        document.getElementById("deleteCButton").disabled = "true";

        while (listbox.lastChild.id != "categoryColumns")
            listbox.removeChild(listbox.lastChild);

        for (var i=0; i < gCategoryList.length; i++) {
            var newListItem = document.createElement("listitem");
            var categoryName = document.createElement("listcell");
            categoryName.setAttribute("id", gCategoryList[i]);
            categoryName.setAttribute("label", gCategoryList[i]);
            var categoryNameFix = formatStringForCSSRule(gCategoryList[i]);
            var categoryColor = document.createElement("listcell");
            try {
                var colorCode = categoryPrefBranch.getCharPref(categoryNameFix);
                categoryColor.setAttribute("id", colorCode);
                categoryColor.setAttribute("style","background-color: "+colorCode+';');
            } catch (ex) {
                categoryColor.setAttribute("label", noneLabel);
            }
 
            newListItem.appendChild(categoryName);
            newListItem.appendChild(categoryColor);
            listbox.appendChild(newListItem);
        }
    },

    /**
     * Adds a category, opening the edit category dialog to prompt the user to
     * set up the category.
     */
    addCategory: function gCP_addCategory() {
        var list = document.getElementById("categorieslist");
        list.selectedIndex = -1;
        document.getElementById("editCButton").disabled = "true";
        document.getElementById("deleteCButton").disabled = "true";
        window.openDialog("chrome://calendar/content/preferences/editCategory.xul",
                          "addCategory", "modal,centerscreen,chrome,resizable=no",
                          "", null, addTitle);
    },

    /**
     * Edits the currently selected category using the edit category dialog.
     */
    editCategory: function gCP_editCategory() {
        var list = document.getElementById("categorieslist");
        var categoryNameFix = formatStringForCSSRule(gCategoryList[list.selectedIndex]);
        try {
            var currentColor = categoryPrefBranch.getCharPref(categoryNameFix);
        } catch (ex) {
            var currentColor = null;
        }
 
        if (list.selectedItem) {
            window.openDialog("chrome://calendar/content/preferences/editCategory.xul",
                              "editCategory", "modal,centerscreen,chrome,resizable=no",
                              gCategoryList[list.selectedIndex], currentColor, editTitle);
        }
    },

    /**
     * Removes the selected category.
     */
    deleteCategory: function gCP_deleteCategory() {
        var list = document.getElementById("categorieslist");
        if (list.selectedItem) {
            var categoryNameFix = formatStringForCSSRule(gCategoryList[list.selectedIndex]);
            this.backupData(categoryNameFix);
            try {
                categoryPrefBranch.clearUserPref(categoryNameFix);
            } catch (ex) {
            }
            gCategoryList.splice(list.selectedIndex, 1);
            this.updateCategoryList();
        }
    },

    /**
     * Saves the given category to the preferences.
     *
     * @param categoryName      The name of the category.
     * @param categoryColor     The color of the category
     */
    saveCategory: function gCP_saveCateogry(categoryName, categoryColor) {
        var list = document.getElementById("categorieslist");
        // Check to make sure another category doesn't have the same name
        var toBeDeleted = -1;
        var promptService = 
             Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Components.interfaces.nsIPromptService);
        for (var i=0; i < gCategoryList.length; i++) {
            if (i == list.selectedIndex)
                continue;
            if (categoryName.toLowerCase() == gCategoryList[i].toLowerCase()) {
                if (promptService.confirm(null, overwriteTitle, overwrite)) {
                    if (list.selectedIndex != -1)
                        // Don't delete the old category yet. It will mess up indices.
                        toBeDeleted = list.selectedIndex;
                    list.selectedIndex = i;
                } else {
                    return;
                }
            }
        }

        if (categoryName.length == 0) {
            promptService.alert(null, null, noBlankCategories);
            return;
        }

        var categoryNameFix = formatStringForCSSRule(categoryName);
        if (list.selectedIndex == -1) {
            this.backupData(categoryNameFix);
            gCategoryList.push(categoryName);
            if (categoryColor)
                categoryPrefBranch.setCharPref(categoryNameFix, categoryColor);
        } else {
            this.backupData(categoryNameFix);
            gCategoryList.splice(list.selectedIndex, 1, categoryName);
            if (categoryColor) {
                categoryPrefBranch.setCharPref(categoryNameFix, categoryColor);
            } else {
                try {
                    categoryPrefBranch.clearUserPref(categoryNameFix);
                } catch (ex) {
                    dump("Exception caught in 'saveCategory': " + ex + "\n");
                }
            }
        }

        // If 'Overwrite' was chosen, delete category that was being edited
        if (toBeDeleted != -1) {
            list.selectedIndex = toBeDeleted;
            this.deleteCategory();
        }

        this.updateCategoryList();

        var updatedCategory = gCategoryList.indexOf(categoryName);
        list.ensureIndexIsVisible(updatedCategory); 
        list.selectedIndex = updatedCategory;
    },

    /**
     * Enable the edit and delete category buttons.
     */
    enableButtons: function  gCP_enableButtons() {
        document.getElementById("editCButton").disabled = null;
        document.getElementById("deleteCButton").disabled = null;
    },

    /**
     * Backs up the category name in case the dialog is canceled.
     *
     * @see formatStringForCSSRule
     * @param categoryNameFix     The formatted category name.
     */
    backupData: function gCP_backupData(categoryNameFix) {
        var currentColor;
        try {
            currentColor = categoryPrefBranch.getCharPref(categoryNameFix);
        } catch (ex) {
            dump("Exception caught in 'backupData': " + ex + "\n");
            currentColor = "##NEW";
        }

        for (var i=0; i < parent.backupPrefList.length; i++) {
            if (categoryNameFix == parent.backupPrefList[i].name) {
                return;
            }
        }
        parent.backupPrefList[parent.backupPrefList.length] =
            { name : categoryNameFix, color : currentColor };
    },

    /**
     * Reverts category preferences in case the cancel button is pressed.
     */
    panelOnCancel: function gCP_panelOnCancel() {
        for (var i=0; i < parent.backupPrefList.length; i++) {
            if (parent.backupPrefList[i].color == "##NEW") {
                try {
                   categoryPrefBranch.clearUserPref(parent.backupPrefList[i].name);
                } catch (ex) {
                    dump("Exception caught in 'panelOnCancel': " + ex + "\n");
                }
            } else {
                categoryPrefBranch.setCharPref(parent.backupPrefList[i].name,
                                               parent.backupPrefList[i].color);
            }
        }
    }
};
