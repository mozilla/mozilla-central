/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Communicator Shared Utility Library
 * for shared application glue for the Communicator suite of applications
 **/

// Services = object with smart getters for common XPCOM services
Components.utils.import("resource://gre/modules/Services.jsm");

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyGetter(this, "Weave", function() {
  let tmp = {};
  Components.utils.import("resource://services-sync/main.js", tmp);
  return tmp.Weave;
});

/*
  Note: All Editor/Composer-related methods have been moved to editorApplicationOverlay.js,
  so app windows that require those must include editorNavigatorOverlay.xul
*/

/**
 * Go into online/offline mode
 **/

const kProxyManual = ["network.proxy.ftp",
                      "network.proxy.http",
                      "network.proxy.socks",
                      "network.proxy.ssl"];
const kExistingWindow = Components.interfaces.nsIBrowserDOMWindow.OPEN_CURRENTWINDOW;
const kNewWindow = Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWWINDOW;
const kNewTab = Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB;
const kExistingTab = Components.interfaces.nsIBrowserDOMWindow.OPEN_SWITCHTAB;
const kNewPrivate = 5;
var TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";
var gShowBiDi = false;
var gUtilityBundle = null;
var gPrivate = null;

function toggleOfflineStatus()
{
  var checkfunc;
  try {
    checkfunc = document.getElementById("offline-status").getAttribute('checkfunc');
  }
  catch (ex) {
    checkfunc = null;
  }

  if (checkfunc) {
    if (!eval(checkfunc)) {
      // the pre-offline check function returned false, so don't go offline
      return;
    }
  }
  Services.io.manageOfflineStatus = false;
  Services.io.offline = !Services.io.offline;
}

function setNetworkStatus(networkProxyType)
{
  try {
    Services.prefs.setIntPref("network.proxy.type", networkProxyType);
  }
  catch (ex) {}
}

function InitProxyMenu()
{
  var networkProxyNo = document.getElementById("network-proxy-no");
  var networkProxyManual = document.getElementById("network-proxy-manual");
  var networkProxyPac = document.getElementById("network-proxy-pac");
  var networkProxyWpad = document.getElementById("network-proxy-wpad");
  var networkProxySystem = document.getElementById("network-proxy-system");

  var proxyLocked = Services.prefs.prefIsLocked("network.proxy.type");
  if (proxyLocked) {
    networkProxyNo.setAttribute("disabled", "true");
    networkProxyWpad.setAttribute("disabled", "true");
    networkProxySystem.setAttribute("disabled", "true");
  }
  else {
    networkProxyNo.removeAttribute("disabled");
    networkProxyWpad.removeAttribute("disabled");
    networkProxySystem.removeAttribute("disabled");
  }

  // If no proxy is configured, disable the menuitems.
  // Checking for proxy manual settings.
  var proxyManuallyConfigured = false;
  for (var i = 0; i < kProxyManual.length; i++) {
    if (GetStringPref(kProxyManual[i]) != "") {
      proxyManuallyConfigured = true;
      break;
    }
  }

  if (proxyManuallyConfigured && !proxyLocked) {
    networkProxyManual.removeAttribute("disabled");
  }
  else {
    networkProxyManual.setAttribute("disabled", "true");
  }

  //Checking for proxy PAC settings.
  var proxyAutoConfigured = false;
  if (GetStringPref("network.proxy.autoconfig_url") != "")
    proxyAutoConfigured = true;

  if (proxyAutoConfigured && !proxyLocked) {
    networkProxyPac.removeAttribute("disabled");
  }
  else {
    networkProxyPac.setAttribute("disabled", "true");
  }

  // The pref value 3 for network.proxy.type is unused to maintain
  // backwards compatibility. Treat 3 equally to 0. See bug 115720.
  var networkProxyStatus = [networkProxyNo, networkProxyManual, networkProxyPac,
                            networkProxyNo, networkProxyWpad,
                            networkProxySystem];
  var networkProxyType = GetIntPref("network.proxy.type", 0);
  networkProxyStatus[networkProxyType].setAttribute("checked", "true");
}

function setProxyTypeUI()
{
  var panel = document.getElementById("offline-status");
  if (!panel)
    return;

  var onlineTooltip = "onlineTooltip" + GetIntPref("network.proxy.type", 0);
  panel.setAttribute("tooltiptext", gUtilityBundle.getString(onlineTooltip));
}

function SetStringPref(aPref, aValue)
{
  const nsISupportsString = Components.interfaces.nsISupportsString;
  try {
    var str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(nsISupportsString);
    str.data = aValue;
    Services.prefs.setComplexValue(aPref, nsISupportsString, str);
  } catch (e) {}
}

function GetStringPref(name)
{
  try {
    return Services.prefs.getComplexValue(name,
               Components.interfaces.nsISupportsString).data;
  } catch (e) {}
  return "";
}

function GetLocalizedStringPref(aPrefName, aDefaultValue)
{
  try {
    return Services.prefs.getComplexValue(aPrefName,
               Components.interfaces.nsIPrefLocalizedString).data;
  } catch (e) {
    Components.utils.reportError("Couldn't get " + aPrefName + " pref: " + e);
  }
  return aDefaultValue;
}

function GetLocalFilePref(aName)
{
  try {
    return Services.prefs.getComplexValue(aName,
               Components.interfaces.nsILocalFile);
  } catch (e) {}
  return null;
}

/**
  * Returns the Desktop folder.
  */
function GetDesktopFolder()
{
  return Services.dirsvc.get("Desk", Components.interfaces.nsILocalFile);
}

/**
  * Returns the relevant nsIFile directory.
  */
function GetSpecialDirectory(aName)
{
  return Services.dirsvc.get(aName, Components.interfaces.nsIFile);
}

function GetUrlbarHistoryFile()
{
  var profileDir = GetSpecialDirectory("ProfD");
  profileDir.append("urlbarhistory.sqlite");
  return profileDir;
}

function setOfflineUI(offline)
{
  var broadcaster = document.getElementById("Communicator:WorkMode");
  var panel = document.getElementById("offline-status");
  if (!broadcaster || !panel) return;

  // Checking for a preference "network.online", if it's locked, disabling
  // network icon and menu item
  if (Services.prefs.prefIsLocked("network.online"))
    broadcaster.setAttribute("disabled", "true");

  if (offline)
    {
      broadcaster.setAttribute("offline", "true");
      broadcaster.setAttribute("checked", "true");
      panel.removeAttribute("context");
      panel.setAttribute("tooltiptext", gUtilityBundle.getString("offlineTooltip"));
    }
  else
    {
      broadcaster.removeAttribute("offline");
      broadcaster.removeAttribute("checked");
      panel.setAttribute("context", "networkProperties");
      setProxyTypeUI();
    }
}

function getBrowserURL() {

  try {
    var url = Services.prefs.getCharPref("browser.chromeURL");
    if (url)
      return url;
  } catch(e) {
  }
  return "chrome://navigator/content/navigator.xul";
}

function goPreferences(paneID)
{
  //check for an existing pref window and focus it; it's not application modal
  var lastPrefWindow = Services.wm.getMostRecentWindow("mozilla:preferences");
  if (lastPrefWindow)
    lastPrefWindow.focus();
  else
    openDialog("chrome://communicator/content/pref/preferences.xul",
               "PrefWindow", "non-private,chrome,titlebar,dialog=no,resizable",
               paneID);
}

