/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/**
 * Some common, generic functions
 */

try {
  var Cc = Components.classes;
  var Ci = Components.interfaces;
} catch (e) { ddump(e); } // if already declared, as in xpcshell-tests
try {
  var Cu = Components.utils;
} catch (e) { ddump(e); }

Cu.import("resource:///modules/errUtils.js");
Cu.import("resource://gre/modules/Services.jsm");

/**
 * Create a subtype
 */
function extend(child, supertype)
{
  child.prototype.__proto__ = supertype.prototype;
}

function assert(test, errorMsg)
{
  if (!test)
    throw new NotReached(errorMsg ? errorMsg :
          "Programming bug. Assertion failed, see log.");
}

function makeCallback(obj, func)
{
  return function()
  {
    return func.apply(obj, arguments);
  }
}


/**
 * Runs the given function sometime later
 *
 * Currently implemented using setTimeout(), but
 * can later be replaced with an nsITimer impl,
 * when code wants to use it in a module.
 */
function runAsync(func)
{
  setTimeout(func, 0);
}


/**
 * @param uriStr {String}
 * @result {nsIURI}
 */
function makeNSIURI(uriStr)
{
  return Services.io.newURI(uriStr, null, null);
}


/**
 * Reads UTF8 data from a URL.
 *
 * @param uri {nsIURI}   what you want to read
 * @return {Array of String}   the contents of the file, one string per line
 */
function readURLasUTF8(uri)
{
  assert(uri instanceof Ci.nsIURI, "uri must be an nsIURI");
  try {
    let chan = Services.io.newChannelFromURI(uri);
    let is = Cc["@mozilla.org/intl/converter-input-stream;1"]
             .createInstance(Ci.nsIConverterInputStream);
    is.init(chan.open(), "UTF-8", 1024,
            Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

    let content = "";
    let strOut = new Object();
    try {
      while (is.readString(1024, strOut) != 0)
        content += strOut.value;
    // catch in outer try/catch
    } finally {
      is.close();
    }

    return content;
  } catch (e) {
    // TODO this has a numeric error message. We need to ship translations
    // into human language.
    throw e;
  }
}

/**
 * Takes a string (which is typically the content of a file,
 * e.g. the result returned from readURLUTF8() ), and splits
 * it into lines, and returns an array with one string per line
 *
 * Linebreaks are not contained in the result,,
 * and all of \r\n, (Windows) \r (Mac) and \n (Unix) counts as linebreak.
 *
 * @param content {String} one long string with the whole file
 * @return {Array of String} one string per line (no linebreaks)
 */
function splitLines(content)
{
  content = content.replace("\r\n", "\n");
  content = content.replace("\r", "\n");
  return content.split("\n");
}

/**
 * @param bundleURI {String}   chrome URL to properties file
 * @return nsIStringBundle
 */
function getStringBundle(bundleURI)
{
  try {
    return Services.strings.createBundle(bundleURI);
  } catch (e) {
    throw new Exception("Failed to get stringbundle URI <" + bundleURI +
                        ">. Error: " + e);
  }
}


function Exception(msg)
{
  this._message = msg;

  // get stack
  try {
    not.found.here += 1; // force a native exception ...
  } catch (e) {
    this.stack = e.stack; // ... to get the current stack
  }
}
Exception.prototype =
{
  get message()
  {
    return this._message;
  },
  toString : function()
  {
    return this._message;
  }
}

function NotReached(msg)
{
  Exception.call(this, msg);
  logException(this);
}
extend(NotReached, Exception);


/**
 * A handle for an async function which you can cancel.
 * The async function will return an object of this type (a subtype)
 * and you can call cancel() when you feel like killing the function.
 */
function Abortable()
{
}
Abortable.prototype =
{
  cancel : function()
  {
  }
}

/**
 * Utility implementation, for allowing to abort a setTimeout.
 * Use like: return new TimeoutAbortable(setTimeout(function(){ ... }, 0));
 * @param setTimeoutID {Integer}  Return value of setTimeout()
 */
function TimeoutAbortable(setTimeoutID)
{
  this._id = setTimeoutID;
}
TimeoutAbortable.prototype =
{
  cancel : function()
  {
    clearTimeout(this._id);
  }
}
extend(TimeoutAbortable, Abortable);

/**
 * Utility implementation, for allowing to abort a setTimeout.
 * Use like: return new TimeoutAbortable(setTimeout(function(){ ... }, 0));
 * @param setIntervalID {Integer}  Return value of setInterval()
 */
function IntervalAbortable(setIntervalID)
{
  this._id = setIntervalID;
}
IntervalAbortable.prototype =
{
  cancel : function()
  {
    clearInterval(this._id);
  }
}
extend(IntervalAbortable, Abortable);


// Allows you to make several network calls, but return
// only one Abortable object.
function SuccessiveAbortable()
{
  this._current = null;
}
SuccessiveAbortable.prototype =
{
  set current(abortable)
  {
    assert(abortable instanceof Abortable || abortable == null,
        "need an Abortable object (or null)");
    this._current = abortable;
  },
  get current()
  {
    return this._current;
  },
  cancel : function()
  {
    if (this._current)
      this._current.cancel();
  },
}
extend(SuccessiveAbortable, Abortable);


function deepCopy(org)
{
  if (typeof(org) == "undefined")
    return undefined;
  if (org == null)
    return null;
  if (typeof(org) == "string")
    return org;
  if (typeof(org) == "number")
    return org;
  if (typeof(org) == "boolean")
    return org == true;
  if (typeof(org) == "function")
    return org;
  if (typeof(org) != "object")
    throw "can't copy objects of type " + typeof(org) + " yet";

  //TODO still instanceof org != instanceof copy
  //var result = new org.constructor();
  var result = new Object();
  if (typeof(org.length) != "undefined")
    var result = new Array();
  for (var prop in org)
    result[prop] = deepCopy(org[prop]);
  return result;
}

let kDebug = false;
function ddump(text)
{
  if (kDebug)
    dump(text + "\n");
}

function debugObject(obj, name, maxDepth, curDepth)
{
  if (curDepth == undefined)
    curDepth = 0;
  if (maxDepth != undefined && curDepth > maxDepth)
    return "";

  var result = "";
  var i = 0;
  for (let prop in obj)
  {
    i++;
    try {
      if (typeof(obj[prop]) == "object")
      {
        if (obj[prop] && obj[prop].length != undefined)
          result += name + "." + prop + "=[probably array, length " +
                obj[prop].length + "]\n";
        else
          result += name + "." + prop + "=[" + typeof(obj[prop]) + "]\n";
        result += debugObject(obj[prop], name + "." + prop,
                              maxDepth, curDepth + 1);
      }
      else if (typeof(obj[prop]) == "function")
        result += name + "." + prop + "=[function]\n";
      else
        result += name + "." + prop + "=" + obj[prop] + "\n";
    } catch (e) {
      result += name + "." + prop + "-> Exception(" + e + ")\n";
    }
  }
  if (!i)
    result += name + " is empty\n";
  return result;
}

function alertPrompt(alertTitle, alertMsg)
{
  Services.prompt.alert(window, alertTitle, alertMsg);
}
