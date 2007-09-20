/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Olivier Parniere BT Global Services / Etat francais Ministere de la Defense
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/* components defined in this file */
const DSN_EXTENSION_SERVICE_CONTRACTID =
    "@mozilla.org/accountmanager/extension;1?name=dsn";
const DSN_EXTENSION_SERVICE_CID =
    Components.ID("{849dab91-9bc9-4508-a0ee-c2453e7c092d}");

/* interfaces used in this file */
const nsIMsgAccountManagerExtension  = Components.interfaces.nsIMsgAccountManagerExtension;
const nsICategoryManager = Components.interfaces.nsICategoryManager;
const nsISupports = Components.interfaces.nsISupports;

function DSNService()
{}

DSNService.prototype.name = "dsn";
DSNService.prototype.chromePackageName = "messenger";
DSNService.prototype.showPanel =
function (server)
{
  // don't show the panel for news accounts
  return (server.type != "nntp");
}

/* factory for command line handler service (DSNService) */
var DSNFactory = new Object();

DSNFactory.createInstance =
function (outer, iid) {
  if (outer != null)
    throw Components.results.NS_ERROR_NO_AGGREGATION;

  if (!iid.equals(nsIMsgAccountManagerExtension) && !iid.equals(nsISupports))
    throw Components.results.NS_ERROR_INVALID_ARG;

  return new DSNService();
}

var DSNModule = new Object();

DSNModule.registerSelf =
function (compMgr, fileSpec, location, type)
{
  debug("*** Registering dsn account manager extension.\n");
  compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
  compMgr.registerFactoryLocation(DSN_EXTENSION_SERVICE_CID,
                                  "DSN Account Manager Extension Service",
                                  DSN_EXTENSION_SERVICE_CONTRACTID,
                                  fileSpec,
                                  location,
                                  type);
  catman = Components.classes["@mozilla.org/categorymanager;1"].getService(nsICategoryManager);
  catman.addCategoryEntry("mailnews-accountmanager-extensions",
                          "dsn account manager extension",
                          DSN_EXTENSION_SERVICE_CONTRACTID, true, true);
}

DSNModule.unregisterSelf =
function(compMgr, fileSpec, location)
{
  compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
  compMgr.unregisterFactoryLocation(DSN_EXTENSION_SERVICE_CID, fileSpec);
  catman = Components.classes["@mozilla.org/categorymanager;1"].getService(nsICategoryManager);
  catman.deleteCategoryEntry("mailnews-accountmanager-extensions",
                             DSN_EXTENSION_SERVICE_CONTRACTID, true);
}

DSNModule.getClassObject =
function (compMgr, cid, iid) {
  if (cid.equals(DSN_EXTENSION_SERVICE_CID))
    return DSNFactory;

  if (!iid.equals(Components.interfaces.nsIFactory))
    throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

  throw Components.results.NS_ERROR_NO_INTERFACE;
}

DSNModule.canUnload =
function(compMgr)
{
  return true;
}

/* entrypoint */
function NSGetModule(compMgr, fileSpec) {
  return DSNModule;
}
