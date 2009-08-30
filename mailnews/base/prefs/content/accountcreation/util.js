/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Ben Bucksch <ben.bucksch  beonex.com>
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  David Ascher <dascher@mozillamessaging.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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
 * Some common, generic functions
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

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
    throw new Exception(errorMsg);
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
  return ioService().newURI(uriStr, null, null);
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
    var chan = ioService().newChannelFromURI(uri);
    var is = Cc["@mozilla.org/intl/converter-input-stream;1"]
             .createInstance(Ci.nsIConverterInputStream);
    is.init(chan.open(), "UTF-8", 1024,
            Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

    var content = "";
    var strOut = new Object();
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
 * @return nsIIOService
 * @throws all errors to caller
 */
function ioService()
{
  if (_gIOServiceCached)
    return _gIOServiceCached;

  _gIOServiceCached = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
  return _gIOServiceCached;
}
var _gIOServiceCached;

/**
 * @param bundleURI {String}   chrome URL to properties file
 * @return nsIStringBundle
 */
function getStringBundle(bundleURI)
{
  try {
    return Cc["@mozilla.org/intl/stringbundle;1"]
           .getService(Ci.nsIStringBundleService)
           .createBundle(bundleURI);
  } catch (e) {
    throw new Exception("Failed to get stringbundle URI <" + bundleURI + ">. Error: " + e);
  }
}


function Exception(msg)
{
  this._message = msg;
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
function ddumpObject(obj, name, maxDepth, curDepth)
{
  if (curDepth == undefined)
    curDepth = 0;
  if (maxDepth != undefined && curDepth > maxDepth)
    return;

  var i = 0;
  for (prop in obj)
  {
    i++;
    try {
      if (typeof(obj[prop]) == "object")
      {
        if (obj[prop] && obj[prop].length != undefined)
          ddump(name + "." + prop + "=[probably array, length " +
                obj[prop].length + "]");
        else
          ddump(name + "." + prop + "=[" + typeof(obj[prop]) + "]");
        ddumpObject(obj[prop], name + "." + prop, maxDepth, curDepth+1);
      }
      else if (typeof(obj[prop]) == "function")
        ddump(name + "." + prop + "=[function]");
      else
        ddump(name + "." + prop + "=" + obj[prop]);
    } catch (e) {
      ddump(name + "." + prop + "-> Exception(" + e + ")");
    }
  }
  if (!i)
    ddump(name + " is empty");
}

function alertPrompt(alertTitle, alertMsg)
{
  Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Components.interfaces.nsIPromptService)
                    .alert(window, alertTitle, alertMsg);
}
