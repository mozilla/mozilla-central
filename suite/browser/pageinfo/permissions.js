/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0. */

const ALLOW = Services.perms.ALLOW_ACTION;         // 1
const BLOCK = Services.perms.DENY_ACTION;          // 2
const SESSION = nsICookiePermission.ACCESS_SESSION;// 8
var gPermURI;

var gPermObj = {
  image: function getImageDefaultPermission()
  {
    if (Services.prefs.getIntPref("permissions.default.image") == 2)
      return BLOCK;
    return ALLOW;
  },
  cookie: function getCookieDefaultPermission()
  {
    if (Services.prefs.getIntPref("network.cookie.cookieBehavior") == 2)
      return BLOCK;

    if (Services.prefs.getIntPref("network.cookie.lifetimePolicy") == 2)
      return SESSION;
    return ALLOW;
  },
  "desktop-notification": function getNotificationDefaultPermission()
  {
    return BLOCK;
  },
  popup: function getPopupDefaultPermission()
  {
    if (Services.prefs.getBoolPref("dom.disable_open_during_load"))
      return BLOCK;
    return ALLOW;
  },
  install: function getInstallDefaultPermission()
  {
    try {
      if (!Services.prefs.getBoolPref("xpinstall.whitelist.required"))
        return ALLOW;
    }
    catch (e) {
    }
    return BLOCK;
  },
  geo: function getGeoDefaultPermission()
  {
    return BLOCK;
  }
};

var permissionObserver = {
  observe: function (aSubject, aTopic, aData)
  {
    if (aTopic == "perm-changed") {
      var permission = aSubject.QueryInterface(Components.interfaces.nsIPermission);
      if (/^https?/.test(gPermURI.scheme) &&
          permission.host == gPermURI.host && permission.type in gPermObj)
        initRow(permission.type);
    }
  }
};

function initPermission()
{
  onUnloadRegistry.push(onUnloadPermission);
  onResetRegistry.push(onUnloadPermission);
}

function onLoadPermission()
{
  gPermURI = gDocument.documentURIObject;
  if (/^https?/.test(gPermURI.scheme)) {
    var hostText = document.getElementById("hostText");
    hostText.value = gPermURI.host;
    Services.obs.addObserver(permissionObserver, "perm-changed", false);
  }
  for (var i in gPermObj)
    initRow(i);
}

function onUnloadPermission()
{
  if (/^https?/.test(gPermURI.scheme)) {
    Services.obs.removeObserver(permissionObserver, "perm-changed");
  }
}

function initRow(aPartId)
{
  var checkbox = document.getElementById(aPartId + "Def");
  var command  = document.getElementById("cmd_" + aPartId + "Toggle");
  if (!/^https?/.test(gPermURI.scheme)) {
    checkbox.checked = false;
    checkbox.setAttribute("disabled", "true");
    command.setAttribute("disabled", "true");
    document.getElementById(aPartId + "RadioGroup").selectedItem = null;
    return;
  }
  checkbox.removeAttribute("disabled");
  var pm = Services.perms;
  var perm = aPartId == "geo" ? pm.testExactPermission(gPermURI, aPartId) :
                                pm.testPermission(gPermURI, aPartId);
 
  if (perm) {
    checkbox.checked = false;
    command.removeAttribute("disabled");
  }
  else {
    checkbox.checked = true;
    command.setAttribute("disabled", "true");
    perm = gPermObj[aPartId]();
  }
  setRadioState(aPartId, perm);
}

function onCheckboxClick(aPartId)
{
  var command  = document.getElementById("cmd_" + aPartId + "Toggle");
  var checkbox = document.getElementById(aPartId + "Def");
  if (checkbox.checked) {
    Services.perms.remove(gPermURI.host, aPartId);
    command.setAttribute("disabled", "true");
    var perm = gPermObj[aPartId]();
    setRadioState(aPartId, perm);
  }
  else {
    onRadioClick(aPartId);
    command.removeAttribute("disabled");
  }
}

function onRadioClick(aPartId)
{
  var radioGroup = document.getElementById(aPartId + "RadioGroup");
  var id = radioGroup.selectedItem.id;
  var permission = id.replace(/.*-/, "");
  Services.perms.add(gPermURI, aPartId, permission);
}

function setRadioState(aPartId, aValue)
{
  var radio = document.getElementById(aPartId + "-" + aValue);
  radio.radioGroup.selectedItem = radio;
}
