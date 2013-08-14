# -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

/*
 * Core mail routines used by all of the major mail windows (address book,
 * 3-pane, compose and stand alone message window).
 * Routines to support custom toolbars in mail windows, opening up a new window
 * of a particular type all live here.
 * Before adding to this file, ask yourself, is this a JS routine that is going
 * to be used by all of the main mail windows?
 */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gCustomizeSheet = false;

function overlayRestoreDefaultSet() {
  let toolbox = null;
  if ("arguments" in window && window.arguments[0])
    toolbox = window.arguments[0];
  else if (window.frameElement && "toolbox" in window.frameElement)
    toolbox = window.frameElement.toolbox;

  let mode = toolbox.getAttribute("defaultmode");
  let align = toolbox.getAttribute("defaultlabelalign");
  let menulist = document.getElementById("modelist");

  if (mode == "full" && align == "end") {
    toolbox.setAttribute("mode", "textbesideicon");
    toolbox.setAttribute("labelalign", align);
    overlayUpdateToolbarMode("textbesideicon");
  }
  else if (mode == "full" && align == ""){
    toolbox.setAttribute("mode", "full");
    toolbox.removeAttribute("labelalign");
    overlayUpdateToolbarMode(mode);
  }

  restoreDefaultSet();

  if (mode == "full" && align == "end") {
    menulist.value = "textbesideicon";
  }
}

function overlayUpdateToolbarMode(aModeValue)
{
  let toolbox = null;
  if ("arguments" in window && window.arguments[0])
    toolbox = window.arguments[0];
  else if (window.frameElement && "toolbox" in window.frameElement)
    toolbox = window.frameElement.toolbox;

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
  let restoreButton = document.getElementById("main-box")
                              .querySelector("[oncommand*='restore']");
  restoreButton.setAttribute("oncommand", "overlayRestoreDefaultSet();");

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
  let toolbox = null;
  if ("arguments" in window && window.arguments[0])
    toolbox = window.arguments[0];
  else if (window.frameElement && "toolbox" in window.frameElement)
    toolbox = window.frameElement.toolbox;

  let toolbarWindow = document.getElementById("CustomizeToolbarWindow");
  toolbarWindow.setAttribute("toolboxId", toolbox.id);
  if (toolbox.getAttribute("inlinetoolbox") == "true")
    toolbarWindow.setAttribute("inlinetoolbox", "true");
  toolbox.setAttribute("doCustomization", "true");

  let mode = toolbox.getAttribute("mode");
  let align = toolbox.getAttribute("labelalign");
  if (mode == "full" && align == "end")
    toolbox.setAttribute("mode", "textbesideicon");

  onLoad();
  overlayRepositionDialog();

  // Re-set and re-persist the mode, if we changed it above.
  if (mode == "full" && align == "end") {
    toolbox.setAttribute("mode", mode);
    toolbox.ownerDocument.persist(toolbox.id, "mode");
  }
}

