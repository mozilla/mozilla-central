/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * This component handles the startup command line arguments of the form:
 *   -setDefaultBrowser
 *   -setDefaultMail
 *   -setDefaultNews
 *   -setDefaultFeed
 */

const nsIShellService = Components.interfaces.nsIShellService;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsSetDefault() {
}

nsSetDefault.prototype = {
  handle: function nsSetDefault_handle(aCmdline) {
    if (aCmdline.handleFlag("setDefaultBrowser", false)) {
      var shell = Components.classes["@mozilla.org/suite/shell-service;1"]
                            .getService(nsIShellService);
      shell.setDefaultClient(true, true, nsIShellService.BROWSER);
    }
    else if (aCmdline.handleFlag("setDefaultMail", false)) {
      var shell = Components.classes["@mozilla.org/suite/shell-service;1"]
                            .getService(nsIShellService);
      shell.setDefaultClient(true, true, nsIShellService.MAIL);
    }
    else if (aCmdline.handleFlag("setDefaultNews", false)) {
      var shell = Components.classes["@mozilla.org/suite/shell-service;1"]
                            .getService(nsIShellService);
      shell.setDefaultClient(true, true, nsIShellService.NEWS);
    }
    else if (aCmdline.handleFlag("setDefaultFeed", false)) {
      var shell = Components.classes["@mozilla.org/suite/shell-service;1"]
                            .getService(nsIShellService);
      shell.setDefaultClient(true, true, nsIShellService.RSS);
    }
  },

  helpInfo: "  -setDefaultBrowser Set this app as the default browser client.\n" +
            "  -setDefaultMail    Set this app as the default mail client.\n" +
            "  -setDefaultNews    Set this app as the default newsreader.\n" +
            "  -setDefaultFeed    Set this app as the default feedreader.\n",

  classID: Components.ID("{a3d5b950-690a-491f-a881-2c2cdcd241cb}"),
  QueryInterface: XPCOMUtils.generateQI([nsICommandLineHandler])
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsSetDefault]);