function goToggleToolbar( id, elementID )
{
  var toolbar = document.getElementById( id );
  var element = document.getElementById( elementID );
  if ( toolbar )
  {
    var attribValue = toolbar.getAttribute("hidden") ;

    if ( attribValue == "true" )
    {
      toolbar.setAttribute("hidden", "false" );
      if ( element )
        element.setAttribute("checked","true")
    }
    else
    {
      toolbar.setAttribute("hidden", "true" );
      if ( element )
        element.setAttribute("checked","false")
    }
    document.persist(id, "hidden");
    document.persist(elementID, "checked");

    if (toolbar.hasAttribute("customindex"))
      persistCustomToolbar(toolbar);

  }
}

var gCustomizeSheet = false;

function SuiteCustomizeToolbar(aMenuItem)
{
  let toolbar = aMenuItem.parentNode.triggerNode;
  while (toolbar.localName != "toolbar") {
    toolbar = toolbar.parentNode;
    if (!toolbar)
      return false;
  }
  return goCustomizeToolbar(toolbar.toolbox);
}

function goCustomizeToolbar(toolbox)
{
  /* If the toolbox has a method "customizeInit" then call it first.
     The optional "customizeDone" method will be invoked by the callback
     from the Customize Window so we don't need to take care of that */
  if ("customizeInit" in toolbox)
    toolbox.customizeInit();

  var customizeURL = "chrome://global/content/customizeToolbar.xul";

  gCustomizeSheet = GetBoolPref("toolbar.customization.usesheet", false);

  if (gCustomizeSheet) {
    var sheetFrame = document.getElementById("customizeToolbarSheetIFrame");
    var panel = document.getElementById("customizeToolbarSheetPopup");
    sheetFrame.hidden = false;
    sheetFrame.toolbox = toolbox;
    sheetFrame.panel = panel;

    // The document might not have been loaded yet, if this is the first time.
    // If it is already loaded, reload it so that the onload initialization
    // code re-runs.
    if (sheetFrame.getAttribute("src") == customizeURL)
      sheetFrame.contentWindow.location.reload();
    else
      sheetFrame.setAttribute("src", customizeURL);

    // Open the panel, but make it invisible until the iframe has loaded so
    // that the user doesn't see a white flash.
    panel.style.visibility = "hidden";
    toolbox.addEventListener("beforecustomization", function toolboxBeforeCustom() {
      toolbox.removeEventListener("beforecustomization", toolboxBeforeCustom, false);
      panel.style.removeProperty("visibility");
    }, false);
    panel.openPopup(toolbox, "after_start", 0, 0);
    return sheetFrame.contentWindow;
  }
  else {
    return window.openDialog(customizeURL,
                             "",
                             "chrome,all,dependent",
                             toolbox);
  }
}

function onViewToolbarsPopupShowing(aEvent, aInsertPoint)
{
  var popup = aEvent.target;
  if (popup != aEvent.currentTarget)
    return;

  // Empty the menu
  var deadItems = popup.getElementsByAttribute("toolbarid", "*");
  for (let i = deadItems.length - 1; i >= 0; --i)
    popup.removeChild(deadItems[i]);

  // Thunderbird/Lightning function signature is:
  // onViewToolbarsPopupShowing(aEvent, toolboxIds, aInsertPoint)
  // where toolboxIds is either a string or an array of strings.
  var firstMenuItem = aInsertPoint instanceof XULElement ? aInsertPoint
                                                         : popup.firstChild;

  var toolbar = document.popupNode || popup;
  while (toolbar.localName != "toolbar")
    toolbar = toolbar.parentNode;
  var toolbox = toolbar.toolbox;
  var externalToolbars = Array.filter(toolbox.externalToolbars,
                                      function(toolbar) {
                                        return toolbar.hasAttribute("toolbarname")});
  var toolbars = Array.slice(toolbox.getElementsByAttribute("toolbarname", "*"));
  toolbars = toolbars.concat(externalToolbars);
  var menusep = document.getElementById("toolbarmode-sep");

  var menubar = toolbox.getElementsByAttribute("type", "menubar").item(0);
  if (!menubar || !toolbars.length) {
    menusep.hidden = true;
    return;
  }
  menusep.hidden = false;

  toolbars.forEach(function(bar) {
    let menuItem = document.createElement("menuitem");
    menuItem.setAttribute("id", "toggle_" + bar.id);
    menuItem.setAttribute("toolbarid", bar.id);
    menuItem.setAttribute("type", "checkbox");
    menuItem.setAttribute("label", bar.getAttribute("toolbarname"));
    menuItem.setAttribute("accesskey", bar.getAttribute("accesskey"));
    menuItem.setAttribute("checked", !bar.hidden);
    popup.insertBefore(menuItem, firstMenuItem);
  });
}

function onToolbarModePopupShowing(aEvent)
{
  var popup = aEvent.target;

  var toolbar = document.popupNode;
  while (toolbar.localName != "toolbar")
    toolbar = toolbar.parentNode;
  var toolbox = toolbar.toolbox;

  var mode = toolbar.getAttribute("mode") || "full";
  var modePopup = document.getElementById("toolbarModePopup");
  var radio = modePopup.getElementsByAttribute("value", mode);
  radio[0].setAttribute("checked", "true");

  var small = toolbar.getAttribute("iconsize") == "small";
  var smallicons = document.getElementById("toolbarmode-smallicons");
  smallicons.setAttribute("checked", small);
  smallicons.setAttribute("disabled", mode == "text");

  var end = toolbar.getAttribute("labelalign") == "end";
  var labelalign = document.getElementById("toolbarmode-labelalign");
  labelalign.setAttribute("checked", end);
  labelalign.setAttribute("disabled", mode != "full");

  var custommode = (toolbar.getAttribute("mode") || "full") !=
                   (toolbar.getAttribute("defaultmode") ||
                    toolbox.getAttribute("mode") ||
                    "full");
  var customicon = (toolbar.getAttribute("iconsize") || "large") !=
                   (toolbar.getAttribute("defaulticonsize") ||
                    toolbox.getAttribute("iconsize") ||
                    "large");
  var customalign = (toolbar.getAttribute("labelalign") || "bottom") !=
                    (toolbar.getAttribute("defaultlabelalign") ||
                     toolbox.getAttribute("labelalign") ||
                     "bottom");
  var custom = custommode || customicon || customalign ||
               toolbar.hasAttribute("ignoremodepref");

  var defmode = document.getElementById("toolbarmode-default");
  defmode.setAttribute("checked", !custom);
  defmode.setAttribute("disabled", !custom);

  var command = document.getElementById("cmd_CustomizeToolbars");
  var menuitem  = document.getElementById("customize_toolbars");
  menuitem.hidden = !command;
  menuitem.previousSibling.hidden = !command;
}

function onViewToolbarCommand(aEvent)
{
  var toolbar = aEvent.originalTarget.getAttribute("toolbarid");
  if (toolbar)
    goToggleToolbar(toolbar);
}

