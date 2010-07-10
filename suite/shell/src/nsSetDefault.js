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
 * The Original Code is Mozilla Default mail
 *
 * The Initial Developer of the Original Code is
 *     Scott MacGregor <mscott@mozilla.org>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.demon.co.uk>
 *   Frank Wein  <mcsmurf@mcsmurf.de>
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

