/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gUntitledString;

function TextEditorOnLoad()
{
  var url = "about:blank";
  // See if argument was passed.
  if (window.arguments && window.arguments[0])
  {
    // Opened via window.openDialog with URL as argument.
    url = window.arguments[0];
  }
  // Continue with normal startup.
  EditorStartup(url);
}

function EditorOnLoad()
{
  var url = "about:blank";
  var charset;
  // See if argument was passed.
  if (window.arguments)
  {
    if (window.arguments[0])
    {
      // Opened via window.openDialog with URL as argument.
      url = window.arguments[0];
    }

    // get default character set if provided
    if (window.arguments.length > 1 && window.arguments[1])
    {
      if (window.arguments[1].contains("charset="))
      {
        var arrayArgComponents = window.arguments[1].split("=");
        if (arrayArgComponents)
          charset = arrayArgComponents[1];
      }
    }
  }

  // XUL elements we use when switching from normal editor to edit source.
  gContentWindowDeck = document.getElementById("ContentWindowDeck");
  gFormatToolbar = document.getElementById("FormatToolbar");
  gViewFormatToolbar = document.getElementById("viewFormatToolbar");

  // Continue with normal startup.
  EditorStartup(url, charset);

  // Hide Highlight button if we are in an HTML editor with CSS mode off
  // and tell the editor if a CR in a paragraph creates a new paragraph.
  var cmd = document.getElementById("cmd_highlight");
  if (cmd) {
    if (!Services.prefs.getBoolPref(kUseCssPref))
      cmd.collapsed = true;
  }

  // Initialize our source text <editor>
  try {
    gSourceContentWindow = document.getElementById("content-source");
    gSourceContentWindow.makeEditable("text", false);
    gSourceTextEditor = gSourceContentWindow.getEditor(gSourceContentWindow.contentWindow);
    gSourceTextEditor.QueryInterface(Components.interfaces.nsIPlaintextEditor);
    gSourceTextEditor.enableUndo(false);
    gSourceTextEditor.rootElement.style.fontFamily = "-moz-fixed";
    gSourceTextEditor.rootElement.style.whiteSpace = "pre";
    gSourceTextEditor.rootElement.style.margin = 0;
    var controller = Components.classes["@mozilla.org/embedcomp/base-command-controller;1"]
                               .createInstance(Components.interfaces.nsIControllerContext);
    controller.init(null);
    controller.setCommandContext(gSourceContentWindow);
    gSourceContentWindow.contentWindow.controllers.insertControllerAt(0, controller);
    var commandTable = controller.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                 .getInterface(Components.interfaces.nsIControllerCommandTable);
    commandTable.registerCommand("cmd_find",        nsFindCommand);
    commandTable.registerCommand("cmd_findNext",    nsFindAgainCommand);
    commandTable.registerCommand("cmd_findPrev",    nsFindAgainCommand);
  } catch (e) {
    dump("makeEditable failed: "+e+"\n");
  }
}

function EditorStartup(aUrl, aCharset)
{
  gUntitledString = GetFormattedString("untitledTitle", GetNextUntitledValue());

  var ds = GetCurrentEditorElement().docShell;
  ds.useErrorPages = false;
  var root = ds.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
               .rootTreeItem.QueryInterface(Components.interfaces.nsIDocShell);

  root.QueryInterface(Components.interfaces.nsIDocShell).appType =
    Components.interfaces.nsIDocShell.APP_TYPE_EDITOR;

  // EditorSharedStartup also used by Message Composer.
  EditorSharedStartup();

  // Commands specific to the Composer Application window,
  //  (i.e., not embedded editors)
  //  such as file-related commands, HTML Source editing, Edit Modes...
  SetupComposerWindowCommands();

  ShowHideToolbarButtons();
  gEditorToolbarPrefListener = new nsPrefListener(kEditorToolbarPrefs);

  gCSSPrefListener = new nsPrefListener(kUseCssPref);
  gReturnInParagraphPrefListener = new nsPrefListener(kCRInParagraphsPref);
  Services.obs.addObserver(EditorCanClose, "quit-application-requested", false);

  // Get url for editor content and load it. The editor gets instantiated by
  // the editingSession when the URL has finished loading.
  try {
    var contentViewer = GetCurrentEditorElement().markupDocumentViewer;
    contentViewer.forceCharacterSet = aCharset;
  } catch (e) {}
  EditorLoadUrl(aUrl);
}

