/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/imServices.jsm");

const Ci = Components.interfaces;
const autoJoinPref = "autoJoin";

var joinChat = {
  onload: function jc_onload() {
    var accountList = document.getElementById("accountlist");
    for (let acc in fixIterator(Services.accounts.getAccounts())) {
      if (!acc.connected || !acc.canJoinChat)
        continue;
      var proto = acc.protocol;
      var item = accountList.appendItem(acc.name, acc.id, proto.name);
      item.setAttribute("image", proto.iconBaseURI + "icon.png");
      item.setAttribute("class", "menuitem-iconic");
      item.account = acc;
    }
    if (!accountList.itemCount) {
      document.getElementById("joinChatDialog").cancelDialog();
      throw "No connected MUC enabled account!";
    }
    accountList.selectedIndex = 0;
  },

  onAccountSelect: function jc_onAccountSelect() {
    let ab = document.getElementById("separatorRow1");
    while (ab.nextSibling && ab.nextSibling.id != "separatorRow2")
      ab.parentNode.removeChild(ab.nextSibling);

    let acc = document.getElementById("accountlist").selectedItem.account;
    let sep = document.getElementById("separatorRow2");
    let defaultValues = acc.getChatRoomDefaultFieldValues();
    joinChat._values = defaultValues;
    joinChat._fields = [];
    joinChat._account = acc;

    let protoId = acc.protocol.id;
    document.getElementById("autojoin").hidden =
      !(protoId == "prpl-irc" || protoId == "prpl-jabber" ||
      protoId == "prpl-gtalk");

    for (let field in fixIterator(acc.getChatRoomFields())) {
      let row = document.createElement("row");

      let label = document.createElement("label");
      let text = field.label;
      let match = /_(.)/.exec(text);
      if (match) {
        label.setAttribute("accesskey", match[1]);
        text = text.replace(/_/, "");
      }
      label.setAttribute("value", text);
      label.setAttribute("control", "field-" + field.identifier);
      row.appendChild(label);

      let textbox = document.createElement("textbox");
      textbox.setAttribute("id", "field-" + field.identifier);
      let val = defaultValues.getValue(field.identifier);
      if (val)
        textbox.setAttribute("value", val);
      if (field.type == Ci.prplIChatRoomField.TYPE_PASSWORD)
        textbox.setAttribute("type", "password");
      else if (field.type == Ci.prplIChatRoomField.TYPE_INT) {
        textbox.setAttribute("type", "number");
        textbox.setAttribute("min", field.min);
        textbox.setAttribute("max", field.max);
      }
      row.appendChild(textbox);

      if (!field.required) {
        label = document.createElement("label");
        text = document.getElementById("optionalcolumn")
                       .getAttribute("labeltxt");
        label.setAttribute("value", text);
        row.appendChild(label);
      }

      row.setAttribute("align", "baseline");
      sep.parentNode.insertBefore(row, sep);
      joinChat._fields.push({field: field, textbox: textbox});
    }

    window.sizeToContent();
  },

  join: function jc_join() {
    let values = joinChat._values;
    for each (let field in joinChat._fields) {
      let val = field.textbox.value;
      if (!val && field.field.required) {
        field.textbox.focus();
        //FIXME: why isn't the return false enough?
        throw "Some required fields are empty!";
        return false;
      }
      if (val)
        values.setValue(field.field.identifier, val);
    }
    let account = joinChat._account;
    account.joinChat(values);

    let protoId = account.protocol.id;
    if (protoId != "prpl-irc" && protoId != "prpl-jabber" &&
        protoId != "prpl-gtalk")
      return true;

    let name;
    if (protoId == "prpl-irc")
      name = values.getValue("channel");
    else
      name = values.getValue("room") + "@" + values.getValue("server");

/*
    let conv = Services.conversations.getConversationByNameAndAccount(name,
                                                                      account,
                                                                      true);
    if (conv)
      // TODO: select conv
*/

    if (document.getElementById("autojoin").checked) {
      if (protoId == "prpl-gtalk")
        name += "/" + values.getValue("nick");
      else if (protoId != "prpl-irc")
        name += "/" + values.getValue("handle");

      let prefBranch =
        Services.prefs.getBranch("messenger.account." + account.id + ".");
      let autojoin = [ ];
      if (prefBranch.prefHasUserValue(autoJoinPref)) {
        let prefValue = prefBranch.getCharPref(autoJoinPref);
        if (prefValue)
          autojoin = prefValue.split(",");
      }

      if (autojoin.indexOf(name) == -1) {
        autojoin.push(name);
        prefBranch.setCharPref(autoJoinPref, autojoin.join(","));
      }
    }

    return true;
  }
};
