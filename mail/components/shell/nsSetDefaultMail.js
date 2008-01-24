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
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joey Minta <jminta@gmail.com>
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

  helpInfo : "  -setDefaultMail   Set this app as the default mail client.\n",

  // XPCOMUtils info
  _xpcom_categories: [{category: "command-line-handler",
                       entry: "m-setdefaultmail"}],
  classDescription: "Default Mail Cmdline Handler",
  contractID: "@mozilla.org/mail/default-mail-clh;1",
  classID: Components.ID("{ED117D0A-F6C2-47d8-8A71-0E15BABD2554}"),
};

// NSGetModule: Return the nsIModule object.
function NSGetModule(compMgr, fileSpec) {
  return XPCOMUtils.generateModule([nsSetDefaultMail]);
}