function EditorShutdown()
{
  Services.obs.removeObserver(EditorCanClose, "quit-application-requested");

  gEditorToolbarPrefListener.shutdown();
  gCSSPrefListener.shutdown();
  gReturnInParagraphPrefListener.shutdown();

  try
  {
    var commandManager = GetCurrentCommandManager();
    commandManager.removeCommandObserver(gEditorDocumentObserver,
                                         "obs_documentCreated");
    commandManager.removeCommandObserver(gEditorDocumentObserver,
                                         "obs_documentWillBeDestroyed");
    commandManager.removeCommandObserver(gEditorDocumentObserver,
                                         "obs_documentLocationChanged");
  } catch (e) { dump (e); }
}

// --------------------------- File menu ---------------------------

// Check for changes to document and allow saving before closing
// This is hooked up to the OS's window close widget (e.g., "X" for Windows)
function EditorCanClose(aCancelQuit, aTopic, aData)
{
  if (aTopic == "quit-application-requested" &&
      aCancelQuit instanceof Components.interfaces.nsISupportsPRBool &&
      aCancelQuit.data)
    return false;

  // Returns FALSE only if user cancels save action

  // "true" means allow "Don't Save" button
  var canClose = CheckAndSaveDocument("cmd_close", true);

  // This is our only hook into closing via the "X" in the caption
  //   or "Quit" (or other paths?)
  //   so we must shift association to another
  //   editor or close any non-modal windows now
  if (canClose && "InsertCharWindow" in window && window.InsertCharWindow)
    SwitchInsertCharToAnotherEditorOrClose();

  if (!canClose && aTopic == "quit-application-requested")
    aCancelQuit.data = true;

  return canClose;
}

function BuildRecentPagesMenu()
{
  var editor = GetCurrentEditor();
  if (!editor)
    return;

  var popup = document.getElementById("menupopup_RecentFiles");
  if (!popup || !editor.document)
    return;

  // Delete existing menu
  while (popup.firstChild)
    popup.removeChild(popup.firstChild);

  // Current page is the "0" item in the list we save in prefs,
  //  but we don't include it in the menu.
  var curUrl = StripPassword(GetDocumentUrl());
  var historyCount = GetIntPref("editor.history.url_maximum", 10);

  var menuIndex = 1;
  for (var i = 0; i < historyCount; i++)
  {
    var url = GetStringPref("editor.history_url_" + i);

    // Skip over current url
    if (url && url != curUrl)
    {
      // Build the menu
      var title = GetStringPref("editor.history_title_" + i);
      var fileType = GetStringPref("editor.history_type_" + i);
      AppendRecentMenuitem(popup, title, url, fileType, menuIndex);
      menuIndex++;
    }
  }
}

function AppendRecentMenuitem(aPopup, aTitle, aUrl, aFileType, aIndex)
{
  if (!aPopup)
    return;

  var menuItem = document.createElement("menuitem");
  if (!menuItem)
    return;

  var accessKey = aIndex <= 10 ? String(aIndex % 10) : " ";

  // Show "title [url]" or just the URL.
  var itemString = aTitle ? aTitle + " [" + aUrl + "]" : aUrl;

  menuItem.setAttribute("label", accessKey + " " + itemString);
  menuItem.setAttribute("crop", "center");
  menuItem.setAttribute("tooltiptext", aUrl);
  menuItem.setAttribute("value", aUrl);
  menuItem.setAttribute("fileType", aFileType);
  if (accessKey != " ")
    menuItem.setAttribute("accesskey", accessKey);
  aPopup.appendChild(menuItem);
}

function EditorInitFileMenu()
{
  // Disable "Save" menuitem when editing remote url. User should use "Save As"

  var docUrl = GetDocumentUrl();
  var scheme = GetScheme(docUrl);
  if (scheme && scheme != "file")
    SetElementEnabledById("menu_saveCmd", false);

  // Enable recent pages submenu if there are any history entries in prefs.
  var historyUrl = "";

  if (GetIntPref("editor.history.url_maximum", 10))
  {
    historyUrl = GetStringPref("editor.history_url_0");

    // See if there's more if current file is only entry in history list.
    if (historyUrl && historyUrl == docUrl)
      historyUrl = GetStringPref("editor.history_url_1");
  }
  SetElementEnabledById("menu_RecentFiles", historyUrl != "");
}

function updateCharsetPopupMenu(aMenuPopup)
{
  if (IsDocumentModified() && !IsDocumentEmpty())
  {
    for (var i = 0; i < aMenuPopup.childNodes.length; i++)
      aMenuPopup.childNodes[i].setAttribute("disabled", "true");
  }
}
