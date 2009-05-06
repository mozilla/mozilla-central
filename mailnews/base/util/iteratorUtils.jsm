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
 * The Original Code is mail iterator code.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
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

/**
 * This file contains helper methods for dealing with XPCOM iterators (arrays
 * and enumerators) in js-friendly ways.
 */

var EXPORTED_SYMBOLS = ["fixIterator", "toXPCOMArray"];

let Ci = Components.interfaces;

/**
 * Given a JS array, JS iterator, or one of a variety of XPCOM collections or
 * iterators, return a JS iterator suitable for use in a for...in expression.
 *
 * Currently, we support the following types of xpcom iterators:
 *   nsISupportsArray
 *   nsIEnumerator
 *   nsISimpleEnumerator
 *
 *   @param aEnum  the enumerator to convert
 *   @param aIface (optional) an interface to QI each object to prior to
 *                 returning
 *
 *   @note This does *not* return an Array object.  It returns an object that
 *         can be used in for...in contexts only.  To create such an array, use
 *         var array = [a for each (a in fixIterator(xpcomEnumerator))];
 */
function fixIterator(aEnum, aIface) {
  // is it a javascript array?  We can't do instanceof because we, as a module,
  //  get our own copy of Array, which is guaranteed distinct from our caller's
  //  Array instance.  So we test for .length
  if (aEnum.length) {
    if (!aIface)
      return (o for ([, o] in Iterator(aEnum)));
    else
      return (o.QueryInterface(aIface) for ([,o] in Iterator(aEnum)));
  }

  // is it a javascript Iterator?  same deal on instanceof
  if (aEnum.next) {
    if (!aIface)
      return aEnum;
    else
      return (o.QueryInterface(aIface) for (o in aEnum));
  }

  let face = aIface || Ci.nsISupports;
  // Figure out which kind of iterator we have
  if (aEnum instanceof Ci.nsISupportsArray) {
    let iter = function() {
      let count = aEnum.Count();
      for (let i = 0; i < count; i++)
        yield aEnum.QueryElementAt(i, face);
    }
    return { __iterator__: iter };
  }
  
  // Now try nsIEnumerator
  if (aEnum instanceof Ci.nsIEnumerator) {
    let done = false;
    let iter = function() {
      while (!done) {
        try {
          yield aEnum.currentItem().QueryInterface(face);
          aEnum.next();
        } catch(ex) {
          done = true;
        }
      }
    };
    return { __iterator__: iter };
  }
  
  // how about nsISimpleEnumerator? this one is nice and simple
  if (aEnum instanceof Ci.nsISimpleEnumerator) {
    let iter = function () {
      while (aEnum.hasMoreElements())
        yield aEnum.getNext().QueryInterface(face);
    }
    return { __iterator__: iter };
  }
}

/**
 * This function takes a javascript Array object and returns an xpcom array
 * of the desired type. It will *not* work if you extend Array.prototype.
 *
 * @param aArray      the array to convert to an xpcom array
 * @param aInterface  the type of xpcom array to convert
 *
 * @note The returned array is *not* dynamically updated.  Changes made to the
 *       js array after a call to this function will not be reflected in the
 *       xpcom array.
 */
function toXPCOMArray(aArray, aInterface) {
  if (aInterface.equals(Ci.nsISupportsArray)) {
    let supportsArray = Components.classes["@mozilla.org/supports-array;1"]
                                  .createInstance(Ci.nsISupportsArray);
    for each (let item in aArray) {
      supportsArray.AppendElement(item);
    }
    return supportsArray;
  }
  if (aInterface.equals(Ci.nsIMutableArray)) {
    let mutableArray = Components.classes["@mozilla.org/array;1"]
                                 .createInstance(Ci.nsIMutableArray);
    for each (let item in aArray) {
      mutableArray.appendElement(item, false);
    }
    return mutableArray;
  }

  throw "no supports for interface conversion";
}
