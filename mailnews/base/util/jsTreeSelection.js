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

EXPORTED_SYMBOLS = ['JSTreeSelection'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * Partial nsITreeSelection implementation so that we can have nsMsgDBViews that
 *  exist only for message display but do not need to be backed by a full
 *  tree view widget.  This could also hopefully be used for more xpcshell unit
 *  testing of the FolderDisplayWidget.  It might also be useful for creating
 *  transient selections when right-click selection happens.
 *
 * Our current limitations:
 * - We do not support any single selection modes.  This is mainly because we
 *   need to look at the box object for that and we don't want to do it.
 * - Timed selection.  Our expected consumers don't use it.
 *
 * Our current laziness:
 * - We aren't very precise about invalidation when it would be potentially
 *   complicated.  The theory is that if there is a tree box object, it's
 *   probably native and the XPConnect overhead is probably a lot more than
 *   any potential savings, at least for now when the tree display is
 *   generally C++ XPCOM backed rather than JS XPCOM backed.  Also, we
 *   aren't intended to actually be used with a real tree display; you should
 *   be using the C++ object in that case!
 *
 * If documentation is omitted for something, it is because we have little to
 *  add to the documentation of nsITreeSelection and really hope that our
 *  documentation tool will copy-down that documentation.
 *
 * This implementation attempts to mimic the behavior of nsTreeSelection.  In
 *  a few cases, this leads to potentially confusing actions.  I attempt to note
 *  when we are doing this and why we do it.
 *
 * Unit test is in mailnews/base/util/test_jsTreeSelection.js
 */
function JSTreeSelection(aTreeBoxObject) {
  this._treeBoxObject = aTreeBoxObject;

  this._currentIndex = null;
  this._shiftSelectPivot = null;
  this._ranges = [];
  this._count = 0;

  this._selectEventsSuppressed = false;
}
JSTreeSelection.prototype = {
  /**
   * The current nsITreeBoxObject, appropriately QueryInterfaced.  May be null.
   */
  _treeBoxObject: null,

  /**
   * Where the focus rectangle (that little dotted thing) shows up.  Just
   *  because something is focused does not mean it is actually selected.
   */
  _currentIndex: null,
  /**
   * The view index where the shift is anchored when it is not (conceptually)
   *  the same as _currentIndex.  This only happens when you perform a ranged
   *  selection.  In that case, the start index of the ranged selection becomes
   *  the shift pivot (and the _currentIndex becomes the end of the ranged
   *  selection.)
   * It gets cleared whenever the selection changes and it's not the result of
   *  a call to rangedSelect.
   */
  _shiftSelectPivot: null,
  /**
   * A list of [lowIndexInclusive, highIndexInclusive] non-overlapping,
   *  non-adjacent 'tuples' sort in ascending order.
   */
  _ranges: [],
  /**
   * The number of currently selected rows.
   */
  _count: 0,

  // In the case of the stand-alone message window, there's no tree, but
  // there's a view.
  _view: null,

  get tree JSTreeSelection_get_treeBoxObject() {
    return this._treeBoxObject;
  },
  set tree JSTreeSelection_set_treeBoxObject(aTreeBoxObject) {
    this._treeBoxObject = aTreeBoxObject;
  },

  set view JSTreeSelection_set_view(aView) {
    this._view = aView;
  },
  /**
   * Although the nsITreeSelection documentation doesn't say, what this method
   *  is supposed to do is check if the seltype attribute on the XUL tree is any
   *  of the following: "single" (only a single row may be selected at a time,
   *  "cell" (a single cell may be selected), or "text" (the row gets selected
   *  but only the primary column shows up as selected.)
   *
   * @return false because we don't support single-selection.
   */
  get single JSTreeSelection_get_single() {
    return false;
  },

  _updateCount: function JSTreeSelection__updateCount() {
    this._count = 0;
    for each (let [, [low, high]] in Iterator(this._ranges)) {
      this._count += high - low + 1;
    }
  },

  get count JSTreeSelection_get_count() {
    return this._count;
  },

  isSelected: function JSTreeSelection_isSelected(aViewIndex) {
    for each (let [,[low, high]] in Iterator(this._ranges)) {
      if (aViewIndex >= low && aViewIndex <= high)
        return true;
    }
    return false;
  },

  /**
   * Select the given row.  It does nothing if that row was already selected.
   */
  select: function JSTreeSelection_select(aViewIndex) {
    // current index will provide our effective shift pivot
    this._shiftSelectPivot = null;
    this.currentIndex = aViewIndex;

    if (this._count == 1 && this._ranges[0][0] == aViewIndex)
      return;

    this._count = 1;
    this._ranges = [[aViewIndex, aViewIndex]];

    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();

    this._fireSelectionChanged();
  },

  timedSelect: function JSTreeSelection_timedSelect(aIndex, aDelay) {
    throw new Error("We do not implement timed selection.");
  },

  toggleSelect: function JSTreeSelection_toggleSelect(aIndex) {
    this.currentIndex = aIndex;
    // If nothing's selected, select aIndex
    if (this._count == 0) {
      this._count = 1;
      this._ranges = [[aIndex, aIndex]];
    }
    else for each (let [iTupe, [low, high]] in Iterator(this._ranges)) {
      // below the range? add it to the existing range or create a new one
      if (aIndex < low) {
        this._count++;
        // is it just below an existing range? (range fusion only happens in the
        //  high case, not here.)
        if (aIndex == low - 1) {
          this._ranges[iTupe][0] = aIndex;
          break;
        }
        // then it gets its own range
        this._ranges.splice(iTupe, 0, [aIndex, aIndex]);
        break;
      }
      // in the range?  will need to either nuke, shrink, or split the range to
      //  remove it
      if (aIndex >= low && aIndex <= high) {
        this._count--;
        // nuke
        if (aIndex == low && aIndex == high)
          this._ranges.splice(iTupe, 1);
        // lower shrink
        else if (aIndex == low)
          this._ranges[iTupe][0] = aIndex + 1;
        // upper shrink
        else if (aIndex == high)
          this._ranges[iTupe][1] = aIndex - 1;
        // split
        else
          this._ranges.splice(iTupe, 1, [low, aIndex - 1], [aIndex + 1, high]);
        break;
      }
      // just above the range?  fuse into the range, and possibly the next
      //  range up.
      if (aIndex == high + 1) {
        this._count++;
        // see if there is another range and there was just a gap of one between
        //  the two ranges.
        if ((iTupe + 1 < this._ranges.length) &&
            (this._ranges[iTupe+1][0] == aIndex + 1)) {
          // yes, merge the ranges
          this._ranges.splice(iTupe, 2, [low, this._ranges[iTupe+1][1]]);
          break;
        }
        // nope, no merge required, just update the range
        this._ranges[iTupe][1] = aIndex;
        break;
      }
      // otherwise we need to keep going
    }

    if (this._treeBoxObject)
      this._treeBoxObject.invalidateRow(aIndex);
    this._fireSelectionChanged();
  },

  /**
   * @param aRangeStart If omitted, it implies a shift-selection is happening,
   *     in which case we use _shiftSelectPivot as the start if we have it,
   *     _currentIndex if we don't, and if we somehow didn't have a
   *     _currentIndex, we use the range end.
   * @param aRangeEnd Just the inclusive end of the range.
   * @param aAugment Does this set a new selection or should it be merged with
   *     the existing selection?
   */
  rangedSelect: function JSTreeSelection_rangedSelect(aRangeStart, aRangeEnd,
                                                      aAugment) {
    if (aRangeStart == -1) {
      if (this._shiftSelectPivot != null)
        aRangeStart = this._shiftSelectPivot;
      else if (this._currentIndex != null)
        aRangeStart = this._currentIndex;
      else
        aRangeStart = aRangeEnd;
    }

    this._shiftSelectPivot = aRangeStart;
    this.currentIndex = aRangeEnd;

    // enforce our ordering constraint for our ranges
    if (aRangeStart > aRangeEnd)
      [aRangeStart, aRangeEnd] = [aRangeEnd, aRangeStart];

    // if we're not augmenting, then this is really easy.
    if (!aAugment) {
      this._count = aRangeEnd - aRangeStart + 1;
      this._ranges = [[aRangeStart, aRangeEnd]];
      if (this._treeBoxObject)
        this._treeBoxObject.invalidate();
      this._fireSelectionChanged();
      return;
    }

    // Iterate over our existing set of ranges, finding the 'range' of ranges
    //  that our new range overlaps or simply obviates.
    // Overlap variables track blocks we need to keep some part of, Nuke
    //  variables are for blocks that get spliced out.  For our purposes, all
    //  overlap blocks are also nuke blocks.
    let lowOverlap, lowNuke, highNuke, highOverlap;
    // in case there is no overlap, also figure an insertionPoint
    let insertionPoint = this._ranges.length; // default to the end
    for each (let [iTupe, [low, high]] in Iterator(this._ranges)) {
      // If it's completely include the range, it should be nuked
      if (aRangeStart <= low && aRangeEnd >= high) {
        if (lowNuke == null) // only the first one we see is the low one
          lowNuke = iTupe;
        highNuke = iTupe;
      }
      // If our new range start is inside a range or is adjacent, it's overlap
      if (aRangeStart >= low - 1 && aRangeStart <= high + 1 &&
          lowOverlap == null)
        lowOverlap = lowNuke = highNuke = iTupe;
      // If our new range ends inside a range or is adjacent, it's overlap
      if (aRangeEnd >= low - 1 && aRangeEnd <= high + 1) {
        highOverlap = highNuke = iTupe;
        if (lowNuke == null)
          lowNuke = iTupe;
      }

      // we're done when no more overlap is possible
      if (aRangeEnd < low) {
        insertionPoint = iTupe;
        break;
      }
    }

    if (lowOverlap != null)
      aRangeStart = Math.min(aRangeStart, this._ranges[lowOverlap][0]);
    if (highOverlap != null)
      aRangeEnd = Math.max(aRangeEnd, this._ranges[highOverlap][1]);
    if (lowNuke != null)
      this._ranges.splice(lowNuke, highNuke - lowNuke + 1,
                          [aRangeStart, aRangeEnd]);
    else
      this._ranges.splice(insertionPoint, 0, [aRangeStart, aRangeEnd]);

    this._updateCount();
    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();
    this._fireSelectionChanged();
  },

  /**
   * This is basically RangedSelect but without insertion of a new range and we
   *  don't need to worry about adjacency.
   * Oddly, nsTreeSelection doesn't fire a selection changed event here...
   */
  clearRange: function JSTreeSelection_clearRange(aRangeStart, aRangeEnd) {
    // Iterate over our existing set of ranges, finding the 'range' of ranges
    //  that our clear range overlaps or simply obviates.
    // Overlap variables track blocks we need to keep some part of, Nuke
    //  variables are for blocks that get spliced out.  For our purposes, all
    //  overlap blocks are also nuke blocks.
    let lowOverlap, lowNuke, highNuke, highOverlap;
    for each (let [iTupe, [low, high]] in Iterator(this._ranges)) {
      // If we completely include the range, it should be nuked
      if (aRangeStart <= low && aRangeEnd >= high) {
        if (lowNuke == null) // only the first one we see is the low one
          lowNuke = iTupe;
        highNuke = iTupe;
      }
      // If our new range start is inside a range, it's nuke and maybe overlap
      if (aRangeStart >= low && aRangeStart <= high && lowNuke == null) {
        lowNuke = highNuke = iTupe;
        // it's only overlap if we don't match at the low end
        if (aRangeStart > low)
          lowOverlap = iTupe;
      }
      // If our new range ends inside a range, it's nuke and maybe overlap
      if (aRangeEnd >= low && aRangeEnd <= high) {
        highNuke = iTupe;
        // it's only overlap if we don't match at the high end
        if (aRangeEnd < high)
          highOverlap = iTupe;
        if (lowNuke == null)
          lowNuke = iTupe;
      }

      // we're done when no more overlap is possible
      if (aRangeEnd < low)
        break;
    }
    // nothing to do since there's nothing to nuke
    if (lowNuke == null)
      return;
    let args = [lowNuke, highNuke - lowNuke + 1];
    if (lowOverlap != null)
      args.push([this._ranges[lowOverlap][0], aRangeStart - 1]);
    if (highOverlap != null)
      args.push([aRangeEnd + 1, this._ranges[highOverlap][1]]);
    this._ranges.splice.apply(this._ranges, args);

    this._updateCount();
    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();
    // note! nsTreeSelection doesn't fire a selection changed event, so neither
    //  do we, but it seems like we should
  },

  /**
   * nsTreeSelection always fires a select notification when the range is
   *  cleared, even if there is no effective chance in selection.
   */
  clearSelection: function JSTreeSelection_clearSelection() {
    this._shiftSelectPivot = null;
    this._count = 0;
    this._ranges = [];
    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();
    this._fireSelectionChanged();
  },

  /**
   * Not even nsTreeSelection implements this.
   */
  invertSelection: function JSTreeSelection_invertSelection() {
    throw new Error("Who really was going to use this?");
  },

  /**
   * Select all with no rows is a no-op, otherwise we select all and notify.
   */
  selectAll: function JSTreeSelection_selectAll() {
    if (!this._treeBoxObject)
      return;

    let view = this._treeBoxObject.view.QueryInterface(Ci.nsITreeView);
    let rowCount = view.rowCount;

    // no-ops-ville
    if (!rowCount)
      return;

    this._count = rowCount;
    this._ranges = [[0, rowCount - 1]];

    this._treeBoxObject.invalidate();
    this._fireSelectionChanged();
  },

  getRangeCount: function JSTreeSelection_getRangeCount() {
    return this._ranges.length;
  },
  getRangeAt: function JSTreeSelection_getRangeAt(aRangeIndex, aMinObj,
                                                  aMaxObj) {
    if (aRangeIndex < 0 || aRangeIndex > this._ranges.length)
      throw new Exception("Try a real range index next time.");
    [aMinObj.value, aMaxObj.value] = this._ranges[aRangeIndex];
  },

  invalidateSelection: function JSTreeSelection_invalidateSelection() {
    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();
  },

  /**
   * Helper method to adjust points in the face of row additions/removal.
   * @param aPoint The point, null if there isn't one, or an index otherwise.
   * @param aDeltaAt The row at which the change is happening.
   * @param aDelta The number of rows added if positive, or the (negative)
   *     number of rows removed.
   */
  _adjustPoint: function JSTreeSelection__adjustPoint(aPoint, aDeltaAt,
                                                      aDelta) {
    // if there is no point, no change
    if (aPoint == null)
      return aPoint;
    // if the point is before the change, no change
    if (aPoint < aDeltaAt)
      return aPoint;
    // if it's a deletion and it includes the point, clear it
    if (aDelta < 0 && aPoint >= aDeltaAt && (aPoint + aDelta < aDeltaAt))
      return null;
    // (else) the point is at/after the change, compensate
    return aPoint + aDelta;
  },
  /**
   * Find the index of the range, if any, that contains the given index, and
   *  the index at which to insert a range if one does not exist.
   *
   * @return A tuple containing: 1) the index if there is one, null otherwise,
   *     2) the index at which to insert a range that would contain the point.
   */
  _findRangeContainingRow:
      function JSTreeSelection__findRangeContainingRow(aIndex) {
    for each (let [iTupe, [low, high]] in Iterator(this._ranges)) {
      if (aIndex >= low && aIndex <= high)
        return [iTupe, iTupe];
      if (aIndex < low)
        return [null, iTupe];
    }
    return [null, this._ranges.length];
  },


  /**
   * When present, a list of calls made to adjustSelection.  See
   *  |logAdjustSelectionForReplay| and |replayAdjustSelectionLog|.
   */
  _adjustSelectionLog: null,
  /**
   * Start logging calls to adjustSelection made against this instance.  You
   *  would do this because you are replacing an existing selection object
   *  with this instance for the purposes of creating a transient selection.
   *  Of course, you want the original selection object to be up-to-date when
   *  you go to put it back, so then you can call replayAdjustSelectionLog
   *  with that selection object and everything will be peachy.
   */
  logAdjustSelectionForReplay:
      function JSTreeSelection_logAdjustSelectionForReplay() {
    this._adjustSelectionLog = [];
  },
  /**
   * Stop logging calls to adjustSelection and replay the existing log against
   *  aSelection.
   *
   * @param aSelection {nsITreeSelection}.
   */
  replayAdjustSelectionLog:
      function JSTreeSelection_replayAdjustSelectionLog(aSelection) {
    if (this._adjustSelectionLog.length) {
      // Temporarily disable selection events because adjustSelection is going
      //  to generate an event each time otherwise, and better 1 event than
      //  many.
      aSelection.selectEventsSuppressed = true;
      for each (let [, [index, count]] in Iterator(this._adjustSelectionLog)) {
        aSelection.adjustSelection(index, count);
      }
      aSelection.selectEventsSuppressed = false;
    }
    this._adjustSelectionLog = null;
  },

  adjustSelection: function JSTreeSelection_adjustSelection(aIndex, aCount) {
    // nothing to do if there is no actual change
    if (!aCount)
      return;

    if (this._adjustSelectionLog)
      this._adjustSelectionLog.push([aIndex, aCount]);

    // adjust our points
    this._shiftSelectPivot = this._adjustPoint(this._shiftSelectPivot,
                                               aIndex, aCount);
    this._currentIndex = this._adjustPoint(this._currentIndex, aIndex, aCount);

    // If we are adding rows, we want to split any range at aIndex and then
    //  translate all of the ranges above that point up.
    if (aCount > 0) {
      let [iContain, iInsert] = this._findRangeContainingRow(aIndex);
      if (iContain != null) {
        let [low, high] = this._ranges[iContain];
        // if it is the low value, we just want to shift the range entirely, so
        //  do nothing (and keep iInsert pointing at it for translation)
        // if it is not the low value, then there must be at least two values so
        //  we should split it and only translate the new/upper block
        if (aIndex != low) {
          this._ranges.splice(iContain, 1, [low, aIndex - 1], [aIndex, high]);
          iInsert++;
        }
      }
      // now translate everything from iInsert on up
      for (let iTrans = iInsert; iTrans < this._ranges.length; iTrans++) {
        let [low, high] = this._ranges[iTrans];
        this._ranges[iTrans] = [low + aCount, high + aCount];
      }
      // invalidate and fire selection change notice
      if (this._treeBoxObject)
        this._treeBoxObject.invalidate();
      this._fireSelectionChanged();
      return;
    }

    // If we are removing rows, we are basically clearing the range that is
    //  getting deleted and translating everyone above the remaining point
    //  downwards.  The one trick is we may have to merge the lowest translated
    //  block.
    let saveSuppress = this.selectEventsSuppressed;
    this.selectEventsSuppressed = true;
    this.clearRange(aIndex, aIndex - aCount - 1);
    // translate
    let iTrans = this._findRangeContainingRow(aIndex)[1];
    for (; iTrans < this._ranges.length; iTrans++) {
      let [low, high] = this._ranges[iTrans];
      // for the first range, low may be below the index, in which case it
      //  should not get translated
      this._ranges[iTrans] = [(low >= aIndex) ? low + aCount : low,
                              high + aCount];
    }
    // we may have to merge the lowest translated block because it may now be
    //  adjacent to the previous block
    if (iTrans > 0 && iTrans < this._ranges.length &&
        this._ranges[iTrans-1][1] == this_ranges[iTrans][0]) {
      this._ranges[iTrans-1][1] = this._ranges[iTrans][1];
      this._ranges.splice(iTrans, 1);
    }

    if (this._treeBoxObject)
      this._treeBoxObject.invalidate();
    this.selectEventsSuppressed = saveSuppress;
  },

  get selectEventsSuppressed JSTreeSelection_get_selectEventsSuppressed() {
    return this._selectEventsSuppressed;
  },
  /**
   * Control whether selection events are suppressed.  For consistency with
   *  nsTreeSelection, we always generate a selection event when a value of
   *  false is assigned, even if the value was already false.
   */
  set selectEventsSuppressed
      JSTreeSelection_set_selectEventsSuppressed(aSuppress) {
    this._selectEventsSuppressed = aSuppress;
    if (!aSuppress)
      this._fireSelectionChanged();
  },

  /**
   * Note that we bypass any XUL "onselect" handler that may exist and go
   *  straight to the view.  If you have a tree, you shouldn't be using us,
   *  so this seems aboot right.
   */
  _fireSelectionChanged: function JSTreeSelection__fireSelectionChanged() {
    // don't fire if we are suppressed; we will fire when un-suppressed
    if (this.selectEventsSuppressed)
      return;
    let view;
    if (this._treeBoxObject && this._treeBoxObject.view)
      view = this._treeBoxObject.view;
    else
      view = this._view;

    // We might not have a view if we're in the middle of setting up things
    if (view) {
      view = view.QueryInterface(Ci.nsITreeView);
      view.selectionChanged();
    }
  },

  get currentIndex JSTreeSelection_get_currentIndex() {
    if (this._currentIndex == null)
      return -1;
    return this._currentIndex;
  },
  /**
   * Sets the current index.  Other than updating the variable, this just
   *  invalidates the tree row if we have a tree.
   * The real selection object would send a DOM event we don't care about.
   */
  set currentIndex JSTreeSelection_set_currentIndex(aIndex) {
    if (aIndex == this.currentIndex)
      return;

    this._currentIndex = (aIndex != -1) ? aIndex : null;
    if (this._treeBoxObject)
      this._treeBoxObject.invalidateRow(aIndex);
  },

  currentColumn: null,

  get shiftSelectPivot JSTreeSelection_get_shiftSelectPivot() {
    return this._shiftSelectPivot != null ? this._shiftSelectPivot : -1;
  },

  QueryInterface: XPCOMUtils.generateQI(
    [Ci.nsITreeSelection]),

  /*
   * Functions after this aren't part of the nsITreeSelection interface.
   */

  /**
   * Duplicate this selection on another nsITreeSelection. This is useful
   * when you would like to discard this selection for a real tree selection.
   * We assume that both selections are for the same tree.
   *
   * @note We don't transfer the correct shiftSelectPivot over.
   * @note This will fire a selectionChanged event on the tree view.
   *
   * @param aSelection an nsITreeSelection to duplicate this selection onto
   */
  duplicateSelection: function JSTreeSelection_duplicateSelection(aSelection) {
    aSelection.selectEventsSuppressed = true;
    aSelection.clearSelection();
    for each (let [iTupe, [low, high]] in Iterator(this._ranges))
      aSelection.rangedSelect(low, high, iTupe > 0);

    aSelection.currentIndex = this.currentIndex;
    // This will fire a selectionChanged event
    aSelection.selectEventsSuppressed = false;
  },
};
