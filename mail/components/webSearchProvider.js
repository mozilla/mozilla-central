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
 * The Original Code is Mozilla Thunderbird.
 *
 * The Initial Developer of the Original Code is Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

const NS_APP_SEARCH_DIR_LIST = "SrchPluginsDL";
const NS_APP_USER_SEARCH_DIR = "UsrSrchPlugns";
const NS_APP_SEARCH_DIR = "SrchPlugns";
const NS_XPCOM_CURRENT_PROCESS_DIR = "XCurProcD";
const XRE_EXTENSIONS_DIR_LIST = "XREExtDL";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function AppendingEnumerator(base, append) {
  this.base = base;
  this.append = append;
  this.next = null;

  this.getNext();
}

AppendingEnumerator.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator]),

  hasMoreElements: function() {
    return this.next != null;
  },

  getNext: function() {
    let res = this.next;
    let next = null;

    while (this.base.hasMoreElements() && !next) {
      let file = this.base.getNext().QueryInterface(Ci.nsIFile);
      file.append(this.append);
      if (file.exists())
        next = file;
    }

    this.next = next;
    return res;
  },
};

function UnionEnumerator(first, second) {
  this.first = first;
  this.second = second;
}

UnionEnumerator.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator]),

  hasMoreElements: function() {
    return this.first.hasMoreElements() ||
           this.second.hasMoreElements();
  },

  getNext: function() {
    if (this.first.hasMoreElements())
      return this.first.getNext();
    else
      return this.second.getNext();
  },
};

function WebSearchProvider() {}
WebSearchProvider.prototype = {
  classDescription: "Web Search Provider",
  classID: Components.ID("{76a80bff-8c3f-4b78-ad2c-80099e35375d}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDirectoryServiceProvider,
                                         Ci.nsIDirectoryServiceProvider2]),

  getFile: function() {
    return null;
  },

  getFiles: function(prop) {
    if (prop != NS_APP_SEARCH_DIR_LIST)
      return null;

    /**
     * We want to preserve the following order, since the search service loads
     * engines in first-loaded-wins order.
     *   - extension search plugin locations (prepended below using
     *     UnionEnumerator)
     *   - distro search plugin locations
     *   - user search plugin locations (profile)
     *   - app search plugin location (shipped engines)
     */
    let baseFiles = Cc["@mozilla.org/array;1"]
                      .createInstance(Ci.nsIMutableArray);

    this.appendDistroSearchDirs(baseFiles);
    this.appendFileKey(NS_APP_USER_SEARCH_DIR, baseFiles);
    this.appendFileKey(NS_APP_SEARCH_DIR, baseFiles);

    let baseEnum = baseFiles.enumerate();

    let list = Services.dirsvc.get(XRE_EXTENSIONS_DIR_LIST,
                                   Ci.nsISimpleEnumerator);
    let extEnum = new AppendingEnumerator(list, "searchplugins");
    return new UnionEnumerator(extEnum, baseEnum);
  },

  appendDistroSearchDirs: function(array) {
    try {
      let searchPlugins = Services.dirsvc.get(NS_XPCOM_CURRENT_PROCESS_DIR,
                                              Ci.nsIFile);
      searchPlugins.append("distribution");
      searchPlugins.append("searchplugins");

      if (!searchPlugins.exists())
        return;

      let commonPlugins = searchPlugins.clone();
      commonPlugins.append("common");
      if (commonPlugins.exists())
        array.appendElement(commonPlugins, false);

      let localePlugins = searchPlugins.clone();
      localePlugins.append("locale");

      let locale = Services.prefs.getCharPref("general.useragent.locale");
      let curLocalePlugins = localePlugins.clone();
      curLocalePlugins.append(locale);
      if (curLocalePlugins.exists()) {
        array.appendElement(curLocalePlugins, false);
        return;
      }

      let defLocale = Services.prefs.getCharPref(
        "distribution.searchplugins.defaultLocale");
      let defLocalePlugins = localePlugins.clone();
      defLocalePlugins.append(defLocale);
      if (defLocalePlugins.exists())
        array.appendElement(defLocalePlugins, false);
    }
    catch(e) {}
  },

  appendFileKey: function(key, array) {
    try {
      let file = Services.dirsvc.get(key, Ci.nsIFile);
      if (file.exists())
        array.appendElement(file, false);
    }
    catch(e) {}
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([WebSearchProvider]);
