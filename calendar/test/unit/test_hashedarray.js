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
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

Components.utils.import("resource://calendar/modules/calHashedArray.jsm");

function run_test() {
    test_array_base();
    test_array_sorted();
    test_hashAccessor();
}

/**
 * Helper function to create an item that has a sensible hash id, with the given
 * title identification.
 *
 * @param ident     The title to identify the item.
 * @return          The created item.
 */
function hashedCreateItem(ident) {
    let item = cal.createEvent();
    item.calendar = { id : "test" }
    item.id = cal.getUUID();
    item.title = ident;
    return item;
}

/**
 * Comparator function to sort the items by their title
 *
 * @param a         Object to compare.
 * @param b         Object to compare with.
 * @return          0, -1, or 1 (usual comptor meanings)
 */
function titleComptor(a, b) {
    if (a.title > b.title) {
        return 1;
    } else if (a.title < b.title) {
        return -1;
    } else {
        return 0;
    }
}

/**
 * Checks if the hashed array accessor functions work for the status of the
 * items array.
 *
 * @param har           The Hashed Array
 * @param testItems     The array of test items
 * @param itemAccessor  The accessor func to retrieve the items
 * @throws Exception    If the arrays are not the same.
 */
function checkConsistancy(har, testItems, itemAccessor) {
    itemAccessor = itemAccessor || function(o) { return o; }
    for (let idx in testItems) {
        let ti = itemAccessor(testItems[idx]);
        do_check_eq(itemAccessor(har.itemByIndex(idx)).title,
                    ti.title);
        do_check_eq(itemAccessor(har.itemById(ti.hashId)).title,
                    ti.title);
        do_check_eq(har.indexOf(testItems[idx]), idx);
    }
}

/**
 * Useful for debugging, in case this test fails. Dumps the array showing the
 * title identifications.
 *
 * @param ar        The array to dump
 */
function dumpArray(ar) {
    dump("ARR: " + ar.map(function(e) e.title).toSource() + "\n");
}

/**
 * Man, this function is really hard to keep general enough, I'm almost tempted
 * to duplicate the code. It checks if the remove and modify operations work for
 * the given hashed array.
 *
 * @param har               The Hashed Array
 * @param testItems         The js array with the items
 * @param postprocessFunc   (optional) The function to call after each
 *                            operation, but before checking consistancy.
 * @param itemAccessor      (optional) The function to access the item for an
 *                            array element.
 * @param itemCreator       (optional) Function to create a new item for the
 *                            array.
 */
function testRemoveModify(har, testItems, postprocessFunc, itemAccessor, itemCreator) {
    postprocessFunc = postprocessFunc || function(a, b) { return [a,b]; };
    itemCreator = itemCreator || function(title) hashedCreateItem(title);
    itemAccessor = itemAccessor || function(o) { return o; }

    // Now, delete the second item and check again
    har.removeById(itemAccessor(testItems[1]).hashId);
    testItems.splice(1, 1);
    [har, testItems] = postprocessFunc(har, testItems);

    checkConsistancy(har, testItems, itemAccessor);

    // Try the same by index
    har.removeByIndex(2);
    testItems.splice(2, 1);
    [har, testItems] = postprocessFunc(har, testItems);
    checkConsistancy(har, testItems, itemAccessor);

    // Try modifying an item
    let newInstance = itemCreator("z-changed");
    itemAccessor(newInstance).id = itemAccessor(testItems[0]).id;
    testItems[0] = newInstance;
    har.modifyItem(newInstance);
    [har, testItems] = postprocessFunc(har, testItems);
    checkConsistancy(har, testItems, itemAccessor);
}

/**
 * Tests the basic cal.HashedArray
 */
function test_array_base() {
    let har, testItems;

    // Test normal additions
    har = new cal.HashedArray();
    testItems = ["a","b","c","d"].map(hashedCreateItem);

    testItems.forEach(har.addItem, har);
    checkConsistancy(har, testItems);
    testRemoveModify(har, testItems);

    // Test adding in batch mode
    har = new cal.HashedArray();
    testItems = ["e", "f", "g", "h"].map(hashedCreateItem);
    har.startBatch();
    testItems.forEach(har.addItem, har);
    har.endBatch();
    checkConsistancy(har, testItems);
    testRemoveModify(har, testItems);
}

/**
 * Tests the sorted cal.SortedHashedArray
 */
function test_array_sorted() {
    let har, testItems, testItemsSorted;

    function sortedPostProcess(harParam, tiParam) {
        tiParam = tiParam.sort(titleComptor);
        return [harParam, tiParam];
    }

    // Test normal additions
    har = new cal.SortedHashedArray(titleComptor);
    testItems = ["d", "c", "a", "b"].map(hashedCreateItem);
    testItemsSorted = testItems.sort(titleComptor);

    testItems.forEach(har.addItem, har);
    checkConsistancy(har, testItemsSorted);
    testRemoveModify(har, testItemsSorted, sortedPostProcess);

    // Test adding in batch mode
    har = new cal.SortedHashedArray(titleComptor);
    testItems = ["e", "f", "g", "h"].map(hashedCreateItem);
    testItemsSorted = testItems.sort(titleComptor);
    har.startBatch();
    testItems.forEach(har.addItem, har);
    har.endBatch();
    checkConsistancy(har, testItemsSorted);
    testRemoveModify(har, testItemsSorted, sortedPostProcess);
}

/**
 * Tests cal.SortedHashedArray with a custom hashAccessor.
 */
function test_hashAccessor() {
    let har, testItems, testItemsSorted;
    let comptor = function(a,b) titleComptor(a.item, b.item);

    har = new cal.SortedHashedArray(comptor);
    har.hashAccessor = function(obj) {
        return obj.item.hashId;
    };

    function itemAccessor(obj) {
        if (!obj) do_throw("WTF?");
        return obj.item;
    }

    function itemCreator(title) {
        return { item: hashedCreateItem(title) };
    }

    function sortedPostProcess(harParam, tiParam) {
        tiParam = tiParam.sort(comptor);
        return [harParam, tiParam];
    }

    testItems = ["d", "c", "a", "b"].map(itemCreator);

    testItemsSorted = testItems.sort(comptor);
    testItems.forEach(har.addItem, har);
    checkConsistancy(har, testItemsSorted, itemAccessor);
    testRemoveModify(har, testItemsSorted, sortedPostProcess, itemAccessor, itemCreator);
}
