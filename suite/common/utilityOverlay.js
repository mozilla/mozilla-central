/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Alec Flett <alecf@netscape.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

/**
 * Communicator Shared Utility Library
 * for shared application glue for the Communicator suite of applications
 **/

/*
  Note: All Editor/Composer-related methods have been moved to editorApplicationOverlay.js,
  so app windows that require those must include editorNavigatorOverlay.xul
*/

/**
 * Go into online/offline mode
 **/

const kIOServiceProgID = "@mozilla.org/network/io-service;1";
const kObserverServiceProgID = "@mozilla.org/observer-service;1";
const kProxyManual = ["network.proxy.ftp",
                      "network.proxy.gopher",
                      "network.proxy.http",
                      "network.proxy.socks",
                      "network.proxy.ssl"];
var gShowBiDi = false;
var gUtilityBundle = null;

function toggleOfflineStatus()
{
  var checkfunc;
  try {
    checkfunc = document.getElementById("offline-status").getAttribute('checkfunc');
  }
  catch (ex) {
    checkfunc = null;
  }

  var ioService = Components.classes[kIOServiceProgID]
                            .getService(Components.interfaces.nsIIOService2);
  if (checkfunc) {
    if (!eval(checkfunc)) {
      // the pre-offline check function returned false, so don't go offline
      return;
    }
  }
  ioService.manageOfflineStatus = false;
  ioService.offline = !ioService.offline;
}

function setNetworkStatus(networkProxyType)
{
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);
  try {
    prefBranch.setIntPref("network.proxy.type", networkProxyType);
  }
  catch (ex) {}
}

function InitProxyMenu()
{
  var networkProxyNo = document.getElementById("network-proxy-no");
  var networkProxyManual = document.getElementById("network-proxy-manual");
  var networkProxyPac = document.getElementById("network-proxy-pac");
  var networkProxyWpad = document.getElementById("network-proxy-wpad");
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);

  var proxyLocked = prefBranch.prefIsLocked("network.proxy.type");
  if (proxyLocked) {
    networkProxyNo.setAttribute("disabled", "true");
    networkProxyWpad.setAttribute("disabled", "true");
  }
  else {
    networkProxyNo.removeAttribute("disabled");
    networkProxyWpad.removeAttribute("disabled");
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

  var networkProxyType;
  try {
    networkProxyType = prefBranch.getIntPref("network.proxy.type");
  } catch(e) {}

  // The pref value 3 for network.proxy.type is unused to maintain
  // backwards compatibility. Treat 3 equally to 0. See bug 115720.
  var networkProxyStatus = [networkProxyNo, networkProxyManual, networkProxyPac,
                            networkProxyNo, networkProxyWpad];
  networkProxyStatus[networkProxyType].setAttribute("checked", "true");
}

function setProxyTypeUI()
{
  var panel = document.getElementById("offline-status");
  if (!panel)
    return;

  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);

  try {
    var networkProxyType = prefBranch.getIntPref("network.proxy.type");
  } catch(e) {}

  var onlineTooltip = "onlineTooltip" + networkProxyType;
  panel.setAttribute("tooltiptext", gUtilityBundle.getString(onlineTooltip));
}

function GetStringPref(name)
{
  try {
    return pref.getComplexValue(name, Components.interfaces.nsISupportsString).data;
  } catch (e) {}
  return "";
}

function setOfflineUI(offline)
{
  var broadcaster = document.getElementById("Communicator:WorkMode");
  var panel = document.getElementById("offline-status");
  if (!broadcaster || !panel) return;

  // Checking for a preference "network.online", if it's locked, disabling
  // network icon and menu item
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);

  var offlineLocked = prefBranch.prefIsLocked("network.online");

  if (offlineLocked ) {
      broadcaster.setAttribute("disabled","true");
  }

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
      try {
        var networkProxyType = prefBranch.getIntPref("network.proxy.type");
      } catch(e) {}
      var onlineTooltip = "onlineTooltip" + networkProxyType;
      panel.setAttribute("tooltiptext", gUtilityBundle.getString(onlineTooltip));
    }
}

function getBrowserURL() {

  try {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch);
    var url = prefs.getCharPref("browser.chromeURL");
    if (url)
      return url;
  } catch(e) {
  }
  return "chrome://navigator/content/navigator.xul";
}

