/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const EXPORTED_SYMBOLS = ['DebugTraceHelper'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var SPACES = "                                                   ";
var BRIGHT_COLORS = {
  red: "\x1b[1;31m",
  green: "\x1b[1;32m",
  yellow: "\x1b[1;33m",
  blue: "\x1b[1;34m",
  magenta: "\x1b[1;35m",
  cyan: "\x1b[1;36m",
  white: "\x1b[1;37m",
};
var DARK_COLORS = {
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[0;33m",
  blue: "\x1b[0;34m",
  magenta: "\x1b[0;35m",
  cyan: "\x1b[0;36m",
  white: "\x1b[0;37m",
};
var STOP_COLORS = "\x1b[0m";


/**
 * Example usages:
 *
 * Components.utils.import("resource:///modules/traceHelper.js");
 * var debugContext = {color: "cyan"};
 * DebugTraceHelper.tracify(FolderDisplayWidget.prototype,
 *                          "FolderDisplayWidget", /.+/, debugContext);
 * DebugTraceHelper.tracify(MessageDisplayWidget.prototype,
 *                          "MessageDisplayWidget", /.+/, debugContext);
 * DebugTraceHelper.tracify(StandaloneFolderDisplayWidget.prototype,
 *                          "StandaloneFolderDisplayWidget", /.+/, debugContext);
 * DebugTraceHelper.tracify(StandaloneMessageDisplayWidget.prototype,
 *                          "StandaloneMessageDisplayWidget", /.+/, debugContext);
 * DebugTraceHelper.tracify(DBViewWrapper.prototype,
 *                          "DBViewWrapper", /.+/, {color: "green"});
 * DebugTraceHelper.tracify(JSTreeSelection.prototype,
 *                          "JSTreeSelection", /.+/, {color: "yellow"});
 */
var DebugTraceHelper = {
  tracify: function(aObj, aDesc, aPat, aContext, aSettings) {
    aContext.depth = 0;
    let color = aSettings.color || "cyan";
    aSettings.introCode = BRIGHT_COLORS[color];
    aSettings.outroCode = DARK_COLORS[color];
    for each (let key in Iterator(aObj, true)) {
      if (aPat.test(key)) {
        // ignore properties!
        if (aObj.__lookupGetter__(key) || aObj.__lookupSetter__(key))
          continue;
        // ignore non-functions!
        if (typeof(aObj[key]) != "function")
          continue;
        let name = key;
        let prev = aObj[name];
        aObj[name] = function() {
          let argstr = "";
          for (let i = 0; i < arguments.length; i++) {
            let arg = arguments[i];
            if (arg == null)
              argstr += " null";
            else if (typeof(arg) == "function")
              argstr += " function "+ arg.name;
            else
              argstr += " " + arguments[i].toString();
          }

          let indent = SPACES.substr(0, aContext.depth++ * 2);
          dump(indent + "--> " + aSettings.introCode + aDesc + "::" + name +
               ":" + argstr +
               STOP_COLORS + "\n");
          let ret;
          try {
            ret = prev.apply(this, arguments);
          }
          catch (ex) {
            if (ex.stack) {
              dump(BRIGHT_COLORS.red + "Exception: " + ex + "\n  " +
                   ex.stack.replace("\n", "\n  ") + STOP_COLORS + "\n");
            }
            else {
              dump(BRIGHT_COLORS.red + "Exception: " + ex.fileName + ":" +
                   ex.lineNumber + ": " + ex + STOP_COLORS + "\n");
            }
            aContext.depth--;
            dump(indent + "<-- " + aSettings.outroCode + aDesc + "::" + name +
                 STOP_COLORS + "\n");
            throw ex;
          }
          aContext.depth--;
          dump(indent + "<-- " + aSettings.outroCode + aDesc + "::" + name +
               ": " + (ret != null ? ret.toString() : "null") +
               STOP_COLORS + "\n");
          return ret;
        };
      }
    }
  }
};