function goSetToolbarState(aEvent)
{
  aEvent.stopPropagation();
  var toolbar = document.popupNode;
  while (toolbar.localName != "toolbar")
    toolbar = toolbar.parentNode;
  var toolbox = toolbar.parentNode;

  var target = aEvent.originalTarget;
  var mode = target.value;
  var radiogroup = target.getAttribute("name");
  var primary = /toolbar-primary/.test(toolbar.getAttribute("class"));

  switch (mode) {
    case "smallicons":
      var size = target.getAttribute("checked") == "true" ? "small" : "large";
      toolbar.setAttribute("iconsize", size);
      break;

    case "end":
      var align = target.getAttribute("checked") == "true" ? "end" : "bottom";
      toolbar.setAttribute("labelalign", align);
      break;

    case "default":
      toolbar.setAttribute("mode", toolbar.getAttribute("defaultmode") ||
                                   toolbox.getAttribute("mode"));
      toolbar.setAttribute("iconsize", toolbar.getAttribute("defaulticonsize") ||
                                       toolbox.getAttribute("iconsize"));
      toolbar.setAttribute("labelalign", toolbar.getAttribute("defaultlabelalign") ||
                                         toolbox.getAttribute("labelalign"));
      if (primary)
        toolbar.removeAttribute("ignoremodepref");
      break;

    default:
      toolbar.setAttribute("mode", mode);
      if (primary)
        toolbar.setAttribute("ignoremodepref", "true");
      break;
  }
  document.persist(toolbar.id, "mode");
  document.persist(toolbar.id, "iconsize");
  document.persist(toolbar.id, "labelalign");
  if (primary)
    document.persist(toolbar.id, "ignoremodepref");
  if (toolbar.hasAttribute("customindex"))
    persistCustomToolbar(toolbar);
}

function persistCustomToolbar(toolbar)
{
  var toolbox = toolbar.parentNode;
  var name = toolbar.getAttribute("toolbarname").replace(" ", "_");
  var attrs = ["mode", "iconsize", "labelalign", "hidden"];
  for (let i = 0; i < attrs.length; i++) {
    let value = toolbar.getAttribute(attrs[i]);
    let attr = name + attrs[i];
    toolbox.toolbarset.setAttribute(attr, value);
    document.persist(toolbox.toolbarset.id, attr);
  }
}

/* Common Customize Toolbar code */

function toolboxCustomizeInit(menubarID)
{
  // Disable the toolbar context menu items
  var menubar = document.getElementById(menubarID);
  for (let i = 0; i < menubar.childNodes.length; ++i) {
    let item = menubar.childNodes[i];
    if (item.getAttribute("disabled") != "true") {
      item.setAttribute("disabled", "true");
      item.setAttribute("saved-disabled", "false");
    }
  }

  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.setAttribute("disabled", "true");
}

function toolboxCustomizeDone(menubarID, toolbox, aToolboxChanged)
{
  if (gCustomizeSheet) {
    document.getElementById("customizeToolbarSheetIFrame").hidden = true;
    document.getElementById("customizeToolbarSheetPopup").hidePopup();
    if (content)
      content.focus();
    else
      window.focus();
  }

  // Re-enable parts of the UI we disabled during the dialog
  var menubar = document.getElementById(menubarID);
  for (let i = 0; i < menubar.childNodes.length; ++i) {
    let item = menubar.childNodes[i];
    if (item.hasAttribute("saved-disabled")) {
      item.removeAttribute("disabled");
      item.removeAttribute("saved-disabled");
    }
  }

  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.removeAttribute("disabled");

  var toolbars = toolbox.getElementsByAttribute("customindex", "*");
  for (let i = 0; i < toolbars.length; ++i) {
    persistCustomToolbar(toolbars[i]);
  }
}

function toolboxCustomizeChange(toolbox, event)
{
  if (event != "reset")
    return;
  var toolbars = toolbox.getElementsByAttribute("toolbarname", "*");
  for (let i = 0; i < toolbars.length; ++i) {
    let toolbar = toolbars[i];
    toolbar.setAttribute("labelalign",
                         toolbar.getAttribute("defaultlabelalign") ||
                         toolbox.getAttribute("labelalign"));
    document.persist(toolbar.id, "labelalign");
    let primary = /toolbar-primary/.test(toolbar.getAttribute("class"));
    if (primary) {
      toolbar.removeAttribute("ignoremodepref");
      document.persist(toolbar.id, "ignoremodepref");
    }
  }
}

function goClickThrobber(urlPref, aEvent)
{
  var url = GetLocalizedStringPref(urlPref);
  if (url)
    openUILinkIn(url, whereToOpenLink(aEvent, false, true, true));
}

function getTopWin()
{
  return top.gPrivate || Services.wm.getMostRecentWindow("navigator:browser");
}

function isRestricted( url )
{
  try {
    const nsIURIFixup = Components.interfaces.nsIURIFixup;
    var uri = Components.classes["@mozilla.org/docshell/urifixup;1"]
                        .getService(nsIURIFixup)
                        .createFixupURI(url, nsIURIFixup.FIXUP_FLAG_NONE);
    const URI_INHERITS_SECURITY_CONTEXT =
        Components.interfaces.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT;
    return Components.classes["@mozilla.org/network/util;1"]
                     .getService(Components.interfaces.nsINetUtil)
                     .URIChainHasFlags(uri, URI_INHERITS_SECURITY_CONTEXT);
  } catch (e) {
    return false;
  }
}

function openTopWin( url, opener )
{
    /* note that this chrome url should probably change to not have
       all of the navigator controls, but if we do this we need to have
       the option for chrome controls because goClickThrobber() needs to
       use this function with chrome controls */
    /* also, do we want to
       limit the number of help windows that can be spawned? */
    if ((url == null) || (url == "")) return null;

    // avoid loading "", since this loads a directory listing
    if (url == "") {
        url = "about:blank";
    }

    var topWindowOfType = getTopWin();
    if ( topWindowOfType )
    {
        if (!opener || !isRestricted(url))
            topWindowOfType.loadURI(url);
        else if (topWindowOfType.content == opener.top)
            opener.open(url, "_top");
        else
            topWindowOfType.getBrowser().loadURIWithFlags(url,
                Components.interfaces.nsIWebNavigation.LOAD_FLAGS_FROM_EXTERNAL);

        topWindowOfType.content.focus();
        return topWindowOfType;
    }
    return window.openDialog( getBrowserURL(), "_blank", "chrome,all,dialog=no", url );
}

function goAbout(aProtocol)
{
  var target;
  var url = "about:" + (aProtocol || "");
  var defaultAboutState = Services.prefs.getIntPref("browser.link.open_external");

  switch (defaultAboutState) {
  case kNewWindow:
    target = "window";
    break;
  case kExistingWindow:
    target = "current";
    break;
  default:
    target = "tabfocused";
  }
  openUILinkIn(url, target);
}

function goTroubleshootingPage()
{
  goAbout("support");
}

function goReleaseNotes()
{
  // get release notes URL from prefs
  try {
    openUILink(Services.urlFormatter.formatURLPref("app.releaseNotesURL"));
  }
  catch (ex) { dump(ex); }
}

function openDictionaryList()
{
  try {
    openAsExternal(Services.urlFormatter.formatURLPref("spellchecker.dictionaries.download.url"));
  }
  catch (ex) {
    dump(ex);
  }
}

// Prompt user to restart the browser in safe mode 
function safeModeRestart()
{
  // prompt the user to confirm 
  var promptTitle = gUtilityBundle.getString("safeModeRestartPromptTitle");
  var promptMessage = gUtilityBundle.getString("safeModeRestartPromptMessage");
  var restartText = gUtilityBundle.getString("safeModeRestartButton");
  var checkboxText = gUtilityBundle.getString("safeModeRestartCheckbox");
  var checkbox = { value: true };
  var buttonFlags = (Services.prompt.BUTTON_POS_0 *
                     Services.prompt.BUTTON_TITLE_IS_STRING) +
                    (Services.prompt.BUTTON_POS_1 *
                     Services.prompt.BUTTON_TITLE_CANCEL) +
                    Services.prompt.BUTTON_POS_0_DEFAULT;

  var rv = Services.prompt.confirmEx(window, promptTitle, promptMessage,
                                     buttonFlags, restartText, null, null,
                                     checkboxText, checkbox);
  if (rv == 0) {
    if (checkbox.value)
      Components.classes["@mozilla.org/process/environment;1"]
                .getService(Components.interfaces.nsIEnvironment)
                .set("MOZ_SAFE_MODE_RESTART", "1");
    Application.restart();
  }
}

