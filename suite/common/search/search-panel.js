/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SEARCH_ENGINE_TOPIC = "browser-search-engine-modified";
var menulist, textbox;

function Startup() {
  menulist = document.getElementById("sidebar-search-engines");
  textbox = document.getElementById("sidebar-search-text");

  LoadEngineList();
  Services.obs.addObserver(engineObserver, SEARCH_ENGINE_TOPIC, false);
}

function LoadEngineList() {
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
