/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = [
  "XPCOMUtils",
  "setTimeout",
  "clearTimeout",
  "executeSoon",
  "hasOwnProperty",
  "nsSimpleEnumerator",
  "EmptyEnumerator",
  "ClassInfo",
  "l10nHelper",
  "initLogModule"
];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/imServices.jsm");

const DEBUG_MISC = 1; // Very verbose (= 'DEBUG')
const DEBUG_INFO = 2; // Verbose (= 'LOG')
const DEBUG_WARNING = 3;
const DEBUG_ERROR = 4;

function scriptError(aModule, aLevel, aMessage) {
  // Figure out the log level, based on the module and the prefs set.
  // The module name is split on periods, and if no pref is set the pref with
  // the last section removed is attempted (until no sections are left, using
  // the global default log level).
  let logLevel = -1;
  let logKeys = ["level"].concat(aModule.split("."));
  for (; logKeys.length > 0; logKeys.pop()) {
    let logKey = logKeys.join(".");
    if (logKey in gLogLevels) {
      logLevel = gLogLevels[logKey];
      break;
    }
  }
  // Only continue if we want to see this level of logging.
  if (logLevel > aLevel)
    return;

  dump(aModule + ": " + aMessage + "\n");

  // Log a debug statement.
  if (aLevel == DEBUG_INFO && logLevel == DEBUG_INFO) {
    Services.console.logStringMessage(aMessage);
    return;
  }

  let flag = Ci.nsIScriptError.warningFlag;
  if (aLevel >= DEBUG_ERROR)
    flag = Ci.nsIScriptError.errorFlag;

  let scriptError =
    Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
  let caller = Components.stack.caller;
  let sourceLine = aModule || caller.sourceLine;
  if (caller.name) {
    if (sourceLine)
      sourceLine += ": ";
    sourceLine += caller.name;
  }
  scriptError.init(aMessage, caller.filename, sourceLine, caller.lineNumber,
                   null, flag, "component javascript");
  Services.console.logMessage(scriptError);
}
function initLogModule(aModule, aThis)
{
  let obj = aThis || {};
  obj.DEBUG = scriptError.bind(obj, aModule, DEBUG_MISC);
  obj.LOG   = scriptError.bind(obj, aModule, DEBUG_INFO);
  obj.WARN  = scriptError.bind(obj, aModule, DEBUG_WARNING);
  obj.ERROR = scriptError.bind(obj, aModule, DEBUG_ERROR);
  return obj;
}
XPCOMUtils.defineLazyGetter(Cu.getGlobalForObject({}), "gLogLevels", function() {
  // This object functions both as an obsever as well as a dict keeping the
  // log levels with prefs; the log levels all start with "level" (i.e. "level"
  // for the global level, "level.irc" for the IRC module).  The dual-purpose
  // is necessary to make sure the observe is left alive while being a weak ref
  // to avoid cycles with the pref service.
  let logLevels = {
    observe: function(aSubject, aTopic, aData) {
      let module = "level" + aData.replace(/^purple.debug.loglevel/, "");
      if (Services.prefs.getPrefType(aData) == Services.prefs.PREF_INT)
        gLogLevels[module] = Services.prefs.getIntPref(aData);
      else
        delete gLogLevels[module];
    },
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                           Ci.nsISupportsWeakReference]),
  };

  // Add weak pref observer to see log level pref changes.
  Services.prefs.addObserver("purple.debug.loglevel", logLevels, true /* weak */);

  // Initialize with existing log level prefs.
  for each (let pref in Services.prefs.getChildList("purple.debug.loglevel")) {
    if (Services.prefs.getPrefType(pref) == Services.prefs.PREF_INT)
      logLevels["level" + pref.replace(/^purple.debug.loglevel/, "")] =
        Services.prefs.getIntPref(pref);
  }

  // Let environment variables override prefs.
  Cc["@mozilla.org/process/environment;1"]
    .getService(Ci.nsIEnvironment)
    .get("PRPL_LOG")
    .split(/[;,]/)
    .filter(function(n) n != "")
    .forEach(function(env) {
      let [, module, level] = env.match(/(?:(.*?)[:=])?(\d+)/);
      logLevels["level" + (module ? "." + module : "")] = parseInt(level, 10);
    });

  return logLevels;
});

