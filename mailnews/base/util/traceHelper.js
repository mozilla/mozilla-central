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
 * Components.utils.import("resource://app/modules/traceHelper.js");
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
