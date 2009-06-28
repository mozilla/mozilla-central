/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

Components.utils.import("resource://app/modules/jsTreeSelection.js");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var fakeView = {
  rowCount: 101,
  selectionChanged: function() {
  },
  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsITreeView]),
};

var fakeBox = {
  view: fakeView,
  invalidate: function() {},
  invalidateRow: function() {},
  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsITreeBoxObject]),
};

var sel = new JSTreeSelection(fakeBox);

function bad_ranges(aMsg, aExpected) {
  let s = "\x1b[1;31m!!! BAD RANGES: " + aMsg + "\n";
  s += "Selection ranges: " + sel._ranges.length + ":";
  for each (let [,[low,high]] in Iterator(sel._ranges)) {
    s += " " + low + "-" + high;
  }

  s += "\nExpected ranges: " + aExpected.length + ":";
  for (let i = 0; i < aExpected.length; i++) {
    s += " " + aExpected[i][0] + "-" + aExpected[i][1];
  }

  s += "\x1b[0m\n";

  dump(s);
  do_throw(aMsg);
}

function assert_selection_ranges() {
  if (sel._ranges.length != arguments.length)
    bad_ranges("Wrong number of ranges!", arguments);

  let i = 0;
  let ourCount = 0;
  for each (let [,[slow,shigh]] in Iterator(sel._ranges)) {
    let [dlow, dhigh] = arguments[i++];
    if (dlow != slow || dhigh != shigh)
      bad_ranges("Range mis-match on index " + i, arguments);
    ourCount += shigh - slow + 1;
  }

  if (ourCount != sel.count)
    bad_ranges("Count was wrong! We counted " + ourCount + " but they say " +
               sel.count, arguments);
}
var asr = assert_selection_ranges;

function assert_current_index(aIndex) {
  if (sel.currentIndex != aIndex)
    do_throw("Current index is wrong! Is " + sel.currentIndex +
             " but should be " + aIndex);
}
var aci = assert_current_index;

function assert_shift_pivot(aIndex) {
  if (sel.shiftSelectPivot != aIndex)
    do_throw("Current index is wrong! Is " + sel._shiftSelectPivot +
             " but should be " + aIndex);
}
var asp = assert_shift_pivot;

function assert_selected(aIndex) {
  if (!sel.isSelected(aIndex))
    do_throw("Index is not selected but should be: " + aIndex);
}
var asel = assert_selected;

function assert_not_selected(aIndex) {
  if (sel.isSelected(aIndex))
    do_throw("Index is selected but should not be: " + aIndex);
}
var ansel = assert_not_selected;

