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
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Berend Cornelius <berend.cornelius@sun.com>
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

/**
 * Helper function for filling the form,
 * Set the value of a property of a XUL element
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 * @param aNewValue     value to set property to ( if undefined no change is made )
 * @param aPropertyName OPTIONAL name of property to set, default is "value",
 *                        use "checked" for radios & checkboxes, "data" for
 *                        drop-downs
 */
function setElementValue(aElement, aNewValue, aPropertyName) {
    ASSERT(aElement);
    var undefined;

    if (aNewValue !== undefined) {
        if (typeof(aElement) == "string") {
            aElement = document.getElementById(aElement);
        }

        if (aNewValue === false) {
            try {
                aElement.removeAttribute(aPropertyName);
            } catch (e) {
                dump("setFieldValue: aElement.removeAttribute couldn't remove " +
                aPropertyName + " from " + (aElement && aElement.localName) + " e: " + e + "\n");
            }
        } else if (aPropertyName) {
            try {
                aElement.setAttribute(aPropertyName, aNewValue);
            } catch (e) {
                dump("setFieldValue: aElement.setAttribute couldn't set " +
                aPropertyName + " from " + (aElement && aElement.localName) + " to " + aNewValue +
                " e: " + e + "\n");
            }
        } else {
            aElement.value = aNewValue;
        }
     }
 }

/**
 * Helper function for getting data from the form,
 * Get the value of a property of a XUL element
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 * @param propertyName  OPTIONAL name of property to set, default is "value",
 *                        use "checked" for radios & checkboxes, "data" for
 *                        drop-downs
 * @return newValue     Value of property
 *
 */
function getElementValue(aElement, aPropertyName) {
    if (typeof(aElement) == "string") {
        aElement = document.getElementById(aElement);
    }
    return aElement[aPropertyName || "value"];
}

/**
 * Unconditionally show the element (hidden attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function showElement(aElement) {
    setElementValue(aElement, false, "hidden");
}

/**
 * Unconditionally hide the element (hidden attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function hideElement(aElement) {
    setElementValue(aElement, "true", "hidden");
}

/**
 * Unconditionally show the element (collapsed attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function uncollapseElement(aElement) {
    setElementValue(aElement, false, "collapsed");
}

/**
 * Unconditionally hide the element (collapsed attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function collapseElement(aElement) {
    setElementValue(aElement, "true", "collapsed");
}

/**
 * Unconditionally enable the element (hidden attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function enableElement(aElement) {
    setElementValue(aElement, false, "disabled");
}

/**
 * Unconditionally disable the element (hidden attribute)
 *
 * @param aElement      ID of XUL element to set, or the element node itself
 */
function disableElement(aElement) {
    setElementValue(aElement, "true", "disabled");
}

/**
 * This function unconditionally disables the element for
 * which the id has been passed as argument. Furthermore, it
 * remembers who was responsible for this action by using
 * the given key (lockId). In case the control should be
 * enabled again the lock gets removed, but the control only
 * gets enabled if *all* possibly held locks have been removed.
 */
function disableElementWithLock(elementId,lockId) {

    // unconditionally disable the element.
    disableElement(elementId);

    // remember that this element has been locked with
    // the key passed as argument. we keep a primitive
    // form of ref-count in the attribute 'lock'.
    var element = document.getElementById(elementId);
    if (element) {
        if (!element.hasAttribute(lockId)) {
            element.setAttribute(lockId, "true");
            var n = parseInt(element.getAttribute("lock") || 0);
            element.setAttribute("lock", n + 1);
        }
    }
}

/**
 * This function is intended to be used in tandem with the
 * above defined function 'disableElementWithLock()'.
 * See the respective comment for further details.
 */
function enableElementWithLock(elementId, lockId) {

    var element = document.getElementById(elementId);
    if (!element) {
        dump("unable to find " + elementId + "\n");
        return;
    }

    if (element.hasAttribute(lockId)) {
        element.removeAttribute(lockId);
        var n = parseInt(element.getAttribute("lock") || 0) - 1;
        if (n > 0) {
            element.setAttribute("lock", n);
        } else {
            element.removeAttribute("lock");
        }
        if (n <= 0) {
            enableElement(elementId);
        }
    }
}

/** 
 * Unchecks the commands of the child elements of a DOM-tree-node e.g of a menu
 *
 * @param aEvent    The event from which the target is taken to retrieve the
 *                    child elements
 */
