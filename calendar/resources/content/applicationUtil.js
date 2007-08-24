/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is Eric Belhaire.
 * Portions created by the Initial Developer are Copyright (C) 2003
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Matthew Willis <mattwillis@gmail.com>
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


const nsIWindowMediator = Components.interfaces.nsIWindowMediator;

// "About Sunbird" dialog
function openAboutDialog()
{
  const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                          .getService(Components.interfaces.nsIXULAppInfo);
  var url = (appInfo.ID == SUNBIRD_ID) ?
    "chrome://calendar/content/aboutDialog.xul" :
    "chrome://messenger/content/aboutDialog.xul" ;
  var name = "About";
#ifdef XP_MACOSX
  // Define minimizable=no although it does nothing on OS X (bug 287162).
  // Remove this comment once bug 287162 is fixed
  window.open(url, name, "centerscreen,chrome,resizable=no,minimizable=no");
#else
  window.openDialog(url, name, "modal,centerscreen,chrome,resizable=no");
#endif
}

/**
 * Opens the release notes page for this version of the application.
 */
function openReleaseNotes()
{
  const SUNBIRD_ID = "{718e30fb-e89b-41dd-9da7-e25a45638b28}";
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                          .getService(Components.interfaces.nsIXULAppInfo);
  if (appInfo.ID == SUNBIRD_ID) {
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                            .getService(Components.interfaces.nsIXULAppInfo);
    var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                        .getService(Components.interfaces.nsIStringBundleService);
    var bundle = sbs.createBundle("chrome://branding/locale/brand.properties");
    var relNotesURL = bundle.formatStringFromName("releaseNotesURL",[appInfo.version],1)
    launchBrowser(relNotesURL);
  } else {
    openFormattedRegionURL('app.releaseNotesURL');
  }
}

/**
 * Opens region specific web pages for the application like the release notes, the help site, etc. 
 *   aResourceName --> the string resource ID in region.properties to load. 
 */
function openRegionURL(aResourceName)
{
  var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                          .getService(Components.interfaces.nsIXULAppInfo);
  try {
    var strBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
    var regionBundle = strBundleService.createBundle("chrome://messenger-region/locale/region.properties");
    // the release notes are special and need to be formatted with the app version
    var urlToOpen;
    if (aResourceName == "releaseNotesURL")
      urlToOpen = regionBundle.formatStringFromName(aResourceName, [appInfo.version], 1);
    else
      urlToOpen = regionBundle.GetStringFromName(aResourceName);
      
    var uri = Components.classes["@mozilla.org/network/io-service;1"]
              .getService(Components.interfaces.nsIIOService)
              .newURI(urlToOpen, null, null);

    var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                      .getService(Components.interfaces.nsIExternalProtocolService);
    protocolSvc.loadUrl(uri);
  } catch (ex) {}
}

/**
 *  Fetches the url for the passed in pref name, formats it and then loads it in the default
 *  browser.
 *
 *  @param aPrefName - name of the pref that holds the url we want to format and open
 */
function openFormattedRegionURL(aPrefName)
{
  var formattedUrl = getFormattedRegionURL(aPrefName);
  
  var uri = Components.classes["@mozilla.org/network/io-service;1"].
                       getService(Components.interfaces.nsIIOService).
                       newURI(formattedUrl, null, null);

  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
                               getService(Components.interfaces.nsIExternalProtocolService);
  protocolSvc.loadUrl(uri);  
}

/**
 *  Fetches the url for the passed in pref name and uses the URL formatter service to 
 *    process it.
 *
 *  @param aPrefName - name of the pref that holds the url we want to format and open
 *  @returns the formatted url string
 */
function getFormattedRegionURL(aPrefName)
{
  var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"].
                             getService(Components.interfaces.nsIURLFormatter);
  return formatter.formatURLPref(aPrefName);
}