function goPreferences(containerID, paneURL, itemID)
{
  //check for an existing pref window and focus it; it's not application modal
  const kWindowMediatorContractID = "@mozilla.org/appshell/window-mediator;1";
  const kWindowMediatorIID = Components.interfaces.nsIWindowMediator;
  const kWindowMediator = Components.classes[kWindowMediatorContractID]
                                    .getService(kWindowMediatorIID);

  // Bug 394522:
  // Until all our pref panels have been migrated to the toolkit way,
  // we need to distinguish between old and new methods of opening a specific
  // panel -> prefwindow only needs the prefpane id in window.arguments[0], so
  // this function here only needs to get one param passed in the future
  // -> we assume that a new style style pref panel is requested if only one
  // (the first) parameter is passed.
  var legacyPrefWindow = paneURL || itemID;
  var prefWindowFragment = legacyPrefWindow ? "pref" : "preferences";
  var lastPrefWindow = kWindowMediator.getMostRecentWindow("mozilla:" + prefWindowFragment);
  if (lastPrefWindow)
    lastPrefWindow.focus();
  else {
    if (!legacyPrefWindow) {
      paneURL = containerID;
      containerID = null;
    }
    openDialog("chrome://communicator/content/pref/" + prefWindowFragment + ".xul",
               "PrefWindow", "chrome,titlebar,dialog=no,resizable",
               paneURL, containerID, itemID);
  }
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
      toolbar.setAttribute("hidden", true );
      if ( element )
        element.setAttribute("checked","false")
    }
    document.persist(id, 'hidden');
    document.persist(elementID, 'checked');
  }
}


function goClickThrobber( urlPref )
{
  var url;
  try {
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch);
    url = pref.getComplexValue(urlPref, Components.interfaces.nsIPrefLocalizedString).data;
  }

  catch(e) {
    url = null;
  }

  if ( url )
    openTopWin(url);
}

function getTopWin()
{
    var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
    var windowManagerInterface = windowManager.QueryInterface( Components.interfaces.nsIWindowMediator);
    var topWindowOfType = windowManagerInterface.getMostRecentWindow( "navigator:browser" );

    if (topWindowOfType) {
        return topWindowOfType;
    }
    return null;
}

function isRestricted( url )
{
  try {
    const nsIURIFixup = Components.interfaces.nsIURIFixup;
    var uriFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                             .getService(nsIURIFixup);
    var url = uriFixup.createFixupURI(url, nsIURIFixup.FIXUP_FLAG_NONE);
    const URI_INHERITS_SECURITY_CONTEXT =
        Components.interfaces.nsIProtocolHandler.URI_INHERITS_SECURITY_CONTEXT;
    return Components.classes["@mozilla.org/network/util;1"]
                     .getService(Components.interfaces.nsINetUtil)
                     .URIChainHasFlags(url, URI_INHERITS_SECURITY_CONTEXT);
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
  const kExistingWindow = Components.interfaces.nsIBrowserDOMWindow.OPEN_CURRENTWINDOW;
  const kNewWindow = Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWWINDOW;

  var browserWin;
  var url = "about:" + (aProtocol || "");
  var pref = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch);
  var defaultAboutState = pref.getIntPref("browser.link.open_external");

  if (defaultAboutState != kNewWindow)
    browserWin = getTopWin();

  if (!browserWin)
    window.openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", url);
  else {
    if (defaultAboutState == kExistingWindow)
      browserWin.loadURI(url);
    else {
      // new tab
      var browser = browserWin.getBrowser();
      var newTab = browser.addTab(url);
      browser.selectedTab = newTab;
    }
    browserWin.content.focus();
  }
}

function goReleaseNotes()
{
  // get release notes URL from prefs
  try {
    var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                              .getService(Components.interfaces.nsIURLFormatter);
    openTopWin(formatter.formatURLPref("app.releaseNotesURL"));
  }
  catch (ex) { dump(ex); }
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
  var updates = Components.classes["@mozilla.org/updates/update-service;1"]
                          .getService(Components.interfaces.nsIApplicationUpdateService);
  var um = Components.classes["@mozilla.org/updates/update-manager;1"]
                     .getService(Components.interfaces.nsIUpdateManager);

  // Disable the UI if the update enabled pref has been locked by the
  // administrator or if we cannot update for some other reason.
  var checkForUpdates = document.getElementById("checkForUpdates");
  var canUpdate = updates.canUpdate;
  checkForUpdates.setAttribute("disabled", !canUpdate);
  if (!canUpdate)
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
  // Strip leading whitespace.
  text = text.replace( /^\s+/, "" );
  // Strip trailing whitespace.
  text = text.replace( /\s+$/, "" );
  // Compress remaining whitespace.
  text = text.replace( /\s+/g, " " );
  return text;
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
    var ioService = Components.classes[kIOServiceProgID]
                              .getService(Components.interfaces.nsIIOService);
    if (state == "network.proxy.type" && !ioService.offline)
      setProxyTypeUI();
  }
}

