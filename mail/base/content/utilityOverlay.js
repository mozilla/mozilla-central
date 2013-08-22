/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gShowBiDi = false;

function getBrowserURL() {
  return Services.prefs.getCharPref("browser.chromeURL");
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
  if (Services.prefs.getBoolPref("mail.save_msg_filename_underscores_for_space"))
    aFileName = aFileName.replace(/ /g, "_");

  if (navigator.appVersion.contains("Windows")) {
    re = /[\\\/\|]+/g;
    aFileName = aFileName.replace(/[\"]+/g, "'");
    aFileName = aFileName.replace(/[\*\:\?]+/g, " ");
    aFileName = aFileName.replace(/[\<]+/g, "(");
    aFileName = aFileName.replace(/[\>]+/g, ")");
  }
  else if (navigator.appVersion.contains("Macintosh"))
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

/**
 * Toggle a splitter to show or hide some piece of UI (e.g. the message preview
 * pane).
 *
 * @param splitterId the splliter that should be toggled
 */
function togglePaneSplitter(splitterId)
{
  var splitter = document.getElementById(splitterId);
  var state = splitter.getAttribute("state");
  if (state == "collapsed")
    splitter.setAttribute("state", "open");
  else
    splitter.setAttribute("state", "collapsed")
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
  openContentTab(Services.urlFormatter.formatURLPref("mailnews.start_page.override_url"));
}

/**
 * Open the specified tab type (possibly in a new window)
 *
 * @param tabType the tab type to open (e.g. "contentTab")
 * @param tabParams the parameters to pass to the tab
 * @param where 'tab' to open in a new tab (default) or 'window' to open in a
 *        new window
 */
function openTab(tabType, tabParams, where)
{
  if (where != "window") {
    let tabmail = document.getElementById("tabmail");
    if (!tabmail) {
      // Try opening new tabs in an existing 3pane window
      let mail3PaneWindow = Services.wm.getMostRecentWindow("mail:3pane");
      if (mail3PaneWindow) {
        tabmail = mail3PaneWindow.document.getElementById("tabmail");
        mail3PaneWindow.focus();
      }
    }

    if (tabmail) {
      tabmail.openTab(tabType, tabParams);
      return;
    }
  }

  // Either we explicitly wanted to open in a new window, or we fell through to
  // here because there's no 3pane.
  window.openDialog("chrome://messenger/content/", "_blank",
                    "chrome,dialog=no,all", null,
                    { tabType: tabType, tabParams: tabParams });
}

/**
 * Open the specified URL as a content tab (or window)
 *
 * @param url the location to open
 * @param where 'tab' to open in a new tab (default) or 'window' to open in a
 *        new window
 * @param handlerRegExp a regular expression (as a string) to use for the
 *        siteClickHandler for determining whether a link should be opened in
 *        Thunderbird or passed to the system
 */
function openContentTab(url, where, handlerRegExp)
{
  let clickHandler = null;
  if (handlerRegExp)
    clickHandler = "specialTabs.siteClickHandler(event, new RegExp(\"" + handlerRegExp + "\"));";

  openTab("contentTab", {contentPage: url, clickHandler: clickHandler}, where);
}

/**
 * Open a search page for the specified query in a new tab, window, or
 * externally. If mail.websearch.open_externally is true, always open
 * externally.
 *
 * @param query the term to search for
 * @param where 'tab' to open in a new tab (default), 'window' to open in a
 *        new window, or 'external' to open in the default browser
 */
function openSearchTab(query, where) {
  let currentEngine = Services.search.currentEngine;
  let submission = currentEngine.getSubmission(query);

  if (where == "external" ||
      Services.prefs.getBoolPref("mail.websearch.open_externally")) {
    openLinkExternally(submission.uri.spec);
    return;
  }

  let params = {
    background: false,
    contentPage: submission.uri.spec,
    postData: submission.postData,
    query: query,
    engine: currentEngine,
    clickHandler: "webSearchTabType.siteClickHandler(event)",
  };
  openTab("webSearchTab", params, where);
}

/**
 * Open the dictionary list in a new content tab, if possible in an available
 * mail:3pane window, otherwise by opening a new mail:3pane.
 *
 * @param where the context to open the dictionary list in (e.g. 'tab',
 *        'window'). See openContentTab for more details.
 */
function openDictionaryList(where) {
  let dictUrl = Services.urlFormatter
    .formatURLPref("spellchecker.dictionaries.download.url");
  openContentTab(dictUrl, where, "^https://addons.mozilla.org/");
}

/**
 * Open the privacy policy in a new content tab, if possible in an available
 * mail:3pane window, otherwise by opening a new mail:3pane.
 *
 * @param where the context to open the privacy policy in (e.g. 'tab',
 *        'window'). See openContentTab for more details.
 */
function openPrivacyPolicy(where) {
  const kTelemetryInfoUrl = "toolkit.telemetry.infoURL";
  let url = Services.prefs.getCharPref(kTelemetryInfoUrl);
  openContentTab(url, where, "^http://www.mozilla.org/");
}
