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
 * The Original Code is the Instantbird messenging client.
 *
 * The Initial Developer of the Original Code is
 * Florian QUEZE <florian@instantbird.org>.
 * Portions created by the Initial Developer are Copyright (C) 2011
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

const EXPORTED_SYMBOLS = ["Status"];

Components.utils.import("resource:///modules/imServices.jsm");

const imIStatusInfo = Components.interfaces.imIStatusInfo;
let statusNames = {};
statusNames[imIStatusInfo.STATUS_UNKNOWN] = "unknown";
statusNames[imIStatusInfo.STATUS_OFFLINE] = "offline";
statusNames[imIStatusInfo.STATUS_INVISIBLE] = "invisible";
statusNames[imIStatusInfo.STATUS_MOBILE] = "mobile";
statusNames[imIStatusInfo.STATUS_IDLE] = "idle";
statusNames[imIStatusInfo.STATUS_AWAY] = "away";
statusNames[imIStatusInfo.STATUS_UNAVAILABLE] = "unavailable";
statusNames[imIStatusInfo.STATUS_AVAILABLE] = "available";

const Status = {
  toAttribute: function(aStatusType)
    aStatusType in statusNames ? statusNames[aStatusType] : "unknown",

  _labels: {},
  toLabel: function(aStatusType) {
    if (!(typeof aStatusType == "string"))
      aStatusType = this.toAttribute(aStatusType);

    if (!(aStatusType in this._labels)) {
      this._labels[aStatusType] =
        Services.strings.createBundle("chrome://chat/locale/status.properties")
                .GetStringFromName(aStatusType + "StatusType");
    }
    return this._labels[aStatusType];
  },
  toFlag: function(aAttribute) {
    for (let flag in statusNames)
      if (statusNames[flag] == aAttribute)
        return flag;
    return imIStatusInfo.STATUS_UNKNOWN;
  }
};
