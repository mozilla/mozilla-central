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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
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

const EXPORTED_SYMBOLS = ["SuffixTree", "MultiSuffixTree"];

/**
 * Given a list of strings and a corresponding map of items that those strings
 *  correspond to, build a suffix tree.
 */
function MultiSuffixTree(aStrings, aItems) {
  if (aStrings.length != aItems.length)
    throw Error("Array lengths need to be the same.");

  let s = '';
  let offsetsToItems = [];
  let lastLength = 0;
  for (let i = 0; i < aStrings.length; i++) {
    s += aStrings[i];
    offsetsToItems.push(lastLength, s.length, aItems[i]);
    lastLength = s.length;
  }
  
  this._construct(s);
  this._offsetsToItems = offsetsToItems;
  this._numItems = aItems.length;
}

/**
 * @constructor
 */
function State(aStartIndex, aEndIndex, aSuffix) {
  this.start = aStartIndex;
  this.end = aEndIndex;
  this.suffix = aSuffix;
}

var dump;
if (dump === undefined) {
  dump = function(a) {
    print(a.slice(0, -1));
  };
}

/**
 * Since objects are basically hash-tables anyways, we simply create an
 *  attribute whose name is the first letter of the edge string.  (So, the
 *  edge string can conceptually be a multi-letter string, but since we would
 *  split it were there any ambiguity, it's okay to just use the single letter.)
 *  This avoids having to update the attribute name or worry about tripping our
 *  implementation up.
 */
State.prototype = {
  get isExplicit() {
    // our end is not inclusive...
    return (this.end <= this.start);
  },
  get isImplicit() {
    // our end is not inclusive...
    return (this.end > this.start);
  },
  
  get length() {
    return this.end - this.start;
  },
  
  toString: function State_toString() {
    return "[Start: " + this.start + " End: " + this.end +
           (this.suffix ? " non-null suffix]" : " null suffix]"); 
  }
};

/**
 * Suffix tree implemented using Ukkonen's algorithm.
 * @constructor
 */
function SuffixTree(aStr) {
  this._construct(aStr);
}

/**
 * States are 
 */
