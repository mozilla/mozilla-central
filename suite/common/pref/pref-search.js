/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

function Startup() {
  var menulist = document.getElementById("engineList");
  var engines = Services.search.getVisibleEngines();
  for (let i = 0; i < engines.length; i++) {
    let name = engines[i].name;
    let menuitem = menulist.appendItem(name, name);
    menuitem.setAttribute("class", "menuitem-iconic");
    if (engines[i].iconURI)
      menuitem.setAttribute("image", engines[i].iconURI.spec);
    menuitem.engine = engines[i];
  }
}