function overlayRepositionDialog()
{
  // Position the dialog so it is fully visible on the screen  
  // (if possible)

  // Seems to be necessary to get the correct dialog height/width
  window.sizeToContent();
  var wH  = window.outerHeight;
  var wW  = window.outerWidth;
  var sH  = window.screen.height;
  var sW  = window.screen.width;
  var sX  = window.screenX;
  var sY  = window.screenY;
  var sAL = window.screen.availLeft;
  var sAT = window.screen.availTop;

  var nX = Math.max(Math.min(sX, sW - wW), sAL);
  var nY = Math.max(Math.min(sY, sH - wH), sAT);
  window.moveTo(nX, nY);
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
  gCustomizeSheet = Services.prefs.getBoolPref("toolbar.customization.usesheet");

  if (gCustomizeSheet) {
    var sheetFrame = document.getElementById("customizeToolbarSheetIFrame");
    var panel = document.getElementById("customizeToolbarSheetPopup");
    sheetFrame.hidden = false;
    sheetFrame.toolbox = toolbox;
    sheetFrame.panel = panel;

    // The document might not have been loaded yet, if this is the first time.
    // If it is already loaded, reload it so that the onload intialization code
    // re-runs.
    if (sheetFrame.getAttribute("src") == customizeURL)
      sheetFrame.contentWindow.location.reload()
    else
      sheetFrame.setAttribute("src", customizeURL);

    // Open the panel, but make it invisible until the iframe has loaded so
    // that the user doesn't see a white flash.
    panel.style.visibility = "hidden";
    toolbox.addEventListener("beforecustomization", function () {
      toolbox.removeEventListener("beforecustomization", arguments.callee, false);
      panel.style.removeProperty("visibility");
    }, false);
    panel.openPopup(toolbox, "after_start", 0, 0);
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

  let toolbox = document.querySelector('[doCustomization="true"]');
  if (toolbox) {
    toolbox.removeAttribute("doCustomization");

    // The GetMail button is stuck in a strange state right now, since the
    // customization wrapping preserves its children, but not its initialized
    // state. Fix that here.
    // That is also true for the File -> "Get new messages for" menuitems in both
    // menus (old and new App menu). And also Go -> Folder.
    // TODO bug 904223: try to fix folderWidgets.xml to not do this.
    // See Bug 520457 and Bug 534448 and Bug 709733.
    // Fix Bug 565045: Only treat "Get Message Button" if it is in our toolbox
    for (let popup of [ toolbox.querySelector("#button-getMsgPopup"),
                        document.getElementById("menu_getAllNewMsgPopup"),
                        document.getElementById("appmenu_getAllNewMsgPopup"),
                        document.getElementById("menu_GoFolderPopup"),
                        document.getElementById("appmenu_GoFolderPopup") ])
    {
      if (!popup)
        continue;

      // .teardown() is only available here if the menu has its frame
      // otherwise the folderWidgets.xml::folder-menupopup binding is not
      // attached to the popup. So if it is not available, remove the items
      // explicitly. Only remove elements that were generated by the binding.
      if ("_teardown" in popup) {
        popup._teardown();
      } else {
        for (let i = popup.childNodes.length - 1; i >= 0; i--) {
          let child = popup.childNodes[i];
          if (child.getAttribute("generated") != "true")
            continue;
          if ("_teardown" in child)
            child._teardown();
          popup.removeChild(child);
        }
      }
    }
  }
}

function onViewToolbarsPopupShowing(aEvent, toolboxIds, aInsertPoint)
{
  if (!Array.isArray(toolboxIds))
    toolboxIds = [toolboxIds];

  let popup = aEvent.target;

  // Empty the menu
  for (let i = popup.childNodes.length - 1; i >= 0; --i) {
    let deadItem = popup.childNodes[i];

    // Remove all of the nodes with the iscollapsible
    // attribute.
    if (deadItem.hasAttribute("iscollapsible"))
      popup.removeChild(deadItem);
  }

  // We'll insert the menuitems before the first item in the list if no insert
  // point is defined.
  let firstMenuItem = aInsertPoint || popup.firstChild;

  for (let [, toolboxId] in Iterator(toolboxIds)) {
    let toolbox = document.getElementById(toolboxId);

    // We'll consider either childnodes that have a toolbarname attribute,
    // or externalToolbars.
    let childToolbars = Array.slice(toolbox.querySelectorAll("[toolbarname]"));
    let potentialToolbars = childToolbars.concat(toolbox.externalToolbars);

    for (let [, toolbarElement] in Iterator(potentialToolbars)) {

      // We have to bind to toolbar because Javascript doesn't do fresh
      // let-bindings per Iteration.
      let toolbar = toolbarElement;

      let toolbarName = toolbar.getAttribute("toolbarname");
      if (toolbarName) {
        let menuItem = document.createElement("menuitem");
        let hidingAttribute = toolbar.getAttribute("type") == "menubar" ?
                              "autohide" : "collapsed";
        menuItem.setAttribute("type", "checkbox");
        // Mark this menuitem with an iscollapsible attribute, so we
        // know we can wipe it out later on.
        menuItem.setAttribute("iscollapsible", true);
        menuItem.setAttribute("toolbarid", toolbar.id);
        menuItem.setAttribute("label", toolbarName);
        menuItem.setAttribute("accesskey", toolbar.getAttribute("accesskey"));
        menuItem.setAttribute("checked",
                              toolbar.getAttribute(hidingAttribute) != "true");
        popup.insertBefore(menuItem, firstMenuItem);

        let onMenuItemCommand = function(aEvent) {
          let hidden = aEvent.originalTarget.getAttribute("checked") != "true";
          toolbar.setAttribute(hidingAttribute, hidden);
          document.persist(toolbar.id, hidingAttribute);
        }

        menuItem.addEventListener("command", onMenuItemCommand, false);
      }
    }
  }
}

function toJavaScriptConsole()
{
  toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function toOpenWindowByType(inType, uri)
{
  var topWindow = Services.wm.getMostRecentWindow(inType);
  if (topWindow)
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
  var topWindow = Services.wm.getMostRecentWindow("mail:3pane");
  if (topWindow) {
    if (topWindow != window)
      topWindow.focus();
    else
      document.getElementById('tabmail').selectTabByIndex(event, tabNo);
  }
  else {
    window.open("chrome://messenger/content/messenger.xul",
                "_blank",
                "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
  }
}

function toAddressBook()
{
  toOpenWindowByType("mail:addressbook",
                     "chrome://messenger/content/addressbook/addressbook.xul");
}

function showChatTab()
{
  let tabmail = document.getElementById("tabmail");
  if (gChatTab)
    tabmail.switchToTab(gChatTab);
  else
    tabmail.openTab("chat", {});
}

function toImport()
{
  window.openDialog("chrome://messenger/content/importDialog.xul", "importDialog",
                    "chrome, modal, titlebar, centerscreen");
}

function toSanitize()
{
   Components.classes["@mozilla.org/mail/mailglue;1"]
             .getService(Components.interfaces.nsIMailGlue)
             .sanitize(window);
}

/**
 * Opens the Preferences (Options) dialog.
 *
 * @param aPaneID     ID of prefpane to select automatically.
 * @param aTabID      ID of tab to select on the prefpane.
 * @param aOtherArgs  other prefpane specific arguments
 */
function openOptionsDialog(aPaneID, aTabID, aOtherArgs)
{
  let win = Services.wm.getMostRecentWindow("Mail:Preferences");
  if (win) {
    // the dialog is already open
    win.focus();
    if (aPaneID) {
      let prefWindow = win.document.getElementById("MailPreferences");
      win.selectPaneAndTab(prefWindow, aPaneID, aTabID);
    }
  } else {
    // the dialog must be created
    let instantApply = Services.prefs
                               .getBoolPref("browser.preferences.instantApply");
    let features = "chrome,titlebar,toolbar,centerscreen" +
                   (instantApply ? ",dialog=no" : ",modal");

    openDialog("chrome://messenger/content/preferences/preferences.xul",
               "Preferences", features, aPaneID, aTabID, aOtherArgs);
  }
}

function openAddonsMgr(aView)
{
  if (aView) {
    let emWindow;
    let browserWindow;

    let receivePong = function receivePong(aSubject, aTopic, aData) {
      let browserWin = aSubject.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        .rootTreeItem
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindow);
      if (!emWindow || browserWin == window /* favor the current window */) {
        emWindow = aSubject;
        browserWindow = browserWin;
      }
    }
    Services.obs.addObserver(receivePong, "EM-pong", false);
    Services.obs.notifyObservers(null, "EM-ping", "");
    Services.obs.removeObserver(receivePong, "EM-pong");

    if (emWindow) {
      emWindow.loadView(aView);
      let tabmail = browserWindow.document.getElementById("tabmail");
      tabmail.switchToTab(tabmail.getBrowserForDocument(emWindow));
      emWindow.focus();
      return;
    }
  }

  openContentTab("about:addons", "tab", "addons.mozilla.org");

  if (aView) {
    // This must be a new load, else the ping/pong would have
    // found the window above.
    Services.obs.addObserver(function (aSubject, aTopic, aData) {
        Services.obs.removeObserver(arguments.callee, aTopic);
        aSubject.loadView(aView);
      }, "EM-loaded", false);
  }
}

function openActivityMgr()
{
  Components.classes['@mozilla.org/activity-manager-ui;1'].
    getService(Components.interfaces.nsIActivityManagerUI).show(window);
}

function openIMAccountMgr()
{
  var win = Services.wm.getMostRecentWindow("Messenger:Accounts");
  if (win)
    win.focus();
  else {
    win = Services.ww.openWindow(null,
                                 "chrome://messenger/content/chat/imAccounts.xul",
                                 "Accounts", "chrome,resizable,centerscreen",
                                 null);
  }
  return win;
}

function openIMAccountWizard()
{
  const kFeatures = "chrome,centerscreen,modal,titlebar";
  const kUrl = "chrome://messenger/content/chat/imAccountWizard.xul";
  const kName = "IMAccountWizard";

#ifdef XP_MACOSX
  // On Mac, avoid using the hidden window as a parent as that would
  // make it visible.
  let hiddenWindowUrl =
    Services.prefs.getCharPref("browser.hiddenWindowChromeURL");
  if (window.location.href == hiddenWindowUrl) {
    Services.ww.openWindow(null, kUrl, kName, kFeatures, null);
    return;
  }
#endif
  window.openDialog(kUrl, kName, kFeatures);
}

function openSavedFilesWnd()
{
  Components.classes['@mozilla.org/download-manager-ui;1']
            .getService(Components.interfaces.nsIDownloadManagerUI)
            .show(window);
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
  let enumerator = Services.wm.getEnumerator("Mail:About");
  while (enumerator.hasMoreElements()) {
    // Only open one about window
    let win = enumerator.getNext();
    win.focus();
    return;
  }

#ifdef XP_WIN
  var features = "chrome,centerscreen,dependent";
#elifdef XP_MACOSX
  var features = "chrome,resizable=no,minimizable=no";
#else
  var features = "chrome,centerscreen,dependent,dialog=no";
#endif
  window.openDialog("chrome://messenger/content/aboutDialog.xul", "About", features);
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
  var urlToOpen = Services.urlFormatter.formatURLPref(aPrefName);

  var uri = Services.io.newURI(urlToOpen, null, null);

  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Components.interfaces.nsIExternalProtocolService);
  protocolSvc.loadURI(uri);
}

/**
 * Prompt the user to restart the browser in safe mode.
 */
function safeModeRestart()
{
  // prompt the user to confirm
  let bundle = Services.strings.createBundle(
    "chrome://messenger/locale/messenger.properties");
  let promptTitle = bundle.GetStringFromName("safeModeRestartPromptTitle");
  let promptMessage = bundle.GetStringFromName("safeModeRestartPromptMessage");
  let restartText = bundle.GetStringFromName("safeModeRestartButton");
  let buttonFlags = (Services.prompt.BUTTON_POS_0 *
                     Services.prompt.BUTTON_TITLE_IS_STRING) +
                    (Services.prompt.BUTTON_POS_1 *
                     Services.prompt.BUTTON_TITLE_CANCEL) +
                    Services.prompt.BUTTON_POS_0_DEFAULT;

  let rv = Services.prompt.confirmEx(window, promptTitle, promptMessage,
                                     buttonFlags, restartText, null, null,
                                     null, {});
  if (rv == 0) {
    let environment = Components.classes["@mozilla.org/process/environment;1"]
                                .getService(Components.interfaces.nsIEnvironment);
    environment.set("MOZ_SAFE_MODE_RESTART", "1");
    Application.restart();
  }
}

#ifndef XP_WIN
#define BROKEN_WM_Z_ORDER
#endif

function getMostRecentMailWindow() {
#ifdef BROKEN_WM_Z_ORDER
  let win = Services.wm.getMostRecentWindow("mail:3pane", true);

  // if we're lucky, this isn't a popup, and we can just return this
  if (win && win.document.documentElement.getAttribute("chromehidden")) {
    win = null;
    var windowList = Services.wm.getEnumerator("mail:3pane", true);
    // this is oldest to newest, so this gets a bit ugly
    while (windowList.hasMoreElements()) {
      var nextWin = windowList.getNext();
      if (!nextWin.document.documentElement.getAttribute("chromehidden"))
        win = nextWin;
    }
  }
#else
  var windowList = Services.wm.getZOrderDOMWindowEnumerator("mail:3pane", true);
  if (!windowList.hasMoreElements())
    return null;

  var win = windowList.getNext();
  while (win.document.documentElement.getAttribute("chromehidden")) {
    if (!windowList.hasMoreElements())
      return null;

    win = windowList.getNext();
  }
#endif

  return win;
}

/**
 * Create a sanitized display name for an attachment in order to help prevent
 * people from hiding malicious extensions behind a run of spaces, etc. To do
 * this, we strip leading/trailing whitespace and collapse long runs of either
 * whitespace or identical characters. Windows especially will drop trailing
 * dots and whitespace from filename extensions.
 *
 * @param aAttachment the AttachmentInfo object
 * @return a sanitized display name for the attachment
 */
function SanitizeAttachmentDisplayName(aAttachment)
{
  let displayName = aAttachment.name.trim();
  return displayName.replace(/\s+/g, " ")
#ifdef XP_WIN
                    .replace(/[ \.]+$/, "")
#endif
                    .replace(/(.)\1{9,}/g, "$1…$1");
}

/**
 * Create a TransferData object for a message attachment, either from the
 * message reader or the composer.
 *
 * @param aAttachment the attachment object
 * @return the TransferData
 */
function CreateAttachmentTransferData(aAttachment)
{
  // For now, disallow drag-and-drop on cloud attachments. In the future, we
  // should allow this.
  if (aAttachment.contentType == "text/x-moz-deleted" ||
      aAttachment.sendViaCloud)
    return null;

  var name = aAttachment.name || aAttachment.displayName;

  var data = new TransferData();
  if (aAttachment.url && name)
  {
    // Only add type/filename info for non-file URLs that don't already
    // have it.
    if (/(^file:|&filename=)/.test(aAttachment.url))
      var info = aAttachment.url;
    else
      var info = aAttachment.url + "&type=" + aAttachment.contentType +
                 "&filename=" + encodeURIComponent(name);

    data.addDataForFlavour("text/x-moz-url",
                           info + "\n" + name + "\n" + aAttachment.size);
    data.addDataForFlavour("text/x-moz-url-data", aAttachment.url);
    data.addDataForFlavour("text/x-moz-url-desc", name);
    data.addDataForFlavour("application/x-moz-file-promise-url",
                           aAttachment.url);
    data.addDataForFlavour("application/x-moz-file-promise",
                           new nsFlavorDataProvider(), 0,
                           Components.interfaces.nsISupports);
  }
  return data;
}

function nsFlavorDataProvider()
{
}

nsFlavorDataProvider.prototype =
{
  QueryInterface : function(iid)
  {
      if (iid.equals(Components.interfaces.nsIFlavorDataProvider) ||
          iid.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
  },

  getFlavorData : function(aTransferable, aFlavor, aData, aDataLen)
  {
    // get the url for the attachment
    if (aFlavor == "application/x-moz-file-promise")
    {
      var urlPrimitive = { };
      var dataSize = { };
      aTransferable.getTransferData("application/x-moz-file-promise-url",
                                    urlPrimitive, dataSize);

      var srcUrlPrimitive = urlPrimitive.value.QueryInterface(Components.interfaces.nsISupportsString);

      // now get the destination file location from kFilePromiseDirectoryMime
      var dirPrimitive = {};
      aTransferable.getTransferData("application/x-moz-file-promise-dir",
                                    dirPrimitive, dataSize);
      var destDirectory = dirPrimitive.value.QueryInterface(Components.interfaces.nsILocalFile);

      // now save the attachment to the specified location
      // XXX: we need more information than just the attachment url to save it,
      // fortunately, we have an array of all the current attachments so we can
      // cheat and scan through them

      var attachment = null;
      for each (let index in Iterator(currentAttachments, true))
      {
        attachment = currentAttachments[index];
        if (attachment.url == srcUrlPrimitive)
          break;
      }

      // call our code for saving attachments
      if (attachment)
      {
        var name = attachment.name || attachment.displayName;
        var destFilePath = messenger.saveAttachmentToFolder(attachment.contentType,
                                                            attachment.url,
                                                            encodeURIComponent(name),
                                                            attachment.uri,
                                                            destDirectory);
        aData.value = destFilePath.QueryInterface(Components.interfaces.nsISupports);
        aDataLen.value = 4;
      }
    }
  }
}