function setTimeout(aFunction, aDelay)
{
  let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  let args = Array.prototype.slice.call(arguments, 2);
  // A reference to the timer should be kept to ensure it won't be
  // GC'ed before firing the callback.
  let callback = {
    _timer: timer,
    notify: function (aTimer) { aFunction.apply(null, args); delete this._timer; }
  };
  timer.initWithCallback(callback, aDelay, Ci.nsITimer.TYPE_ONE_SHOT);
  return timer;
}
function clearTimeout(aTimer)
{
  if (aTimer)
    aTimer.cancel();
}

function executeSoon(aFunction)
{
  Services.tm.mainThread.dispatch(aFunction, Ci.nsIEventTarget.DISPATCH_NORMAL);
}

// Similar to Object.hasOwnProperty, but doesn't fail if the object
// has a hasOwnProperty property set.
function hasOwnProperty(aObject, aPropertyName)
  Object.prototype.hasOwnProperty.call(aObject, aPropertyName)

/* Common nsIClassInfo and QueryInterface implementation
 * shared by all generic objects implemented in this file. */
function ClassInfo(aInterfaces, aDescription)
{
  if (!(this instanceof ClassInfo))
    return new ClassInfo(aInterfaces, aDescription);

  if (!Array.isArray(aInterfaces))
    aInterfaces = [aInterfaces];

  for each (let i in aInterfaces)
    if (typeof i == "string" && !(i in Ci))
      Services.console.logStringMessage("ClassInfo: unknown interface " + i);

  this._interfaces =
    aInterfaces.map(function (i) typeof i == "string" ? Ci[i] : i);

  this.classDescription = aDescription || "JS Proto Object";
}
ClassInfo.prototype = {
  QueryInterface: function ClassInfo_QueryInterface(iid) {
    if (iid.equals(Ci.nsISupports) || iid.equals(Ci.nsIClassInfo) ||
        this._interfaces.some(function(i) i.equals(iid)))
      return this;

    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  getInterfaces: function(countRef) {
    let interfaces =
      [Ci.nsIClassInfo, Ci.nsISupports].concat(this._interfaces);
    countRef.value = interfaces.length;
    return interfaces;
  },
  getHelperForLanguage: function(language) null,
  contractID: null,
  classID: null,
  implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
  flags: 0
};

function l10nHelper(aChromeURL)
{
  let bundle = Services.strings.createBundle(aChromeURL);
  return function (aStringId) {
    try {
      if (arguments.length == 1)
        return bundle.GetStringFromName(aStringId);
      return bundle.formatStringFromName(aStringId,
                                         Array.prototype.slice.call(arguments, 1),
                                         arguments.length - 1);
    } catch (e) {
      Cu.reportError(e);
      dump("Failed to get " + aStringId + "\n");
      return aStringId;
    }
  };
}

/**
 * Constructs an nsISimpleEnumerator for the given array of items.
 * Copied from netwerk/test/httpserver/httpd.js
 *
 * @param items : Array
 *   the items, which must all implement nsISupports
 */
function nsSimpleEnumerator(items)
{
  this._items = items;
  this._nextIndex = 0;
}
nsSimpleEnumerator.prototype = {
  hasMoreElements: function() this._nextIndex < this._items.length,
  getNext: function() {
    if (!this.hasMoreElements())
      throw Cr.NS_ERROR_NOT_AVAILABLE;

    return this._items[this._nextIndex++];
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};

const EmptyEnumerator = {
  hasMoreElements: function() false,
  getNext: function() { throw Cr.NS_ERROR_NOT_AVAILABLE; },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator])
};
