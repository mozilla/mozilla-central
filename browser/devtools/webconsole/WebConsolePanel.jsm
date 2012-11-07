/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = [ "WebConsoleDefinition" ];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Services",
                                  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "WebConsoleUtils",
                                  "resource://gre/modules/devtools/WebConsoleUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "HUDService",
                                  "resource:///modules/HUDService.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "DevTools",
                                  "resource:///modules/devtools/gDevTools.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "EventEmitter",
                                  "resource:///modules/devtools/EventEmitter.jsm");

const STRINGS_URI = "chrome://browser/locale/devtools/webconsole.properties";
XPCOMUtils.defineLazyGetter(this, "_strings",
  function() Services.strings.createBundle(STRINGS_URI));

XPCOMUtils.defineLazyGetter(this, "osString", function() {
  return Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
});

/**
 * The external API allowing us to be registered with DevTools.jsm
 */
this.WebConsoleDefinition = {
  id: "webconsole",
  key: l10n("cmd.commandkey"),
  accesskey: l10n("webConsoleCmd.accesskey"),
  modifiers: osString == "Darwin" ? "accel,alt" : "accel,shift",
  ordinal: 0,
  icon: "chrome://browser/skin/devtools/webconsole-tool-icon.png",
  url: "chrome://browser/content/devtools/webconsole.xul",
  label: l10n("ToolboxWebconsole.label"),
  isTargetSupported: function(target) {
    return !target.isRemote && !target.isChrome;
  },
  build: function(iframeWindow, toolbox) {
    return new WebConsolePanel(iframeWindow, toolbox);
  }
};

/**
 * A DevToolPanel that controls the Web Console.
 */
function WebConsolePanel(iframeWindow, toolbox) {
  this._frameWindow = iframeWindow;
  this._toolbox = toolbox;
  new EventEmitter(this);

  let tab = this._toolbox.target.tab;
  let parentDoc = iframeWindow.document.defaultView.parent.document;
  let iframe = parentDoc.getElementById("toolbox-panel-iframe-webconsole");
  this.hud = HUDService.activateHUDForContext(tab, iframe);

  this.setReady();
}

WebConsolePanel.prototype = {
  get target() this._toolbox.target,

  get isReady() this._isReady,

  destroy: function WCP_destroy()
  {
    let tab = this._toolbox.target.tab;
    HUDService.deactivateHUDForContext(tab, false);
  },

  setReady: function WCP_setReady()
  {
    this._isReady = true;
    this.emit("ready");
  },
}

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
