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
 * The Original Code is SeaMonkey search panel.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Robert Kaiser <kairo@kairo.at>
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

Components.utils.import("resource://gre/modules/Services.jsm");

const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SEARCH_ENGINE_TOPIC = "browser-search-engine-modified";
var menulist, textbox;

function Startup() {
  menulist = document.getElementById("sidebar-search-engines");
  textbox = document.getElementById("sidebar-search-text");

  // Make sure the popup is empty.
  menulist.removeAllItems();

  var engines = Services.search.getVisibleEngines();
  for (let i = 0; i < engines.length; i++) {
    let name = engines[i].name;
    let menuitem = menulist.appendItem(name, name);
    menuitem.setAttribute("class", "menuitem-iconic");
    if (engines[i].iconURI)
      menuitem.setAttribute("image", engines[i].iconURI.spec);
    menulist.menupopup.appendChild(menuitem);
    menuitem.engine = engines[i];
  }
  menulist.value = Services.search.currentEngine.name;

  Services.obs.addObserver(engineObserver, SEARCH_ENGINE_TOPIC, false);
}

function Shutdown() {
  Services.obs.removeObserver(engineObserver, SEARCH_ENGINE_TOPIC, false);
}

function SelectEngine() {
  if (menulist.selectedItem)
    Services.search.currentEngine = menulist.selectedItem.engine;
}

function doSearch() {
  var textValue = textbox.value;

  var where = Services.prefs.getBoolPref("browser.search.openintab") ? "tab" : "current";

  var submission = Services.search.currentEngine.getSubmission(textValue);
  openUILinkIn(submission.uri.spec, where, null, submission.postData);
}

var engineObserver = {
  observe: function(aEngine, aTopic, aVerb) {
    if (aTopic == SEARCH_ENGINE_TOPIC) {
      if (aVerb == "engine-current")
        return;
      // Right now, always just rebuild the list after any modification.
      LoadEngineList();
    }
  }
}