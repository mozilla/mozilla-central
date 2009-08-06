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
 *   Alec Flett      <alecf@netscape.com>
 *   Ben Goodger     <ben@netscape.com>
 *   Mike Pinkerton  <pinkerton@netscape.com>
 *   Blake Ross      <blakeross@telocity.com>
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

/*
 * - [ Dependencies ] ---------------------------------------------------------
 *  utilityOverlay.js:
 *    - gatherTextUnder
 */

  var pref = null;
  pref = Components.classes["@mozilla.org/preferences-service;1"]
                   .getService(Components.interfaces.nsIPrefBranch);

  function hrefAndLinkNodeForClickEvent(event)
  {
    var href = "";
    var linkNode = null;
    var isKeyCommand = (event.type == "command");
    var target = isKeyCommand ? document.commandDispatcher.focusedElement : event.target;

    if ( target instanceof HTMLAnchorElement ||
         target instanceof HTMLAreaElement   ||
         target instanceof HTMLLinkElement ) {
      if (target.hasAttribute("href")) 
        linkNode = target;
    }
    else {
      linkNode = event.originalTarget;
      while (linkNode && !(linkNode instanceof HTMLAnchorElement))
        linkNode = linkNode.parentNode;
      // <a> cannot be nested.  So if we find an anchor without an
      // href, there is no useful <a> around the target
      if (linkNode && !linkNode.hasAttribute("href"))
        linkNode = null;
    }

    if (linkNode) {
      href = linkNode.href;
    } else {
      // Try simple XLink
      linkNode = target;
      while (linkNode) {
        if (linkNode.nodeType == Node.ELEMENT_NODE) {
          href = linkNode.getAttributeNS("http://www.w3.org/1999/xlink", "href");
          break;
        }
        linkNode = linkNode.parentNode;
      }
      if (href) {
        href = makeURLAbsolute(linkNode.baseURI, href);
      }
    }

    return href ? {href: href, linkNode: linkNode} : null;
  }

  // Called whenever the user clicks in the content area,
  // except when left-clicking on links (special case)
  // should always return true for click to go through
  function contentAreaClick(event) 
  {
    if (!event.isTrusted || event.getPreventDefault()) {
      return true;
    }

    var isKeyCommand = (event.type == "command");
    var ceParams = hrefAndLinkNodeForClickEvent(event);
    if (ceParams) {
      var href = ceParams.href;
      if (isKeyCommand) {
        openNewTabWith(href, event.target.ownerDocument, event.altKey);
        event.stopPropagation();
      }
      else {
        // if in mailnews block the link left click if we determine
        // that this URL is phishy (i.e. a potential email scam) 
        if ("gMessengerBundle" in this && event.button < 2 &&
            isPhishingURL(ceParams.linkNode, false, href))
          return false;
        handleLinkClick(event, href, ceParams.linkNode);
      }
      return true;
    }

    if (pref && !isKeyCommand && event.button == 1 &&
        pref.getBoolPref("middlemouse.contentLoadURL")) {
      if (middleMousePaste(event)) {
        event.stopPropagation();
      }
    }
    return true;
  }

  function openNewTabOrWindow(event, href, doc)
  {
    // should we open it in a new tab?
    if (pref && pref.getBoolPref("browser.tabs.opentabfor.middleclick")) {
      openNewTabWith(href, doc, event.shiftKey);
      event.stopPropagation();
      return true;
    }

    // should we open it in a new window?
    if (pref && pref.getBoolPref("middlemouse.openNewWindow")) {
      openNewWindowWith(href, doc);
      event.stopPropagation();
      return true;
    }

    // let someone else deal with it
    return false;
  }

  function handleLinkClick(event, href, linkNode)
  {
    // Checking to make sure we are allowed to open this URL
    // (call to urlSecurityCheck) is now done within openNew... functions

    switch (event.button) {                                   
      case 0:                                                         // if left button clicked
        if (event.metaKey || event.ctrlKey) {                         // and meta or ctrl are down
          if (openNewTabOrWindow(event, href, linkNode.ownerDocument))
            return true;
        } 
        var saveModifier = true;
        if (pref) {
          try {
            saveModifier = pref.getBoolPref("ui.key.saveLink.shift");
          }
          catch(ex) {            
          }
        }
        saveModifier = saveModifier ? event.shiftKey : event.altKey;
          
        if (saveModifier) {                                           // if saveModifier is down
          saveURL(href, gatherTextUnder(linkNode), "SaveLinkTitle",
                  false, linkNode.ownerDocument.documentURIObject);
          return true;
        }
        if (event.altKey)                                             // if alt is down
          return true;                                                // do nothing
        return false;
      case 1:                                                         // if middle button clicked
        if (openNewTabOrWindow(event, href, linkNode.ownerDocument))
          return true;
        break;
    }
    return false;
  }

  var gGlobalHistory = null;
  var gURIFixup = null;

  function middleMousePaste( event )
  {
    var url = readFromClipboard();
    if (!url)
      return false;
    addToUrlbarHistory(url);
    url = getShortcutOrURI(url);

    // On ctrl-middleclick, open in new window or tab.  Do not send referrer.
    if (event.ctrlKey) {
      // fix up our pasted URI in case it is malformed.
      const nsIURIFixup = Components.interfaces.nsIURIFixup;
      if (!gURIFixup)
        gURIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                              .getService(nsIURIFixup);

      url = gURIFixup.createFixupURI(url, nsIURIFixup.FIXUP_FLAGS_MAKE_ALTERNATE_URI).spec;

      return openNewTabOrWindow(event, url, null);
    }

    // If ctrl wasn't down, then just load the url in the targeted win/tab.
    var browser = getBrowser();
    var tab = event.originalTarget;
    if (tab.localName == "tab" &&
        tab.parentNode == browser.mTabContainer) {
      tab.linkedBrowser.userTypedValue = url;
      if (tab == browser.mCurrentTab && url != "about:blank") {
          gURLBar.value = url;
      }
      tab.linkedBrowser.loadURI(url);
      if (event.shiftKey != (pref && pref.getBoolPref("browser.tabs.loadInBackground")))
        browser.selectedTab = tab;
    }
    else if (event.target == browser) {
      tab = browser.addTab(url);
      if (event.shiftKey != (pref && pref.getBoolPref("browser.tabs.loadInBackground")))
        browser.selectedTab = tab;
    }
    else {
      if (url != "about:blank") {
        gURLBar.value = url;
      }
      loadURI(url);
    }

    event.stopPropagation();
    return true;
  }

  function addToUrlbarHistory(aUrlToAdd)
  {
    // Remove leading and trailing spaces first
    aUrlToAdd = aUrlToAdd.trim();

    if (!aUrlToAdd)
      return;
    if (aUrlToAdd.search(/[\x00-\x1F]/) != -1) // don't store bad URLs
      return;

    if (!gGlobalHistory)
      gGlobalHistory = Components.classes["@mozilla.org/browser/global-history;2"]
                                 .getService(Components.interfaces.nsIBrowserHistory);

    if (!gURIFixup)
      gURIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                            .getService(Components.interfaces.nsIURIFixup);

    try {
      var url = getShortcutOrURI(aUrlToAdd);
      var fixedUpURI = gURIFixup.createFixupURI(url, 0);
      if (!fixedUpURI.schemeIs("data"))
        gGlobalHistory.markPageAsTyped(fixedUpURI);
    }
    catch(ex) {
    }

    // Open or create the urlbar history database.
    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                         .getService(Components.interfaces.nsIProperties)
                         .get("ProfD", Components.interfaces.nsIFile);
    file.append("urlbarhistory.sqlite");
    var connection = Components.classes["@mozilla.org/storage/service;1"]
                               .getService(Components.interfaces.mozIStorageService)
                               .openDatabase(file);
    connection.beginTransaction();
    if (!connection.tableExists("urlbarhistory"))
      connection.createTable("urlbarhistory", "url TEXT");

    // If the URL is already present in the database then remove it from
    // its current position. It is then reinserted at the top of the list.
    var statement = connection.createStatement(
        "DELETE FROM urlbarhistory WHERE LOWER(url) = LOWER(?1)");
    statement.bindStringParameter(0, aUrlToAdd);
    statement.execute();
    statement.finalize();

    // Put the value as it was typed by the user in to urlbar history
    statement = connection.createStatement(
        "INSERT INTO urlbarhistory (url) VALUES (?1)");
    statement.bindStringParameter(0, aUrlToAdd);
    statement.execute();
    statement.finalize();

    // Remove any expired history items so that we don't let
    // this grow without bound.
    connection.executeSimpleSQL(
        "DELETE FROM urlbarhistory WHERE ROWID NOT IN " +
          "(SELECT ROWID FROM urlbarhistory ORDER BY ROWID DESC LIMIT 30)");
    connection.commitTransaction();
    connection.close();
  }

  function makeURLAbsolute(base, url)
  {
    // Construct nsIURL.
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService);
    var baseURI  = ioService.newURI(base, null, null);

    return ioService.newURI(baseURI.resolve(url), null, null).spec;
  }
