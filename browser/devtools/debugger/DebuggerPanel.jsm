/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ft=javascript ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

this.EXPORTED_SYMBOLS = ["DebuggerDefinition"];

const STRINGS_URI = "chrome://browser/locale/devtools/debugger.properties";

Cu.import("resource://gre/modules/devtools/EventEmitter.jsm");
Cu.import("resource://gre/modules/devtools/dbg-server.jsm");
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import("resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "gDevTools",
                                  "resource:///modules/devtools/gDevTools.jsm");
XPCOMUtils.defineLazyGetter(this, "_strings",
  function() Services.strings.createBundle(STRINGS_URI));

XPCOMUtils.defineLazyGetter(this, "osString", function() {
  return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
});

this.DebuggerDefinition = {
  id: "jsdebugger",
  key: l10n("open.commandkey"),
  accesskey: l10n("debuggerMenu.accesskey"),
  modifiers: osString == "Darwin" ? "accel,alt" : "accel,shift",
  ordinal: 1,
  killswitch: "devtools.debugger.enabled",
  icon: "chrome://browser/skin/devtools/tools-icons-small.png",
  url: "chrome://browser/content/debugger.xul",
  label: l10n("ToolboxDebugger.label"),

  isTargetSupported: function(target) {
    return !target.isRemote;
  },

  build: function(iframeWindow, toolbox) {
    return new DebuggerPanel(iframeWindow, toolbox);
  }
};


function DebuggerPanel(iframeWindow, toolbox) {
  this._toolbox = toolbox;
  this._controller = iframeWindow.DebuggerController;
  this._bkp = this._controller.Breakpoints;

  let onDebuggerLoaded = function () {
    iframeWindow.removeEventListener("Debugger:Loaded", onDebuggerLoaded, true);
    this.setReady();
  }.bind(this);

  let onDebuggerConnected = function () {
    iframeWindow.removeEventListener("Debugger:Connected",
      onDebuggerConnected, true);
    this.emit("connected");
  }.bind(this);

  iframeWindow.addEventListener("Debugger:Loaded", onDebuggerLoaded, true);
  iframeWindow.addEventListener("Debugger:Connected",
    onDebuggerConnected, true);

  new EventEmitter(this);

  this._ensureOnlyOneRunningDebugger();
  if (!DebuggerServer.initialized) {
    // Always allow connections from nsIPipe transports.
    DebuggerServer.init(function() true);
    DebuggerServer.addBrowserActors();
  }
}

DebuggerPanel.prototype = {
  // DevToolPanel API
  get target() {
    return this._toolbox.target;
  },

  get isReady() this._isReady,

  setReady: function() {
    this._isReady = true;
    this.emit("ready");
  },

  destroy: function() {
  },

  // DebuggerPanel API

  addBreakpoint: function() {
    this._bkp.addBreakpoint.apply(this._bkp, arguments);
  },

  removeBreakpoint: function() {
    this._bkp.removeBreakpoint.apply(this._bkp, arguments);
  },

  getBreakpoint: function() {
    this._bkp.getBreakpoint.apply(this._bkp, arguments);
  },

  getAllBreakpoints: function() {
    return this._bkp.store;
  },

  // Private

  _ensureOnlyOneRunningDebugger: function() {
    // FIXME
  },
};

/**
 * Lookup l10n string from a string bundle.
 * @param {string} aName The key to lookup.
 * @returns A localized version of the given key.
 */
function l10n(aName)
{
  try {
    return _strings.GetStringFromName(aName);
  } catch (ex) {
    Services.console.logStringMessage("Error reading '" + aName + "'");
    throw new Error("l10n error with " + aName);
  }
}
