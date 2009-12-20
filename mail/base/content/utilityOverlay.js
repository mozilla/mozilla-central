/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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

var gShowBiDi = false;

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
function gatherTextUnder ( root ) 
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
  // Strip leading and trailing whitespace.
  text = text.trim();
  // Compress remaining whitespace.
  text = text.replace( /\s+/g, " " );
  return text;
}

function GenerateValidFilename(filename, extension)
{
  if (filename) // we have a title; let's see if it's usable
  {
    // clean up the filename to make it usable and
    // then trim whitespace from beginning and end
    filename = validateFileName(filename).trim();
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

function goToggleToolbar( id, elementID )
{
  var toolbar = document.getElementById( id );
  var element = document.getElementById( elementID );
  if ( toolbar )
  {
    var isHidden = toolbar.getAttribute("hidden") == "true";
    toolbar.setAttribute("hidden", !isHidden);
    if ( element )
      element.setAttribute("checked", isHidden)
    document.persist(id, 'hidden');
    document.persist(elementID, 'checked');
  }
}

#ifdef MOZ_UPDATER
/**
 * Opens the update manager and checks for updates to the application.
 */
function checkForUpdates()
{
  var um =
      Components.classes["@mozilla.org/updates/update-manager;1"].
      getService(Components.interfaces.nsIUpdateManager);
  var prompter =
      Components.classes["@mozilla.org/updates/update-prompt;1"].
      createInstance(Components.interfaces.nsIUpdatePrompt);

  // If there's an update ready to be applied, show the "Update Downloaded"
  // UI instead and let the user know they have to restart the application for
  // the changes to be applied.
  if (um.activeUpdate && um.activeUpdate.state == "pending")
    prompter.showUpdateDownloaded(um.activeUpdate);
  else
    prompter.checkForUpdates();
}
#endif

/**
 * Set up the help menu software update items to show proper status,
 * also disabling the items if update is disabled.
 */
function buildHelpMenu()
{
#ifdef MOZ_UPDATER
  var updates =
      Components.classes["@mozilla.org/updates/update-service;1"].
#ifdef MOZILLA_1_9_2_BRANCH
      getService(Components.interfaces.nsIApplicationUpdateService2);
#else
      getService(Components.interfaces.nsIApplicationUpdateService);
#endif
  var um =
      Components.classes["@mozilla.org/updates/update-manager;1"].
      getService(Components.interfaces.nsIUpdateManager);

  // Disable the UI if the update enabled pref has been locked by the
  // administrator or if we cannot update for some other reason.
  var checkForUpdates = document.getElementById("checkForUpdates");
  var canCheckForUpdates = updates.canCheckForUpdates;
  checkForUpdates.setAttribute("disabled", !canCheckForUpdates);
  if (!canCheckForUpdates)
    return;

  var strings = document.getElementById("bundle_messenger");
  var activeUpdate = um.activeUpdate;

  // If there's an active update, substitute its name into the label
  // we show for this item, otherwise display a generic label.
  function getStringWithUpdateName(key) {
    if (activeUpdate && activeUpdate.name)
      return strings.getFormattedString(key, [activeUpdate.name]);
    return strings.getString(key + "Fallback");
  }

  // By default, show "Check for Updates..." from updatesItem_default or
  // updatesItem_defaultFallback
  var key = "default";
  if (activeUpdate) {
    switch (activeUpdate.state) {
    case "downloading":
      // If we're downloading an update at present, show the text:
      // "Downloading Thunderbird x.x..." from updatesItem_downloading or
      // updatesItem_downloadingFallback, otherwise we're paused, and show
      // "Resume Downloading Thunderbird x.x..." from updatesItem_resume or
      // updatesItem_resumeFallback
      key = updates.isDownloading ? "downloading" : "resume";
      break;
    case "pending":
      // If we're waiting for the user to restart, show: "Apply Downloaded
      // Updates Now..." from updatesItem_pending or
      // updatesItem_pendingFallback
      key = "pending";
      break;
    }
  }

  checkForUpdates.label = getStringWithUpdateName("updatesItem_" + key);
  // updatesItem_default.accesskey, updatesItem_downloading.accesskey,
  // updatesItem_resume.accesskey or updatesItem_pending.accesskey
  checkForUpdates.accessKey = strings.getString("updatesItem_" + key +
                                                ".accesskey");
  if (um.activeUpdate && updates.isDownloading)
    checkForUpdates.setAttribute("loading", "true");
  else
    checkForUpdates.removeAttribute("loading");
#else
#ifndef XP_MACOSX
  // Some extensions may rely on these being present so only hide the updates
  // separator when there are no elements besides the check for updates menuitem
  // in between the about separator and the updates separator.
  var aboutSeparator = document.getElementById("menu_HelpAboutSeparator");
  var updatesSeparator = document.getElementById("menu_HelpAfterUpdatesSeparator");
  var checkForUpdates = document.getElementById("checkForUpdates");
  if (aboutSeparator.nextSibling === checkForUpdates &&
      checkForUpdates.nextSibling === updatesSeparator)
    updatesSeparator.hidden = true;
#endif
#endif
}

// openUILink handles clicks on UI elements that cause URLs to load.
// Firefox and SeaMonkey have a function with the same name,
// so extensions can use this everywhere to open links.
// We currently only react to left click in Thunderbird.
function openUILink(url, event)
{
  if (!event.button)
    messenger.launchExternalURL(url);
}

function openWhatsNew()
{
  let startpage =
    Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
              .getService(Components.interfaces.nsIURLFormatter)
              .formatURLPref("mailnews.start_page.override_url");

  openContentTab(startpage);
}

function openContentTab(url)
{
  let tabmail = document.getElementById("tabmail");
  if (!tabmail) {
    // Try opening new tabs in an existing 3pane window
    let mail3PaneWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                    .getService(Components.interfaces.nsIWindowMediator)
                                    .getMostRecentWindow("mail:3pane");
    if (mail3PaneWindow) {
      tabmail = mail3PaneWindow.document.getElementById("tabmail");
      mail3PaneWindow.focus();
    }
  }

  if (tabmail)
    tabmail.openTab("contentTab", {contentPage: url});
  else
    window.openDialog("chrome://messenger/content/", "_blank",
                      "chrome,dialog=no,all", null,
                      { tabType: "contentTab",
                        tabParams: {contentPage: url} });
}

function openFeatureConfigurator() {
  let mail3PaneWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                  .getService(Components.interfaces.nsIWindowMediator)
                                  .getMostRecentWindow("mail:3pane");
  const url = "chrome://messenger/content/featureConfigurator.xhtml";
  if (mail3PaneWindow) {
    mail3PaneWindow.focus();
    mail3PaneWindow.document.getElementById("tabmail")
                            .openTab("chromeTab", {chromePage: url});
  } else {
    window.openDialog("chrome://messenger/content/", "_blank",
                      "chrome,dialog=no,all", null,
                      { tabType: "chromeTab",
                        tabParams: {chromePage: url} });
  }
}