function checkForUpdates()
{
  var um = Components.classes["@mozilla.org/updates/update-manager;1"]
                     .getService(Components.interfaces.nsIUpdateManager);
  var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"]
                           .createInstance(Components.interfaces.nsIUpdatePrompt);

  // If there's an update ready to be applied, show the "Update Downloaded"
  // UI instead and let the user know they have to restart the browser for
  // the changes to be applied.
  if (um.activeUpdate && um.activeUpdate.state == "pending")
    prompter.showUpdateDownloaded(um.activeUpdate);
  else
    prompter.checkForUpdates();
}

function updateCheckUpdatesItem()
{
  var hasUpdater = "nsIApplicationUpdateService" in Components.interfaces;
  var checkForUpdates = document.getElementById("checkForUpdates");

  if (!hasUpdater)
  {
    var updateSeparator = document.getElementById("updateSeparator");

    checkForUpdates.hidden = true;
    updateSeparator.hidden = true;
    return;
  }

  var updates = Components.classes["@mozilla.org/updates/update-service;1"]
                          .getService(Components.interfaces.nsIApplicationUpdateService);
  var um = Components.classes["@mozilla.org/updates/update-manager;1"]
                     .getService(Components.interfaces.nsIUpdateManager);

  // Disable the UI if the update enabled pref has been locked by the
  // administrator or if we cannot update for some other reason.
  var canCheckForUpdates = updates.canCheckForUpdates;
  checkForUpdates.setAttribute("disabled", !canCheckForUpdates);

  if (!canCheckForUpdates)
    return;

  // By default, show "Check for Updates..."
  var key = "default";
  if (um.activeUpdate) {
    switch (um.activeUpdate.state) {
    case "downloading":
      // If we're downloading an update at present, show the text:
      // "Downloading SeaMonkey x.x..." otherwise we're paused, and show
      // "Resume Downloading SeaMonkey x.x..."
      key = updates.isDownloading ? "downloading" : "resume";
      break;
    case "pending":
      // If we're waiting for the user to restart, show: "Apply Downloaded
      // Updates Now..."
      key = "pending";
      break;
    }
  }

  // If there's an active update, substitute its name into the label
  // we show for this item, otherwise display a generic label.
  if (um.activeUpdate && um.activeUpdate.name)
    checkForUpdates.label = gUtilityBundle.getFormattedString("updatesItem_" + key,
                                                              [um.activeUpdate.name]);
  else
    checkForUpdates.label = gUtilityBundle.getString("updatesItem_" + key + "Fallback");

  checkForUpdates.accessKey = gUtilityBundle.getString("updatesItem_" + key + "AccessKey"); 

  if (um.activeUpdate && updates.isDownloading)
    checkForUpdates.setAttribute("loading", "true");
  else
    checkForUpdates.removeAttribute("loading");
}

// update menu items that rely on focus
function goUpdateGlobalEditMenuItems()
{
  goUpdateCommand('cmd_undo');
  goUpdateCommand('cmd_redo');
  goUpdateCommand('cmd_cut');
  goUpdateCommand('cmd_copy');
  goUpdateCommand('cmd_paste');
  goUpdateCommand('cmd_selectAll');
  goUpdateCommand('cmd_delete');
  if (gShowBiDi)
    goUpdateCommand('cmd_switchTextDirection');
}

// update menu items that rely on the current selection
function goUpdateSelectEditMenuItems()
{
  goUpdateCommand('cmd_cut');
  goUpdateCommand('cmd_copy');
  goUpdateCommand('cmd_delete');
  goUpdateCommand('cmd_selectAll');
}

// update menu items that relate to undo/redo
function goUpdateUndoEditMenuItems()
{
  goUpdateCommand('cmd_undo');
  goUpdateCommand('cmd_redo');
}

// update menu items that depend on clipboard contents
function goUpdatePasteMenuItems()
{
  goUpdateCommand('cmd_paste');
}

// update Find As You Type menu items, they rely on focus
function goUpdateFindTypeMenuItems()
{
  goUpdateCommand('cmd_findTypeText');
  goUpdateCommand('cmd_findTypeLinks');
}

// Gather all descendent text under given document node.
function gatherTextUnder(root)
{
  var text = "";
  var node = root.firstChild;
  var depth = 1;
  while ( node && depth > 0 ) {
    // See if this node is text.
    if ( node.nodeType == Node.TEXT_NODE ) {
      // Add this text to our collection.
      text += " " + node.data;
    } else if ( node instanceof HTMLImageElement ) {
      // If it has an alt= attribute, add that.
      var altText = node.getAttribute( "alt" );
      if ( altText && altText != "" ) {
        text += " " + altText;
      }
    }
    // Find next node to test.
    // First, see if this node has children.
    if ( node.hasChildNodes() ) {
      // Go to first child.
      node = node.firstChild;
      depth++;
    } else {
      // No children, try next sibling.
      if ( node.nextSibling ) {
        node = node.nextSibling;
      } else {
        // Last resort is a sibling of an ancestor.
        while ( node && depth > 0 ) {
          node = node.parentNode;
          depth--;
          if ( node.nextSibling ) {
            node = node.nextSibling;
            break;
          }
        }
      }
    }
  }

  // Strip leading and trailing whitespaces,
  // then compress remaining whitespaces.
  return text.trim().replace(/\s+/g, " ");
}

var offlineObserver = {
  observe: function(subject, topic, state) {
    // sanity checks
    if (topic != "network:offline-status-changed") return;
    setOfflineUI(state == "offline");
  }
}

var proxyTypeObserver = {
  observe: function(subject, topic, state) {
    // sanity checks
    if (state == "network.proxy.type" && !Services.io.offline)
      setProxyTypeUI();
  }
}

function utilityOnLoad(aEvent)
{
  gUtilityBundle = document.getElementById("bundle_utilityOverlay");

  var broadcaster = document.getElementById("Communicator:WorkMode");
  if (!broadcaster) return;

  Services.obs.addObserver(offlineObserver, "network:offline-status-changed", false);
  // make sure we remove this observer later
  Services.prefs.addObserver("network.proxy.type", proxyTypeObserver, false);

  addEventListener("unload", utilityOnUnload, false);

  // set the initial state
  setOfflineUI(Services.io.offline);

  // Check for system proxy settings class and show menuitem if present
  if ("@mozilla.org/system-proxy-settings;1" in Components.classes &&
      document.getElementById("network-proxy-system"))
    document.getElementById("network-proxy-system").hidden = false;
}

function utilityOnUnload(aEvent)
{
  Services.obs.removeObserver(offlineObserver, "network:offline-status-changed");
  Services.prefs.removeObserver("network.proxy.type", proxyTypeObserver);
}

addEventListener("load", utilityOnLoad, false);

/**
 * example use:
 *   suggestUniqueFileName("testname", ".txt", ["testname.txt", "testname(2).txt"])
 *   returns "testname(3).txt"
 * does not check file system for existing files
 *
 * @param aBaseName base name for generating unique filenames.
 *
 * @param aExtension extension name to use for the generated filename.
 *
 * @param aExistingNames array of names in use.
 *
 * @return suggested filename as a string.
 */