function uncheckChildNodes(aEvent) {
    var liveList = aEvent.target.getElementsByAttribute("checked", "true");
    for (var i = liveList.length - 1; i >= 0; i-- ) {
        var commandName = liveList.item(i).getAttribute("command");
        var command = document.getElementById(commandName);
        if (command) {
            command.setAttribute("checked", "false");
        }
    }
}

/**
 * Removes all child nodes of the given node
 *
 * @param aElement  The Node (or its id) to remove children from
 */
function removeChildren(aElement) {
    if (typeof(aElement) == "string") {
        aElement = document.getElementById(aElement);
    }

    while (aElement.firstChild) {
        aElement.removeChild(aElement.lastChild);
    }
}

/**
* Fills up a menu - either a menupopup or a menulist - with menuitems that refer
* to calendars.
*
* @param aItem                 The event or task
* @param aCalendarMenuParent   The direct parent of the menuitems - either a
*                                menupopup or a menulist
* @param aCalendarToUse        The default-calendar
* @param aOnCommand            A string that is applied to the "oncommand"
*                                attribute of each menuitem
* @return                      The index of the calendar that matches the
*                                default-calendar. By default 0 is returned.
*/
function appendCalendarItems(aItem, aCalendarMenuParent, aCalendarToUse, aOnCommand) {
    var calendarToUse = aCalendarToUse || aItem.calendar;
    var calendars = getCalendarManager().getCalendars({});
    var indexToSelect = 0;
    var index = -1;
    for (var i = 0; i < calendars.length; ++i) {
        var calendar = calendars[i];
        if (calendar.id == calendarToUse.id ||
            (calendar &&
             isCalendarWritable(calendar) &&
             isItemSupported(aItem, calendar))) {
            var menuitem = addMenuItem(aCalendarMenuParent, calendar.name, calendar.name);
            menuitem.calendar = calendar;
            index++;
            if (aOnCommand) {
                menuitem.setAttribute("oncommand", aOnCommand);
            }
            if (aCalendarMenuParent.localName == "menupopup") {
                menuitem.setAttribute("type", "checkbox");
            }
            if (calendarToUse && calendarToUse.id == calendar.id) {
                indexToSelect = index;
            }
        }
    }
    return indexToSelect;
}

function appendCategoryItems(aItem, aCategoryMenuList, aCommand) {
    var categoriesList = getPrefCategoriesArray();

    // 'split'may return an array containing one
    // empty string, rather than an empty array. This results in an empty
    // menulist item with no corresponding category.
    if (categoriesList.length == 1 && !categoriesList[0].length) {
        categoriesList.pop();
    }

    // insert the category already in the menulist so it doesn't get lost
    if (aItem) {
        for each (var itemCategory in aItem.getCategories({})) {
            if (!categoriesList.some(function(cat){ return cat == itemCategory; })){
                categoriesList.push(itemCategory);
            }
        }
        sortArrayByLocaleCollator(categoriesList);
    }
    
    while (aCategoryMenuList.hasChildNodes()) {
       aCategoryMenuList.removeChild(aCategoryMenuList.lastChild);
    }

    var indexToSelect = 0;
    var menuitem = addMenuItem(aCategoryMenuList, calGetString("calendar", "None"), "NONE", aCommand);
    if (aCategoryMenuList.localName == "menupopup") {
        menuitem.setAttribute("type", "checkbox");
    }
    for (var i in categoriesList) {
        var menuitem = addMenuItem(aCategoryMenuList, categoriesList[i], categoriesList[i], aCommand);
        if (aCategoryMenuList.localName == "menupopup") {
            menuitem.setAttribute("type", "checkbox");
        }
        if (itemCategory && categoriesList[i] == itemCategory) {
            indexToSelect = parseInt(i) + 1;  // Add 1 because of 'None'
        }
    }
    return indexToSelect;
}

function addMenuItem(aParent, aLabel, aValue, aCommand) {
    if (aParent.localName == "menupopup") {
        var item = document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
        item.setAttribute("label", aLabel);
        if (aValue) {
            item.setAttribute("value", aValue);
        }
        if (aCommand) {
            item.command = aCommand;
        }
        aParent.appendChild(item);
    }
    else if (aParent.localName == "menulist") {
        item = aParent.appendItem(aLabel, aValue);
    }
    return item;
}


