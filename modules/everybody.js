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
 * The Original Code is Thunderbird Global Database.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2008
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

const EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gloda/modules/log4moz.js");
const LOG = Log4Moz.Service.getLogger("gloda.everybody");

var importNS = {};
var strtab = null;

function loadModule(aModuleURI, aNSContrib) {
  if (strtab === null) {
    let bundleService = Cc["@mozilla.org/intl/stringbundle;1"].
                        getService(Ci.nsIStringBundleService);
    strtab = bundleService.createBundle("chrome://gloda/locale/gloda.properties");
    LOG.debug("string bundle: " + strtab);
  }

  try {
    LOG.info("... loading " + aModuleURI);
    Cu.import(aModuleURI, importNS);
  }
  catch (ex) {
    LOG.error("!!! error loading " + aModuleURI);
    LOG.error("" + ex);
    return false;
  }
  LOG.info("+++ loaded " + aModuleURI);

  try {  
    importNS[aNSContrib].init(strtab);
  }
  catch (ex) {
    LOG.error("!!! error initializing " + aModuleURI);
    LOG.error("" + ex);
    return false;
  }
  LOG.info("+++ inited " + aModuleURI);
  return true;
}

loadModule("resource://gloda/modules/fundattr.js", "GlodaFundAttr");
loadModule("resource://gloda/modules/explattr.js", "GlodaExplicitAttr");