function suggestUniqueFileName(aBaseName, aExtension, aExistingNames)
{
  var suffix = 1;
  aBaseName = validateFileName(aBaseName);
  var suggestion = aBaseName + aExtension;
  while (aExistingNames.indexOf(suggestion) != -1)
  {
    suffix++;
    suggestion = aBaseName + "(" + suffix + ")" + aExtension;
  }
  return suggestion;
}

function focusElement(aElement)
{
  if (isElementVisible(aElement))
    aElement.focus();
}
 
function isElementVisible(aElement)
{
  if (!aElement)
    return false;

  // If aElement or a direct or indirect parent is hidden or collapsed,
  // height, width or both will be 0.
  var bo = aElement.boxObject;
  return (bo.height > 0 && bo.width > 0);
}

function makeURLAbsolute(aBase, aUrl, aCharset)
{
  // Construct nsIURL.
  return Services.io.newURI(aUrl, aCharset,
                            Services.io.newURI(aBase, aCharset, null)).spec;
}

function openAsExternal(aURL)
{
  var loadType = Services.prefs.getIntPref("browser.link.open_external");
  var loadInBackground = Services.prefs.getBoolPref("browser.tabs.loadDivertedInBackground");
  openNewTabWindowOrExistingWith(loadType, aURL, null, loadInBackground);
}

/**
 * openNewTabWith: opens a new tab with the given URL.
 * openNewWindowWith: opens a new window with the given URL.
 * openNewPrivateWith: opens a private window with the given URL.
 *
 * @param aURL
 *        The URL to open (as a string).
 * @param aDocument
 *        The document from which the URL came, or null. This is used to set
 *        the referrer header and to do a security check of whether the
 *        document is allowed to reference the URL. If null, there will be no
 *        referrer header and no security check.
 * @param aPostData
 *        Form POST data, or null.
 * @param aEvent
 *        The triggering event (for the purpose of determining whether to open
 *        in the background), or null.
 *        Legacy callers may use a boolean (aReverseBackgroundPref) here to
 *        reverse the background behaviour.
 * @param aAllowThirdPartyFixup
 *        If true, then we allow the URL text to be sent to third party
 *        services (e.g., Google's I Feel Lucky) for interpretation. This
 *        parameter may be undefined in which case it is treated as false.
 * @param [optional] aReferrer
 *        If aDocument is null, then this will be used as the referrer.
 *        There will be no security check.
 */
function openNewPrivateWith(aURL, aDoc, aPostData, aAllowThirdPartyFixup,
                            aReferrer)
{
  return openNewTabWindowOrExistingWith(kNewPrivate, aURL, aDoc, false,
                                        aPostData, aAllowThirdPartyFixup,
                                        aReferrer);
}

function openNewWindowWith(aURL, aDoc, aPostData, aAllowThirdPartyFixup,
                           aReferrer)
{
  return openNewTabWindowOrExistingWith(kNewWindow, aURL, aDoc, false,
                                        aPostData, aAllowThirdPartyFixup,
                                        aReferrer);
}

function openNewTabWith(aURL, aDoc, aPostData, aEvent,
                        aAllowThirdPartyFixup, aReferrer)
{
  var loadInBackground = Services.prefs.getBoolPref("browser.tabs.loadInBackground");
  if (arguments.length == 3 && typeof aPostData == "boolean")
  {
    // Handle legacy boolean parameter.
    if (aPostData)
    {
      loadInBackground = !loadInBackground;
    }
    aPostData = null;
  }
  else if (aEvent && aEvent.shiftKey)
  {
    loadInBackground = !loadInBackground;
  }
  return openNewTabWindowOrExistingWith(kNewTab, aURL, aDoc, loadInBackground,
                                        aPostData, aAllowThirdPartyFixup,
                                        aReferrer);
}

function openNewTabWindowOrExistingWith(aType, aURL, aDoc, aLoadInBackground,
                                        aPostData, aAllowThirdPartyFixup,
                                        aReferrer)
{
  // Make sure we are allowed to open this url
  if (aDoc)
    urlSecurityCheck(aURL, aDoc.nodePrincipal,
                     Components.interfaces.nsIScriptSecurityManager.STANDARD);

  // get referrer, if as external should be null
  var referrerURI = aDoc ? aDoc.documentURIObject : aReferrer;

  var browserWin;
  // if we're not opening a new window, try and find existing window
  if (aType != kNewWindow && aType != kNewPrivate)
    browserWin = getTopWin();

  // Where appropriate we want to pass the charset of the
  // current document over to a new tab / window.
  var originCharset = null;
  if (aType != kExistingWindow) {
    var wintype = document.documentElement.getAttribute('windowtype');
    if (wintype == "navigator:browser")
      originCharset = window.content.document.characterSet;
  }

  // We want to open in a new window or no existing window can be found.
  if (!browserWin) {
    var features = "private,chrome,all,dialog=no";
    if (aType != kNewPrivate)
      features = "non-" + features;
    var charsetArg = null;
    if (originCharset)
      charsetArg = "charset=" + originCharset;
    return window.openDialog(getBrowserURL(), "_blank", features,
                             aURL, charsetArg, referrerURI, aPostData,
                             aAllowThirdPartyFixup);
  }

  // Get the existing browser object
  var browser = browserWin.getBrowser();

  // Open link in an existing window.
  if (aType == kExistingWindow) {
    browserWin.loadURI(aURL, referrerURI, aPostData, aAllowThirdPartyFixup);
    browserWin.content.focus();
    return browserWin;
  }

  // open link in new tab
  var tab = browser.loadOneTab(aURL, {
              referrerURI: referrerURI,
              charset: originCharset,
              postData: aPostData,
              inBackground: aLoadInBackground,
              allowThirdPartyFixup: aAllowThirdPartyFixup
            });
  if (!aLoadInBackground)
    browserWin.content.focus();
  return tab;
}

/**
 * Handle command events bubbling up from error page content
 * called from oncommand by <browser>s that support error pages
 */
function BrowserOnCommand(event)
{
  // Don't trust synthetic events
  if (!event.isTrusted)
    return;

  const ot = event.originalTarget;
  const ownerDoc = ot.ownerDocument;
  const docURI = ownerDoc.documentURI;
  const buttonID = ot.getAttribute("anonid");

  // If the event came from an ssl error page, it is probably either the "Add
  // Exception" or "Get Me Out Of Here" button
  if (docURI.startsWith("about:certerror?")) {
    if (buttonID == "exceptionDialogButton") {
      var params = { exceptionAdded : false };

      switch (GetIntPref("browser.ssl_override_behavior", 2)) {
        case 2 : // Pre-fetch & pre-populate.
          params.prefetchCert = true;
          // Fall through.
        case 1 : // Pre-populate.
          params.location = ownerDoc.location.href;
      }

      window.openDialog('chrome://pippki/content/exceptionDialog.xul',
                        '', 'chrome,centerscreen,modal', params);

      // If the user added the exception cert, attempt to reload the page
      if (params.exceptionAdded)
        ownerDoc.location.reload();
    }
    else if (buttonID == "getMeOutOfHereButton") {
      // Redirect them to a known-functioning page, default start page
      getMeOutOfHere();
    }
  }
  else if (docURI.startsWith("about:blocked")) {
    // The event came from a button on a malware/phishing block page
    // First check whether it's malware or phishing, so that we can
    // use the right strings/links
    let isMalware = /e=malwareBlocked/.test(docURI);

    switch (buttonID) {
      case "getMeOutOfHereButton":
        getMeOutOfHere();
        break;

      case "reportButton":
        // This is the "Why is this site blocked" button.  For malware,
        // we can fetch a site-specific report, for phishing, we redirect
        // to the generic page describing phishing protection.

        if (isMalware) {
          // Get the stop badware "why is this blocked" report url,
          // append the current url, and go there.
          try {
            let reportURL = Services.urlFormatter.formatURLPref("browser.safebrowsing.malware.reportURL");
            reportURL += ownerDoc.location.href;
            loadURI(reportURL);
          } catch (e) {
            Components.utils.reportError("Couldn't get malware report URL: " + e);
          }
        }
        else { // It's a phishing site, not malware
          try {
            loadURI(Services.urlFormatter.formatURLPref("browser.safebrowsing.warning.infoURL"));
          } catch (e) {
            Components.utils.reportError("Couldn't get phishing info URL: " + e);
          }
        }
        break;

      case "ignoreWarningButton":
        getBrowser().getNotificationBox().ignoreSafeBrowsingWarning(isMalware);
        break;
    }
  }
}

