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
 * The Original Code is the Instantbird messenging client, released
 * 2007.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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
