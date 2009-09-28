# -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2001
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

/*
 * Core mail routines used by all of the major mail windows (address book, 3-pane, compose and stand alone message window).
 * Routines to support custom toolbars in mail windows, opening up a new window of a particular type all live here. 
 * Before adding to this file, ask yourself, is this a JS routine that is going to be used by all of the main mail windows?
 */

var gCustomizeSheet = false;

function overlayUpdateToolbarMode(aModeValue)
{
  let toolbox = window.frameElement.toolbox;

  // If they chose a mode of textbesideicon or full,
  // then map that to a mode of full, and a labelalign of true or false.
  if( aModeValue == "textbesideicon" || aModeValue == "full") {
    var align = aModeValue == "textbesideicon" ? "end" : "bottom";
    toolbox.setAttribute("labelalign", align);
    toolbox.ownerDocument.persist(toolbox.id, "labelalign");
    aModeValue = "full";
  }
  updateToolbarMode(aModeValue);
}

function overlayOnLoad()
{
  // Add the textBesideIcon menu item if it's not already there.
  let menuitem = document.getElementById("textbesideiconItem");
  if (!menuitem) {
    let menulist = document.getElementById("modelist");
    let label = document.getElementById("iconsBesideText.label")
                        .getAttribute("value");
    menuitem = menulist.appendItem(label, "textbesideicon");
    menuitem.id = "textbesideiconItem";
  }

  // If they have a mode of full and a labelalign of true,
  // then pretend the mode is textbesideicon when populating the popup.
  let toolbox = window.frameElement.toolbox;
  let mode = toolbox.getAttribute("mode");
  let align = toolbox.getAttribute("labelalign");
  if (mode == "full" && align == "end")
    toolbox.setAttribute("mode", "textbesideicon");

  onLoad();

  // Re-set and re-persist the mode, if we changed it above.
  if (mode == "full" && align == "end") {
    toolbox.setAttribute("mode", mode);
    toolbox.ownerDocument.persist(toolbox.id, "mode");
  }
}

function CustomizeMailToolbar(toolboxId, customizePopupId)
{
  // Disable the toolbar context menu items
  var menubar = document.getElementById("mail-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i)
    menubar.childNodes[i].setAttribute("disabled", true);

  var customizePopup = document.getElementById(customizePopupId);
  customizePopup.setAttribute("disabled", "true");

  var toolbox = document.getElementById(toolboxId);

  var customizeURL = "chrome://global/content/customizeToolbar.xul";
  let prefSvc = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService)
                          .getBranch(null);
  gCustomizeSheet = prefSvc.getBoolPref("toolbar.customization.usesheet");

  if (gCustomizeSheet) {
    var sheetFrame = document.getElementById("customizeToolbarSheetIFrame");
    sheetFrame.hidden = false;
    sheetFrame.toolbox = toolbox;

    // The document might not have been loaded yet, if this is the first time.
    // If it is already loaded, reload it so that the onload intialization code
    // re-runs.
    if (sheetFrame.getAttribute("src") == customizeURL)
      sheetFrame.contentWindow.location.reload()
    else
      sheetFrame.setAttribute("src", customizeURL);

    var sheetWidth = sheetFrame.style.width.match(/([0-9]+)px/)[1];
#ifdef MOZILLA_1_9_1_BRANCH
    var rtl = sheetFrame.getAttribute("chromedir") == "rtl";
    var position = "after_start";
    if (rtl)
      position = "after_end";
    document.getElementById("customizeToolbarSheetPopup")
            .openPopup(toolbox, position,
                       (window.innerWidth - sheetWidth) / 2, 0);
#else
    document.getElementById("customizeToolbarSheetPopup")
            .openPopup(toolbox, "after_start",
                       (window.innerWidth - sheetWidth) / 2, 0);
#endif
  }
  else {
    var wintype = document.documentElement.getAttribute("windowtype");
    wintype = wintype.replace(/:/g, "");

    window.openDialog(customizeURL,
                      "CustomizeToolbar"+wintype,
                      "chrome,all,dependent", toolbox);
  }
}

function MailToolboxCustomizeDone(aEvent, customizePopupId)
{
  if (gCustomizeSheet) {
    document.getElementById("customizeToolbarSheetIFrame").hidden = true;
    document.getElementById("customizeToolbarSheetPopup").hidePopup();
  }

  // Update global UI elements that may have been added or removed

  // Re-enable parts of the UI we disabled during the dialog
  var menubar = document.getElementById("mail-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i)
    menubar.childNodes[i].setAttribute("disabled", false);

  // make sure the mail views search box is initialized
  if (document.getElementById("mailviews-container"))
    ViewPickerOnLoad();

  // make sure the folder location picker is initialized
  if (document.getElementById("folder-location-container"))
    FolderPaneSelectionChange();

  var customizePopup = document.getElementById(customizePopupId);
  customizePopup.removeAttribute("disabled");

  // make sure our toolbar buttons have the correct enabled state restored to them...
  if (this.UpdateMailToolbar != undefined)
    UpdateMailToolbar(focus);

  // The GetMail button is stuck in a strange state right now, since the
  // customization wrapping preserves its children, but not its initialized
  // state. Fix that here.
  if (document.getElementById("button-getmsg")) {
    // We can't use _teardown here, because it'll remove the Get All menuitem
    let popup = document.getElementById("button-getMsgPopup");
    let sep = document.getElementById("button-getAllNewMsgSeparator");
    while (popup.lastChild != sep)
      popup.removeChild(popup.lastChild);
  }
}

function onViewToolbarCommand(aEvent, toolboxId)
{
  var toolbox = document.getElementById(toolboxId);
  var index = aEvent.originalTarget.getAttribute("toolbarindex");
  var toolbar = toolbox.childNodes[index];

  toolbar.collapsed = aEvent.originalTarget.getAttribute("checked") != "true";
  document.persist(toolbar.id, "collapsed");
}

function onViewToolbarsPopupShowing(aEvent, toolboxId)
{
  var popup = aEvent.target;

  // Empty the menu
  for (var i = popup.childNodes.length-1; i >= 0; --i) {
    var deadItem = popup.childNodes[i];
    if (deadItem.hasAttribute("toolbarindex"))
      popup.removeChild(deadItem);
  }

  var firstMenuItem = popup.firstChild;

  var toolbox = document.getElementById(toolboxId);
  for (var i = 0; i < toolbox.childNodes.length; ++i) {
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
      menuItem.addEventListener("command",
        function(aEvent) { onViewToolbarCommand(aEvent, toolboxId); }, false);
    }
    toolbar = toolbar.nextSibling;
  }
  var end = toolbox.getAttribute("labelalign") == "end";
  document.getElementById("labelAlignToolbar").setAttribute("checked", end);
  document.getElementById("labelAlign").setAttribute("checked", end);
}

