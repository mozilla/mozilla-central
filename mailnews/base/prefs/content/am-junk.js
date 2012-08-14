/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
Components.utils.import("resource:///modules/mailServices.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

const KEY_ISP_DIRECTORY_LIST = "ISPDL";
var gPrefBranch = null;
let gDeferredToAccount = "";

function onInit(aPageId, aServerId)
{
  const kMoveFolderJunk = 0;
  const kMoveFolderOther = 1;

  // manually adjust several pref UI elements
  document.getElementById('server.spamLevel.visible').setAttribute("checked",
    document.getElementById('server.spamLevel').value > 0);

  let deferredToURI = null;
  if (gDeferredToAccount)
    deferredToURI = MailServices.accounts
                                .getAccount(gDeferredToAccount)
                                .incomingServer.serverURI;

  let spamActionTargetAccountElement =
    document.getElementById("server.spamActionTargetAccount");
  let spamActionTargetFolderElement =
    document.getElementById("server.spamActionTargetFolder");

  let spamActionTargetAccount = spamActionTargetAccountElement.value;
  let spamActionTargetFolder = spamActionTargetFolderElement.value;

  // check if folder targets are valid
  spamActionTargetAccount = checkJunkTargetFolder(spamActionTargetAccount, true);
  spamActionTargetFolder = checkJunkTargetFolder(spamActionTargetFolder, false);

  let moveCheckbox = document.getElementById("server.moveOnSpam");
  let moveTargetModeValue = document.getElementById("server.moveTargetMode").value;

  if (!spamActionTargetAccount) {
    // spamActionTargetAccount is not valid,
    // reset to default behavior to NOT move junk messages...
    if (moveTargetModeValue == kMoveFolderJunk)
      moveCheckbox.setAttribute("checked", false);

    // ... and find a good default target.
    spamActionTargetAccount = chooseJunkTargetFolder(deferredToURI || aServerId, true);
    spamActionTargetAccountElement.value = spamActionTargetAccount;
  }

  if (!spamActionTargetFolder) {
    // spamActionTargetFolder is not valid,
    // reset to default behavior to NOT move junk messages...
    if (moveTargetModeValue == kMoveFolderOther)
      moveCheckbox.setAttribute("checked", false);

    // ... and find a good default target.
    spamActionTargetFolder = chooseJunkTargetFolder(deferredToURI || aServerId, false);
    spamActionTargetFolderElement.value = spamActionTargetFolder;
  }

  let server = GetMsgFolderFromUri(spamActionTargetAccount, false);
  document.getElementById("actionTargetAccount")
          .setAttribute("label", prettyFolderName(server));
  document.getElementById("actionAccountPopup").selectFolder(server);

  let folder = null;
  try {
    folder = GetMsgFolderFromUri(spamActionTargetFolder, true);
    document.getElementById("actionFolderPopup").selectFolder(folder);
  } catch (e) {
    // OK for folder to not exist.
    folder = GetMsgFolderFromUri(spamActionTargetFolder, false);
  }
  document.getElementById("actionTargetFolder")
          .setAttribute("label", prettyFolderName(folder));

  var currentArray = [];
  if (document.getElementById("server.useWhiteList").checked)
    currentArray = document.getElementById("server.whiteListAbURI").value.split(" ");

  // set up the whitelist UI
  var wList = document.getElementById("whiteListAbURI");

  // Ensure the whitelist is empty
  while (wList.lastChild)
    wList.removeChild(wList.lastChild);

  // Populate the listbox with address books
  let abItems = [];
  for (let ab in fixIterator(MailServices.ab.directories,
                             Components.interfaces.nsIAbDirectory)) {
    // We skip mailing lists and remote address books.
    if (ab.isMailList || ab.isRemote)
      continue;

    let abItem = document.createElement("listitem");
    abItem.setAttribute("type", "checkbox");
    abItem.setAttribute("class", "listitem-iconic");
    abItem.setAttribute("label", ab.dirName);
    abItem.setAttribute("value", ab.URI);

    // Due to bug 448582, we have to use setAttribute to set the
    // checked value of the listitem.
    abItem.setAttribute("checked", (currentArray.indexOf(ab.URI) != -1));

    abItems.push(abItem);
  }

  // Sort the list
  function sortFunc(a, b) {
    return a.getAttribute("label").toLowerCase()
           > b.getAttribute("label").toLowerCase();
  }

  abItems.sort(sortFunc);

  // And then append each item to the listbox
  for (let i = 0; i < abItems.length; i++)
    wList.appendChild(abItems[i]);

  // enable or disable the whitelist
  onAdaptiveJunkToggle();

  // set up trusted IP headers
  var serverFilterList = document.getElementById("useServerFilterList");
  serverFilterList.value =
    document.getElementById("server.serverFilterName").value;
  if (!serverFilterList.selectedItem)
    serverFilterList.selectedIndex = 0;

  // enable or disable the useServerFilter checkbox
  onCheckItem("useServerFilterList", ["server.useServerFilter"]);

  updateMoveTargetMode(document.getElementById('server.moveOnSpam').checked);
}

function onPreInit(account, accountValues)
{
  gPrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService)
                          .getBranch("mail.server." +
                                      account.incomingServer.key + ".");

  if (getAccountValue(account, accountValues, "server", "type", null, false) == "pop3")
    gDeferredToAccount = getAccountValue(account, accountValues,
                                         "pop3", "deferredToAccount",
                                         null, false);

  buildServerFilterMenuList();
}

