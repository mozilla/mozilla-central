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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is
 *   Sun Microsystems, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Daniel Boelzle <daniel.boelzle@sun.com>
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

// New code must not load/import calUtils.js, but should use calUtils.jsm.

var EXPORTED_SYMBOLS = ["cal"];
let cal = {
    // new code should land here,
    // and more code should be moved from calUtils.js into this object to avoid
    // clashes with other extensions

    getIOService: generateServiceAccessor("@mozilla.org/network/io-service;1",
                                          Components.interfaces.nsIIOService2),

    /**
     * Checks whether a timezone lacks a definition.
     */
    isPhantomTimezone: function cal_isPhantomTimezone(tz) {
        return (!tz.icalComponent && !tz.isUTC && !tz.isFloating);
    }
};

// local to this module;
// will be used to generate service accessor functions, getIOService()
function generateServiceAccessor(id, iface) {
    return function this_() {
        if (this_.mService === undefined) {
            this_.mService = Components.classes[id].getService(iface);
        }
        return this_.mService;
    };
}

// Interim import of all symbols into cal:
// This should serve as a clean start for new code, e.g. new code could use
// cal.createDatetime instead of plain createDatetime NOW.
let calUtils = __LOCATION__.parent.parent.clone();
calUtils.append("js");
calUtils.append("calUtils.js");
Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
          .getService(Components.interfaces.mozIJSSubScriptLoader)
          .loadSubScript(cal.getIOService().newFileURI(calUtils).spec, cal);