function toJavaScriptConsole()
{
    toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function toOpenWindowByType( inType, uri )
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  var windowManager = Cc['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Ci.nsIWindowMediator);

  var topWindow = windowManagerInterface.getMostRecentWindow( inType );
  if ( topWindow )
    topWindow.focus();
  else
    window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
}

function toMessengerWindow()
{
  toOpenWindowByType("mail:3pane", "chrome://messenger/content/messenger.xul");
}


function focusOnMail(tabNo, event)
{
  // this is invoked by accel-<number>
  // if the window isn't visible or focused, make it so
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  var windowManager = Cc['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Ci.nsIWindowMediator);

  var topWindow = windowManagerInterface.getMostRecentWindow("mail:3pane");
  if (topWindow) {
    if (topWindow != window)
      topWindow.focus();
    else
      document.getElementById('tabmail').selectTabByIndex(event, tabNo);
  }
  else {
    window.open("chrome://messenger/content/messenger.xul",
                "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  }
}

function toAddressBook() 
{
  toOpenWindowByType("mail:addressbook", "chrome://messenger/content/addressbook/addressbook.xul");
}

function toImport()
{
  window.openDialog("chrome://messenger/content/importDialog.xul","importDialog","chrome, modal, titlebar, centerscreen");
}

// aPaneID
function openOptionsDialog(aPaneID, aTabID)
{
  var prefsService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch(null);
  var instantApply = prefsService.getBoolPref("browser.preferences.instantApply");
  var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");

  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
           .getService(Components.interfaces.nsIWindowMediator);
  
  var win = wm.getMostRecentWindow("Mail:Preferences");
  if (win)
  {
    win.focus();
    if (aPaneID)
    {
      var pane = win.document.getElementById(aPaneID);
      win.document.documentElement.showPane(pane);
      
      // I don't know how to support aTabID for an arbitrary panel when the dialog is already open
      // This is complicated because showPane is asynchronous (it could trigger a dynamic overlay)
      // so our tab element may not be accessible right away...
    }
  }
  else 
    openDialog("chrome://messenger/content/preferences/preferences.xul","Preferences", features, aPaneID, aTabID);
}

function openAddonsMgr()
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

function openActivityMgr()
{
  Components.classes['@mozilla.org/activity-manager-ui;1'].
    getService(Components.interfaces.nsIActivityManagerUI).show(window);
}

function SetBusyCursor(window, enable)
{
    // setCursor() is only available for chrome windows.
    // However one of our frames is the start page which 
    // is a non-chrome window, so check if this window has a
    // setCursor method
    if ("setCursor" in window) {
        if (enable)
            window.setCursor("progress");
        else
            window.setCursor("auto");
    }

  var numFrames = window.frames.length;
  for(var i = 0; i < numFrames; i++)
    SetBusyCursor(window.frames[i], enable);
}

function openAboutDialog()
{
#ifdef XP_MACOSX
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("Mail:About");
  if (win)  // If we have an open about dialog, just focus it.
    win.focus();
  else {
    // Define minimizable=no although it does nothing on OS X
    // (see Bug 287162); remove this comment once Bug 287162 is fixed...
    window.open("chrome://messenger/content/aboutDialog.xul", "About",
                "chrome, resizable=no, minimizable=no");
  }
#else
  window.openDialog("chrome://messenger/content/aboutDialog.xul", "About", "centerscreen,chrome,resizable=no");
#endif
}

/**
 * Opens the support page based on the app.support.baseURL pref.
 */
function openSupportURL()
{
  openFormattedURL("app.support.baseURL");
}

/**
 *  Fetches the url for the passed in pref name, formats it and then loads it in the default
 *  browser.
 *
 *  @param aPrefName - name of the pref that holds the url we want to format and open
 */
function openFormattedURL(aPrefName)
{
  var urlToOpen = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                            .getService(Components.interfaces.nsIURLFormatter)
                            .formatURLPref(aPrefName);

  var uri = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService)
                      .newURI(urlToOpen, null, null);

  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Components.interfaces.nsIExternalProtocolService);
  protocolSvc.loadURI(uri);
}
