/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