function updateMoveTargetMode(aEnable)
{
  if (aEnable)
    document.getElementById("broadcaster_moveMode").removeAttribute("disabled");
  else
    document.getElementById("broadcaster_moveMode").setAttribute("disabled", "true");

  updatePurgeSpam(aEnable, "purgeSpam");
  updatePurgeSpam(aEnable, "purgeSpamInterval");
}

function updatePurgeSpam(aEnable, aPref)
{
  if (!aEnable || gPrefBranch.prefIsLocked(aPref))
    document.getElementById("server." + aPref).setAttribute("disabled", "true");
  else
    document.getElementById("server." + aPref).removeAttribute("disabled");
}

/**
 * Called when someone checks or unchecks the adaptive junk mail checkbox.
 * set the value of the hidden element accordingly
 *
 * @param  the boolean value of the checkbox
 */
function updateSpamLevel(aValue)
{
  document.getElementById('server.spamLevel').value = aValue ? 100 : 0;
  onAdaptiveJunkToggle();
}

/**
 * Propagate changes to the server filter menu list back to
 * our hidden wsm element.
 */
function onServerFilterListChange()
{
  document.getElementById('server.serverFilterName').value =
    document.getElementById("useServerFilterList").value;
}

/**
 * Called when someone checks or unchecks the adaptive junk mail checkbox.
 * We need to enable or disable the whitelist accordingly
 *
 * @param aValue  the boolean value of the checkbox
 */
function onAdaptiveJunkToggle()
{
  onCheckItem("whiteListAbURI", ["server.spamLevel.visible"]);
  onCheckItem("whiteListLabel", ["server.spamLevel.visible"]);

  // Enable/disable individual listbox rows.
  // Setting enable/disable on the parent listbox does not seem to work.
  let wList = document.getElementById("whiteListAbURI");
  let wListDisabled = wList.disabled;

  for (let i = 0; i < wList.getRowCount(); i++)
    wList.getItemAtIndex(i).disabled = wListDisabled;
}

function onSave()
{
  onSaveWhiteList();
}

/**
 * Propagate changes to the whitelist menu list back to
 * our hidden wsm element.
 */
function onSaveWhiteList()
{
  var wList = document.getElementById("whiteListAbURI");
  var wlArray = [];

  for (var i = 0; i < wList.getRowCount(); i++)
  {
    var wlNode = wList.getItemAtIndex(i);
    if (wlNode.checked) {
      let abURI = wlNode.getAttribute("value");
      wlArray.push(abURI);
    }
  }
  var wlValue = wlArray.join(" ");
  document.getElementById("server.whiteListAbURI").setAttribute("value", wlValue);
  document.getElementById("server.useWhiteList").checked = (wlValue != "");
}

function onActionTargetChange(aEvent, aWSMElementId)
{
  var folder = aEvent.target._folder;
  document.getElementById(aWSMElementId).value = folder.URI;
  aEvent.currentTarget.setAttribute("label", prettyFolderName(folder));
}

function buildServerFilterMenuList()
{
  var fileLocator = Components.classes["@mozilla.org/file/directory_service;1"]
                              .getService(Components.interfaces.nsIProperties);
  // Now walk through the isp directories looking for sfd files
  var ispDirectories = fileLocator.get(KEY_ISP_DIRECTORY_LIST, Components.interfaces.nsISimpleEnumerator);
  while (ispDirectories.hasMoreElements()) 
  {
    var ispDirectory = ispDirectories.getNext().QueryInterface(Components.interfaces.nsIFile);
    if (ispDirectory)
      buildServerFilterListFromDir(ispDirectory);
  }
}

// helper function called by buildServerFilterMenuList. Enumerates over the passed in
// directory looking for .sfd files. For each entry found, it gets appended to the menu list
function buildServerFilterListFromDir(aDir)
{
  var ispHeaderList = document.getElementById('useServerFilterList');

  // now iterate over each file in the directory looking for .sfd files
  var entries = aDir.directoryEntries.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);

  while (entries.hasMoreElements())
  {
    var entry = entries.nextFile;
    if (entry.isFile())
    {
      // we only care about files that end in .sfd
      if (entry.isFile() && /\.sfd$/.test(entry.leafName))
      {
        var fileName = RegExp.leftContext;
        // if we've already added an item with this name, then don't add it again.
        if (ispHeaderList.getElementsByAttribute("value", fileName).item(0))
          continue;
        ispHeaderList.appendItem(fileName, fileName);
      }
    }
  }
}
