/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


/* This file implements the nsICommandLineHandler interface.
 *
 * This component handles the startup command line argument of the form:
 *   -setDefaultMail
 * by making the current executable the "default mail app."
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsSetDefaultMail() {
}

nsSetDefaultMail.prototype = {
  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),

  /* nsICommandLineHandler */
  handle : function nsSetDefault_handle(cmdline) {
    if (cmdline.handleFlag("setDefaultMail", false)) {
      var shell = Cc["@mozilla.org/mail/shell-service;1"].
                  getService(Ci.nsIShellService);
      shell.setDefaultClient(true, Ci.nsIShellService.MAIL);
    }
  },

  helpInfo : "  -setDefaultMail    Set this app as the default mail client.\n",
  classID: Components.ID("{ED117D0A-F6C2-47d8-8A71-0E15BABD2554}")
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsSetDefaultMail]);