/**
 * sets a given attribute value on the children of a passed node
 *
 * @param aParent           the parent node.
 * @param aAttribute        the name of the attribute to be set.
 * @param aValue            the value of the attribute.
 * @param aFilterAttribute  OPTIONAL The name of an attribute that the child nodes carry
 *                            and that is used to filter the childnodes.
 * @param aFilterValue      OPTIONAL The value of the filterattribute. If set only those
 *                            childnodes are modified that have an attribute 
 *                            'aFilterAttribute' with the given value
 *                            'aFilterValue' set.
 */
function setAttributeToChildren(aParent, aAttribute, aValue, aFilterAttribute, aFilterValue) {
    for (var i = 0; i < aParent.childNodes.length; i++) {
        var element = aParent.childNodes[i];
        if (aFilterAttribute == null) {
            setElementValue(element, aValue, aAttribute);            
        } else if (element.hasAttribute(aFilterAttribute)) {
            var compValue = element.getAttribute(aFilterAttribute);
            if (compValue === aFilterValue) {
                setElementValue(element, aValue, aAttribute);
            }
        }
    }
}

/**
 * checks a radio control or a radio-menuitem.
 *
 * @param aParent  the parent node of the 'radio controls', either radios
 *                  or menuitems of the type 'radio'.
 * @param avalue   the value of the radio control bound to be checked.
 * @return         true or false depending on if the a 'radio control' with the
 *                  given value could be checked.
 */
function checkRadioControl(aParent, aValue) {
    for (var i = 0; i < aParent.childNodes.length; i++) {
        var element = aParent.childNodes[i];
        if (element.hasAttribute("value")) {
            var compValue = element.getAttribute("value");
            if (compValue == aValue) {
                if (element.localName == "menuitem") {
                    if (element.getAttribute("type") == "radio") {
                        element.setAttribute("checked", "true");
                        return true;
                    }
                }
                else if (element.localName == "radio") {
                    element.radioGroup.selectedItem = element;
                    return true;
                }
            }
        }
    }
    return false;
}

function setCategory(aItem, aMenuElement) {
    // Category
    var category = getElementValue(aMenuElement);
    // xxx todo: what about category "NONE"?
    if (category == "NONE") {
        aItem.setCategories(0, []);
    } else {
        aItem.setCategories(1, [category]);
    }
}

function processEnableCheckbox(checkboxId, elementId) {
    var checked = document.getElementById(checkboxId).checked;
    setElementValue(elementId, !checked && "true", "disabled");
}

/**
 *  Enable/disable button if there are children in a listbox
 */
function updateListboxDeleteButton(listboxId, buttonId) {
    var rowCount = document.getElementById(listboxId).getRowCount();
    setElementValue(buttonId, rowCount < 1 && "true", "disabled");
}

/**
 *  Update plural singular menu items
 */
function updateMenuLabels(lengthFieldId, menuId ) {
    var field = document.getElementById(lengthFieldId);
    var menu  = document.getElementById(menuId);

    // figure out whether we should use singular or plural
    var length = field.value;

    var newLabelNumber;

    // XXX This assumes that "0 days, minutes, etc." is plural in other languages.
    if ( (Number(length) == 0) || (Number(length) > 1) ) {
        newLabelNumber = "label2"
    } else {
        newLabelNumber = "label1"
    }

    // see what we currently show and change it if required
    var oldLabelNumber = menu.getAttribute("labelnumber");

    if (newLabelNumber != oldLabelNumber) {
        // remember what we are showing now
        menu.setAttribute("labelnumber", newLabelNumber);

        // update the menu items
        var items = menu.getElementsByTagName("menuitem");

        for (var i = 0; i < items.length; ++i) {
            var menuItem = items[i];
            var newLabel = menuItem.getAttribute(newLabelNumber);
            menuItem.label = newLabel;
            menuItem.setAttribute("label", newLabel);
        }

        // force the menu selection to redraw
        var saveSelectedIndex = menu.selectedIndex;
        menu.selectedIndex = -1;
        menu.selectedIndex = saveSelectedIndex;
    }
}

/**
 * Select value in menuList.  Throws string if no such value.
 */
function menuListSelectItem(menuListId, value) {
    var menuList = document.getElementById(menuListId);
    var index = menuListIndexOf(menuList, value);
    if (index != -1) {
        menuList.selectedIndex = index;
    } else {
        throw "menuListSelectItem: No such Element: "+value;
    }
}

/**
 * Find index of menuitem with the given value, or return -1 if not found.
 */
