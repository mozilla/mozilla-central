/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const nsIPermissionManager = Components.interfaces.nsIPermissionManager;
const nsICookiePermission = Components.interfaces.nsICookiePermission;

var permissionManager;

var additions = [];
var removals = [];

var sortColumn;
var sortAscending;

var permissionsTreeView = {
    rowCount: 0,
    setTree: function(tree) {},
    getImageSrc: function(row, column) {},
    getProgressMode: function(row, column) {},
    getCellValue: function(row, column) {},
    getCellText: function(row, column) {
      if (column.id == "siteCol")
        return additions[row].rawHost;
      else if (column.id == "statusCol")
        return additions[row].capability;
      return "";
    },
    isSeparator: function(index) { return false; },
    isSorted: function() { return false; },
    isContainer: function(index) { return false; },
    cycleHeader: function(column) {},
    getRowProperties: function(row, column) { return ""; },
    getColumnProperties: function(column) { return ""; },
    getCellProperties: function(row, column) { return ""; }
  };

var permissionsTree;
var permissionType = "popup";
var gManageCapability;

var permissionsBundle;

function Startup() {
  var introText, windowTitle;

  permissionManager = Components.classes["@mozilla.org/permissionmanager;1"]
                                .getService(nsIPermissionManager);

  permissionsTree = document.getElementById("permissionsTree");

  permissionsBundle = document.getElementById("permissionsBundle");

  sortAscending = (permissionsTree.getAttribute("sortAscending") == "true");
  sortColumn = permissionsTree.getAttribute("sortColumn");

  if (window.arguments && window.arguments[0]) {
    var params = window.arguments[0];
    document.getElementById("btnBlock").hidden = !params.blockVisible;
    document.getElementById("btnSession").hidden = !params.sessionVisible;
    document.getElementById("btnAllow").hidden = !params.allowVisible;
    setHost(params.prefilledHost);
    permissionType = params.permissionType;
    gManageCapability = params.manageCapability;
    introText = params.introText;
    windowTitle = params.windowTitle;
  }

  document.getElementById("permissionsText").textContent = introText ||
      permissionsBundle.getString(permissionType + "permissionstext");

  document.title = windowTitle ||
      permissionsBundle.getString(permissionType + "permissionstitle");

  var dialogElement = document.getElementById("permissionsManager");
  dialogElement.setAttribute("windowtype", "permissions-" + permissionType);

  var urlFieldVisible = params.blockVisible ||
                        params.sessionVisible ||
                        params.allowVisible;

  document.getElementById("url").hidden = !urlFieldVisible;
  document.getElementById("urlLabel").hidden = !urlFieldVisible;

  handleHostInput(document.getElementById("url"));
  loadPermissions();
}

function onAccept() {
  finalizeChanges();

  permissionsTree.setAttribute("sortAscending", !sortAscending);
  permissionsTree.setAttribute("sortColumn", sortColumn);

  return true;
}

function setHost(aHost) {
  document.getElementById("url").value = aHost;
}

function Permission(id, host, rawHost, type, capability, perm) {
  this.id = id;
  this.host = host;
  this.rawHost = rawHost;
  this.type = type;
  this.capability = capability;
  this.perm = perm;
}

function handleHostInput(aSiteField) {
  // trim any leading and trailing spaces and scheme
  // and set buttons appropiately
  btnDisable(!trimSpacesAndScheme(aSiteField.value));
}

function trimSpacesAndScheme(aString) {
  if (!aString)
    return "";
  return aString.trim().replace(/([-\w]*:\/+)?/, "");
}

function btnDisable(aDisabled) {
  document.getElementById("btnSession").disabled = aDisabled;
  document.getElementById("btnBlock").disabled = aDisabled;
  document.getElementById("btnAllow").disabled = aDisabled;
}

function loadPermissions() {
  var enumerator = permissionManager.enumerator;
  var count = 0;
  var permission;

  try {
    while (enumerator.hasMoreElements()) {
      permission = enumerator.getNext().QueryInterface(Components.interfaces.nsIPermission);
      if (permission.type == permissionType &&
          (!gManageCapability || permission.capability == gManageCapability))
        permissionPush(count++, permission.host, permission.type,
                       capabilityString(permission.capability), permission.capability);
    }
  } catch(ex) {
  }

  permissionsTreeView.rowCount = additions.length;

  // sort and display the table
  permissionsTree.treeBoxObject.view = permissionsTreeView;
  permissionColumnSort(sortColumn, false);

  // disable "remove all" button if there are none
  document.getElementById("removeAllPermissions").disabled = additions.length == 0;
}