/**
 * Re-direct the browser to a known-safe page.  This function is
 * used when, for example, the user browses to a known malware page
 * and is presented with about:blocked.  The "Get me out of here!"
 * button should take the user to the default start page so that even
 * when their own homepage is infected, we can get them somewhere safe.
 */
function getMeOutOfHere() {
  // Get the start page from the *default* pref branch, not the user's
  var prefs = Services.prefs.getDefaultBranch(null);
  var url = "about:blank";
  try {
    url = prefs.getComplexValue("browser.startup.homepage",
                                Components.interfaces.nsIPrefLocalizedString).data;
  } catch(e) {}
  loadURI(url);
}

function popupNotificationMenuShowing(event)
{
  var notificationbox = document.popupNode.parentNode.control;
  var uri = notificationbox.activeBrowser.currentURI;
  var allowPopupsForSite = document.getElementById("allowPopupsForSite");
  allowPopupsForSite.notificationbox = notificationbox;
  var showPopupManager = document.getElementById("showPopupManager");

  //  Only offer this menu item for the top window.
  //  See bug 280536 for problems with frames and iframes.
  try {
    // uri.host generates an exception on nsISimpleURIs, but we also
    // don't want to show this menu item when there is no host.
    allowPopupsForSite.hidden = !uri.host;
    var allowString = gUtilityBundle.getFormattedString("popupAllow", [uri.host]);
    allowPopupsForSite.setAttribute("label", allowString);
    showPopupManager.hostport = uri.hostPort;
  } catch (ex) {
    allowPopupsForSite.hidden = true;
    showPopupManager.hostport = "";
  }

  var separator = document.getElementById("popupNotificationMenuSeparator");
  separator.hidden = !createShowPopupsMenu(event.target, notificationbox.activeBrowser);
}

function RemovePopupsItems(parent)
{
  while (parent.lastChild && ("popup" in parent.lastChild))
    parent.removeChild(parent.lastChild);
}

function createShowPopupsMenu(parent, browser)
{
  if (!browser)
    return false;

  var popups = browser.pageReport;

  if (!popups)
    return false;

  for (var i = 0; i < popups.length; i++) {
    var popup = popups[i];
    var menuitem = document.createElement("menuitem");
    var str = gUtilityBundle.getFormattedString("popupMenuShow",
                                                [popup.popupWindowURI.spec]);
    menuitem.setAttribute("label", str);
    menuitem.popup = popup;
    parent.appendChild(menuitem);
  }

  return true;
}

function popupBlockerMenuCommand(target)
{
  if (!("popup" in target))
    return;
  var popup = target.popup;
  var reqWin = popup.requestingWindow;
  if (reqWin.document == popup.requestingDocument)
    reqWin.open(popup.popupWindowURI.spec, popup.popupWindowName, popup.popupWindowFeatures);
}

function disablePopupBlockerNotifications()
{
  Services.prefs.setBoolPref("privacy.popups.showBrowserMessage", false);
}

/**
 * isValidFeed: checks whether the given data represents a valid feed.
 *
 * @param  aData
 *         An object representing a feed with title, href and type.
 * @param  aPrincipal
 *         The principal of the document, used for security check.
 * @param  aIsFeed
 *         Whether this is already a known feed or not, if true only a security
 *         check will be performed.
 */ 
function isValidFeed(aData, aPrincipal, aIsFeed)
{
  if (!aData || !aPrincipal)
    return null;

  var type = aData.type.toLowerCase().replace(/^\s+|\s*(?:;.*)?$/g, "");
  if (aIsFeed || /^application\/(?:atom|rss)\+xml$/.test(type)) {
    try {
      urlSecurityCheck(aData.href, aPrincipal,
                       Components.interfaces.nsIScriptSecurityManager.DISALLOW_INHERIT_PRINCIPAL);
      return type || "application/rss+xml";
    }
    catch(ex) {
    }
  }

  return null;
}

// Used as an onclick handler for UI elements with link-like behavior.
// e.g. onclick="checkForMiddleClick(this, event);"
function checkForMiddleClick(node, event) {
  // We should be using the disabled property here instead of the attribute,
  // but some elements that this function is used with don't support it (e.g.
  // menuitem).
  if (node.getAttribute("disabled") == "true")
    return; // Do nothing

  if (event.button == 1) {
    /* Execute the node's oncommand or command.
     *
     * XXX: we should use node.oncommand(event) once bug 246720 is fixed.
     */
    var target = node.hasAttribute("oncommand") ? node :
                 node.ownerDocument.getElementById(node.getAttribute("command"));
    var fn = new Function("event", target.getAttribute("oncommand"));
    fn.call(target, event);

    // If the middle-click was on part of a menu, close the menu.
    // (Menus close automatically with left-click but not with middle-click.)
    closeMenus(event.target);
  }
}

// Closes all popups that are ancestors of the node.
function closeMenus(node)
{
  for (; node; node = node.parentNode) {
    if (node instanceof Components.interfaces.nsIDOMXULPopupElement)
      node.hidePopup();
  }
}

function GetBoolPref(aPrefName, aDefaultValue)
{
  try {
    return Services.prefs.getBoolPref(aPrefName);
  } catch (e) {}
  return aDefaultValue;
}

function GetIntPref(aPrefName, aDefaultValue)
{
  try {
    return Services.prefs.getIntPref(aPrefName);
  } catch (e) {
    Components.utils.reportError("Couldn't get " + aPrefName + " pref: " + e);
  }
  return aDefaultValue;
}

/**
 * Toggle a splitter to show or hide some piece of UI (e.g. the message preview
 * pane).
 *
 * @param aSplitterId the splitter that should be toggled
 */
function togglePaneSplitter(aSplitterId)
{
  var splitter = document.getElementById(aSplitterId);
  if (splitter.getAttribute("state") == "collapsed")
    splitter.setAttribute("state", "open");
  else
    splitter.setAttribute("state", "collapsed");
}

/* openUILink handles clicks on UI elements that cause URLs to load.
 *
 * As the third argument, you may pass an object with the same properties as
 * accepted by openUILinkIn, plus "ignoreButton" and "ignoreSave".
 *
 * Note: Firefox uses aIgnoreAlt while SeaMonkey uses aIgnoreSave because in
 * SeaMonkey, Save can be Alt or Shift depending on ui.key.saveLink.shift.
 *
 * For API compatibility with Firefox the object version uses params.ignoreAlt
 * although for SeaMonkey it is effectively ignoreSave.
 */
