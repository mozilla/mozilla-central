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
 * Contributor(s): 
 *   Matthew Willis <mattwillis@gmail.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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

function toJavaScriptConsole()
{
    toOpenWindowByType("global:console", "chrome://global/content/console.xul");
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

#ifdef MOZ_UPDATER
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
#endif

/** 
 * Controls the update check menu item
 */
function sbUpdateItem()
{
#ifdef MOZ_UPDATER
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
        checkForUpdates.label = calGetString("calendar", "updatesItem_" + key, [activeUpdate.name]);
    } else {
        checkForUpdates.label = calGetString("calendar", "updatesItem_" + key + "Fallback");
    }

    if (updateManager.activeUpdate && updateService.isDownloading) {
        checkForUpdates.setAttribute("loading", "true");
    }
    else {
        checkForUpdates.removeAttribute("loading");
    }
#else
#ifndef XP_MACOSX
  // Some extensions may rely on these being present so only hide the updates
  // separator when there are no elements besides the check for updates menuitem
  // in between the about separator and the updates separator.
  var updatesSeparator = document.getElementById("menu_HelpUpdatesSeparator");
  var aboutSeparator = document.getElementById("menu_HelpAboutSeparator");
  var checkForUpdates = document.getElementById("checkForUpdates");
  if (updatesSeparator.nextSibling === checkForUpdates &&
      checkForUpdates.nextSibling === aboutSeparator)
    updatesSeparator.hidden = true;
#endif
#endif
}
