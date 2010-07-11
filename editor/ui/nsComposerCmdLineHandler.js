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
 * The Original Code is Mozilla Seamonkey Composer.
 *
 * The Initial Developer of the Original Code is
 * Benjamin Smedberg <bsmedberg@covad.net>.
 * Portions created by the Initial Developer are Copyright (C) 2004
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

    var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                           .getService(nsIWindowWatcher);
    wwatch.openWindow(null, "chrome://editor/content", "_blank",
                      "chrome,dialog=no,all", args);
    cmdLine.preventDefault = true;
  },

  helpInfo : "  -edit <url>        Open Composer.\n",

  /* XPCOMUtils */
  classID: Components.ID("{f7d8db95-ab5d-4393-a796-9112fe758cfa}")
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsComposerCmdLineHandler]);