function openUILink(url, aEvent, aIgnoreButton, aIgnoreSave, aAllowThirdPartyFixup, aPostData, aReferrerURI)
{
  var params;
  if (aIgnoreButton && typeof aIgnoreButton == "object") {
    params = aIgnoreButton;

    // don't forward "ignoreButton" and "ignoreSave" to openUILinkIn.
    aIgnoreButton = params.ignoreButton;
    aIgnoreSave = params.ignoreAlt;
    delete params.ignoreButton;
    delete params.ignoreAlt;
  }
  else {
    params = {allowThirdPartyFixup: aAllowThirdPartyFixup,
              postData: aPostData,
              referrerURI: aReferrerURI,
              initiatingDoc: aEvent ? aEvent.target.ownerDocument : document}
  }

  var where = whereToOpenLink(aEvent, aIgnoreButton, aIgnoreSave);
  return openUILinkIn(url, where, params);
}

/* whereToOpenLink() looks at an event to decide where to open a link.
 *
 * The event may be a mouse event (click, double-click, middle-click) or keypress event (enter).
 *
 * The logic for modifiers is as following:
 * If browser.tabs.opentabfor.middleclick is true, then Ctrl (or Meta) and middle-click
 * open a new tab, depending on Shift, browser.tabs.loadInBackground, and
 * ignoreBackground.
 * Otherwise if middlemouse.openNewWindow is true, then Ctrl (or Meta) and middle-click
 * open a new window.
 * Otherwise if middle-click is pressed then nothing happens.
 * Save is Alt or Shift depending on the ui.key.saveLink.shift preference.
 * Otherwise if Alt, or Shift, or Ctrl (or Meta) is pressed then nothing happens.
 * Otherwise the most recent browser is used for left clicks.
 */
function whereToOpenLink(e, ignoreButton, ignoreSave, ignoreBackground)
{
  if (!e)
    return "current";

  var shift = e.shiftKey;
  var ctrl = e.ctrlKey;
  var meta = e.metaKey;
  var alt = e.altKey;

  // ignoreButton allows "middle-click paste" to use function without always opening in a new window.
  var middle = !ignoreButton && e.button == 1;

  if (meta || ctrl || middle) {
    if (GetBoolPref("browser.tabs.opentabfor.middleclick", true))
      return ignoreBackground ? "tabfocused" : shift ? "tabshifted" : "tab";
    if (GetBoolPref("middlemouse.openNewWindow", true))
      return "window";
    if (middle)
      return null;
  }
  if (!ignoreSave) {
    if (GetBoolPref("ui.key.saveLink.shift", true) ? shift : alt)
      return "save";
  }
  if (alt || shift || meta || ctrl)
    return null;
  return "current";
}

/* openUILinkIn opens a URL in a place specified by the parameter |where|.
 *
 * |where| can be:
 *  "current"     current tab            (if there aren't any browser windows, then in a new window instead)
 *  "tab"         new tab                (if there aren't any browser windows, then in a new window instead)
 *  "tabshifted"  same as "tab" but in background if default is to select new tabs, and vice versa
 *  "tabfocused"  same as "tab" but explicitly focus new tab
 *  "window"      new window
 *  "save"        save to disk (with no filename hint!)
 *
 * aAllowThirdPartyFixup controls whether third party services such as Google's
 * I'm Feeling Lucky are allowed to interpret this URL. This parameter may be
 * undefined, which is treated as false.
 *
 * Instead of aAllowThirdPartyFixup, you may also pass an object with any of
 * these properties:
 *   allowThirdPartyFixup (boolean)
 *   postData             (nsIInputStream)
 *   referrerURI          (nsIURI)
 *   relatedToCurrent     (boolean)
 *   initiatingDoc        (document)
 */
function openUILinkIn(url, where, aAllowThirdPartyFixup, aPostData, aReferrerURI)
{
  if (!where || !url)
    return null;

  var aRelatedToCurrent;
  var aInitiatingDoc;
  var aIsUTF8;
  if (arguments.length == 3 &&
      arguments[2] != null &&
      typeof arguments[2] == "object") {
    let params = arguments[2];
    aAllowThirdPartyFixup = params.allowThirdPartyFixup;
    aPostData             = params.postData;
    aReferrerURI          = params.referrerURI;
    aRelatedToCurrent     = params.relatedToCurrent;
    aInitiatingDoc        = params.initiatingDoc ? params.initiatingDoc : document;
    aIsUTF8               = params.isUTF8;
  }

  if (where == "save") {
    saveURL(url, null, null, true, true, aReferrerURI, aInitiatingDoc);
    return null;
  }

  var w = getTopWin();

  if (!w || where == "window") {
    return window.openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", url,
                             null, null, aPostData, aAllowThirdPartyFixup, aIsUTF8);
  }

  var loadInBackground = GetBoolPref("browser.tabs.loadInBackground", false);

  // reuse the browser if its current tab is empty
  if (isBrowserEmpty(w.getBrowser()))
    where = "current";

  switch (where) {
  case "current":
    w.loadURI(url, aReferrerURI, aPostData, aAllowThirdPartyFixup, aIsUTF8);
    w.content.focus();
    break;
  case "tabfocused":
    // forces tab to be focused
    loadInBackground = true;
    // fall through
  case "tabshifted":
    loadInBackground = !loadInBackground;
    // fall through
  case "tab":
    var browser = w.getBrowser();
    var tab = browser.addTab(url, {
                referrerURI: aReferrerURI,
                postData: aPostData,
                allowThirdPartyFixup: aAllowThirdPartyFixup,
                relatedToCurrent: aRelatedToCurrent,
                isUTF8: aIsUTF8
              });
    if (!loadInBackground) {
      browser.selectedTab = tab;
      w.content.focus();
    }
    break;
  }

  return w;
}

// This opens the URLs contained in the given array in new tabs
// of the most recent window, creates a new window if necessary.
function openUILinkArrayIn(urlArray, where, allowThirdPartyFixup)
{
  if (!where || !urlArray.length)
    return null;

  if (where == "save") {
    for (var i = 0; i < urlArray.length; i++)
      saveURL(urlArray[i], null, null, true, true, null, document);
    return null;
  }

  var w = getTopWin();

  if (!w || where == "window") {
    return window.openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no",
                             urlArray.join("\n"), // Pretend that we're a home page group
                             null, null, null, allowThirdPartyFixup);
  }

  var loadInBackground = GetBoolPref("browser.tabs.loadInBackground", false);

  var browser = w.getBrowser();
  switch (where) {
  case "current":
    w.loadURI(urlArray[0], null, null, allowThirdPartyFixup);
    w.content.focus();
    break;
  case "tabshifted":
    loadInBackground = !loadInBackground;
    // fall through
  case "tab":
    var tab = browser.addTab(urlArray[0], {allowThirdPartyFixup: allowThirdPartyFixup});
    if (!loadInBackground) {
      browser.selectedTab = tab;
      w.content.focus();
    }
  }
  var relatedToCurrent = where == "current";
  for (var i = 1; i < urlArray.length; i++)
    browser.addTab(urlArray[i], {allowThirdPartyFixup: allowThirdPartyFixup, relatedToCurrent: relatedToCurrent});

  return w;
}

/**
 * Switch to a tab that has a given URI, and focusses its browser window.
 * If a matching tab is in this window, it will be switched to. Otherwise, other
 * windows will be searched.
 *
 * @param aURI
 *        URI to search for
 * @param aOpenNew
 *        True to open a new tab and switch to it, if no existing tab is found
 * @param A callback to call when the tab is open, the tab's browser will be
 *        passed as an argument
 * @return True if a tab was switched to (or opened), false otherwise
 */
