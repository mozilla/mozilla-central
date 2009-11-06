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

Cu.import("resource://app/modules/gloda/log4moz.js");
const LOG = Log4Moz.repository.getLogger("gloda.everybody");

var importNS = {};

function loadModule(aModuleURI, aNSContrib) {
  try {
    LOG.info("... loading " + aModuleURI);
    Cu.import(aModuleURI, importNS);
  }
  catch (ex) {
    LOG.error("!!! error loading " + aModuleURI);
    LOG.error("(" + ex.fileName + ":" + ex.lineNumber + ") " + ex);
    return false;
  }
  LOG.info("+++ loaded " + aModuleURI);

  if (aNSContrib) {
    try {
      importNS[aNSContrib].init();
    }
    catch (ex) {
      LOG.error("!!! error initializing " + aModuleURI);
      LOG.error("(" + ex.fileName + ":" + ex.lineNumber + ") " + ex);
      return false;
    }
    LOG.info("+++ inited " + aModuleURI);
  }
  return true;
}

loadModule("resource://app/modules/gloda/fundattr.js", "GlodaFundAttr");
loadModule("resource://app/modules/gloda/explattr.js", "GlodaExplicitAttr");

loadModule("resource://app/modules/gloda/noun_tag.js");
loadModule("resource://app/modules/gloda/noun_freetag.js");
loadModule("resource://app/modules/gloda/noun_mimetype.js");
loadModule("resource://app/modules/gloda/index_msg.js");
loadModule("resource://app/modules/gloda/index_ab.js", "GlodaABAttrs");
