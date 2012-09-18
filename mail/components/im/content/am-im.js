/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const autoJoinPref = "autoJoin";

function onPreInit(aAccount, aAccountValue)
{
  account.init(aAccount.incomingServer.wrappedJSObject.imAccount);
}

var account = {
  init: function account_init(aAccount) {
    this.account = aAccount;
    this.proto = this.account.protocol;
    document.getElementById("accountName").value = this.account.name;
    document.getElementById("protocolName").value = this.proto.name || this.proto.id;
    document.getElementById("protocolIcon").src =
      this.proto.iconBaseURI + "icon48.png";

    let password = document.getElementById("server.password");
    let passwordBox = document.getElementById("passwordBox");
    if (this.proto.noPassword) {
      passwordBox.hidden = true;
      password.removeAttribute("wsm_persist");
    }
    else {
      passwordBox.hidden = false;
      try {
        // Should we force layout here to ensure password.value works?
        // Will throw if we don't have a protocol plugin for the account.
        password.value = this.account.password;
        password.setAttribute("wsm_persist", "true");
      } catch (e) {
        passwordBox.hidden = true;
        password.removeAttribute("wsm_persist");
      }
    }

    document.getElementById("server.alias").value = this.account.alias;

    let protoId = this.proto.id;
    let canAutoJoin =
      protoId == "prpl-irc" || protoId == "prpl-jabber" || protoId == "prpl-gtalk";
    document.getElementById("optionalSeparator").hidden = !canAutoJoin;
    document.getElementById("autojoinBox").hidden = !canAutoJoin;
    let autojoin = document.getElementById("server.autojoin");
    if (canAutoJoin)
      autojoin.setAttribute("wsm_persist", "true");
    else
      autojoin.removeAttribute("wsm_persist");

    this.prefs = Services.prefs.getBranch("messenger.account." +
                                          this.account.id + ".options.");
    this.populateProtoSpecificBox();
  },

  createTextbox: function account_createTextbox(aType, aLabel, aName) {
    var box = document.createElement("vbox");

    var label = document.createElement("label");
    label.setAttribute("value", aLabel);
    label.setAttribute("control", aName);
    box.appendChild(label);

    var textbox = document.createElement("textbox");
    if (aType)
      textbox.setAttribute("type", aType);
    textbox.setAttribute("preftype", aType == "number" ? "int" : "wstring");
    textbox.setAttribute("id", aName);
    textbox.setAttribute("wsm_persist", "true");
    textbox.setAttribute("genericattr", "true");

    box.appendChild(textbox);
    return box;
  },

  createMenulist: function account_createMenulist(aList, aLabel, aName) {
    var box = document.createElement("vbox");

    var label = document.createElement("label");
    label.setAttribute("value", aLabel);
    label.setAttribute("control", aName);
    box.appendChild(label);

    aList.QueryInterface(Ci.nsISimpleEnumerator);
    var menulist = document.createElement("menulist");
    menulist.setAttribute("id", aName);
    menulist.setAttribute("wsm_persist", "true");
    menulist.setAttribute("preftype", "wstring");
    menulist.setAttribute("genericattr", "true");
    var popup = menulist.appendChild(document.createElement("menupopup"));
    while (aList.hasMoreElements()) {
      let elt = aList.getNext();
      let item = document.createElement("menuitem");
      item.setAttribute("label", elt.name);
      item.setAttribute("value", elt.value);
      popup.appendChild(item);
    }
    box.appendChild(menulist);
    return box;
  },

  populateProtoSpecificBox: function account_populate() {
    var gbox = document.getElementById("protoSpecific");
    let child;
    while ((child = gbox.firstChild))
      gbox.removeChild(child);

    let options = this.proto.getOptions();
    while (options.hasMoreElements()) {
      let opt = options.getNext();
      var text = opt.label;
      var name = "server." + opt.name;
      switch (opt.type) {
      case opt.typeBool:
        var chk = document.createElement("checkbox");
        chk.setAttribute("label", text);
        chk.setAttribute("id", name);
        chk.setAttribute("wsm_persist", "true");
        chk.setAttribute("preftype", "bool");
        chk.setAttribute("genericattr", "true");

        gbox.appendChild(chk);
        break;
      case opt.typeInt:
        gbox.appendChild(this.createTextbox("number", text, name));
        break;
      case opt.typeString:
        gbox.appendChild(this.createTextbox(null, text, name));
        break;
      case opt.typeList:
        gbox.appendChild(this.createMenulist(opt.getList(), text, name));
        break;
      default:
        throw "unknown preference type " + opt.type;
      }
    }

    let advanced = document.getElementById("advanced");
    if (advanced.hidden && gbox.firstChild) {
      advanced.hidden = false;
      // Force textbox XBL binding attachment by forcing layout,
      // otherwise setFormElementValue from AccountManager.js sets
      // properties that don't exist when restoring values.
      gbox.getBoundingClientRect();
    }
    else if (!gbox.firstChild)
      advanced.hidden = true;
  }
};