function toOpenWindowByType(inType, uri)
{
    var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
    var windowManagerInterface = windowManager.QueryInterface(nsIWindowMediator);
    var topWindow = windowManagerInterface.getMostRecentWindow(inType);

    if (topWindow)
        topWindow.focus();
    else
        window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

function toBrowser()
{
    toOpenWindowByType("navigator:browser", "");
}

function toJavaScriptConsole()
{
    toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function launchBrowser(UrlToGoTo)
{
  if (!UrlToGoTo) {
    return;
  }

  // 0. Prevent people from trying to launch URLs such as javascript:foo();
  //    by only allowing URLs starting with http or https.
  // XXX: We likely will want to do this using nsIURLs in the future to
  //      prevent sneaky nasty escaping issues, but this is fine for now.
  if (UrlToGoTo.indexOf("http") != 0) {
    Components.utils.reportError ("launchBrowser: " +
                                  "Invalid URL provided: " + UrlToGoTo +
                                  " Only http:// and https:// URLs are valid.");
    return;
  }

  // 1. try to get (most recent) browser window, in case in browser app.
  var navWindow;
  try {
    var wm = (Components
              .classes["@mozilla.org/appshell/window-mediator;1"]
              .getService(Components.interfaces.nsIWindowMediator));
    navWindow = wm.getMostRecentWindow("navigator:browser");
  } catch (e) {
    dump("launchBrowser (getMostRecentWindow) exception:\n" + e + "\n");
  }
  if (navWindow) {
    if ("delayedOpenTab" in navWindow)
      navWindow.delayedOpenTab(UrlToGoTo);
    else if ("loadURI" in navWindow)
      navWindow.loadURI(UrlToGoTo);
    else
      navWindow.content.location.href = UrlToGoTo;
    return;
  }

  // 2. try a new browser window, in case in suite (seamonkey)
  var messenger;
  try {
    var messenger = (Components
                     .classes["@mozilla.org/messenger;1"]
                     .createInstance());
    messenger = messenger.QueryInterface(Components.interfaces.nsIMessenger);
  } catch (e) {
    dump("launchBrowser (messenger) exception:\n"+e+"\n");
  }
  if (messenger) {
    messenger.launchExternalURL(UrlToGoTo);  
    return;
  } 

  // 3. try an external app, in case not in a browser app (SB, TB, etc).
  var externalLoader =
    (Components
     .classes["@mozilla.org/uriloader/external-protocol-service;1"]
     .getService(Components.interfaces.nsIExternalProtocolService));
  var nsURI = (Components
               .classes["@mozilla.org/network/io-service;1"]
               .getService(Components.interfaces.nsIIOService)
               .newURI(UrlToGoTo, null, null));
  externalLoader.loadUrl(nsURI);
}


function goToggleToolbar(id, elementID)
{
    var toolbar = document.getElementById(id);
    var element = document.getElementById(elementID);
    if (toolbar) {
        var isHidden = toolbar.hidden;
        toolbar.hidden = !isHidden;
        document.persist(id, 'hidden');
        if (element) {
            element.setAttribute("checked", isHidden ? "true" : "false");
            document.persist(elementID, 'checked');
        }
    }
}


function goOpenAddons()
{
    const EMTYPE = "Extension:Manager";
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var theEM = wm.getMostRecentWindow(EMTYPE);
    if (theEM) {
        theEM.focus();
        return;
    }

    const EMURL = "chrome://mozapps/content/extensions/extensions.xul";
    const EMFEATURES = "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable";
    window.openDialog(EMURL, "", EMFEATURES);
}

/**
 * We recreate the View > Toolbars menu each time it is opened to include any
 * user-created toolbars.
 */
function sbOnViewToolbarsPopupShowing(aEvent)
{
    var popup = aEvent.target;
    var i;

    // Empty the menu
    for (i = popup.childNodes.length-1; i >= 0; i--) {
        var deadItem = popup.childNodes[i];
        if (deadItem.hasAttribute("toolbarindex")) {
            deadItem.removeEventListener("command", sbOnViewToolbarCommand, false);
            popup.removeChild(deadItem);
        }
    }

    var firstMenuItem = popup.firstChild;

    var toolbox = document.getElementById("calendar-toolbox");
    for (i = 0; i < toolbox.childNodes.length; i++) {
        var toolbar = toolbox.childNodes[i];
        var toolbarName = toolbar.getAttribute("toolbarname");
        var type = toolbar.getAttribute("type");
        if (toolbarName && type != "menubar") {
            var menuItem = document.createElement("menuitem");
            menuItem.setAttribute("toolbarindex", i);
            menuItem.setAttribute("type", "checkbox");
            menuItem.setAttribute("label", toolbarName);
            menuItem.setAttribute("accesskey", toolbar.getAttribute("accesskey"));
            menuItem.setAttribute("checked", toolbar.getAttribute("collapsed") != "true");
            popup.insertBefore(menuItem, firstMenuItem);

            menuItem.addEventListener("command", sbOnViewToolbarCommand, false);
        }
    }
}

/**
 * Toggles the visibility of the associated toolbar when fired.
 */
function sbOnViewToolbarCommand(aEvent)
{
    var toolbox = document.getElementById("calendar-toolbox");
    var index = aEvent.originalTarget.getAttribute("toolbarindex");
    var toolbar = toolbox.childNodes[index];

    toolbar.collapsed = (aEvent.originalTarget.getAttribute("checked") != "true");
    document.persist(toolbar.id, "collapsed");
}

/**
 * Checks for available updates using AUS
 */
function sbCheckForUpdates()
{
    var um = Components.classes["@mozilla.org/updates/update-manager;1"]
                       .getService(Components.interfaces.nsIUpdateManager);
    var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"]
                             .createInstance(Components.interfaces.nsIUpdatePrompt);

    // If there's an update ready to be applied, show the "Update Downloaded"
    // UI instead and let the user know they have to restart the application
    // for the changes to be applied.
    if (um.activeUpdate && um.activeUpdate.state == "pending") {
        prompter.showUpdateDownloaded(um.activeUpdate);
    } else {
        prompter.checkForUpdates();
    }
}

/** 
 * Controls the update check menu item
 */
function sbUpdateItem()
{
    var updateService = Components.classes["@mozilla.org/updates/update-service;1"]
                                  .getService(Components.interfaces.nsIApplicationUpdateService);
    var updateManager = Components.classes["@mozilla.org/updates/update-manager;1"]
                                  .getService(Components.interfaces.nsIUpdateManager);

    // Disable the UI if the update enabled pref has been locked by the 
    // administrator or if we cannot update for some other reason
    var checkForUpdates = document.getElementById("checkForUpdates");
    var canUpdate = updateService.canUpdate;
    checkForUpdates.setAttribute("disabled", !canUpdate);
    if (!canUpdate) {
        return;
    } 

    var strings = document.getElementById("bundle_calendar");
    var activeUpdate = updateManager.activeUpdate;

    // By default, show "Check for Updates..."
    var key = "default";
    if (activeUpdate) {
        switch (activeUpdate.state) {
            case "downloading":
                // If we're downloading an update at present, show the text:
                // "Downloading Sunbird x.x..." otherwise we're paused, and show
                // "Resume Downloading Sunbird x.x..."
                key = updateService.isDownloading ? "downloading" : "resume";
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
    if (activeUpdate && activeUpdate.name) {
        checkForUpdates.label = strings.getFormattedString("updatesItem_" + key, [activeUpdate.name]);
    } else {
        checkForUpdates.label = strings.getString("updatesItem_" + key + "Fallback");
    }

    if (updateManager.activeUpdate && updateService.isDownloading) {
        checkForUpdates.setAttribute("loading", "true");
    }
    else {
        checkForUpdates.removeAttribute("loading");
    }
}