function utilityOnLoad(aEvent)
{
  gUtilityBundle = document.getElementById("bundle_utilityOverlay");

  var broadcaster = document.getElementById("Communicator:WorkMode");
  if (!broadcaster) return;

  var observerService = Components.classes[kObserverServiceProgID]
                                  .getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(offlineObserver, "network:offline-status-changed", false);
  // make sure we remove this observer later
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);
  prefBranch = prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);

  prefBranch.addObserver("network.proxy.type", proxyTypeObserver, false);

  addEventListener("unload", utilityOnUnload, false);

  // set the initial state
  var ioService = Components.classes[kIOServiceProgID]
                            .getService(Components.interfaces.nsIIOService);
  setOfflineUI(ioService.offline);
}

function utilityOnUnload(aEvent)
{
  var observerService = Components.classes[kObserverServiceProgID]
                                  .getService(Components.interfaces.nsIObserverService);
  observerService.removeObserver(offlineObserver, "network:offline-status-changed");
  var prefService = Components.classes["@mozilla.org/preferences-service;1"];
  prefService = prefService.getService(Components.interfaces.nsIPrefService);
  var prefBranch = prefService.getBranch(null);
  prefBranch = prefBranch.QueryInterface(Components.interfaces.nsIPrefBranch2);

  prefBranch.removeObserver("network.proxy.type", proxyTypeObserver);
}

addEventListener("load", utilityOnLoad, false);

function GenerateValidFilename(filename, extension)
{
  if (filename) // we have a title; let's see if it's usable
  {
    // clean up the filename to make it usable and
    // then trim whitespace from beginning and end
    filename = validateFileName(filename).replace(/^\s+|\s+$/g, "");
    if (filename.length > 0)
      return filename + extension;
  }
  return null;
}

function validateFileName(aFileName)
{
  var re = /[\/]+/g;
  if (navigator.appVersion.indexOf("Windows") != -1) {
    re = /[\\\/\|]+/g;
    aFileName = aFileName.replace(/[\"]+/g, "'");
    aFileName = aFileName.replace(/[\*\:\?]+/g, " ");
    aFileName = aFileName.replace(/[\<]+/g, "(");
    aFileName = aFileName.replace(/[\>]+/g, ")");
  }
  else if (navigator.appVersion.indexOf("Macintosh") != -1)
    re = /[\:\/]+/g;

  return aFileName.replace(re, "_");
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
  // If the event came from an ssl error page, it is probably either the "Add
  // Exception" or "Get Me Out Of Here" button
  if (/^about:neterror\?e=nssBadCert/.test(ownerDoc.documentURI)) {
    if (ot.id == 'exceptionDialogButton') {
      var params = { location : ownerDoc.location.href,
                     exceptionAdded : false };
      window.openDialog('chrome://pippki/content/exceptionDialog.xul',
                        '', 'chrome,centerscreen,modal', params);

      // If the user added the exception cert, attempt to reload the page
      if (params.exceptionAdded)
        ownerDoc.location.reload();
    }
    else if (ot.id == 'getMeOutOfHereButton') {
      // Redirect them to a known-functioning page, default start page
      var url = "about:blank";
      try {
        url = pref.getComplexValue("browser.startup.homepage",
                                   Components.interfaces.nsIPrefLocalizedString).data;
      } catch(e) {
        Components.utils.reportError("Couldn't get homepage pref: " + e);
      }
      content.location = url;
    }
  }
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

function createShowPopupsMenu(parent, browser)
{
  while (parent.lastChild && ("popup" in parent.lastChild))
    parent.removeChild(parent.lastChild);

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
  pref.setBoolPref("privacy.popups.showBrowserMessage", false);
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
    return false;

  if (!aIsFeed) {
    var type = aData.type.toLowerCase().replace(/^\s+|\s*(?:;.*)?$/g, "");

    switch (type) {
      case "text/xml":
      case "application/rdf+xml":
      case "application/xml":
        aIsFeed = /\brss\b/i.test(event.originalTarget.title);
        break;
      case "application/rss+xml":
      case "application/atom+xml":
        aIsFeed = true;
        break;
    }
  }

  if (aIsFeed) {
    try {
      urlSecurityCheck(aData.href, aPrincipal,
                       Components.interfaces.nsIScriptSecurityManager.DISALLOW_INHERIT_PRINCIPAL);
    }
    catch(ex) {
      aIsFeed = false;
    }
  }

  if (type)
    aData.type = type;

  return aIsFeed;
}