SuffixTree.prototype = {
  /**
   * Find all items matching the provided substring.
   */
  findMatches: function findMatches(aSubstring) {
    let results = [];
    let state = this._root;
    let index=0;
    let end = aSubstring.length;
    while(index < end) {
      state = state[aSubstring[index]];
      // bail if there was no edge
      if (state === undefined)
        return results;
      // bail if the portion of the edge we traversed is not equal to that
      //  portion of our pattern
      let actualTraverseLength = Math.min(state.length,
                                          end - index);
      if (this._str.substring(state.start,
                              state.start + actualTraverseLength) !=
          aSubstring.substring(index, index + actualTraverseLength))
        return results;
      index += state.length;
    }
    
    // state should now be the node which itself and all its children match...
    // The delta is to adjust us to the offset of the last letter of our match;
    //  the edge we traversed to get here may have found us traversing more
    //  than we wanted.
    // index - end captures the over-shoot of the edge traversal,
    // index - end + 1 captures the fact that we want to find the last letter
    //  that matched, not just the first letter beyond it
    // However, if this state is a leaf node (end == 'infinity'), then 'end'
    //  isn't describing an edge at all and we want to avoid accounting for it.
    let delta;
    /*
    if (state.end != this._infinity)
      //delta = index - end + 1;
      delta = end - (index - state.length); 
    else */
    delta = index - state.length - end + 1;
 
    this._resultGather(state, results, {}, end, delta, true);
    return results;
  },
  
  _resultGather: function resultGather(aState, aResults, aPresence,
                                       aPatLength, aDelta, alreadyAdjusted) {
    // find the item that this state originated from based on the state's
    //  start character.  offsetToItem holds [string start index, string end
    //  index (exclusive), item reference].  So we want to binary search to
    //  find the string whose start/end index contains the state's start index.
    let low = 0;
    let high = this._numItems-1;
    let mid, stringStart, stringEnd;
    
    let patternLast = aState.start - aDelta;
    while (low <= high) {
      mid = low + Math.floor((high - low) / 2); // excessive, especially with js nums
      stringStart = this._offsetsToItems[mid*3];
      let startDelta = stringStart - patternLast;
      stringEnd = this._offsetsToItems[mid*3+1];
      let endDelta = stringEnd - patternLast;
      if (startDelta > 0)
        high = mid - 1;
      else if (endDelta <= 0)
        low = mid + 1;
      else {
        break;
      }
    }
    
    // - The match occurred completely inside a source string.  Success.
    // - The match spans more than one source strings, and is therefore not
    //   a match.
    
    // at this point, we have located the origin string that corresponds to the
    //  start index of this state.
    // - The match terminated with the end of the preceding string, and does
    //   not match us at all.  We, and potentially our children, are merely
    //   serving as a unique terminal.
    // - The 

  let patternFirst = patternLast - (aPatLength - 1);

  if (patternFirst >= stringStart) {
    if (!(stringStart in aPresence)) {
      aPresence[stringStart] = true;
      aResults.push(this._offsetsToItems[mid*3+2]);
    }
  }
    
    // bail if we had it coming OR
    // if the result terminates at/part-way through this state, meaning any
    //  of its children are not going to be actual results, just hangers
    //  on.
/*
    if (bail || (end <= aState.end)) {
dump("  bailing! (bail was: " + bail + ")\n");
      return;
    }
*/    
    // process our children...
    for (let key in aState) {
      // edges have attributes of length 1...
      if (key.length == 1) {
        let statePrime = aState[key];
        this._resultGather(statePrime, aResults, aPresence, aPatLength,
                           aDelta + aState.length, //(alreadyAdjusted ? 0 : aState.length),
                           false);
      }
    }
  },

  /**
   * Given a reference 'pair' of a state and a string (may be 'empty'=explicit,
   *  which means no work to do and we return immediately) follow that state
   *  (and then the successive states)'s transitions until we run out of
   *  transitions.  This happens either when we find an explicit state, or 
   *  find ourselves partially along an edge (conceptually speaking).  In
   *  the partial case, we return the state prior to the edge traversal.
   * (The information about the 'edge' is contained on its target State;
   *  we can do this because a state is only referenced by one other state.) 
   */
  _canonize: function canonize(aState, aStart, aEnd) {
    if (aEnd <= aStart) {
      return [aState, aStart];
    }
  
    let statePrime;
    // we treat an aState of null as 'bottom', which has transitions for every
    //  letter in the alphabet to 'root'.  rather than create all those
    //  transitions, we special-case here.
    if (aState === null)
      statePrime = this._root;
    else
      statePrime = aState[this._str[aStart]];
    while (statePrime.length <= aEnd - aStart) { // (no 1 adjustment required)
      aStart += statePrime.length;
      aState = statePrime;
      if (aStart < aEnd) {
        statePrime = aState[this._str[aStart]];
      }
    }
    return [aState, aStart]; 
  },

  /**
   * Given a reference 'pair' whose state may or may not be explicit (and for
   *  which we will perform the required splitting to make it explicit), test
   *  whether it already possesses a transition corresponding to the provided
   *  character.
   * @return A list of: whether we had to make it explicit, the (potentially)
   *    new explicit state.
   */
  _testAndSplit: function testAndSplit(aState, aStart, aEnd, aChar) {
    if (aStart < aEnd) { // it's not explicit
      let statePrime = aState[this._str[aStart]];
      let length = aEnd - aStart;
      if (aChar == this._str[statePrime.start + length]) {
        return [true, aState];
      }
      else {
        // do splitting... aState -> rState -> statePrime
        let rState = new State(statePrime.start, statePrime.start + length);
        aState[this._str[statePrime.start]] = rState;
        statePrime.start += length;
        rState[this._str[statePrime.start]] = statePrime;
        return [false, rState];
      }
    }
    else { // it's already explicit
      if (aState === null) { // bottom case... shouldn't happen, but hey. 
        return [true, aState];
      }
      return [(aChar in aState), aState];
    }
      
  },

  _update: function update(aState, aStart, aIndex) {
    let oldR = this._root;
    let textAtIndex = this._str[aIndex]; // T sub i (0-based corrected...)
    // because of the way we store the 'end' value as a one-past form, we do
    //  not need to subtract 1 off of aIndex.
    let [endPoint, rState] = this._testAndSplit(aState, aStart, aIndex, //no -1
                                                textAtIndex);
    while (!endPoint) {
      let rPrime = new State(aIndex, this._infinity);
      rState[textAtIndex] = rPrime;
      if (oldR !== this._root)
        oldR.suffix = rState;
      oldR = rState;
      [aState, aStart] = this._canonize(aState.suffix, aStart, aIndex); // no -1
      [endPoint, rState] = this._testAndSplit(aState, aStart, aIndex, // no -1
                                              textAtIndex);
    }
    if (oldR !== this._root)
      oldR.suffix = aState;
    
    return [aState, aStart];
  },
  
  _construct: function construct(aStr) {
    this._str = aStr;
    // just needs to be longer than the string.
    this._infinity = aStr.length + 1;
    
    //this._bottom = new State(0, -1, null);
    this._root = new State(-1, 0, null); // null === bottom
    let state = this._root;
    let start = 0;
  
    for (let i = 0; i < aStr.length; i++) {
      [state, start] = this._update(state, start, i); // treat as flowing -1...
      [state, start] = this._canonize(state, start, i+1); // 1-length string
    }
  },
  
  dump: function SuffixTree_show(aState, aIndent, aKey) {
    if (aState === undefined)
      aState = this._root;
    if (aIndent === undefined) {
      aIndent = "";
      aKey = ".";
    }
    
    if (aState.isImplicit) {
      let snip;
      if (aState.length > 10)
        snip = this._str.slice(aState.start,
                           Math.min(aState.start+10, this._str.length)) + "...";
      else
        snip =  this._str.slice(aState.start,
                                Math.min(aState.end, this._str.length)); 
      dump(aIndent + aKey + ":" + snip + "(" +
           aState.start + ":" + aState.end + ")\n");
    }
    else
      dump(aIndent + aKey + ": (explicit:" + aState.start + ":" + aState.end +")\n");
    let nextIndent = aIndent + "  ";
    let keys = [c for (c in aState) if (c.length == 1)];
    for each (let [iKey, key] in Iterator(keys)) {
      this.dump(aState[key], nextIndent, key);
    }
  }
};
MultiSuffixTree.prototype = SuffixTree.prototype;

function examplar() {
  let names = ["AndrewSmith", "AndrewJones", "MarkSmith", "BryanClark",
               "MarthaJones", "DavidAscher", "DanMosedale", "DavidBienvenu",
               "JanetDavis", "JosephBryant"];
  let b = new MultiSuffixTree(names, names);
  b.dump();
  dump(b.findMatches("rya") + "\n");
}