function menuListIndexOf(menuList, value) {
    var items = menuList.menupopup.childNodes;
    var index = -1;
    for (var i = 0; i < items.length; i++) {
        var element = items[i];
        if (element.nodeName == "menuitem") {
            index++;
        }
        if (element.getAttribute("value") == value) {
            return index;
        }
    }
    return -1; // not found
}

function createXULElement(el) {
    return document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", el);
}

/**
 * A helper function to calculate and add up certain css-values of a box.
 * It is required, that all css values can be converted to integers
 *
 * @param aXULElement   The xul element to be inspected.
 * @param aStyleProps   The css style properties for which values are to be retrieved
 *                        e.g. 'font-size', 'min-width" etc.
 * @return              An integer value denoting the optimal minimum width
 */
function getSummarizedStyleValues(aXULElement, aStyleProps) {
    var retValue = 0;
    var cssStyleDeclares = document.defaultView.getComputedStyle(aXULElement, null);
    for each (var prop in aStyleProps) {
        retValue += parseInt(cssStyleDeclares.getPropertyValue(prop), 10);
    }    
    return retValue;
}

/**
 * Calculates the optimal minimum width based on the set css style-rules
 * by considering the css rules for the min-width, padding, border, margin 
 * and border of the box.
 *
 * @param aXULElement   The xul element to be inspected.
 * @return              An integer value denoting the optimal minimum width
 */
function getOptimalMinimumWidth(aXULElement) {
    return getSummarizedStyleValues(aXULElement, ["min-width",
                                                  "padding-left", "padding-right",
                                                  "margin-left", "margin-top",
                                                  "border-left-width", "border-right-width"]);
}

/**
 * Calculates the optimal minimum height based on the set css style-rules
 * by considering the css rules for the font-size, padding, border, margin 
 * and border of the box. In its current state the line-height is considered
 * by assuming that it's size is about one third of the size of the font-size
 *
 * @param aXULElement   The xul-element to be inspected.
 * @return              An integer value denoting the optimal minimum height
 */
function getOptimalMinimumHeight(aXULElement) {
    // the following line of code presumes that the line-height is set to "normal" 
    // which is supposed to be a "reasonable distance" between the lines
    var firstEntity = parseInt(1.35 * getSummarizedStyleValues(aXULElement, ["font-size"]), 10);
    var secondEntity = getSummarizedStyleValues(aXULElement,
                                                ["padding-bottom", "padding-top",
                                                "margin-bottom", "margin-top",
                                                "border-bottom-width", "border-top-width"]);
    return (firstEntity + secondEntity);
}

/**
 * Use with textfields oninput to only allow integers
 *
 * @param event         The event that contains the target
 * @param lowerBound    The lower bound the number should have
 * @param upperBound    The upper bound the number should have
 */
function validateIntegerRange(event, lowerBound, upperBound) {
    validateIntegers(event);

    var num = Number(event.target.value);

    // Only modify the number if a value is entered, otherwise deleting the
    // value (to maybe enter a new number) will cause the field to be set to the
    // lower bound.
    if (event.target.value != "" && (num < lowerBound || num > upperBound)) {
        event.target.value = Math.min(Math.max(num, lowerBound), upperBound);
        event.preventDefault();
    }
}

/**
 * Validate Integers, or rather validate numbers. Makes sure the input value is
 * a number.
 *
 * @param event         The event that contains the target
 */
function validateIntegers(event) {
    if (isNaN(Number(event.target.value))) {
        var newValue = parseInt(event.target.value);
        event.target.value = isNaN(newValue) ? "" : newValue;
        event.preventDefault();
    }
}

/**
 * Make sure the number entered is 0 or more. A negative number is turned
 * positive.
 *
 * @param event         The event that contains the target
 */
function validateNaturalNums(event) {
    validateIntegers(event);
    var num = event.target.value;
    if (num < 0) {
        event.target.value = -1 * num;
        event.preventDefault();
    }
}

function getOtherOrientation(aOrientation) {
     return (aOrientation == "horizontal" ? "vertical" : "horizontal");
}

/**
 * Setting labels on a menuitem doesn't update the label that is shown when the
 * menuitem is selected. This function takes care by reselecting the item
 *
 * @param aElement  The element to update, or its id as a string
 */
function updateSelectedLabel(aElement) {
    if (typeof(aElement) == "string") {
        aElement = document.getElementById(aElement);
    }
    var selectedIndex = aElement.selectedIndex;
    aElement.selectedIndex = -1;
    aElement.selectedIndex = selectedIndex;
}