function switchToTabHavingURI(aURI, aOpenNew, aCallback) {
  function switchIfURIInWindow(aWindow) {
    if (!aWindow.gBrowser)
      return false;
    let browsers = aWindow.gBrowser.browsers;
    for (let i = 0; i < browsers.length; i++) {
      let browser = browsers[i];
      if (browser.currentURI.equals(aURI)) {
        // Focus the matching window & tab
        aWindow.focus();
        aWindow.gBrowser.tabContainer.selectedIndex = i;
        if (aCallback)
          aCallback(browser);
        return true;
      }
    }
    return false;
  }

  // This can be passed either nsIURI or a string.
  if (!(aURI instanceof Components.interfaces.nsIURI))
    aURI = Services.io.newURI(aURI, null, null);

  // Prioritise this window.
  if (switchIfURIInWindow(window))
    return true;

  let winEnum = Services.wm.getEnumerator("navigator:browser");
  while (winEnum.hasMoreElements()) {
    let browserWin = winEnum.getNext();
    // Skip closed (but not yet destroyed) windows,
    // and the current window (which was checked earlier).
    if (browserWin.closed || browserWin == window)
      continue;
    if (switchIfURIInWindow(browserWin))
      return true;
  }

  // No opened tab has that url.
  if (aOpenNew) {
    let newWindowPref = Services.prefs.getIntPref("browser.link.open_external");
    let where = newWindowPref == kNewTab ? "tabfocused" : "window";
    let browserWin = openUILinkIn(aURI.spec, where);
    if (aCallback) {
      browserWin.addEventListener("pageshow", function browserWinPageShow(event) {
        if (event.target.location.href != aURI.spec)
          return;
        browserWin.removeEventListener("pageshow", browserWinPageShow, true);
        aCallback(browserWin.getBrowser().selectedBrowser);
      }, true);
    }
    return true;
  }

  return false;
}

// Determines if a browser is "empty"
function isBrowserEmpty(aBrowser) {
  return aBrowser.sessionHistory.count < 2 &&
         aBrowser.currentURI.spec == "about:blank" &&
         !aBrowser.contentDocument.body.hasChildNodes();
}

function subscribeToFeed(href, event) {
  // Just load the feed in the content area to either subscribe or show the
  // preview UI
  var w = getTopWin();
  var charset;
  if (w) {
    var browser = w.getBrowser();
    charset = browser.characterSet;
  }
  else
    // When calling this function without any open navigator window
    charset = document.characterSet;
  var feedURI = makeURI(href, charset);

  // Use the feed scheme so X-Moz-Is-Feed will be set
  // The value doesn't matter
  if (/^https?/.test(feedURI.scheme))
    href = "feed:" + href;
  openUILink(href, event, false, true);
}

function subscribeToFeedMiddleClick(href, event) {
  if (event.button == 1) {
    this.subscribeToFeed(href, event);
    // unlike for command events, we have to close the menus manually
    closeMenus(event.target);
  }
}

function OpenSearchEngineManager() {
  var window = Services.wm.getMostRecentWindow("Browser:SearchManager");
  if (window)
    window.focus();
  else {
    var arg = { value: false };
    openDialog("chrome://communicator/content/search/engineManager.xul",
               "_blank", "chrome,dialog,modal,centerscreen,resizable", arg);
    if (arg.value)
      loadAddSearchEngines();
  }
}

function loadAddSearchEngines() {
  var newWindowPref = Services.prefs.getIntPref("browser.link.open_newwindow");
  var where = newWindowPref == kNewTab ? "tabfocused" : "window";
  var searchEnginesURL = Services.urlFormatter.formatURLPref("browser.search.searchEnginesURL");
  openUILinkIn(searchEnginesURL, where);
}

function FillInHTMLTooltip(tipElement)
{
  // Don't show the tooltip if the tooltip node is a document or disconnected.
  if (!tipElement.ownerDocument ||
      (tipElement.ownerDocument.compareDocumentPosition(tipElement) & document.DOCUMENT_POSITION_DISCONNECTED))
    return false;

  var defView = tipElement.ownerDocument.defaultView;
  // XXX Work around bug 350679:
  // "Tooltips can be fired in documents with no view".
  if (!defView)
    return false;

  const XLinkNS = "http://www.w3.org/1999/xlink";
  const XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

  var titleText = null;
  var XLinkTitleText = null;
  var SVGTitleText = null;
  var lookingForSVGTitle = true;
  var direction = defView.getComputedStyle(tipElement, "")
                         .getPropertyValue("direction");

  // If the element is invalid per HTML5 Forms specifications and has no title,
  // show the constraint validation error message.
  if ((tipElement instanceof HTMLInputElement ||
       tipElement instanceof HTMLTextAreaElement ||
       tipElement instanceof HTMLSelectElement ||
       tipElement instanceof HTMLButtonElement) &&
      !tipElement.hasAttribute("title") &&
      (!tipElement.form || !tipElement.form.noValidate)) {
    // If the element is barred from constraint validation or is valid,
    // the validation message will be the empty string.
    titleText = tipElement.validationMessage || null;
  }

  while ((titleText == null) && (XLinkTitleText == null) &&
         (SVGTitleText == null) && tipElement) {
    if (tipElement.nodeType == Node.ELEMENT_NODE &&
        tipElement.namespaceURI != XULNS) {
      titleText = tipElement.getAttribute("title");
      if ((tipElement instanceof HTMLAnchorElement ||
           tipElement instanceof HTMLAreaElement ||
           tipElement instanceof HTMLLinkElement ||
           tipElement instanceof SVGAElement) && tipElement.href) {
        XLinkTitleText = tipElement.getAttributeNS(XLinkNS, "title");
      }
      if (lookingForSVGTitle &&
          (!(tipElement instanceof SVGElement) ||
           tipElement.parentNode.nodeType == Node.DOCUMENT_NODE)) {
        lookingForSVGTitle = false;
      }
      if (lookingForSVGTitle) {
        let length = tipElement.childNodes.length;
        for (let i = 0; i < length; i++) {
          let childNode = tipElement.childNodes[i];
          if (childNode instanceof SVGTitleElement) {
            SVGTitleText = childNode.textContent;
            break;
          }
        }
      }
      direction = defView.getComputedStyle(tipElement, "")
                         .getPropertyValue("direction");
    }
    tipElement = tipElement.parentNode;
  }

  var tipNode = document.getElementById("aHTMLTooltip");
  tipNode.style.direction = direction;

  return [titleText, XLinkTitleText, SVGTitleText].some(function (t) {
    if (t && /\S/.test(t)) {
      // Make CRLF and CR render one line break each.
      tipNode.setAttribute("label", t.replace(/\r\n?/g, "\n"));
      return true;
    }
    return false;
  });
}

function GetFileFromString(aString)
{
  // If empty string just return null.
  if (!aString)
    return null;

  let commandLine = Components.classes["@mozilla.org/toolkit/command-line;1"]
                              .createInstance(Components.interfaces.nsICommandLine);
  let uri = commandLine.resolveURI(aString);
  return uri instanceof Components.interfaces.nsIFileURL ?
         uri.file.QueryInterface(Components.interfaces.nsILocalFile) : null;
}

function CopyImage()
{
  var param = Components.classes["@mozilla.org/embedcomp/command-params;1"]
                        .createInstance(Components.interfaces.nsICommandParams);
  param.setLongValue("imageCopy",
                     Components.interfaces.nsIContentViewerEdit.COPY_IMAGE_ALL);
  document.commandDispatcher.getControllerForCommand("cmd_copyImage")
          .QueryInterface(Components.interfaces.nsICommandController)
          .doCommandWithParams("cmd_copyImage", param);
}
