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

EXPORTED_SYMBOLS = ["SuffixTree"];

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
  for (let i=0; i < aStrings.length; i++) {
    s += aStrings[i];
    offsetsToItems.push(lastSize, s.length, aItems[i]);
    lastLength = s.length;
  }
  
  this._construct(s);
}

/**
 *
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
  findMatches: function findMatches(aSubString) {
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
dump("_canonize: " + aState + " " + aStart + " " + aEnd + "\n");
    if (aEnd <= aStart) {
dump(" c-> " + aState + " " + aStart + "\n");
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
dump("  traversed to: " + statePrime + " (length: " + statePrime.length +
     " versus: " + (aEnd - aStart) + ")\n");
    while (statePrime.length <= aEnd - aStart) { // (no 1 adjustment required)
dump("  adjusting state by " + statePrime.length + "\n");
      aStart += statePrime.length;
      aState = statePrime;
      if (aStart < aEnd) {
        statePrime = aState[this._str[aStart]];
dump("  traversing2 to: " + statePrime + "\n"); 
      }
    }
dump(" c-> " + aState + " " + aStart + "\n");
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
dump("_testAndSplit: " + aState + " " + aStart + " " + aEnd + " " + aChar + "\n");
    if (aStart < aEnd) { // it's not explicit
dump("  following " + this._str[aStart] + "\n");      
      let statePrime = aState[this._str[aStart]];
      let length = aEnd - aStart;
dump("  aStart: " + aStart + " statePrime.start: " + statePrime.start + "\n");
dump("  testing " + aChar + " against " + this._str[statePrime.start + length] + "\n");
      if (aChar == this._str[statePrime.start + length]) {
dump(" t-> true, " + aState + "\n");
        return [true, aState];
      }
      else {
dump("!!!  splitting!\n");
        // do splitting... aState -> rState -> statePrime
        let rState = new State(statePrime.start, statePrime.start + length);
        aState[this._str[statePrime.start]] = rState;
        statePrime.start += length;
        rState[this._str[statePrime.start]] = statePrime;
dump(" t-> false, " + rState + "\n");
        return [false, rState];
      }
    }
    else { // it's already explicit
      if (aState === null) { // bottom case... shouldn't happen, but hey. 
dump(" t-> true, " + aState + "\n");
        return [true, aState];
      }
dump(" t-> " + (aChar in aState) + ", " + aState + "\n");
      return [(aChar in aState), aState];
    }
      
  },

  _update: function update(aState, aStart, aIndex) {
dump("_update: " + aState + " " + aStart + " " + aIndex + "\n");
    let oldR = this._root;
    let textAtIndex = this._str[aIndex]; // T sub i (0-based corrected...)
    // because of the way we store the 'stop' value as a one-past form, we do
    //  not need to subtract 1 off of aIndex.
    let [endPoint, rState] = this._testAndSplit(aState, aStart, aIndex, //no -1
                                                textAtIndex);
    while (!endPoint) {
dump("  loop...\n");
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
  
    for (let i=0; i < aStr.length; i++) {
dump("***** " + aStr[i] + "\n");    
      [state, start] = this._update(state, start, i); // treat as flowing -1...
this.dump();
      [state, start] = this._canonize(state, start, i+1); // 1-length string
this.dump();
    }
  },
  
  dump: function SuffixTree_show(aState, aIndent, aKey) {
    if (aState === undefined) {
      aState = this._root;
      aIndent = "";
      aKey = ".";
    }
    
    if (aState.isImplicit)
      dump(aIndent + aKey + ":" + this._str.slice(aState.start,
           Math.min(aState.end, this._str.length)) + "(" +
           aState.start + ":" + aState.end + ")\n");
    else
      dump(aIndent + aKey + ": (explicit:" + aState.start + ":" + aState.end +")\n");
    let nextIndent = aIndent + "  ";
    let keys = [c for (c in aState) if (c.length == 1)];
    for each (let key in keys) {
      this.dump(aState[key], nextIndent, key);
    }
  }
};

let a = new SuffixTree('missippi');
a.dump();
