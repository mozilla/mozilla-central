/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains helper methods for dealing with XPCOM iterators (arrays
 * and enumerators) in JS-friendly ways.
 */

const EXPORTED_SYMBOLS = ["fixIterator", "toXPCOMArray", "toArray"];

Components.utils.import("resource://gre/modules/Deprecated.jsm");

const Ci = Components.interfaces;

/**
 * This function will take a number of objects and convert them to an array.
 *
 * Currently, we support the following objects:
 *   NodeList     (i.e element.childNodes)
 *   Iterator     (i.e toArray(fixIterator(enum))[4])
 *
 * @param aObj        The object to convert
 * @param aUseKeys    If true, an array of keys will be returned instead of the
 *                      values
 */
function toArray(aObj, aUseKeys) {
  // - The Iterator object seems to be per-scope, so use a string-based check.
  //   We use contains because the constructor toString returns a function dump,
  //   which we don't actually care about.
  // - Not all iterators are instances of Iterator, so additionally use a
  //   duck-typing test.
  let constructor = aObj.constructor.toString();
  if (constructor.contains("Iterator")) {
    if (aUseKeys) {
      return [ a for (a in aObj) ];
    } else {
      return [ a for (a of aObj) ];
    }
  } else if ("__iterator__" in aObj) {
    // aUseKeys doesn't make sense in this case, always return the values.
    return [ a for (a in aObj) ];
  } else if (constructor.contains("NodeList")) {
    // aUseKeys doesn't make sense in this case, always return the values.
    return Array.slice(aObj);
  }

  return null;
}

/**
 * Given a JS array, JS iterator, or one of a variety of XPCOM collections or
 * iterators, return a JS iterator suitable for use in a for...in expression.
 *
 * Currently, we support the following types of XPCOM iterators:
 *   nsIArray
 *   nsISupportsArray
 *   nsISimpleEnumerator
 *
 *   This intentionally does not support nsIEnumerator as it is obsolete and
 *   no longer used in the base code.
 *
 *   @param aEnum  the enumerator to convert
 *   @param aIface (optional) an interface to QI each object to prior to
 *                 returning
 *
 *   @note This returns an object that can be used in 'for...in' loops only.
 *         Do not use 'for each...in' or 'for...of'.
 *         This does *not* return an Array object. To create such an array, use
 *         let array = toArray(fixIterator(xpcomEnumerator));
 */
function fixIterator(aEnum, aIface) {
  if (Array.isArray(aEnum)) {
    if (!aIface)
      return (o for ([, o] in Iterator(aEnum)));
    else
      return (o.QueryInterface(aIface) for ([, o] in Iterator(aEnum)));
  }

  // Is it a javascript Iterator? Same deal on instanceof.
  if (aEnum.next) {
    if (!aIface)
      return aEnum;
    else
      return (o.QueryInterface(aIface) for (o in aEnum));
  }

  let face = aIface || Ci.nsISupports;
  // Figure out which kind of array object we have.
  // First try nsIArray (covers nsIMutableArray too).
  if (aEnum instanceof Ci.nsIArray) {
    let iter = function() {
      let count = aEnum.length;
      for (let i = 0; i < count; i++)
        yield aEnum.queryElementAt(i, face);
    }
    return { __iterator__: iter };
  }

  // Try an nsISupportsArray.
  // This object is deprecated, but we need to keep supporting it
  // while anything in the base code (including mozilla-central) produces it.
  if (aEnum instanceof Ci.nsISupportsArray) {
    let iter = function() {
      let count = aEnum.Count();
      for (let i = 0; i < count; i++)
        yield aEnum.QueryElementAt(i, face);
    }
    return { __iterator__: iter };
  }

  // How about nsISimpleEnumerator? This one is nice and simple.
  if (aEnum instanceof Ci.nsISimpleEnumerator) {
    let iter = function () {
      while (aEnum.hasMoreElements())
        yield aEnum.getNext().QueryInterface(face);
    }
    return { __iterator__: iter };
  }

  return null;
}

/**
 * This function takes an Array object and returns an XPCOM array
 * of the desired type. It will *not* work if you extend Array.prototype.
 *
 * @param aArray      the array (anything fixIterator supports) to convert to an XPCOM array
 * @param aInterface  the type of XPCOM array to convert
 *
 * @note The returned array is *not* dynamically updated.  Changes made to the
 *       JS array after a call to this function will not be reflected in the
 *       XPCOM array.
 */
function toXPCOMArray(aArray, aInterface) {
  if (aInterface.equals(Ci.nsISupportsArray)) {
    Deprecated.warning("nsISupportsArray object is deprecated, avoid creating new ones.",
                       "https://developer.mozilla.org/en-US/docs/XPCOM_array_guide");
    let supportsArray = Components.classes["@mozilla.org/supports-array;1"]
                                  .createInstance(Ci.nsISupportsArray);
    for (let item in fixIterator(aArray)) {
      supportsArray.AppendElement(item);
    }
    return supportsArray;
  }
  if (aInterface.equals(Ci.nsIMutableArray)) {
    let mutableArray = Components.classes["@mozilla.org/array;1"]
                                 .createInstance(Ci.nsIMutableArray);
    for (let item in fixIterator(aArray)) {
      mutableArray.appendElement(item, false);
    }
    return mutableArray;
  }

  throw "no supports for interface conversion";
}