function capabilityString(aCapability) {
  var capability = null;
  switch (aCapability) {
    case nsIPermissionManager.ALLOW_ACTION:
      capability = "can";
      break;
    case nsIPermissionManager.DENY_ACTION:
      capability = "cannot";
      break;
    // we should only ever hit this for cookies
    case nsICookiePermission.ACCESS_SESSION:
      capability = "canSession";
      break;
    default:
      break;
  } 
  return permissionsBundle.getString(capability);
}

function permissionPush(aId, aHost, aType, aString, aCapability) {
  var rawHost = (aHost.charAt(0) == ".") ? aHost.substring(1, aHost.length) : aHost;
  var p = new Permission(aId, aHost, rawHost, aType, aString, aCapability);
  additions.push(p);
}

function permissionColumnSort(aColumn, aUpdateSelection) {
  sortAscending = 
    SortTree(permissionsTree, permissionsTreeView, additions,
             aColumn, sortColumn, sortAscending, aUpdateSelection);
  sortColumn = aColumn;
}

function permissionSelected() {
  if (permissionManager) {
    var selections = GetTreeSelections(permissionsTree);
    document.getElementById("removePermission").disabled = (selections.length < 1);
  }
}

function deletePermissions() {
  DeleteSelectedItemFromTree(permissionsTree, permissionsTreeView, additions, removals,
                             "removePermission", "removeAllPermissions");
}

function deleteAllPermissions() {
  DeleteAllFromTree(permissionsTree, permissionsTreeView, additions, removals,
                    "removePermission", "removeAllPermissions");
}

function finalizeChanges() {
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
  var i, p;

  for (i in removals) {
    p = removals[i];
    try {
      permissionManager.remove(p.host, p.type);
    } catch(ex) {
    }
  }

  for (i in additions) {
    p = additions[i];
    try {
      var uri = ioService.newURI("http://" + p.host, null, null);
      permissionManager.add(uri, p.type, p.perm);
    } catch(ex) {
    }
  }
}

function handlePermissionKeyPress(e) {
  if (e.keyCode == 46) {
    deletePermissions();
  }
}

function addPermission(aPermission) {
  var textbox = document.getElementById("url");
  // trim any leading and trailing spaces and scheme
  var host = trimSpacesAndScheme(textbox.value);
  try {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    var uri = ioService.newURI("http://" + host, null, null);
    host = uri.host;
  } catch(ex) {
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                  .getService(Components.interfaces.nsIPromptService);
    var message = permissionsBundle.getFormattedString("alertInvalid", [host]);
    var title = permissionsBundle.getString("alertInvalidTitle");
    promptService.alert(window, title, message);
    textbox.value = "";
    textbox.focus();
    handleHostInput(textbox);
    return;
  }

  // we need this whether the perm exists or not
  var stringCapability = capabilityString(aPermission);

  // check whether the permission already exists, if not, add it
  var exists = false;
  for (var i in additions) {
    if (additions[i].rawHost == host) {
      // Avoid calling the permission manager if the capability settings are
      // the same. Otherwise allow the call to the permissions manager to
      // update the listbox for us.
      exists = additions[i].perm == aPermission;
      break;
    }
  }

  if (!exists) {
    permissionPush(additions.length, host, permissionType, stringCapability, aPermission);

    permissionsTreeView.rowCount = additions.length;
    permissionsTree.treeBoxObject.rowCountChanged(additions.length - 1, 1);
    permissionsTree.treeBoxObject.ensureRowIsVisible(additions.length - 1);
  }
  textbox.value = "";
  textbox.focus();

  // covers a case where the site exists already, so the buttons don't disable
  handleHostInput(textbox);

  // enable "remove all" button as needed
  document.getElementById("removeAllPermissions").disabled = additions.length == 0;
}

function doHelpButton() {
  openHelp(permissionsBundle.getString(permissionType + "permissionshelp"), "chrome://communicator/locale/help/suitehelp.rdf");
  return true;
}
