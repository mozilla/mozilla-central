/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsISupportsString     = Components.interfaces.nsISupportsString;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;

function nsComposerCmdLineHandler() {}
nsComposerCmdLineHandler.prototype = {
  get wrappedJSObject() {
    return this;
  },

  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler]),

  /* nsICommandLineHandler */
  handle : function handle(cmdLine) {
    var args = Components.classes["@mozilla.org/supports-string;1"]
                         .createInstance(nsISupportsString);
    try {
      var uristr = cmdLine.handleFlagWithParam("edit", false);
      if (uristr == null) {
        // Try the editor flag (used for general.startup.* prefs)
        uristr = cmdLine.handleFlagWithParam("editor", false);
        if (uristr == null)
          return;
      }

      try {
        args.data = cmdLine.resolveURI(uristr).spec;
      }
      catch (e) {
        return;
      }
    }
    catch (e) {
      // One of the flags is present but no data, so set default arg.
      args.data = "about:blank";
    }

    Services.ww.openWindow(null, "chrome://editor/content", "_blank",
                           "chrome,dialog=no,all", args);
    cmdLine.preventDefault = true;
  },

  helpInfo : "  -edit <url>        Open Composer.\n",

  /* XPCOMUtils */
  classID: Components.ID("{f7d8db95-ab5d-4393-a796-9112fe758cfa}")
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsComposerCmdLineHandler]);
