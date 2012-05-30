/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/imServices.jsm");

var addBuddy = {
  onload: function ab_onload() {
    let accountList = document.getElementById("accountlist");
    for (let acc in fixIterator(Services.accounts.getAccounts())) {
      if (!acc.connected)
        continue;
      let proto = acc.protocol;
      let item = accountList.appendItem(acc.name, acc.id, proto.name);
      item.setAttribute("image", proto.iconBaseURI + "icon.png");
      item.setAttribute("class", "menuitem-iconic");
    }
    if (!accountList.itemCount) {
      document.getElementById("addBuddyDialog").cancelDialog();
      throw "No connected account!";
    }
    accountList.selectedIndex = 0;
  },

  oninput: function ab_oninput() {
    document.documentElement.getButton("accept").disabled =
      !addBuddy.getValue("name");
  },

  getValue: function ab_getValue(aId) document.getElementById(aId).value,

  create: function ab_create() {
    let account = Services.accounts.getAccountById(this.getValue("accountlist"));
    let group = document.getElementById("chatBundle").getString("defaultGroup");
    account.addBuddy(Services.tags.createTag(group), this.getValue("name"));
  }
};