function run_test() {
  // -- select
  sel.select(1);
  asel(1);
  ansel(0);
  ansel(2);
  asr([1,1]);
  aci(1);

  sel.select(2);
  asel(2);
  ansel(1);
  ansel(3);
  asr([2,2]);
  aci(2);

  // -- clearSelection
  sel.clearSelection();
  asr();
  aci(2); // should still be the same...

  // -- toggleSelect
  // start from nothing
  sel.clearSelection();
  sel.toggleSelect(1);
  asr([1, 1]);
  aci(1);

  // lower fusion
  sel.select(2);
  sel.toggleSelect(1);
  asr([1, 2]);
  aci(1);

  // upper fusion
  sel.toggleSelect(3);
  asr([1, 3]);
  aci(3);

  // splitting
  sel.toggleSelect(2);
  asr([1, 1], [3, 3]);
  asel(1);
  asel(3);
  ansel(0);
  ansel(2);
  ansel(4);
  aci(2);

  // merge
  sel.toggleSelect(2);
  asr([1, 3]);
  aci(2);

  // lower shrinkage
  sel.toggleSelect(1);
  asr([2, 3]);
  aci(1);

  // upper shrinkage
  sel.toggleSelect(3);
  asr([2, 2]);
  aci(3);

  // nukage
  sel.toggleSelect(2);
  asr();
  aci(2);

  // -- rangedSelect
  // simple non-augment
  sel.rangedSelect(0, 0, false);
  asr([0, 0]);
  asp(0);
  aci(0);

  // slightly less simple non-augment
  sel.rangedSelect(2, 4, false);
  asr([2, 4]);
  asp(2);
  aci(4);

  // higher distinct range
  sel.rangedSelect(7, 9, true);
  asr([2, 4], [7, 9]);
  asp(7);
  aci(9);

  // lower distinct range
  sel.rangedSelect(0, 0, true);
  asr([0, 0], [2, 4], [7, 9]);
  asp(0);
  aci(0);

  // lower fusion
  sel.rangedSelect(6, 6, true);
  asr([0, 0], [2, 4], [6, 9]);
  asp(6);
  aci(6);

  // upper fusion
  sel.rangedSelect(10, 11, true);
  asr([0, 0], [2, 4], [6, 11]);
  asp(10);
  aci(11);

  // notch merge
  sel.rangedSelect(5, 5, true);
  asr([0, 0], [2, 11]);
  asp(5);
  aci(5);

  // ambiguous consume with merge
  sel.rangedSelect(0, 5, true);
  asr([0, 11]);
  asp(0);
  aci(5);

  // aligned consumption
  sel.rangedSelect(0, 15, true);
  asr([0, 15]);
  asp(0);
  aci(15);

  // excessive consumption
  sel.rangedSelect(5, 7, false);
  sel.rangedSelect(3, 10, true);
  asr([3, 10]);
  asp(3);
  aci(10);

  // overlap merge
  sel.rangedSelect(5, 10, false);
  sel.rangedSelect(15, 20, true);
  sel.rangedSelect(7, 17, true);
  asr([5, 20]);
  asp(7);
  aci(17);

  // big merge and consume
  sel.rangedSelect(5, 10, false);
  sel.rangedSelect(15, 20, true);
  sel.rangedSelect(25, 30, true);
  sel.rangedSelect(35, 40, true);
  sel.rangedSelect(7, 37, true);
  asr([5, 40]);
  asp(7);
  aci(37);

  // broad lower fusion
  sel.rangedSelect(10, 20, false);
  sel.rangedSelect(3, 15, true);
  asr([3, 20]);
  asp(3);
  aci(15);

  // -- clearRange
  sel.rangedSelect(10, 30, false);

  // irrelevant low
  sel.clearRange(0, 5);
  asr([10, 30]);

  // irrelevant high
  sel.clearRange(40, 45);
  asr([10, 30]);

  // lower shrinkage tight
  sel.clearRange(10, 10);
  asr([11, 30]);

  // lower shrinkage broad
  sel.clearRange(0, 13);
  asr([14, 30]);

  // upper shrinkage tight
  sel.clearRange(30, 30);
  asr([14, 29]);

  // upper shrinkage broad
  sel.clearRange(27, 50);
  asr([14, 26]);

  // split tight
  sel.clearRange(20, 20);
  asr([14, 19], [21, 26]);

  // split broad
  sel.toggleSelect(20);
  sel.clearRange(19, 21);
  asr([14, 18], [22, 26]);

  // hit two with tight shrinkage
  sel.clearRange(18, 22);
  asr([14, 17], [23, 26]);

  // hit two with broad shrinkage
  sel.clearRange(15, 25);
  asr([14, 14], [26, 26]);

  // obliterate
  sel.clearRange(0, 100);
  asr();

  // multi-obliterate
  sel.rangedSelect(10, 20, true);
  sel.rangedSelect(30, 40, true);
  sel.clearRange(0, 100);
  asr();

  // obliterate with shrinkage
  sel.rangedSelect(5, 10, true);
  sel.rangedSelect(15, 20, true);
  sel.rangedSelect(25, 30, true);
  sel.rangedSelect(35, 40, true);
  sel.clearRange(7, 37);
  asr([5, 6], [38, 40]);

  // -- selectAll
  sel.selectAll();
  asr([0, 100]);

  // -- adjustSelection
  // bump due to addition on simple select
  sel.select(5);
  sel.adjustSelection(5, 1);
  asr([6, 6]);
  aci(6);

  sel.select(5);
  sel.adjustSelection(0, 1);
  asr([6, 6]);
  aci(6);

  // bump due to addition on ranged simple select
  sel.rangedSelect(5, 5, false);
  sel.adjustSelection(5, 1);
  asr([6, 6]);
  asp(6);
  aci(6);

  sel.rangedSelect(5, 5, false);
  sel.adjustSelection(0, 1);
  asr([6, 6]);
  asp(6);
  aci(6);

  // bump due to addition on ranged select
  sel.rangedSelect(5, 7, false);
  sel.adjustSelection(5, 1);
  asr([6, 8]);
  asp(6);
  aci(8);

  // no-op with addition
  sel.rangedSelect(0, 3, false);
  sel.adjustSelection(10, 1);
  asr([0, 3]);
  asp(0);
  aci(3);

  // split due to addition
  sel.rangedSelect(5, 6, false);
  sel.adjustSelection(6, 1);
  asr([5, 5], [7, 7]);
  asp(5);
  aci(7);

  // shift due to removal on simple select
  sel.select(5);
  sel.adjustSelection(0, -1);
  asr([4, 4]);
  aci(4);

  // shift due to removal on ranged simple select
  sel.rangedSelect(5, 5, false);
  sel.adjustSelection(0, -1);
  asr([4, 4]);
  asp(4);
  aci(4);

  // nuked due to removal on simple select
  sel.select(5);
  sel.adjustSelection(5, -1);
  asr();
  aci(-1);

  // upper tight shrinkage due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(10, -1);
  asr([5, 9]);
  asp(5);
  aci(-1);

  // upper broad shrinkage due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(6, -10);
  asr([5, 5]);
  asp(5);
  aci(-1);

  // lower tight shrinkage due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(5, -1);
  asr([5, 9]);
  asp(-1);
  aci(9);

  // lower broad shrinkage due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(0, -10);
  asr([0, 0]);
  asp(-1);
  aci(0);

  // tight nuke due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(5, -6);
  asr();
  asp(-1);
  aci(-1);

  // broad nuke due to removal
  sel.rangedSelect(5, 10, false);
  sel.adjustSelection(0, -20);
  asr();
  asp(-1);
  aci(-1);

  // duplicateSelection (please keep this right at the end, as this modifies
  // sel)
  // no guarantees for the shift pivot yet, so don't test that
  let oldSel = sel;
  let newSel = new JSTreeSelection(fakeBox);
  // multiple selections
  oldSel.rangedSelect(1, 3, false);
  oldSel.rangedSelect(5, 5, true);
  oldSel.rangedSelect(10, 10, true);
  oldSel.rangedSelect(6, 7, true);

  oldSel.duplicateSelection(newSel);
  // from now on we're only going to be checking newSel
  sel = newSel;
  asr([1, 3], [5, 7], [10, 10]);
  aci(7);

  // single selection
  oldSel.select(4);
  oldSel.duplicateSelection(newSel);
  asr([4, 4]);
  aci(4);

  // nothing selected
  oldSel.clearSelection();
  oldSel.duplicateSelection(newSel);
  asr();
  aci(4);
}
